(function(){
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

  function rid(){ return 'c'+Math.random().toString(36).slice(2,10); }

  const Net = {
    role: null,
    id: rid(),
    room: null,
    ws: null,
    hostId: null,
    peers: new Map(), // peerId -> { pc, dc, num }
    playerNum: null,
    _nextPeerNum: 2,
    onOp: (op, from)=>console.log('op', op, 'from', from),        // override en tu juego
    onCommit: (patch)=>console.log('commit', patch),              // override en clientes
    onPeersChanged: ()=>{},                                       // override si quieres UI
    onChat: (msg, from)=>{},                                      // override para chat
    status(s){ const el=document.getElementById('netStatus'); if(el) el.textContent = s; console.log('[NET]', s); },

    // HOST
    async host(room, wsUrl){
      this.role='host'; this.room=room; this.playerNum=1; this._nextPeerNum=2;
      await this._connectWS(wsUrl);
      this._send({ type:'host-hello', id:this.id });
      this.status(`Host en sala ${room} (J1)`);
    },

    // PEER
    async join(room, wsUrl){
      this.role='peer'; this.room=room; this.playerNum=null;
      await this._connectWS(wsUrl);
      this._send({ type:'peer-hello', id:this.id });
      this.status(`Join a ${room}`);
    },

    // Lado PEER: manda operación al host por DataChannel
    sendOp(op){
      if (this.role!=='peer') return;
      const dc = this._hostDC();
      if (dc?.readyState==='open') dc.send(JSON.stringify({ t:'op', op, from:this.id }));
    },

    // Chat simple
    sendChat(msg){
      if (!msg) return;
      if (this.role==='host'){
        this._broadcastChat(msg, this.id);
        this.onChat(msg, this.id);
      } else if (this.role==='peer'){
        const dc = this._hostDC();
        if (dc?.readyState==='open') dc.send(JSON.stringify({ t:'chat', msg, from:this.id }));
      }
    },

    // Lado HOST: reenvía commit a todos
    broadcastCommit(patch){
      if (this.role!=='host') return;
      for (const {dc} of this.peers.values()){
        if (dc?.readyState==='open') dc.send(JSON.stringify({ t:'commit', patch }));
      }
    },

    _broadcastChat(msg, from){
      for (const {dc} of this.peers.values()){
        if (dc?.readyState==='open') dc.send(JSON.stringify({ t:'chat', msg, from }));
      }
    },

    disconnect(){
      this.ws?.close();
      this.ws=null;
      this.role=null;
      this.room=null;
      this.hostId=null;
      this.playerNum=null;
      this._nextPeerNum=2;
      for(const {pc} of this.peers.values()) pc.close();
      this.peers.clear();
      this.onPeersChanged();
      this.status('Desconectado');
    },

    // Internos
    async _connectWS(wsUrl){
      return new Promise((res,rej)=>{
        const ws = new WebSocket(wsUrl);
        this.ws = ws;
        ws.onopen = ()=>{ this._send({ type:'join-room', room:this.room, id:this.id, role:this.role }); res(); };
        ws.onmessage = (ev)=> this._onSignal(JSON.parse(ev.data||'{}'));
        ws.onerror = rej;
        ws.onclose = ()=> this.status('WS cerrado');
      });
    },
    _send(msg){
      // Broadcast en sala; los clientes filtran por 'to'
      this.ws?.send(JSON.stringify({ room:this.room, from:this.id, ...msg }));
    },
    _onSignal(msg){
      if (msg.room !== this.room || msg.from === this.id) return;

      // Descubrir host
      if (msg.type==='host-hello'){ this.hostId = msg.from; }

      if (this.role==='host'){
        if (msg.type==='peer-hello'){ this._hostAcceptPeer(msg.from); }
        if (msg.type==='answer' && msg.to===this.id){ this._hostOnAnswer(msg.from, msg.answer); }
        if (msg.type==='ice' && msg.to===this.id){ this.peers.get(msg.from)?.pc.addIceCandidate(msg.candidate).catch(()=>{}); }
      } else { // peer
        if (msg.type==='offer' && msg.to===this.id){ this._peerOnOffer(msg.from, msg.offer); }
        if (msg.type==='ice' && msg.to===this.id){ this._peerPC?.addIceCandidate(msg.candidate).catch(()=>{}); }
        if (msg.type==='host-hello'){ this.hostId = msg.from; }
      }
    },

    async _hostAcceptPeer(peerId){
      const num = this._nextPeerNum++;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      const dc = pc.createDataChannel('game', { ordered:true });
      dc.onopen = ()=>{
        this.status(`DC→${peerId} abierto (J${num})`);
        dc.send(JSON.stringify({ t:'assign', num }));
      };
      dc.onmessage = (e)=> this._onDCMessage(peerId, e.data);

      pc.onicecandidate = (e)=>{
        if (e.candidate) this._send({ type:'ice', to:peerId, candidate:e.candidate });
      };
      pc.onconnectionstatechange = ()=> {
        if (pc.connectionState==='failed' || pc.connectionState==='closed'){ this.peers.delete(peerId); this.onPeersChanged(); }
      };

      this.peers.set(peerId, { pc, dc, num });
      this.onPeersChanged();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._send({ type:'offer', to:peerId, offer });
    },

    async _hostOnAnswer(peerId, answer){
      const p = this.peers.get(peerId); if (!p) return;
      await p.pc.setRemoteDescription(new RTCSessionDescription(answer));
    },

    async _peerOnOffer(hostId, offer){
      this.hostId = hostId;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      this._peerPC = pc;
      pc.ondatachannel = (e)=>{
        this._peerDC = e.channel;
        this._peerDC.onopen = ()=> this.status('DC abierto con host');
        this._peerDC.onmessage = (ev)=> this._onDCMessage(hostId, ev.data);
      };
      pc.onicecandidate = (e)=>{
        if (e.candidate) this._send({ type:'ice', to:hostId, candidate:e.candidate });
      };
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this._send({ type:'answer', to:hostId, answer });
    },

    _hostDC(){ return this._peerDC; }, // en peer: devuelve DC al host

    _onDCMessage(fromId, raw){
      let msg; try{ msg = JSON.parse(raw); }catch{ return; }
      if (msg.t==='assign' && this.role==='peer'){
        this.playerNum = msg.num;
        this.status(`Conectado como J${msg.num}`);
        this.onPeersChanged();
      } else if (msg.t==='op' && this.role==='host'){
        // Host valida, aplica y difunde parche
        const patch = window.applyOpAuthoritatively ? window.applyOpAuthoritatively(msg.op, fromId) : { echo: msg.op };
        this.broadcastCommit(patch);
      } else if (msg.t==='commit' && this.role==='peer'){
        this.onCommit(msg.patch);
      } else if (msg.t==='chat'){
        if (this.role==='host'){
          this.onChat(msg.msg, msg.from);
          this._broadcastChat(msg.msg, msg.from);
        } else {
          this.onChat(msg.msg, msg.from);
        }
      }
    }
  };

  window.Net = Net;
})();
