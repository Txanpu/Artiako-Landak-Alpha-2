(() => {
  const socket = typeof io !== 'undefined' ? io() : null;
  let roomKey;
  let playerId;

  function joinGame(key) {
    if (!socket) return;
    roomKey = key;
    if (!playerId) {
      playerId = Math.random().toString(36).slice(2, 8);
    }
    socket.emit('joinGame', { roomId: roomKey, playerId });
  }

  function shareGame() {
    if (!socket) return;
    if (!roomKey) {
      roomKey = Math.random().toString(36).slice(2, 8);
    }
    joinGame(roomKey);
    window.prompt('Comparte esta llave con tus amigos:', roomKey);
  }

  function sendAction(action, secret = false) {
    if (!socket) return;
    socket.emit('playerAction', { action, secret });
  }

  function endTurn() {
    if (!socket) return;
    socket.emit('endTurn');
  }

  function sendChat(message) {
    if (!socket) return;
    socket.emit('chatMessage', message);
  }

  socket?.on('turn', (playerId) => {
    console.log('Turno de', playerId);
  });

  socket?.on('actionResult', (data) => {
    console.log('Acción recibida', data);
  });

  socket?.on('turnEnded', (playerId) => {
    console.log('Turno finalizado de', playerId);
  });

  socket?.on('chatMessage', ({ playerId: from, message }) => {
    if (typeof log === 'function') {
      log(`${from}: ${message}`);
    } else {
      console.log('Chat', from, message);
    }
  });

  const onlineBtn = document.getElementById('startOnline');
  const chatInput = document.getElementById('chatInput');
  const sendChatBtn = document.getElementById('sendChat');

  function handleSendChat() {
    const msg = chatInput?.value.trim();
    if (!msg) return;
    sendChat(msg);
    chatInput.value = '';
  }

  onlineBtn?.addEventListener('click', () => {
    if (!socket) {
      alert('Online no disponible. Revisa tu conexión.');
      return;
    }
    const share = window.confirm('¿Quieres compartir la partida?\nAceptar para compartir, cancelar para unirse');
    if (share) {
      shareGame();
    } else {
      const key = window.prompt('Ingresa la llave de la partida:');
      if (key) joinGame(key);
    }
  });

  sendChatBtn?.addEventListener('click', handleSendChat);
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendChat();
    }
  });

  window.GameOnline = { joinGame, sendAction, endTurn, shareGame, sendChat };
})();
