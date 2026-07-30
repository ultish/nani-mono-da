import Matter from 'matter-js';
import { LASER_RADIUS, LASER_SPEED } from './constants.js';
import { setNani } from './plugin.js';

const { Bodies, Body } = Matter;

export function createLaser(
  laserId: string,
  ownerId: string,
  x: number,
  y: number,
  angle: number,
): Matter.Body {
  const body = Bodies.circle(x, y, LASER_RADIUS, {
    frictionAir: 0,
    friction: 0,
    frictionStatic: 0,
    label: `laser:${laserId}`,
  });
  // A frictionless circle never develops rotation on its own, so body.angle
  // would otherwise just stay at its default (0) forever regardless of
  // travel direction — it has to be set explicitly to match, purely so the
  // rendered ellipse lines up with where the laser is actually going.
  Body.setAngle(body, angle);
  Body.setVelocity(body, {
    x: Math.cos(angle) * LASER_SPEED,
    y: Math.sin(angle) * LASER_SPEED,
  });
  setNani(body, { type: 'laser', laserId, ownerId });
  return body;
}
