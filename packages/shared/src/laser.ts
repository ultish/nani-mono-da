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
  Body.setVelocity(body, {
    x: Math.cos(angle) * LASER_SPEED,
    y: Math.sin(angle) * LASER_SPEED,
  });
  setNani(body, { type: 'laser', laserId, ownerId });
  return body;
}
