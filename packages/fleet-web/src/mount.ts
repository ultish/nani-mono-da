import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAX_PLAYERS,
  MAX_DISPLAY_WIDTH,
  MAX_DISPLAY_HEIGHT,
} from '@nani/fleet-shared';
import type { ShipState } from '@nani/fleet-shared';
import { Net } from './net.js';
import { InputController } from './input.js';
import { InterpolationBuffer } from './interpolation.js';
import {
  drawAmbientStars,
  drawShip,
  drawEnemy,
  drawBullet,
  drawPowerUp,
  drawHud,
} from './render.js';

export interface MountOptions {
  /** Defaults to ws://<hostname>:8081 */
  wsUrl?: string;
  /**
   * How opaque the ambient star dust is. 0 = fully clear overlay (host UI
   * fully readable). Default 1 uses the subtle built-in dust.
   */
  ambient?: number;
  /**
   * Cap on-screen playfield size (CSS px). Defaults keep a ~960×640 panel so
   * large monitors don't stretch the egg to full height.
   */
  maxDisplayWidth?: number;
  maxDisplayHeight?: number;
}

export interface MountHandle {
  enter(): void;
  destroy(): void;
}

/**
 * Full-viewport transparent overlay. The host app stays visible underneath;
 * only ships, enemies, bullets, and a small HUD chip are drawn.
 * `pointer-events: none` so clicks/scroll pass through to the real UI.
 */
export function mount(container: HTMLElement, options: MountOptions = {}): MountHandle {
  const wsUrl = options.wsUrl ?? `ws://${location.hostname}:8081`;
  const ambient = options.ambient ?? 1;
  const maxDisplayW = options.maxDisplayWidth ?? MAX_DISPLAY_WIDTH;
  const maxDisplayH = options.maxDisplayHeight ?? MAX_DISPLAY_HEIGHT;

  const canvas = document.createElement('canvas');
  // Transparent overlay — never paints a solid page-covering background.
  canvas.style.cssText = [
    'position:fixed',
    'inset:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:2147483000',
    'background:transparent',
    'display:block',
  ].join(';');
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    // Draw in CSS pixels; scale for sharpness.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  /**
   * Map world coords into the viewport, aspect-correct and **size-capped**.
   * Fit-to-window alone on a 27″ display turned 480×720 into a full-height
   * tower; we also clamp so the playfield stays a centered overlay panel.
   */
  function worldTransform(): { scale: number; ox: number; oy: number } {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const fit = Math.min(cssW / WORLD_WIDTH, cssH / WORLD_HEIGHT);
    const cap = Math.min(maxDisplayW / WORLD_WIDTH, maxDisplayH / WORLD_HEIGHT);
    const scale = Math.min(fit, cap);
    const ox = (cssW - WORLD_WIDTH * scale) / 2;
    const oy = (cssH - WORLD_HEIGHT * scale) / 2;
    return { scale, ox, oy };
  }

  let myId: string | null = null;
  let myLives = 0;
  let myPower = 0;
  let myShield = false;
  let entered = false;
  let rejected = false;
  let playerCount = 0;

  const interp = new InterpolationBuffer();
  const input = new InputController((state) => net.sendInput(state));

  const net = new Net(wsUrl, {
    onWelcome: (msg) => {
      myId = msg.id;
    },
    onRejected: () => {
      rejected = true;
    },
    onSnapshot: (msg) => {
      interp.push(msg);
      let ships = 0;
      for (const e of msg.entities) {
        if (e.type === 'ship') {
          ships += 1;
          if (e.id === myId) {
            myLives = e.lives;
            myPower = e.power;
            myShield = e.shield;
          }
        }
      }
      playerCount = ships;
    },
  });

  function enter(): void {
    if (entered) return;
    entered = true;
    input.activate();
  }

  let raf = 0;
  const start = performance.now();

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const t = (now - start) / 1000;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    // Fully clear — host UI shows through everywhere we don't draw.
    ctx.clearRect(0, 0, cssW, cssH);

    const { scale, ox, oy } = worldTransform();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    if (ambient > 0) {
      ctx.globalAlpha = ambient;
      drawAmbientStars(ctx, t);
      ctx.globalAlpha = 1;
    }

    const entities = interp.sample(Date.now());
    let ships = 0;

    // Power-ups + bullets under ships; enemies mid; ships on top.
    for (const e of entities) {
      if (e.type === 'powerup') drawPowerUp(ctx, e.x, e.y, t, e.kind);
    }
    for (const e of entities) {
      if (e.type === 'bullet') drawBullet(ctx, e.x, e.y, e.side, e.power);
    }
    for (const e of entities) {
      if (e.type === 'enemy') drawEnemy(ctx, e.x, e.y, e.kind, e.hp, e.maxHp, t);
    }
    for (const e of entities) {
      if (e.type !== 'ship') continue;
      ships += 1;
      const ship = e as ShipState;
      drawShip(ctx, ship.x, ship.y, ship.colorIndex, {
        own: ship.id === myId,
        invuln: ship.invuln,
        dead: ship.dead,
        shield: ship.shield,
        t,
      });
    }
    if (ships > 0) playerCount = ships;

    drawHud(ctx, {
      score: interp.score,
      wave: interp.wave,
      lives: myLives,
      power: myPower,
      shield: myShield,
      players: playerCount,
      rejected,
      nearCap: playerCount >= MAX_PLAYERS - 1 && !rejected,
    });

    ctx.restore();
  }
  raf = requestAnimationFrame(frame);

  const destroy = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    input.destroy();
    net.close();
    canvas.remove();
  };

  return { enter, destroy };
}
