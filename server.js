const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map(); // roomId -> Set(ws)

function inRoom(room){ const s = rooms.get(room); if(!s){ const n=new Set(); rooms.set(room,n); return n;} return s; }

wss.on('connection', (ws)=>{
  let room=null;
  ws.on('message', (raw)=>{
    let msg; try{ msg=JSON.parse(raw); }catch{ return; }
    if (!room && msg.room){ room = msg.room; inRoom(room).add(ws); }
    const set = inRoom(room);
    for (const cli of set){ if (cli!==ws && cli.readyState===1) cli.send(raw); }
  });
  ws.on('close', ()=>{ if(room){ const set=inRoom(room); set.delete(ws); if(!set.size) rooms.delete(room); } });
});
console.log('Signaling WS en ws://localhost:8080');
