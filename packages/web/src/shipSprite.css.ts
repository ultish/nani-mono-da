// Kept as a plain string (not a .css file) so the whole web package can stay
// a single TS bundle with no extra loader config.
export const SHIP_SPRITE_CSS = `
.ship-sprite {
  transform-origin: center;
}
.ship-sprite .ship-hull { fill: #ddd; }
.ship-sprite .ship-wing { fill: #aaa; }
.ship-sprite .ship-cockpit { fill: rgba(255, 255, 255, 0.85); }

.ship-sprite.own .ship-hull { fill: #5ec9ff; }
.ship-sprite.own .ship-wing { fill: #3b9fdb; }

.ship-sprite.landed .ship-hull { fill: #888; }
.ship-sprite.landed .ship-wing { fill: #666; }
`;
