// 1. Conexão com o servidor hospedado no Render
const socket = io('https://stream-sync-server.onrender.com');

let player;
let modoLivre = false;
let playerState = -1;

const statusDiv = document.getElementById('status');
const btnVoltar = document.getElementById('btn-voltar');
const btnSincronizar = document.getElementById('btn-sincronizar');


const LIVE_VIDEO_ID = 'cctw1fn_630';


window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player('player', {
    height: '480',
    width: '854',
    videoId: LIVE_VIDEO_ID,
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
  statusDiv.innerText = 'Status: Pronto para sincronizar';
  statusDiv.style.color = '#00e676';
}

function onPlayerStateChange(event) {
  playerState = event.data;
}


setInterval(() => {
  if (player && typeof player.getCurrentTime === 'function' && playerState === YT.PlayerState.PLAYING) {
    const meuTempo = player.getCurrentTime();
    socket.emit('send_tempo', meuTempo);
  }
}, 1000);


socket.on('sync_tempo', (tempoHost) => {
  if (!player || typeof player.getCurrentTime !== 'function') return;


  if (modoLivre) {
    statusDiv.innerText = 'Status: Modo Livre (Desincronizado para rever lance)';
    statusDiv.style.color = '#ffb300';
    return;
  }

  
  if (playerState !== YT.PlayerState.PLAYING) return;

  statusDiv.innerText = 'Status: Sincronizado com o grupo';
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