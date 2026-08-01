export interface FleetInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
}

export const NEUTRAL_INPUT: FleetInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
};

export type EnemyKind = 'basic' | 'tank' | 'diver' | 'boss';

export interface ShipState {
  id: string;
  type: 'ship';
  x: number;
  y: number;
  /** Index into SHIP_COLORS (stable for the session). */
  colorIndex: number;
  lives: number;
  /** True while dead and waiting to respawn. */
  dead: boolean;
  invuln: boolean;
  /** 0..MAX_POWER_LEVEL — weapon tier. */
  power: number;
  /** One-hit bubble; absorbs damage without losing a life. */
  shield: boolean;
}

export interface BulletState {
  id: string;
  type: 'bullet';
  /** 'player' flies up; 'enemy' flies down. */
  side: 'player' | 'enemy';
  ownerId: string;
  x: number;
  y: number;
  /** Visual tier for player bolts (0 if enemy). */
  power: number;
}

export interface EnemyState {
  id: string;
  type: 'enemy';
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

/** Green P = weapon; red H = life; blue S = one-hit shield. */
export type PowerUpKind = 'power' | 'life' | 'shield';

export interface PowerUpState {
  id: string;
  type: 'powerup';
  kind: PowerUpKind;
  x: number;
  y: number;
}

export type EntityState = ShipState | BulletState | EnemyState | PowerUpState;

export interface SnapshotMessage {
  type: 'snapshot';
  t: number;
  wave: number;
  score: number; // shared co-op score
  entities: EntityState[];
}

export interface WelcomeMessage {
  type: 'welcome';
  id: string;
  colorIndex: number;
}

export interface RejectedMessage {
  type: 'rejected';
  reason: 'full';
}

export type ServerMessage = SnapshotMessage | WelcomeMessage | RejectedMessage;

export interface InputMessage {
  type: 'input';
  input: FleetInput;
}

export type ClientMessage = InputMessage;
