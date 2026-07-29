import Matter from 'matter-js';
import {
  SHIP_RADIUS,
  THRUST_FORCE,
  IDLE_DRAG,
  BRAKE_DRAG,
  TURN_RATE,
  MAX_POWER_BAR,
  SPEED_PER_POWER_BAR,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from './constants.js';
import type { ShipInput } from './types.js';
import { setNani } from './plugin.js';

const { Bodies, Body } = Matter;

export function createShip(id: string, x: number, y: number): Matter.Body {
  const body = Bodies.circle(x, y, SHIP_RADIUS, {
    frictionAir: IDLE_DRAG,
    friction: 0,
    frictionStatic: 0,
    restitution: 0.4,
    label: `ship:${id}`,
  });
  setNani(body, { type: 'ship', id });
  return body;
}

// Applies one tick's worth of input to a ship body. Angle is set directly
// (not torque-driven) so turning never carries momentum — only linear
// velocity does, which is what gives the classic Asteroids drift feel.
export function stepShip(body: Matter.Body, input: ShipInput, landed: boolean, dt: number): void {
  if (landed) {
    body.frictionAir = IDLE_DRAG;
    Body.setVelocity(body, { x: 0, y: 0 });
    return;
  }

  body.frictionAir = input.brake ? BRAKE_DRAG : IDLE_DRAG;

  if (input.turnLeft) Body.setAngle(body, body.angle - TURN_RATE * dt);
  if (input.turnRight) Body.setAngle(body, body.angle + TURN_RATE * dt);

  if (input.thrust) {
    Body.applyForce(body, body.position, {
      x: Math.cos(body.angle) * THRUST_FORCE * body.mass,
      y: Math.sin(body.angle) * THRUST_FORCE * body.mass,
    });
  }
}

// Classic Asteroids screen-wrap instead of walls/camera scrolling.
export function wrapPosition(body: Matter.Body): void {
  let { x, y } = body.position;
  let wrapped = false;
  if (x < 0) { x += WORLD_WIDTH; wrapped = true; }
  else if (x > WORLD_WIDTH) { x -= WORLD_WIDTH; wrapped = true; }
  if (y < 0) { y += WORLD_HEIGHT; wrapped = true; }
  else if (y > WORLD_HEIGHT) { y -= WORLD_HEIGHT; wrapped = true; }
  if (wrapped) Body.setPosition(body, { x, y });
}

export function powerBarFromSpeed(vx: number, vy: number): number {
  const speed = Math.sqrt(vx * vx + vy * vy);
  return Math.max(0, Math.min(MAX_POWER_BAR, Math.round(speed / SPEED_PER_POWER_BAR)));
}

export { SHIP_RADIUS };
