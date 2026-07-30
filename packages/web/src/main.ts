import { mount } from './mount.js';
import { onKonamiCode } from './konami.js';

// Demonstrates the intended real-world pattern: `mount()` itself is deferred
// until the activation trigger fires, so the overlay/WS connection don't
// exist at all beforehand — not just gating `enter()` on an already-mounted
// instance. Real embeds should follow the same shape, swapping in whatever
// their own trigger is.
console.log('psst — try the Konami code (↑ ↑ ↓ ↓ ← → ← → b a)');

let mounted = false;
onKonamiCode(() => {
  if (mounted) return;
  mounted = true;
  mount(document.body).enter();
});
