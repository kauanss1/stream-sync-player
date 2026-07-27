const socket = io('https://stream-sync-server.onrender.com'); 

let player;
let playerState = -1;
let emSala = false;
let playerPronto = false;
let pendingVideoId = null;
let souHost = false;

let syncInteligenteAtivo = true;
let timerNotificacao = null;
let meuPing = 0;

const lobbyCard = document.getElementById('lobby-card');
const mainApp = document.getElementById('main-app');
const statusDiv = document.getElementById('status');
const roomStatusDiv = document.getElementById('room-status');
const pingDisplay = document.getElementById('ping-display');
const toggleSync = document.getElementById('toggle-sync');
const toastNotification = document.getElementById('toast-notification');

const tabCriar = document.getElementById('tab-criar');
const tabEntrar = document.getElementById('tab-entrar');

const inputNick = document.getElementById('input-nick');
const inputRoomId = document.getElementById('input-room-id');
const inputRoomPass = document.getElementById('input-room-pass');
const btnCriarSala = document.getElementById('btn-criar-sala');
const btnEntrarSala = document.getElementById('btn-entrar-sala');
const inputVideoUrl = document.getElementById('input-video-url');
const btnCarregar = document.getElementById('btn-carregar');

const sidebarHost = document.getElementById('sidebar-host');
const sidebarViewers = document.getElementById('sidebar-viewers');

function extractVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|live\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function exibirNotificacao(texto) {
  toastNotification.innerText = texto;
  toastNotification.style.display = 'block';
  if (timerNotificacao) clearTimeout(timerNotificacao);
  timerNotificacao = setTimeout(() => { toastNotification.style.display = 'none'; }, 4000);
}

tabCriar.addEventListener('click', () => {
  tabCriar.classList.add('active'); 
  tabEntrar.classList.remove('active');
  btnCriarSala.style.display = 'block'; 
  btnEntrarSala.style.display = 'none';
});

tabEntrar.addEventListener('click', () => {
  tabEntrar.classList.add('active'); 
  tabCriar.classList.remove('active');
  btnEntrarSala.style.display = 'block'; 
  btnCriarSala.style.display = 'none';
});

btnCriarSala.addEventListener('click', () => enviarAcaoSala('create'));
btnEntrarSala.addEventListener('click', () => enviarAcaoSala('join'));

function enviarAcaoSala(actionType) {
  const nick = inputNick.value.trim();
  const roomId = inputRoomId.value.trim();
  const password = inputRoomPass.value.trim();

  if (!nick || !roomId || !password) {
    alert('Preencha seu Nick, o Nome da Sala e a Senha!');
    return;
  }
  socket.emit('join_room', { roomId, password, nick, actionType });
}

socket.on('update_users', (users) => {
  sidebarViewers.innerHTML = '';
  let hostFound = false;

  users.forEach(user => {
    if (user.isHost) {
      sidebarHost.innerText = user.nick;
      hostFound = true;
    } else {
      const li = document.createElement('li');
      li.className = 'viewer-item';
      li.innerText = user.nick;
      sidebarViewers.appendChild(li);
    }
  });

  if (!hostFound) sidebarHost.innerText = 'Sem Host';
});

toggleSync.addEventListener('change', (e) => {
  syncInteligenteAtivo = e.target.checked;
  if (syncInteligenteAtivo) {
    statusDiv.innerText = 'Status: Sync Constante Inteligente ATIVADO ⚡';
    statusDiv.style.color = '#00e676';
    exibirNotificacao('⚡ Sync Inteligente Reativado! Sincronizando...');
  } else {
    statusDiv.innerText = 'Status: Sync Constante DESATIVADO (Modo Livre)';
    statusDiv.style.color = '#ffb300';
    exibirNotificacao('⚠️ Sync Desativado! Modo Livre ativado.');
    if (playerPronto && player) player.setPlaybackRate(1.0);
  }
});

setInterval(() => {
  const inicio = Date.now();
  socket.emit('ping_check', inicio, (timeEnviado) => {
    meuPing = Date.now() - timeEnviado;
    pingDisplay.innerText = `Latência da Rede: ${meuPing} ms | Status Sync: ${syncInteligenteAtivo ? 'ON' : 'OFF'}`;
  });
}, 4000);

socket.on('room_error', (msg) => alert(msg));

socket.on('room_joined', ({ roomId, videoId, isHost }) => {
  emSala = true;
  souHost = isHost;

  lobbyCard.style.display = 'none';
  mainApp.style.display = 'flex';

  const papel = souHost ? '👑 Anfitrião' : '👀 Espectador';
  roomStatusDiv.innerText = `Lobby ativo: ${roomId} | Seu papel: ${papel}`;

  if (videoId) carregarVideoNoPlayer(videoId);
  else {
    statusDiv.innerText = souHost ? 'Status: Você é o anfitrião. Cole um vídeo!' : 'Status: Aguardando o vídeo...';
    statusDiv.style.color = '#ffb300';
  }
});

socket.on('promoted_to_host', () => {
  souHost = true;
  roomStatusDiv.innerText = `Lobby ativo: ${inputRoomId.value.trim()} | Seu papel: 👑 Anfitrião`;
  statusDiv.innerText = 'Status: Você se tornou o novo anfitrião da sala!';
  statusDiv.style.color = '#00e676';
  exibirNotificacao('👑 Você agora é o novo Anfitrião da sala!');
});

window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    playerVars: { 'playsinline': 1, 'autoplay': 0, 'controls': 1 },
    events: {
      'onReady': () => {
        playerPronto = true;
        if (pendingVideoId) carregarVideoNoPlayer(pendingVideoId);
      },
      'onStateChange': (event) => { playerState = event.data; }
    }
  });
};

function carregarVideoNoPlayer(videoId) {
  if (playerPronto && player && typeof player.loadVideoById === 'function') {
    player.loadVideoById(videoId);
    statusDiv.innerText = 'Status: Vídeo carregado!';
    statusDiv.style.color = '#00e676';
  } else pendingVideoId = videoId;
}

btnCarregar.addEventListener('click', () => {
  if (!emSala) return;
  const videoId = extractVideoID(inputVideoUrl.value.trim());
  if (videoId) { socket.emit('change_video', videoId); inputVideoUrl.value = ''; }
  else alert('Insira um link válido do YouTube!');
});

socket.on('sync_video', (videoId) => carregarVideoNoPlayer(videoId));

setInterval(() => {
  if (emSala && souHost && playerPronto && player && typeof player.getCurrentTime === 'function' && playerState === YT.PlayerState.PLAYING) {
    socket.emit('send_tempo', { tempo: player.getCurrentTime(), pingHost: meuPing });
  }
}, 1000);

socket.on('sync_tempo', ({ tempoHost, pingHost }) => {
  if (souHost || !syncInteligenteAtivo || !emSala || !playerPronto || !player || typeof player.getCurrentTime !== 'function') return;
  if (playerState !== YT.PlayerState.PLAYING) return;

  const latencia = ((pingHost / 2) + (meuPing / 2)) / 1000;
  const tempoRealHost = tempoHost + latencia;
  const diferenca = tempoRealHost - player.getCurrentTime();

  statusDiv.innerText = 'Status: Sync Constante Inteligente (Compensado) ⚡';
  statusDiv.style.color = '#00e676';

  if (Math.abs(diferenca) < 0.5) player.setPlaybackRate(1.0);
  else if (diferenca >= 0.5 && diferenca < 3.0) player.setPlaybackRate(1.05);
  else if (diferenca <= -0.5 && diferenca > -3.0) player.setPlaybackRate(0.95);
  else if (Math.abs(diferenca) >= 3.0) {
    player.seekTo(tempoRealHost, true);
    player.setPlaybackRate(1.0);
  }
});