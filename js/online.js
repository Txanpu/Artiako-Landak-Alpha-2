(() => {
  if (typeof window.io === 'undefined') {
    console.warn('Socket.IO no disponible; modo online deshabilitado');
    const joinBtn = document.getElementById('joinOnline');
    const shareBtn = document.getElementById('shareGame');
    joinBtn?.setAttribute('disabled', 'true');
    shareBtn?.setAttribute('disabled', 'true');
    window.GameOnline = {
      joinGame: () => alert('Modo online no disponible'),
      sendAction: () => {},
      endTurn: () => {},
      shareGame: () => alert('Modo online no disponible')
    };
    return;
  }

  const socket = window.io();
  let playerKey = null;

  function joinGame(playerId) {
    playerKey = playerId;
    socket.emit('joinGame', playerId);
  }

  function shareGame() {
    if (!playerKey) {
      playerKey = Math.random().toString(36).slice(2, 8);
      socket.emit('joinGame', playerKey);
    }
    window.prompt('Comparte esta llave con tus amigos:', playerKey);
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

  const joinBtn = document.getElementById('joinOnline');
  const shareBtn = document.getElementById('shareGame');

  joinBtn?.addEventListener('click', () => {
    const key = window.prompt('Ingresa la llave de la partida:');
    if (key) joinGame(key);
  });

  shareBtn?.addEventListener('click', () => {
    shareGame();
  });

  window.GameOnline = { joinGame, sendAction, endTurn, shareGame };
})();
