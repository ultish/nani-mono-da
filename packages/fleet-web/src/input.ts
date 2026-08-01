import { NEUTRAL_INPUT } from '@nani/fleet-shared';
import type { FleetInput } from '@nani/fleet-shared';

export class InputController {
  current: FleetInput = { ...NEUTRAL_INPUT };
  private active = false;
  private onChange: (input: FleetInput) => void;

  constructor(onChange: (input: FleetInput) => void) {
    this.onChange = onChange;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  activate(): void {
    this.active = true;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private emit(): void {
    this.onChange({ ...this.current });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.active) return;
    if (this.applyKey(e.code, true)) {
      e.preventDefault();
      this.emit();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!this.active) return;
    if (this.applyKey(e.code, false)) {
      e.preventDefault();
      this.emit();
    }
  };

  private onBlur = (): void => {
    this.current = { ...NEUTRAL_INPUT };
    this.emit();
  };

  private applyKey(code: string, down: boolean): boolean {
    switch (code) {
      case 'KeyA':
      case 'ArrowLeft':
        this.current.left = down;
        return true;
      case 'KeyD':
      case 'ArrowRight':
        this.current.right = down;
        return true;
      case 'KeyW':
      case 'ArrowUp':
        this.current.up = down;
        return true;
      case 'KeyS':
      case 'ArrowDown':
        this.current.down = down;
        return true;
      case 'Space':
      case 'KeyZ':
        this.current.fire = down;
        return true;
      default:
        return false;
    }
  }
}
