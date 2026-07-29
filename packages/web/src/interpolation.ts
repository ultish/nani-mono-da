import { WORLD_WIDTH, WORLD_HEIGHT } from '@nani/shared';
import type { EntityState, SnapshotMessage } from '@nani/shared';

const INTERP_DELAY_MS = 100;
const BUFFER_WINDOW_MS = 1000;

interface Buffered {
  t: number;
  entities: Map<string, EntityState>;
}

// Renders remote ships slightly in the past, interpolated between two real
// received snapshots, so 20Hz network updates still look smooth at 60fps —
// no extrapolation/guessing, so there's nothing to visibly correct later.
export class InterpolationBuffer {
  private buffer: Buffered[] = [];

  push(msg: SnapshotMessage): void {
    const entities = new Map(msg.entities.map((e) => [e.id, e]));
    this.buffer.push({ t: msg.t, entities });
    const cutoff = Date.now() - BUFFER_WINDOW_MS;
    while (this.buffer.length > 2 && this.buffer[0].t < cutoff) this.buffer.shift();
  }

  sample(now: number): EntityState[] {
    if (this.buffer.length === 0) return [];
    if (this.buffer.length === 1) return [...this.buffer[0].entities.values()];

    const renderTime = now - INTERP_DELAY_MS;
    let older = this.buffer[0];
    let newer = this.buffer[this.buffer.length - 1];
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].t <= renderTime && this.buffer[i + 1].t >= renderTime) {
        older = this.buffer[i];
        newer = this.buffer[i + 1];
        break;
      }
    }

    const span = newer.t - older.t;
    const alpha = span > 0 ? Math.max(0, Math.min(1, (renderTime - older.t) / span)) : 1;

    const result: EntityState[] = [];
    for (const [id, newState] of newer.entities) {
      const oldState = older.entities.get(id) ?? newState;
      result.push({
        ...newState,
        x: lerpWrapped(oldState.x, newState.x, alpha, WORLD_WIDTH),
        y: lerpWrapped(oldState.y, newState.y, alpha, WORLD_HEIGHT),
        angle: lerpAngle(oldState.angle, newState.angle, alpha),
      });
    }
    return result;
  }
}

// Ships screen-wrap, so a naive lerp would draw a long slide across the
// entire world when a ship crosses an edge. Snap instead when the jump
// looks like a wrap rather than real motion.
function lerpWrapped(a: number, b: number, alpha: number, worldSize: number): number {
  const diff = b - a;
  if (Math.abs(diff) > worldSize / 2) return b;
  return a + diff * alpha;
}

function lerpAngle(a: number, b: number, alpha: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * alpha;
}
