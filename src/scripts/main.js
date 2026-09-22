let selectedMode = 'free';
let activeGame = null;
const TARGET_RESCUES = 5;
const TIMED_SECONDS = 90;

const $id = id => document.getElementById(id);
const safePlay = audio => { if (audio) { const p = audio.play(); if (p && p.catch) p.catch(() => {}); } };

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
}

function updateModeUI() {
  const free = selectedMode === 'free';
  $id('modeTitle').textContent = free ? 'Missão livre' : 'Contra o relógio';
  $id('modeDescription').textContent = free
    ? 'Resgate 5 civis. Quanto mais rápido e com menos disparos perdidos, maior a pontuação final.'
    : 'Você tem 90 segundos. Resgate civis, elimine ameaças e evite desperdiçar disparos.';
  $id('timeLabel').textContent = free ? 'TEMPO' : 'RESTANTE';
  $id('statTime').textContent = free ? '00:00' : '01:30';
  $id('statRescues').textContent = free ? `0 / ${TARGET_RESCUES}` : '0';
}

function fitGame() {
  const viewport = $id('gameViewport');
  const container = $id('container');
  if (!viewport || !container) return;
  const scale = Math.min(1, viewport.clientWidth / 950);
  container.style.transform = `translateX(-50%) scale(${scale})`;
  viewport.style.height = `${630 * scale}px`;
}

function resetExternalStats() {
  $id('statScore').textContent = '0';
  $id('statErrors').textContent = '0';
  $id('statRescues').textContent = selectedMode === 'free' ? `0 / ${TARGET_RESCUES}` : '0';
  $id('statTime').textContent = selectedMode === 'timed' ? '01:30' : '00:00';
}

function setupPage() {
  const savedTheme = localStorage.getItem('resgate-theme') || 'dark';
  document.documentElement.dataset.theme = savedTheme;
  updateThemeIcon();

  document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', () => {
    if (activeGame && !activeGame.finished) return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    updateModeUI();
    resetExternalStats();
  }));

  $id('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('resgate-theme', next);
    updateThemeIcon();
  });

  const bindModal = (buttonId, modalId) => {
    const modal = $id(modalId);
    $id(buttonId).addEventListener('click', () => modal.showModal());
    modal.querySelector('.modal-close').addEventListener('click', () => modal.close());
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  };
  bindModal('aboutBtn','aboutModal');
  bindModal('howBtn','howModal');
  $id('startBtn').addEventListener('click', start);
  window.addEventListener('resize', fitGame);
  fitGame();
}

function updateThemeIcon() {
  const icon = $id('themeBtn')?.querySelector('i');
  if (!icon) return;
  icon.className = document.documentElement.dataset.theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}

document.addEventListener('DOMContentLoaded', setupPage);

function start() {
  if (activeGame && !activeGame.finished) return;
  $('#inicio, #fim').remove();
  $('#jogador,#inimigo1,#inimigo2,#amigo,#placar,#energia,#disparo,#explosao1,#explosao2,#explosao3,.mission-badge').remove();
  $('#fundoGame').append("<div class='mission-badge'>MISSÃO EM ANDAMENTO</div><div id='jogador' class='anima1'></div><div id='inimigo1' class='anima2'></div><div id='inimigo2'></div><div id='amigo' class='anima3'></div><div id='placar'></div><div id='energia'></div>");
  resetExternalStats();

  const jogo = { pressionou: [], finished:false };
  activeGame = jogo;
  const TECLA = { UP:38, DOWN:40, D:68 };
  let velocidade = 5, posicaoY = Math.floor(Math.random()*334), podeAtirar = true;
  let pontos = 0, salvos = 0, perdidos = 0, energiaAtual = 3, erros = 0;
  let shotHit = false, startTime = Date.now();
  const somDisparo=$id('somDisparo'), somExplosao=$id('somExplosao'), musica=$id('musica'), somGameover=$id('somGameover'), somPerdido=$id('somPerdido'), somResgate=$id('somResgate');

  $(document).off('.resgate').on('keydown.resgate', e => { jogo.pressionou[e.which]=true; }).on('keyup.resgate', e => { jogo.pressionou[e.which]=false; });
  musica.loop = true; musica.currentTime = 0; safePlay(musica);
  jogo.timer = setInterval(loop,30);
  jogo.clock = setInterval(updateClock,250);

  function elapsed(){ return (Date.now()-startTime)/1000; }
  function updateClock(){
    const e = elapsed();
    if(selectedMode==='timed'){
      const remaining = Math.max(0,TIMED_SECONDS-e);
      $id('statTime').textContent=formatTime(Math.ceil(remaining));
      if(remaining<=0) gameOver('Tempo encerrado');
    } else $id('statTime').textContent=formatTime(e);
  }
  function updateStats(){
    $id('statScore').textContent=Math.max(0,Math.round(pontos));
    $id('statErrors').textContent=erros;
    $id('statRescues').textContent=selectedMode==='free'?`${salvos} / ${TARGET_RESCUES}`:salvos;
  }
  function loop(){ moveFundo();moveJogador();moveInimigo1();moveInimigo2();moveAmigo();colisao();energia();updateStats(); }
  function moveFundo(){ const p=parseInt($('#fundoGame').css('background-position-x'))||0; $('#fundoGame').css('background-position-x',p-1); }
  function moveJogador(){
    let topo=parseInt($('#jogador').css('top'))||0;
    if(jogo.pressionou[TECLA.UP]) $('#jogador').css('top',Math.max(0,topo-10));
    if(jogo.pressionou[TECLA.DOWN]) $('#jogador').css('top',Math.min(434,topo+10));
    if(jogo.pressionou[TECLA.D]) disparo();
  }
  function moveInimigo1(){ let x=parseInt($('#inimigo1').css('left')); if(isNaN(x))return; $('#inimigo1').css({left:x-velocidade,top:posicaoY}); if(x<=0){posicaoY=Math.floor(Math.random()*334);$('#inimigo1').css({left:694,top:posicaoY});} }
  function moveInimigo2(){ let x=parseInt($('#inimigo2').css('left')); if(isNaN(x))return; $('#inimigo2').css('left',x-3); if(x<=0)$('#inimigo2').css('left',775); }
  function moveAmigo(){ let x=parseInt($('#amigo').css('left')); if(isNaN(x))return; $('#amigo').css('left',x+1); if(x>906)$('#amigo').css('left',0); }

  function disparo(){
    if(!podeAtirar||jogo.finished)return;
    safePlay(somDisparo); podeAtirar=false; shotHit=false;
    const topo=parseInt($('#jogador').css('top')), x=parseInt($('#jogador').css('left'));
    $('#fundoGame').append("<div id='disparo'></div>"); $('#disparo').css({top:topo+37,left:x+190});
    const shotTimer=setInterval(()=>{
      let sx=parseInt($('#disparo').css('left')); if(isNaN(sx)){clearInterval(shotTimer);podeAtirar=true;return;}
      $('#disparo').css('left',sx+15);
      if(sx>900){ clearInterval(shotTimer);$('#disparo').remove();if(!shotHit){erros++;pontos=Math.max(0,pontos-15);}podeAtirar=true;updateStats(); }
    },15);
  }

  function colisao(){
    if(jogo.finished)return;
    const c1=$('#jogador').collision($('#inimigo1')), c2=$('#jogador').collision($('#inimigo2'));
    const c3=$('#disparo').length?$('#disparo').collision($('#inimigo1')):[], c4=$('#disparo').length?$('#disparo').collision($('#inimigo2')):[];
    const c5=$('#jogador').collision($('#amigo')), c6=$('#inimigo2').collision($('#amigo'));
    if(c1.length){energiaAtual--;explosao1(parseInt($('#inimigo1').css('left')),parseInt($('#inimigo1').css('top')));posicaoY=Math.floor(Math.random()*334);$('#inimigo1').css({left:694,top:posicaoY});}
    if(c2.length){energiaAtual--;explosao2(parseInt($('#inimigo2').css('left')),parseInt($('#inimigo2').css('top')));$('#inimigo2').remove();reposicionaInimigo2();}
    if(c3.length){shotHit=true;velocidade+=.3;pontos+=100;explosao1(parseInt($('#inimigo1').css('left')),parseInt($('#inimigo1').css('top')));$('#disparo').remove();podeAtirar=true;posicaoY=Math.floor(Math.random()*334);$('#inimigo1').css({left:694,top:posicaoY});}
    if(c4.length){shotHit=true;pontos+=50;explosao2(parseInt($('#inimigo2').css('left')),parseInt($('#inimigo2').css('top')));$('#inimigo2,#disparo').remove();podeAtirar=true;reposicionaInimigo2();}
    if(c5.length){salvos++;pontos+=250;safePlay(somResgate);$('#amigo').remove();reposicionaAmigo();if(selectedMode==='free'&&salvos>=TARGET_RESCUES){const bonus=Math.max(0,2000-Math.floor(elapsed()*8)-erros*40);pontos+=bonus;updateStats();gameOver('Missão concluída');}}
    if(c6.length){perdidos++;pontos=Math.max(0,pontos-100);explosao3(parseInt($('#amigo').css('left')),parseInt($('#amigo').css('top')));$('#amigo').remove();reposicionaAmigo();}
  }
  function explosionBase(id,x,y,sound){safePlay(sound);$('#fundoGame').append(`<div id='${id}'></div>`);const d=$('#'+id);d.css({backgroundImage:'url(./src/assets/images/explosao.png)',top:y,left:x}).animate({width:200,opacity:0},'slow');setTimeout(()=>d.remove(),900);}
  function explosao1(x,y){explosionBase('explosao1',x,y,somExplosao)}
  function explosao2(x,y){explosionBase('explosao2',x,y,somExplosao)}
  function explosao3(x,y){safePlay(somPerdido);$('#fundoGame').append("<div id='explosao3' class='anima4'></div>");$('#explosao3').css({top:y,left:x});setTimeout(()=>$('#explosao3').remove(),900);}
  function reposicionaInimigo2(){setTimeout(()=>{if(!jogo.finished&&!$('#inimigo2').length)$('#fundoGame').append("<div id='inimigo2'></div>");},5000)}
  function reposicionaAmigo(){setTimeout(()=>{if(!jogo.finished&&!$('#amigo').length)$('#fundoGame').append("<div id='amigo' class='anima3'></div>");},1800)}
  function energia(){
    $('#energia').css('background-image',`url(./src/assets/images/energia${Math.max(0,energiaAtual)}.png)`);
    if(energiaAtual<=0)gameOver('Fim de missão');
  }
  function gameOver(title){
    if(jogo.finished)return; jogo.finished=true; clearInterval(jogo.timer);clearInterval(jogo.clock);$(document).off('.resgate');musica.pause();safePlay(somGameover);
    $('#jogador,#inimigo1,#inimigo2,#amigo,#disparo,.mission-badge').remove();
    const finalTime=Math.floor(elapsed()); updateStats();
    $('#fundoGame').append(`<div id="fim"><h1>${title}</h1><p>${title==='Missão concluída'?'Excelente trabalho. Você completou o objetivo!':'Confira seu desempenho e tente superar sua marca.'}</p><div class="result-stats"><span>Pontos<strong>${Math.max(0,Math.round(pontos))}</strong></span><span>Erros<strong>${erros}</strong></span><span>Tempo<strong>${formatTime(finalTime)}</strong></span></div><button id="reinicia" class="primary-btn" type="button"><i class="bi bi-arrow-repeat"></i> Jogar novamente</button></div>`);
    $('#reinicia').on('click',reiniciaJogo);
  }
}

function reiniciaJogo(){ const s=$id('somGameover');if(s){s.pause();s.currentTime=0;} $('#fim').remove(); start(); }
