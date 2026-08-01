# @nani/fleet-web — vertical co-op fleet easter egg

Old-school **vertical scroll shooter**, multiplayer co-op. Any number of players
(soft cap **12**) share **one screen**, one score, and the same enemy waves.

Named **fleet** (not “shmup”) in packages and deploy names. Sibling to the
arena egg (`packages/web` + `packages/server`); separate port/process so both
can live in the monorepo and in Kubernetes as two one-replica services.

## Run

```bash
# from repo root
npm install
npm run dev:fleet-server   # ws://localhost:8081
npm run dev:fleet-web      # http://localhost:5174
```

Open several tabs — each join gets a colored ship on the same playfield.

## Controls

| Key | Action |
|-----|--------|
| WASD / arrows | Move |
| Space / Z | Fire (hold) |

## Power-ups

| Pickup | Effect |
|--------|--------|
| Green **P** | Weapon tier +1 (0→4). Hit demotes one tier. |
| Red **H** | Restore **1 life** (up to 3). |
| Blue **S** | **Shield** — absorbs **one** hit (no life/power loss). |

Weapon power is **per ship**. Life/shield drops are rarer on fodder, better from
tanks. Bosses drop **3× P**, **1× H**, and **1× S**.

## Bosses

Every **3rd wave** (3, 6, 9…) is a **boss wave** — one capital ship, no fodder.

| Phase (HP) | Behavior |
|------------|----------|
| >66% | Aimed shots + slow 3-fan |
| 33–66% | Side guns + 5-fan |
| <33% | Fast aimed fire + dense fan + spiral burst |

HP scales with wave number and co-op player count. Kill reward: **5000** score +
the boss pickup bundle above.

## Design notes

- **N-player co-op**, not 2-only. Soft cap is `MAX_PLAYERS` in `@nani/fleet-shared`.
- Authoritative server, 60 Hz snapshots; client interpolates.
- Pure 2D canvas — no WebGL / Three.js / Matter.js.
- Shared co-op **score** + escalating **waves** (basics, tanks, divers, bosses).
- Friendly fire off. Respawn after hit until lives run out.

## Overlay behaviour

The canvas is a **full-viewport transparent overlay**:

- No solid background — host app stays visible underneath
- `pointer-events: none` — clicks/scroll go to the real UI
- Playfield is **letterboxed** and **size-capped** (~960×640 CSS px max) so a
  27″ monitor does not stretch it to full height
- Logical world is **1100×720** (wide enough for multi-ship co-op)
- HUD is a small glass chip, not a full-width bar
- Optional `ambient` (default `1`) controls star-dust opacity; set `0` for a
  completely clear sky

## Embed (host app)

Typical approach: copy these sources into the host UI (same as arena) and call:

```ts
import { mount } from './mount.js';

const handle = mount(document.body, {
  wsUrl: 'wss://fleet.yourdomain.com', // from env / config per environment
  ambient: 0.6,
  // maxDisplayWidth: 1100,
  // maxDisplayHeight: 720,
});
// handle.enter() from Konami / picker — only one egg active at a time
```

Server images are built in **GitLab CI** (no Dockerfile in this repo). Deploy
`@nani/fleet-server` as its own Kubernetes service with **`replicas: 1`**. See
the root [README](../../README.md).
