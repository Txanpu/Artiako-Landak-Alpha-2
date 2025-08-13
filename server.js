const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos del directorio actual
app.use(express.static(__dirname));

// Gestión de partidas por código
const rooms = {};

io.on('connection', (socket) => {
  // registrar jugador en una sala
  socket.on('joinGame', ({ roomId, playerId }) => {
    socket.join(roomId);
    socket.data.playerId = playerId;
    socket.data.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = { currentTurn: null };
    }
    const room = rooms[roomId];

    if (room.currentTurn === null) {
      room.currentTurn = playerId;
      io.to(roomId).emit('turn', room.currentTurn);
    } else {
      socket.emit('turn', room.currentTurn);
    }
  });

  // acciones de jugadores
  socket.on('playerAction', ({ action, secret }) => {
    const { playerId, roomId } = socket.data;
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room || playerId !== room.currentTurn) return; // validar turno
    const payload = { action, playerId };
    if (secret) {
      socket.emit('actionResult', payload);
    } else {
      io.to(roomId).emit('actionResult', payload);
    }
  });

  // mensajes de chat
  socket.on('chatMessage', (message) => {
    const { playerId, roomId } = socket.data;
    if (!roomId) return;
    io.to(roomId).emit('chatMessage', { playerId, message });
  });

  // finalizar turno
  socket.on('endTurn', () => {
    const { playerId, roomId } = socket.data;
    if (!roomId) return;
    const room = rooms[roomId];
    if (room && playerId === room.currentTurn) {
      room.currentTurn = null;
      io.to(roomId).emit('turnEnded', playerId);
    }
  });

  socket.on('disconnect', () => {
    const { roomId } = socket.data;
    if (!roomId) return;
    const remaining = io.sockets.adapter.rooms.get(roomId);
    if (!remaining || remaining.size === 0) {
      delete rooms[roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
