const socket = io('https://stream-sync-server.onrender.com');

let player;
let modoLivre = false;
let playerState = -1;
let emSala = false;
let playerPronto = false;
let pendingVideoId = null;

const lobbyCard = document.getElementById('lobby-card');
const mainApp = document.getElementById('main-app');
const statusDiv = document.getElementById('status');
const roomStatusDiv = document.getElementById('room-status');

const inputRoomId = document.getElementById('input-room-id');
const inputRoomPass = document.getElementById('input-room-pass');
const btnEntrarSala = document.getElementById('btn-entrar-sala');

const inputVideoUrl = document.getElementById('input-video-url');
const btnCarregar = document.getElementById('btn-carregar');
const btnVoltar = document.getElementById('btn-voltar');
const btnSincronizar = document.getElementById('btn-sincronizar');

function extractVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|live\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}


btnEntrarSala.addEventListener('click', () => {
  const roomId = inputRoomId.value.trim();
  const password = inputRoomPass.value.trim();

  if (!roomId || !password) {
    alert('Preencha o nome da sala e a senha!');
    return;
  }

  socket.emit('join_room', { roomId, password });
});


socket.on('room_error', (msg) => {
  alert(msg);
});


socket.on('room_joined', ({ roomId, videoId }) => {
  emSala = true;
  lobbyCard.style.display = 'none'; 
  mainApp.style.display = 'flex';   
  roomStatusDiv.innerText = `Lobby ativo: ${roomId}`;

  if (videoId) {
    carregarVideoNoPlayer(videoId);
  } else {
    statusDiv.innerText = 'Status: Cole um link do YouTube para iniciar a transmissão.';
    statusDiv.style.color = '#ffb300';
  }
});


window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player('player', {
    height: '480',
    width: '854',
    playerVars: {
      'playsinline': 1,
      'autoplay': 0,
      'controls': 1
    },
    events: {
      'onReady': () => {
        playerPronto = true;
        if (pendingVideoId) {
          carregarVideoNoPlayer(pendingVideoId);
        }
      },
      'onStateChange': (event) => {
        playerState = event.data;
      }
    }
  });
};

function carregarVideoNoPlayer(videoId) {
  if (playerPronto && player && typeof player.loadVideoById === 'function') {
    player.loadVideoById(videoId);
    statusDiv.innerText = 'Status: Vídeo carregado!';
    statusDiv.style.color = '#00e676';
  } else {
    pendingVideoId = videoId;
  }
}


btnCarregar.addEventListener('click', () => {
  if (!emSala) return;

  const url = inputVideoUrl.value.trim();
  const videoId = extractVideoID(url);

  if (videoId) {
    socket.emit('change_video', videoId);
    inputVideoUrl.value = '';
  } else {
    alert('Insira um link válido do YouTube!');
  }
});

socket.on('sync_video', (videoId) => {
  modoLivre = false;
  carregarVideoNoPlayer(videoId);
});


setInterval(() => {
  if (emSala && playerPronto && player && typeof player.getCurrentTime === 'function' && playerState === YT.PlayerState.PLAYING) {
    socket.emit('send_tempo', player.getCurrentTime());
  }
}, 1000);

socket.on('sync_tempo', (tempoHost) => {
  if (!emSala || !playerPronto || !player || typeof player.getCurrentTime !== 'function') return;

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
  } else if (diferenca >= 0.3 && diferenca < 3.0) {
    player.setPlaybackRate(1.1);
  } else if (diferenca <= -0.3 && diferenca > -3.0) {
    player.setPlaybackRate(0.9);
  } else if (Math.abs(diferenca) >= 3.0) {
    player.seekTo(tempoHost, true);
    player.setPlaybackRate(1.0);
  }
});

btnVoltar.addEventListener('click', () => {
  if (!playerPronto || !player || typeof player.getCurrentTime !== 'function') return;
  modoLivre = true;
  player.seekTo(player.getCurrentTime() - 10, true);
});

btnSincronizar.addEventListener('click', () => {
  modoLivre = false;
  statusDiv.innerText = 'Status: Sincronizando...';
  statusDiv.style.color = '#00e676';
});