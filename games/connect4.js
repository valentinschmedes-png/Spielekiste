// games/connect4.js
// Vier gewinnt: PvP + einfacher Bot, Speicherung & Verlauf
(function(){
  const boardEl = document.getElementById('connect4Board');
  const movesEl = document.getElementById('c4Moves');
  const statusEl = document.getElementById('c4Status');
  const turnEl = document.getElementById('c4TurnLabel');
  const histModal = document.getElementById('c4HistoryModal');
  const histContent = document.getElementById('c4HistoryContent');

  let state=null;

  const ROWS=6, COLS=7;

  function setupUI(){
    boardEl.innerHTML='';
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const cell = document.createElement('div');
        cell.className='c4-cell';
        cell.dataset.r=r; cell.dataset.c=c;
        cell.addEventListener('click', onCellClick);
        boardEl.appendChild(cell);
      }
    }
  }

  function render(){
    boardEl.querySelectorAll('.c4-cell').forEach(cell=>{
      const r=+cell.dataset.r, c=+cell.dataset.c;
      const v = state.grid[r][c];
      cell.classList.remove('red','yellow');
      if(v==='R') cell.classList.add('red');
      if(v==='Y') cell.classList.add('yellow');
    });
    movesEl.innerHTML='';
    state.moves.forEach((m,i)=>{
      const li=document.createElement('li'); li.textContent=m; movesEl.appendChild(li);
    });
    turnEl.textContent = state.turn==='R' ? 'Rot' : 'Gelb';
    statusEl.textContent = state.statusText || 'Wähle eine Spalte.';
  }

  function drop(col, token){
    for(let r=ROWS-1;r>=0;r--){
      if(!state.grid[r][col]){
        state.grid[r][col]=token;
        return r;
      }
    }
    return -1;
  }

  function winFrom(r,c, token){
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for(const [dr,dc] of dirs){
      let cnt=1;
      for(let k=1;k<4;k++){
        const rr=r+dr*k, cc=c+dc*k;
        if(rr<0||rr>=ROWS||cc<0||cc>=COLS) break;
        if(state.grid[rr][cc]===token) cnt++; else break;
      }
      for(let k=1;k<4;k++){
        const rr=r-dr*k, cc=c-dc*k;
        if(rr<0||rr>=ROWS||cc<0||cc>=COLS) break;
        if(state.grid[rr][cc]===token) cnt++; else break;
      }
      if(cnt>=4) return true;
    }
    return false;
  }

  function isFull(){
    for(let c=0;c<COLS;c++) if(!state.grid[0][c]) return false;
    return true;
  }

  function onCellClick(e){
    if(state.winner) return;
    if(state.mode==='pvb' && state.turn==='Y') return; // Bot dran
    const c = +e.currentTarget.dataset.c;
    humanMove(c);
  }

  function humanMove(c){
    const row = drop(c, state.turn);
    if(row===-1){ state.statusText='Spalte voll.'; render(); return; }
    state.moves.push(`${state.turn==='R'?'Rot':'Gelb'}: ${c+1}`);
    if(winFrom(row,c,state.turn
