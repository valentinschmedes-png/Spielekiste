// games/solitaire.js
// Minimal-Klondike (1-Karte ziehen), Züge tracken & speichern
(function(){
  const boardEl = document.getElementById('solitaireBoard');
  const movesEl = document.getElementById('solitaireMoves');
  const statusEl = document.getElementById('solitaireStatus');
  const histModal = document.getElementById('solitaireHistoryModal');
  const histContent = document.getElementById('solitaireHistoryContent');

  let state=null;

  const SUITS=['♠','♥','♦','♣'];
  const RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  function deck(){
    const d=[];
    for(const s of SUITS) for(const r of RANKS) d.push({s,r});
    for(let i=d.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [d[i],d[j]]=[d[j],d[i]];
    }
    return d;
  }

  function setupUI(){
    boardEl.innerHTML='';
    // 7 Tableau-Spalten (T1..T7), 4 Foundation (F♠ F♥ F♦ F♣), Stock/Waste
    // Für ein kompaktes Layout nutzen wir einfache Platzhalter
    const areas = [
      {id:'stock', label:'Stock'},
      {id:'waste', label:'Ablage'},
      {id:'f1', label:'Stapel 1'}, {id:'f2', label:'Stapel 2'}, {id:'f3', label:'Stapel 3'}, {id:'f4', label:'Stapel 4'},
      {id:'t1', label:'T1'}, {id:'t2', label:'T2'}, {id:'t3', label:'T3'}, {id:'t4', label:'T4'}, {id:'t5', label:'T5'}, {id:'t6', label:'T6'}, {id:'t7', label:'T7'}
    ];
    areas.forEach(a=>{
      const col = document.createElement('div');
      col.className='playcol';
      col.id=a.id;
      col.dataset.area=a.id;
      col.addEventListener('click', onAreaClick);
      const label = document.createElement('div');
      label.className='hint'; label.textContent=a.label;
      col.appendChild(label);
      boardEl.appendChild(col);
    });
  }

  function render(){
    // simple render: zeigt nur Top-Karten an (vereinfachtes UI)
    ['stock','waste','f1','f2','f3','f4','t1','t2','t3','t4','t5','t6','t7'].forEach(a=>{
      const col = document.getElementById(a);
      [...col.querySelectorAll('.playcard')].forEach(e=>e.remove());
      const arr = state[a];
      if(!arr || arr.length===0) return;
      // zeige letzte Karte
      const k = arr[arr.length-1];
      const card = document.createElement('div');
      card.className='playcard';
      card.textContent = `${k.r}${k.s}`;
      col.appendChild(card);
    });
    movesEl.innerHTML='';
    state.moves.forEach((m,i)=>{
      const li=document.createElement('li'); li.textContent=m; movesEl.appendChild(li);
    });
    statusEl.textContent = state.statusText || 'Ziehe Karten, um Stapel zu sortieren.';
  }

  function canMoveToFoundation(card, f){
    if(!card) return false;
    const pile = state[f];
    if(pile.length===0) return card.r==='A';
    const top = pile[pile.length-1];
    return card.s===top.s && rankIndex(card.r)===rankIndex(top.r)+1;
  }
  function rankIndex(r){ return RANKS.indexOf(r); }

  function onAreaClick(e){
    const area = e.currentTarget.dataset.area;
    if(area==='stock'){
      // ziehe 1 Karte zur Ablage (waste)
      if(state.stock.length===0){
        // recycle waste
        state.stock = state.waste.reverse();
        state.waste = [];
        state.moves.push('Recycle Ablage -> Stock');
      } else {
        state.waste.push(state.stock.pop());
        state.moves.push('Stock -> Ablage');
      }
      save(); render(); checkWin(); return;
    }

    if(area==='waste'){
      // Versuche auf eine Foundation oder Tableau zu legen (vereinfachte Regeln)
      const card = state.waste[state.waste.length-1];
      if(!card) return;
      // Foundation first
      for(const f of ['f1','f2','f3','f4']){
        if(canMoveToFoundation(card, f)){
          state.waste.pop(); state[f].push(card);
          state.moves.push(`Ablage -> ${f.toUpperCase()}`);
          save(); render(); checkWin(); return;
        }
      }
      // simple tableau-move: lege auf beliebige leere T? oder wenn Rang -1 (vereinfachung)
      for(const t of ['t1','t2','t3','t4','t5','t6','t7']){
        const tab = state[t];
        if(tab.length===0){ state.waste.pop(); tab.push(card); state.moves.push(`Ablage -> ${t.toUpperCase()}`); save(); render(); return; }
        const top = tab[tab.length-1];
        if(rankIndex(top.r)===rankIndex(card.r)+1){
          state.waste.pop(); tab.push(card); state.moves.push(`Ablage -> ${t.toUpperCase()}`); save(); render(); return;
        }
      }
      state.statusText = 'Kein gültiger Zug von Ablage.';
      render();
    } else if(['f1','f2','f3','f4'].includes(area)){
      // nichts aktiv
      return;
    } else {
      // Tableau-Klick: versuche Karte zur Foundation
      const tab = state[area];
      if(!tab.length) return;
      const card = tab[tab.length-1];
      for(const f of ['f1','f2','f3','f4']){
        if(canMoveToFoundation(card, f)){
          tab.pop(); state[f].push(card);
          state.moves.push(`${area.toUpperCase()} -> ${f.toUpperCase()}`);
          save(); render(); checkWin(); return;
        }
      }
      state.statusText='Kein gültiger Zug.';
      render();
    }
  }

  function checkWin(){
    const totalFoundations = state.f1.length+state.f2.length+state.f3.length+state.f4.length;
    if(totalFoundations===52){
      state.statusText='Gewonnen! Alle Karten sortiert.';
      render();
      Store.pushHist('solitaire', {
        result: 'Gewonnen',
        moves: state.moves.slice(),
        when: Date.now()
      });
      showHistory();
    }
  }

  function newGame(){
    const d = deck();
    // Austeilen (vereinfachte Version: alles in stock, Tableau leer)
    const s = {
      stock: d,
      waste: [],
      f1:[],f2:[],f3:[],f4:[],
      t1:[],t2:[],t3:[],t4:[],t5:[],t6:[],t7:[],
      moves: [],
      statusText: ''
    };
    state = s;
    save();
    setupUI();
    render();
  }

  function save(){
    Store.set('solitaire:active', state);
  }
  function load(){
    return Store.get('solitaire:active', null);
  }

  function showHistory(){
    const lines = state.moves.map((m,i)=> `${i+1}. ${m}`).join('\n');
    histContent.textContent = `${lines || 'Kein Verlauf.'}`;
    histModal.classList.remove('hidden');
  }
  document.getElementById('solitaireShowHistory').addEventListener('click', showHistory);
  document.getElementById('solitaireHistoryClose').addEventListener('click', ()=> histModal.classList.add('hidden'));

  window.SolitaireGame = {
    newGame,
    start(){
      Views.show('solitaireView');
      setupUI();
      const saved = load();
      if(saved){ state=saved; render(); }
      else newGame();
    }
  };

  // Beim ersten Eingang von Ansicht (Knopf) wird start() in index gebunden
  document.getElementById('solNew').addEventListener('click',()=>{ /* handled in main.js */ });

  // Autostart wenn View geöffnet wird (über main.js 'data-view')
  document.querySelector('[data-view="solitaireView"]').addEventListener('click', ()=>{
    window.SolitaireGame.start();
  });
})();
