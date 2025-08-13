(() => {
  const socket = io();
  let roomKey = null;
  let playerId = null;

  function joinGame(key) {
    roomKey = key;
    if (!playerId) {
      playerId = Math.random().toString(36).slice(2, 8);
    }
    socket.emit('joinGame', { roomId: roomKey, playerId });
  }

  function shareGame() {
    if (!roomKey) {
      roomKey = Math.random().toString(36).slice(2, 8);
    }
    joinGame(roomKey);
    window.prompt('Comparte esta llave con tus amigos:', roomKey);
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

  const onlineBtn = document.getElementById('startOnline');

  onlineBtn?.addEventListener('click', () => {
    const share = window.confirm('¿Quieres compartir la partida?\nAceptar para compartir, cancelar para unirse');
    if (share) {
      shareGame();
    } else {
      const key = window.prompt('Ingresa la llave de la partida:');
      if (key) joinGame(key);
    }
  });

  window.GameOnline = { joinGame, sendAction, endTurn, shareGame };
})();
