import { WebSocketServer, WebSocket } from 'ws';
import { TICK_MS } from '@nani/fleet-shared';
import type { ClientMessage, WelcomeMessage, RejectedMessage } from '@nani/fleet-shared';
import { Room } from './room.js';

const PORT = Number(process.env.PORT ?? 8081);
const room = new Room();
const sockets = new Map<string, WebSocket>();

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  const joined = room.join();
  if (joined == null) {
    const rejected: RejectedMessage = { type: 'rejected', reason: 'full' };
    ws.send(JSON.stringify(rejected));
    ws.close();
    return;
  }

  const { id, colorIndex } = joined;
  sockets.set(id, ws);

  const welcome: WelcomeMessage = { type: 'welcome', id, colorIndex };
  ws.send(JSON.stringify(welcome));

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'input') room.setInput(id, msg.input);
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

console.log(`fleet co-op server listening on ws://localhost:${PORT}`);
