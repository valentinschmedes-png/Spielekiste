// games/chess.js
// Minimalistisches Schach mit Bot (leicht/mittel/schwer), Themes, Verlauf & Storage
(function(){
  const boardEl = document.getElementById('chessBoard');
  const movesEl = document.getElementById('chessMoves');
  const statusEl = document.getElementById('chessStatus');
  const turnEl = document.getElementById('chessTurnLabel');
  const histModal = document.getElementById('chessHistoryModal');
  const histContent = document.getElementById('chessHistoryContent');

  const PIECES = {
    'P':'♙','N':'♘','B':'♗','R':'♖','Q':'♕','K':'♔',
    'p':'♟','n':'♞','b':'♝','r':'♜','q':'♛','k':'♚'
  };

  let state = null;

  function defaultPosition(){
    return [
      ['r','n','b','q','k','b','n','r'],
      ['p','p','p','p','p','p','p','p'],
      ['','','','','','','',''],
      ['','','','','','','',''],
      ['','','','','','','',''],
      ['','','','','','','',''],
      ['P','P','P','P','P','P','P','P'],
      ['R','N','B','Q','K','B','N','R'],
    ];
  }

  function cloneBoard(b){ return b.map(r=>r.slice()); }

  function isWhite(piece){ return piece && piece === piece.toUpperCase(); }
  function isBlack(piece){ return piece && piece === piece.toLowerCase(); }
  function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

  function algebraic(r,c){ return 'abcdefgh'[c] + (8-r); }

  function setupUI(theme){
    boardEl.classList.remove('classic','green');
    boardEl.classList.add(theme==='green'?'green':'classic');
    boardEl.innerHTML='';
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const sq = document.createElement('div');
        sq.className='sq '+(((r+c)%2===0)?'light':'dark');
        sq.dataset.r=r; sq.dataset.c=c;
        boardEl.appendChild(sq);
      }
    }
  }

  function render(){
    const b = state.board;
    boardEl.querySelectorAll('.sq').forEach(sq=>{
      const r = +sq.dataset.r, c = +sq.dataset.c;
      const p = b[r][c];
      sq.innerHTML = '';
      sq.classList.remove('sel');
      if(p){
        const sp = document.createElement('div');
        sp.className='piece';
        sp.textContent = PIECES[p] || '?';
        sq.appendChild(sp);
      }
    });
    turnEl.textContent = state.turn==='w' ? 'Weiß' : 'Schwarz';
    statusEl.textContent = state.statusText || 'Bereit.';
    movesEl.innerHTML = '';
    state.moveList.forEach((m,i)=>{
      const li = document.createElement('li');
      li.textContent = m;
      movesEl.appendChild(li);
    });
  }

  function genPseudoMoves(board, turn){
    // sehr vereinfachter Zuggenerator: nur normale Züge (kein Rochade/En passant/Umwandlung voll)
    const moves=[];
    const dirs = {
      N:[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]],
      B:[[1,1],[1,-1],[-1,1],[-1,-1]],
      R:[[1,0],[-1,0],[0,1],[0,-1]],
      Q:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]],
      K:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]],
    };
    const isOwn = (p)=>p && ((turn==='w' && isWhite(p)) || (turn==='b' && isBlack(p)));
    const isOpp = (p)=>p && ((turn==='w' && isBlack(p)) || (turn==='b' && isWhite(p)));

    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const p = board[r][c];
        if(!p) continue;
        if(turn==='w' && !isWhite(p)) continue;
        if(turn==='b' && !isBlack(p)) continue;

        const addMove = (r1,c1,r2,c2, promo=null)=>{
          const cap = board[r2][c2]?true:false;
          moves.push({from:[r1,c1],to:[r2,c2],capture:cap,promo});
        };

        const lower = p.toLowerCase();
        if(lower==='p'){
          const dir = isWhite(p) ? -1 : 1;
          const startRow = isWhite(p) ? 6 : 1;
          // vorwärts
          const r1=r+dir, c1=c;
          if(inBounds(r1,c1) && !board[r1][c1]){
            addMove(r,c,r1,c1);
            // doppel
            if(r===startRow){
              const r2=r+2*dir;
              if(inBounds(r2,c) && !board[r2][c]) addMove(r,c,r2,c);
            }
          }
          // schlagen
          for(const dc of [-1,1]){
            const rr=r+dir, cc=c+dc;
            if(inBounds(rr,cc) && board[rr][cc] && isOpp(board[rr][cc])){
              addMove(r,c,rr,cc);
            }
          }
        } else if(lower==='n'){
          for(const [dr,dc] of dirs.N){
            const rr=r+dr, cc=c+dc;
            if(!inBounds(rr,cc)) continue;
            if(isOwn(board[rr][cc])) continue;
            addMove(r,c,rr,cc);
          }
        } else if(lower==='b' || lower==='r' || lower==='q'){
          const vecs = lower==='b'?dirs.B: lower==='r'?dirs.R: dirs.Q;
          for(const [dr,dc] of vecs){
            let rr=r+dr, cc=c+dc;
            while(inBounds(rr,cc)){
              if(isOwn(board[rr][cc])) break;
              addMove(r,c,rr,cc);
              if(board[rr][cc]) break; // stop bei capture
              rr+=dr; cc+=dc;
            }
          }
        } else if(lower==='k'){
          for(const [dr,dc] of dirs.K){
            const rr=r+dr, cc=c+dc;
            if(!inBounds(rr,cc)) continue;
            if(isOwn(board[rr][cc])) continue;
            addMove(r,c,rr,cc);
          }
        }
      }
    }
    return moves;
  }

  function applyMove(board, move){
    const b = cloneBoard(board);
    const [r1,c1] = move.from, [r2,c2] = move.to;
    const p = b[r1][c1];
    b[r1][c1]='';
    // Promotion (vereinfachte: immer zur Dame)
    if((p==='P' && r2===0) || (p==='p' && r2===7)){
      b[r2][c2] = isWhite(p) ? 'Q' : 'q';
    } else {
      b[r2][c2] = p;
    }
    return b;
  }

  function materialScore(board){
    const val = {'p':1,'n':3,'b':3,'r':5,'q':9,'k':0};
    let s=0;
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const p = board[r][c];
        if(!p) continue;
        const k = p.toLowerCase();
        const v = val[k]||0;
        s += isWhite(p)? v : -v;
      }
    }
    return s;
  }

  function isKingMissing(board, color){
    let king = color==='w'?'K':'k';
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      if(board[r][c]===king) return false;
    }
    return true;
  }

  function isTerminal(board){
    // Terminal wenn ein König fehlt oder keine Züge
    if(isKingMissing(board,'w')||isKingMissing(board,'b')) return true;
    return false;
  }

  function evaluate(board){
    // Material + kleiner Mobility-Term
    const mobW = genPseudoMoves(board,'w').length;
    const mobB = genPseudoMoves(board,'b').length;
    return materialScore(board) + 0.02*(mobW - mobB);
  }

  function nextTurn(t){ return t==='w'?'b':'w'; }

  function minimax(board, turn, depth, alpha, beta){
    if(depth===0 || isTerminal(board)){
      return {score:evaluate(board), move:null};
    }
    const moves = genPseudoMoves(board, turn);
    if(!moves.length){
      // Patt/Scheckmatt grob: bewerten
      return {score:evaluate(board), move:null};
    }
    let best = null;
    if(turn==='w'){
      let maxv = -Infinity, bestMove=null;
      for(const m of moves){
        const nb = applyMove(board,m);
        const res = minimax(nb, nextTurn(turn), depth-1, alpha, beta);
        if(res.score>maxv){ maxv=res.score; bestMove=m; }
        alpha = Math.max(alpha, res.score);
        if(beta<=alpha) break;
      }
      best = {score:maxv, move:bestMove};
    } else {
      let minv = Infinity, bestMove=null;
      for(const m of moves){
        const nb = applyMove(board,m);
        const res = minimax(nb, nextTurn(turn), depth-1, alpha, beta);
        if(res.score<minv){ minv=res.score; bestMove=m; }
        beta = Math.min(beta, res.score);
        if(beta<=alpha) break;
      }
      best = {score:minv, move:bestMove};
    }
    return best;
  }

  function botMoveEasy(board, turn){
    // Leicht: zufällig plus gelegentliche grobe Fehler (z.B. gib Material her)
    const moves = genPseudoMoves(board, turn);
    if(!moves.length) return null;
    // 30% absichtliche schlechte Züge: wähle Zug, der MaterialScore für die Seite verschlechtert
    if(Math.random()<0.3){
      let worst=null, worstVal = turn==='w'?Infinity:-Infinity;
      for(const m of moves){
        const nb = applyMove(board,m);
        const sc = evaluate(nb);
        if(turn==='w' && sc<worstVal){ worstVal=sc; worst=m; }
        if(turn==='b' && sc>worstVal){ worstVal=sc; worst=m; }
      }
      if(worst) return worst;
    }
    // sonst zufällig
    return moves[Math.floor(Math.random()*moves.length)];
  }

  function botMove(board, turn, level){
    if(level==='easy'){
      return botMoveEasy(board, turn);
    }
    const depth = level==='medium'? 2 : 3; // 3–4 ist mobil bereits ordentlich
    return minimax(board, turn, depth, -Infinity, Infinity).move;
  }

  function coordEq(a,b){ return a[0]===b[0] && a[1]===b[1]; }

  function onSquareClick(e){
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    if(state.winner){ return; }

    const piece = state.board[r][c];
    const turn = state.turn;

    const isOwnPiece = piece && ((turn==='w' && isWhite(piece)) || (turn==='b' && isBlack(piece)));

    if(isOwnPiece && state.mode!=='pvb' || (isOwnPiece && state.mode==='pvb' && ((turn==='w' && state.human==='w') || (turn==='b' && state.human==='b')))){
      // select
      state.sel = [r,c];
      highlightSel();
      return;
    }

    if(state.sel){
      const from = state.sel, to=[r,c];
      const legal = genPseudoMoves(state.board, turn).some(m=>coordEq(m.from,from)&&coordEq(m.to,to));
      if(legal){
        doHumanMove({from:from,to:to});
      } else {
        state.sel=null; highlightSel();
      }
    }
  }

  function highlightSel(){
    boardEl.querySelectorAll('.sq').forEach(sq=>sq.classList.remove('sel'));
    if(!state.sel) return;
    const key = `div.sq[data-r="${state.sel[0]}"][data-c="${state.sel[1]}"]`;
    const sq = boardEl.querySelector(key);
    if(sq) sq.classList.add('sel');
  }

  function moveAlgebra(move){
    return `${algebraic(move.from[0],move.from[1])}-${algebraic(move.to[0],move.to[1])}`;
  }

  function doMove(move, actor='human'){
    state.board = applyMove(state.board, move);
    state.moveList.push(moveAlgebra(move));
    state.turn = nextTurn(state.turn);
    state.statusText = '';
    state.sel=null;
    render();
    saveProgress();
  }

  function checkWinner(){
    if(isKingMissing(state.board,'w')) return 'Schwarz gewinnt';
    if(isKingMissing(state.board,'b')) return 'Weiß gewinnt';
    const moves = genPseudoMoves(state.board, state.turn);
    if(!moves.length) return 'Keine Züge — Remis';
    return null;
  }

  function afterMoveFlow(){
    const res = checkWinner();
    if(res){
      state.winner = res;
      state.statusText = res;
      render();
      Store.pushHist('chess', {
        result: res,
        moves: state.moveList.slice(),
        theme: state.theme,
        mode: state.mode,
        when: Date.now()
      });
      // Verlauf sofort anbieten
      showHistory();
      return true;
    }
    return false;
  }

  function doHumanMove(move){
    doMove(move,'human');
    if(afterMoveFlow()) return;

    if(state.mode==='pvb'){
      // Bot spielt, falls dran
      const botTurn = state.botColor;
      if(state.turn===botTurn){
        setTimeout(()=>{
          const m = botMove(state.board, state.turn, state.difficulty);
          if(m){
            doMove(m,'bot');
          }
          afterMoveFlow();
        }, 200); // kleine Verzögerung für UX
      }
    }
  }

  function showHistory(){
    const lines = state.moveList.map((m,i)=> `${i+1}. ${m}`).join('\n');
    histContent.textContent = `${state.winner?`Ergebnis: ${state.winner}\n\n`:''}${lines || 'Kein Verlauf.'}`;
    histModal.classList.remove('hidden');
  }

  document.getElementById('chessShowHistory').addEventListener('click', showHistory);
  document.getElementById('chessHistoryClose').addEventListener('click',()=>{
    histModal.classList.add('hidden');
  });

  document.getElementById('chessNew').addEventListener('click',()=>{
    start(state.initCfg || {mode:'pvp',difficulty:'easy',theme:'classic'});
  });
  document.getElementById('chessUndo').addEventListener('click',()=>{
    // Einfach: letzten Halbzug rückgängig
    if(state.moveList.length===0) return;
    // Da wir keine komplette Historie des Boards speichern, führen wir „brutal“ rückgängig aus:
    // Recompute from start minus last ply
    const plyToKeep = state.moveList.length - 1;
    const saved = state.savedPly || [];
    if(saved[plyToKeep]){
      state = JSON.parse(JSON.stringify(saved[plyToKeep]));
      render();
      saveProgress();
    }
  });
  document.getElementById('chessResign').addEventListener('click',()=>{
    state.winner = state.turn==='w'?'Schwarz gewinnt':'Weiß gewinnt';
    state.statusText = 'Aufgabe — ' + state.winner;
    render();
    Store.pushHist('chess', {
      result: state.winner,
      moves: state.moveList.slice(),
      theme: state.theme,
      mode: state.mode,
      when: Date.now()
    });
    showHistory();
  });

  function saveProgress(){
    // einfache Ply-Snapshots für Undo
    state.savedPly = state.savedPly || [];
    state.savedPly[state.moveList.length] = JSON.parse(JSON.stringify(state));
    const save = {
      board: state.board,
      turn: state.turn,
      moveList: state.moveList,
      mode: state.mode,
      difficulty: state.difficulty,
      theme: state.theme,
      human: state.human,
      botColor: state.botColor,
      winner: state.winner||null
    };
    Store.set('chess:active', save);
  }

  function loadProgress(){
    const s = Store.get('chess:active', null);
    if(!s) return null;
    return s;
  }

  function applySaved(s, cfg){
    state = {
      board: s.board,
      turn: s.turn,
      moveList: s.moveList || [],
      mode: s.mode || cfg.mode,
      difficulty: s.difficulty || cfg.difficulty,
      theme: s.theme || cfg.theme,
      human: s.human || 'w',
      botColor: s.botColor || 'b',
      savedPly: [],
      winner: s.winner || null
    };
    state.savedPly[state.moveList.length] = JSON.parse(JSON.stringify(state));
  }

  function bindBoardClicks(){
    boardEl.querySelectorAll('.sq').forEach(sq=>{
      sq.addEventListener('click', onSquareClick);
    });
  }

  function start(cfg){
    // init
    Views.show('chessView');
    state = {
      board: defaultPosition(),
      turn: 'w',
      moveList: [],
      mode: cfg.mode,
      difficulty: cfg.difficulty,
      theme: cfg.theme==='green'?'green':'classic',
      human: 'w',           // standard: Mensch spielt Weiß
      botColor: cfg.mode==='pvb' ? 'b' : null,
      savedPly: [],
      winner: null
    };
    state.initCfg = cfg;

    setupUI(state.theme);
    bindBoardClicks();
    render();
    saveProgress();
  }

  // Öffentliche API
  window.ChessGame = {
    start(cfg){
      // Theme setzen
      setupUI(cfg.theme==='green'?'green':'classic');
      // Prüfe gespeicherte Partie
      const saved = loadProgress();
      if(saved && saved.mode===cfg.mode && saved.theme===cfg.theme && saved.difficulty===cfg.difficulty){
        applySaved(saved, cfg);
        Views.show('chessView');
        setupUI(state.theme);
        bindBoardClicks();
        render();
      } else {
        start(cfg);
      }
    }
  };

})();
