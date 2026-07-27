const socket = io('https://stream-sync-server.onrender.com');

let player;
let modoLivre = false;
let playerState = -1;
let emSala = false;

const statusDiv = document.getElementById('status');
const roomStatusDiv = document.getElementById('room-status');
const btnVoltar = document.getElementById('btn-voltar');
const btnSincronizar = document.getElementById('btn-sincronizar');

const inputRoomId = document.getElementById('input-room-id');
const inputRoomPass = document.getElementById('input-room-pass');
const btnEntrarSala = document.getElementById('btn-entrar-sala');

const inputVideoUrl = document.getElementById('input-video-url');
const btnCarregar = document.getElementById('btn-carregar');

function extractVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|live\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Clique para entrar ou criar o lobby
btnEntrarSala.addEventListener('click', () => {
  const roomId = inputRoomId.value.trim();
  const password = inputRoomPass.value.trim();

  if (!roomId || !password) {
    alert('Por favor, digite o nome e a senha do lobby!');
    return;
  }

  socket.emit('join_room', { roomId, password });
});

// Erro de senha
socket.on('room_error', (msg) => {
  alert(msg);
});

// Sucesso ao entrar no lobby
socket.on('room_joined', ({ roomId, videoId }) => {
  emSala = true;
  roomStatusDiv.innerText = `Lobby ativo: ${roomId}`;
  statusDiv.innerText = 'Status: Conectado ao lobby!';
  statusDiv.style.color = '#00e676';

  if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById(videoId);
  }
});

// Inicialização do Player do YouTube
window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player('player', {
    height: '480',
    width: '854',
    videoId: 'cctw1fn_630',
    playerVars: {
      'playsinline': 1,
      'autoplay': 0,
      'controls': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
};

function onPlayerReady(event) {
  statusDiv.innerText = 'Status: Crie ou entre em um lobby para sincronizar';
  statusDiv.style.color = '#a8a8b3';
}

function onPlayerStateChange(event) {
  playerState = event.data;
}

// Trocar vídeo
btnCarregar.addEventListener('click', () => {
  if (!emSala) {
    alert('Entre em um lobby primeiro!');
    return;
  }

  const url = inputVideoUrl.value.trim();
  const videoId = extractVideoID(url);

  if (videoId) {
    socket.emit('change_video', videoId);
    inputVideoUrl.value = '';
  } else {
    alert('Por favor, insira um link válido do YouTube!');
  }
});

socket.on('sync_video', (videoId) => {
  if (player && typeof player.loadVideoById === 'function') {
    modoLivre = false;
    player.loadVideoById(videoId);
    statusDiv.innerText = 'Status: Novo vídeo carregado no lobby!';
    statusDiv.style.color = '#00e676';
  }
});

// Envia tempo
setInterval(() => {
  if (emSala && player && typeof player.getCurrentTime === 'function' && playerState === YT.PlayerState.PLAYING) {
    const meuTempo = player.getCurrentTime();
    socket.emit('send_tempo', meuTempo);
  }
}, 1000);

// Recebe tempo
socket.on('sync_tempo', (tempoHost) => {
  if (!emSala || !player || typeof player.getCurrentTime !== 'function') return;

  if (modoLivre) {
    statusDiv.innerText = 'Status: Modo Livre (Desincronizado)';
    statusDiv.style.color = '#ffb300';
    return;
  }

  if (playerState !== YT.PlayerState.PLAYING) return;

  statusDiv.innerText = 'Status: Sincronizado com o lobby';
  statusDiv.style.color = '#00e676';

  const tempoLocal = player.getCurrentTime();
  const diferenca = tempoHost - tempoLocal;

  if (Math.abs(diferenca) < 0.3) {
    player.setPlaybackRate(1.0);
  } 
  else if (diferenca >= 0.3 && diferenca < 3.0) {
    player.setPlaybackRate(1.1);
  } 
  else if (diferenca <= -0.3 && diferenca > -3.0) {
    player.setPlaybackRate(0.9);
  } 
  else if (Math.abs(diferenca) >= 3.0) {
    player.seekTo(tempoHost, true);
    player.setPlaybackRate(1.0);
  }
});

btnVoltar.addEventListener('click', () => {
  if (!player || typeof player.getCurrentTime !== 'function') return;
  modoLivre = true;
  const tempoAtual = player.getCurrentTime();
  player.seekTo(tempoAtual - 10, true);
});

btnSincronizar.addEventListener('click', () => {
  modoLivre = false;
  statusDiv.innerText = 'Status: Sincronizando...';
  statusDiv.style.color = '#00e676';
});