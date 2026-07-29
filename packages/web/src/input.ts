import { NEUTRAL_INPUT } from '@nani/shared';
import type { ShipInput } from '@nani/shared';

// Once "entered," WASD/QE/Space would otherwise hijack typing anywhere else
// on the host page (search boxes, comment fields, etc). Skip ship input
// whenever the real page currently has an editable element focused.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export class InputController {
  private state: ShipInput = { ...NEUTRAL_INPUT };
  private active = false;

  constructor(
    private onChange: (input: ShipInput) => void,
    private onLand: () => void,
    private onTakeoff: () => void,
    private onFire: () => void,
  ) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  activate(): void {
    this.active = true;
  }

  get current(): ShipInput {
    return this.state;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.active || isEditableTarget(e.target)) return;
    switch (e.key.toLowerCase()) {
      case 'w': this.set('thrust', true); break;
      case 's': this.set('brake', true); break;
      case 'a': this.set('turnLeft', true); break;
      case 'd': this.set('turnRight', true); break;
      case 'q': this.onLand(); break;
      case 'e': this.onTakeoff(); break;
      case ' ': e.preventDefault(); this.onFire(); break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (!this.active || isEditableTarget(e.target)) return;
    switch (e.key.toLowerCase()) {
      case 'w': this.set('thrust', false); break;
      case 's': this.set('brake', false); break;
      case 'a': this.set('turnLeft', false); break;
      case 'd': this.set('turnRight', false); break;
    }
  };

  private set(key: keyof ShipInput, value: boolean): void {
    if (this.state[key] === value) return;
    this.state = { ...this.state, [key]: value };
    this.onChange(this.state);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
