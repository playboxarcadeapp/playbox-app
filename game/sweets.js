// GEM MINE (formerly Sweet Swap): a mining match-3 with 100 replayable levels.
(function(){
  const { fmt, reduceMotion, ctx, mulberry, seedFrom, shuffle, shade } = PB;

  function createSweets(shell){
    const W = 480, H = 724, N = 8, CELL = 54, BX = (W - N*CELL)/2, BY = 178, BAR_Y = BY + N*CELL + 62, BAR_R = 29;
    const FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    const CHOC = '#2a1a10';
    const NAMES = ['Ruby','Topaz','Emerald','Sapphire','Amethyst','Amber'];
    const COLS = ['#ff2d55','#ffd23f','#26d971','#2f86ff','#b45cff','#ff8a1f'];
    let st = null, uid = 1;

    // ---------- Level design ----------
    function levelSpec(n, R){
      const colors = n <= 5 ? 5 : 6;
      let type = n === 1 ? 'score' : n === 2 ? 'collect' : n === 3 ? 'frost' : ['score','collect','frost','mix'][n % 4];
      if (type === 'mix' && n < 12) type = 'collect';
      let moves = n <= 3 ? 18 : Math.max(12, 22 - Math.floor(n / 8));
      const spec = { n, colors, type, moves, collect: null, frost: null, target: 0 };
      if (type === 'score') spec.target = Math.round(moves * 120 * (1 + n / 50) / 50) * 50;
      if (type === 'collect' || type === 'mix') {
        const kinds = n < 25 ? 1 : n < 60 ? 2 : 3;
        const pool = shuffle([...Array(colors).keys()], R).slice(0, kinds);
        const each = Math.round((kinds === 1 ? 15 + n * 0.45 : 11 + n * 0.3) * (type === 'mix' ? 0.75 : 1));
        spec.collect = {}; pool.forEach(t => spec.collect[t] = each);
      }
      if (type === 'frost' || type === 'mix') {
        moves += 4; spec.moves = moves;
        const count = Math.min(type === 'mix' ? 30 : 48, 12 + Math.floor(n * 0.55));
        const dbl = n < 20 ? 0 : Math.min(0.55, (n - 20) / 110);
        const f = Array.from({length:N}, () => Array(N).fill(0));
        let placed = 0, guard = 0;
        while (placed < count && guard++ < 500) {
          const r = Math.floor(R() * N), c = Math.floor(R() * N / 2);
          if (f[r][c]) continue;
          const layers = R() < dbl ? 2 : 1;
          f[r][c] = layers; f[r][N-1-c] = layers; placed += 2;
        }
        spec.frost = f;
      }
      spec.star2 = type === 'score' ? Math.round(spec.target * 1.3) : moves * 150;
      spec.star3 = type === 'score' ? Math.round(spec.target * 1.7) : moves * 230;
      return spec;
    }
    function dailySpec(R){
      return { n:'daily', colors: 6, type:'daily', moves: 25, collect:null, frost:null, target:0, star2: 1e9, star3: 1e9 };
    }

    // ---------- Board ----------
    const T = (r,c) => (r >= 0 && r < N && c >= 0 && c < N && st.grid[r][c] && !st.grid[r][c].dying) ? st.grid[r][c] : null;
    const kind = t => t && t.sp !== 'c' && t.t < 6 ? t.t : -1;
    function newTile(t, r, c, y){ return { t, sp:null, x:c, y: y == null ? r : y, sc:1, id: uid++, dying:false, clearT:0 }; }
    function randType(){ return Math.floor(st.rand() * st.spec.colors); }
    function fillBoard(){
      st.grid = Array.from({length:N}, () => Array(N).fill(null));
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
        let t, guard = 0;
        do { t = randType(); } while (guard++ < 20 && ((c >= 2 && st.grid[r][c-1].t === t && st.grid[r][c-2].t === t) || (r >= 2 && st.grid[r-1][c].t === t && st.grid[r-2][c].t === t)));
        st.grid[r][c] = newTile(t, r, c, r - N - 1);
      }
      if (!hasMove()) shuffleBoard();
    }
    function runAt(r, c){
      const k = kind(T(r,c)); if (k < 0) return false;
      let h = 1; for (let i=c-1; kind(T(r,i)) === k; i--) h++; for (let i=c+1; kind(T(r,i)) === k; i++) h++;
      if (h >= 3) return true;
      let v = 1; for (let i=r-1; kind(T(i,c)) === k; i--) v++; for (let i=r+1; kind(T(i,c)) === k; i++) v++;
      return v >= 3;
    }
    function swapCells(a, b){ const g = st.grid; const t = g[a[0]][a[1]]; g[a[0]][a[1]] = g[b[0]][b[1]]; g[b[0]][b[1]] = t; }
    function findMove(){
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) for (const [dr,dc] of [[0,1],[1,0]]) {
        const r2 = r+dr, c2 = c+dc; if (r2 >= N || c2 >= N) continue;
        const a = T(r,c), b = T(r2,c2); if (!a || !b) continue;
        if (a.sp === 'c' || b.sp === 'c' || (a.sp && b.sp)) return [[r,c],[r2,c2]];
        swapCells([r,c],[r2,c2]);
        const ok = runAt(r,c) || runAt(r2,c2);
        swapCells([r,c],[r2,c2]);
        if (ok) return [[r,c],[r2,c2]];
      }
      return null;
    }
    const hasMove = () => !!findMove();
    function shuffleBoard(){
      const tiles = []; for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (st.grid[r][c]) tiles.push(st.grid[r][c]);
      for (let tries = 0; tries < 60; tries++) {
        shuffle(tiles, Math.random);
        let i = 0; for (let r=0;r<N;r++) for (let c=0;c<N;c++) st.grid[r][c] = tiles[i++];
        let bad = false; for (let r=0;r<N && !bad;r++) for (let c=0;c<N;c++) if (runAt(r,c)) { bad = true; break; }
        if (!bad && hasMove()) break;
      }
      pop(W/2, BY + N*CELL/2, 'Shuffle!', '#ffd23f');
    }
    function findRuns(){
      const runs = [];
      for (let r=0;r<N;r++) { let c = 0; while (c < N) { const k = kind(T(r,c)); let e = c+1; if (k >= 0) while (e < N && kind(T(r,e)) === k) e++; if (k >= 0 && e - c >= 3) runs.push({ dir:'h', k, cells: Array.from({length:e-c}, (_,i) => [r, c+i]) }); c = e; } }
      for (let c=0;c<N;c++) { let r = 0; while (r < N) { const k = kind(T(r,c)); let e = r+1; if (k >= 0) while (e < N && kind(T(e,c)) === k) e++; if (k >= 0 && e - r >= 3) runs.push({ dir:'v', k, cells: Array.from({length:e-r}, (_,i) => [r+i, c]) }); r = e; } }
      return runs;
    }

    // ---------- Clearing ----------
    function damage(r, c){
      if (st.frost && st.frost[r][c] > 0) { st.frost[r][c]--; if (st.frost[r][c] === 0) st.frostLeft--; burst(r, c, '#c9ecff', 6); }
    }
    function clearSet(cells, keep){ if (PB.sfx) PB.sfx('gem', Math.min(1, (st.chain || 0) * 0.15));
      const queue = [...cells], seen = new Set();
      let n = 0;
      while (queue.length) {
        const [r,c] = queue.shift(); const key = r*N + c;
        if (r < 0 || r >= N || c < 0 || c >= N || seen.has(key)) continue;
        seen.add(key);
        if (keep && keep.has(key)) continue;
        const t = st.grid[r][c]; if (!t || t.dying) continue;
        t.dying = true; t.clearT = 0.25; n++;
        damage(r, c);
        if (t.sp !== 'c' && st.collect && st.collect[t.t] > 0) st.collect[t.t]--;
        burst(r, c, t.t >= 6 ? '#fff' : COLS[t.t], t.sp ? 12 : 6);
        if (t.sp === 'h') { for (let i=0;i<N;i++) queue.push([r,i]); beam(r, c, 'h'); }
        else if (t.sp === 'v') { for (let i=0;i<N;i++) queue.push([i,c]); beam(r, c, 'v'); }
        else if (t.sp === 'b') { for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) queue.push([r+dr,c+dc]); st.shake = 8; }
        else if (t.sp === 'c') { const k = commonKind(); for (let i=0;i<N;i++) for (let j=0;j<N;j++) if (kind(T(i,j)) === k) queue.push([i,j]); }
      }
      st.gems = (st.gems || 0) + n; addScore(n * 30 * (1 + Math.min(st.chain, 4) * 0.25));
      return n;
    }
    function commonKind(){
      const cnt = Array(6).fill(0);
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) { const k = kind(T(r,c)); if (k >= 0) cnt[k]++; }
      return cnt.indexOf(Math.max(...cnt));
    }
    function processRuns(runs, pivots){
      const keep = new Set(), creates = [];
      const runCells = new Set(); runs.forEach(rn => rn.cells.forEach(([r,c]) => runCells.add(r*N+c)));
      const pivotOf = rn => { for (const p of pivots || []) if (rn.cells.some(([r,c]) => r === p[0] && c === p[1])) return p; return rn.cells[Math.floor(rn.cells.length/2)]; };
      const used = new Set();
      runs.forEach((rn,i) => { if (rn.cells.length >= 5) { creates.push({ at: pivotOf(rn), sp:'c', k: rn.k }); used.add(i); } });
      runs.forEach((a,i) => runs.forEach((b,j) => {
        if (i >= j || used.has(i) || used.has(j) || a.dir === b.dir || a.k !== b.k) return;
        const shared = a.cells.find(([r,c]) => b.cells.some(([r2,c2]) => r === r2 && c === c2));
        if (shared) { creates.push({ at: shared, sp:'b', k: a.k }); used.add(i); used.add(j); }
      }));
      runs.forEach((rn,i) => { if (!used.has(i) && rn.cells.length === 4) creates.push({ at: pivotOf(rn), sp: rn.dir === 'h' ? 'v' : 'h', k: rn.k }); });
      creates.forEach(cr => keep.add(cr.at[0]*N + cr.at[1]));
      clearSet([...runCells].map(k => [Math.floor(k/N), k % N]), keep);
      creates.forEach(cr => {
        const t = st.grid[cr.at[0]][cr.at[1]]; if (!t) return;
        damage(cr.at[0], cr.at[1]);
        if (st.collect && st.collect[t.t] > 0) st.collect[t.t]--;
        if (t.sp && t.sp !== cr.sp) { clearSet([[cr.at[0], cr.at[1]]]); return; }
        t.sp = cr.sp; t.sc = 1.35; if (cr.sp === 'c') t.t = 6;
        addScore(cr.sp === 'c' ? 200 : cr.sp === 'b' ? 120 : 60);
      });
    }
    function gravity(){
      for (let c=0;c<N;c++) {
        let write = N - 1;
        for (let r=N-1;r>=0;r--) { const t = st.grid[r][c]; if (t && !t.dying) { st.grid[r][c] = null; st.grid[write][c] = t; write--; } else st.grid[r][c] = null; }
        let spawn = -1;
        for (let r=write;r>=0;r--) { st.grid[r][c] = newTile(randType(), r, c, spawn--); }
      }
    }
    function trySwap(a, b){ if (PB.sfx) PB.sfx('swap');
      if (st.busy || st.over) return;
      const A = T(...a), B = T(...b); if (!A || !B) return;
      st.sel = null; st.idle = 0; st.hint = null;
      swapCells(a, b); A.sc = B.sc = 1;
      st.moves--; st.chain = 0;
      // Special combos fire straight away
      if (A.sp === 'c' || B.sp === 'c') {
        st.busy = true; st.pendingCombo = { a: b, b: a, A, B }; return;
      }
      if (A.sp && B.sp) { st.busy = true; st.pendingCombo = { a: b, b: a, A, B }; return; }
      const ok = runAt(...a) || runAt(...b);
      if (!ok) { swapCells(a, b); st.moves++; st.wiggle = { a, b, t: 0.3 }; return; }
      st.busy = true; st.pivots = [a, b];
    }
    function fireCombo(){ if (PB.sfx) PB.sfx('boom');
      const { a, b, A, B } = st.pendingCombo; st.pendingCombo = null;
      const at = a; // where A now sits
      if (A.sp === 'c' && B.sp === 'c') { const all = []; for (let r=0;r<N;r++) for (let c=0;c<N;c++) all.push([r,c]); pop(W/2, BY + 200, 'Gem storm!', '#ffd23f'); clearSet(all); return; }
      if (A.sp === 'c' || B.sp === 'c') {
        const bombCell = A.sp === 'c' ? a : b, other = A.sp === 'c' ? B : A, k = other.t;
        const cells = [bombCell]; const bombTile = T(...bombCell); if (bombTile) bombTile.sp = 'spent';
        for (let r=0;r<N;r++) for (let c=0;c<N;c++) { const t = T(r,c); if (t && t.t === k && t.sp !== 'c') { if (other.sp === 'h' || other.sp === 'v') t.sp = Math.random() < .5 ? 'h' : 'v'; else if (other.sp === 'b') t.sp = 'b'; cells.push([r,c]); } }
        pop(W/2, BY + 200, 'Mega dig!', '#ffd23f');
        clearSet(cells); return;
      }
      const big = A.sp === 'b' && B.sp === 'b' ? 2 : 0;
      const wide = (A.sp === 'b') !== (B.sp === 'b') ? 1 : 0;
      const [r,c] = b; const cells = [];
      if (big) { for (let dr=-2;dr<=2;dr++) for (let dc=-2;dc<=2;dc++) cells.push([r+dr,c+dc]); }
      else for (let d=-wide; d<=wide; d++) for (let i=0;i<N;i++) { cells.push([r+d, i]); cells.push([i, c+d]); }
      A.sp = B.sp = null;
      pop(W/2, BY + 200, 'Kaboom!', '#ff8a1f');
      clearSet(cells.concat([a, b]));
    }
    // ---------- Power-ups (bought in the Swag Shop or found in gift boxes) ----------
    const boostList = () => (PB.meta && PB.meta.boostsFor && PB.meta.boostsFor('sweets')) || [];
    const boostN = id => (PB.meta && PB.meta.boostCount) ? PB.meta.boostCount(id) : 0;
    const boostX = i => W / 2 + (i - 1.5) * 106;
    function boostAt(x, y){ const L = boostList(); for (let i=0;i<L.length;i++) if (Math.hypot(x - boostX(i), y - BAR_Y) < BAR_R + 10) return L[i]; return null; }
    function pressBoost(b){
      if (st.busy || st.over || st.finishing) return;
      if (st.tool === b.id) { st.tool = null; if (PB.sfx) PB.sfx('tap'); return; }
      if (boostN(b.id) <= 0) { pop(W/2, BAR_Y - 46, 'Get more in the Swag Shop!', '#ffd23f', 1.6); if (PB.sfx) PB.sfx('nope'); return; }
      st.sel = null; st.hint = null; st.idle = 0;
      if (b.id === 'pickaxe' || b.id === 'lightning') { st.tool = b.id; if (PB.sfx) PB.sfx('pick'); return; }
      if (!PB.meta.useBoost(b.id)) return;
      st.boostFlash = { id: b.id, t: 0.6 };
      if (b.id === 'moves5') { st.moves += 5; pop(70, 150, '+5 moves!', '#7dff6a', 1.6); if (PB.sfx) PB.sfx('power'); }
      else if (b.id === 'dynamite') {
        const cand = []; for (let r=0;r<N;r++) for (let c=0;c<N;c++) { const t = T(r,c); if (t && !t.sp && t.t < 6) cand.push([r,c]); }
        shuffle(cand, Math.random); cand.slice(0, 3).forEach(([r,c]) => { const t = st.grid[r][c]; t.sp = 'b'; t.sc = 1.6; burst(r, c, '#ff8a1f', 10); });
        pop(W/2, BY + 200, 'Dynamite!', '#ff8a1f'); if (PB.sfx) PB.sfx('power');
      }
    }
    function useTool(r, c){
      const id = st.tool; st.tool = null;
      if (!PB.meta.useBoost(id)) return;
      st.boostFlash = { id, t: 0.6 }; st.chain = 0; st.busy = true; st.sel = null; st.hint = null;
      if (id === 'pickaxe') { st.shake = 7; pop(BX + c*CELL + CELL/2, BY + r*CELL, 'Smash!', '#ffd23f'); if (PB.sfx) PB.sfx('crash'); clearSet([[r, c]]); }
      else { const cells = []; for (let i=0;i<N;i++) { cells.push([r, i]); cells.push([i, c]); } beam(r, c, 'h'); beam(r, c, 'v'); st.shake = 10; pop(W/2, BY + 200, 'Zap!', '#9ae6ff'); if (PB.sfx) PB.sfx('boom'); clearSet(cells); }
    }
    function drawBoosts(){
      const L = boostList(); if (!L.length) return;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // a little shelf the buttons sit on
      ctx.fillStyle = 'rgba(40,10,80,.55)'; ctx.beginPath(); ctx.roundRect(22, BAR_Y - BAR_R - 9, W - 44, BAR_R * 2 + 18, 24); ctx.fill();
      ctx.strokeStyle = 'rgba(255,216,106,.8)'; ctx.lineWidth = 2.5; ctx.stroke();
      L.forEach((b, i) => {
        const x = boostX(i), y = BAR_Y, n = boostN(b.id), on = st.tool === b.id, fl = st.boostFlash && st.boostFlash.id === b.id ? st.boostFlash.t / 0.6 : 0;
        const rr = BAR_R * (1 + fl * 0.18 + (on ? 0.06 * Math.sin(st.time * 10) : 0));
        if (on || fl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(x, y, 4, x, y, rr * 1.9); gg.addColorStop(0, 'rgba(255,240,150,.9)'); gg.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, rr * 1.9, 0, 7); ctx.fill(); ctx.restore(); }
        const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.4, 2, x, y, rr); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, b.sw[0]); g.addColorStop(1, b.sw[1]);
        ctx.globalAlpha = n > 0 || on ? 1 : 0.45;
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
        ctx.lineWidth = 3.5; ctx.strokeStyle = on ? '#fff36a' : '#ffffff'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = CHOC; ctx.beginPath(); ctx.arc(x, y, rr + 2.5, 0, 7); ctx.stroke();
        ctx.font = `${Math.round(rr * 1.05)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(b.ic, x, y + 2);
        ctx.globalAlpha = 1;
        // count badge (a green plus when you have none)
        const bx = x + rr * 0.78, by = y - rr * 0.72; ctx.fillStyle = n > 0 ? '#ff3d6e' : '#2fb36b'; ctx.beginPath(); ctx.arc(bx, by, 11, 0, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.font = `700 13px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(n > 0 ? String(Math.min(n, 99)) : '+', bx, by + 1);
      });
      if (st.tool) {
        const txt = st.tool === 'pickaxe' ? 'Tap a gem to smash it!' : 'Tap a gem to zap its row and column!';
        ctx.font = `700 17px ${FONT}`; const w = ctx.measureText(txt).width + 28, y = BY - 2;
        ctx.fillStyle = '#fff36a'; ctx.beginPath(); ctx.roundRect(W/2 - w/2, y - 15, w, 30, 15); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = CHOC; ctx.stroke();
        ctx.fillStyle = CHOC; ctx.fillText(txt, W/2, y + 1);
      }
      ctx.restore();
    }
    function goalsMet(){
      const s = st.spec;
      if (s.type === 'daily') return false;
      if (s.type === 'score') return st.score >= s.target;
      let ok = true;
      if (st.collect) ok = ok && Object.values(st.collect).every(v => v <= 0);
      if (st.frost) ok = ok && st.frostLeft <= 0;
      return ok;
    }
    function settled(){
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) { const t = st.grid[r][c]; if (!t) continue; if (t.dying || Math.abs(t.x - c) > 0.01 || Math.abs(t.y - r) > 0.01) return false; }
      return true;
    }
    function resolveStep(){
      if (st.pendingCombo) { fireCombo(); return; }
      let anyDying = false;
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (st.grid[r][c] && st.grid[r][c].dying) anyDying = true;
      if (anyDying) { gravity(); return; }
      const runs = findRuns();
      if (runs.length) {
        st.chain++; st.maxChain = Math.max(st.maxChain || 0, st.chain);
        if (st.chain === 2) pop(W/2, BY - 26, 'Shiny!', '#5ce1ff');
        if (st.chain === 3) pop(W/2, BY - 26, 'Sparkly!', '#ffd23f');
        if (st.chain >= 4) pop(W/2, BY - 26, 'Gem-tastic!', '#d07bff');
        processRuns(runs, st.pivots); st.pivots = null; return;
      }
      st.busy = false; st.pivots = null;
      if (st.finishing) { finishWin(); return; }
      if (goalsMet()) { startFinish(); return; }
      if (st.moves <= 0) { endLevel(false); return; }
      if (!hasMove()) shuffleBoard();
    }
    function startFinish(){
      st.finishing = true; st.busy = true;
      st.bonusMoves = st.moves;
      pop(W/2, BY + 180, 'Level complete!', '#ffd23f', 1.6);
      if (st.moves > 0) pop(W/2, BY + 230, `${st.moves} moves left = bonus gems!`, '#7dff6a', 2.2);
    }
    function finishWin(){
      if (st.bonusMoves > 0) {
        // Every move you saved turns into a bonus treat that pops.
        st.bonusMoves--; st.moves--;
        addScore(150);
        let r, c, guard = 0; do { r = Math.floor(Math.random()*N); c = Math.floor(Math.random()*N); } while (guard++ < 30 && (!T(r,c) || T(r,c).sp));
        const t = T(r,c); if (t) { t.sp = Math.random() < .5 ? 'h' : 'v'; t.sc = 1.4; }
        st.busy = true; st.bonusDelay = 0.18;
        st.queueClear = [[r,c]];
        return;
      }
      st.finishing = false;
      endLevel(true);
    }
    function endLevel(win){
      if (st.over) return;
      st.over = true;
      const s = st.spec;
      if (s.type === 'daily') { shell.gameOver(st.score, `You scored ${fmt(st.score)} in ${s.moves} moves`); return; }
      const stars = !win ? 0 : st.score >= s.star3 ? 3 : st.score >= s.star2 ? 2 : 1;
      const summary = win ? (stars === 3 ? 'Perfect bake!' : stars === 2 ? 'Great baking!' : 'You did it!') : goalText() + ' still to go';
      shell.levelDone({ win, stars, score: st.score, summary });
    }
    function goalText(){
      const s = st.spec;
      if (s.type === 'score') return `${fmt(Math.max(0, s.target - st.score))} points`;
      const parts = [];
      if (st.collect) for (const k in st.collect) if (st.collect[k] > 0) parts.push(`${st.collect[k]} ${NAMES[k].toLowerCase()}${st.collect[k] > 1 ? 's' : ''}`);
      if (st.frost && st.frostLeft > 0) parts.push(`${st.frostLeft} rock tiles`);
      return parts.join(' and ') || 'A little more';
    }
    function addScore(n){ st.score += Math.round(n); }
    function burst(r, c, color, n){
      if (reduceMotion) return;
      const x = BX + c*CELL + CELL/2, y = BY + r*CELL + CELL/2;
      for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, s = 60 + Math.random()*140; st.parts.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 80, life: .55, color, r: 3 + Math.random()*3 }); }
      const c3 = color === '#fff' ? [1, 1, 1] : hex3(color); st.sparks = st.sparks || [];
      for (let i=0;i<n + 3;i++){ const a = Math.random()*Math.PI*2, s = 40 + Math.random()*160; st.sparks.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 60, life: 0.7, max: 0.7, col: i % 2 ? [1, 1, 1] : c3, size: 10 + Math.random() * 14 }); }
      st.sparks.push({ x, y, vx: 0, vy: 0, life: 0.3, max: 0.3, col: c3, size: CELL * 2.2, ring: true });
    }
    function beam(r, c, dir){ st.beams.push({ r, c, dir, life: .3 }); }
    function pop(x, y, text, color, life){ st.pops.push({ x, y, text, color, life: life || 1.1 }); }

    function fresh(mode, rand, level){
      const spec = mode === 'daily' ? dailySpec(rand) : levelSpec(level, mulberry(seedFrom('sweets-' + level)));
      st = { mode, spec, rand: mode === 'daily' ? rand : mulberry(seedFrom('sweets-board-' + level)), moves: spec.moves, score: 0, chain: 0, busy: true,
        collect: spec.collect ? { ...spec.collect } : null, frost: spec.frost ? spec.frost.map(r => r.slice()) : null, frostLeft: 0,
        parts: [], pops: [], beams: [], sel: null, drag: null, idle: 0, hint: null, wiggle: null, time: 0, shake: 0, over: false, phase:'play' };
      if (st.frost) st.frostLeft = st.frost.flat().filter(v => v > 0).length;
      fillBoard();
    }

    function update(dt){
      st.time += dt;
      const fall = dt * 13;
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
        const t = st.grid[r][c]; if (!t) continue;
        const dx = c - t.x, dy = r - t.y;
        t.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 9);
        t.y += Math.sign(dy) * Math.min(Math.abs(dy), fall);
        if (t.sc > 1) t.sc = Math.max(1, t.sc - dt * 2);
        if (t.dying) { t.clearT -= dt; if (t.clearT <= 0) t.clearT = 0; }
      }
      if (st.queueClear) {
        st.bonusDelay -= dt;
        if (st.bonusDelay <= 0) { const q = st.queueClear; st.queueClear = null; clearSet(q); }
      } else if (st.busy) {
        let doneDying = true;
        for (let r=0;r<N;r++) for (let c=0;c<N;c++) { const t = st.grid[r][c]; if (t && t.dying && t.clearT > 0) doneDying = false; }
        let moving = false;
        for (let r=0;r<N;r++) for (let c=0;c<N;c++) { const t = st.grid[r][c]; if (t && !t.dying && (Math.abs(t.x - c) > 0.01 || Math.abs(t.y - r) > 0.01)) moving = true; }
        if (doneDying && !moving) resolveStep();
      } else if (!st.over) {
        st.idle += dt;
        if (st.idle > 5 && !st.hint) st.hint = findMove();
      }
      if (st.wiggle) { st.wiggle.t -= dt; if (st.wiggle.t <= 0) st.wiggle = null; }
      if (st.boostFlash) { st.boostFlash.t -= dt; if (st.boostFlash.t <= 0) st.boostFlash = null; }
      for (const q of st.parts) { q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 520*dt; q.life -= dt; }
      if (st.sparks) { for (const q of st.sparks) { q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 260*dt; q.vx *= 0.97; q.life -= dt; } st.sparks = st.sparks.filter(q => q.life > 0); }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.y -= 30*dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      for (const b of st.beams) b.life -= dt;
      st.beams = st.beams.filter(b => b.life > 0);
      st.shake = Math.max(0, st.shake - dt * 30);
    }

    // ---------- Drawing ----------
    function ol(g, w){ g.strokeStyle = CHOC; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; }
    // ---------- Gems ----------
    // Each gem has its own outline shape, so kids can tell them apart by shape as well as color.
    const GEM_SHAPES = (() => {
      const poly = (n, r, rot = -Math.PI / 2, sy = 1) => Array.from({ length: n }, (_, i) => { const a = rot + i / n * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r * sy]; });
      const heart = []; for (let i=0;i<20;i++) { const t = i / 20 * Math.PI * 2; heart.push([1.15 * Math.pow(Math.sin(t), 3) * 16, -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 1.15 - 2]); }
      return [
        heart,                                                       // ruby
        [[0, -19], [19, 15], [-19, 15]],                             // topaz (trillion)
        [[-9, -19], [9, -19], [15, -12], [15, 12], [9, 19], [-9, 19], [-15, 12], [-15, -12]], // emerald cut
        [[0, -21], [16, 0], [0, 21], [-16, 0]],                      // sapphire (kite)
        poly(12, 18),                                                // amethyst (round brilliant)
        poly(6, 19, 0),                                              // amber (hexagon)
        poly(8, 19, -Math.PI / 8),                                   // prism diamond (colour bomb)
      ];
    })();
    function gemPath(g, pts, k){ g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.closePath(); }
    function pastry(g, t, cx, cy, s){
      const pts = GEM_SHAPES[t], col = t === 6 ? '#e8f6ff' : COLS[t];
      g.save(); g.translate(cx, cy); g.scale(s, s);
      // soft drop shadow
      g.save(); g.translate(1.5, 3); g.fillStyle = 'rgba(0,0,0,.35)'; gemPath(g, pts, 1); g.fill(); g.restore();
      // facets: a ring of quads between the outline and the inner "table"
      const inner = pts.map(([x, y]) => [x * 0.52, y * 0.52 - 2]);
      for (let i=0;i<pts.length;i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], c2 = inner[(i + 1) % pts.length], d = inner[i];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, l = Math.hypot(mx, my) || 1;
        const lit = (-mx / l * 0.6 - my / l * 0.8);
        g.fillStyle = shade(col, lit * 0.45 - 0.05);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
      }
      if (t === 6) { const rg = g.createLinearGradient(-15, -15, 15, 15); COLS.forEach((c, i) => rg.addColorStop(i / 5, c)); g.fillStyle = rg; g.globalAlpha = 0.55; gemPath(g, pts, 1); g.fill(); g.globalAlpha = 1; }
      const tg = g.createLinearGradient(-10, -12, 10, 10); tg.addColorStop(0, shade(col, 0.55)); tg.addColorStop(1, shade(col, 0.05));
      g.fillStyle = tg; gemPath(g, inner, 1); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; for (let i=0;i<pts.length;i++) { g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(inner[i][0], inner[i][1]); g.stroke(); }
      g.strokeStyle = shade(col, -0.65); g.lineWidth = 2; g.lineJoin = 'round'; gemPath(g, pts, 1); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(inner[0][0] * 0.4 - 5, inner[0][1] * 0.3 - 3, 4.5, 2.2, -0.6, 0, 7); g.fill();
      // occasional twinkle
      const tt = ((st && st.time) || 0) * 1.3 + cx * 0.013 + cy * 0.007, tw = Math.max(0, Math.sin(tt * 2.3) - 0.85) * 6.7;
      if (tw > 0) { g.fillStyle = `rgba(255,255,255,${tw})`; star(g, 7, -8, 6 * tw + 1, 1.2); g.fill(); }
      g.restore();
    }
    function star(g, cx, cy, ro, ri){ g.beginPath(); for (let i=0;i<10;i++){ const a = -Math.PI/2 + i*Math.PI/5, r = i%2 ? ri : ro; g.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r); } g.closePath(); }
    function drawTile(t, cx, cy, s){
      if (!t.sp || t.sp === 'spent') { pastry(ctx, t.t, cx, cy, s); return; }
      const time = st.time || 0, pulse = 1 + Math.sin(time * 5 + cx * 0.05) * 0.06;
      const auraCol = t.sp === 'c' ? '220,170,255' : t.sp === 'b' ? '255,140,40' : '90,225,255';
      ctx.fillStyle = `rgba(${auraCol},.28)`; ctx.beginPath(); ctx.roundRect(cx - 21 * s, cy - 21 * s, 42 * s, 42 * s, 10 * s); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createRadialGradient(cx, cy, 4, cx, cy, 30 * s); grd.addColorStop(0, `rgba(${auraCol},.7)`); grd.addColorStop(0.55, `rgba(${auraCol},.25)`); grd.addColorStop(1, `rgba(${auraCol},0)`);
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, 30 * s, 0, 7); ctx.fill(); ctx.restore();
      if (t.sp === 'c') {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 1.5);
        for (let i=0;i<12;i++) { ctx.fillStyle = COLS[i % 6]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 25 * s, i / 12 * Math.PI * 2, (i + 1) / 12 * Math.PI * 2); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = '#2a201a'; ctx.beginPath(); ctx.arc(cx, cy, 20 * s, 0, 7); ctx.fill();
      }
      ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse); ctx.translate(-cx, -cy);
      if (t.sp === 'b') {
        // strapped to a bundle of dynamite
        ctx.save(); ctx.translate(cx, cy);
        for (const dx of [-11, 0, 11]) { ctx.fillStyle = '#e53935'; ctx.strokeStyle = CHOC; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.roundRect((dx - 5) * s, -18 * s, 10 * s, 36 * s, 4 * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect((dx - 3) * s, -15 * s, 2.5 * s, 28 * s); }
        ctx.restore();
      }
      pastry(ctx, t.sp === 'c' ? 6 : t.t, cx, cy, s * (t.sp === 'b' ? 0.85 : 1));
      if (t.sp === 'h' || t.sp === 'v') {
        ctx.save(); ctx.translate(cx, cy); if (t.sp === 'v') ctx.rotate(Math.PI / 2);
        const bg = ctx.createLinearGradient(0, -6 * s, 0, 6 * s); bg.addColorStop(0, 'rgba(200,250,255,.95)'); bg.addColorStop(0.5, '#ffffff'); bg.addColorStop(1, 'rgba(90,225,255,.95)');
        ctx.fillStyle = bg; ctx.strokeStyle = '#0b6f9a'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.roundRect(-20 * s, -4.5 * s, 40 * s, 9 * s, 4.5 * s); ctx.fill(); ctx.stroke();
        const off = 3 * Math.sin(time * 8) * s;
        for (const d of [-1, 1]) { ctx.fillStyle = '#5ce1ff'; ctx.strokeStyle = '#0b6f9a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(d * (31 * s + off), 0); ctx.lineTo(d * (22 * s + off), -8 * s); ctx.lineTo(d * (22 * s + off), 8 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      }
      if (t.sp === 'b') {
        ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(cx, cy - 18 * s); ctx.quadraticCurveTo(cx + 6 * s, cy - 26 * s, cx + 2 * s, cy - 30 * s); ctx.stroke();
        const fl = 0.7 + Math.random() * 0.3; ctx.fillStyle = '#fff3a0'; star(ctx, cx + 2 * s, cy - 31 * s, 6 * fl * s, 2 * s); ctx.fill(); ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.arc(cx + 2 * s, cy - 31 * s, 2.2 * s, 0, 7); ctx.fill();
      }
      ctx.restore();
      for (let k=0;k<3;k++) { const a = time * 2 + k * 2.1, r = 24 * s, tw = 0.5 + 0.5 * Math.sin(time * 6 + k * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.5 + tw * 0.5})`; star(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, (3 + tw * 2.5) * s, 1.2 * s); ctx.fill(); }
    }
    function goalIcon(kind, x, y, s){
      if (kind === 'frost') { rockTile(x - 17*s, y - 17*s, 34*s, 2); }
      else pastry(ctx, kind, x, y, s);
    }
    function rockTile(x, y, w, f){
      const g = ctx, rg = g.createLinearGradient(x, y, x + w, y + w); rg.addColorStop(0, f > 1 ? '#3a3f4c' : '#5a4434'); rg.addColorStop(1, f > 1 ? '#101218' : '#22170f');
      g.fillStyle = rg; g.beginPath(); g.moveTo(x + w * 0.15, y); g.lineTo(x + w * 0.8, y + w * 0.04); g.lineTo(x + w, y + w * 0.35); g.lineTo(x + w * 0.94, y + w * 0.9); g.lineTo(x + w * 0.3, y + w); g.lineTo(x, y + w * 0.7); g.lineTo(x + w * 0.04, y + w * 0.2); g.closePath(); g.fill();
      g.strokeStyle = '#2a1a10'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(30,18,10,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + w * 0.3, y + w * 0.2); g.lineTo(x + w * 0.5, y + w * 0.5); g.lineTo(x + w * 0.4, y + w * 0.8); g.moveTo(x + w * 0.5, y + w * 0.5); g.lineTo(x + w * 0.8, y + w * 0.6); if (f > 1) { g.moveTo(x + w * 0.7, y + w * 0.15); g.lineTo(x + w * 0.62, y + w * 0.4); } g.stroke();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(x + w * 0.3, y + w * 0.2, w * 0.12, w * 0.05, -0.4, 0, 7); g.fill();
    }
    let caveC = null;
    // A bright, sparkly crystal cavern (candy-colored, so the gems really pop)
    function paintCave(){
      const [c, g] = PB.layer(W, H), R = mulberry(5);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#5a2d8c'); bg.addColorStop(0.45, '#8a4fc0'); bg.addColorStop(1, '#2f6fc0'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // soft light pouring in from a hole in the cave roof
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let k=0;k<5;k++) { const x = W * (0.2 + k * 0.16), lg = g.createLinearGradient(x, 0, x + 60, H); lg.addColorStop(0, 'rgba(255,240,200,.16)'); lg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(x - 20, 0); g.lineTo(x + 30, 0); g.lineTo(x + 140, H); g.lineTo(x + 40, H); g.closePath(); g.fill(); }
      const top = g.createRadialGradient(W / 2, -40, 10, W / 2, -40, 380); top.addColorStop(0, 'rgba(255,230,255,.45)'); top.addColorStop(1, 'rgba(255,230,255,0)'); g.fillStyle = top; g.fillRect(0, 0, W, 380);
      g.restore();
      // rounded cave rocks around the edges
      for (let i=0;i<46;i++) { const side = i % 2 ? 1 : -1, x = side > 0 ? W - R() * 70 : R() * 70, y = R() * H, r = 26 + R() * 40; const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 4, x, y, r); rg.addColorStop(0, '#9a7ad0'); rg.addColorStop(1, '#3d2470'); g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, r, r * 0.8, R(), 0, 7); g.fill(); }
      // the cave walls go soft-focus so the board and the crystals in front pop
      { const cp = document.createElement('canvas'); cp.width = c.width; cp.height = c.height; cp.getContext('2d').drawImage(c, 0, 0); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); PB.soften(g, cp, 0, 0, c.width, c.height, 5); g.restore(); }
      // glowing crystal clusters
      const crystal = (x, y, h, col, lean) => { g.save(); g.translate(x, y); g.rotate(lean); const w = h * 0.32; const cg = g.createLinearGradient(-w, 0, w, 0); cg.addColorStop(0, shade(col, 0.45)); cg.addColorStop(0.5, col); cg.addColorStop(1, shade(col, -0.35)); g.fillStyle = cg; g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w, -h * 0.75); g.lineTo(0, -h); g.lineTo(w, -h * 0.75); g.lineTo(w, 0); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-w * 0.4, -h * 0.1); g.lineTo(-w * 0.4, -h * 0.72); g.lineTo(0, -h * 0.94); g.stroke(); g.restore(); };
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x, y, col] of [[40, H - 30, '#ff5fb0'], [W - 46, H - 40, '#5fe0ff'], [36, 160, '#b88cff'], [W - 34, 210, '#ffd25f'], [W / 2, H - 6, '#7dff9a']]) { const gg = g.createRadialGradient(x, y - 30, 4, x, y - 30, 110); gg.addColorStop(0, col + '88'); gg.addColorStop(1, col + '00'); g.fillStyle = gg; g.fillRect(x - 110, y - 140, 220, 220); }
      g.restore();
      for (const [x, y, col, s0] of [[40, H - 30, '#ff5fb0', 1], [W - 46, H - 40, '#5fe0ff', 1.1], [36, 160, '#b88cff', 0.7], [W - 34, 210, '#ffd25f', 0.7], [W / 2, H - 6, '#7dff9a', 0.8]]) for (let k=0;k<4;k++) crystal(x + (k - 1.5) * 14 * s0, y, (40 + R() * 40) * s0, col, (k - 1.5) * 0.28);
      for (let i=0;i<70;i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.6})`; const x = R() * W, y = R() * H, r = R() * 1.6 + 0.4; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      caveC = c;
    }
    // flat stone tiles that sit under the gems (two-hit rock has iron bands)
    let rockTex = null;
    function rockTileCanvas(f){
      const [c, g] = PB.layer(64, 64), R = mulberry(f * 31);
      const base = f > 1 ? ['#3a3f4c', '#101218'] : ['#5a4434', '#22170f'];
      const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]); g.fillStyle = gr; g.beginPath(); g.roundRect(1, 1, 62, 62, 10); g.fill();
      // cobbles
      for (let i=0;i<7;i++) { const x = 10 + R() * 44, y = 10 + R() * 44, r = 8 + R() * 6; g.fillStyle = `rgba(${f > 1 ? '0,0,0' : '10,5,0'},.3)`; g.beginPath(); g.ellipse(x, y, r, r * 0.75, R(), 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(x - 2, y - 3, r * 0.5, r * 0.25, R(), 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 3; g.beginPath(); g.roundRect(2.5, 2.5, 59, 59, 9.5); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(5, 5, 54, 54, 8); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(12, 16); g.lineTo(26, 30); g.lineTo(20, 46); g.moveTo(26, 30); g.lineTo(46, 36); if (f > 1) { g.moveTo(44, 10); g.lineTo(40, 24); } g.stroke();
      if (f > 1) { g.fillStyle = '#1c1f26'; g.fillRect(1, 20, 62, 6); g.fillRect(1, 40, 62, 6); g.fillStyle = '#9aa0ac'; for (const y of [23, 43]) for (const x of [8, 32, 56]) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } }
      return c;
    }
    function lantern(x, y){
      const t = st.time || 0, fl = 0.85 + Math.sin(t * 9 + x) * 0.08 + Math.sin(t * 23 + x) * 0.04;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(x, y, 2, x, y, 90 * fl); lg.addColorStop(0, 'rgba(255,190,90,.55)'); lg.addColorStop(0.3, 'rgba(255,150,60,.18)'); lg.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = lg; ctx.fillRect(x - 90, y - 90, 180, 180); ctx.restore();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 12); ctx.stroke();
      ctx.fillStyle = '#3a2a1e'; ctx.fillRect(x - 8, y - 14, 16, 4); ctx.fillRect(x - 8, y + 10, 16, 4);
      ctx.fillStyle = `rgba(255,${200 + 30 * fl},120,.95)`; ctx.beginPath(); ctx.roundRect(x - 6, y - 10, 12, 20, 4); ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 10, 12, 20);
    }
    // ---------- 3D look: real cut gems on the board, lit by the two mine lanterns ----------
    let E3 = null, A3 = null, boardC = null;
    function gemGeo(t){
      const G = E3.G, pts = GEM_SHAPES[t].map(([x, y]) => [x, -y]);
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const ring = (k, z) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k, z]);
      const girdle = ring(1, 0), band = ring(1, -2.5), bezel = ring(0.8, 6), table = ring(0.5, 10), apex = [cx, cy, -13], top = [cx, cy, 10];
      const tris = [], n = pts.length, C = [cx, cy, -1];
      const tri = (a, b, c) => { const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2]; const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx; const mx = (a[0]+b[0]+c[0])/3 - C[0], my = (a[1]+b[1]+c[1])/3 - C[1], mz = (a[2]+b[2]+c[2])/3 - C[2]; if (nx*mx + ny*my + nz*mz < 0) tris.push(a, c, b); else tris.push(a, b, c); };
      const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
      for (let i=0;i<n;i++) { const j = (i + 1) % n;
        quad(girdle[i], girdle[j], bezel[j], bezel[i]); quad(bezel[i], bezel[j], table[j], table[i]); tri(table[i], table[j], top);
        quad(band[i], band[j], girdle[j], girdle[i]); tri(band[i], band[j], apex); }
      const P = [], N = [], U = [], I = [];
      for (let k=0;k<tris.length;k+=3) { const [a, b, c] = [tris[k], tris[k+1], tris[k+2]]; const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2]; let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx; const l = Math.hypot(nx, ny, nz) || 1;
        for (const v of [a, b, c]) { P.push(v[0] - cx, v[1] - cy, v[2]); N.push(nx / l, ny / l, nz / l); U.push(0, 0); I.push(P.length / 3 - 1); } }
      const g = { p: P, n: N, uv: U, idx: I };
      if (t === 6) { g.col = []; for (let k=0;k<P.length/9;k++) { const c = COLS[k % 6], v = [parseInt(c.slice(1,3),16)/255, parseInt(c.slice(3,5),16)/255, parseInt(c.slice(5,7),16)/255].map(x => Math.pow(x * 0.9 + 0.05, 2.2)); for (let q=0;q<3;q++) g.col.push(v[0], v[1], v[2], 1); } }
      return g;
    }
    function assets3D(){
      if (A3) return A3; if (A3 === false) return null;
      E3 = PB.gl3d && PB.gl3d.get(); if (!E3) { A3 = false; return null; }
      const G = E3.G, M = E3.M;
      const rockG = G.faceted(G.displace(G.sphere(1, 9, 7), (x, y, z) => PB.gl3d.fbm(x * 1.7 + 3, y * 1.7, z * 1.7, 3) * 0.35));
      const ring = G.torus(1, 0.09, 48, 8); ring.col = []; for (let i=0;i<ring.p.length/3;i++) { const c = COLS[Math.floor(i / 9 / 8 * 6) % 6]; ring.col.push(...[c.slice(1,3), c.slice(3,5), c.slice(5,7)].map(h => Math.pow(parseInt(h, 16) / 255, 2.2)), 1); }
      A3 = { gems: GEM_SHAPES.map((_, t) => E3.mesh(gemGeo(t))), rock: E3.mesh(rockG), stick: E3.mesh(G.cylinder(1, 1, 1, 18)), bar: E3.mesh(G.merge([G.transform(G.cylinder(1, 1, 1, 20, false), M.trs([0,0,0], [0,0,Math.PI/2])), G.transform(G.sphere(1, 16, 12), M.trs([0.5,0,0])), G.transform(G.sphere(1, 16, 12), M.trs([-0.5,0,0]))])),
        cone: E3.mesh(G.cylinder(0, 1, 1, 16, true)), ring: E3.mesh(ring), ringPlain: E3.mesh(G.torus(1, 0.1, 40, 8)), tile: E3.mesh(G.roundBox(1, 1, 1, 0.12, 3)), tBoard: null };
      return A3;
    }
    const hex3 = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
    function paintBoard(){
      const [c, g] = PB.layer(W, H);
      if (!caveC) paintCave();
      g.drawImage(caveC, 0, 0, W, H);
      const x0 = BX - 12, y0 = BY - 12, bw = N * CELL + 24;
      g.fillStyle = 'rgba(30,10,60,.35)'; g.beginPath(); g.roundRect(x0 + 3, y0 + 8, bw, bw, 22); g.fill();
      const fk = PB.meta && PB.meta.look('sweets', 'frame'), FC = fk === 'frame_candy' ? ['#ffd0e8', '#ff8fc4', '#e0559a'] : fk === 'frame_ice' ? ['#e8fbff', '#9ae6ff', '#4fa8e0'] : ['#ffe08a', '#f2b13c', '#c7801f']; boardKeyFrame = fk;
      const fg = g.createLinearGradient(0, y0, 0, y0 + bw); fg.addColorStop(0, FC[0]); fg.addColorStop(0.5, FC[1]); fg.addColorStop(1, FC[2]);
      g.fillStyle = fg; g.beginPath(); g.roundRect(x0, y0, bw, bw, 22); g.fill(); g.strokeStyle = '#7a4a12'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.roundRect(x0 + 4, y0 + 4, bw - 8, bw - 8, 18); g.stroke();
      for (let k=0;k<12;k++) { const t = k / 12; for (const [px, py] of [[x0 + 6 + t * (bw - 12), y0 + 6], [x0 + 6 + t * (bw - 12), y0 + bw - 6], [x0 + 6, y0 + 6 + t * (bw - 12)], [x0 + bw - 6, y0 + 6 + t * (bw - 12)]]) { g.fillStyle = 'rgba(255,250,220,.9)'; g.beginPath(); g.arc(px, py, 1.8, 0, 7); g.fill(); } }
      g.fillStyle = 'rgba(70,30,110,.55)'; g.beginPath(); g.roundRect(BX - 3, BY - 3, N*CELL + 6, N*CELL + 6, 12); g.fill();
      for (let r=0;r<N;r++) for (let cc=0;cc<N;cc++) {
        const tx = BX + cc*CELL + 1.5, ty = BY + r*CELL + 1.5, sz = CELL - 3;
        const cg = g.createLinearGradient(tx, ty, tx, ty + sz); const light = (r + cc) % 2 === 0;
        cg.addColorStop(0, light ? 'rgba(255,255,255,.88)' : 'rgba(236,226,255,.80)'); cg.addColorStop(1, light ? 'rgba(240,232,255,.82)' : 'rgba(214,200,250,.74)');
        g.fillStyle = cg; g.beginPath(); g.roundRect(tx, ty, sz, sz, 9); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.roundRect(tx + 4, ty + 3, sz - 8, 3, 2); g.fill();
        g.fillStyle = 'rgba(120,90,180,.18)'; g.beginPath(); g.roundRect(tx + 4, ty + sz - 6, sz - 8, 3, 2); g.fill();
      }
      boardC = c;
    }
    let boardKeyFrame = null;
    function draw3D(tile){
      const E = E3, M = E.M, P3 = E.px;
      if (boardC && boardKeyFrame !== ((PB.meta && PB.meta.look('sweets', 'frame')) || null)) { boardC = null; A3.tBoard = null; }
      if (!boardC) paintBoard();
      if (!A3.tBoard) A3.tBoard = E.texture(boardC, { repeat: false });
      E.resize(W, H, tile ? 1 : E.quality(1.5));
      const sx = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0, sy = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0;
      E.begin({ ortho: [W, H], pos: [-sx, sy, 1500], target: [-sx, sy, 0] }, {
        noSky: true, sunDir: [0.5, -0.7, -0.5], sunColor: [1.25, 1.2, 1.15], ambSky: [0.5, 0.48, 0.58], ambGround: [0.3, 0.26, 0.34], toon: 0.25,
        shadow: { center: [W / 2, -(BY + N * CELL / 2), 0], radius: 300 },
        post: { bloom: 0.45, threshold: 0.88, saturation: 1.22, contrast: 1.08, vignette: 0.22 },
      });
      E.backdrop(A3.tBoard, W, H, { shadow: 0.38 });
      E.light(P3(W / 2, BY - 40, 260), [0.9, 0.85, 1.0], 700);
      const time = st.time || 0;
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
        const f = st.frost ? st.frost[r][c] : 0;
        if (f > 0) { const x = BX + c * CELL + CELL / 2, y = BY + r * CELL + CELL / 2; if (!rockTex) rockTex = [null, E.texture(rockTileCanvas(1), { repeat: false }), E.texture(rockTileCanvas(2), { repeat: false })]; E.draw(A3.tile, M.trs(P3(x, y, 2), [0, 0, 0], [CELL - 4, CELL - 4, 6]), { tex: rockTex[Math.min(2, f)], color: [0.85, 0.85, 0.85], spec: 0.15, shine: 20 }); }
      }
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
        const t = st.grid[r][c]; if (!t) continue;
        let x = BX + t.x*CELL + CELL/2, y = BY + t.y*CELL + CELL/2, sc = t.sc, lift = 0, spin = 0;
        if (t.dying) { sc *= Math.max(0, t.clearT / 0.25) * 1.2; spin = (1 - Math.max(0, t.clearT / 0.25)) * 6; }
        const sel = st.sel && st.sel[0] === r && st.sel[1] === c;
        if (sel) { sc *= 1.12 + Math.sin(time * 10) * 0.04; lift = 14; E.sprite(P3(x, y, 2), CELL * 1.5, [1, 0.85, 0.45], 0.55, true); }
        if (st.hint && st.hint.some(([hr,hc]) => hr === r && hc === c)) { sc *= 1 + Math.abs(Math.sin(time * 6)) * 0.12; lift = 8; }
        if (st.wiggle && ((st.wiggle.a[0] === r && st.wiggle.a[1] === c) || (st.wiggle.b[0] === r && st.wiggle.b[1] === c))) x += Math.sin(time * 60) * 4;
        if (sc <= 0.02) continue;
        const frozen = st.frost && st.frost[r][c] > 0 && !t.dying;
        const k = sc * 1.3 * (t.sp === 'b' ? 0.85 : 1), sway = Math.sin(time * 1.7 + t.id * 1.3) * 0.16, tilt = Math.cos(time * 1.3 + t.id) * 0.08;
        const z = 16 + lift + (frozen ? 4 : 0), type = t.sp === 'c' || t.t >= 6 ? 6 : t.t, col = type === 6 ? [1, 1, 1] : hex3(COLS[type]);
        E.draw(A3.gems[type], M.trs(P3(x, y, z - 8), [tilt, sway + spin, 0], [k * 1.13, k * 1.13, k * 0.5]), { color: type === 6 ? [0.3, 0.25, 0.4] : col.map(v => v * 0.32), unlit: true, noShadow: true });
        const spGlow = t.sp && !t.dying ? (type === 6 ? 0.12 : 0.3 + 0.1 * Math.sin(time * 6 + t.id)) : 0.2;
        E.draw(A3.gems[type], M.trs(P3(x, y, z), [tilt, sway + spin, 0], [k, k, k * 1.1]), { color: col, emissive: col.map(v => v * spGlow), spec: 2.6, shine: 150, rim: t.sp ? 1.3 : 0.85 });
        if (!t.dying) E.sprite(P3(x - CELL * 0.14 * sc, y - CELL * 0.16 * sc, z + 16), CELL * 0.3 * sc, [1, 1, 1], 0.55, true);
        // little star twinkles that come and go on random gems
        if (!t.dying && !reduceMotion) { const tw = Math.sin(time * 1.7 + t.id * 2.71) * Math.sin(time * 0.9 + t.id * 1.3); if (tw > 0.75) { const a = (tw - 0.75) / 0.25; E.sprite(P3(x + CELL * 0.2, y - CELL * 0.22, z + 22), CELL * 0.62 * a, [1, 1, 1], a, true); E.sprite(P3(x + CELL * 0.2, y - CELL * 0.22, z + 21), CELL * 1.0 * a, col, a * 0.45, true); } }
        const shine = PB.meta && PB.meta.look('sweets', 'shine');
        if (shine && !t.dying) { if (shine === 'shine_glow') E.sprite(P3(x, y, z - 10), CELL * 1.45 * sc, col, 0.5 + 0.15 * Math.sin(time * 3 + t.id), true);
          else { const tw = Math.max(0, Math.sin(time * 2.2 + t.id * 2.39)); if (tw > 0.6) { const a = (tw - 0.6) / 0.4, gx = x + CELL * 0.18 * sc, gy = y - CELL * 0.2 * sc; E.sprite(P3(gx, gy, z + 20), CELL * 0.55 * a * sc, [1, 1, 1], a, true); E.sprite(P3(gx, gy, z + 19), CELL * 0.9 * a * sc, col, a * 0.5, true); } } }
        // a shimmer sweeps diagonally across the board every few seconds and makes each gem flash
        if (!t.dying && !reduceMotion) { const sw = ((time * 0.32) % 1.6) * (N * 2 + 6) - 3 - (t.x + t.y); if (sw > 0 && sw < 1.2) { const a = Math.sin(sw / 1.2 * Math.PI); E.sprite(P3(x + CELL * 0.12, y - CELL * 0.14, z + 22), CELL * 0.7 * a * sc, [1, 1, 1], a, true); E.sprite(P3(x, y, z + 18), CELL * 1.3 * a * sc, col, a * 0.35, true); } }
        if (t.sp && !t.dying) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 6 + t.id), hc = t.sp === 'c' ? [0.42, 0.12, 0.75] : t.sp === 'b' ? [1, 0.42, 0.05] : col;
          // a solid glowing tile in the gem's colour, ringed in gold, so specials jump off the board
          E.draw(A3.tile, M.trs(P3(x, y, 4), [0, 0, 0], [CELL - 2, CELL - 2, 5]), { color: [1, 0.82, 0.25], emissive: [0.75, 0.55, 0.12], spec: 1.6, shine: 90, noShadow: true });
          E.draw(A3.tile, M.trs(P3(x, y, 6), [0, 0, 0], [CELL - 12, CELL - 12, 5]), { color: [0.55, 0.12, 0.95], emissive: [0.22 + pulse * 0.12, 0.04, 0.4 + pulse * 0.2], spec: 1.2, shine: 70, noShadow: true });
          E.sprite(P3(x, y, z - 12), CELL * (1.45 + pulse * 0.25) * sc, hc, 0.35 + pulse * 0.2, true);
          // four sparkles that circle the special
          if (!reduceMotion) for (let q=0;q<4;q++) { const a = time * 2.2 + q * Math.PI / 2 + t.id, rr = CELL * 0.52; E.sprite(P3(x + Math.cos(a) * rr, y + Math.sin(a) * rr, z + 24), CELL * 0.26 * (0.6 + 0.4 * Math.sin(time * 7 + q)), [1, 1, 0.8], 0.9, true); }
        }
        if ((t.sp === 'h' || t.sp === 'v') && !t.dying) {
          const rot = t.sp === 'v' ? Math.PI / 2 : 0, bm = M.trs(P3(x, y, z + 12), [0, 0, rot], [1, 1, 1]);
          // three glossy white candy stripes across the gem
          for (const o of [-9, 0, 9]) E.draw(A3.bar, M.mul(bm, M.trs([0, o * sc, 0], [0, 0, 0], [30 * sc, 2.6 * sc, 2.6 * sc])), { color: [1, 1, 1], emissive: [0.55, 0.55, 0.55], spec: 1.6, shine: 90, noShadow: true });
          // fat arrows that bounce outward, plus light that shoots along the line
          const off = 4 * Math.abs(Math.sin(time * 5));
          for (const d of [-1, 1]) { const am = M.mul(bm, M.trs([d * (29 + off) * sc, 0, 2], [0, 0, -d * Math.PI / 2], [9 * sc, 13 * sc, 6 * sc])); E.draw(A3.cone, am, { color: [1, 1, 1], emissive: [0.6, 0.6, 0.6], spec: 1.2 }); E.draw(A3.cone, am, { color: [0.1, 0.1, 0.2], unlit: true, outline: 1.2 * sc, noShadow: true }); }
          const run = ((time * 1.4 + t.id * 0.37) % 1) * 2 - 1, dx = t.sp === 'h' ? run * CELL * 1.6 : 0, dy = t.sp === 'v' ? run * CELL * 1.6 : 0;
          E.sprite(P3(x + dx, y + dy, z + 20), CELL * 0.6 * sc, [1, 1, 1], 1 - Math.abs(run), true);
        } else if (t.sp === 'b' && !t.dying) {
          // a spinning golden ring around the gem with a fizzing fuse spark
          E.draw(A3.ringPlain, M.trs(P3(x, y, z + 2), [Math.PI / 2, time * 1.6, 0.35], [30 * sc, 30 * sc, 30 * sc]), { color: [1, 0.78, 0.25], emissive: [0.45, 0.3, 0.05], spec: 2, shine: 110, noShadow: true });
          E.draw(A3.ringPlain, M.trs(P3(x, y, z + 2), [Math.PI / 2, -time * 1.3, -0.5], [27 * sc, 27 * sc, 27 * sc]), { color: [1, 0.55, 0.2], emissive: [0.4, 0.15, 0.02], spec: 2, shine: 110, noShadow: true });
          const fl = 0.6 + Math.random() * 0.4; E.sprite(P3(x + 14 * sc, y - 26 * sc, z + 24), 22 * fl * sc, [1, 0.8, 0.3], 1, true); E.sprite(P3(x + 14 * sc, y - 26 * sc, z + 25), 9 * sc, [1, 1, 0.9], 1, true);
          if (!reduceMotion && Math.random() < 0.3) { st.sparks = st.sparks || []; st.sparks.push({ x: x + 14 * sc, y: y - 26 * sc, vx: (Math.random() - .5) * 60, vy: -40 - Math.random() * 60, life: 0.4, max: 0.4, col: [1, 0.7, 0.2], size: 7 }); }
        } else if (t.sp === 'c' && !t.dying) {
          // rainbow rings spinning in two directions with rainbow sparkles orbiting
          E.draw(A3.ring, M.trs(P3(x, y, z), [Math.PI / 2 + 0.4, time * 2, 0], [27 * sc, 27 * sc, 27 * sc]), { color: [1, 1, 1], emissive: [0.45, 0.45, 0.45], spec: 1.4, noShadow: true });
          E.draw(A3.ring, M.trs(P3(x, y, z), [Math.PI / 2 - 0.5, -time * 2.4, 1.2], [23 * sc, 23 * sc, 23 * sc]), { color: [1, 1, 1], emissive: [0.45, 0.45, 0.45], spec: 1.4, noShadow: true });
          for (let q=0;q<6;q++) { const a = time * 2.4 + q * Math.PI / 3; E.sprite(P3(x + Math.cos(a) * 28 * sc, y + Math.sin(a) * 28 * sc, z + 14), 12 * sc, hex3(COLS[q % COLS.length]), 1, true); }
        }
      }
      // sparkles from clears: twinkling stars and a quick flash ring where each gem popped
      if (st.sparks) for (const q of st.sparks) { const k = q.life / q.max; if (q.ring) E.sprite(P3(q.x, q.y, 40), q.size * (1.4 - k * 0.8), q.col, k * 0.8, true); else { E.sprite(P3(q.x, q.y, 44), q.size * (0.4 + k * 0.6), q.col, Math.min(1, k * 1.6), true); E.sprite(P3(q.x, q.y, 45), q.size * 0.35 * k, [1, 1, 1], k, true); } }
      E.end(); if (!tile) E.present(ctx, W, H);
    }
    function draw(){
      if (assets3D()) drawWith3D(); else drawFlat();
      if (st.phase !== 'menu') drawBoosts();
    }
    // 3D board with the goal card, lanterns and effects drawn over it in 2D
    function drawWith3D(){
      const s = st.spec;
      draw3D();
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);

      drawCard(s);
      if (!reduceMotion) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const ph = (st.time % 5.5) / 1.4;
        if (ph < 1) { const sx = BX - 120 + ph * (N * CELL + 240); const lg = ctx.createLinearGradient(sx - 60, BY, sx + 60, BY + N * CELL); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,250,220,.16)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg; ctx.fillRect(BX, BY, N * CELL, N * CELL); }
        const slot = Math.floor(st.time * 1.6);
        for (let k=0;k<5;k++) { const h = (slot * 73 + k * 151) % (N * N), r = Math.floor(h / N), c = h % N, t = st.grid[r] && st.grid[r][c]; if (!t || t.dying) continue;
          const f = (st.time * 1.6) % 1, a = Math.sin(f * Math.PI), gx = BX + t.x * CELL + CELL * 0.4, gy = BY + t.y * CELL + CELL * 0.34, L = 14 * a;
          ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`; ctx.beginPath(); ctx.moveTo(gx - L, gy); ctx.lineTo(gx, gy - 1.6); ctx.lineTo(gx + L, gy); ctx.lineTo(gx, gy + 1.6); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(gx, gy - L); ctx.lineTo(gx + 1.6, gy); ctx.lineTo(gx, gy + L); ctx.lineTo(gx - 1.6, gy); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      drawFx();
    }
    function drawFlat(){
      const s = st.spec;
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      // Mine backdrop
      if (!caveC) paintCave();
      ctx.drawImage(caveC, 0, 0, W, H);
      lantern(40, 22); lantern(W - 40, 22);
      { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const lx of [40, W - 40]) { const fl = 0.85 + Math.sin(st.time * 9 + lx) * 0.08 + Math.sin(st.time * 23 + lx) * 0.05; const lg = ctx.createRadialGradient(lx, 30, 4, lx, 30, 150 * fl); lg.addColorStop(0, 'rgba(255,190,90,.35)'); lg.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = lg; ctx.fillRect(lx - 150, 0, 300, 200); } ctx.restore(); }

      drawCard(s);
      drawBoardFlat(s);
    }
    function drawCard(s){
      // Goal card
      ctx.save(); ctx.shadowColor = 'rgba(30,0,60,.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; { const sg = ctx.createLinearGradient(0, 40, 0, 152); sg.addColorStop(0, '#a65cf0'); sg.addColorStop(1, '#5a1aa8'); ctx.fillStyle = sg; }
      ctx.beginPath(); ctx.roundRect(16, 40, W - 32, 112, 22); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#ffd86a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.roundRect(16, 40, W - 32, 112, 22); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(24, 45, W - 48, 26, 13); ctx.fill(); ol(ctx, 3);
      // moves bubble
      { const bc = st.finishing ? ['#d8ffc8', '#3fd04a'] : st.moves <= 3 && s.type !== 'daily' ? ['#ffc8c0', '#e8302a'] : ['#fff2a0', '#ff9a1a'], rg = ctx.createRadialGradient(58, 80, 4, 70, 96, 40); rg.addColorStop(0, bc[0]); rg.addColorStop(1, bc[1]); ctx.fillStyle = rg; } ctx.beginPath(); ctx.arc(70, 96, 38 + (st.finishing ? Math.sin(st.time * 12) * 2 : 0), 0, 7); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5; ctx.stroke(); ol(ctx, 3);
      ctx.fillStyle = CHOC; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 34px ${FONT}`; ctx.fillText(st.moves, 70, 92);
      ctx.font = `600 12px ${FONT}`; ctx.fillText(st.finishing ? 'BONUS' : 'MOVES', 70, 117);
      // goals
      const gx = 130;
      ctx.textAlign = 'left';
      ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#ffd86a';
      ctx.fillText(s.type === 'daily' ? 'DAILY CHALLENGE \u00b7 SCORE ATTACK' : `LEVEL ${s.n} \u00b7 GOAL`, gx, 60);
      const items = [];
      if (s.type === 'score' || s.type === 'daily') items.push({ text: s.type === 'daily' ? `Score as much as you can!` : `Reach ${fmt(s.target)} points`, done: s.type === 'score' && st.score >= s.target });
      if (st.collect) for (const k in st.collect) items.push({ icon: +k, n: Math.max(0, st.collect[k]) });
      if (st.frost) items.push({ icon: 'frost', n: Math.max(0, st.frostLeft) });
      let ix = gx;
      for (const it of items) {
        if (it.text) { ctx.font = `700 19px ${FONT}`; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#3a0f6a'; ctx.strokeText(it.text, ix, 90); ctx.fillStyle = '#ffffff'; ctx.fillText(it.text, ix, 90); if (it.done) { ctx.fillStyle = '#2fb36b'; ctx.fillText(' \u2713', ix + ctx.measureText(it.text).width, 90); } continue; }
        goalIcon(it.icon, ix + 18, 92, 0.85);
        ctx.font = `700 22px ${FONT}`; ctx.fillStyle = it.n === 0 ? '#7dff6a' : '#ffffff';
        ctx.fillText(it.n === 0 ? '\u2713' : it.n, ix + 40, 93);
        ix += 40 + Math.max(24, ctx.measureText(String(it.n)).width) + 16;
      }
      // star progress bar
      const bx = gx, bw = W - 32 - gx - 4, by = 124;
      ctx.fillStyle = '#3a1470'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.fill();
      const maxS = s.type === 'daily' ? Math.max(5000, st.score * 1.2) : s.star3 * 1.08;
      ctx.fillStyle = '#2fd0ff'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(12, bw * Math.min(1, st.score / maxS)), 12, 6); ctx.fill();
      ol(ctx, 2); ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.stroke();
      if (s.type !== 'daily') {
        const marks = [s.type === 'score' ? s.target : s.star2 * 0.55, s.star2, s.star3];
        marks.forEach((m) => { const x = bx + bw * Math.min(1, m / maxS); ctx.fillStyle = st.score >= m ? '#ffc21a' : '#fff'; star(ctx, x, by + 6, 9, 4); ctx.fill(); ol(ctx, 1.8); ctx.stroke(); });
      }
    }
    function drawBoardFlat(s){

      // Board
      { const fg = ctx.createLinearGradient(BX - 12, 0, BX + N*CELL + 12, 0); fg.addColorStop(0, '#8a5a32'); fg.addColorStop(0.5, '#a8723f'); fg.addColorStop(1, '#6b4223'); ctx.fillStyle = fg; }
      ol(ctx, 4); ctx.beginPath(); ctx.roundRect(BX - 12, BY - 12, N*CELL + 24, N*CELL + 24, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1f1611'; ctx.beginPath(); ctx.roundRect(BX - 3, BY - 3, N*CELL + 6, N*CELL + 6, 8); ctx.fill();
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
        const x0 = BX + c*CELL + 2, y0 = BY + r*CELL + 2;
        const cg = ctx.createLinearGradient(x0, y0, x0, y0 + CELL); cg.addColorStop(0, (r + c) % 2 ? '#3e322b' : '#463830'); cg.addColorStop(1, (r + c) % 2 ? '#2e241f' : '#352a24');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(x0, y0, CELL - 4, CELL - 4, 8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x0 + 4, y0 + 2, CELL - 12, 2);
        const f = st.frost ? st.frost[r][c] : 0;
        if (f > 0) rockTile(x0 + 1, y0 + 1, CELL - 6, f);
      }
      ctx.save(); ctx.beginPath(); ctx.rect(BX - 4, BY - 4, N*CELL + 8, N*CELL + 8); ctx.clip();
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
        const t = st.grid[r][c]; if (!t) continue;
        if (st.frost && st.frost[r][c] > 0 && !t.dying) { /* gem sits inside the rock: draw faded */ }
        let x = BX + t.x*CELL + CELL/2, y = BY + t.y*CELL + CELL/2;
        let sc = t.sc;
        if (t.dying) sc *= Math.max(0, t.clearT / 0.25) * 1.2;
        if (st.sel && st.sel[0] === r && st.sel[1] === c) { sc *= 1.12 + Math.sin(st.time * 10) * 0.04; ctx.fillStyle = 'rgba(255,220,120,.3)'; ctx.beginPath(); ctx.roundRect(BX + c*CELL + 2, BY + r*CELL + 2, CELL - 4, CELL - 4, 9); ctx.fill(); }
        if (st.hint && st.hint.some(([hr,hc]) => hr === r && hc === c)) sc *= 1 + Math.abs(Math.sin(st.time * 6)) * 0.12;
        if (st.wiggle && ((st.wiggle.a[0] === r && st.wiggle.a[1] === c) || (st.wiggle.b[0] === r && st.wiggle.b[1] === c))) x += Math.sin(st.time * 60) * 4;
        if (sc > 0.02) drawTile(t, x, y, sc * 1.14);
      }
      if (!reduceMotion) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        // a sweep of light across the gems every few seconds
        const ph = (st.time % 5.5) / 1.4;
        if (ph < 1) { const sx = BX - 120 + ph * (N * CELL + 240); const lg = ctx.createLinearGradient(sx - 60, BY, sx + 60, BY + N * CELL); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,250,220,.22)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg; ctx.fillRect(BX, BY, N * CELL, N * CELL); }
        // twinkling glints on a few gems
        const slot = Math.floor(st.time * 1.6);
        for (let k=0;k<4;k++) { const h = (slot * 73 + k * 151) % (N * N), r = Math.floor(h / N), c = h % N, t = st.grid[r] && st.grid[r][c]; if (!t || t.dying) continue;
          const f = (st.time * 1.6) % 1, a = Math.sin(f * Math.PI), gx = BX + t.x * CELL + CELL * 0.32, gy = BY + t.y * CELL + CELL * 0.3, L = 13 * a;
          ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`; ctx.beginPath(); ctx.moveTo(gx - L, gy); ctx.lineTo(gx, gy - 1.6); ctx.lineTo(gx + L, gy); ctx.lineTo(gx, gy + 1.6); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(gx, gy - L); ctx.lineTo(gx + 1.6, gy); ctx.lineTo(gx, gy + L); ctx.lineTo(gx - 1.6, gy); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      ctx.restore();
      drawFx();
    }
    function drawFx(){
      for (const b of st.beams) {
        ctx.save(); ctx.globalAlpha = b.life / 0.3; ctx.fillStyle = '#fff'; ctx.shadowColor = '#5ce1ff'; ctx.shadowBlur = 24;
        if (b.dir === 'h') ctx.fillRect(BX, BY + b.r*CELL + CELL/2 - 6, N*CELL, 12); else ctx.fillRect(BX + b.c*CELL + CELL/2 - 6, BY, 12, N*CELL);
        ctx.restore();
      }
      // sparkle stars: a coloured four-point star with a white heart, spinning as it flies
      for (const q of st.parts) { const k = Math.max(0, q.life / 0.55), r = q.r * 2.2 * (0.5 + k * 0.7), a = (q.rot = (q.rot || Math.random() * 3) + 0.15);
        ctx.globalAlpha = k; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a);
        ctx.fillStyle = q.color; ctx.strokeStyle = 'rgba(40,20,60,.55)'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let i=0;i<8;i++) { const rr = i % 2 ? r * 0.32 : r, an = i * Math.PI / 4; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) {
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2);
        ctx.font = `700 36px ${FONT}`; ctx.lineWidth = 7; ctx.strokeStyle = CHOC; ctx.lineJoin = 'round';
        ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y); ctx.restore();
      }
    }

    function cellAt(x, y){ const c = Math.floor((x - BX) / CELL), r = Math.floor((y - BY) / CELL); return (r >= 0 && r < N && c >= 0 && c < N) ? [r, c] : null; }
    function artTile(g){
      if (assets3D()) { const keep = st; fresh('classic', Math.random, 1); st.phase = 'menu'; st.time = 1; for (let r=0;r<N;r++) for (let c=0;c<N;c++) { const t = st.grid[r][c]; if (t) { t.x = c; t.y = r; t.sc = 1; t.dying = false; } } st.grid[3][3].sp = 'c'; st.grid[4][5].sp = 'h'; draw3D(true); draw3D(true); const k = E3.canvas.height / H; g.drawImage(E3.canvas, 30 * k, 205 * k, 420 * k, 315 * k, 0, 0, 240, 180); st = keep; return; }
      if (!caveC) paintCave();
      g.drawImage(caveC, 0, 0, W, H * 0.7, 0, 0, 240, 180);
      g.fillStyle = '#a8723f'; g.strokeStyle = CHOC; g.lineWidth = 3; g.beginPath(); g.roundRect(22, 18, 196, 146, 12); g.fill(); g.stroke();
      g.fillStyle = '#2a201a'; g.beginPath(); g.roundRect(30, 26, 180, 130, 8); g.fill();
      const saveSt = st; st = st || { time: 0 };
      const layout = [[0,1,2,3],[5,4,6,1],[2,0,3,4]];
      layout.forEach((row, r) => row.forEach((t, c) => pastry(g, t, 52 + c*46, 46 + r*45, 0.88)));
      st = saveSt;
    }

    return {
      id:'sweets', sfxScore:false, music:'sweets', title:'GEM MINE', W, H, statLabel:'Moves', type:'levels', levels:100, maxLives: 0,
      failTitle:'Out of moves', dailyText:'Score attack: 25 moves', powersTitle:'Special gems',
      tile:{ order:3, name:'Gem Mine', kind:'Mining match 3 \u00b7 100 levels', art: artTile, isNew: true },
      controls: ['Swipe a gem into its neighbor to swap them.', 'Line up 3 or more of the same gem to mine them.', 'Every gem has its own shape: hearts, triangles, diamonds and more.', 'Meet the goal at the top before your moves run out.', 'Rock tiles crack open when you match on top of them.', 'Moves you have left at the end turn into bonus points.', 'Tap a power-up under the board to use it. Get more in the Swag Shop, daily gifts, level-map chests and reward boxes every 5 levels.'],
      powers: [
        { name:'Laser gem', desc:'Match 4 in a row. Blasts a whole row or column', icon: g => { const sv = st; st = st || {time:0}; g.fillStyle='#5ce1ff'; g.fillRect(4, 12, 38, 4); pastry(g, 3, 23, 14, 0.55); st = sv; } },
        { name:'Dynamite gem', desc:'Match in an L or T shape. Blows up the 3\u00d73 around it', icon: g => { const sv = st; st = st || {time:0}; g.fillStyle='rgba(255,140,40,.6)'; g.beginPath(); g.arc(23,14,14,0,7); g.fill(); pastry(g, 5, 23, 14, 0.55); st = sv; } },
        { name:'Prism diamond', desc:'Match 5 in a row. Swap it to clear every gem of one kind', icon: g => { const sv = st; st = st || {time:0}; pastry(g, 6, 23, 14, 0.6); st = sv; } },
        { name:'Combos', desc:'Swap two special gems together for a giant blast', icon: g => { const sv = st; st = st || {time:0}; pastry(g, 6, 15, 14, 0.45); pastry(g, 5, 32, 14, 0.45); st = sv; } },
      ],
      init(){ assets3D(); },
      reviveText: '+5 moves', reviveIcon: '\u2795', reviveTitle: 'Out of moves!',
      revive(){ st.over = false; st.busy = false; st.moves = 5; st.tool = null; pop(70, 150, '+5 moves!', '#7dff6a', 1.6); },
      preview(){ fresh('classic', Math.random, 1); st.busy = false; st.phase = 'menu'; },
      start(mode, rand, lives, msg, level){ fresh(mode, rand, level === 'daily' ? 1 : level); },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: null, stat: st.moves, score: st.score }; },
      metrics(){ return { score: st.score, gems: st.gems || 0, chain: st.maxChain || 0 }; },
      dailyGoals: [
        { text:'Mine {n} gems', m:'gems', n:[80, 100, 120] },
        { text:'Score {n} points', m:'score', n:[3000, 4500, 6000] },
        { text:'Make a {n}-in-a-row chain reaction', m:'chain', n:[3, 4] },
      ],
      pointerDown(x, y){
        if (st.busy || st.over) return;
        const bz = boostAt(x, y); if (bz) { st.drag = null; pressBoost(bz); return; }
        const cell = cellAt(x, y);
        if (st.tool) { st.drag = null; if (cell) useTool(cell[0], cell[1]); else st.tool = null; return; }
        st.drag = cell ? { cell, x, y } : null;
      },
      pointerMove(x, y){
        if (!st.drag || st.busy) return;
        const dx = x - st.drag.x, dy = y - st.drag.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > CELL * 0.4) {
          const [r, c] = st.drag.cell;
          const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
          st.drag = null;
          if (to[0] >= 0 && to[0] < N && to[1] >= 0 && to[1] < N) trySwap([r, c], to);
        }
      },
      pointerUp(x, y){
        if (!st.drag) return;
        const cell = st.drag.cell; st.drag = null;
        if (st.sel && Math.abs(st.sel[0] - cell[0]) + Math.abs(st.sel[1] - cell[1]) === 1) trySwap(st.sel, cell);
        else st.sel = (st.sel && st.sel[0] === cell[0] && st.sel[1] === cell[1]) ? null : cell;
      },
      key(){}, debug(){ return st; }, debugStep(n){ for (let i=0;i<n;i++) update(1 / 60); }, debugMove(){ const m = findMove(); if (m) trySwap(m[0], m[1]); return m; }, debugBoost(id, r, c){ const b = boostList().find(q => q.id === id); pressBoost(b); if (st.tool && r != null) useTool(r, c); },
    };
  }
  PB.register(createSweets);
})();
