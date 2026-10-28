// CUBE ESCAPE: jelly sliding-block puzzle. Drag each block out through the exit bar of its color.
(function(){
  const { N, fmt, reduceMotion, ctx, mulberry, seedFrom, neonBg, rr } = PB;

  function createCubes(shell){
    const W = 480, H = 690, MAX_LIVES = 5;
    const DISPLAY = '"Lilita One", "Arial Rounded MT Bold", "Arial Black", sans-serif';
    const COLS = ['#0a5cff', '#ff1a1a', '#00c832', '#ffd800', '#ff7b00', '#7a1fff'];
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
      const target = Math.min(7 + L, 20);
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
        scramble(30 + L * 4);
        if (blocks.length >= Math.min(target - 2, 7)) return { size, exits, blocks, colors: nColors };
      }
      return genLevel(Math.max(1, L - 1), R);
    }

    // Classic play is 100 set levels (the same puzzle every time you play a level). The daily challenge
    // is the old endless run: 3 hearts, keep going as far as you can.
    function fresh(mode, rand, lives, phase, level){
      const endless = mode === 'daily';
      st = { mode, phase, rand, lives: endless ? (lives || 3) : null, endless, score:0, level: endless ? 1 : (level || 1), parts:[], pops:[], shake:0, msg:null, clock:0, freezeT:0, freezes:1, running:false, tool: null };
      loadLevel();
    }
    // exits: one bold gate per cell, centred on that row/column, right at the board edge
    function gateCells(e, bw, cs) {
      const T = 15, G = 3, out = [];
      for (let k = 0; k < e.len; k++) {
        const a = (e.start + k) * cs + 3, L = cs - 6;
        if (e.side === 'top') out.push({ x: st.bx + a, y: st.by - G - T, w: L, h: T });
        else if (e.side === 'bottom') out.push({ x: st.bx + a, y: st.by + bw + G, w: L, h: T });
        else if (e.side === 'left') out.push({ x: st.bx - G - T, y: st.by + a, w: T, h: L });
        else out.push({ x: st.bx + bw + G, y: st.by + a, w: T, h: L });
      }
      return out;
    }
    function gateArrow(ctx, g, side, sz) {
      const cx = g.x + g.w / 2, cy = g.y + g.h / 2, [dr, dc] = DIRS[side];
      ctx.beginPath();
      if (dr) { ctx.moveTo(cx - sz, cy - dr * sz * 0.45); ctx.lineTo(cx + sz, cy - dr * sz * 0.45); ctx.lineTo(cx, cy + dr * sz * 0.65); }
      else { ctx.moveTo(cx - dc * sz * 0.45, cy - sz); ctx.lineTo(cx - dc * sz * 0.45, cy + sz); ctx.lineTo(cx + dc * sz * 0.65, cy); }
      ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fill();
    }
    const COLS0 = COLS.slice(), PALS = { cols_candy: ['#ff1f1f', '#00b4ff', '#3ce000', '#ffe600', '#ff7a00', '#7a1fff'], cols_jewel: ['#2f5bff', '#e0103f', '#10b860', '#ffb000', '#ff5a10', '#8a3aff'] };
    function loadLevel(){
      COLS.splice(0, COLS.length, ...(PALS[PB.meta && PB.meta.look('cubes', 'colors')] || COLS0));
      const R = st.mode === 'daily' ? mulberry(seedFrom('cubes-daily-' + PB.today() + '-' + st.level)) : st.endless ? st.rand : mulberry(seedFrom('cubes-level-' + st.level));
      const lv = genLevel(st.level + 9, R);
      st.size = lv.size; st.exits = lv.exits;
      st.blocks = lv.blocks.map((b, i) => ({ ...b, id: i, vx: b.c, vy: b.r, out: null }));
      st.cell = Math.min(54, Math.floor(400 / st.size));
      st.bx = Math.round((W - st.cell * st.size) / 2); st.by = 160 + Math.round((440 - st.cell * st.size) / 2);
      st.timeMax = Math.round((10 + st.blocks.length * 3.7) * Math.max(0.7, 1 - st.level * 0.012));
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
      b.out = { side, t: 0 }; st.drag = null; if (PB.sfx) { PB.sfx('exit'); PB.sfx('escape'); }
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
      if (!st.endless) { const frac = st.time / st.timeMax; st.won = true; st.done = { win: true, stars: frac >= 0.45 ? 3 : frac >= 0.2 ? 2 : 1, t: 1.4, left: Math.ceil(st.time) }; return; }
      st.level++;
      st.pending = 1.4;
    }
    function timeUp(){
      if (!st.endless) { st.running = false; st.shake = 10; st.tool = null; pop(W/2, st.by + 200, "Time's up!", N.red, 1.4); st.done = { win: false, t: 0.9 }; return; }
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
        if (st.done) { st.done.t -= dt; if (st.done.t <= 0) { const d = st.done; st.done = null; const left = st.blocks.filter(b => !b.out).length;
          if (d.win) shell.levelDone({ win: true, stars: d.stars, score: st.score, summary: `Every jelly escaped with ${d.left} seconds left!` });
          else shell.levelDone({ win: false, stars: 0, score: st.score, summary: `${left} jelly ${left === 1 ? 'friend' : 'friends'} still stuck. Try again!` }); } }
        if (st.retry != null) { st.retry -= dt; if (st.retry <= 0) { st.retry = null; const keep = st.level; loadLevel(); st.level = keep; st.msg = 'Try again! Tap to start'; } }
      }
      for (const b of st.blocks) {
        if (b.out) { const was = b.out.t; b.out.t += dt / 0.35; if (was < 1 && b.out.t >= 1 && PB.sfx) PB.sfx('popout'); continue; }
        // while dragged the block glides right under your finger; let go and it settles into its square
        const tx = b.fc != null ? b.fc : b.c, ty = b.fr != null ? b.fr : b.r, k = Math.min(1, dt * (b.fc != null || b.fr != null ? 36 : 22));
        b.vx += (tx - b.vx) * k; b.vy += (ty - b.vy) * k;
      }
      if (st.bump) { st.bump.t -= dt; if (st.bump.t <= 0) st.bump = null; }
      if (st.boostFlash) { st.boostFlash.t -= dt; if (st.boostFlash.t <= 0) st.boostFlash = null; }
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
    // a sunny sky garden: floating islands, waterfalls and big soft clouds, painted once. The far layers
    // are blurred like a camera's depth of field so the board pops forward.
    let bgL = null, TRACES = [];
    function paintBg(){
      bgL = PB.layer(W, H); const g = bgL[1], R = mulberry(5);
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1a5fd6'); sky.addColorStop(0.4, '#3d8ff0'); sky.addColorStop(0.75, '#7cc0ff'); sky.addColorStop(1, '#bfe2ff');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const sun = g.createRadialGradient(W * 0.82, H * 0.1, 10, W * 0.82, H * 0.1, 300); sun.addColorStop(0, 'rgba(255,250,220,.95)'); sun.addColorStop(0.25, 'rgba(255,240,190,.45)'); sun.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = sun; g.fillRect(0, 0, W, H);
      // soft sun rays
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(W * 0.82, H * 0.1); for (let k=0;k<9;k++) { g.rotate(0.45 + R() * 0.25); const rg = g.createLinearGradient(0, 0, 0, 700); rg.addColorStop(0, 'rgba(255,245,210,.07)'); rg.addColorStop(1, 'rgba(255,245,210,0)'); g.fillStyle = rg; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-70, 700); g.lineTo(70, 700); g.lineTo(14, 0); g.fill(); } g.restore();
      const cloud = (cx, cy, s, a, shade) => { const n = 9; for (let k=0;k<n;k++) { const t = k / (n - 1), x = cx + (t - 0.5) * 220 * s, y = cy - Math.sin(t * Math.PI) * 34 * s + (R() - .5) * 10 * s, r = (34 + Math.sin(t * Math.PI) * 30 + R() * 12) * s;
          const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.75, `rgba(240,246,255,${a})`); gr.addColorStop(1, `rgba(${shade},${a * 0.9})`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } };
      // far layer: distant islands and clouds, blurred
      const far = PB.layer(W, H), fg = far[1];
      const island = (gg, x, y, s, fall) => {
        gg.fillStyle = '#8fb4d6'; gg.beginPath(); gg.moveTo(x - 70 * s, y); gg.quadraticCurveTo(x - 40 * s, y + 70 * s, x, y + 110 * s); gg.quadraticCurveTo(x + 45 * s, y + 60 * s, x + 75 * s, y); gg.closePath(); gg.fill();
        const top = gg.createLinearGradient(0, y - 30 * s, 0, y + 10 * s); top.addColorStop(0, '#9fe08a'); top.addColorStop(1, '#5fae6a'); gg.fillStyle = top; gg.beginPath(); gg.ellipse(x, y, 78 * s, 16 * s, 0, 0, 7); gg.fill();
        for (let k=0;k<4;k++) { const tx = x + (k - 1.5) * 28 * s, th = (26 + k % 2 * 10) * s; gg.fillStyle = '#4f9a5c'; gg.beginPath(); gg.arc(tx, y - th, 16 * s, 0, 7); gg.fill(); gg.fillStyle = '#7cc46e'; gg.beginPath(); gg.arc(tx - 4 * s, y - th - 5 * s, 9 * s, 0, 7); gg.fill(); }
        if (fall) { const wf = gg.createLinearGradient(0, y, 0, y + 200 * s); wf.addColorStop(0, 'rgba(230,248,255,.9)'); wf.addColorStop(1, 'rgba(230,248,255,0)'); gg.fillStyle = wf; gg.fillRect(x + 30 * s, y + 4, 12 * s, 200 * s); } };
      const cl = (gg, cx, cy, s, a) => { const keep = g; for (let k=0;k<9;k++) { const t = k / 8, x = cx + (t - 0.5) * 220 * s, y = cy - Math.sin(t * Math.PI) * 34 * s, r = (34 + Math.sin(t * Math.PI) * 30) * s; const gr = gg.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, `rgba(214,226,250,${a})`); gg.fillStyle = gr; gg.beginPath(); gg.arc(x, y, r, 0, 7); gg.fill(); } };
      cl(fg, 70, 200, 0.55, 0.85); cl(fg, 420, 160, 0.6, 0.8); island(fg, 95, 300, 0.6, true); island(fg, 400, 270, 0.75, true); cl(fg, 250, 470, 0.8, 0.7);
      PB.soften(g, far[0], 0, 0, W, H, 5);
      // near clouds along the bottom, softly blurred too
      const near = PB.layer(W, H), ng = near[1]; cl(ng, 40, 670, 1.0, 1); cl(ng, 250, 700, 1.3, 1); cl(ng, 470, 665, 1.0, 1);
      PB.soften(g, near[0], 0, 0, W, H, 2.5);
    }
    // ---------- 3D look: jelly-glass blocks that lift when you drag them ----------
    let E3 = null, A3 = null, boardKey = '', boardL = null;
    function assets3D(){
      if (A3) return A3; if (A3 === false) return null;
      E3 = PB.gl3d && PB.gl3d.get(); if (!E3) { A3 = false; return null; }
      A3 = { shapes: new Map(), pill: E3.mesh(E3.G.roundBox(1, 1, 1, 0.45, 4)), sph: E3.mesh(E3.G.sphere(1, 18, 12)), tBoard: null };
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
    // the backdrop with the board for this level painted in (repainted when the board size changes):
    // a chunky carved-wood tray with golden corners and soft cream stone tiles
    function paintBoardBackdrop(){
      if (!bgL) paintBg();
      if (!boardL) boardL = PB.layer(W, H);
      const g = boardL[1], cs = st.cell, s = st.size, bw = cs * s, x0 = st.bx, y0 = st.by;
      g.clearRect(0, 0, W, H); g.drawImage(bgL[0], 0, 0, W, H);
      const bk = PB.meta && PB.meta.look('cubes', 'box'), BC = bk === 'box_gold' ? ['#ffe9a0', '#e0a830', '#8a5a10'] : bk === 'box_pink' ? ['#ffc6e8', '#e070b0', '#8a2a64'] : ['#d79a5c', '#a8693a', '#5e3618'];
      // drop shadow on the clouds
      g.save(); g.fillStyle = 'rgba(40,40,90,.3)'; g.shadowColor = 'rgba(40,40,90,.45)'; g.shadowBlur = 24; g.beginPath(); g.roundRect(x0 - 14, y0 + 2, bw + 28, bw + 30, 30); g.fill(); g.restore();
      // the wooden tray: rounded rim with a highlight on top and a dark lip below
      const fr = g.createLinearGradient(0, y0 - 24, 0, y0 + bw + 24); fr.addColorStop(0, BC[0]); fr.addColorStop(0.45, BC[1]); fr.addColorStop(1, BC[2]);
      g.fillStyle = fr; g.beginPath(); g.roundRect(x0 - 22, y0 - 22, bw + 44, bw + 44, 26); g.fill();
      g.strokeStyle = 'rgba(60,30,10,.55)'; g.lineWidth = 3; g.stroke();
      g.save(); g.beginPath(); g.roundRect(x0 - 22, y0 - 22, bw + 44, bw + 44, 26); g.clip(); g.strokeStyle = 'rgba(80,40,10,.18)'; g.lineWidth = 1.5;
      for (let k=0;k<26;k++) { const yy = y0 - 22 + k * (bw + 44) / 26; g.beginPath(); g.moveTo(x0 - 22, yy); g.bezierCurveTo(x0 + bw * 0.3, yy + 4, x0 + bw * 0.6, yy - 4, x0 + bw + 22, yy + 2); g.stroke(); } g.restore();
      g.strokeStyle = 'rgba(255,240,210,.55)'; g.lineWidth = 2; g.beginPath(); g.roundRect(x0 - 19, y0 - 19, bw + 38, bw + 38, 23); g.stroke();
      // golden corner caps
      for (const [qx, qy] of [[x0 - 11, y0 - 11], [x0 + bw + 11, y0 - 11], [x0 - 11, y0 + bw + 11], [x0 + bw + 11, y0 + bw + 11]]) { const gg = g.createRadialGradient(qx - 3, qy - 3, 1, qx, qy, 9); gg.addColorStop(0, '#fff6c0'); gg.addColorStop(0.5, '#f2b52c'); gg.addColorStop(1, '#8a5a10'); g.fillStyle = gg; g.beginPath(); g.arc(qx, qy, 8, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,30,0,.5)'; g.lineWidth = 1.2; g.stroke(); }
      // inset floor and stone tiles
      g.fillStyle = '#6a4a3a'; g.beginPath(); g.roundRect(x0 - 6, y0 - 6, bw + 12, bw + 12, 14); g.fill();
      for (let r=0;r<s;r++) for (let c=0;c<s;c++) {
        const x = x0 + c*cs + 2, y = y0 + r*cs + 2, z = cs - 4, light = (r + c) % 2;
        const tg = g.createLinearGradient(0, y, 0, y + z); tg.addColorStop(0, light ? '#fff4e2' : '#f6e6cc'); tg.addColorStop(1, light ? '#ecd9b8' : '#e2cba4');
        g.fillStyle = tg; g.beginPath(); g.roundRect(x, y, z, z, 8); g.fill();
        g.strokeStyle = 'rgba(120,80,40,.25)'; g.lineWidth = 1; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.roundRect(x + 4, y + 3, z - 8, 3, 2); g.fill();
      }
      if (!A3.tBoard) A3.tBoard = E3.texture(boardL[0], { repeat: false }); else E3.updateTexture(A3.tBoard, boardL[0]);
    }
    function draw3D(tile){
      const E = E3, M = E.M, P3 = E.px, cs = st.cell, bw = cs * st.size;
      const key = st.size + '|' + cs + '|' + st.bx + '|' + st.by + '|' + ((PB.meta && PB.meta.look('cubes', 'box')) || ''); if (key !== boardKey) { boardKey = key; paintBoardBackdrop(); }
      E.resize(W, H, tile ? 1 : E.quality(1.5));
      const sx = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0, sy = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0;
      E.begin({ ortho: [W, H], pos: [-sx, sy, 1500], target: [-sx, sy, 0] }, {
        noSky: true, sunDir: [0.45, -0.6, -0.65], sunColor: [1.35, 1.28, 1.15], ambSky: [0.5, 0.56, 0.7], ambGround: [0.3, 0.26, 0.22], toon: 0.25,
        post: { bloom: 0.3, threshold: 0.92, saturation: 1.1, contrast: 1.06, vignette: 0.15 },
      });
      E.backdrop(A3.tBoard, W, H, { shadow: 0 });
      // exits: bright bold gates, one per cell, lined up with the cubes
      for (const e of st.exits) {
        const c = hex3(COLS[e.color]), pulse = reduceMotion ? 1 : 0.85 + Math.sin(st.clock * 4 + e.color) * 0.15;
        for (const g of gateCells(e, bw, cs)) {
          const gx = g.x + g.w / 2, gy = g.y + g.h / 2;
          E.draw(A3.pill, M.trs(P3(gx, gy, 6), [0, 0, 0], [g.w + 6, g.h + 6, 10]), { color: [1, 1, 1], emissive: [0.9, 0.9, 0.9], noShadow: true });
          E.draw(A3.pill, M.trs(P3(gx, gy, 10), [0, 0, 0], [g.w, g.h, 14]), { color: c, emissive: c.map(v => v * 0.4 * pulse), spec: 0.6, shine: 60, noShadow: true });
          E.sprite(P3(gx, gy, 2), Math.max(g.w, g.h) * 1.6, c, 0.22 * pulse, true);
        }
      }
      // blocks: glossy jelly characters with faces that look toward their way out
      for (const b of st.blocks) {
        let ox = 0, oy = 0, alpha = 1;
        if (b.out) { if (b.out.t >= 1) continue; const [dr, dc] = DIRS[b.out.side], d = b.out.t * cs * 3; ox = dc * d; oy = dr * d; alpha = 1 - b.out.t; }
        else if (st.bump && st.bump.id === b.id) ox = Math.sin(st.clock * 70) * 3;
        const lifted = st.drag && st.drag.id === b.id, c = hex3(COLS[b.color]);
        const squish = reduceMotion ? 0 : Math.sin(st.clock * 2.2 + b.id * 1.7) * 0.02 + (lifted ? Math.sin(st.clock * 12) * 0.03 : 0);
        const x0 = st.bx + b.vx * cs + ox, y0 = st.by + b.vy * cs + oy, z = (lifted ? 26 : 12) + cs * 0.31, top = z + cs * 0.31;
        E.draw(shapeMesh(b), M.trs(P3(x0, y0, z), [0, 0, 0], [1 + squish, 1 - squish, 1]), { color: c, emissive: c.map(v => v * (lifted ? 0.22 : 0.12)), spec: 1.7, shine: 110, rim: 0.55, alpha: alpha < 1 ? alpha : undefined });
        for (const [r, cc] of b.cells) E.sprite(P3(x0 + cc * cs + cs * 0.56, y0 + r * cs + cs * 0.62, 3), cs * (lifted ? 1.25 : 1.05), [0.25, 0.15, 0.1], (lifted ? 0.28 : 0.38) * alpha, false);
        for (const [r, cc] of b.cells) { const hx = x0 + cc * cs + cs * 0.3, hy = y0 + r * cs + cs * 0.27; E.sprite(P3(hx, hy, top + 4), cs * 0.34, [1, 1, 1], 0.5 * alpha, true); }
        // the face goes on the cell nearest this block's exit
        const ex = st.exits.find(e => e.color === b.color), [er, ec] = ex ? DIRS[ex.side] : [0, 0];
        let fc = b.cells[0], best = -1e9; for (const cell of b.cells) { const v = cell[0] * er + cell[1] * ec - Math.abs(cell[0] - b.cells[0][0]) * 0.01; if (v > best) { best = v; fc = cell; } }
        const fx = x0 + fc[1] * cs + cs / 2, fy = y0 + fc[0] * cs + cs / 2, fz = top + 2;
        let lx = 0, ly = 0; if (ex) { const exx = ex.side === 'left' ? st.bx - 20 : ex.side === 'right' ? st.bx + bw + 20 : st.bx + (ex.start + ex.len / 2) * cs, exy = ex.side === 'top' ? st.by - 20 : ex.side === 'bottom' ? st.by + bw + 20 : st.by + (ex.start + ex.len / 2) * cs, dl = Math.hypot(exx - fx, exy - fy) || 1; lx = (exx - fx) / dl; ly = (exy - fy) / dl; }
        const blink = !reduceMotion && ((st.clock * 0.45 + b.id * 0.37) % 4) < 0.1, happy = lifted || !!b.out, eyeH = blink ? 0.15 : happy ? 1.15 : 1;
        for (const sd of [-1, 1]) { const exx = fx + sd * cs * 0.16, eyy = fy - cs * 0.07;
          E.draw(A3.sph, M.trs(P3(exx, eyy, fz), [0, 0, 0], [cs * 0.14, cs * 0.165 * eyeH, 3]), { color: [1, 1, 1], emissive: [0.25, 0.25, 0.25], spec: 0.8, noShadow: true, alpha: alpha < 1 ? alpha : undefined });
          if (!blink) { const px = exx + lx * cs * 0.045, py = eyy + ly * cs * 0.05; E.draw(A3.sph, M.trs(P3(px, py, fz + 3), [0, 0, 0], [cs * 0.08, cs * 0.09 * Math.min(1, eyeH), 2]), { color: [0.08, 0.06, 0.12], spec: 1.2, shine: 80, noShadow: true, alpha: alpha < 1 ? alpha : undefined });
            E.sprite(P3(px - cs * 0.02, py - cs * 0.025, fz + 6), cs * 0.05, [1, 1, 1], alpha, true); }
          E.sprite(P3(fx + sd * cs * 0.27, fy + cs * 0.1, fz + 1), cs * 0.16, [1, 0.45, 0.55], 0.5 * alpha, false); }
        const mw = happy ? cs * 0.13 : cs * 0.08, mh = happy ? cs * 0.08 : cs * 0.03;
        E.draw(A3.sph, M.trs(P3(fx, fy + cs * 0.15, fz), [0, 0, 0], [mw, mh, 2]), { color: [0.32, 0.06, 0.1], spec: 0.4, noShadow: true, alpha: alpha < 1 ? alpha : undefined });
        if (happy) E.draw(A3.sph, M.trs(P3(fx, fy + cs * 0.19, fz + 1), [0, 0, 0], [mw * 0.55, mh * 0.45, 1.5]), { color: [1, 0.45, 0.55], noShadow: true, alpha: alpha < 1 ? alpha : undefined });
      }
      E.end(); if (!tile) E.present(ctx, W, H);
    }
    function draw(){
      if (assets3D()) drawWith3D(); else { drawFlat(); drawSymbols(); }
      drawBoosts();
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
      if (!(PB.prefs && PB.prefs.symbols)) for (const e of st.exits) for (const g of gateCells(e, bw, cs)) gateArrow(ctx, g, e.side, Math.min(cs * 0.17, 9));
      drawSymbols(); drawFooter();
    }
    // chunky outlined text, like the big cartoon titles in console games
    function label(text, x, y, size, fill, align){ ctx.font = `${size}px ${DISPLAY}`; ctx.textAlign = align || 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.22); ctx.strokeStyle = 'rgba(30,30,70,.85)'; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); }
    function drawHeader(){
      ctx.textBaseline = 'alphabetic';
      // a glossy panel holds the level, blocks left and the timer
      ctx.save(); ctx.shadowColor = 'rgba(30,40,90,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
      const pg = ctx.createLinearGradient(0, 14, 0, 104); pg.addColorStop(0, 'rgba(255,255,255,.95)'); pg.addColorStop(1, 'rgba(222,236,255,.95)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(14, 14, W - 28, 92, 22); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#3b7be0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(14, 14, W - 28, 92, 22); ctx.stroke();
      label(st.mode === 'daily' ? `DAILY ${st.level}` : `LEVEL ${st.level}`, 30, 50, 26, '#ffd23f');
      const left = st.blocks.filter(b => !b.out).length;
      ctx.fillStyle = '#3a4a78'; ctx.font = `800 14px "Nunito", sans-serif`; ctx.textAlign = 'left'; ctx.fillText(`${left} jelly friend${left === 1 ? '' : 's'} to free`, 32, 72);
      const frac = st.time / st.timeMax, tw = W - 60, ty = 82;
      ctx.fillStyle = 'rgba(40,60,120,.18)'; ctx.beginPath(); ctx.roundRect(30, ty, tw, 12, 6); ctx.fill();
      const tc = st.freezeT > 0 ? '#7fd8ff' : frac > 0.5 ? '#46d65a' : frac > 0.25 ? '#ffc21a' : '#ff4a4a';
      const bg2 = ctx.createLinearGradient(0, ty, 0, ty + 12); bg2.addColorStop(0, '#ffffff'); bg2.addColorStop(0.35, tc); bg2.addColorStop(1, tc);
      ctx.fillStyle = bg2; ctx.beginPath(); ctx.roundRect(30, ty, Math.max(12, tw * frac), 12, 6); ctx.fill();
      label(Math.ceil(st.time) + 's', W - 30, 54, 24, '#ffffff', 'right');
    }
    // a white shape on every block and its exit gates (one shape per color)
    function drawSymbols(){
      if (!PB.prefs || !PB.prefs.symbols) return;
      const cs = st.cell, bw = cs * st.size, r0 = Math.min(cs * 0.17, 9);
      for (const e of st.exits) for (const g of gateCells(e, bw, cs)) PB.symbol(ctx, e.color, g.x + g.w / 2, g.y + g.h / 2, 6);
      for (const b of st.blocks) {
        let ox = 0, oy = 0; if (b.out) { if (b.out.t >= 0.6) continue; const [dr, dc] = DIRS[b.out.side], d = b.out.t * cs * 3; ox = dc * d; oy = dr * d; }
        const x0 = st.bx + b.vx * cs + ox, y0 = st.by + b.vy * cs + oy;
        const ex = st.exits.find(e => e.color === b.color), [er, ec] = ex ? DIRS[ex.side] : [0, 0];
        let fc = b.cells[0], best = -1e9; for (const cell of b.cells) { const v = cell[0] * er + cell[1] * ec - Math.abs(cell[0] - b.cells[0][0]) * 0.01; if (v > best) { best = v; fc = cell; } }
        if (b.cells.length === 1) { PB.symbol(ctx, b.color, x0 + cs * 0.83, y0 + cs * 0.18, r0 * 0.68); continue; }
        let far = b.cells[0], fd = -1; for (const cell of b.cells) { const d = Math.abs(cell[0] - fc[0]) + Math.abs(cell[1] - fc[1]); if (d > fd) { fd = d; far = cell; } }
        PB.symbol(ctx, b.color, x0 + (far[1] + 0.5) * cs, y0 + (far[0] + 0.5) * cs, r0 * 1.15);
      }
    }
    // power-ups beside the freeze button
    const boostList = () => (PB.meta && PB.meta.boostsFor && PB.meta.boostsFor('cubes')) || [];
    const boostN = id => (PB.meta && PB.meta.boostCount) ? PB.meta.boostCount(id) : 0;
    const BOOST_X = [50, W - 50], BOOST_R = 26;
    function boostAt(x, y){ const L = boostList(); for (let i=0;i<L.length;i++) if (Math.hypot(x - BOOST_X[i], y - (H - 46)) < BOOST_R + 8) return L[i]; return null; }
    function pressBoost(b){
      if (!st.running || st.done) { if (PB.sfx) PB.sfx('nope'); return; }
      if (st.tool === b.id) { st.tool = null; return; }
      if (boostN(b.id) <= 0) { pop(W/2, H - 96, 'Get more in the Swag Shop!', N.yellow, 1.6); if (PB.sfx) PB.sfx('nope'); return; }
      if (b.id === 'hammer') { st.tool = 'hammer'; if (PB.sfx) PB.sfx('pick'); return; }
      if (!PB.meta.useBoost(b.id)) return;
      st.boostFlash = { id: b.id, t: 0.6 }; st.time += 20; st.timeMax = Math.max(st.timeMax, st.time); if (PB.sfx) PB.sfx('power'); pop(W/2, H - 96, '+20 seconds!', '#9fe8ff', 1.4);
    }
    function hammer(b){
      st.tool = null; if (!PB.meta.useBoost('hammer')) return;
      st.boostFlash = { id: 'hammer', t: 0.6 }; st.shake = 8; if (PB.sfx) PB.sfx('bonk');
      const e = st.exits.find(x => x.color === b.color); exitBlock(b, e ? e.side : 'top'); pop(W/2, st.by - 26, 'Bonk!', N.yellow);
    }
    function drawBoosts(){
      const L = boostList(); if (!L.length || st.phase !== 'play') return;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      L.forEach((b, i) => {
        const x = BOOST_X[i], y = H - 46, n = boostN(b.id), on = st.tool === b.id, fl = st.boostFlash && st.boostFlash.id === b.id ? st.boostFlash.t / 0.6 : 0, rr = BOOST_R * (1 + fl * 0.2 + (on ? 0.06 * Math.sin(st.clock * 10) : 0));
        ctx.globalAlpha = n > 0 || on ? 1 : 0.5;
        if (on) { ctx.save(); ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 22; ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(x, y, rr + 4, 0, 7); ctx.fill(); ctx.restore(); }
        ctx.save(); ctx.shadowColor = 'rgba(20,40,90,.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
        const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.4, 2, x, y, rr); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, b.sw[0]); g.addColorStop(1, b.sw[1]);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); ctx.restore();
        ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.stroke();
        ctx.font = `${Math.round(rr)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(b.ic, x, y + 2);
        ctx.globalAlpha = 1;
        const bx = x + rr * 0.75, by = y - rr * 0.72; ctx.fillStyle = n > 0 ? '#ff3d6e' : '#2fb36b'; ctx.beginPath(); ctx.arc(bx, by, 10, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.font = `800 12px sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(n > 0 ? String(Math.min(n, 99)) : '+', bx, by + 1);
      });
      if (st.tool === 'hammer') { const t = 'Tap a jelly to bonk it out!'; ctx.font = `18px ${DISPLAY}`; const w = ctx.measureText(t).width + 30, y = st.by - 30; ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.roundRect(W/2 - w/2, y - 16, w, 32, 16); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2a3a70'; ctx.stroke(); ctx.fillStyle = '#2a3a70'; ctx.fillText(t, W/2, y + 1); }
      ctx.restore();
    }
    function drawFooter(){
      const fy = H - 46, on = st.freezes > 0 && st.running;
      ctx.save(); ctx.globalAlpha = on || st.freezeT > 0 ? 1 : 0.55; ctx.shadowColor = 'rgba(20,40,90,.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      const bgr = ctx.createLinearGradient(0, fy - 24, 0, fy + 24); bgr.addColorStop(0, '#a8e8ff'); bgr.addColorStop(0.5, '#3fb0ff'); bgr.addColorStop(1, '#1c6fd8');
      ctx.fillStyle = bgr; ctx.beginPath(); ctx.roundRect(W/2 - 92, fy - 24, 184, 48, 24); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha = on || st.freezeT > 0 ? 1 : 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(W/2 - 92, fy - 24, 184, 48, 24); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.roundRect(W/2 - 80, fy - 20, 160, 14, 7); ctx.fill();
      ctx.textBaseline = 'middle'; label(st.freezeT > 0 ? `FROZEN ${Math.ceil(st.freezeT)}s` : `FREEZE TIME (${st.freezes})`, W/2, fy + 2, 19, '#ffffff', 'center'); ctx.restore();
      if (st.freezeT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,200,255,.1)'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life / 0.6); ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, q.size, q.size); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) { ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); label(q.text, q.x, q.y, 26, q.color, 'center'); ctx.restore(); }
      if (st.msg && st.phase === 'play') {
        ctx.font = `900 16px ${DISPLAY}`;
        const tw2 = Math.min(ctx.measureText(st.msg).width + 40, W - 30), y = st.by + st.cell * st.size / 2;
        ctx.save(); ctx.shadowColor = 'rgba(20,30,80,.4)'; ctx.shadowBlur = 12; ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath(); ctx.roundRect(W/2 - tw2/2, y - 24, tw2, 48, 24); ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#3b7be0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(W/2 - tw2/2, y - 24, tw2, 48, 24); ctx.stroke();
        ctx.fillStyle = '#2a3a70'; ctx.fillText(st.msg, W/2, y + 1, W - 50);
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

      // exit gates (2D fallback): bold, one per cell
      for (const e of st.exits) {
        const col = COLS[e.color], pulse = reduceMotion ? 1 : 0.8 + Math.sin(st.clock * 4 + e.color) * 0.2;
        for (const g of gateCells(e, bw, cs)) {
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 20 * pulse;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(g.x - 3, g.y - 3, g.w + 6, g.h + 6, 7); ctx.fill(); ctx.restore();
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, 5); ctx.fill();
          gateArrow(ctx, g, e.side, Math.min(cs * 0.17, 9));
        }
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
      id:'cubes', music:'cubes', title:'CUBE ESCAPE', W, H, statLabel:'Jellies', maxLives: MAX_LIVES, type:'levels', levels: 100, failTitle: "Time's up!", dailyText: 'Endless run: 3 hearts, how far can you go?',
      tile:{ order:5, name:'Cube Escape', kind:'Jelly block puzzle \u00b7 100 levels', art: artTile },
      controls: ['Drag a block to slide it around the box.', 'Push it into the glowing bar of the same color to send it out.', 'The block has to line up with the bar to get through. Slide it level with the bar first!', 'Free every block before the timer runs out. Faster = more stars.', 'Each color has its own white shape on the jelly and its exit.', 'Power-ups: the Hammer bonks a jelly out, and +20 Seconds adds time.'],
      powersTitle: 'Helpers',
      powers: [
        { name:'Freeze time', desc:'Stops the clock for 8 seconds. One per level', icon: g => { g.strokeStyle = '#9fe8ff'; g.lineWidth = 1.5; g.fillStyle = '#0c1828'; g.beginPath(); g.roundRect(2, 3, 42, 22, 11); g.fill(); g.stroke(); g.fillStyle = '#dff8ff'; g.font = '700 8px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FREEZE', 23, 14); } },
        { name:'Time bonus', desc:'Seconds left over turn into points', icon: g => { g.fillStyle = '#3dffb5'; g.beginPath(); g.roundRect(4, 11, 38, 7, 3); g.fill(); } },
        { name:'Hammer', desc:'Power-up: tap a jelly to bonk it straight out', icon: g => { g.font = '20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u{1F528}', 23, 15); } },
        { name:'+20 Seconds', desc:'Power-up: more time on the clock', icon: g => { g.font = '20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u23F1\uFE0F', 23, 15); } },
      ],
      init(){ assets3D();
        // players who reached a level in the old endless mode start with those levels unlocked
        if (!PB.store.get('cubes-progress')) { const best = ((PB.store.get('pb-stats') || {}).best || {}).cubeLevel || 1; if (best > 1) PB.store.set('cubes-progress', { unlocked: Math.min(best, 100), stars: {}, best: {} }); }
      },
      preview(){ fresh('classic', Math.random, 3, 'menu', 1); },
      start(mode, rand, lives, msg, level){ fresh(mode, rand, 3, 'play', level === 'daily' ? 1 : level); st.msg = `${st.endless ? 'Daily run' : 'Level ' + st.level} \u00b7 Tap to start`; },
      reviveText: '+20 seconds', reviveIcon: '\u23F1\uFE0F', reviveTitle: "Time's up!",
      revive(){ st.done = null; st.time = 20; st.timeMax = Math.max(st.timeMax, 20); st.running = false; st.msg = 'Keep going! Tap to start'; st.phase = 'play'; },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: st.endless ? st.lives : null, stat: st.blocks.filter(b => !b.out).length, score: st.score }; },
      debug(){ return { st }; }, debugBoost(id){ const b = boostList().find(q => q.id === id); if (b) pressBoost(b); }, debugHammer(i){ hammer(st.blocks[i]); },
      metrics(){ return { score: st.score, level: st.level, won: st.won ? 1 : 0 }; },
      dailyGoals: [
        { text:'Reach level {n}', m:'level', n:[3, 4, 5] },
        { text:'Score {n} points', m:'score', n:[2000, 3000, 4500] },
        { text:'Reach level {n} without losing a life', m:'level', n:[2, 3], noHit:true },
      ],
      pointerDown(x, y){
        if (st.phase !== 'play' || st.pending != null || st.retry != null || st.done) return;
        if (st.msg) { st.msg = null; st.running = true; return; }
        { const bz = boostAt(x, y); if (bz) { pressBoost(bz); return; } }
        if (st.tool === 'hammer') { const hb = blockAt(x, y); if (hb && !hb.out) hammer(hb); else st.tool = null; return; }
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
