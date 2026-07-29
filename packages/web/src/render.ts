import { ASTEROID_RADII, MAX_HP, SHIP_RADIUS } from '@nani/shared';
import type { AsteroidSize } from '@nani/shared';

// The ship hull itself is a DOM <svg> sprite (see shipSprite.ts) so its parts
// can be styled per-class in CSS; this only draws the jet stream behind it,
// which suits canvas better (cheap gradient, no per-part styling needed).
export function drawJet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  powerBar: number,
  landed: boolean,
): void {
  if (powerBar <= 0 || landed) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const len = 10 + powerBar * 8;
  const grad = ctx.createLinearGradient(-SHIP_RADIUS, 0, -SHIP_RADIUS - len, 0);
  grad.addColorStop(0, 'rgba(255,180,60,0.9)');
  grad.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-SHIP_RADIUS, -6);
  ctx.lineTo(-SHIP_RADIUS - len, 0);
  ctx.lineTo(-SHIP_RADIUS, 6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function drawLaser(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#7cfc9a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Fixed radius-jitter pattern (not random per-frame, so the shape doesn't
// shimmer) — one rock silhouette reused for every asteroid, just scaled by size.
const ROCK_JITTER = [1, 0.78, 1.08, 0.72, 1.12, 0.8, 1.15, 0.75, 1.05, 0.85];

export function drawAsteroid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: AsteroidSize,
): void {
  const radius = ASTEROID_RADII[size];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.strokeStyle = '#9a9a9a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const n = ROCK_JITTER.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * ROCK_JITTER[i];
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

// hp gauge drawn above the ship, upright regardless of ship heading.
export function drawHearts(ctx: CanvasRenderingContext2D, hp: number, x: number, y: number): void {
  const spacing = 14;
  const startX = x - ((MAX_HP - 1) * spacing) / 2;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < MAX_HP; i++) {
    ctx.fillStyle = i < hp ? '#ff5d7a' : 'rgba(255,255,255,0.25)';
    ctx.fillText(i < hp ? '♥' : '♡', startX + i * spacing, y);
  }
  ctx.textAlign = 'left';
}
