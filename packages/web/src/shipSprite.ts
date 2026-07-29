// Placeholder dart-fighter silhouette, nose pointing along +x to match the
// server's angle convention. Swap the markup for a real asset later — parts
// are separated by class so CSS can color hull/wing/cockpit independently.
const SHIP_SVG_INNER = `
  <path class="ship-wing" d="M -2 3 L -18 15 L -5 4 Z"></path>
  <path class="ship-wing" d="M -2 -3 L -18 -15 L -5 -4 Z"></path>
  <path class="ship-hull" d="M 20 0 L -6 9 L -14 0 L -6 -9 Z"></path>
  <ellipse class="ship-cockpit" cx="5" cy="0" rx="4.5" ry="2.8"></ellipse>
`;

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 48;
const HALF = SIZE / 2;

export type ShipVariant = 'own' | 'remote';

export class ShipSprite {
  readonly el: SVGSVGElement;

  constructor() {
    this.el = document.createElementNS(SVG_NS, 'svg');
    this.el.setAttribute('viewBox', `${-HALF} ${-HALF} ${SIZE} ${SIZE}`);
    this.el.setAttribute('width', String(SIZE));
    this.el.setAttribute('height', String(SIZE));
    this.el.classList.add('ship-sprite');
    this.el.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;';
    this.el.innerHTML = SHIP_SVG_INNER;
  }

  // screenX/screenY are viewport pixels (already converted from world
  // coordinates by the caller); scaleX/scaleY are the canvas's current
  // CSS-stretch factors, applied here so the sprite's size/rotation match
  // what's drawn on the canvas beneath it — using `left`/`top` for position
  // (rather than folding it into `transform`) keeps that composition simple:
  // layout places the box's center at the target point, and the transform
  // only scales+rotates in place around that already-correct center.
  update(
    screenX: number,
    screenY: number,
    angle: number,
    scaleX: number,
    scaleY: number,
    variant: ShipVariant,
    landed: boolean,
  ): void {
    this.el.style.left = `${screenX - HALF}px`;
    this.el.style.top = `${screenY - HALF}px`;
    this.el.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${angle}rad)`;
    this.el.classList.toggle('own', variant === 'own');
    this.el.classList.toggle('remote', variant === 'remote');
    this.el.classList.toggle('landed', landed);
  }

  remove(): void {
    this.el.remove();
  }
}
