import { WORLD_WIDTH, WORLD_HEIGHT, SHIP_RADIUS, MAX_HP } from '@nani/shared';
import type { ShipState } from '@nani/shared';
import { Net } from './net.js';
import { InputController } from './input.js';
import { InterpolationBuffer } from './interpolation.js';
import { LocalShip } from './localShip.js';
import { drawJet, drawLaser, drawHearts, drawAsteroid } from './render.js';
import { ShipSprite } from './shipSprite.js';
import { SHIP_SPRITE_CSS } from './shipSprite.css.js';

export interface MountOptions {
  wsUrl?: string;
}

export function mount(container: HTMLElement, options: MountOptions = {}): () => void {
  const wsUrl = options.wsUrl ?? `ws://${location.hostname}:8080`;

  const styleEl = document.createElement('style');
  styleEl.textContent = SHIP_SPRITE_CSS;
  document.head.appendChild(styleEl);

  const canvas = document.createElement('canvas');
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const sprites = new Map<string, ShipSprite>();
  function getOrCreateSprite(id: string): ShipSprite {
    let sprite = sprites.get(id);
    if (!sprite) {
      sprite = new ShipSprite();
      container.appendChild(sprite.el);
      sprites.set(id, sprite);
    }
    return sprite;
  }

  let myId: string | null = null;
  let entered = false;
  let myLanded = false;
  let myHp = MAX_HP;
  let localShip: LocalShip | null = null;

  const interpBuffer = new InterpolationBuffer();

  const input = new InputController(
    (state) => net.sendInput(state),
    () => {
      myLanded = true;
      localShip?.setLanded(true);
      net.land();
    },
    () => {
      myLanded = false;
      localShip?.setLanded(false);
      net.takeoff();
    },
    () => net.fire(),
  );

  const net = new Net(wsUrl, {
    onWelcome: (id) => {
      myId = id;
    },
    onSnapshot: (msg) => {
      interpBuffer.push(msg);
      const mine = msg.entities.find(
        (e): e is ShipState => e.type === 'ship' && e.id === myId,
      );
      if (mine) {
        if (!localShip) localShip = new LocalShip(mine.x, mine.y);
        else localShip.reconcile(mine);
        myHp = mine.hp;
      }
    },
  });

  function handleClick(e: MouseEvent): void {
    if (entered || !myId || !localShip) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const s = localShip.state;
    if (Math.hypot(x - s.x, y - s.y) <= SHIP_RADIUS * 1.5) {
      entered = true;
      input.activate();
    }
  }
  window.addEventListener('click', handleClick);

  let raf = 0;
  let lastFrame = performance.now();
  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = now - lastFrame;
    lastFrame = now;

    if (localShip) localShip.step(input.current, dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // The canvas is drawn at a fixed WORLD_WIDTH x WORLD_HEIGHT resolution
    // and then CSS-stretched to fill the viewport; canvas draw calls scale
    // with that stretch automatically, but the sprites are separate DOM
    // elements, so world -> screen conversion has to be done explicitly to
    // keep them aligned with the canvas-drawn jet stream/hearts and with
    // the (world-space) click hit-test below.
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const toScreenX = (worldX: number) => rect.left + worldX * scaleX;
    const toScreenY = (worldY: number) => rect.top + worldY * scaleY;

    const seen = new Set<string>();
    for (const entity of interpBuffer.sample(Date.now())) {
      if (entity.type === 'laser') {
        drawLaser(ctx, entity.x, entity.y, entity.angle);
        continue;
      }
      if (entity.type === 'asteroid') {
        drawAsteroid(ctx, entity.x, entity.y, entity.angle, entity.size);
        continue;
      }
      if (entity.id === myId) continue; // own ship drawn from local prediction below
      seen.add(entity.id);
      getOrCreateSprite(entity.id).update(
        toScreenX(entity.x),
        toScreenY(entity.y),
        entity.angle,
        scaleX,
        scaleY,
        'remote',
        entity.landed,
      );
      drawJet(ctx, entity.x, entity.y, entity.angle, entity.powerBar, entity.landed);
      drawHearts(ctx, entity.hp, entity.x, entity.y - SHIP_RADIUS - 14);
    }

    if (localShip && myId) {
      const s = localShip.state;
      seen.add(myId);
      getOrCreateSprite(myId).update(
        toScreenX(s.x),
        toScreenY(s.y),
        s.angle,
        scaleX,
        scaleY,
        'own',
        myLanded,
      );
      drawJet(ctx, s.x, s.y, s.angle, s.powerBar, myLanded);
      drawHearts(ctx, myHp, s.x, s.y - SHIP_RADIUS - 14);
    }

    for (const [id, sprite] of sprites) {
      if (!seen.has(id)) {
        sprite.remove();
        sprites.delete(id);
      }
    }

    if (myId && !entered) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '14px sans-serif';
      ctx.fillText('click the ship to take control', 16, 24);
    }
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('click', handleClick);
    input.destroy();
    for (const sprite of sprites.values()) sprite.remove();
    sprites.clear();
    canvas.remove();
    styleEl.remove();
  };
}
