import {
  PLAYER_BULLET_SPEED,
  FIRE_COOLDOWN_MS,
  FIRE_COOLDOWN_MIN_MS,
  MAX_POWER_LEVEL,
} from './constants.js';

export interface ShotSpec {
  /** Offset from ship center. */
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  damage: number;
}

/** Cooldown between volleys for a given power tier. */
export function fireCooldownMs(power: number): number {
  const p = clampPower(power);
  return Math.max(FIRE_COOLDOWN_MIN_MS, FIRE_COOLDOWN_MS - p * 16);
}

export function clampPower(power: number): number {
  return Math.max(0, Math.min(MAX_POWER_LEVEL, power | 0));
}

/**
 * Shot pattern for one trigger pull.
 * Higher tiers = more streams + more damage.
 */
export function shotsForPower(power: number): ShotSpec[] {
  const p = clampPower(power);
  const s = PLAYER_BULLET_SPEED;

  switch (p) {
    case 0:
      // Single peashooter
      return [{ ox: 0, oy: 0, vx: 0, vy: -s, damage: 1 }];
    case 1:
      // Dual parallel
      return [
        { ox: -9, oy: 2, vx: 0, vy: -s, damage: 1 },
        { ox: 9, oy: 2, vx: 0, vy: -s, damage: 1 },
      ];
    case 2:
      // Triple
      return [
        { ox: 0, oy: -2, vx: 0, vy: -s, damage: 1 },
        { ox: -14, oy: 4, vx: -40, vy: -s, damage: 1 },
        { ox: 14, oy: 4, vx: 40, vy: -s, damage: 1 },
      ];
    case 3:
      // Heavy triple (2 dmg)
      return [
        { ox: 0, oy: -2, vx: 0, vy: -s * 1.05, damage: 2 },
        { ox: -16, oy: 4, vx: -55, vy: -s, damage: 2 },
        { ox: 16, oy: 4, vx: 55, vy: -s, damage: 2 },
      ];
    case 4:
    default:
      // Five-way heavy
      return [
        { ox: 0, oy: -4, vx: 0, vy: -s * 1.1, damage: 2 },
        { ox: -12, oy: 0, vx: -35, vy: -s * 1.05, damage: 2 },
        { ox: 12, oy: 0, vx: 35, vy: -s * 1.05, damage: 2 },
        { ox: -22, oy: 6, vx: -95, vy: -s * 0.95, damage: 1 },
        { ox: 22, oy: 6, vx: 95, vy: -s * 0.95, damage: 1 },
      ];
  }
}
