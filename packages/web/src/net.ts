import type { ClientMessage, ServerMessage, ShipInput, SnapshotMessage } from '@nani/shared';

export interface NetHandlers {
  onWelcome(id: string): void;
  onSnapshot(msg: SnapshotMessage): void;
}

export class Net {
  private ws: WebSocket;

  constructor(url: string, private handlers: NetHandlers) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (ev) => {
      const msg: ServerMessage = JSON.parse(ev.data);
      if (msg.type === 'welcome') this.handlers.onWelcome(msg.id);
      else if (msg.type === 'snapshot') this.handlers.onSnapshot(msg);
    };
  }

  private send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendInput(input: ShipInput): void {
    this.send({ type: 'input', input });
  }

  land(): void {
    this.send({ type: 'land' });
  }

  takeoff(): void {
    this.send({ type: 'takeoff' });
  }

  fire(x: number, y: number, angle: number): void {
    this.send({ type: 'fire', x, y, angle });
  }
}
