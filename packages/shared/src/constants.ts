export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;

export const SHIP_RADIUS = 20;

export const THRUST_FORCE = 0.0009;
export const IDLE_DRAG = 0.015;
export const BRAKE_DRAG = 0.12;
export const TURN_RATE = Math.PI * 1.2; // radians/sec

export const MAX_POWER_BAR = 5;
export const SPEED_PER_POWER_BAR = 2.2; // px/tick-ish speed per bar unit, tuned against THRUST_FORCE

export const MAX_HP = 3;

export const LASER_RADIUS = 4;
export const LASER_SPEED = 15;
export const LASER_LIFETIME_MS = 1000;
export const FIRE_COOLDOWN_MS = 300;

// Matches Matter.js's recommended max step (~16.67ms) so collision
// resolution stays stable once asteroids/lasers are added.
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const ASTEROID_RADII = { large: 44, medium: 26, small: 15 } as const;
export const ASTEROID_NEXT_SIZE = { large: 'medium', medium: 'small', small: null } as const;
export const ASTEROID_SPEED_MIN = 1;
export const ASTEROID_SPEED_MAX = 3;
export const INITIAL_ASTEROID_COUNT = 6;
export const ASTEROID_RESPAWN_DELAY_MS = 5000;
