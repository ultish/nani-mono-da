export interface ShipInput {
  thrust: boolean;
  brake: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

export const NEUTRAL_INPUT: ShipInput = {
  thrust: false,
  brake: false,
  turnLeft: false,
  turnRight: false,
};

export interface ShipState {
  id: string;
  type: 'ship';
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  landed: boolean;
  powerBar: number;
  hp: number;
}

export interface LaserState {
  id: string;
  type: 'laser';
  ownerId: string;
  x: number;
  y: number;
  angle: number;
}

export type AsteroidSize = 'large' | 'medium' | 'small';

export interface AsteroidState {
  id: string;
  type: 'asteroid';
  size: AsteroidSize;
  x: number;
  y: number;
  angle: number;
}

export type EntityState = ShipState | LaserState | AsteroidState;

// Metadata tagged onto Matter bodies (via body.plugin.nani) so the server's
// collisionStart handler can tell what collided with what, and whose it is.
export interface NaniShipPlugin {
  type: 'ship';
  id: string;
}

export interface NaniLaserPlugin {
  type: 'laser';
  laserId: string;
  ownerId: string;
}

export interface NaniAsteroidPlugin {
  type: 'asteroid';
  id: string;
  size: AsteroidSize;
}

export type NaniPlugin = NaniShipPlugin | NaniLaserPlugin | NaniAsteroidPlugin;

export interface SnapshotMessage {
  type: 'snapshot';
  t: number;
  entities: EntityState[];
}

export interface WelcomeMessage {
  type: 'welcome';
  id: string;
}

export type ServerMessage = SnapshotMessage | WelcomeMessage;

export interface InputMessage {
  type: 'input';
  input: ShipInput;
}

export interface LandMessage {
  type: 'land';
}

export interface TakeoffMessage {
  type: 'takeoff';
}

export interface FireMessage {
  type: 'fire';
}

export type ClientMessage = InputMessage | LandMessage | TakeoffMessage | FireMessage;
