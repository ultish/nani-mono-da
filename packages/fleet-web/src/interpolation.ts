import type { EntityState, SnapshotMessage } from '@nani/fleet-shared';

interface TimedSnapshot {
  t: number;
  entities: EntityState[];
  wave: number;
  score: number;
}

const DELAY_MS = 80;
const MAX_BUFFER = 30;

/**
 * Holds recent server snapshots and samples entities ~DELAY_MS behind real
 * time so remote ships/enemies move smoothly between ticks.
 */
export class InterpolationBuffer {
  private buf: TimedSnapshot[] = [];
  wave = 0;
  score = 0;

  push(msg: SnapshotMessage): void {
    this.buf.push({
      t: msg.t,
      entities: msg.entities,
      wave: msg.wave,
      score: msg.score,
    });
    if (this.buf.length > MAX_BUFFER) this.buf.shift();
    this.wave = msg.wave;
    this.score = msg.score;
  }

  sample(now: number): EntityState[] {
    if (this.buf.length === 0) return [];
    const target = now - DELAY_MS;

    // Find surrounding snapshots.
    let i = this.buf.length - 1;
    while (i >= 0 && this.buf[i].t > target) i -= 1;

    if (i < 0) return this.buf[0].entities;
    if (i >= this.buf.length - 1) return this.buf[this.buf.length - 1].entities;

    const a = this.buf[i];
    const b = this.buf[i + 1];
    const span = b.t - a.t;
    const u = span <= 0 ? 1 : (target - a.t) / span;

    this.wave = b.wave;
    this.score = b.score;

    return lerpEntities(a.entities, b.entities, u);
  }
}

function lerpEntities(a: EntityState[], b: EntityState[], u: number): EntityState[] {
  const byId = new Map(a.map((e) => [e.id, e]));
  const out: EntityState[] = [];

  for (const be of b) {
    const ae = byId.get(be.id);
    if (!ae || ae.type !== be.type) {
      out.push(be);
      continue;
    }
    out.push({
      ...be,
      x: ae.x + (be.x - ae.x) * u,
      y: ae.y + (be.y - ae.y) * u,
    } as EntityState);
  }
  return out;
}
