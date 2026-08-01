/**
 * Logical playfield in world pixels (1 unit ≈ 1 CSS px at default display scale).
 * Sized for desktop co-op on large monitors — wide enough for several ships,
 * not a phone-portrait 480×720 that blows up to full monitor height.
 */
export const WORLD_WIDTH = 1100;
export const WORLD_HEIGHT = 720;

/**
 * Client never draws the playfield larger than this (CSS px). On a 27″ 1440p
 * panel that keeps the egg a centered window instead of a full-height tower.
 * Smaller viewports still shrink-to-fit.
 */
export const MAX_DISPLAY_WIDTH = 960;
export const MAX_DISPLAY_HEIGHT = 640;

/** Soft cap — beyond this, join is rejected. All players share one screen. */
export const MAX_PLAYERS = 12;

export const SHIP_RADIUS = 14;
export const SHIP_SPEED = 280; // px/sec
/** Ships may fly anywhere below this y (0 = top). Full playfield with a small top margin. */
export const SHIP_MIN_Y = 90;
export const SHIP_MAX_Y = WORLD_HEIGHT - 28;
export const SHIP_MIN_X = 28;
export const SHIP_MAX_X = WORLD_WIDTH - 28;

export const MAX_LIVES = 3;
export const RESPAWN_MS = 1500;
export const INVULN_MS = 2000;

export const BULLET_RADIUS = 3.5;
export const PLAYER_BULLET_SPEED = 520;
export const ENEMY_BULLET_SPEED = 200;
/** Base fire interval; higher power levels shave this down. */
export const FIRE_COOLDOWN_MS = 160;
export const FIRE_COOLDOWN_MIN_MS = 90;
/** Hard ceiling on live player bolts (scales with multi-shot). */
export const MAX_PLAYER_BULLETS_PER_SHIP = 14;

/**
 * Weapon power 0..MAX_POWER_LEVEL.
 * 0 single · 1 dual · 2 triple · 3 heavy triple · 4 five-way heavy
 */
export const MAX_POWER_LEVEL = 4;
export const POWERUP_RADIUS = 12;
export const POWERUP_FALL_SPEED = 70;
/** Chance an enemy drops a weapon power-up on death. */
export const POWERUP_DROP_CHANCE = {
  basic: 0.12,
  diver: 0.2,
  tank: 0.4,
  /** Boss always multi-drops in room logic; chance unused. */
  boss: 1,
} as const;

/** Chance an enemy drops a life (1-up) on death. Stacks as a separate roll. */
export const LIFE_DROP_CHANCE = {
  basic: 0.02,
  diver: 0.04,
  tank: 0.1,
  /** Boss always drops at least one life in room logic. */
  boss: 1,
} as const;

/** Chance an enemy drops a shield (one-hit bubble). Separate roll. */
export const SHIELD_DROP_CHANCE = {
  basic: 0.04,
  diver: 0.07,
  tank: 0.15,
  /** Boss always drops a shield in room logic. */
  boss: 1,
} as const;

/** Brief invulnerability after a shield breaks. */
export const SHIELD_BREAK_INVULN_MS = 900;

export const ENEMY_RADIUS = 16;
export const ENEMY_BASIC_HP = 1;
export const ENEMY_TANK_HP = 3;
export const ENEMY_BASIC_SCORE = 100;
export const ENEMY_TANK_SCORE = 300;
export const ENEMY_DIVER_SCORE = 150;

/** Boss every N waves (3, 6, 9…). Solo boss wave — no fodder. */
export const BOSS_WAVE_INTERVAL = 3;
export const BOSS_RADIUS = 52;
/** Base HP; scaled by wave index and co-op player count on spawn. */
export const BOSS_BASE_HP = 48;
export const BOSS_SCORE = 5000;
/** Vertical park line once the boss has entered. */
export const BOSS_PARK_Y = 130;
export const BOSS_ENTER_SPEED = 70;
export const BOSS_PATROL_SPEED = 90;

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

/** Pause between waves after the field is clear. */
export const WAVE_CLEAR_DELAY_MS = 1800;
/** Longer beat before/after a boss for drama. */
export const BOSS_WAVE_CLEAR_DELAY_MS = 2800;

/** Distinct ship tints for co-op (cycles if more players than colors). */
export const SHIP_COLORS = [
  '#5ec8ff',
  '#ff6b8a',
  '#7dffb3',
  '#ffd166',
  '#c77dff',
  '#ff9f43',
  '#54a0ff',
  '#ee5a6f',
  '#00d2d3',
  '#f368e0',
  '#48dbfb',
  '#ff9ff3',
] as const;
