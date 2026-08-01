# nani-mono-da — multiplayer spaceship easter eggs

Two independent easter eggs live in this monorepo. Each has its own shared
types, WebSocket server, and web client. They do **not** share a game protocol
or process.

| Egg | Packages | Genre | Local ports |
|-----|----------|-------|-------------|
| **Arena** (original) | `packages/{shared,server,web}` | Free-roam ships, lasers, asteroids, land/takeoff | WS `8080`, web `5173` |
| **Fleet** | `packages/fleet-{shared,server,web}` | Vertical co-op scroller — waves, power-ups, bosses, N ships on one screen | WS `8081`, web `5174` |

**Fleet** is the vertical co-op shooter (sometimes called a “shmup” in genre
slang — we use **fleet** in package and deploy names instead). Details and
overlay notes: [`packages/fleet-web/README.md`](packages/fleet-web/README.md).

Activation (Konami code, hidden button, etc.) is always up to the **host app** —
neither package auto-enters in production-shaped embeds.

---

## Local development

```bash
npm install

# Arena
npm run dev:server   # ws://localhost:8080
npm run dev:web      # http://localhost:5173

# Fleet
npm run dev:fleet-server   # ws://localhost:8081
npm run dev:fleet-web      # http://localhost:5174
```

Open the web URL in more than one tab to exercise multiplayer.

---

## Package layout

### Arena

- **`@nani/shared`** — Matter.js body factories, constants, WebSocket types
  (raw `.ts`; consumed via `tsx` / Vite — no compiled `dist`).
- **`@nani/server`** — Node + `ws`, one in-memory `Room`, 60 Hz snapshots.
- **`@nani/web`** — Vite + vanilla TS. `mount()` returns `{ enter(), destroy() }`.

### Fleet

- **`@nani/fleet-shared`** — world constants, weapon tiers, message types.
- **`@nani/fleet-server`** — Node + `ws`, co-op room, waves / bosses / pickups.
- **`@nani/fleet-web`** — Vite + canvas overlay client; same `mount()` / `enter()` shape.

Both servers: **one global room** per process, no lobby. Soft player cap on Fleet
only (`MAX_PLAYERS` in `@nani/fleet-shared`).

---

## Host UI (client)

The intended production path here is: **copy client sources into the real UI
app** (or vendor a built bundle) and wire activation there — not a published
npm library. The `packages/*/src/main.ts` files are **dev harnesses** only.

Suggested host layout:

```
your-ui/
  easter-eggs/
    arena/          # from packages/web (+ any shared bits you need)
    fleet/          # from packages/fleet-web (+ fleet-shared types if needed)
    activate.ts     # Konami / picker
```

Each `mount()` takes an explicit `wsUrl`:

```ts
mountArena(document.body, { wsUrl: 'wss://spaceship.example.com' });
mountFleet(document.body, { wsUrl: 'wss://fleet.example.com' });
```

### Two games, one Konami

Prefer **only one egg mounted at a time** (destroy the other before starting a
new one — two WebSockets + two game loops is wasteful and input fights).

Options:

1. **Konami → small picker** (“Arena” / “Fleet”) — clearest for coworkers.
2. **Two codes** — classic Konami = arena, alternate sequence = fleet.
3. **Ship only one game** in prod if you want zero choice UI.

Use `wss://` when the host app is HTTPS (browsers block mixed-content `ws://`).

Both overlays are meant to sit **on top of** the real app: transparent canvas,
`pointer-events: none`. Fleet also letterboxes a size-capped playfield so large
monitors don’t get a full-height stretched column.

---

## Deploying the servers (Kubernetes)

Images are built in **GitLab CI** — this repo does **not** ship Dockerfiles.
Point your pipeline at the server package you want (`packages/server` or
`packages/fleet-server`) and the monorepo root so npm workspaces resolve
`@nani/shared` / `@nani/fleet-shared`.

### Runtime model

Each server’s `start` script is `tsx src/index.ts` (TypeScript via `tsx`, no
separate compile of shared). Both honor:

```bash
PORT=8080   # listen port (default 8080 arena / 8081 fleet if unset)
```

In-cluster, run **both** images with `PORT=8080` if you like; hostnames differ
at the ingress, not the container port.

### One replica per game (required)

Game state is **in-process memory only** (no Redis/DB). For each egg:

- **`replicas: 1` always** — two pods ⇒ two disconnected worlds.
- Prefer **`strategy: Recreate`** on the Deployment so a rollout doesn’t briefly
  split players across old + new pods.
- Ephemeral state: pod restart wipes the room (expected for an easter egg).
- No PVC required.

Deploy **two** services (two Helm releases, or one chart / two value sets):

| Release | Image (example) | Public URL (example) |
|---------|-----------------|----------------------|
| Arena | `…/nani-spaceship-server` | `wss://spaceship.example.com` |
| Fleet | `…/nani-fleet-server` | `wss://fleet.example.com` |

### Helm / Deployment checklist

Per game:

- Deployment: `replicas: 1`, `Recreate`, container port = `PORT`
- Service: ClusterIP → that port
- Ingress: WebSocket upgrade support, TLS terminated at ingress (`wss://`)
- Probes: TCP on the listen port is enough today (raw `ws`, no `/healthz`)
- Resources: tiny (e.g. ~50–250 m CPU, 64–128 Mi RAM) is plenty

Example shape (image name and chart are yours — no Dockerfile in this repo):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nani-fleet-server
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels: { app: nani-fleet-server }
  template:
    metadata:
      labels: { app: nani-fleet-server }
    spec:
      containers:
        - name: server
          image: registry.example.com/nani-fleet-server:TAG
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
```

Same pattern for the arena server with its own name/image.

### Ingress / TLS

- Proxy WebSocket upgrades (nginx-ingress usually fine on HTTP/1.1).
- Terminate TLS at ingress; clients must use **`wss://`**.
- Servers accept any origin today (fine for a no-auth egg). Restrict later if needed.

### Client configuration in the host app

Point each egg’s `mount({ wsUrl })` at that game’s public ingress URL for the
environment (staging/prod). Defaults like `ws://hostname:8080` are **local dev
only**.

---

## Arena notes (original egg)

### Controls

WASD move/thrust style, Q/E land/takeoff, Space fire (see package sources for
exact binding details).

### Embedding options (if you don’t copy sources)

Historically documented as:

- **Option A** — build `packages/web`, drop the bundle under `public/`, script tag.
- **Option B** — library-mode Vite build and import `mount()` (not set up by default).

Copying sources into the host app (as above) is also fine and matches current practice.

### Ship SVG (arena only)

Arena ships use DOM SVG sprites (`packages/web/src/shipSprite.ts` + CSS). Fleet
draws on canvas only. Collision radius is independent of art (`SHIP_RADIUS` in
the relevant shared package).

---

## Fleet notes (summary)

- Co-op, soft cap **12** players, shared score, shared waves.
- Pickups: **P** power, **H** life, **S** one-hit shield.
- Boss every **3rd** wave; HP scales with wave + player count.
- Transparent overlay + size-capped letterbox for large monitors.

Full client/embed docs: [`packages/fleet-web/README.md`](packages/fleet-web/README.md).
