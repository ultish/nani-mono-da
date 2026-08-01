import {
  SHIP_RADIUS,
  ENEMY_RADIUS,
  BULLET_RADIUS,
  SHIP_COLORS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  POWERUP_RADIUS,
  MAX_POWER_LEVEL,
  BOSS_RADIUS,
} from '@nani/fleet-shared';
import type { EnemyKind } from '@nani/fleet-shared';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Very light parallax dust — low alpha so the host UI stays readable. */
export function drawAmbientStars(ctx: CanvasRenderingContext2D, t: number): void {
  // Density tracks the wider desktop playfield without becoming a fog.
  for (let i = 0; i < 70; i++) {
    const x = ((i * 97 + 13) % WORLD_WIDTH) + 0.5;
    const base = (i * 53 + 7) % WORLD_HEIGHT;
    const speed = 12 + (i % 5) * 6;
    const y = (base + t * speed) % WORLD_HEIGHT;
    const a = 0.1 + (i % 4) * 0.035;
    const s = i % 9 === 0 ? 1.6 : 1;
    ctx.fillStyle = `rgba(200, 220, 255, ${a})`;
    ctx.fillRect(x, y, s, s);
  }
}

export function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  opts: { own: boolean; invuln: boolean; dead: boolean; shield: boolean; t: number },
): void {
  if (opts.dead) return;

  const color = SHIP_COLORS[colorIndex % SHIP_COLORS.length];
  const blink = opts.invuln && Math.floor(opts.t * 12) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.3;

  ctx.save();
  ctx.translate(x, y);

  // One-hit shield bubble
  if (opts.shield) {
    const pulse = 0.55 + 0.45 * Math.sin(opts.t * 6);
    const sg = ctx.createRadialGradient(0, 0, SHIP_RADIUS * 0.6, 0, 0, SHIP_RADIUS * 2.1);
    sg.addColorStop(0, `rgba(120, 220, 255, ${0.08 + pulse * 0.06})`);
    sg.addColorStop(0.7, `rgba(80, 190, 255, ${0.12 + pulse * 0.08})`);
    sg.addColorStop(1, 'rgba(80, 190, 255, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, SHIP_RADIUS * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(160, 230, 255, ${0.55 + pulse * 0.35})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, SHIP_RADIUS * 1.7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft under-glow so the ship reads on light and dark host UIs.
  const glow = ctx.createRadialGradient(0, 2, 2, 0, 2, SHIP_RADIUS * 2.4);
  glow.addColorStop(0, rgba(color, 0.45));
  glow.addColorStop(0.55, rgba(color, 0.12));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 2, SHIP_RADIUS * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Engine plume (idle flicker).
  const pulse = 0.65 + 0.35 * Math.sin(opts.t * 18 + colorIndex);
  const plume = ctx.createLinearGradient(0, SHIP_RADIUS * 0.2, 0, SHIP_RADIUS * (1.6 + pulse));
  plume.addColorStop(0, 'rgba(255, 220, 140, 0.85)');
  plume.addColorStop(0.4, 'rgba(255, 120, 40, 0.55)');
  plume.addColorStop(1, 'rgba(255, 80, 20, 0)');
  ctx.fillStyle = plume;
  ctx.beginPath();
  ctx.moveTo(-4, SHIP_RADIUS * 0.35);
  ctx.lineTo(0, SHIP_RADIUS * (1.35 + pulse * 0.5));
  ctx.lineTo(4, SHIP_RADIUS * 0.35);
  ctx.closePath();
  ctx.fill();

  // Wings
  const wingGrad = ctx.createLinearGradient(-SHIP_RADIUS, 0, SHIP_RADIUS, 0);
  wingGrad.addColorStop(0, rgba(color, 0.55));
  wingGrad.addColorStop(0.5, color);
  wingGrad.addColorStop(1, rgba(color, 0.55));

  ctx.fillStyle = wingGrad;
  ctx.strokeStyle = opts.own ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = opts.own ? 1.4 : 1;
  ctx.lineJoin = 'round';

  // Left wing
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-SHIP_RADIUS * 1.15, SHIP_RADIUS * 0.85);
  ctx.lineTo(-4, SHIP_RADIUS * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.lineTo(SHIP_RADIUS * 1.15, SHIP_RADIUS * 0.85);
  ctx.lineTo(4, SHIP_RADIUS * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hull body with vertical shading.
  const hull = ctx.createLinearGradient(-SHIP_RADIUS * 0.5, 0, SHIP_RADIUS * 0.5, 0);
  const { r, g, b } = hexToRgb(color);
  hull.addColorStop(0, `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`);
  hull.addColorStop(0.45, color);
  hull.addColorStop(1, `rgb(${Math.max(0, r - 50)},${Math.max(0, g - 50)},${Math.max(0, b - 50)})`);

  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(0, -SHIP_RADIUS * 1.05);
  ctx.lineTo(SHIP_RADIUS * 0.55, SHIP_RADIUS * 0.55);
  ctx.quadraticCurveTo(0, SHIP_RADIUS * 0.2, -SHIP_RADIUS * 0.55, SHIP_RADIUS * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Canopy
  const canopy = ctx.createLinearGradient(0, -6, 0, 2);
  canopy.addColorStop(0, 'rgba(220, 245, 255, 0.95)');
  canopy.addColorStop(1, 'rgba(80, 160, 220, 0.75)');
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.ellipse(0, -2, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Own-ship ring so co-op partners can tell who is who at a glance.
  if (opts.own) {
    ctx.strokeStyle = rgba(color, 0.5);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, SHIP_RADIUS * 1.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: EnemyKind,
  hp: number,
  maxHp: number,
  t: number,
): void {
  ctx.save();
  ctx.translate(x, y);

  if (kind === 'boss') {
    drawBoss(ctx, hp, maxHp, t);
    ctx.restore();
    return;
  }

  if (kind === 'basic') {
    const bob = Math.sin(t * 4 + x * 0.05) * 0.5;
    ctx.translate(0, bob);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, ENEMY_RADIUS * 1.8);
    glow.addColorStop(0, 'rgba(255, 90, 80, 0.35)');
    glow.addColorStop(1, 'rgba(255, 90, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_RADIUS * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Saucer body
    const body = ctx.createLinearGradient(0, -ENEMY_RADIUS, 0, ENEMY_RADIUS);
    body.addColorStop(0, '#ff8a7a');
    body.addColorStop(0.5, '#e74c3c');
    body.addColorStop(1, '#a32018');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 2, ENEMY_RADIUS * 1.05, ENEMY_RADIUS * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dome
    const dome = ctx.createRadialGradient(-2, -4, 1, 0, -2, ENEMY_RADIUS * 0.7);
    dome.addColorStop(0, 'rgba(200, 255, 255, 0.95)');
    dome.addColorStop(0.6, 'rgba(100, 200, 230, 0.85)');
    dome.addColorStop(1, 'rgba(40, 100, 140, 0.9)');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.ellipse(0, -2, ENEMY_RADIUS * 0.55, ENEMY_RADIUS * 0.55, 0, Math.PI, 0);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,200,200,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 2, ENEMY_RADIUS * 1.05, ENEMY_RADIUS * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'tank') {
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, ENEMY_RADIUS * 2);
    glow.addColorStop(0, 'rgba(180, 100, 255, 0.35)');
    glow.addColorStop(1, 'rgba(180, 100, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_RADIUS * 2, 0, Math.PI * 2);
    ctx.fill();

    // Hex hull
    const body = ctx.createLinearGradient(-ENEMY_RADIUS, 0, ENEMY_RADIUS, 0);
    body.addColorStop(0, '#6c3483');
    body.addColorStop(0.5, '#bb6bd9');
    body.addColorStop(1, '#4a235a');
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(230, 200, 255, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * ENEMY_RADIUS;
      const py = Math.sin(a) * ENEMY_RADIUS * 0.85;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Core
    ctx.fillStyle = 'rgba(255, 240, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < hp; i++) {
      ctx.fillStyle = i === 0 ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(-6 + i * 6, -ENEMY_RADIUS - 5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'diver') {
    // diver — sleek arrow
    const spin = Math.sin(t * 10) * 0.08;
    ctx.rotate(spin);

    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, ENEMY_RADIUS * 1.9);
    glow.addColorStop(0, 'rgba(255, 180, 40, 0.4)');
    glow.addColorStop(1, 'rgba(255, 180, 40, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_RADIUS * 1.9, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(0, -ENEMY_RADIUS, 0, ENEMY_RADIUS);
    body.addColorStop(0, '#ffe08a');
    body.addColorStop(0.4, '#f39c12');
    body.addColorStop(1, '#b36b00');
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.7)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, ENEMY_RADIUS * 1.1);
    ctx.lineTo(ENEMY_RADIUS * 0.75, -ENEMY_RADIUS * 0.55);
    ctx.lineTo(0, -ENEMY_RADIUS * 0.15);
    ctx.lineTo(-ENEMY_RADIUS * 0.75, -ENEMY_RADIUS * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Afterburner
    const trail = ctx.createLinearGradient(0, -ENEMY_RADIUS * 0.5, 0, -ENEMY_RADIUS * 1.6);
    trail.addColorStop(0, 'rgba(255, 100, 40, 0.8)');
    trail.addColorStop(1, 'rgba(255, 100, 40, 0)');
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.moveTo(-3, -ENEMY_RADIUS * 0.4);
    ctx.lineTo(0, -ENEMY_RADIUS * 1.5);
    ctx.lineTo(3, -ENEMY_RADIUS * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawBoss(ctx: CanvasRenderingContext2D, hp: number, maxHp: number, t: number): void {
  const R = BOSS_RADIUS;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  const hpRatio = maxHp > 0 ? hp / maxHp : 0;

  // Outer glow — angrier as HP drops
  const glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 2.2);
  const anger = 1 - hpRatio;
  glow.addColorStop(0, `rgba(255, ${Math.floor(80 + 100 * hpRatio)}, 60, ${0.25 + anger * 0.2})`);
  glow.addColorStop(1, 'rgba(255, 40, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, R * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Main capital hull
  const hull = ctx.createLinearGradient(-R, 0, R, 0);
  hull.addColorStop(0, '#3a1020');
  hull.addColorStop(0.35, '#c0392b');
  hull.addColorStop(0.5, '#ff6b5a');
  hull.addColorStop(0.65, '#c0392b');
  hull.addColorStop(1, '#3a1020');
  ctx.fillStyle = hull;
  ctx.strokeStyle = 'rgba(255, 220, 200, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, R * 0.95);
  ctx.lineTo(R * 1.15, -R * 0.15);
  ctx.lineTo(R * 0.55, -R * 0.75);
  ctx.lineTo(0, -R * 0.45);
  ctx.lineTo(-R * 0.55, -R * 0.75);
  ctx.lineTo(-R * 1.15, -R * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Wing cannons
  ctx.fillStyle = '#1a0a10';
  ctx.fillRect(-R * 1.05, -R * 0.1, R * 0.35, R * 0.35);
  ctx.fillRect(R * 0.7, -R * 0.1, R * 0.35, R * 0.35);
  ctx.fillStyle = `rgba(255, 180, 80, ${0.5 + pulse * 0.4})`;
  ctx.beginPath();
  ctx.arc(-R * 0.88, R * 0.2, 4, 0, Math.PI * 2);
  ctx.arc(R * 0.88, R * 0.2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Core eye
  const core = ctx.createRadialGradient(-3, -8, 2, 0, -4, R * 0.35);
  core.addColorStop(0, '#fff6d0');
  core.addColorStop(0.4, hpRatio > 0.33 ? '#ffcc44' : '#ff4422');
  core.addColorStop(1, '#601010');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(0, -6, R * 0.28, R * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // HP bar (world space above boss)
  const barW = R * 2.2;
  const barH = 7;
  const barY = -R - 18;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(-barW / 2, barY, barW, barH);
  ctx.fillStyle = hpRatio > 0.5 ? '#3dff9a' : hpRatio > 0.25 ? '#ffd166' : '#ff6b8a';
  ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-barW / 2, barY, barW, barH);

  ctx.fillStyle = 'rgba(255,220,200,0.9)';
  ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('BOSS', 0, barY - 3);
}

export function drawBullet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: 'player' | 'enemy',
  power = 0,
): void {
  ctx.save();
  if (side === 'player') {
    // Higher tiers: thicker / hotter bolts.
    const thick = BULLET_RADIUS * (0.85 + power * 0.18);
    const len = 7 + power * 1.2;
    const hot = power >= 3;
    const grad = ctx.createLinearGradient(x, y + len, x, y - len * 1.2);
    if (hot) {
      grad.addColorStop(0, 'rgba(255, 200, 80, 0)');
      grad.addColorStop(0.35, 'rgba(255, 220, 100, 0.95)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.65, 'rgba(120, 255, 200, 0.95)');
      grad.addColorStop(1, 'rgba(80, 255, 180, 0)');
    } else {
      grad.addColorStop(0, 'rgba(120, 255, 180, 0)');
      grad.addColorStop(0.35, 'rgba(120, 255, 180, 0.9)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.65, 'rgba(120, 255, 180, 0.9)');
      grad.addColorStop(1, 'rgba(120, 255, 180, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, thick, len, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, BULLET_RADIUS * 2.2);
    grad.addColorStop(0, 'rgba(255, 240, 240, 1)');
    grad.addColorStop(0.4, 'rgba(255, 100, 130, 0.95)');
    grad.addColorStop(1, 'rgba(255, 80, 100, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, BULLET_RADIUS * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Floating pickup — green P = weapon, red H = life, blue S = shield. */
export function drawPowerUp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  kind: 'power' | 'life' | 'shield' = 'power',
): void {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 5 + x * 0.02) * 2;
  ctx.translate(0, bob);

  const palette =
    kind === 'life'
      ? {
          glow0: 'rgba(255, 100, 130, 0.55)',
          glow1: 'rgba(255, 100, 130, 0)',
          c0: '#8f1a3a',
          c1: '#ff6b8a',
          c2: '#6b0d28',
          ink: '#3a0814',
          letter: 'H',
        }
      : kind === 'shield'
        ? {
            glow0: 'rgba(100, 200, 255, 0.55)',
            glow1: 'rgba(100, 200, 255, 0)',
            c0: '#1a4a8f',
            c1: '#5ec8ff',
            c2: '#0d2f6b',
            ink: '#061828',
            letter: 'S',
          }
        : {
            glow0: 'rgba(100, 255, 180, 0.55)',
            glow1: 'rgba(100, 255, 180, 0)',
            c0: '#1a8f5a',
            c1: '#3dff9a',
            c2: '#0d6b42',
            ink: '#062816',
            letter: 'P',
          };

  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, POWERUP_RADIUS * 1.8);
  glow.addColorStop(0, palette.glow0);
  glow.addColorStop(1, palette.glow1);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, POWERUP_RADIUS * 1.8, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(-POWERUP_RADIUS, 0, POWERUP_RADIUS, 0);
  body.addColorStop(0, palette.c0);
  body.addColorStop(0.5, palette.c1);
  body.addColorStop(1, palette.c2);
  ctx.fillStyle = body;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, POWERUP_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.ink;
  ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(palette.letter, 0, 1);

  ctx.restore();
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  opts: {
    score: number;
    wave: number;
    lives: number;
    power: number;
    shield: boolean;
    players: number;
    rejected: boolean;
    nearCap: boolean;
  },
): void {
  const pad = 10;
  const w = 198;
  const h = opts.nearCap ? 64 : 52;
  const x = pad;
  const y = pad;
  const r = 10;

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(8, 12, 22, 0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 210, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(230, 240, 255, 0.95)';
  ctx.textAlign = 'left';
  ctx.fillText(`${opts.score.toString().padStart(6, '0')}`, x + 12, y + 14);

  ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(180, 200, 230, 0.85)';
  ctx.fillText(`wave ${opts.wave}  ·  ${opts.players}p`, x + 12, y + 28);

  // Lives
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + w - 14 - i * 12, y + 14, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = i < opts.lives ? '#ff6b8a' : 'rgba(255,255,255,0.15)';
    ctx.fill();
  }

  // Shield pip (top-right of lives)
  ctx.beginPath();
  ctx.arc(x + w - 14, y + 30, 4, 0, Math.PI * 2);
  ctx.fillStyle = opts.shield ? '#5ec8ff' : 'rgba(255,255,255,0.12)';
  ctx.fill();
  if (opts.shield) {
    ctx.strokeStyle = 'rgba(200, 240, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Power pips (weapon level 0..MAX)
  ctx.fillStyle = 'rgba(160, 220, 190, 0.9)';
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('PWR', x + 12, y + 42);
  for (let i = 0; i <= MAX_POWER_LEVEL; i++) {
    const px = x + 42 + i * 14;
    const py = y + 42;
    ctx.beginPath();
    ctx.rect(px - 5, py - 4, 10, 8);
    ctx.fillStyle =
      i <= opts.power ? (i >= 3 ? '#ffd166' : '#3dff9a') : 'rgba(255,255,255,0.12)';
    ctx.fill();
  }

  if (opts.nearCap) {
    ctx.fillStyle = 'rgba(255, 200, 120, 0.85)';
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('near player cap', x + 12, y + 56);
  }

  ctx.restore();

  if (opts.rejected) {
    ctx.save();
    const bw = 260;
    const bh = 48;
    const bx = (WORLD_WIDTH - bw) / 2;
    const by = WORLD_HEIGHT / 2 - bh / 2;
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fillStyle = 'rgba(20, 8, 12, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 120, 140, 0.5)';
    ctx.stroke();
    ctx.fillStyle = '#ff8fa3';
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Room full — try again later', WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
