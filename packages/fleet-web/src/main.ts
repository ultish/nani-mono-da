import { mount } from './mount.js';

// Dev harness: auto-enter so multi-tab co-op is one refresh away.
// Real embeds should defer mount/enter to their own trigger (Konami, button…).
mount(document.body).enter();
