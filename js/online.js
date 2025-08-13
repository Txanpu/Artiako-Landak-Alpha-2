(() => {
  const socket = typeof io !== 'undefined' ? io() : null;
  let roomKey;
  let playerId;
  let pc;
  let dataChannel;

  function createPeer() {
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('signal', { roomId: roomKey, data: { candidate: event.candidate } });
      }
    };
    pc.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel();
    };
  }

  function setupDataChannel() {
    if (!dataChannel) return;
    dataChannel.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'turn':
          console.log('Turno de', msg.playerId);
          break;
        case 'action':
          console.log('Acción recibida', msg);
          break;
        case 'turnEnded':
          console.log('Turno finalizado de', msg.playerId);
          break;
        case 'chat':
          if (typeof log === 'function') {
            log(`${msg.playerId}: ${msg.message}`);
          } else {
            console.log('Chat', msg.playerId, msg.message);
          }
          break;
      }
    };
  }

  async function joinGame(key) {
    if (!socket) return;
    roomKey = key;
    if (!playerId) {
      playerId = Math.random().toString(36).slice(2, 8);
    }
    createPeer();
    socket.emit('joinGame', { roomId: roomKey, playerId });
  }

  async function shareGame() {
    if (!socket) return;
    if (!roomKey) {
      roomKey = Math.random().toString(36).slice(2, 8);
    }
    await joinGame(roomKey);
    dataChannel = pc.createDataChannel('game');
    setupDataChannel();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { roomId: roomKey, data: { sdp: pc.localDescription } });
    window.prompt('Comparte esta llave con tus amigos:', roomKey);
  }

  socket?.on('signal', async ({ data }) => {
    if (!pc) createPeer();
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { roomId: roomKey, data: { sdp: pc.localDescription } });
      }
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch (err) {
        console.error('Error adding ICE candidate', err);
      }
    }
  });

  function sendMessage(msg) {
    if (dataChannel?.readyState === 'open') {
      dataChannel.send(JSON.stringify(msg));
    }
  }

  function sendAction(action, secret = false) {
    sendMessage({ type: 'action', action, secret, playerId });
  }

  function endTurn() {
    sendMessage({ type: 'turnEnded', playerId });
  }

  function sendChat(message) {
    sendMessage({ type: 'chat', playerId, message });
  }

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

