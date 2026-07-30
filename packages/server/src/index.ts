import { WebSocketServer, WebSocket } from 'ws';
import { TICK_MS } from '@nani/shared';
import type { ClientMessage, WelcomeMessage } from '@nani/shared';
import { Room } from './room.js';

const PORT = Number(process.env.PORT ?? 8080);
const room = new Room();
const sockets = new Map<string, WebSocket>();

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  const id = room.join();
  sockets.set(id, ws);

  const welcome: WelcomeMessage = { type: 'welcome', id };
  ws.send(JSON.stringify(welcome));

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.type) {
      case 'input':
        room.setInput(id, msg.input);
        break;
      case 'land':
        room.land(id);
        break;
      case 'takeoff':
        room.takeoff(id);
        break;
      case 'fire':
        room.fire(id, msg.x, msg.y, msg.angle);
        break;
    }
  });

  ws.on('close', () => {
    room.leave(id);
    sockets.delete(id);
  });
});

setInterval(() => {
  const snapshot = JSON.stringify(room.tick());
  for (const ws of sockets.values()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(snapshot);
  }
}, TICK_MS);

console.log(`spaceship server listening on ws://localhost:${PORT}`);
