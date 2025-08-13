(() => {
  let pc;
  let dataChannel;
  let playerId;

  function createPeer() {
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
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

  function waitIceCompletion() {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        pc.addEventListener('icegatheringstatechange', function checkState() {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        });
      }
    });
  }

  async function shareGame() {
    if (!playerId) {
      playerId = Math.random().toString(36).slice(2, 8);
    }
    createPeer();
    dataChannel = pc.createDataChannel('game');
    setupDataChannel();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIceCompletion();
    const offerStr = btoa(JSON.stringify(pc.localDescription));
    window.prompt('Comparte esta oferta con tu amigo:', offerStr);
    const answerStr = window.prompt('Pega la respuesta del otro jugador:');
    if (answerStr) {
      const answer = JSON.parse(atob(answerStr));
      await pc.setRemoteDescription(answer);
    }
  }

  async function joinGame() {
    if (!playerId) {
      playerId = Math.random().toString(36).slice(2, 8);
    }
    const offerStr = window.prompt('Pega la oferta del anfitrión:');
    if (!offerStr) return;
    createPeer();
    await pc.setRemoteDescription(JSON.parse(atob(offerStr)));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIceCompletion();
    const answerStr = btoa(JSON.stringify(pc.localDescription));
    window.prompt('Envía esta respuesta al anfitrión:', answerStr);
  }

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
    const host = window.confirm('¿Quieres crear la partida?\nAceptar para crear, cancelar para unirse');
    if (host) {
      shareGame();
    } else {
      joinGame();
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

