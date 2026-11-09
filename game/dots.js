// DOT FRIENDS: connect each little dot to its twin of the same color. Lines can't cross or go through
// another color. No timer and nothing to lose, so it's easy to play a bit, put down, and come back to.
(function(){
  const { ctx, mulberry, seedFrom, reduceMotion } = PB;

  function createDots(shell){
    const W = 480, H = 720, BX = 20, BY = 150, BW = 440;
    const FONT = '"Lilita One", "Arial Rounded MT Bold", "Arial Black", sans-serif', BODY = '"Nunito", "Segoe UI", sans-serif';
    const COLS = ['#ff3b3b', '#2f7bff', '#22c55e', '#ffd400', '#ff8a00', '#a855f7', '#ff5fb8', '#14d4e0', '#9a6a3a', '#f4f4f4', '#2b2b38'];
    const NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Aqua', 'Brown', 'White', 'Black'];
    // walls sit on the line between two squares; a wall key is "smaller square index - bigger square index"
    const wkey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
    const HINTS = 3;
    let st = null;

    // ---------- puzzles ----------
    // A random path visits every square once (a "snake" shuffled with backbite moves); cutting it into pieces
    // gives each color its two dots. So every puzzle can be solved, and the answer fills the whole board.
    function snakePath(n, R){
      const path = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) path.push([r, r % 2 ? n - 1 - c : c]);
      const nb = ([r, c]) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n);
      const idx = new Map(path.map((p, i) => [p[0] * n + p[1], i]));
      for (let it = 0; it < n * n * 30; it++) {
        const atStart = R() < 0.5, end = atStart ? path[0] : path[path.length - 1], opts = nb(end), q = opts[Math.floor(R() * opts.length)];
        const i = idx.get(q[0] * n + q[1]);
        if (atStart) { if (i === 1) continue; const seg = path.slice(0, i).reverse(); path.splice(0, i, ...seg); }
        else { if (i === path.length - 2) continue; const seg = path.slice(i + 1).reverse(); path.splice(i + 1, path.length - i - 1, ...seg); }
        path.forEach((p, k) => idx.set(p[0] * n + p[1], k));
      }
      return path;
    }
    // How hard is a puzzle to *solve* (not just to fill)? A quick player connects each pair the shortest way it
    // can, in some order. We try that many times in random orders: the more often it gets stuck (a pair can't
    // reach its twin), the more you have to think ahead and route lines around each other.
    function stuckRate(n, pairs, R, tries){
      const dotAt = new Map(); pairs.forEach((p, i) => { dotAt.set(p.a[0] * n + p.a[1], i); dotAt.set(p.b[0] * n + p.b[1], i); });
      let stuck = 0;
      for (let t = 0; t < tries; t++) {
        const used = new Uint8Array(n * n), order = PB.shuffle(pairs.map((_, i) => i), R); let ok = true;
        for (const i of order) {
          const { a, b } = pairs[i], start = a[0] * n + a[1], goal = b[0] * n + b[1], prev = new Int32Array(n * n).fill(-1), q = [start]; prev[start] = start;
          while (q.length) { const c = q.shift(); if (c === goal) break; const r = Math.floor(c / n), col = c % n;
            const nb = PB.shuffle([[r - 1, col], [r + 1, col], [r, col - 1], [r, col + 1]], R);
            for (const [rr, cc] of nb) { if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue; const k2 = rr * n + cc; if (prev[k2] >= 0 || used[k2]) continue; const d = dotAt.get(k2); if (d != null && d !== i) continue; prev[k2] = c; q.push(k2); } }
          if (prev[goal] < 0) { ok = false; break; }
          for (let c = goal; c !== start; c = prev[c]) used[c] = 1; used[start] = 1;
        }
        if (!ok) stuck++;
      }
      return stuck / tries;
    }
    // A thinking test: how much work does a sensible player need to solve it? This solver works like a person:
    // it does the closest pairs first and draws the most direct line it can, and only takes a longer way around
    // when it has to (it allows every line S extra squares beyond the straight distance, S = 0, 1, 2, ...).
    // The number of squares it has to try before everything connects is the puzzle's "effort". Easy puzzles solve
    // almost straight away; hard ones need lines that go the long way round and lots of trying again.
    function effort(n, pairs, cap, walls){ const r = solveLikeAPerson(n, pairs, cap, walls); return r.nodes; }
    function solveLikeAPerson(n, pairs, cap, walls, R){
      const k = pairs.length, grid = new Int16Array(n * n).fill(-1), man = p => Math.abs(p.a[0] - p.b[0]) + Math.abs(p.a[1] - p.b[1]);
      pairs.forEach((p, i) => { grid[p.a[0] * n + p.a[1]] = i; grid[p.b[0] * n + p.b[1]] = i; });
      const order = pairs.map((p, i) => i).sort((x, y) => man(pairs[x]) - man(pairs[y]) + (R ? (R() - 0.5) * 6 : 0));
      const paths = pairs.map(() => []), W = walls || new Set();
      let nodes = 0, S = 0;
      const solveFrom = idx => {
        if (idx === k) return true;
        const i = order[idx], p = pairs[i], goal = p.b[0] * n + p.b[1], br = p.b[0], bc = p.b[1], limit = man(p) + S, used = [p.a[0] * n + p.a[1]];
        const step = (r, c, len) => {
          if (++nodes > cap) throw 0;
          const opts = [];
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
            const key = rr * n + cc;
            if (W.size && W.has(wkey(r * n + c, key))) continue;
            if (key === goal) { opts.length = 0; opts.push([rr, cc, -1]); break; }
            if (grid[key] !== -1) continue;
            const d = Math.abs(rr - br) + Math.abs(cc - bc); if (len + 1 + d > limit) continue;
            opts.push([rr, cc, d]);
          }
          opts.sort((x, y) => x[2] - y[2]);
          for (const [rr, cc, d] of opts) {
            if (d === -1) { paths[i] = used.concat([goal]); if (solveFrom(idx + 1)) return true; continue; }
            const key = rr * n + cc; grid[key] = 100 + i; used.push(key);
            if (step(rr, cc, len + 1)) return true;
            grid[key] = -1; used.pop();
          }
          return false;
        };
        return step(p.a[0], p.a[1], 0);
      };
      try { for (S = 0; S <= n * 2; S += 2) if (solveFrom(0)) return { nodes, paths }; } catch (e) { return { nodes: cap, paths: null }; }
      return { nodes: cap, paths: null };
    }
    // Walls make a puzzle harder by closing the shortcuts. Each pair's real line (the puzzle was cut from a full
    // answer) often winds around; a person's first try is the most direct route. Wherever a pair has a route that's
    // shorter than its real line, we put a wall across that route, on a spot the real answer never crosses (so
    // the puzzle always stays solvable). Keep going until the direct routes are closed or the wall budget is used:
    // then the easy, obvious lines simply don't work and you have to find the winding ones.
    function addWalls(pz, budget, R, slack){
      const n = pz.n, walls = new Set(), solEdges = new Set(), dotAt = new Map();
      pz.pairs.forEach((p, i) => { dotAt.set(p.a[0] * n + p.a[1], i); dotAt.set(p.b[0] * n + p.b[1], i);
        for (let k = 1; k < p.sol.length; k++) solEdges.add(wkey(p.sol[k - 1][0] * n + p.sol[k - 1][1], p.sol[k][0] * n + p.sol[k][1])); });
      const route = i => {   // shortest open route for pair i (other pairs' dots and walls block; other lines don't)
        const p = pz.pairs[i], start = p.a[0] * n + p.a[1], goal = p.b[0] * n + p.b[1], prev = new Int32Array(n * n).fill(-1), q = [start]; prev[start] = start;
        while (q.length) { const c = q.shift(); if (c === goal) break; const r = Math.floor(c / n), cc = c % n;
          for (const [rr, c2] of PB.shuffle([[r - 1, cc], [r + 1, cc], [r, cc - 1], [r, cc + 1]], R)) { if (rr < 0 || c2 < 0 || rr >= n || c2 >= n) continue; const k2 = rr * n + c2;
            if (prev[k2] >= 0 || walls.has(wkey(c, k2))) continue; const d = dotAt.get(k2); if (d != null && d !== i) continue; prev[k2] = c; q.push(k2); } }
        if (prev[goal] < 0) return null; const path = [goal]; for (let c = goal; c !== start; c = prev[c]) path.push(prev[c]); return path.reverse();
      };
      const stuck = new Set();
      for (let round = 0; round < budget * 4 && walls.size < budget; round++) {
        let best = null;
        pz.pairs.forEach((p, i) => { if (stuck.has(i)) return; const r = route(i); if (!r) return; const gap = (p.sol.length - 1) - (r.length - 1) - slack; if (gap > 0 && (!best || gap > best.gap || (gap === best.gap && R() < 0.5))) best = { i, r, gap }; });
        if (!best) break;
        const open = []; for (let k = 1; k < best.r.length; k++) { const e = wkey(best.r[k - 1], best.r[k]); if (!solEdges.has(e) && !walls.has(e)) open.push({ e, mid: Math.abs(k - best.r.length / 2) }); }
        if (!open.length) { stuck.add(best.i); continue; }
        open.sort((x, y) => x.mid - y.mid); walls.add(open[Math.floor(R() * Math.min(3, open.length))].e);
      }
      pz.walls = walls; return pz;
    }
    // Make a batch of puzzles, sort them by effort, and take the one at the spot this level wants
    // (q 0 = the easiest of the batch, 1 = the hardest). Most random puzzles are easy, so the hard levels look
    // through a big batch and keep the toughest one.
    function makePuzzle(n, k, seed, pick){
      const R = mulberry(seedFrom(seed)), list = [];
      if (!pick) { const pz = makeOne(n, k, R); pz.walls = new Set(); return pz; }
      for (let cand = 0; cand < pick.count; cand++) { const pz = makeOne(n, k, R); if (!pz) continue; pz.effort = effort(n, pz.pairs, 40000); list.push(pz); }
      list.sort((x, y) => x.effort - y.effort);
      const pz = list[Math.round(Math.max(0, Math.min(1, pick.q)) * (list.length - 1))];
      if (pick.walls) addWalls(pz, pick.walls, R, pick.slack || 0); else pz.walls = new Set();
      return pz;
    }
    function makeOne(n, k, R){
      for (let tries = 0; tries < 60; tries++) {
        const path = snakePath(n, R), len = Array(k).fill(3);
        for (let left = n * n - 3 * k; left > 0; left--) len[Math.floor(R() * k)]++;
        let at = 0; const pieces = len.map(L => { const p = path.slice(at, at + L); at += L; return p; });
        // no piece whose two ends sit right next to each other (too easy, and it leaves odd gaps)
        if (pieces.some(p => Math.abs(p[0][0] - p[p.length - 1][0]) + Math.abs(p[0][1] - p[p.length - 1][1]) === 1) && tries < 50) continue;
        const order = PB.shuffle([...Array(k).keys()], R);
        return { n, k, pairs: pieces.map((p, i) => ({ color: order[i], a: p[0], b: p[p.length - 1], sol: p })) };
      }
    }
    // The board only ever grows as you go up (it never shrinks on an easy level). What changes from level to level
    // is how tangled the puzzle is: easy ones mostly connect the obvious way, SUPER HARD ones almost never do.
    function levelSize(n){
      if (n === 'daily') return { n: 8, k: 10, pick: { count: 60, q: 1, walls: 22, slack: 1 } };
      if (n <= 3) return [{ n: 4, k: 3, pick: { count: 6, q: 0 } }, { n: 4, k: 3, pick: { count: 6, q: 0.3 } }, { n: 5, k: 4, pick: { count: 8, q: 0.5 } }][n - 1];
      // boards get packed tighter as you go (more pairs on the same board = less room to go around)
      const size = n <= 10 ? 5 : n <= 30 ? 6 : n <= 70 ? 7 : n <= 150 ? 8 : 9, k = Math.min(11, size + (n > 10 ? 1 : 0) + (n > 30 ? 1 : 0));
      const tier = PB.levels.tier(n), grown = Math.min(1, n / 150);
      // the first 10 levels stay gentle; after that even easy ones come from the harder half of the batch
      if (n <= 10) return { n: size, k, pick: { count: 12, q: tier === 'super' ? 1 : tier === 'hard' ? 0.85 : 0.5 } };
      const pick = tier === 'super' ? { count: 90, q: 1 } : tier === 'hard' ? { count: 45, q: 1 } : tier === 'easy' ? { count: 30, q: 0.7 + 0.2 * grown } : { count: 35, q: 0.85 + 0.12 * grown };
      // walls (from level 15) close shortcuts: a few on easy levels, lots on SUPER HARD ones
      if (n >= 15) { pick.walls = Math.round((tier === 'super' ? 16 + 20 * grown : tier === 'hard' ? 10 + 12 * grown : tier === 'easy' ? 3 + 5 * grown : 6 + 8 * grown) * (size / 8)); pick.slack = tier === 'super' ? 0 : tier === 'hard' ? 0 : tier === 'easy' ? 2 : 1; }
      return { n: size, k, pick };
    }

    // ---------- state ----------
    function fresh(mode, level){
      const daily = mode === 'daily', L = daily ? 'daily' : level || 1, sz = levelSize(L);
      const pz = makePuzzle(sz.n, sz.k, daily ? 'dots-daily-' + PB.today() : 'dots-level-' + L, sz.pick);
      st = { mode, level: L, n: pz.n, k: pz.k, pairs: pz.pairs, paths: pz.pairs.map(() => []), done: pz.pairs.map(() => false), draw: null,
        hints: HINTS, hinted: 0, moves: 0, time: 0, over: false, parts: [], pops: [], joy: pz.pairs.map(() => 0), shake: 0, msg: null, won: false, look: [W / 2, BY + BW / 2], blink: 0 };
      st.cs = BW / st.n; st.walls = pz.walls || new Set();
      st.dotAt = new Map(); pz.pairs.forEach((p, i) => { st.dotAt.set(p.a[0] * st.n + p.a[1], i); st.dotAt.set(p.b[0] * st.n + p.b[1], i); });
    }
    const key = (r, c) => r * st.n + c;
    const owner = (r, c) => { for (let i = 0; i < st.paths.length; i++) if (st.paths[i].some(q => q[0] === r && q[1] === c)) return i; return -1; };
    const cellAt = (x, y) => { const c = Math.floor((x - BX) / st.cs), r = Math.floor((y - BY) / st.cs); return r >= 0 && c >= 0 && r < st.n && c < st.n ? [r, c] : null; };
    const center = ([r, c]) => [BX + (c + 0.5) * st.cs, BY + (r + 0.5) * st.cs];
    const isEnd = (i, [r, c]) => { const p = st.pairs[i]; return (p.a[0] === r && p.a[1] === c) || (p.b[0] === r && p.b[1] === c); };
    const filled = () => { let f = 0; for (const p of st.paths) f += p.length; return f; };

    function pop(x, y, text, color, life){ st.pops.push({ x, y, text, color, life: life || 1.2, max: life || 1.2 }); }
    function sparkle(x, y, color, n){ if (reduceMotion) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 160; st.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.8, color, r: 2 + Math.random() * 3 }); } }

    // ---------- drawing lines ----------
    function startAt(x, y){
      const cell = cellAt(x, y); if (!cell || st.over) return;
      const d = st.dotAt.get(key(...cell));
      if (d != null) { if (st.hintLines) st.hintLines.delete(d); st.paths[d] = [cell]; st.done[d] = false; st.draw = { i: d }; if (PB.sfx) PB.sfx('pick'); return; }
      const o = owner(...cell);
      if (o >= 0) { if (st.hintLines) st.hintLines.delete(o); const p = st.paths[o], at = p.findIndex(q => q[0] === cell[0] && q[1] === cell[1]); st.paths[o] = p.slice(0, at + 1); st.done[o] = false; st.draw = { i: o }; if (PB.sfx) PB.sfx('pick'); }
    }
    function stepTo(cell){
      const i = st.draw.i, p = st.paths[i], last = p[p.length - 1];
      if (cell[0] === last[0] && cell[1] === last[1]) return true;
      // going back along your own line rubs it out
      const back = p.findIndex(q => q[0] === cell[0] && q[1] === cell[1]);
      if (back >= 0) { st.paths[i] = p.slice(0, back + 1); st.done[i] = false; return true; }
      if (st.done[i]) return false;                                   // already holding hands: only backing up is allowed
      if (st.walls.has(wkey(key(...last), key(...cell)))) return bumpWall(last, cell);
      const d = st.dotAt.get(key(...cell));
      if (d != null && d !== i) return blocked(cell);                  // another color's dot
      const o = owner(...cell);
      if (o >= 0 && o !== i) return blocked(cell);                     // can't cross another color's line
      p.push(cell);
      if (d === i && isEnd(i, cell) && p.length > 1) connect(i);
      return true;
    }
    function bumpWall(a, b){
      if (!st.draw.bumped) { st.draw.bumped = true; if (PB.sfx) PB.sfx('nope'); const [x1, y1] = center(a), [x2, y2] = center(b); pop((x1 + x2) / 2, (y1 + y2) / 2 - 12, 'Wall!', '#ffffff', 0.8); if (PB.buzz) PB.buzz('light'); }
      return false;
    }
    function blocked(cell){
      if (!st.draw.bumped) { st.draw.bumped = true; if (PB.sfx) PB.sfx('nope'); const [x, y] = center(cell); pop(x, y - 10, 'No crossing!', '#ffffff', 0.8); if (PB.buzz) PB.buzz('light'); }
      return false;
    }
    function connect(i){
      st.done[i] = true; st.joy[i] = 1; st.moves++;
      const [x1, y1] = center(st.pairs[i].a), [x2, y2] = center(st.pairs[i].b);
      sparkle(x1, y1, COLS[st.pairs[i].color], 14); sparkle(x2, y2, COLS[st.pairs[i].color], 14);
      if (PB.sfx) PB.sfx('seal'); if (PB.buzz) PB.buzz('light');
      const left = st.done.filter(d => !d).length;
      pop(W / 2, BY - 18, left ? ['Yay!', 'Friends!', 'Together!', 'Hooray!', 'High five!'][Math.floor(Math.random() * 5)] : '', COLS[st.pairs[i].color], 1);
    }
    function moveTo(x, y){
      if (!st.draw) return;
      st.look = [x, y];
      const target = cellAt(Math.max(BX + 1, Math.min(BX + BW - 1, x)), Math.max(BY + 1, Math.min(BY + BW - 1, y))); if (!target) return;
      // a quick finger can skip squares: walk there one square at a time
      for (let guard = 0; guard < 30; guard++) {
        const p = st.paths[st.draw.i], last = p[p.length - 1];
        if (last[0] === target[0] && last[1] === target[1]) break;
        const dr = target[0] - last[0], dc = target[1] - last[1];
        const nxt = Math.abs(dr) >= Math.abs(dc) ? [last[0] + Math.sign(dr), last[1]] : [last[0], last[1] + Math.sign(dc)];
        if (!stepTo(nxt)) break;
      }
    }
    function endDraw(){
      if (!st.draw) return;
      const i = st.draw.i; if (st.paths[i].length <= 1) st.paths[i] = [];
      st.draw = null; checkWin();
    }
    function checkWin(){
      if (st.over || !st.done.every(Boolean)) return;
      st.over = true; st.won = true;
      st.score = st.k * 100 + 200 - st.hinted * 50;
      if (PB.sfx) PB.sfx('fanfare');
      for (let i = 0; i < 5; i++) setTimeout(() => st && sparkle(60 + Math.random() * 360, BY + Math.random() * BW, COLS[Math.floor(Math.random() * COLS.length)], 22), i * 160);
      st.msg = st.hinted ? 'All friends together!' : 'Solved with no hints!';
      setTimeout(() => {
        if (st.mode === 'daily') { shell.gameOver(st.score, st.hinted ? 'Daily puzzle solved!' : 'Daily puzzle solved with no hints!'); return; }
        shell.levelDone({ win: true, stars: 3, score: st.score, summary: st.hinted ? `Solved with ${st.hinted} hint${st.hinted === 1 ? '' : 's'}` : 'Solved with no hints. Great thinking!' });
      }, 1300);
    }
    // a hint draws one color's line for you (and moves any line that was in its way)
    function hint(){
      if (st.over || st.hints <= 0) { if (PB.sfx) PB.sfx('nope'); return; }
      const want = st.pairs.findIndex((p, i) => !(st.done[i] && st.paths[i].length === p.sol.length && st.paths[i].every((q, k) => (q[0] === p.sol[k][0] && q[1] === p.sol[k][1]) || (q[0] === p.sol[p.sol.length - 1 - k][0] && q[1] === p.sol[p.sol.length - 1 - k][1]))));
      if (want < 0) return;
      const sol = st.pairs[want].sol;
      st.paths.forEach((p, j) => { if (j !== want && p.some(q => sol.some(s => s[0] === q[0] && s[1] === q[1]))) { st.paths[j] = []; st.done[j] = false; } });
      st.paths[want] = sol.map(q => [q[0], q[1]]); st.hints--; st.hinted++; (st.hintLines = st.hintLines || new Set()).add(want);
      const [x, y] = center(sol[Math.floor(sol.length / 2)]); pop(x, y, 'Like this!', '#fff3a0', 1.2); if (PB.sfx) PB.sfx('power');
      connect(want); checkWin();
    }
    // Clear rubs out your lines but keeps any line a hint drew (you already used that hint)
    function restart(){ if (st.over) return; const keep = st.hintLines || new Set(); st.paths = st.paths.map((p, i) => keep.has(i) ? p : []); st.done = st.done.map((d, i) => keep.has(i) ? d : false); if (PB.sfx) PB.sfx('whoosh'); }

    // ---------- drawing ----------
    const BTN = { hint: [W / 2 - 110, 650, 100, 50], reset: [W / 2 + 10, 650, 100, 50] };
    const inBtn = (b, x, y) => x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
    function bg(){
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b1d6b'); g.addColorStop(1, '#14103a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // soft confetti dots in the background
      const R = mulberry(7); for (let i = 0; i < 40; i++) { ctx.fillStyle = COLS[i % COLS.length] + '22'; ctx.beginPath(); ctx.arc(R() * W, R() * H, 6 + R() * 18, 0, 7); ctx.fill(); }
    }
    function header(){
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(16, 14, W - 32, 96, 20); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff'; ctx.font = `28px ${FONT}`;
      const t = PB.levels.tier(st.level);
      ctx.fillText(st.mode === 'daily' ? 'Daily Puzzle' : `Level ${st.level}`, 32, 52);
      if (t === 'hard' || t === 'super') { const tw = ctx.measureText(st.mode === 'daily' ? 'Daily Puzzle' : `Level ${st.level}`).width; ctx.font = `900 12px ${BODY}`; const lab = t === 'super' ? 'SUPER HARD' : 'HARD', lw = ctx.measureText(lab).width + 14; ctx.fillStyle = t === 'super' ? '#d4145a' : '#ff7a1a'; ctx.beginPath(); ctx.roundRect(40 + tw, 32, lw, 22, 6); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(lab, 47 + tw, 48); }
      const together = st.done.filter(Boolean).length;
      ctx.font = `800 15px ${BODY}`; ctx.fillStyle = '#dcd4ff';
      ctx.fillText(`${together} of ${st.k} friends together`, 32, 80);
      ctx.fillText(st.hinted ? `Hints used: ${st.hinted}` : 'No hints used yet', 32, 100);
      // a row of little faces: one per color, smiling once they're joined
      for (let i = 0; i < st.k; i++) { const gap = st.k > 8 ? 21 : 26, x = W - 38 - (st.k - 1 - i) * gap, y = st.k > 7 ? 96 : 80; face(x, y, 10, COLS[st.pairs[i].color], st.done[i], 0, i); }
      ctx.restore();
    }
    function face(x, y, r, col, happy, bounce, idx){
      ctx.save(); ctx.translate(x, y - bounce * 6); const s = 1 + bounce * 0.25; ctx.scale(s, s);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = r * 0.4; ctx.shadowOffsetY = r * 0.12;
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, col); g.addColorStop(1, PB.shade(col, -0.3));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(40,30,80,.45)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke();
      ctx.strokeStyle = col === '#2b2b38' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.6)'; ctx.lineWidth = Math.max(1.2, r * 0.1); ctx.lineCap = 'round';
      if (happy) { for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * r * 0.34, -r * 0.12, r * 0.16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } ctx.fillStyle = 'rgba(255,120,150,.6)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * r * 0.55, r * 0.16, r * 0.14, 0, 7); ctx.fill(); } }
      else {
        const lx = Math.max(-1, Math.min(1, (st.look[0] - x) / 200)) * r * 0.08, ly = Math.max(-1, Math.min(1, (st.look[1] - y) / 200)) * r * 0.08, bl = st.blink > 0 && (idx % 3 === Math.floor(st.time) % 3);
        for (const sx of [-1, 1]) { if (bl) { ctx.beginPath(); ctx.moveTo(sx * r * 0.34 - r * 0.14, -r * 0.12); ctx.lineTo(sx * r * 0.34 + r * 0.14, -r * 0.12); ctx.stroke(); continue; }
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * r * 0.34, -r * 0.12, r * 0.2, 0, 7); ctx.fill(); ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(sx * r * 0.34 + lx, -r * 0.12 + ly, r * 0.11, 0, 7); ctx.fill(); } }
      ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.32, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      if (PB.prefs.symbols && r > 14) PB.symbol(ctx, idx != null ? st.pairs[idx].color : 0, r * 0.62, -r * 0.62, r * 0.28);
      ctx.restore();
    }
    function board(){
      const n = st.n, cs = st.cs;
      ctx.save(); if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random() - 0.5) * st.shake, 0);
      ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.beginPath(); ctx.roundRect(BX - 8, BY - 8, BW + 16, BW + 16, 22); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#f3efff'; ctx.beginPath(); ctx.roundRect(BX, BY, BW, BW, 16); ctx.fill();
      // squares the lines pass through get a soft tint of their color
      st.paths.forEach((p, i) => { ctx.fillStyle = COLS[st.pairs[i].color] + (st.done[i] ? '40' : '26'); for (const [r, c] of p) ctx.fillRect(BX + c * cs + 1, BY + r * cs + 1, cs - 2, cs - 2); });
      ctx.strokeStyle = 'rgba(90,70,160,.18)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 1; k < n; k++) { ctx.moveTo(BX + k * cs, BY + 6); ctx.lineTo(BX + k * cs, BY + BW - 6); ctx.moveTo(BX + 6, BY + k * cs); ctx.lineTo(BX + BW - 6, BY + k * cs); }
      ctx.stroke();
      // walls: thick bars on the edge between two squares
      if (st.walls.size) { ctx.save(); ctx.lineCap = 'round';
        for (const w of st.walls) { const [a, b] = w.split('-').map(Number), ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
          let x1, y1, x2, y2; if (ra === rb) { x1 = x2 = BX + Math.max(ca, cb) * cs; y1 = BY + ra * cs + 3; y2 = y1 + cs - 6; } else { y1 = y2 = BY + Math.max(ra, rb) * cs; x1 = BX + ca * cs + 3; x2 = x1 + cs - 6; }
          ctx.strokeStyle = 'rgba(20,10,50,.35)'; ctx.lineWidth = cs * 0.16; ctx.beginPath(); ctx.moveTo(x1, y1 + 2); ctx.lineTo(x2, y2 + 2); ctx.stroke();
          ctx.strokeStyle = '#5a4a8a'; ctx.lineWidth = cs * 0.14; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = cs * 0.04; ctx.beginPath(); ctx.moveTo(x1, y1 - cs * 0.03); ctx.lineTo(x2, y2 - cs * 0.03); ctx.stroke(); }
        ctx.restore(); }
      // the lines
      st.paths.forEach((p, i) => {
        if (p.length < 2) return; const col = COLS[st.pairs[i].color];
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = PB.shade(col, -0.25); ctx.lineWidth = cs * 0.42; ctx.beginPath(); p.forEach((q, k) => { const [x, y] = center(q); k ? ctx.lineTo(x, y + 2) : ctx.moveTo(x, y + 2); }); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = cs * 0.36; ctx.beginPath(); p.forEach((q, k) => { const [x, y] = center(q); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = cs * 0.1; ctx.beginPath(); p.forEach((q, k) => { const [x, y] = center(q); k ? ctx.lineTo(x - cs * 0.05, y - cs * 0.07) : ctx.moveTo(x - cs * 0.05, y - cs * 0.07); }); ctx.stroke();
      });
      // the dot friends
      st.pairs.forEach((p, i) => { for (const e of [p.a, p.b]) { const [x, y] = center(e); face(x, y, cs * 0.36, COLS[p.color], st.done[i], st.joy[i] * Math.abs(Math.sin(st.joy[i] * 9)), i); } });
      // a glow on the end of the line you're drawing
      if (st.draw) { const p = st.paths[st.draw.i], [x, y] = center(p[p.length - 1]); ctx.fillStyle = COLS[st.pairs[st.draw.i].color] + '55'; ctx.beginPath(); ctx.arc(x, y, cs * 0.55, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    function buttons(){
      const btn = (b, label, sub, on) => { ctx.save(); ctx.globalAlpha = on ? 1 : 0.45; ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowOffsetY = 4; ctx.beginPath(); ctx.roundRect(...b, 25); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#2b1d6b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `20px ${FONT}`; ctx.fillText(label, b[0] + b[2] / 2, b[1] + (sub ? 20 : b[3] / 2)); if (sub) { ctx.font = `800 11px ${BODY}`; ctx.fillStyle = '#7a6ab8'; ctx.fillText(sub, b[0] + b[2] / 2, b[1] + 38); } ctx.restore(); };
      btn(BTN.hint, '\u{1F4A1} Hint', `${st.hints} left`, st.hints > 0 && !st.over);
      btn(BTN.reset, '↺ Clear', '', !st.over);
    }
    function draw(){
      bg(); header(); board(); buttons();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life / 0.8); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) { if (!q.text) continue; ctx.save(); ctx.globalAlpha = Math.min(1, q.life / q.max * 2); ctx.font = `24px ${FONT}`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,10,50,.7)'; ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y); ctx.restore(); }
      if (st.msg) { ctx.save(); ctx.font = `26px ${FONT}`; const w = Math.min(W - 40, ctx.measureText(st.msg).width + 50), y = BY + BW / 2; ctx.fillStyle = 'rgba(43,29,107,.92)'; ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - 30, w, 60, 30); ctx.fill(); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(st.msg, W / 2, y + 2, W - 60); ctx.restore(); }
      else if (st.intro > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, st.intro); ctx.font = `20px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(st.introText || 'Drag from a dot to its twin!', W / 2, BY + BW + 30); ctx.restore(); }
    }
    function update(dt){
      st.time += dt; st.intro = Math.max(0, (st.intro || 0) - dt);
      st.blink = (st.time % 3.3) < 0.15 ? 1 : 0;
      for (let i = 0; i < st.joy.length; i++) st.joy[i] = Math.max(0, st.joy[i] - dt * 1.6);
      for (const q of st.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.life -= dt; } st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.y -= 30 * dt; q.life -= dt; } st.pops = st.pops.filter(q => q.life > 0);
      st.shake = Math.max(0, st.shake - dt * 30);
    }

    // a little puzzle picture for the hub tile
    function artTile(g){
      const gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, '#3a2a8a'); gr.addColorStop(1, '#1d1550'); g.fillStyle = gr; g.fillRect(0, 0, 240, 180);
      g.fillStyle = '#f3efff'; g.beginPath(); g.roundRect(45, 15, 150, 150, 14); g.fill();
      const cs = 30, at = (r, c) => [45 + (c + 0.5) * cs, 15 + (r + 0.5) * cs];
      const lines = [[COLS[0], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4]]], [COLS[1], [[1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2]]], [COLS[2], [[1, 1], [1, 2], [1, 3], [2, 3], [3, 3]]], [COLS[3], [[2, 1], [2, 2], [3, 2], [3, 1]]]];
      for (const [col, p] of lines) { g.strokeStyle = col; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); p.forEach((q, k) => { const [x, y] = at(...q); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
        for (const e of [p[0], p[p.length - 1]]) { const [x, y] = at(...e); g.fillStyle = col; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; for (const sx of [-1, 1]) { g.beginPath(); g.arc(x + sx * 4, y - 1.5, 1.8, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } g.beginPath(); g.arc(x, y + 1.5, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); } }
      for (const [r, c, col] of [[4, 3, COLS[4]], [4, 4, COLS[4]], [2, 4, COLS[5]], [3, 4, COLS[5]]]) { const [x, y] = at(r, c); g.fillStyle = col; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); }
    }

    return {
      id: 'dots', sfxScore: false, music: 'dots', title: 'DOT FRIENDS', W, H, statLabel: 'Friends', type: 'levels', levels: 500, maxLives: 0, noStars: true,
      tile: { order: 9, name: 'Dot Friends', kind: 'Connect the dots · no timer', art: artTile, isNew: true },
      dailyText: 'One big puzzle a day. Take your time!',
      controls: ['Put your finger on a dot and draw a line to the dot of the same color.', 'Lines can’t cross, and they can’t go through another color or a wall.', 'Go back over your line to rub it out, or tap a dot to start that color again.', 'Connect every pair to win. You don\u2019t have to fill the board.', 'There’s no timer, so take your time. You can stop and come back any time.', 'Stuck? Tap Hint and a friend will show you one line.'],
      powersTitle: 'Helpers',
      powers: [
        { name: 'Hint', desc: 'Draws one line for you. 3 per puzzle', icon: g => { g.font = '20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u{1F4A1}', 23, 15); } },
        { name: 'Clear', desc: 'Rubs out every line so you can start over', icon: g => { g.font = '20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('↺', 23, 15); } },
      ],
      init(){},
      preview(){ fresh('classic', 1); },
      start(mode, rand, lives, msg, level){ fresh(mode, level); st.intro = st.level === 1 || st.level === 'daily' ? 5 : 2.5; if (st.level === 15) { st.introText = 'New! Walls: lines can\u2019t go through them'; st.intro = 5; } },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: null, stat: `${st.done.filter(Boolean).length}/${st.k}`, score: st.score || 0 }; },
      metrics(){ return { score: st.score || 0, won: st.won ? 1 : 0, nohint: st.won && !st.hinted ? 1 : 0, hints: st.hinted }; },
      dailyGoals: [
        { text: 'Solve {n} puzzles today', m: 'won', n: [2, 3, 4] },
        { text: 'Solve {n} puzzles without a hint today', m: 'nohint', n: [1, 2] },
      ],
      debug(){ return { st, makePuzzle, stuckRate, effort, solveLikeAPerson, addWalls, makeOne, stepTo, startAt, moveTo, endDraw, hint, center, levelSize }; },
      pointerDown(x, y){
        if (st.over) return;
        if (inBtn(BTN.hint, x, y)) { hint(); return; }
        if (inBtn(BTN.reset, x, y)) { restart(); return; }
        st.look = [x, y]; startAt(x, y);
      },
      pointerMove(x, y){ st.look = [x, y]; moveTo(x, y); },
      pointerUp(){ endDraw(); },
      key(e){ if (e.key === 'h') hint(); },
    };
  }
  PB.register(createDots);
})();
