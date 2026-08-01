import { randomUUID } from 'node:crypto';
import {
  NEUTRAL_INPUT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAX_PLAYERS,
  SHIP_RADIUS,
  SHIP_SPEED,
  SHIP_MIN_X,
  SHIP_MAX_X,
  SHIP_MIN_Y,
  SHIP_MAX_Y,
  MAX_LIVES,
  RESPAWN_MS,
  INVULN_MS,
  BULLET_RADIUS,
  ENEMY_BULLET_SPEED,
  MAX_PLAYER_BULLETS_PER_SHIP,
  ENEMY_RADIUS,
  ENEMY_BASIC_HP,
  ENEMY_TANK_HP,
  ENEMY_BASIC_SCORE,
  ENEMY_TANK_SCORE,
  ENEMY_DIVER_SCORE,
  BOSS_WAVE_INTERVAL,
  BOSS_RADIUS,
  BOSS_BASE_HP,
  BOSS_SCORE,
  BOSS_PARK_Y,
  BOSS_ENTER_SPEED,
  BOSS_PATROL_SPEED,
  BOSS_WAVE_CLEAR_DELAY_MS,
  TICK_MS,
  WAVE_CLEAR_DELAY_MS,
  SHIP_COLORS,
  POWERUP_RADIUS,
  POWERUP_FALL_SPEED,
  POWERUP_DROP_CHANCE,
  LIFE_DROP_CHANCE,
  SHIELD_DROP_CHANCE,
  SHIELD_BREAK_INVULN_MS,
  fireCooldownMs,
  shotsForPower,
  clampPower,
} from '@nani/fleet-shared';
import type {
  FleetInput,
  EntityState,
  SnapshotMessage,
  EnemyKind,
  PowerUpKind,
} from '@nani/fleet-shared';

interface Player {
  id: string;
  colorIndex: number;
  x: number;
  y: number;
  input: FleetInput;
  lives: number;
  dead: boolean;
  respawnAt: number | null;
  invulnUntil: number;
  lastFireAt: number;
  power: number;
  shield: boolean;
}

interface Bullet {
  id: string;
  side: 'player' | 'enemy';
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  power: number;
}

interface Enemy {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  t: number;
  lastShotAt: number;
  /** Boss only: multi-shot pattern cadence. */
  lastPatternAt: number;
  /** Boss only: true after it has reached BOSS_PARK_Y. */
  entered: boolean;
}

interface PowerUp {
  id: string;
  kind: PowerUpKind;
  x: number;
  y: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function circleHit(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Single global co-op room. Any number of players (up to MAX_PLAYERS) share
 * one vertical playfield, one score, and the same enemy waves.
 */
export class Room {
  private players = new Map<string, Player>();
  private bullets = new Map<string, Bullet>();
  private enemies = new Map<string, Enemy>();
  private powerups = new Map<string, PowerUp>();
  private score = 0;
  private wave = 0;
  private nextWaveAt: number | null = null;
  private colorCursor = 0;
  private now = Date.now();

  /** Returns player id + color, or null if the room is full. */
  join(): { id: string; colorIndex: number } | null {
    if (this.players.size >= MAX_PLAYERS) return null;

    const id = randomUUID();
    const n = this.players.size;
    const slots = Math.max(n + 1, 1);
    const x = WORLD_WIDTH * ((n + 0.5) / slots);
    const y = WORLD_HEIGHT - 60;
    const colorIndex = this.colorCursor % SHIP_COLORS.length;
    this.colorCursor += 1;

    this.players.set(id, {
      id,
      colorIndex,
      x: clamp(x, SHIP_MIN_X, SHIP_MAX_X),
      y,
      input: { ...NEUTRAL_INPUT },
      lives: MAX_LIVES,
      dead: false,
      respawnAt: null,
      invulnUntil: this.now + INVULN_MS,
      lastFireAt: 0,
      power: 0,
      shield: false,
    });

    if (this.wave === 0 && this.enemies.size === 0) {
      this.startNextWave();
    }

    return { id, colorIndex };
  }

  leave(id: string): void {
    this.players.delete(id);
    for (const [bid, b] of this.bullets) {
      if (b.side === 'player' && b.ownerId === id) this.bullets.delete(bid);
    }
  }

  setInput(id: string, input: FleetInput): void {
    const p = this.players.get(id);
    if (!p || p.dead) return;
    p.input = input;
  }

  tick(): SnapshotMessage {
    this.now = Date.now();
    const dt = TICK_MS / 1000;

    this.stepPlayers(dt);
    this.stepBullets(dt);
    this.stepEnemies(dt);
    this.stepPowerUps(dt);
    this.resolveCollisions();
    this.maybeAdvanceWave();

    return {
      type: 'snapshot',
      t: this.now,
      wave: this.wave,
      score: this.score,
      entities: this.serialize(),
    };
  }

  private stepPlayers(dt: number): void {
    for (const p of this.players.values()) {
      if (p.dead) {
        if (p.respawnAt != null && this.now >= p.respawnAt && p.lives > 0) {
          p.dead = false;
          p.respawnAt = null;
          p.x = WORLD_WIDTH / 2;
          p.y = WORLD_HEIGHT - 60;
          p.invulnUntil = this.now + INVULN_MS;
          p.input = { ...NEUTRAL_INPUT };
          // Keep power on respawn (only demoted on the hit itself).
        }
        continue;
      }

      let dx = 0;
      let dy = 0;
      if (p.input.left) dx -= 1;
      if (p.input.right) dx += 1;
      if (p.input.up) dy -= 1;
      if (p.input.down) dy += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx = (dx / len) * SHIP_SPEED * dt;
        dy = (dy / len) * SHIP_SPEED * dt;
        p.x = clamp(p.x + dx, SHIP_MIN_X, SHIP_MAX_X);
        p.y = clamp(p.y + dy, SHIP_MIN_Y, SHIP_MAX_Y);
      }

      if (p.input.fire) this.tryFirePlayer(p);
    }
  }

  private tryFirePlayer(p: Player): void {
    if (this.now - p.lastFireAt < fireCooldownMs(p.power)) return;

    let owned = 0;
    for (const b of this.bullets.values()) {
      if (b.side === 'player' && b.ownerId === p.id) owned += 1;
    }
    if (owned >= MAX_PLAYER_BULLETS_PER_SHIP) return;

    const shots = shotsForPower(p.power);
    if (owned + shots.length > MAX_PLAYER_BULLETS_PER_SHIP) return;

    p.lastFireAt = this.now;
    const baseY = p.y - SHIP_RADIUS - 4;
    for (const s of shots) {
      const id = randomUUID();
      this.bullets.set(id, {
        id,
        side: 'player',
        ownerId: p.id,
        x: p.x + s.ox,
        y: baseY + s.oy,
        vx: s.vx,
        vy: s.vy,
        damage: s.damage,
        power: p.power,
      });
    }
  }

  private stepBullets(dt: number): void {
    for (const [id, b] of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.y > WORLD_HEIGHT + 30 || b.x < -40 || b.x > WORLD_WIDTH + 40) {
        this.bullets.delete(id);
      }
    }
  }

  private stepPowerUps(dt: number): void {
    for (const [id, pu] of this.powerups) {
      pu.y += POWERUP_FALL_SPEED * dt;
      if (pu.y > WORLD_HEIGHT + 30) this.powerups.delete(id);
    }
  }

  private stepEnemies(dt: number): void {
    for (const [id, e] of this.enemies) {
      e.t += dt;

      switch (e.kind) {
        case 'basic':
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.x < e.radius || e.x > WORLD_WIDTH - e.radius) {
            e.vx *= -1;
            e.x = clamp(e.x, e.radius, WORLD_WIDTH - e.radius);
          }
          break;
        case 'tank':
          e.y += e.vy * dt;
          e.x += Math.sin(e.t * 1.4) * 40 * dt;
          if (this.now - e.lastShotAt > 1400 && e.y > 40 && e.y < WORLD_HEIGHT * 0.55) {
            e.lastShotAt = this.now;
            this.spawnEnemyBullet(e.x, e.y + e.radius);
          }
          break;
        case 'diver':
          e.vy = Math.min(e.vy + 80 * dt, 280);
          {
            const target = this.nearestLivingShip(e.x, e.y);
            if (target) {
              const pull = clamp(target.x - e.x, -120, 120);
              e.vx = pull * 0.8;
            }
          }
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          break;
        case 'boss':
          this.stepBoss(e, dt);
          break;
      }

      // Bosses never despawn off the bottom; fodder does.
      if (e.kind !== 'boss' && e.y > WORLD_HEIGHT + 40) this.enemies.delete(id);
    }
  }

  private stepBoss(e: Enemy, dt: number): void {
    // Enter from top, then patrol.
    if (!e.entered) {
      e.y += BOSS_ENTER_SPEED * dt;
      if (e.y >= BOSS_PARK_Y) {
        e.y = BOSS_PARK_Y;
        e.entered = true;
        e.vx = BOSS_PATROL_SPEED * (Math.random() < 0.5 ? -1 : 1);
      }
      return;
    }

    const hpRatio = e.hp / e.maxHp;
    const speedMul = hpRatio > 0.66 ? 1 : hpRatio > 0.33 ? 1.25 : 1.55;
    e.x += e.vx * speedMul * dt;
    // Slight vertical bob so it doesn't feel bolted to a rail.
    e.y = BOSS_PARK_Y + Math.sin(e.t * 1.6) * 10;

    if (e.x < e.radius + 20 || e.x > WORLD_WIDTH - e.radius - 20) {
      e.vx *= -1;
      e.x = clamp(e.x, e.radius + 20, WORLD_WIDTH - e.radius - 20);
    }

    // Attack patterns by phase.
    if (hpRatio > 0.66) {
      // Phase 1: aimed singles + slow 3-fan
      if (this.now - e.lastShotAt > 700) {
        e.lastShotAt = this.now;
        this.spawnAimedBullet(e.x, e.y + e.radius * 0.6, ENEMY_BULLET_SPEED * 1.05);
      }
      if (this.now - e.lastPatternAt > 2200) {
        e.lastPatternAt = this.now;
        this.spawnFan(e.x, e.y + e.radius * 0.5, 3, 0.35, ENEMY_BULLET_SPEED);
      }
    } else if (hpRatio > 0.33) {
      // Phase 2: wider fans + side guns
      if (this.now - e.lastShotAt > 900) {
        e.lastShotAt = this.now;
        this.spawnEnemyBullet(e.x - e.radius * 0.7, e.y + 10, -30, ENEMY_BULLET_SPEED * 1.1);
        this.spawnEnemyBullet(e.x + e.radius * 0.7, e.y + 10, 30, ENEMY_BULLET_SPEED * 1.1);
        this.spawnAimedBullet(e.x, e.y + e.radius * 0.5, ENEMY_BULLET_SPEED * 1.15);
      }
      if (this.now - e.lastPatternAt > 1600) {
        e.lastPatternAt = this.now;
        this.spawnFan(e.x, e.y + e.radius * 0.4, 5, 0.55, ENEMY_BULLET_SPEED * 0.95);
      }
    } else {
      // Phase 3: angry — dense fan + spiral-ish ring bursts
      if (this.now - e.lastShotAt > 450) {
        e.lastShotAt = this.now;
        this.spawnAimedBullet(e.x, e.y + e.radius * 0.5, ENEMY_BULLET_SPEED * 1.25);
        this.spawnEnemyBullet(e.x - e.radius * 0.85, e.y + 8, -80, ENEMY_BULLET_SPEED * 1.1);
        this.spawnEnemyBullet(e.x + e.radius * 0.85, e.y + 8, 80, ENEMY_BULLET_SPEED * 1.1);
      }
      if (this.now - e.lastPatternAt > 1100) {
        e.lastPatternAt = this.now;
        this.spawnFan(e.x, e.y + e.radius * 0.3, 7, 0.75, ENEMY_BULLET_SPEED);
        // Mini spiral: rotating offset
        const base = e.t * 2.5;
        for (let i = 0; i < 6; i++) {
          const a = base + (i / 6) * Math.PI * 2;
          const speed = ENEMY_BULLET_SPEED * 0.85;
          this.spawnEnemyBullet(
            e.x + Math.cos(a) * 20,
            e.y + Math.sin(a) * 12 + 20,
            Math.cos(a) * speed,
            Math.abs(Math.sin(a)) * speed * 0.5 + speed * 0.55,
          );
        }
      }
    }
  }

  private nearestLivingShip(x: number, y: number): Player | null {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private spawnEnemyBullet(x: number, y: number, vx = 0, vy = ENEMY_BULLET_SPEED): void {
    const id = randomUUID();
    this.bullets.set(id, {
      id,
      side: 'enemy',
      ownerId: 'enemy',
      x,
      y,
      vx,
      vy,
      damage: 1,
      power: 0,
    });
  }

  private spawnAimedBullet(x: number, y: number, speed: number): void {
    const target = this.nearestLivingShip(x, y);
    if (!target) {
      this.spawnEnemyBullet(x, y, 0, speed);
      return;
    }
    const dx = target.x - x;
    const dy = target.y - y;
    const len = Math.hypot(dx, dy) || 1;
    this.spawnEnemyBullet(x, y, (dx / len) * speed, (dy / len) * speed);
  }

  /** Fan of downward-ish shots. `spread` is half-width in radians from straight down. */
  private spawnFan(x: number, y: number, count: number, spread: number, speed: number): void {
    if (count <= 1) {
      this.spawnEnemyBullet(x, y, 0, speed);
      return;
    }
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const fromDown = (u - 0.5) * spread * 2;
      const vx = Math.sin(fromDown) * speed;
      const vy = Math.cos(fromDown) * speed;
      this.spawnEnemyBullet(x, y, vx, vy);
    }
  }

  private spawnPickup(kind: PowerUpKind, x: number, y: number): void {
    const id = randomUUID();
    this.powerups.set(id, { id, kind, x, y });
  }

  private maybeDropPowerUp(kind: EnemyKind, x: number, y: number): void {
    if (kind === 'boss') {
      // Guaranteed multi-drop so co-op can scramble for upgrades + heal + bubble.
      for (let i = 0; i < 3; i++) {
        this.spawnPickup('power', x + (i - 1) * 36, y + 10);
      }
      this.spawnPickup('life', x - 20, y + 40);
      this.spawnPickup('shield', x + 20, y + 40);
      return;
    }
    if (Math.random() <= POWERUP_DROP_CHANCE[kind]) {
      this.spawnPickup('power', x, y);
    }
    if (Math.random() <= LIFE_DROP_CHANCE[kind]) {
      this.spawnPickup('life', x + 14, y - 8);
    }
    if (Math.random() <= SHIELD_DROP_CHANCE[kind]) {
      this.spawnPickup('shield', x - 14, y - 8);
    }
  }

  private resolveCollisions(): void {
    // Player bullets → enemies
    for (const [bid, b] of this.bullets) {
      if (b.side !== 'player') continue;
      for (const [eid, e] of this.enemies) {
        if (!circleHit(b.x, b.y, BULLET_RADIUS, e.x, e.y, e.radius * 0.9)) continue;
        this.bullets.delete(bid);
        e.hp -= b.damage;
        if (e.hp <= 0) {
          this.score += scoreFor(e.kind);
          this.maybeDropPowerUp(e.kind, e.x, e.y);
          this.enemies.delete(eid);
        }
        break;
      }
    }

    // Enemy bullets → players
    for (const [bid, b] of this.bullets) {
      if (b.side !== 'enemy') continue;
      for (const p of this.players.values()) {
        if (p.dead || this.now < p.invulnUntil) continue;
        if (!circleHit(b.x, b.y, BULLET_RADIUS, p.x, p.y, SHIP_RADIUS)) continue;
        this.bullets.delete(bid);
        this.hurtPlayer(p);
        break;
      }
    }

    // Enemies body → players
    for (const e of this.enemies.values()) {
      for (const p of this.players.values()) {
        if (p.dead || this.now < p.invulnUntil) continue;
        if (!circleHit(e.x, e.y, e.radius * 0.8, p.x, p.y, SHIP_RADIUS)) continue;
        this.hurtPlayer(p);
      }
    }

    // Pickups → players (first touch wins — co-op scramble)
    for (const [pid, pu] of this.powerups) {
      for (const p of this.players.values()) {
        if (p.dead) continue;
        if (!circleHit(pu.x, pu.y, POWERUP_RADIUS, p.x, p.y, SHIP_RADIUS)) continue;
        if (pu.kind === 'power') {
          p.power = clampPower(p.power + 1);
        } else if (pu.kind === 'life') {
          p.lives = Math.min(MAX_LIVES, p.lives + 1);
        } else {
          // Shield: one bubble (no stack — picking up while shielded refreshes).
          p.shield = true;
        }
        this.powerups.delete(pid);
        break;
      }
    }
  }

  private hurtPlayer(p: Player): void {
    // Shield absorbs the hit — no life loss, no weapon demotion.
    if (p.shield) {
      p.shield = false;
      p.invulnUntil = this.now + SHIELD_BREAK_INVULN_MS;
      return;
    }

    p.lives -= 1;
    // Classic arcade demotion — lose one weapon tier on hit.
    p.power = clampPower(p.power - 1);
    if (p.lives <= 0) {
      p.lives = 0;
      p.dead = true;
      p.respawnAt = null;
      p.input = { ...NEUTRAL_INPUT };
    } else {
      p.dead = true;
      p.respawnAt = this.now + RESPAWN_MS;
      p.input = { ...NEUTRAL_INPUT };
    }
  }

  private maybeAdvanceWave(): void {
    if (this.players.size === 0) return;

    if (this.enemies.size === 0) {
      if (this.nextWaveAt == null) {
        const nextIsBoss = (this.wave + 1) % BOSS_WAVE_INTERVAL === 0;
        const delay = nextIsBoss ? BOSS_WAVE_CLEAR_DELAY_MS : WAVE_CLEAR_DELAY_MS;
        this.nextWaveAt = this.now + delay;
      } else if (this.now >= this.nextWaveAt) {
        this.startNextWave();
      }
    }
  }

  private startNextWave(): void {
    this.nextWaveAt = null;
    this.wave += 1;
    this.spawnWave(this.wave);
  }

  private spawnWave(wave: number): void {
    // Boss waves: one capital ship, HP scales with wave + co-op count.
    if (wave % BOSS_WAVE_INTERVAL === 0) {
      this.spawnBoss(wave);
      return;
    }

    const playerScale = 1 + Math.max(0, this.players.size - 1) * 0.25;
    const rows = Math.min(2 + Math.floor((wave - 1) / 2), 5);
    const cols = Math.min(8 + Math.floor(wave / 2), 14);
    const colGap = 56;
    const baseVy = 28 + Math.min(wave * 3, 40);

    const gridW = cols * colGap;
    const startX = (WORLD_WIDTH - gridW) / 2 + colGap / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > Math.min(0.55 * playerScale, 0.95) && wave > 1) continue;
        this.addEnemy('basic', startX + c * colGap, 48 + r * 40, {
          vx: (r % 2 === 0 ? 1 : -1) * (36 + wave * 2),
          vy: baseVy * 0.35,
          hp: ENEMY_BASIC_HP,
        });
      }
    }

    if (wave >= 2) {
      const tanks = Math.min(1 + Math.floor(wave / 3), 5);
      for (let i = 0; i < tanks; i++) {
        this.addEnemy(
          'tank',
          80 + (i * (WORLD_WIDTH - 160)) / Math.max(tanks - 1, 1),
          -20 - i * 30,
          { vx: 0, vy: 22 + wave, hp: ENEMY_TANK_HP },
        );
      }
    }

    if (wave >= 3) {
      const divers = Math.min(2 + Math.floor(wave / 2), 10);
      for (let i = 0; i < divers; i++) {
        this.addEnemy('diver', 50 + Math.random() * (WORLD_WIDTH - 100), -40 - i * 50, {
          vx: 0,
          vy: 40,
          hp: ENEMY_BASIC_HP,
        });
      }
    }
  }

  private spawnBoss(wave: number): void {
    const coOp = Math.max(1, this.players.size);
    // Wave 3 → ~base, later bosses and more players add bulk.
    const hp = Math.round(
      BOSS_BASE_HP * (1 + (wave / BOSS_WAVE_INTERVAL - 1) * 0.35) * (1 + (coOp - 1) * 0.4),
    );
    this.addEnemy('boss', WORLD_WIDTH / 2, -BOSS_RADIUS - 20, {
      vx: 0,
      vy: 0,
      hp,
      radius: BOSS_RADIUS,
    });
  }

  private addEnemy(
    kind: EnemyKind,
    x: number,
    y: number,
    opts: { vx: number; vy: number; hp: number; radius?: number },
  ): void {
    const id = randomUUID();
    const radius = opts.radius ?? ENEMY_RADIUS;
    this.enemies.set(id, {
      id,
      kind,
      x,
      y,
      vx: opts.vx,
      vy: opts.vy,
      hp: opts.hp,
      maxHp: opts.hp,
      radius,
      t: Math.random() * Math.PI * 2,
      lastShotAt: this.now,
      lastPatternAt: this.now,
      entered: kind !== 'boss',
    });
  }

  private serialize(): EntityState[] {
    const out: EntityState[] = [];

    for (const p of this.players.values()) {
      out.push({
        id: p.id,
        type: 'ship',
        x: p.x,
        y: p.y,
        colorIndex: p.colorIndex,
        lives: p.lives,
        dead: p.dead,
        invuln: !p.dead && this.now < p.invulnUntil,
        power: p.power,
        shield: p.shield,
      });
    }

    for (const b of this.bullets.values()) {
      out.push({
        id: b.id,
        type: 'bullet',
        side: b.side,
        ownerId: b.ownerId,
        x: b.x,
        y: b.y,
        power: b.power,
      });
    }

    for (const e of this.enemies.values()) {
      out.push({
        id: e.id,
        type: 'enemy',
        kind: e.kind,
        x: e.x,
        y: e.y,
        hp: e.hp,
        maxHp: e.maxHp,
      });
    }

    for (const pu of this.powerups.values()) {
      out.push({
        id: pu.id,
        type: 'powerup',
        kind: pu.kind,
        x: pu.x,
        y: pu.y,
      });
    }

    return out;
  }
}

function scoreFor(kind: EnemyKind): number {
  switch (kind) {
    case 'basic':
      return ENEMY_BASIC_SCORE;
    case 'tank':
      return ENEMY_TANK_SCORE;
    case 'diver':
      return ENEMY_DIVER_SCORE;
    case 'boss':
      return BOSS_SCORE;
  }
}
