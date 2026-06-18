// games/mill.js
// Neun-Menschen-Morris (Mühle): einfaches UI, PvP + einfacher Bot (regelkonform stark vereinfachter Gegner)
(function(){
  const boardEl = document.getElementById('millBoard');
  const movesEl = document.getElementById('millMoves');
  const statusEl = document.getElementById('millStatus');
  const turnEl = document.getElementById('millTurnLabel');
  const histModal = document.getElementById('millHistoryModal');
  const histContent = document.getElementById('millHistoryContent');

  // 24 Punkte-Indexierung (Standard)
  const points = [
    [5,5],[50,5],[95,5],
    [20,20],[50,20],[80,20],
    [35,35],[50,35],[65,35],

    [5,50],[20,50],[35,50],[65,50],[80,50],[95,50],
    [35,65],[50,65],[65,65],
    [20,80],[50,80],[80,80],
    [5,95],[50,95],[95,95]
  ]; // Prozent-Koordinaten für Positionierung

  // Nachbarschaften (vereinfachtes Standard-Adjazenz-Layout)
  const adj = {
    0:[1,9],    1:[0,2,4],     2:[1,14],
    3:[4,10],   4:[1,3,5,7],   5:[4,13],
    6:[7,11],   7:[4,6,8],     8:[7,12],
    9:[0,10,21],10:[3,9,11,18],11:[6,10,15],
    12:[8,13,17],13:[5,12,14,20],14:[2,13,23],
    15:[11,16], 16:[15,17,19], 17:[12,16],
    18:[10,19], 19:[16,18,20,22],20:[13,19],
    21:[9,22],  22:[19,21,23], 23:[14,22]
  };

  // Mühlen (Dreierreihen)
  const mills = [
    [0,1,2],[3,4,5],[6,7,8],
    [9,10,11],[12,13,14],[15,16,17],
    [18,19,20],[21,22,23],
    [0,9,21],[3,10,18],[6,11,15],
    [1,4,7],[16,19,22],[8,12,17],
    [5,13,20],[2,14,23]
  ];

  let state=null;

  function setupUI(){
    boardEl.innerHTML='';
    // Linien minimal: optional weglassen oder später via SVG ergänzen
    // Punkte rendern
    points.forEach((p,idx)=>{
      const n = document.createElement('div');
      n.className='node';
      n.style.left=p[0]+'%';
      n.style.top=p[1]+'%';
      n.dataset.i=idx;
      n.addEventListener('click', onNodeClick);
      boardEl.appendChild(n);
    });
  }

  function render(){
    // Steine rendern
    boardEl.querySelectorAll('.node').forEach(n=>{
      n.classList.remove('active');
      n.innerHTML='';
      const i = +n.dataset.i;
      const v = state.pos[i];
      if(v){
        const s = document.createElement('div');
        s.className='stone '+(v==='w'?'w':'b');
        s.style.width='14px'; s.style.height='14px'; s.style.borderRadius='50%';
        n.appendChild(s);
      }
    });
    turnEl.textContent = state.turn==='w'?'Weiß':'Schwarz';
    statusEl.textContent = state.statusText;
    movesEl.innerHTML='';
    state.moves.forEach((m,i)=>{
      const li=document.createElement('li');
      li.textContent=m;
      movesEl.appendChild(li);
    });
  }

  function inMill(pos, idx, color){
    return mills.some(m=> m.includes(idx) && m.every(k=>pos[k]===color));
  }

  function canRemoveOnlyNonMills(pos, colorOpp){
    // wenn Gegner-Steine existieren, die nicht in Mühlen stehen, müssen diese zuerst entfernt werden
    const oppIdx = pos.map((v,i)=>v===colorOpp?i:null).filter(v=>v!==null);
    const nonMill = oppIdx.filter(i=>!inMill(pos,i,colorOpp));
    return nonMill.length>0 ? nonMill : oppIdx; // wenn alle in Mühlen sind, darf jeder
  }

  function phase(){
    // 9 Steine pro Seite: erst setzen bis alle 9 gesetzt, dann bewegen, bei 3 Steinen springen
    const w = state.pos.filter(v=>v==='w').length + state.toPlace.w;
    const b = state.pos.filter(v=>v==='b').length + state.toPlace.b;
    if(state.toPlace.w>0 || state.toPlace.b>0) return 'placing';
    // danach bewegen
    if(state.count.w>3 && state.count.b>3) return 'moving';
    return 'flying'; // wenn jemand 3 hat
  }

  function legalMoves(pos, turn){
    const ph = phase();
    const fromTo=[];
    if(ph==='placing'){
      for(let i=0;i<24;i++){
        if(!pos[i]) fromTo.push({type:'place', to:i});
      }
    } else if(ph==='moving'){
      for(let i=0;i<24;i++){
        if(pos[i]===turn){
          for(const j of adj[i]){
            if(!pos[j]) fromTo.push({type:'move', from:i, to:j});
          }
        }
      }
    } else { // flying
      for(let i=0;i<24;i++){
        if(pos[i]===turn){
          for(let j=0;j<24;j++){
            if(!pos[j]) fromTo.push({type:'move', from:i, to:j});
          }
        }
      }
    }
    return fromTo;
  }

  function applyMove(pos, move, turn){
    const np = pos.slice();
    if(move.type==='place'){
      np[move.to]=turn;
    } else {
      np[move.from]='';
      np[move.to]=turn;
    }
    return np;
  }

  function other(t){return t==='w'?'b':'w';}

  function checkWin(){
    // verliert wenn <3 Steine oder keine legalen Züge
    const opp = other(state.turn);
    const wc = state.pos.filter(v=>'w'===v).length;
    const bc = state.pos.filter(v=>'b'===v).length;
    if(wc<3) return 'Schwarz gewinnt';
    if(bc<3) return 'Weiß gewinnt';
    const lm = legalMoves(state.pos, state.turn);
    if(lm.length===0) return (state.turn==='w'?'Schwarz':'Weiß')+' gewinnt (keine Züge)';
    return null;
  }

  function onNodeClick(e){
    if(state.winner) return;
    const i = +e.currentTarget.dataset.i;
    const t = state.turn;
    const ph = phase();

    if(state.removeMode){
      // Entfernen eines gegnerischen Steins nach Mühle
      if(state.pos[i]===other(t)){
        const allowed = canRemoveOnlyNonMills(state.pos, other(t));
        if(allowed.includes(i)){
          state.pos[i]='';
          state.count[other(t)]--;
          state.moves.push(`x${i}`);
          state.removeMode=false;
          state.turn = other(t);
          state.statusText = 'Zug beendet.';
          saveProgress();
          render();

          const win = checkWin();
          if(win){
            endGame(win);
            return;
          }

          // Bot?
          if(state.mode==='pvb' && state.turn==='b'){
            setTimeout(botStep, 250);
          }
        } else {
          state.statusText='Dieser Stein darf nicht entfernt werden.';
          render();
        }
      }
      return;
    }

    if(ph==='placing'){
      if(!state.pos[i]){
        if(t==='w' && state.toPlace.w>0){
          state.pos[i]='w'; state.toPlace.w--; state.count.w++;
          state.moves.push(`W:${i}`);
          // Mühle?
          if(inMill(state.pos, i, 'w')){
            state.statusText='Mühle! Entferne einen schwarzen Stein.';
            state.removeMode=true;
            render(); saveProgress(); return;
          }
          state.turn='b';
        } else if(t==='b' && state.toPlace.b>0){
          state.pos[i]='b'; state.toPlace.b--; state.count.b++;
          state.moves.push(`B:${i}`);
          if(inMill(state.pos, i, 'b')){
            state.statusText='Mühle! Entferne einen weißen Stein.';
            state.removeMode=true;
            render(); saveProgress(); return;
          }
          state.turn='w';
        }
        saveProgress();
        render();
        const win = checkWin();
        if(win){ endGame(win); return; }

        if(state.mode==='pvb' && state.turn==='b'){
          setTimeout(botStep, 250);
        }
      }
    } else {
      // moving/flying
      if(state.sel===null){
        if(state.pos[i]===t){ state.sel=i; state.statusText='Ziel wählen.'; render(); highlight(i,true); }
      } else {
        if(i===state.sel){ state.sel=null; state.statusText=''; render(); return; }
        // Move prüfen
        const phs = phase();
        const legal = (phs==='moving' ? adj[state.sel].includes(i) : true);
        if(legal && !state.pos[i]){
          const from = state.sel;
          state.pos[from]='';
          state.pos[i]=t;
          state.sel=null;
          state.moves.push(`${from}->${i}`);
          if(inMill(state.pos, i, t)){
            state.statusText='Mühle! Entferne einen gegnerischen Stein.';
            state.removeMode=true;
            render(); saveProgress(); return;
          }
          state.turn=other(t);
          state.statusText='Zug beendet.';
          saveProgress();
          render();
          const win = checkWin();
          if(win){ endGame(win); return; }

          if(state.mode==='pvb' && state.turn==='b'){
            setTimeout(botStep, 250);
          }
        } else {
          state.statusText='Ungültiger Zug.';
          render();
        }
      }
    }
  }

  function highlight(i, on){
    const node = boardEl.querySelector(`.node[data-i="${i}"]`);
    if(node) node.classList.toggle('active', !!on);
  }

  function endGame(text){
    state.winner=text;
    state.statusText=text;
    render();
    Store.pushHist('mill', {
      result: text,
      moves: state.moves.slice(),
      when: Date.now()
    });
    showHistory();
  }

  function showHistory(){
    const lines = state.moves.map((m,i)=> `${i+1}. ${m}`).join('\n');
    histContent.textContent = `${state.winner?`Ergebnis: ${state.winner}\n\n`:''}${lines || 'Kein Verlauf.'}`;
    histModal.classList.remove('hidden');
  }

  document.getElementById('millShowHistory').addEventListener('click', showHistory);
  document.getElementById('millHistoryClose').addEventListener('click',()=>{
    histModal.classList.add('hidden');
  });
  document.getElementById('millNew').addEventListener('click', ()=>{
    start(state.initCfg || {mode:'pvp'});
  });

  function botStep(){
    if(state.winner) return;
    // sehr einfacher Bot: Platzieren -> freie zufällige, Bewegen -> erster legaler, Priorität: Mühle bilden wenn möglich
    const t='b';
    const moves = legalMoves(state.pos, t);

    // Versuche Mühle zu bilden
    let chosen=null;
    for(const m of moves){
      const np = applyMove(state.pos, m, t);
      const idx = (m.type==='place'? m.to : m.to);
      if(inMill(np, idx, t)){ chosen = m; break; }
    }
    if(!chosen){
      // zufällige Auswahl
      chosen = moves[Math.floor(Math.random()*moves.length)];
    }
    if(!chosen){ endGame('Weiß gewinnt (Bot blockiert)'); return; }

    if(chosen.type==='place'){
      state.pos[chosen.to]='b'; state.toPlace.b--; state.count.b++;
      state.moves.push(`b:${chosen.to}`);
      if(inMill(state.pos, chosen.to, 'b')){
        // Entfernen
        const allowed = canRemoveOnlyNonMills(state.pos, 'w');
        const rem = allowed[Math.floor(Math.random()*allowed.length)];
        state.pos[rem]=''; state.count.w--;
        state.moves.push(`xb:${rem}`);
      }
      state.turn='w';
    }else{
      state.pos[chosen.from]=''; state.pos[chosen.to]='b';
      state.moves.push(`${chosen.from}->${chosen.to}`);
      if(inMill(state.pos, chosen.to, 'b')){
        const allowed = canRemoveOnlyNonMills(state.pos, 'w');
        const rem = allowed[Math.floor(Math.random()*allowed.length)];
        state.pos[rem]=''; state.count.w--;
        state.moves.push(`xb:${rem}`);
      }
      state.turn='w';
    }
    state.statusText='Zug beendet.';
    saveProgress();
    render();
    const win = checkWin();
    if(win) endGame(win);
  }

  function saveProgress(){
    const save = {
      pos: state.pos,
      toPlace: state.toPlace,
      count: state.count,
      turn: state.turn,
      moves: state.moves,
      mode: state.mode,
      winner: state.winner||null
    };
    Store.set('mill:active', save);
  }

  function loadProgress(){
    return Store.get('mill:active', null);
  }

  function start(cfg){
    Views.show('millView');
    setupUI();
    state = {
      pos: Array(24).fill(''),
      toPlace: {w:9, b:9},
      count: {w:0, b:0},
      turn: 'w',
      moves: [],
      mode: cfg.mode || 'pvp',
      sel: null,
      removeMode: false,
      statusText: 'Platzierungsphase.',
      winner: null
    };
    state.initCfg = cfg;
    // Fortsetzen?
    const saved = loadProgress();
    if(saved && saved.mode===state.mode && !saved.winner){
      Object.assign(state, saved);
      setupUI();
    }
    render();
    saveProgress();
  }

  window.MillGame = { start };
})();
