const socket = io('https://stream-sync-server.onrender.com');

let player;
let playerState = -1;
let emSala = false;
let playerPronto = false;
let pendingVideoId = null;
let souHost = false;


let syncInteligenteAtivo = true;


let ultimoTempoConhecido = 0;
let ignorarProximoSeek = false;


let meuPing = 0; // ms


const lobbyCard = document.getElementById('lobby-card');
const mainApp = document.getElementById('main-app');
const statusDiv = document.getElementById('status');
const roomStatusDiv = document.getElementById('room-status');
const pingDisplay = document.getElementById('ping-display');
const toggleSync = document.getElementById('toggle-sync');

const tabCriar = document.getElementById('tab-criar');
const tabEntrar = document.getElementById('tab-entrar');

const inputRoomId = document.getElementById('input-room-id');
const inputRoomPass = document.getElementById('input-room-pass');

const btnCriarSala = document.getElementById('btn-criar-sala');
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
  const roomId = inputRoomId.value.trim();
  const password = inputRoomPass.value.trim();

  if (!roomId || !password) {
    alert('Preencha o nome da sala e a senha!');
    return;
  }

  socket.emit('join_room', { roomId, password, actionType });
}


function desativarSyncPorMoverBarra() {
  if (souHost || !syncInteligenteAtivo) return;

  syncInteligenteAtivo = false;
  toggleSync.checked = false;

  statusDiv.innerText = '⚠️ Sync Desativado: Você mexeu no tempo (Modo Livre). Clique em Re-Sync para voltar ao Anfitrião!';
  statusDiv.style.color = '#ffb300';
}


toggleSync.addEventListener('change', (e) => {
  syncInteligenteAtivo = e.target.checked;
  if (syncInteligenteAtivo) {
    statusDiv.innerText = 'Status: Sync Constante Inteligente ATIVADO ⚡';
    statusDiv.style.color = '#00e676';
  } else {
    statusDiv.innerText = 'Status: Sync Constante DESATIVADO (Modo Livre)';
    statusDiv.style.color = '#ffb300';
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

  if (videoId) {
    carregarVideoNoPlayer(videoId);
  } else {
    statusDiv.innerText = souHost 
      ? 'Status: Você é o anfitrião. Cole um vídeo para iniciar!' 
      : 'Status: Aguardando o anfitrião carregar um vídeo.';
    statusDiv.style.color = '#ffb300';
  }
});

socket.on('promoted_to_host', () => {
  souHost = true;
  roomStatusDiv.innerText = `Lobby ativo: ${inputRoomId.value.trim()} | Seu papel: 👑 Anfitrião`;
  statusDiv.innerText = 'Status: Você se tornou o novo anfitrião da sala!';
  statusDiv.style.color = '#00e676';
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


setInterval(() => {
  if (!playerPronto || !player || typeof player.getCurrentTime !== 'function' || souHost || !syncInteligenteAtivo) return;

  const tempoAtual = player.getCurrentTime();
  const diferencaComUltimoTempo = Math.abs(tempoAtual - ultimoTempoConhecido);


  if (ultimoTempoConhecido > 0 && diferencaComUltimoTempo > 2.5) {
    if (ignorarProximoSeek) {
      ignorarProximoSeek = false;
    } else {
      desativarSyncPorMoverBarra();
    }
  }

  ultimoTempoConhecido = tempoAtual;
}, 500);

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
  carregarVideoNoPlayer(videoId);
});


setInterval(() => {
  if (emSala && souHost && playerPronto && player && typeof player.getCurrentTime === 'function' && playerState === YT.PlayerState.PLAYING) {
    socket.emit('send_tempo', {
      tempo: player.getCurrentTime(),
      pingHost: meuPing
    });
  }
}, 1000);


socket.on('sync_tempo', ({ tempoHost, pingHost }) => {
  if (souHost || !syncInteligenteAtivo || !emSala || !playerPronto || !player || typeof player.getCurrentTime !== 'function') return;

  if (playerState !== YT.PlayerState.PLAYING) return;

  
  const atrasoHost = (pingHost / 2) / 1000;
  const atrasoEspectador = (meuPing / 2) / 1000;
  const tempoRealCalculadoHost = tempoHost + atrasoHost + atrasoEspectador;

  const tempoLocal = player.getCurrentTime();
  const diferenca = tempoRealCalculadoHost - tempoLocal;

  statusDiv.innerText = 'Status: Sync Constante Inteligente (Compensado) ⚡';
  statusDiv.style.color = '#00e676';

  if (Math.abs(diferenca) < 0.5) {
    player.setPlaybackRate(1.0);
  } else if (diferenca >= 0.5 && diferenca < 3.0) {
    player.setPlaybackRate(1.05);
  } else if (diferenca <= -0.5 && diferenca > -3.0) {
    player.setPlaybackRate(0.95);
  } else if (Math.abs(diferenca) >= 3.0) {
    ignorarProximoSeek = true; 
    player.seekTo(tempoRealCalculadoHost, true);
    player.setPlaybackRate(1.0);
  }
});


btnVoltar.addEventListener('click', () => {
  if (!playerPronto || !player || typeof player.getCurrentTime !== 'function') return;

  ignorarProximoSeek = true;
  player.seekTo(player.getCurrentTime() - 10, true);

  if (!souHost) {
    desativarSyncPorMoverBarra();
  }
});


btnSincronizar.addEventListener('click', () => {
  if (!playerPronto || !player) return;

  syncInteligenteAtivo = true;
  toggleSync.checked = true;
  player.setPlaybackRate(1.0);

  statusDiv.innerText = 'Status: Re-sincronizando com o Anfitrião...';
  statusDiv.style.color = '#00e676';
});