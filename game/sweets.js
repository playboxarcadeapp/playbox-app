// GEM MINE (formerly Sweet Swap): a mining match-3 with 100 replayable levels.
(function(){
  const { fmt, reduceMotion, ctx, mulberry, seedFrom, shuffle, shade } = PB;

  function createSweets(shell){
    const W = 480, H = 660, N = 8, CELL = 54, BX = (W - N*CELL)/2, BY = 178;
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
    const kind = t => t && t.sp !== 'c' ? t.t : -1;
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
        burst(r, c, t.sp === 'c' ? '#fff' : COLS[t.t], 5);
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
        const cells = [bombCell]; const bombTile = T(...bombCell); if (bombTile) bombTile.sp = null;
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
      for (const q of st.parts) { q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 520*dt; q.life -= dt; }
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
      if (!t.sp) { pastry(ctx, t.t, cx, cy, s); return; }
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
      const g = ctx, rg = g.createLinearGradient(x, y, x + w, y + w); rg.addColorStop(0, f > 1 ? '#8a7a6c' : '#b5a493'); rg.addColorStop(1, f > 1 ? '#4e4238' : '#7d6d5e');
      g.fillStyle = rg; g.beginPath(); g.moveTo(x + w * 0.15, y); g.lineTo(x + w * 0.8, y + w * 0.04); g.lineTo(x + w, y + w * 0.35); g.lineTo(x + w * 0.94, y + w * 0.9); g.lineTo(x + w * 0.3, y + w); g.lineTo(x, y + w * 0.7); g.lineTo(x + w * 0.04, y + w * 0.2); g.closePath(); g.fill();
      g.strokeStyle = '#2a1a10'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(30,18,10,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + w * 0.3, y + w * 0.2); g.lineTo(x + w * 0.5, y + w * 0.5); g.lineTo(x + w * 0.4, y + w * 0.8); g.moveTo(x + w * 0.5, y + w * 0.5); g.lineTo(x + w * 0.8, y + w * 0.6); if (f > 1) { g.moveTo(x + w * 0.7, y + w * 0.15); g.lineTo(x + w * 0.62, y + w * 0.4); } g.stroke();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(x + w * 0.3, y + w * 0.2, w * 0.12, w * 0.05, -0.4, 0, 7); g.fill();
    }
    let caveC = null;
    function paintCave(){
      const [c, g] = PB.layer(W, H), R = mulberry(5);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#3b2a20'); bg.addColorStop(1, '#1d140f'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let i=0;i<70;i++) { const x = R() * W, y = R() * H, r = 18 + R() * 46; g.fillStyle = `rgba(${R() < .5 ? '90,66,50' : '20,12,8'},${0.25 + R() * 0.3})`; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r * 0.3, y - r * 0.8); g.lineTo(x + r * 0.7, y - r * 0.5); g.lineTo(x + r, y + r * 0.3); g.lineTo(x + r * 0.2, y + r * 0.8); g.closePath(); g.fill(); }
      // gems glinting in the rock
      for (let i=0;i<26;i++) { const x = R() * W, y = R() * H, col = COLS[i % 6]; g.fillStyle = col; g.globalAlpha = 0.55; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.fill(); g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 1, y - 3, 1.5, 1.5); }
      // wooden mine supports
      const beam = (x, y, w, h) => { const bg2 = g.createLinearGradient(x, y, x + w, y); bg2.addColorStop(0, '#8a5a32'); bg2.addColorStop(0.5, '#a8723f'); bg2.addColorStop(1, '#6b4223'); g.fillStyle = bg2; g.fillRect(x, y, w, h); g.strokeStyle = '#2a1a10'; g.lineWidth = 2.5; g.strokeRect(x, y, w, h); g.strokeStyle = 'rgba(40,20,5,.35)'; g.lineWidth = 1.2; for (let k=0;k<3;k++) { g.beginPath(); g.moveTo(x + w * (0.25 + k * 0.25), y + 4); g.lineTo(x + w * (0.25 + k * 0.25) + 2, y + h - 4); g.stroke(); } };
      beam(0, 0, 16, H); beam(W - 16, 0, 16, H);
      // rail track along the bottom
      g.fillStyle = '#4a3423'; for (let x = -6; x < W; x += 30) { g.fillRect(x, H - 34, 20, 26); }
      g.fillStyle = '#9aa0a8'; g.fillRect(0, H - 30, W, 5); g.fillRect(0, H - 14, W, 5);
      caveC = c;
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
    function draw(){
      const s = st.spec;
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      // Mine backdrop
      if (!caveC) paintCave();
      ctx.drawImage(caveC, 0, 0, W, H);
      lantern(40, 22); lantern(W - 40, 22);

      // Goal card
      ol(ctx, 3); { const sg = ctx.createLinearGradient(0, 40, 0, 152); sg.addColorStop(0, '#f6e2b8'); sg.addColorStop(1, '#e2c48c'); ctx.fillStyle = sg; }
      ctx.beginPath(); ctx.roundRect(16, 40, W - 32, 112, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6b6f78'; for (const [nx, ny] of [[28, 52], [W - 28, 52], [28, 140], [W - 28, 140]]) { ctx.beginPath(); ctx.arc(nx, ny, 3.5, 0, 7); ctx.fill(); }
      // moves bubble
      ctx.fillStyle = st.moves <= 3 && s.type !== 'daily' ? '#ff5a4a' : '#ffcf4a'; ctx.beginPath(); ctx.arc(70, 96, 38, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = CHOC; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 34px ${FONT}`; ctx.fillText(st.moves, 70, 92);
      ctx.font = `600 12px ${FONT}`; ctx.fillText('MOVES', 70, 117);
      // goals
      const gx = 130;
      ctx.textAlign = 'left';
      ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#7a5530';
      ctx.fillText(s.type === 'daily' ? 'DAILY CHALLENGE \u00b7 SCORE ATTACK' : `LEVEL ${s.n} \u00b7 GOAL`, gx, 60);
      const items = [];
      if (s.type === 'score' || s.type === 'daily') items.push({ text: s.type === 'daily' ? `Score as much as you can!` : `Reach ${fmt(s.target)} points`, done: s.type === 'score' && st.score >= s.target });
      if (st.collect) for (const k in st.collect) items.push({ icon: +k, n: Math.max(0, st.collect[k]) });
      if (st.frost) items.push({ icon: 'frost', n: Math.max(0, st.frostLeft) });
      let ix = gx;
      for (const it of items) {
        if (it.text) { ctx.font = `700 19px ${FONT}`; ctx.fillStyle = CHOC; ctx.fillText(it.text, ix, 90); if (it.done) { ctx.fillStyle = '#2fb36b'; ctx.fillText(' \u2713', ix + ctx.measureText(it.text).width, 90); } continue; }
        goalIcon(it.icon, ix + 18, 92, 0.85);
        ctx.font = `700 22px ${FONT}`; ctx.fillStyle = it.n === 0 ? '#2fb36b' : CHOC;
        ctx.fillText(it.n === 0 ? '\u2713' : it.n, ix + 40, 93);
        ix += 40 + Math.max(24, ctx.measureText(String(it.n)).width) + 16;
      }
      // star progress bar
      const bx = gx, bw = W - 32 - gx - 4, by = 124;
      ctx.fillStyle = '#c9a66e'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.fill();
      const maxS = s.type === 'daily' ? Math.max(5000, st.score * 1.2) : s.star3 * 1.08;
      ctx.fillStyle = '#2fd0ff'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(12, bw * Math.min(1, st.score / maxS)), 12, 6); ctx.fill();
      ol(ctx, 2); ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.stroke();
      if (s.type !== 'daily') {
        const marks = [s.type === 'score' ? s.target : s.star2 * 0.55, s.star2, s.star3];
        marks.forEach((m) => { const x = bx + bw * Math.min(1, m / maxS); ctx.fillStyle = st.score >= m ? '#ffc21a' : '#fff'; star(ctx, x, by + 6, 9, 4); ctx.fill(); ol(ctx, 1.8); ctx.stroke(); });
      }

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
      ctx.restore();
      for (const b of st.beams) {
        ctx.save(); ctx.globalAlpha = b.life / 0.3; ctx.fillStyle = '#fff';
        if (b.dir === 'h') ctx.fillRect(BX, BY + b.r*CELL + CELL/2 - 6, N*CELL, 12); else ctx.fillRect(BX + b.c*CELL + CELL/2 - 6, BY, 12, N*CELL);
        ctx.restore();
      }
      for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life / 0.55); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
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
      controls: ['Swipe a gem into its neighbor to swap them.', 'Line up 3 or more of the same gem to mine them.', 'Every gem has its own shape: hearts, triangles, diamonds and more.', 'Meet the goal at the top before your moves run out.', 'Rock tiles crack open when you match on top of them.', 'Moves you have left at the end turn into bonus points.'],
      powers: [
        { name:'Laser gem', desc:'Match 4 in a row. Blasts a whole row or column', icon: g => { const sv = st; st = st || {time:0}; g.fillStyle='#5ce1ff'; g.fillRect(4, 12, 38, 4); pastry(g, 3, 23, 14, 0.55); st = sv; } },
        { name:'Dynamite gem', desc:'Match in an L or T shape. Blows up the 3\u00d73 around it', icon: g => { const sv = st; st = st || {time:0}; g.fillStyle='rgba(255,140,40,.6)'; g.beginPath(); g.arc(23,14,14,0,7); g.fill(); pastry(g, 5, 23, 14, 0.55); st = sv; } },
        { name:'Prism diamond', desc:'Match 5 in a row. Swap it to clear every gem of one kind', icon: g => { const sv = st; st = st || {time:0}; pastry(g, 6, 23, 14, 0.6); st = sv; } },
        { name:'Combos', desc:'Swap two special gems together for a giant blast', icon: g => { const sv = st; st = st || {time:0}; pastry(g, 6, 15, 14, 0.45); pastry(g, 5, 32, 14, 0.45); st = sv; } },
      ],
      init(){},
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
        const cell = cellAt(x, y); st.drag = cell ? { cell, x, y } : null;
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
      key(){}, debug(){ return st; }, debugMove(){ const m = findMove(); if (m) trySwap(m[0], m[1]); return m; },
    };
  }
  PB.register(createSweets);
})();
