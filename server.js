const { WebSocketServer } = require('ws');
const Ajv = require('ajv');

const ajv = new Ajv();
const schema = {
  type: 'object',
  properties: {
    room: { type: 'string' },
    type: { type: 'string' },
    payload: {}
  },
  required: ['room', 'type']
};
const validate = ajv.compile(schema);

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map(); // roomId -> Set(ws)

function safeRoomId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
}

function join(room, ws) {
  let set = rooms.get(room);
  if (!set) {
    set = new Set();
    rooms.set(room, set);
  }
  set.add(ws);
}

function broadcast(room, sender, data) {
  const set = rooms.get(room);
  if (!set) return;
  for (const cli of set) {
    if (cli !== sender && cli.readyState === 1) {
      cli.send(data);
    }
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  let room = null;
  ws.on('message', (raw) => {
    const size = typeof raw === 'string' ? Buffer.byteLength(raw, 'utf8') : raw.length;
    if (size > 32_768) return;

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!validate(msg)) return;

    if (!room) {
      room = safeRoomId(msg.room);
      join(room, ws);
    }

    broadcast(room, ws, JSON.stringify({ type: msg.type, payload: msg.payload }));
  });

  ws.on('close', () => {
    if (room) {
      const set = rooms.get(room);
      if (set) {
        set.delete(ws);
        if (!set.size) rooms.delete(room);
      }
    }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
    } else {
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 30_000);

console.log('Signaling WS en ws://localhost:8080');

