const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos del directorio actual
app.use(express.static(__dirname));

// Jugador en turno
let currentTurn = null;

io.on('connection', (socket) => {
  // registrar jugador
  socket.on('joinGame', (playerId) => {
    socket.data.playerId = playerId;
    if (currentTurn === null) {
      currentTurn = playerId;
      io.emit('turn', currentTurn);
    }
  });

  // acciones de jugadores
  socket.on('playerAction', ({ action, secret }) => {
    const playerId = socket.data.playerId;
    if (playerId !== currentTurn) return; // validar turno
    const payload = { action, playerId };
    if (secret) {
      socket.emit('actionResult', payload);
    } else {
      io.emit('actionResult', payload);
    }
  });

  // finalizar turno
  socket.on('endTurn', () => {
    const playerId = socket.data.playerId;
    if (playerId === currentTurn) {
      currentTurn = null;
      io.emit('turnEnded', playerId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
