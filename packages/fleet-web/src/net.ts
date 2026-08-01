import type {
  ClientMessage,
  ServerMessage,
  FleetInput,
  SnapshotMessage,
  WelcomeMessage,
  RejectedMessage,
} from '@nani/fleet-shared';

export interface NetHandlers {
  onWelcome(msg: WelcomeMessage): void;
  onSnapshot(msg: SnapshotMessage): void;
  onRejected(msg: RejectedMessage): void;
}

export class Net {
  private ws: WebSocket;

  constructor(url: string, private handlers: NetHandlers) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (ev) => {
      const msg: ServerMessage = JSON.parse(ev.data);
      if (msg.type === 'welcome') this.handlers.onWelcome(msg);
      else if (msg.type === 'snapshot') this.handlers.onSnapshot(msg);
      else if (msg.type === 'rejected') this.handlers.onRejected(msg);
    };
  }

  sendInput(input: FleetInput): void {
    const msg: ClientMessage = { type: 'input', input };
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws.close();
  }
}
