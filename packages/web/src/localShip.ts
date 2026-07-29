import Matter from 'matter-js';
import { createShip, stepShip, wrapPosition, powerBarFromSpeed } from '@nani/shared';
import type { ShipInput, ShipState } from '@nani/shared';

const { Engine, World, Body } = Matter;

// Position-only, gentle, and deadzoned — see reconcile() for why velocity
// is never blended in from the server. Kept tight: lasers spawn from the
// server's authoritative ship position, so if this drifts too far from
// what's rendered locally, your own shots visibly miss your own ship.
const RECONCILE_FACTOR = 0.06;
const RECONCILE_DEADZONE_PX = 8;

// Runs the same physics as the server, locally, for the player's own ship —
// input is applied instantly (no round-trip wait) and gently nudged toward
// the server's authoritative snapshot whenever one arrives.
export class LocalShip {
  private engine = Engine.create({ gravity: { x: 0, y: 0 } });
  private body: Matter.Body;
  private landed = false;

  constructor(x: number, y: number) {
    this.body = createShip('local', x, y);
    World.add(this.engine.world, this.body);
  }

  setLanded(landed: boolean): void {
    this.landed = landed;
  }

  step(input: ShipInput, dtMs: number): void {
    const dt = dtMs / 1000;
    stepShip(this.body, input, this.landed, dt);
    Engine.update(this.engine, dtMs);
    wrapPosition(this.body);
  }

  // The server only learns about a turn/thrust once its input message
  // arrives, so right after an input change its velocity is briefly stale
  // (still reflecting the old heading). Blending that in — as this used to
  // do — visibly fought fresh local input ("remembers the last direction").
  // Local velocity is already correct every frame (same physics, zero lag,
  // driven by the input actually happening right now), so only position
  // gets a soft, deadzoned correction here, purely for long-run numerical
  // drift, not for anything input-timing related.
  reconcile(server: ShipState): void {
    const pos = this.body.position;
    const dx = server.x - pos.x;
    const dy = server.y - pos.y;
    if (Math.hypot(dx, dy) <= RECONCILE_DEADZONE_PX) return;
    Body.setPosition(this.body, {
      x: pos.x + dx * RECONCILE_FACTOR,
      y: pos.y + dy * RECONCILE_FACTOR,
    });
  }

  get state(): { x: number; y: number; angle: number; powerBar: number } {
    return {
      x: this.body.position.x,
      y: this.body.position.y,
      angle: this.body.angle,
      powerBar: powerBarFromSpeed(this.body.velocity.x, this.body.velocity.y),
    };
  }
}
