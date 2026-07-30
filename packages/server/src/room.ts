import Matter from 'matter-js';
import { randomUUID } from 'node:crypto';
import {
  createShip,
  createLaser,
  createAsteroid,
  nextAsteroidSize,
  stepShip,
  wrapPosition,
  powerBarFromSpeed,
  getNani,
  NEUTRAL_INPUT,
  TICK_MS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SHIP_RADIUS,
  LASER_RADIUS,
  LASER_LIFETIME_MS,
  FIRE_COOLDOWN_MS,
  MAX_HP,
  ASTEROID_SPEED_MIN,
  ASTEROID_SPEED_MAX,
  INITIAL_ASTEROID_COUNT,
  ASTEROID_RESPAWN_DELAY_MS,
} from '@nani/shared';
import type { ShipInput, EntityState, SnapshotMessage, AsteroidSize } from '@nani/shared';

const { Engine, World, Events, Body } = Matter;

interface Player {
  id: string;
  body: Matter.Body;
  input: ShipInput;
  landed: boolean;
  hp: number;
  lastFireAt: number;
}

interface Laser {
  id: string;
  ownerId: string;
  body: Matter.Body;
  spawnedAt: number;
}

interface Asteroid {
  id: string;
  size: AsteroidSize;
  body: Matter.Body;
}

function randomAsteroidVelocity(): { vx: number; vy: number } {
  const angle = Math.random() * Math.PI * 2;
  const speed = ASTEROID_SPEED_MIN + Math.random() * (ASTEROID_SPEED_MAX - ASTEROID_SPEED_MIN);
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

// Single global room — everyone who opens the page joins the same session.
export class Room {
  private engine = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 10, velocityIterations: 8 });
  private players = new Map<string, Player>();
  private lasers = new Map<string, Laser>();
  private asteroids = new Map<string, Asteroid>();
  private nextWaveAt: number | null = null;

  constructor() {
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) this.handleCollision(pair.bodyA, pair.bodyB);
    });
    this.spawnWave();
  }

  join(): string {
    const id = randomUUID();
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    const body = createShip(id, x, y);
    World.add(this.engine.world, body);
    this.players.set(id, {
      id,
      body,
      input: { ...NEUTRAL_INPUT },
      landed: false,
      hp: MAX_HP,
      lastFireAt: 0,
    });
    return id;
  }

  leave(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    World.remove(this.engine.world, player.body);
    this.players.delete(id);
  }

  setInput(id: string, input: ShipInput): void {
    const player = this.players.get(id);
    if (!player || player.landed) return;
    player.input = input;
  }

  land(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    player.landed = true;
    player.input = { ...NEUTRAL_INPUT };
  }

  takeoff(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    player.landed = false;
  }

  // Position + angle are client-reported (see FireMessage) rather than read
  // from the server's own stored ship state, which can differ slightly from
  // what's rendered locally at any instant — using the server's copy made
  // shots visibly spawn off the shooter's own rendered ship.
  fire(id: string, x0: number, y0: number, angle: number): void {
    const player = this.players.get(id);
    if (!player || player.landed) return;
    const now = Date.now();
    if (now - player.lastFireAt < FIRE_COOLDOWN_MS) return;
    player.lastFireAt = now;

    const laserId = randomUUID();
    const spawnDist = SHIP_RADIUS + LASER_RADIUS + 2;
    const x = x0 + Math.cos(angle) * spawnDist;
    const y = y0 + Math.sin(angle) * spawnDist;
    const body = createLaser(laserId, id, x, y, angle);
    World.add(this.engine.world, body);
    this.lasers.set(laserId, { id: laserId, ownerId: id, body, spawnedAt: now });
  }

  private handleCollision(a: Matter.Body, b: Matter.Body): void {
    const naniA = getNani(a);
    const naniB = getNani(b);
    const laserBody = naniA?.type === 'laser' ? a : naniB?.type === 'laser' ? b : null;
    if (!laserBody) return;
    const laserData = getNani(laserBody);
    if (laserData?.type !== 'laser') return;
    const otherBody = laserBody === a ? b : a;
    const otherNani = getNani(otherBody);

    if (otherNani?.type === 'ship') {
      if (laserData.ownerId === otherNani.id) return; // can't hit yourself
      this.removeLaser(laserData.laserId);
      const player = this.players.get(otherNani.id);
      if (!player) return;
      player.hp -= 1;
      if (player.hp <= 0) this.respawnPlayer(player);
    } else if (otherNani?.type === 'asteroid') {
      this.removeLaser(laserData.laserId);
      this.breakAsteroid(otherNani.id);
    }
  }

  private removeLaser(laserId: string): void {
    const laser = this.lasers.get(laserId);
    if (!laser) return;
    World.remove(this.engine.world, laser.body);
    this.lasers.delete(laserId);
  }

  private respawnPlayer(player: Player): void {
    player.hp = MAX_HP;
    Body.setPosition(player.body, {
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
    });
    Body.setVelocity(player.body, { x: 0, y: 0 });
  }

  private spawnAsteroid(size: AsteroidSize, x: number, y: number, vx: number, vy: number): void {
    const id = randomUUID();
    const body = createAsteroid(id, size, x, y);
    Body.setVelocity(body, { x: vx, y: vy });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
    World.add(this.engine.world, body);
    this.asteroids.set(id, { id, size, body });
  }

  private spawnWave(): void {
    for (let i = 0; i < INITIAL_ASTEROID_COUNT; i++) {
      const x = Math.random() * WORLD_WIDTH;
      const y = Math.random() * WORLD_HEIGHT;
      const { vx, vy } = randomAsteroidVelocity();
      this.spawnAsteroid('large', x, y, vx, vy);
    }
  }

  // Splits into 2 smaller asteroids one size down, or destroys outright if
  // already smallest — the classic Asteroids break-apart.
  private breakAsteroid(id: string): void {
    const asteroid = this.asteroids.get(id);
    if (!asteroid) return;
    const { x, y } = asteroid.body.position;
    const next = nextAsteroidSize(asteroid.size);
    World.remove(this.engine.world, asteroid.body);
    this.asteroids.delete(id);

    if (!next) return;
    for (let i = 0; i < 2; i++) {
      const { vx, vy } = randomAsteroidVelocity();
      this.spawnAsteroid(next, x, y, vx, vy);
    }
  }

  tick(dtMs: number = TICK_MS): SnapshotMessage {
    const dt = dtMs / 1000;
    for (const player of this.players.values()) {
      stepShip(player.body, player.input, player.landed, dt);
    }
    Engine.update(this.engine, dtMs);
    for (const player of this.players.values()) {
      wrapPosition(player.body);
    }
    for (const asteroid of this.asteroids.values()) {
      wrapPosition(asteroid.body);
    }

    const now = Date.now();
    for (const laser of [...this.lasers.values()]) {
      if (now - laser.spawnedAt > LASER_LIFETIME_MS) this.removeLaser(laser.id);
    }

    if (this.asteroids.size === 0) {
      if (this.nextWaveAt === null) this.nextWaveAt = now + ASTEROID_RESPAWN_DELAY_MS;
      else if (now >= this.nextWaveAt) {
        this.spawnWave();
        this.nextWaveAt = null;
      }
    } else {
      this.nextWaveAt = null;
    }

    const entities: EntityState[] = [];
    for (const player of this.players.values()) {
      entities.push({
        id: player.id,
        type: 'ship',
        x: player.body.position.x,
        y: player.body.position.y,
        angle: player.body.angle,
        vx: player.body.velocity.x,
        vy: player.body.velocity.y,
        landed: player.landed,
        powerBar: powerBarFromSpeed(player.body.velocity.x, player.body.velocity.y),
        hp: player.hp,
      });
    }
    for (const laser of this.lasers.values()) {
      entities.push({
        id: laser.id,
        type: 'laser',
        ownerId: laser.ownerId,
        x: laser.body.position.x,
        y: laser.body.position.y,
        angle: laser.body.angle,
      });
    }
    for (const asteroid of this.asteroids.values()) {
      entities.push({
        id: asteroid.id,
        type: 'asteroid',
        size: asteroid.size,
        x: asteroid.body.position.x,
        y: asteroid.body.position.y,
        angle: asteroid.body.angle,
      });
    }

    return { type: 'snapshot', t: now, entities };
  }
}
