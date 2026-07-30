import Matter from 'matter-js';
import { createShip, stepShip, wrapPosition, powerBarFromSpeed, NEUTRAL_INPUT } from '@nani/shared';
import type { ShipInput, ShipState } from '@nani/shared';

const { Engine, World, Body } = Matter;

// Position: gentle + deadzoned for ordinary latency drift, but a big enough
// gap can only mean the server applied something the local world never saw
// (e.g. bouncing off an asteroid — the local prediction world only ever
// contains this one ship, so it can't predict collisions with anything
// else). In that case, trust the server outright rather than slowly
// dragging the local ship toward it, which reads as an unexplained drift.
const RECONCILE_FACTOR = 0.06;
const RECONCILE_DEADZONE_PX = 8;
const RECONCILE_SNAP_PX = 60;

// Angle is set directly from input every tick (Body.setAngle, no momentum),
// same as velocity used to be — so nudging it toward the server's value
// WHILE actively turning would fight fresh input the exact same way the old
// velocity-blending did. Only correct it when the player isn't turning right
// now; a gap big enough to be implausible as pure input lag still snaps
// immediately regardless (e.g. after a reconnect).
const RECONCILE_ANGLE_FACTOR = 0.1;
const RECONCILE_ANGLE_DEADZONE_RAD = 0.05;
const RECONCILE_ANGLE_SNAP_RAD = Math.PI / 2;

function angleDelta(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// Runs the same physics as the server, locally, for the player's own ship —
// input is applied instantly (no round-trip wait) and gently nudged toward
// the server's authoritative snapshot whenever one arrives.
export class LocalShip {
  private engine = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 10, velocityIterations: 8 });
  private body: Matter.Body;
  private landed = false;
  private lastInput: ShipInput = { ...NEUTRAL_INPUT };

  constructor(x: number, y: number) {
    this.body = createShip('local', x, y);
    World.add(this.engine.world, this.body);
  }

  setLanded(landed: boolean): void {
    this.landed = landed;
  }

  step(input: ShipInput, dtMs: number): void {
    this.lastInput = input;
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
  // driven by the input actually happening right now), so it's never
  // blended in here; only position and (conditionally) angle are corrected.
  reconcile(server: ShipState): void {
    const pos = this.body.position;
    const dx = server.x - pos.x;
    const dy = server.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist > RECONCILE_SNAP_PX) {
      Body.setPosition(this.body, { x: server.x, y: server.y });
      Body.setVelocity(this.body, { x: server.vx, y: server.vy });
    } else if (dist > RECONCILE_DEADZONE_PX) {
      Body.setPosition(this.body, {
        x: pos.x + dx * RECONCILE_FACTOR,
        y: pos.y + dy * RECONCILE_FACTOR,
      });
    }

    const angleGap = angleDelta(this.body.angle, server.angle);
    const turning = this.lastInput.turnLeft || this.lastInput.turnRight;
    if (Math.abs(angleGap) > RECONCILE_ANGLE_SNAP_RAD) {
      Body.setAngle(this.body, server.angle);
    } else if (!turning && Math.abs(angleGap) > RECONCILE_ANGLE_DEADZONE_RAD) {
      Body.setAngle(this.body, this.body.angle + angleGap * RECONCILE_ANGLE_FACTOR);
    }
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
