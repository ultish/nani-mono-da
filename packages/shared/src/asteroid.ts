import Matter from 'matter-js';
import { ASTEROID_RADII, ASTEROID_NEXT_SIZE } from './constants.js';
import { setNani } from './plugin.js';
import type { AsteroidSize } from './types.js';

const { Bodies } = Matter;

export function createAsteroid(id: string, size: AsteroidSize, x: number, y: number): Matter.Body {
  const body = Bodies.circle(x, y, ASTEROID_RADII[size], {
    frictionAir: 0,
    friction: 0,
    frictionStatic: 0,
    // Large asteroids are ~5x a ship's mass — with Matter's collision
    // restitution taken as the max of the two bodies, a high value here
    // sent the (much lighter) ship flying on any bump. Kept modest instead.
    restitution: 0.4,
    label: `asteroid:${id}`,
  });
  setNani(body, { type: 'asteroid', id, size });
  return body;
}

export function nextAsteroidSize(size: AsteroidSize): AsteroidSize | null {
  return ASTEROID_NEXT_SIZE[size];
}
