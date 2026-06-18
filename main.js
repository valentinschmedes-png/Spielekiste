// main.js
// Einfacher View-Router + Storage + Utilities
const Views = {
  show(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Back-Button sichtbar wenn nicht Home
    document.getElementById('backButton').style.visibility = id==='homeView' ? 'hidden' : 'visible';
    // Persistente letzte Ansicht optional
    if(id==='homeView') updateRecentList();
  }
};

function navByDataView(e){
  const btn = e.currentTarget;
  const view = btn.getAttribute('data-view');
  if(view) Views.show(view);
}

document.getElementById('backButton').addEventListener('click',()=>{
  // Zurück zum Hauptmenü
  Views.show('homeView');
});

document.querySelectorAll('[data-view]').forEach(el=>{
  el.addEventListener('click',navByDataView);
});

// Storage Helpers
const Store = {
  get(key, def=null){
    try{ return JSON.parse(localStorage.getItem(key)) ?? def }catch{ return def }
  },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  pushHist(game, record){
    const k = `history:${game}`;
    const arr = Store.get(k, []);
    arr.unshift(record);
    Store.set(k, arr.slice(0,50)); // max 50 Einträge
    // Update "Zuletzt gespielt"
    const recent = Store.get('recent', []);
    recent.unshift({game, when: Date.now(), result: record.result||null});
    Store.set('recent', recent.slice(0,10));
  }
};

function updateRecentList(){
  const root = document.getElementById('recentList');
  const recent = Store.get('recent', []);
  root.innerHTML = '';
  if(!recent.length){
    root.classList.add('empty');
    root.innerHTML = '<p class="hint">Noch keine Einträge.</p>';
    return;
  }
  root.classList.remove('empty');
  recent.forEach(r=>{
    const div = document.createElement('div');
    div.className='recent-item';
    const title = ({
      chess:'Schach',
      mill:'Mühle',
      solitaire:'Solitär',
      connect4:'Vier gewinnt'
    })[r.game] || r.game;
    const date = new Date(r.when).toLocaleString('de-DE');
    div.innerHTML = `<span>${title}</span><small class="hint">${date}${r.result?` — ${r.result}`:''}</small>`;
    root.appendChild(div);
  });
}

// Chess setup bindings
const chessModeSel = document.getElementById('chessMode');
const chessBotRow = document.getElementById('chessBotRow');
const chessDiffSel = document.getElementById('chessDifficulty');
const chessThemeSel = document.getElementById('chessTheme');

function updateChessBotRow(){
  chessBotRow.style.display = chessModeSel.value==='pvb' ? 'flex' : 'none';
}
chessModeSel.addEventListener('change', updateChessBotRow);
updateChessBotRow();

document.getElementById('startChess').addEventListener('click',()=>{
  const cfg = {
    mode: chessModeSel.value, // pvp | pvb
    difficulty: chessDiffSel.value, // easy|medium|hard
    theme: chessThemeSel.value // classic|green
  };
  window.ChessGame.start(cfg);
});

// Mühle
document.getElementById('startMill').addEventListener('click',()=>{
  const cfg = { mode: document.getElementById('millMode').value }; // pvp|pvb
  window.MillGame.start(cfg);
});

// Solitär
document.getElementById('solNew').addEventListener('click',()=>{
  window.SolitaireGame.newGame();
});

// Vier gewinnt
document.getElementById('startConnect4').addEventListener('click',()=>{
  const cfg = { mode: document.getElementById('connect4Mode').value }; // pvp|pvb
  window.Connect4Game.start(cfg);
});

// Initial load
Views.show('homeView');
updateRecentList();
