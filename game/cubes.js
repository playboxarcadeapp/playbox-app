// CUBE ESCAPE: neon sliding-block puzzle. Drag each block out through the exit bar of its color.
(function(){
  const { N, fmt, reduceMotion, ctx, mulberry, seedFrom, neonBg, rr } = PB;

  function createCubes(shell){
    const W = 480, H = 690, MAX_LIVES = 5;
    const DISPLAY = '"Orbitron", "Arial Black", sans-serif';
    const COLS = [N.cyan, N.pink, N.lime, N.yellow, N.orange, N.violet];
    const SHAPES = [
      [[0,0]], [[0,0],[0,1]], [[0,0],[1,0]], [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
      [[0,0],[0,1],[1,0],[1,1]], [[0,0],[1,0],[1,1]], [[0,1],[1,0],[1,1]], [[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]],
    ];
    const DIRS = { top:[-1,0], bottom:[1,0], left:[0,-1], right:[0,1] };
    let st = null;

    // ---------- Level generation (built backwards from a solved board, so every level can be solved) ----------
    function genLevel(L, R){
      const size = L <= 2 ? 6 : L <= 6 ? 7 : 8;
      const nColors = Math.min(3 + Math.floor((L - 1) / 2), 6);
      const target = Math.min(7 + L, 18);
      for (let attempt = 0; attempt < 30; attempt++) {
        const exits = [];
        for (let c=0;c<nColors;c++) {
          for (let tries=0; tries<40; tries++) {
            const side = ['top','bottom','left','right'][Math.floor(R()*4)];
            const len = R() < 0.5 ? 2 : R() < 0.5 ? 1 : 3;
            const start = Math.floor(R() * (size - len + 1));
            if (exits.some(e => e.side === side && start < e.start + e.len + 1 && e.start < start + len + 1)) continue;
            exits.push({ side, start, len, color: c }); break;
          }
        }
        if (exits.length < nColors) continue;
        const blocks = [];
        const occ = () => { const g = Array.from({length:size}, () => Array(size).fill(-1)); blocks.forEach((b, i) => b.cells.forEach(([dr,dc]) => g[b.r+dr][b.c+dc] = i)); return g; };
        const fits = (b, r, c, self) => { const g = occ(); return b.cells.every(([dr,dc]) => { const rr = r+dr, cc = c+dc; return rr >= 0 && rr < size && cc >= 0 && cc < size && (g[rr][cc] === -1 || g[rr][cc] === self); }); };
        const scramble = (steps) => {
          for (let s=0;s<steps;s++) {
            const i = Math.floor(R() * blocks.length), b = blocks[i];
            const [dr, dc] = Object.values(DIRS)[Math.floor(R()*4)];
            const dist = 1 + Math.floor(R() * 3);
            for (let k=0;k<dist;k++) { if (fits(b, b.r+dr, b.c+dc, i)) { b.r += dr; b.c += dc; } else break; }
          }
        };
        for (let i=0; i<target; i++) {
          const color = i % nColors, e = exits.find(x => x.color === color);
          const along = e.side === 'top' || e.side === 'bottom' ? 1 : 0;
          const options = SHAPES.filter(sh => { const span = Math.max(...sh.map(p => p[along])) + 1; return span <= e.len; });
          let placed = false;
          for (let tries=0; tries<12 && !placed; tries++) {
            const cells = options[Math.floor(R() * options.length)];
            const hR = Math.max(...cells.map(p => p[0])) + 1, hC = Math.max(...cells.map(p => p[1])) + 1;
            const spanA = along ? hC : hR;
            const off = e.start + Math.floor(R() * (e.len - spanA + 1));
            let r, c;
            if (e.side === 'top') { r = 0; c = off; } else if (e.side === 'bottom') { r = size - hR; c = off; }
            else if (e.side === 'left') { c = 0; r = off; } else { c = size - hC; r = off; }
            const b = { color, cells, r, c };
            if (fits(b, r, c, -2)) { blocks.push(b); placed = true; scramble(4 + Math.min(L, 12)); }
            else scramble(3);
          }
        }
        scramble(24 + L * 3);
        if (blocks.length >= Math.min(target - 2, 7)) return { size, exits, blocks, colors: nColors };
      }
      return genLevel(Math.max(1, L - 1), R);
    }

    function fresh(mode, rand, lives, phase){
      st = { mode, phase, rand, lives, score:0, level:1, parts:[], pops:[], shake:0, msg:null, clock:0, freezeT:0, freezes:1, running:false };
      loadLevel();
    }
    function loadLevel(){
      const R = st.mode === 'daily' ? mulberry(seedFrom('cubes-daily-' + PB.today() + '-' + st.level)) : st.rand;
      const lv = genLevel(st.level + 5, R);
      st.size = lv.size; st.exits = lv.exits;
      st.blocks = lv.blocks.map((b, i) => ({ ...b, id: i, vx: b.c, vy: b.r, out: null }));
      st.cell = Math.min(54, Math.floor(400 / st.size));
      st.bx = Math.round((W - st.cell * st.size) / 2); st.by = 160 + Math.round((440 - st.cell * st.size) / 2);
      st.timeMax = Math.round((12 + st.blocks.length * 4.4) * Math.max(0.72, 1 - st.level * 0.012));
      st.time = st.timeMax; st.running = false; st.drag = null; st.freezes = 1; st.freezeT = 0;
    }
    const occupied = (self) => { const g = Array.from({length:st.size}, () => Array(st.size).fill(-1)); st.blocks.forEach(b => { if (!b.out && b.id !== self) b.cells.forEach(([dr,dc]) => g[b.r+dr][b.c+dc] = b.id); }); return g; };
    function tryStep(b, dr, dc, g){
      const nr = b.r + dr, nc = b.c + dc;
      let outside = false;
      for (const [r0, c0] of b.cells) {
        const r = nr + r0, c = nc + c0;
        if (r < 0 || r >= st.size || c < 0 || c >= st.size) { outside = true; continue; }
        if (g[r][c] !== -1) return 'blocked';
      }
      if (!outside) { b.r = nr; b.c = nc; return 'moved'; }
      const side = dr < 0 ? 'top' : dr > 0 ? 'bottom' : dc < 0 ? 'left' : 'right';
      const e = st.exits.find(x => x.side === side && x.color === b.color);
      if (!e) { if (PB.sfx && !(st.bump && st.bump.id === b.id && st.bump.t > 0)) PB.sfx('nope'); st.bump = { id: b.id, t: 0.2 }; return 'blocked'; }
      const along = side === 'top' || side === 'bottom';
      const lo = Math.min(...b.cells.map(p => along ? b.c + p[1] : b.r + p[0])), hi = Math.max(...b.cells.map(p => along ? b.c + p[1] : b.r + p[0]));
      if (lo >= e.start && hi < e.start + e.len) { exitBlock(b, side); return 'exit'; }
      st.bump = { id: b.id, t: 0.2 }; return 'blocked';
    }
    function exitBlock(b, side){
      b.out = { side, t: 0 }; st.drag = null; if (PB.sfx) PB.sfx('exit');
      st.score += 50 * st.level;
      const [dr, dc] = DIRS[side];
      const cx = st.bx + (b.c + 0.5) * st.cell, cy = st.by + (b.r + 0.5) * st.cell;
      burst(cx + dc * st.cell, cy + dr * st.cell, COLS[b.color], 18);
      pop(W/2, st.by - 26, ['Nice!','Zoom!','Escaped!','Smooth!'][Math.floor(Math.random()*4)], COLS[b.color]);
      if (st.blocks.every(x => x.out)) levelClear();
    }
    function levelClear(){
      const bonus = Math.ceil(st.time) * 5 + 100 * st.level;
      st.score += bonus; st.running = false;
      pop(W/2, st.by + 200, 'LEVEL CLEAR!', N.lime, 1.6);
      pop(W/2, st.by + 240, '+' + fmt(bonus) + ' time bonus', N.yellow, 1.6);
      st.level++;
      st.pending = 1.4;
    }
    function timeUp(){
      st.running = false; st.lives--; st.shake = 10;
      if (st.lives <= 0) { st.phase = 'over'; shell.gameOver(st.score, `You reached level ${st.level}`); return; }
      pop(W/2, st.by + 200, "Time's up!", N.red, 1.4);
      st.retry = 1.2;
    }
    function burst(x, y, color, n){
      if (reduceMotion) return;
      for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, s = 60 + Math.random()*200; st.parts.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: .6, color, size: 2 + Math.random()*3 }); }
    }
    function pop(x, y, text, color, life){ st.pops.push({ x, y, text, color, life: life || 1 }); }

    function update(dt){
      st.clock += dt;
      if (st.phase === 'play') {
        if (st.running) {
          if (st.freezeT > 0) st.freezeT = Math.max(0, st.freezeT - dt);
          else { st.time = Math.max(0, st.time - dt); if (st.time <= 0) timeUp(); }
        }
        if (st.pending != null) { st.pending -= dt; if (st.pending <= 0) { st.pending = null; loadLevel(); st.msg = `Level ${st.level} \u00b7 Tap to start`; } }
        if (st.retry != null) { st.retry -= dt; if (st.retry <= 0) { st.retry = null; const keep = st.level; loadLevel(); st.level = keep; st.msg = 'Try again! Tap to start'; } }
      }
      for (const b of st.blocks) {
        if (b.out) { b.out.t += dt / 0.35; continue; }
        // while dragged the block glides right under your finger; let go and it settles into its square
        const tx = b.fc != null ? b.fc : b.c, ty = b.fr != null ? b.fr : b.r, k = Math.min(1, dt * (b.fc != null || b.fr != null ? 36 : 22));
        b.vx += (tx - b.vx) * k; b.vy += (ty - b.vy) * k;
      }
      if (st.bump) { st.bump.t -= dt; if (st.bump.t <= 0) st.bump = null; }
      for (const q of st.parts) { q.x += q.vx*dt; q.y += q.vy*dt; q.vx *= 0.96; q.vy *= 0.96; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.y -= 30*dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      st.shake = Math.max(0, st.shake - dt*30);
    }

    // ---------- Drawing ----------
    // glossy jelly-glass blocks with a soft drop shadow, bevelled edges and a glowing core
    function drawBlock(b, alpha, ox, oy){
      const cs = st.cell, col = COLS[b.color];
      const lifted = st.drag && st.drag.id === b.id, lift = lifted ? 4 : 0;
      const bx = st.bx + b.vx * cs + ox, by = st.by + b.vy * cs + oy - lift;
      const set = new Set(b.cells.map(([r,c]) => r + ',' + c));
      const pad = 3, rad = 10;
      const shape = (dx, dy, inset) => {
        ctx.beginPath();
        for (const [r,c] of b.cells) {
          ctx.roundRect(bx + c*cs + pad + inset + dx, by + r*cs + pad + inset + dy, cs - (pad + inset)*2, cs - (pad + inset)*2, rad);
          if (set.has(r + ',' + (c+1))) ctx.rect(bx + c*cs + cs - pad - inset - 2 + dx, by + r*cs + pad + inset + dy, (pad + inset)*2 + 4, cs - (pad + inset)*2);
          if (set.has((r+1) + ',' + c)) ctx.rect(bx + c*cs + pad + inset + dx, by + r*cs + cs - pad - inset - 2 + dy, cs - (pad + inset)*2, (pad + inset)*2 + 4);
        }
      };
      ctx.save(); ctx.globalAlpha = alpha;
      // shadow on the board
      ctx.fillStyle = 'rgba(0,0,0,.45)'; shape(3 + lift, 6 + lift * 1.5, 0); ctx.fill();
      // outer glow + body
      ctx.shadowColor = col; ctx.shadowBlur = lifted ? 30 : 16;
      const top = by + Math.min(...b.cells.map(p => p[0])) * cs, bot = by + (Math.max(...b.cells.map(p => p[0])) + 1) * cs;
      const body = ctx.createLinearGradient(0, top, 0, bot); body.addColorStop(0, PB.shade(col, 0.35)); body.addColorStop(0.45, col); body.addColorStop(1, PB.shade(col, -0.45));
      // filled in layers (dark rim, bright bevel, body) so joined cells stay one seamless piece
      ctx.fillStyle = PB.shade(col, -0.6); shape(0, 0, -1.5); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = PB.shade(col, 0.6); shape(0, 0, 0); ctx.fill();
      ctx.fillStyle = body; shape(0, 1, 2.5); ctx.fill();
      // per-cell glass shine and glowing core
      for (const [r,c] of b.cells) {
        const x = bx + c*cs + pad, y = by + r*cs + pad, sz = cs - pad*2;
        const g = ctx.createLinearGradient(0, y, 0, y + sz * 0.55); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 6, y + 5, sz - 12, sz * 0.4, [8, 8, 14, 14]); ctx.fill();
        const cx = x + sz / 2, cy = y + sz * 0.58, core = ctx.createRadialGradient(cx, cy, 1, cx, cy, sz * 0.3);
        core.addColorStop(0, 'rgba(255,255,255,.9)'); core.addColorStop(0.35, PB.shade(col, 0.5)); core.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = core; ctx.fillRect(cx - sz * 0.3, cy - sz * 0.3, sz * 0.6, sz * 0.6); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x + 11, y + 10, 4, 2.2, -0.5, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // a cyber "server room" backdrop with circuit traces; light pulses run along them
    let bgL = null, TRACES = null;
    function paintBg(){
      bgL = PB.layer(W, H); const g = bgL[1];
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#061428'); bg.addColorStop(0.6, '#040a18'); bg.addColorStop(1, '#02050c');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const R = mulberry(5); TRACES = [];
      g.lineCap = 'round';
      for (let i=0;i<34;i++) {
        let x = R() * W, y = R() * H; const pts = [[x, y]];
        for (let k=0;k<4;k++) { if (R() < 0.5) x += (R() - .5) * 160; else y += (R() - .5) * 160; pts.push([x, y]); }
        TRACES.push({ pts, col: COLS[Math.floor(R() * COLS.length)], ph: R(), sp: 0.08 + R() * 0.12 });
        g.strokeStyle = 'rgba(80,140,200,.16)'; g.lineWidth = 2; g.beginPath(); pts.forEach(([px, py], j) => j ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
        for (const [px, py] of [pts[0], pts[pts.length - 1]]) { g.fillStyle = 'rgba(120,190,255,.25)'; g.beginPath(); g.arc(px, py, 3, 0, 7); g.fill(); }
      }
      // soft hex glow behind the board
      const glow = g.createRadialGradient(W/2, H * 0.55, 20, W/2, H * 0.55, 360); glow.addColorStop(0, 'rgba(61,255,181,.14)'); glow.addColorStop(1, 'rgba(61,255,181,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
    }
    // ---------- 3D look: jelly-glass blocks that lift when you drag them ----------
    let E3 = null, A3 = null, boardKey = '', boardL = null;
    function assets3D(){
      if (A3) return A3; if (A3 === false) return null;
      E3 = PB.gl3d && PB.gl3d.get(); if (!E3) { A3 = false; return null; }
      A3 = { shapes: new Map(), pill: E3.mesh(E3.G.roundBox(1, 1, 1, 0.45, 4)), tBoard: null };
      return A3;
    }
    const hex3 = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
    function shapeMesh(b){
      const cs = st.cell, key = cs + ':' + b.cells.map(p => p.join(',')).sort().join(';');
      if (A3.shapes.has(key)) return A3.shapes.get(key);
      const G = E3.G, M = E3.M, set = new Set(b.cells.map(([r, c]) => r + ',' + c)), parts = [], d = cs * 0.62, sz = cs - 6;
      for (const [r, c] of b.cells) {
        parts.push(G.transform(G.roundBox(sz, sz, d, Math.min(11, sz * 0.24), 5), M.trs([c * cs + cs / 2, -(r * cs + cs / 2), 0])));
        if (set.has(r + ',' + (c + 1))) parts.push(G.transform(G.box(14, sz - 8, d - 4), M.trs([c * cs + cs, -(r * cs + cs / 2), 0])));
        if (set.has((r + 1) + ',' + c)) parts.push(G.transform(G.box(sz - 8, 14, d - 4), M.trs([c * cs + cs / 2, -(r * cs + cs), 0])));
      }
      const m = E3.mesh(G.merge(parts)); A3.shapes.set(key, m); if (A3.shapes.size > 80) A3.shapes.delete(A3.shapes.keys().next().value);
      return m;
    }
    // the backdrop with the board for this level painted in (repainted when the board size changes)
    function paintBoardBackdrop(){
      if (!bgL) paintBg();
      if (!boardL) boardL = PB.layer(W, H);
      const g = boardL[1], cs = st.cell, s = st.size, bw = cs * s;
      g.clearRect(0, 0, W, H); g.drawImage(bgL[0], 0, 0, W, H);
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
      const bk = PB.meta && PB.meta.look('cubes', 'box'), BC = bk === 'box_gold' ? ['#ffe08a', '#c7901f', '#6a4206'] : bk === 'box_pink' ? ['#ffb0e0', '#c0408a', '#5a1440'] : ['#3a4f6e', '#1a2840', '#0c1424'];
      const fr = g.createLinearGradient(0, st.by - 18, 0, st.by + bw + 18); fr.addColorStop(0, BC[0]); fr.addColorStop(0.5, BC[1]); fr.addColorStop(1, BC[2]);
      g.fillStyle = fr; g.beginPath(); g.roundRect(st.bx - 18, st.by - 18, bw + 36, bw + 36, 22); g.fill(); g.restore();
      g.strokeStyle = 'rgba(160,210,255,.35)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(st.bx - 17, st.by - 17, bw + 34, bw + 34, 21); g.stroke();
      for (const [qx, qy] of [[st.bx - 9, st.by - 9], [st.bx + bw + 9, st.by - 9], [st.bx - 9, st.by + bw + 9], [st.bx + bw + 9, st.by + bw + 9]]) { g.fillStyle = '#7f95b8'; g.beginPath(); g.arc(qx, qy, 3.2, 0, 7); g.fill(); g.fillStyle = '#2a3a55'; g.fillRect(qx - 2.2, qy - 0.6, 4.4, 1.2); }
      g.fillStyle = '#081222'; g.beginPath(); g.roundRect(st.bx - 6, st.by - 6, bw + 12, bw + 12, 12); g.fill();
      for (let r=0;r<s;r++) for (let c=0;c<s;c++) {
        const x = st.bx + c*cs + 2, y = st.by + r*cs + 2, z = cs - 4;
        const tg = g.createLinearGradient(0, y, 0, y + z); tg.addColorStop(0, '#132744'); tg.addColorStop(1, '#0a172a');
        g.fillStyle = tg; g.beginPath(); g.roundRect(x, y, z, z, 7); g.fill();
        g.strokeStyle = 'rgba(61,255,181,.1)'; g.lineWidth = 1; g.stroke();
        g.fillStyle = 'rgba(160,210,255,.06)'; g.fillRect(x + 5, y + 3, z - 10, 2);
      }
      if (!A3.tBoard) A3.tBoard = E3.texture(boardL[0], { repeat: false }); else E3.updateTexture(A3.tBoard, boardL[0]);
    }
    function draw3D(tile){
      const E = E3, M = E.M, P3 = E.px, cs = st.cell, bw = cs * st.size;
      const key = st.size + '|' + cs + '|' + st.bx + '|' + st.by + '|' + ((PB.meta && PB.meta.look('cubes', 'box')) || ''); if (key !== boardKey) { boardKey = key; paintBoardBackdrop(); }
      E.resize(W, H, tile ? 1 : E.quality(1.5));
      const sx = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0, sy = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0;
      E.begin({ ortho: [W, H], pos: [-sx, sy, 1500], target: [-sx, sy, 0] }, {
        noSky: true, sunDir: [0.55, -0.65, -0.5], sunColor: [1.05, 1.1, 1.2], ambSky: [0.16, 0.22, 0.32], ambGround: [0.04, 0.07, 0.1], toon: 0.2,
        shadow: { center: [W / 2, -(st.by + bw / 2), 0], radius: 320 },
        post: { bloom: 0.7, threshold: 0.82, saturation: 1.18, contrast: 1.08, vignette: 0.35 },
      });
      E.backdrop(A3.tBoard, W, H, { shadow: 0.55 });
      // exits glow like neon doors
      for (const e of st.exits) {
        const c = hex3(COLS[e.color]), pulse = reduceMotion ? 1 : 0.75 + Math.sin(st.clock * 4 + e.color) * 0.25;
        let x, y, w, h;
        if (e.side === 'top') { x = st.bx + e.start*cs + 3; y = st.by - 14; w = e.len*cs - 6; h = 8; }
        else if (e.side === 'bottom') { x = st.bx + e.start*cs + 3; y = st.by + bw + 6; w = e.len*cs - 6; h = 8; }
        else if (e.side === 'left') { x = st.bx - 14; y = st.by + e.start*cs + 3; w = 8; h = e.len*cs - 6; }
        else { x = st.bx + bw + 6; y = st.by + e.start*cs + 3; w = 8; h = e.len*cs - 6; }
        E.draw(A3.pill, M.trs(P3(x + w / 2, y + h / 2, 6), [0, 0, 0], [w, h, 8]), { color: c, emissive: c.map(v => v * (0.6 + 0.5 * pulse)), spec: 1.2, shine: 60, noShadow: true });
        E.light(P3(x + w / 2, y + h / 2, 30), c.map(v => v * 1.2 * pulse), 90);
      }
      // blocks
      for (const b of st.blocks) {
        let ox = 0, oy = 0, alpha = 1;
        if (b.out) { if (b.out.t >= 1) continue; const [dr, dc] = DIRS[b.out.side], d = b.out.t * cs * 3; ox = dc * d; oy = dr * d; alpha = 1 - b.out.t; }
        else if (st.bump && st.bump.id === b.id) ox = Math.sin(st.clock * 70) * 3;
        const lifted = st.drag && st.drag.id === b.id, c = hex3(COLS[b.color]);
        const x0 = st.bx + b.vx * cs + ox, y0 = st.by + b.vy * cs + oy, z = (lifted ? 26 : 12) + cs * 0.31;
        const wob = lifted ? Math.sin(st.clock * 9) * 0.03 : 0;
        E.draw(shapeMesh(b), M.trs(P3(x0, y0, z), [wob, -wob, 0], [1, 1, 1]), { color: c, emissive: c.map(v => v * (lifted ? 0.16 : 0.07)), spec: 1.8, shine: 120, rim: 0.4, alpha: alpha < 1 ? alpha : undefined });
        // a glowing core inside every cell
        for (const [r, cc] of b.cells) E.sprite(P3(x0 + cc * cs + cs / 2, y0 + r * cs + cs / 2, z + cs * 0.35), cs * 0.62, c.map(v => v * 0.7 + 0.3), 0.22 * alpha, true);
      }
      E.end(); if (!tile) E.present(ctx, W, H);
    }
    function draw(){
      if (assets3D()) return drawWith3D();
      drawFlat();
    }
    function drawWith3D(){
      draw3D();
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      const cs = st.cell, bw = cs * st.size;
      if (!reduceMotion) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const t of TRACES) {
          const segs = t.pts.length - 1, u = ((st.clock * t.sp + t.ph) % 1) * segs, k = Math.floor(u), f = u - k;
          const a = t.pts[k], b2 = t.pts[k + 1], px = a[0] + (b2[0] - a[0]) * f, py = a[1] + (b2[1] - a[1]) * f;
          if (px > st.bx - 24 && px < st.bx + bw + 24 && py > st.by - 24 && py < st.by + bw + 24) continue;
          const pg = ctx.createRadialGradient(px, py, 0, px, py, 14); pg.addColorStop(0, t.col); pg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.55; ctx.fillStyle = pg; ctx.fillRect(px - 14, py - 14, 28, 28);
        }
        ctx.restore(); }
      drawHeader();
      for (const e of st.exits) { const col = COLS[e.color], [dr, dc] = DIRS[e.side]; ctx.fillStyle = col; ctx.globalAlpha = 0.6;
        let x, y, w, h;
        if (e.side === 'top') { x = st.bx + e.start*cs + 3; y = st.by - 14; w = e.len*cs - 6; h = 8; } else if (e.side === 'bottom') { x = st.bx + e.start*cs + 3; y = st.by + bw + 6; w = e.len*cs - 6; h = 8; } else if (e.side === 'left') { x = st.bx - 14; y = st.by + e.start*cs + 3; w = 8; h = e.len*cs - 6; } else { x = st.bx + bw + 6; y = st.by + e.start*cs + 3; w = 8; h = e.len*cs - 6; }
        for (let k=0;k<e.len;k++) { const cx = e.side === 'top' || e.side === 'bottom' ? st.bx + (e.start + k + 0.5)*cs : x + w/2 + dc * 14, cy = e.side === 'left' || e.side === 'right' ? st.by + (e.start + k + 0.5)*cs : y + h/2 + dr * 14;
          ctx.beginPath(); if (dr) { ctx.moveTo(cx - 6, cy - dr*3); ctx.lineTo(cx + 6, cy - dr*3); ctx.lineTo(cx, cy + dr*5); } else { ctx.moveTo(cx - dc*3, cy - 6); ctx.lineTo(cx - dc*3, cy + 6); ctx.lineTo(cx + dc*5, cy); } ctx.closePath(); ctx.fill(); }
        ctx.globalAlpha = 1; }
      drawFooter();
    }
    function drawHeader(){
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#e9fff6'; ctx.font = `900 22px ${DISPLAY}`; ctx.fillText(st.mode === 'daily' ? `DAILY \u00b7 ${st.level}` : `LEVEL ${st.level}`, 22, 44);
      const left = st.blocks.filter(b => !b.out).length;
      ctx.fillStyle = '#8fb3cf'; ctx.font = `700 13px "Nunito", sans-serif`; ctx.fillText(`${left} block${left === 1 ? '' : 's'} to free`, 22, 66);
      const frac = st.time / st.timeMax, tw = W - 44, ty = 84;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.roundRect(22, ty, tw, 10, 5); ctx.fill();
      const tc = st.freezeT > 0 ? '#9fe8ff' : frac > 0.5 ? '#3dffb5' : frac > 0.25 ? N.yellow : N.red;
      ctx.save(); ctx.shadowColor = tc; ctx.shadowBlur = 10; ctx.fillStyle = tc; ctx.beginPath(); ctx.roundRect(22, ty, Math.max(10, tw * frac), 10, 5); ctx.fill(); ctx.restore();
      ctx.textAlign = 'right'; ctx.fillStyle = '#e9fff6'; ctx.font = `700 16px ${DISPLAY}`; ctx.fillText(Math.ceil(st.time) + 's', W - 22, 66);
    }
    function drawFooter(){
      const fy = H - 46;
      ctx.globalAlpha = st.freezes > 0 && st.running ? 1 : 0.4;
      ctx.save(); ctx.shadowColor = '#9fe8ff'; ctx.shadowBlur = st.freezeT > 0 ? 20 : 8;
      ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 2; ctx.fillStyle = '#0c1828';
      ctx.beginPath(); ctx.roundRect(W/2 - 80, fy - 22, 160, 44, 22); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#dff8ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 14px ${DISPLAY}`;
      ctx.fillText(st.freezeT > 0 ? `FROZEN ${Math.ceil(st.freezeT)}s` : `FREEZE TIME (${st.freezes})`, W/2, fy + 1);
      ctx.globalAlpha = 1;
      if (st.freezeT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,200,255,.08)'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      ctx.globalCompositeOperation = 'lighter';
      for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life / 0.6); ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, q.size, q.size); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) { ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.fillStyle = q.color; ctx.shadowColor = q.color; ctx.shadowBlur = 12; ctx.font = `900 22px ${DISPLAY}`; ctx.fillText(q.text, q.x, q.y); ctx.restore(); }
      if (st.msg && st.phase === 'play') {
        ctx.font = `900 16px ${DISPLAY}`;
        const tw2 = Math.min(ctx.measureText(st.msg).width + 40, W - 30), y = st.by + st.cell * st.size / 2;
        ctx.fillStyle = 'rgba(5,10,20,.88)'; ctx.beginPath(); ctx.roundRect(W/2 - tw2/2, y - 24, tw2, 48, 24); ctx.fill();
        ctx.strokeStyle = '#3dffb5'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(st.msg, W/2, y + 1, W - 50);
      }
    }
    function drawFlat(){
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      if (!bgL) paintBg();
      ctx.drawImage(bgL[0], 0, 0, W, H);
      // light pulses racing along the circuit traces
      if (!reduceMotion) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const t of TRACES) {
          const segs = t.pts.length - 1, u = ((st.clock * t.sp + t.ph) % 1) * segs, k = Math.floor(u), f = u - k;
          const a = t.pts[k], b2 = t.pts[k + 1], px = a[0] + (b2[0] - a[0]) * f, py = a[1] + (b2[1] - a[1]) * f;
          const pg = ctx.createRadialGradient(px, py, 0, px, py, 14); pg.addColorStop(0, t.col); pg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.55; ctx.fillStyle = pg; ctx.fillRect(px - 14, py - 14, 28, 28);
        }
        ctx.restore(); }

      // header: level, blocks left, timer
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#e9fff6'; ctx.font = `900 22px ${DISPLAY}`; ctx.fillText(st.mode === 'daily' ? `DAILY \u00b7 ${st.level}` : `LEVEL ${st.level}`, 22, 44);
      const left = st.blocks.filter(b => !b.out).length;
      ctx.fillStyle = '#8fb3cf'; ctx.font = `700 13px "Nunito", sans-serif`; ctx.fillText(`${left} block${left === 1 ? '' : 's'} to free`, 22, 66);
      const frac = st.time / st.timeMax, tw = W - 44, ty = 84;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.roundRect(22, ty, tw, 10, 5); ctx.fill();
      const tc = st.freezeT > 0 ? '#9fe8ff' : frac > 0.5 ? '#3dffb5' : frac > 0.25 ? N.yellow : N.red;
      ctx.save(); ctx.shadowColor = tc; ctx.shadowBlur = 10; ctx.fillStyle = tc; ctx.beginPath(); ctx.roundRect(22, ty, Math.max(10, tw * frac), 10, 5); ctx.fill(); ctx.restore();
      ctx.textAlign = 'right'; ctx.fillStyle = '#e9fff6'; ctx.font = `700 16px ${DISPLAY}`; ctx.fillText(Math.ceil(st.time) + 's', W - 22, 66);

      // board
      const cs = st.cell, s = st.size, bw = cs * s;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
      const fr = ctx.createLinearGradient(0, st.by - 18, 0, st.by + bw + 18); fr.addColorStop(0, '#3a4f6e'); fr.addColorStop(0.5, '#1a2840'); fr.addColorStop(1, '#0c1424');
      ctx.fillStyle = fr; ctx.beginPath(); ctx.roundRect(st.bx - 18, st.by - 18, bw + 36, bw + 36, 22); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(160,210,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(st.bx - 17, st.by - 17, bw + 34, bw + 34, 21); ctx.stroke();
      for (const [qx, qy] of [[st.bx - 9, st.by - 9], [st.bx + bw + 9, st.by - 9], [st.bx - 9, st.by + bw + 9], [st.bx + bw + 9, st.by + bw + 9]]) { ctx.fillStyle = '#7f95b8'; ctx.beginPath(); ctx.arc(qx, qy, 3.2, 0, 7); ctx.fill(); ctx.fillStyle = '#2a3a55'; ctx.fillRect(qx - 2.2, qy - 0.6, 4.4, 1.2); }
      ctx.fillStyle = '#081222'; ctx.beginPath(); ctx.roundRect(st.bx - 6, st.by - 6, bw + 12, bw + 12, 12); ctx.fill();
      for (let r=0;r<s;r++) for (let c=0;c<s;c++) {
        const x = st.bx + c*cs + 2, y = st.by + r*cs + 2, z = cs - 4;
        const tg = ctx.createLinearGradient(0, y, 0, y + z); tg.addColorStop(0, '#0f2038'); tg.addColorStop(1, '#0a172a');
        ctx.fillStyle = tg; ctx.beginPath(); ctx.roundRect(x, y, z, z, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(61,255,181,.07)'; ctx.lineWidth = 1; ctx.stroke();
      }

      // exit bars
      for (const e of st.exits) {
        const col = COLS[e.color];
        let x, y, w, h;
        if (e.side === 'top') { x = st.bx + e.start*cs + 3; y = st.by - 14; w = e.len*cs - 6; h = 8; }
        else if (e.side === 'bottom') { x = st.bx + e.start*cs + 3; y = st.by + bw + 6; w = e.len*cs - 6; h = 8; }
        else if (e.side === 'left') { x = st.bx - 14; y = st.by + e.start*cs + 3; w = 8; h = e.len*cs - 6; }
        else { x = st.bx + bw + 6; y = st.by + e.start*cs + 3; w = 8; h = e.len*cs - 6; }
        const pulse = reduceMotion ? 1 : 0.75 + Math.sin(st.clock * 4 + e.color) * 0.25;
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 22 * pulse; ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.roundRect(x + (w > h ? 4 : 2), y + (w > h ? 2 : 4), w - (w > h ? 8 : 4), h - (w > h ? 4 : 8), 2); ctx.fill(); ctx.restore();
        if (!reduceMotion) { const [er, ec] = DIRS[e.side]; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
          for (let q=0;q<6;q++) { const tt = (st.clock * 0.9 + q / 6 + e.color * 0.13) % 1, along = (q * 0.37 + e.color * 0.21) % 1;
            const px = w > h ? x + along * w : x + w / 2 + ec * tt * 26, py = w > h ? y + h / 2 + er * tt * 26 : y + along * h;
            ctx.globalAlpha = (1 - tt) * 0.8; ctx.beginPath(); ctx.arc(px, py, 2.2 * (1 - tt) + 0.6, 0, 7); ctx.fill(); }
          ctx.restore(); }
        // chevrons pointing out
        const [dr, dc] = DIRS[e.side];
        ctx.fillStyle = col; ctx.globalAlpha = 0.55;
        const n = e.len;
        for (let k=0;k<n;k++) {
          const cx = e.side === 'top' || e.side === 'bottom' ? st.bx + (e.start + k + 0.5)*cs : x + w/2 + dc * 14;
          const cy = e.side === 'left' || e.side === 'right' ? st.by + (e.start + k + 0.5)*cs : y + h/2 + dr * 14;
          ctx.beginPath();
          if (dr) { ctx.moveTo(cx - 6, cy - dr*3); ctx.lineTo(cx + 6, cy - dr*3); ctx.lineTo(cx, cy + dr*5); }
          else { ctx.moveTo(cx - dc*3, cy - 6); ctx.lineTo(cx - dc*3, cy + 6); ctx.lineTo(cx + dc*5, cy); }
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // blocks
      ctx.save(); ctx.beginPath(); ctx.rect(st.bx - 4, st.by - 4, bw + 8, bw + 8); ctx.clip();
      for (const b of st.blocks) {
        if (b.out) {
          const [dr, dc] = DIRS[b.out.side]; const d = b.out.t * cs * 3;
          if (b.out.t < 1) drawBlock(b, 1 - b.out.t, dc * d, dr * d);
          continue;
        }
        const bump = st.bump && st.bump.id === b.id ? Math.sin(st.clock * 70) * 3 : 0;
        drawBlock(b, 1, bump, 0);
      }
      ctx.restore();

      // freeze button
      const fy = H - 46;
      ctx.globalAlpha = st.freezes > 0 && st.running ? 1 : 0.4;
      ctx.save(); ctx.shadowColor = '#9fe8ff'; ctx.shadowBlur = st.freezeT > 0 ? 20 : 8;
      ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 2; ctx.fillStyle = '#0c1828';
      ctx.beginPath(); ctx.roundRect(W/2 - 80, fy - 22, 160, 44, 22); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#dff8ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 14px ${DISPLAY}`;
      ctx.fillText(st.freezeT > 0 ? `FROZEN ${Math.ceil(st.freezeT)}s` : `FREEZE TIME (${st.freezes})`, W/2, fy + 1);
      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation = 'lighter';
      for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life / 0.6); ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, q.size, q.size); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) { ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.fillStyle = q.color; ctx.shadowColor = q.color; ctx.shadowBlur = 12; ctx.font = `900 22px ${DISPLAY}`; ctx.fillText(q.text, q.x, q.y); ctx.restore(); }
      if (st.msg && st.phase === 'play') {
        ctx.font = `900 16px ${DISPLAY}`;
        const tw2 = Math.min(ctx.measureText(st.msg).width + 40, W - 30), y = st.by + st.cell * st.size / 2;
        ctx.fillStyle = 'rgba(5,10,20,.88)'; ctx.beginPath(); ctx.roundRect(W/2 - tw2/2, y - 24, tw2, 48, 24); ctx.fill();
        ctx.strokeStyle = '#3dffb5'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(st.msg, W/2, y + 1, W - 50);
      }
    }

    function blockAt(x, y){
      const c = Math.floor((x - st.bx) / st.cell), r = Math.floor((y - st.by) / st.cell);
      return st.blocks.find(b => !b.out && b.cells.some(([dr,dc]) => b.r + dr === r && b.c + dc === c));
    }
    function artTile(g){
      if (assets3D()) { const keep = st; fresh('classic', Math.random, 3, 'menu'); for (let i=0;i<st.blocks.length;i++) { st.blocks[i].vx = st.blocks[i].c; st.blocks[i].vy = st.blocks[i].r; } draw3D(true); const k = E3.canvas.height / H, bw = st.cell * st.size + 40, bh = bw * 0.75; g.drawImage(E3.canvas, (W / 2 - bw / 2) * k, (st.by + st.cell * st.size / 2 - bh / 2) * k, bw * k, bh * k, 0, 0, 240, 180); st = keep; return; }
      if (!bgL) paintBg();
      g.drawImage(bgL[0], 0, 120, 480, 360, 0, 0, 240, 180);
      const fr = g.createLinearGradient(0, 14, 0, 170); fr.addColorStop(0, '#3a4f6e'); fr.addColorStop(1, '#0c1424');
      g.fillStyle = fr; g.beginPath(); g.roundRect(44, 14, 152, 152, 14); g.fill(); g.fillStyle = '#081222'; g.beginPath(); g.roundRect(52, 22, 136, 136, 9); g.fill();
      const blk = (x, y, w, h, col) => { g.save(); g.shadowColor = col; g.shadowBlur = 12; g.fillStyle = PB.shade(col, -0.6); g.beginPath(); g.roundRect(x - 1, y - 1, w + 2, h + 2, 8); g.fill(); g.shadowBlur = 0; g.fillStyle = PB.shade(col, 0.6); g.beginPath(); g.roundRect(x, y, w, h, 7); g.fill(); const b = g.createLinearGradient(0, y, 0, y + h); b.addColorStop(0, PB.shade(col, 0.35)); b.addColorStop(0.5, col); b.addColorStop(1, PB.shade(col, -0.45)); g.fillStyle = b; g.beginPath(); g.roundRect(x + 2, y + 3, w - 4, h - 5, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.roundRect(x + 5, y + 4, w - 10, 8, 4); g.fill(); g.restore(); };
      g.save(); g.shadowColor = N.pink; g.shadowBlur = 14; rr(g, 42, 60, 6, 56, 3, N.pink); g.shadowColor = N.cyan; rr(g, 96, 162, 56, 6, 3, N.cyan); g.shadowColor = N.lime; rr(g, 192, 30, 6, 46, 3, N.lime); g.restore();
      blk(56, 62, 64, 30, N.pink); blk(100, 112, 30, 42, N.cyan); blk(144, 28, 38, 38, N.lime); blk(144, 72, 38, 38, N.yellow); blk(58, 112, 36, 42, N.yellow);
    }

    return {
      id:'cubes', music:'cubes', title:'CUBE ESCAPE', W, H, statLabel:'Level', maxLives: MAX_LIVES, type:'endless',
      tile:{ order:5, name:'Cube Escape', kind:'Neon block puzzle', art: artTile },
      controls: ['Drag a block to slide it around the box.', 'Push it into the glowing bar of the same color to send it out.', 'The block has to line up with the bar to get through. Slide it level with the bar first!', 'Free every block before the timer runs out.', "If time runs out you lose a heart and try the level again."],
      powersTitle: 'Helpers',
      powers: [
        { name:'Freeze time', desc:'Stops the clock for 8 seconds. One per level', icon: g => { g.strokeStyle = '#9fe8ff'; g.lineWidth = 1.5; g.fillStyle = '#0c1828'; g.beginPath(); g.roundRect(2, 3, 42, 22, 11); g.fill(); g.stroke(); g.fillStyle = '#dff8ff'; g.font = '700 8px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FREEZE', 23, 14); } },
        { name:'Time bonus', desc:'Seconds left over turn into points', icon: g => { g.fillStyle = '#3dffb5'; g.beginPath(); g.roundRect(4, 11, 38, 7, 3); g.fill(); } },
        { name:'Bonus life', desc:'Your streak gives extra hearts at the start', icon: g => { g.fillStyle = N.red; g.font = '900 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u2665', 23, 15); } },
      ],
      init(){ assets3D(); },
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg){ fresh(mode, rand, lives, 'play'); st.msg = msg ? msg + ' Tap to start' : 'Level 1 \u00b7 Tap to start'; },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: st.lives, stat: st.level, score: st.score }; },
      debug(){ return { st }; },
      metrics(){ return { score: st.score, level: st.level }; },
      dailyGoals: [
        { text:'Reach level {n}', m:'level', n:[3, 4, 5] },
        { text:'Score {n} points', m:'score', n:[2000, 3000, 4500] },
        { text:'Reach level {n} without losing a life', m:'level', n:[2, 3], noHit:true },
      ],
      pointerDown(x, y){
        if (st.phase !== 'play' || st.pending != null || st.retry != null) return;
        if (st.msg) { st.msg = null; st.running = true; return; }
        if (y > H - 70 && Math.abs(x - W/2) < 84) { if (st.freezes > 0 && st.running) { st.freezes--; st.freezeT = 8; if (PB.sfx) PB.sfx('power'); pop(W/2, H - 90, 'Time frozen!', '#9fe8ff'); } return; }
        const b = blockAt(x, y); if (!b) return;
        st.drag = { id: b.id, ax: x, ay: y, axis: null, br: b.r, bc: b.c };
      },
      // Blocks slide along one line at a time (left/right or up/down), follow your finger smoothly, and stop
      // at walls and other blocks. A block only leaves through an exit of its color when it lines up with it.
      pointerMove(x, y){
        const d = st.drag; if (!d) return;
        const b = st.blocks[d.id]; if (!b || b.out) { st.drag = null; return; }
        const fc = (x - d.ax) / st.cell, fr = (y - d.ay) / st.cell;
        if (!d.axis) { if (Math.max(Math.abs(fc), Math.abs(fr)) < 0.18) return; d.axis = Math.abs(fc) >= Math.abs(fr) ? 'c' : 'r'; }
        // switching direction: finish the current line (snap) and start a new one from here
        const main = d.axis === 'c' ? fc : fr, perp = d.axis === 'c' ? fr : fc;
        if (Math.abs(perp) > 0.45 && Math.abs(perp) > Math.abs(main - Math.round(main)) + 0.3 && Math.abs(perp) > Math.abs(main) * 0.6) {
          b.fc = null; b.fr = null; d.br = b.r; d.bc = b.c; d.ax = x - (d.axis === 'c' ? 0 : fc * st.cell) * 0; d.ay = y;
          d.ax = x; d.ay = y; d.axis = d.axis === 'c' ? 'r' : 'c'; return;
        }
        const g = occupied(b.id), dr = d.axis === 'r' ? 1 : 0, dc = d.axis === 'c' ? 1 : 0;
        const reach = sgn => { let k = 0; for (;;) { const nr = d.br + dr * sgn * (k + 1), nc = d.bc + dc * sgn * (k + 1); let outside = false, ok = true;
            for (const [r0, c0] of b.cells) { const r = nr + r0, c = nc + c0; if (r < 0 || r >= st.size || c < 0 || c >= st.size) { outside = true; continue; } if (g[r][c] !== -1) { ok = false; break; } }
            if (!ok) return { k, exit: false };
            if (outside) { const side = d.axis === 'r' ? (sgn < 0 ? 'top' : 'bottom') : (sgn < 0 ? 'left' : 'right'), e = st.exits.find(q => q.side === side && q.color === b.color);
              if (!e) return { k, exit: false, side };
              const along = side === 'top' || side === 'bottom', lo = Math.min(...b.cells.map(p => along ? d.bc + p[1] : d.br + p[0])), hi = Math.max(...b.cells.map(p => along ? d.bc + p[1] : d.br + p[0]));
              return { k, exit: lo >= e.start && hi < e.start + e.len, side, wrong: true }; }
            k++; if (k > 12) return { k, exit: false }; } };
        const lo = reach(-1), hi = reach(1);
        let pos = Math.max(-lo.k - (lo.exit ? 3 : 0.12), Math.min(hi.k + (hi.exit ? 3 : 0.12), main));
        // pushing a block that doesn't line up against an exit gives a little "nope" bump
        if ((main > hi.k + 0.35 && hi.wrong && !hi.exit) || (main < -lo.k - 0.35 && lo.wrong && !lo.exit)) { if (!(st.bump && st.bump.id === b.id)) { if (PB.sfx) PB.sfx('nope'); st.bump = { id: b.id, t: 0.2 }; } }
        if ((hi.exit && pos > hi.k + 0.55) || (lo.exit && pos < -lo.k - 0.55)) { b.fc = null; b.fr = null; exitBlock(b, pos > 0 ? hi.side : lo.side); return; }
        const cell = Math.max(-lo.k, Math.min(hi.k, Math.round(pos)));
        const nr = d.br + dr * cell, nc = d.bc + dc * cell;
        if (nr !== b.r || nc !== b.c) { b.r = nr; b.c = nc; if (PB.sfx) PB.sfx('slide'); }
        if (d.axis === 'c') { b.fc = d.bc + pos; b.fr = null; } else { b.fr = d.br + pos; b.fc = null; }
      },
      pointerUp(){ if (st.drag && st.blocks[st.drag.id]) { const b = st.blocks[st.drag.id]; b.fc = null; b.fr = null; b.nx = 0; b.ny = 0; } st.drag = null; },
      key(e){ if (e.key === ' ' && st.msg) { e.preventDefault(); st.msg = null; st.running = true; } },
    };
  }
  PB.register(createCubes);
})();
