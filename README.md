# nani-mono-da — multiplayer spaceship easter egg

A crude multiplayer spaceship game meant to be dropped into an existing website as
a hidden easter egg. Fly with WASD, land/takeoff with Q/E, shoot with Space, once
activated — activation itself (Konami code, a hidden button, whatever) is up to
the host app; see "Embedding the UI" below. Everyone who has the page open shares
one live session.

## Architecture

- **`packages/shared`** — Matter.js physics (ship/laser/asteroid body factories),
  tuning constants, and the WebSocket message/entity TypeScript types. Imported
  as raw `.ts` source by both other packages (via `tsx`/Vite, which transpile on
  the fly — there is no compiled `dist` for this package, see "Deploying the
  server" below for why that matters).
- **`packages/server`** — Node + `ws`. One in-memory `Room` (`room.ts`) holds all
  game state (ships, lasers, asteroids) and runs a 60Hz authoritative physics
  tick, broadcasting a full entity snapshot to every connected client each tick.
  There is deliberately **one global room** — everyone who opens the page joins
  the same session, there's no room/lobby concept.
- **`packages/web`** — Vite + vanilla TypeScript, no framework. `mount()`
  (`src/mount.ts`) is the single entry point: it attaches a full-viewport
  `pointer-events:none` canvas + per-ship SVG sprites to a given container,
  opens the WebSocket connection, and returns a `{ enter(), destroy() }`
  handle. WASD/QE/Space stay inert until `enter()` is called — call it from
  wherever your host app detects its own activation trigger (there's no
  built-in click-to-enter; that's a decision for the embedding app to make).
  Own-ship input is predicted locally (zero-lag) and gently reconciled
  against the server; other ships/lasers/asteroids are rendered from
  interpolated server snapshots.

## Local development

```bash
npm install
npm run dev:server   # ws://localhost:8080
npm run dev:web      # http://localhost:5173 (dev harness page)
```

Open the web URL in more than one tab/browser to see multiplayer sync.

---

## Embedding the UI into the Ember app

The whole `web` package is framework-agnostic on purpose — it doesn't touch
Ember's component/template system at all, it just needs *a DOM node to attach
a canvas to*. There are two ways to bring it into the Ember app, depending on
how much control you want.

### Option A — drop-in `<script>` tag (works today, minimal changes)

`packages/web/src/main.ts` is the dev-harness entry point — note that it calls
`mount(document.body).enter()` (auto-entering immediately), which is a
**dev-only convenience** so local testing doesn't require wiring up a real
activation trigger. Don't ship that as-is; fork it into your own entry file
before building for real embedding, e.g.:

```ts
import { mount } from './mount.js';

const handle = mount(document.body, { wsUrl: 'wss://spaceship.yourdomain.com' });

// Wire up whatever your real activation trigger is, then call handle.enter().
// e.g. a Konami-code listener, a hidden button, whatever the host app wants.
```

1. Build it:
   ```bash
   npm run build --workspace packages/web
   ```
   This produces `packages/web/dist/` (an `index.html` you don't need, plus a
   hashed JS bundle under `dist/assets/`).
2. Copy the JS file from `dist/assets/*.js` into the Ember app's `public/`
   directory (e.g. `public/spaceship.js`).
3. Reference it with a plain module script tag wherever you want the easter egg
   active — `app/index.html` for site-wide, or a specific route template for
   scoped placement:
   ```html
   <script type="module" src="/spaceship.js"></script>
   ```
4. It self-mounts to `document.body` on load and is never torn down — since
   Ember is an SPA and this is meant to persist for the whole visit, that's the
   right behavior. If you only include the tag on `application.hbs` it'll
   survive route transitions automatically since the script only runs once per
   full page load. `mount()` itself attaches the (invisible until entered)
   overlay and opens the WebSocket connection right away regardless of when
   `enter()` fires — if you want the whole overlay to not exist at all until
   activation, delay calling `mount()` itself until your trigger fires instead.
5. Use `wss://`, not `ws://`, if the Ember app is served over HTTPS — browsers
   block insecure WebSocket connections from a secure page (mixed content).

### Option B — import `mount()` directly (for route-scoped mounting / cleanup)

If you want to control exactly when the overlay mounts/unmounts (e.g. only on
certain routes, or tied to a modifier's lifecycle) rather than "once, forever,"
import the function instead of using the auto-mounting script.

This needs one small prerequisite the package doesn't have yet — `@nani/web`
is currently set up as a Vite *app* (built from `index.html`), not a
publishable *library*. To expose `mount()` as an importable entry point:

1. Add a second Vite config for library-mode builds, e.g.
   `packages/web/vite.lib.config.ts`:
   ```ts
   import { defineConfig } from 'vite';
   import { resolve } from 'node:path';

   export default defineConfig({
     build: {
       lib: {
         entry: resolve(__dirname, 'src/mount.ts'),
         name: 'NaniSpaceship',
         fileName: 'nani-spaceship',
         formats: ['es'],
       },
       outDir: 'dist-lib',
     },
   });
   ```
2. Add a script to `packages/web/package.json`:
   `"build:lib": "vite build --config vite.lib.config.ts"`, and point
   `"main"`/`"types"` at `dist-lib/nani-spaceship.js` / `dist-lib/nani-spaceship.d.ts`.
3. `npm run build:lib --workspace packages/web`, then depend on `@nani/web` from
   the Ember app (via a published package, a `file:`/`link:` dependency, or a
   private registry — whatever the Ember app's tooling already uses for
   internal packages).
4. Call it from an Ember modifier, keeping the returned handle:
   ```js
   import { modifier } from 'ember-modifier';
   import { mount } from '@nani/web';

   export default modifier((element) => {
     const handle = mount(element, { wsUrl: 'wss://spaceship.yourdomain.com' });
     // Wire up your activation trigger (Konami code, etc.) and call
     // handle.enter() from there whenever/wherever that lives.
     return handle.destroy; // ember-modifier calls this on teardown
   });
   ```

Either option: the overlay is a full-viewport `position:fixed; pointer-events:none`
canvas plus SVG ship sprites layered on top of whatever container you attach it
to, so it never blocks clicks on the real page (see the input guard notes in
`input.ts` for why typing in real form fields also stays unaffected once a ship
is "entered").

---

## Swapping the placeholder ship SVG

The ship hull is a real DOM `<svg>` element (not drawn on canvas) specifically
so its parts can be styled independently — see `packages/web/src/shipSprite.ts`
and `packages/web/src/shipSprite.css.ts`.

1. **Replace the markup.** Edit `SHIP_SVG_INNER` in `shipSprite.ts` — it's the
   inner content of an `<svg>` (paths/shapes only, no outer `<svg>` tag). Keep
   or rename the `class="ship-hull"` / `class="ship-wing"` / `class="ship-cockpit"`
   attributes on whichever parts you want independently colorable, and update
   the CSS selectors in `shipSprite.css.ts` to match.
2. **Keep the coordinate convention.** The shape must be centered at local
   `(0, 0)` with the nose pointing along `+x` — that's what `ShipSprite.update()`
   assumes when it rotates the sprite to match the ship's physics angle
   (`angle = 0` faces right, increasing angle rotates clockwise). The current
   `viewBox` is `-24 -24 48 48` (a 48×48 box centered on the ship); if your art
   has different natural proportions, adjust the `SIZE` constant at the top of
   `shipSprite.ts` accordingly, but keep it centered and nose-right.
3. **If the new asset is a raster image (PNG) instead of inline SVG paths**,
   `ShipSprite` needs a small constructor change: create an `<img>` element
   instead of an `<svg>` + `innerHTML`, and drop the per-part color classes
   (a raster image can't be recolored by CSS the way inline SVG paths can) —
   position/rotation logic in `update()` stays identical either way.
4. **The collision hitbox is independent of the visual asset.** It's governed
   by `SHIP_RADIUS` in `packages/shared/src/constants.ts` (currently `20`),
   used by the server's physics (and the jet-stream anchor point below).
   If your new art is a noticeably different size, retune `SHIP_RADIUS` — and
   per the earlier design discussion, err slightly *smaller* than the visual
   extent (a generous-looking hitbox feels better than a strict one).
5. **The jet-stream flame is drawn separately, on canvas** (`drawJet` in
   `render.ts`), anchored at local `x = -SHIP_RADIUS` (i.e. "the back of the
   ship"). If your new art's engine/exhaust point isn't at exactly that
   position, nudge the offset in `drawJet` to match.

---

## Deploying the server to Kubernetes

### Why it must stay a single replica

`Room` (`packages/server/src/room.ts`) holds every ship/laser/asteroid **in
process memory** — there is no database, no Redis, no shared state layer.
Running more than one replica would give each pod its own independent,
unsynchronized game world; players connecting to different pods would never
see each other. This is a deliberate simplicity trade-off (see the earlier
architecture discussion), not a bug — for a single-shared-session easter egg,
one small pod is enough.

- `replicas: 1`, always.
- Use `strategy: { type: Recreate }` on the Deployment rather than the default
  rolling update — a rolling update briefly runs two pods at once, which would
  temporarily split players across two disconnected worlds. `Recreate` kills
  the old pod before starting the new one instead (a few seconds of downtime
  per deploy, which is fine here — clients have no reconnect logic today, so a
  restart just means everyone's browser needs a page reload to rejoin anyway).
- No persistent storage needed — game state is meant to be ephemeral; a pod
  restart wiping all ships/asteroids is expected and harmless.

### Running the server without a compile step

`packages/server`'s `start` script is `tsx src/index.ts` — it runs directly off
TypeScript source via `tsx`, the same tool used for local dev (just without
`--watch`). This is intentional: `@nani/shared` has no compiled `dist` (its
`package.json` `main`/`types` point straight at `src/index.ts`), so a plain
`node dist/index.js` build of the server would fail at runtime with
`ERR_UNKNOWN_FILE_EXTENSION` on the shared package's `.ts` import — there's no
loader in plain Node to handle it. Running everything through `tsx` (which is
now a regular `dependency`, not just a `devDependency`, of `packages/server`)
sidesteps that entirely and keeps dev/prod module resolution identical. Don't
"fix" this by wiring up a `tsc` build for `@nani/shared` unless you also solve
the dev-vs-prod dual-resolution problem that creates (Vite/tsx would need to
keep resolving to source in dev while Node resolves to compiled output in
prod) — not worth it at this scale.

### Example Dockerfile

```dockerfile
FROM node:22-slim
WORKDIR /app

# npm workspaces need the whole monorepo manifest set to resolve the
# @nani/shared symlink correctly — copy all package.json files before `npm ci`
# so Docker's layer cache is only invalidated when dependencies actually change.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci

COPY packages/shared packages/shared
COPY packages/server packages/server

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "run", "start", "--workspace", "packages/server"]
```

(This installs `web`'s dependencies too, even though its source isn't copied in —
simplest correct option for `npm ci` against the shared lockfile. Trimming that
is a possible later optimization, not required.)

### Example Kubernetes manifests

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spaceship-server
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels: { app: spaceship-server }
  template:
    metadata:
      labels: { app: spaceship-server }
    spec:
      containers:
        - name: server
          image: <your-registry>/spaceship-server:latest
          ports:
            - containerPort: 8080
          env:
            - name: PORT
              value: "8080"
          readinessProbe:
            tcpSocket: { port: 8080 }
            initialDelaySeconds: 2
          livenessProbe:
            tcpSocket: { port: 8080 }
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            requests: { cpu: "50m", memory: "64Mi" }
            limits: { cpu: "250m", memory: "128Mi" }
---
apiVersion: v1
kind: Service
metadata:
  name: spaceship-server
spec:
  selector: { app: spaceship-server }
  ports:
    - port: 80
      targetPort: 8080
```

Notes on the probes: the server exposes no HTTP health endpoint (it's a raw
`ws` server, not an HTTP API) — `tcpSocket` probes (just "can I open the port")
are the zero-effort option and are all that's used above. If you want real
HTTP-level health checking later, add a plain `GET /healthz` route to the
underlying HTTP server `ws` attaches to and switch the probes to `httpGet`.

### Ingress / TLS

If there's an ingress/reverse proxy in front (nginx-ingress, etc.):
- Make sure it's configured to proxy WebSocket upgrades (nginx-ingress does
  this by default for HTTP/1.1; other proxies may need an explicit
  `Upgrade`/`Connection` header pass-through config).
- Terminate TLS at the ingress and use `wss://` from the client — again, an
  `https://`-served Ember app cannot open a plain `ws://` connection (mixed
  content is blocked by the browser).
- The server currently accepts WebSocket connections from **any origin** —
  there's no `Origin` header check in `wss.on('connection', ...)`. Fine for a
  no-auth, no-sensitive-data easter egg; add an explicit check there if you
  ever want to restrict which sites can connect.

### Client configuration

Whichever embedding option you used above, make sure `mount()`'s `wsUrl` points
at the deployed server's public `wss://` address — the default
(`ws://${location.hostname}:8080`) only works when developing locally with
both dev servers on the same machine.
