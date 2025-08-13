(() => {
  const socket = io();

  function joinGame(playerId) {
    socket.emit('joinGame', playerId);
  }

  function sendAction(action, secret = false) {
    socket.emit('playerAction', { action, secret });
  }

  function endTurn() {
    socket.emit('endTurn');
  }

  socket.on('turn', (playerId) => {
    console.log('Turno de', playerId);
  });

  socket.on('actionResult', (data) => {
    console.log('Acción recibida', data);
  });

  socket.on('turnEnded', (playerId) => {
    console.log('Turno finalizado de', playerId);
  });

  window.GameOnline = { joinGame, sendAction, endTurn };
})();
