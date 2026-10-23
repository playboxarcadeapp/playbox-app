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
      const lv = genLevel(st.level + 3, R);
      st.size = lv.size; st.exits = lv.exits;
      st.blocks = lv.blocks.map((b, i) => ({ ...b, id: i, vx: b.c, vy: b.r, out: null }));
      st.cell = Math.min(54, Math.floor(400 / st.size));
      st.bx = Math.round((W - st.cell * st.size) / 2); st.by = 160 + Math.round((440 - st.cell * st.size) / 2);
      st.timeMax = Math.round((15 + st.blocks.length * 5.5) * Math.max(0.62, 1 - st.level * 0.015));
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
        b.vx += (b.c + (b.nx || 0) - b.vx) * Math.min(1, dt * 28); b.vy += (b.r + (b.ny || 0) - b.vy) * Math.min(1, dt * 28);
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
    function draw(){
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
      controls: ['Drag a block to slide it around the box.', 'Push it into the glowing bar of the same color to send it out.', 'The block has to fit inside the bar to get through.', 'Free every block before the timer runs out.', "If time runs out you lose a heart and try the level again."],
      powersTitle: 'Helpers',
      powers: [
        { name:'Freeze time', desc:'Stops the clock for 8 seconds. One per level', icon: g => { g.strokeStyle = '#9fe8ff'; g.lineWidth = 1.5; g.fillStyle = '#0c1828'; g.beginPath(); g.roundRect(2, 3, 42, 22, 11); g.fill(); g.stroke(); g.fillStyle = '#dff8ff'; g.font = '700 8px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FREEZE', 23, 14); } },
        { name:'Time bonus', desc:'Seconds left over turn into points', icon: g => { g.fillStyle = '#3dffb5'; g.beginPath(); g.roundRect(4, 11, 38, 7, 3); g.fill(); } },
        { name:'Bonus life', desc:'Your streak gives extra hearts at the start', icon: g => { g.fillStyle = N.red; g.font = '900 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u2665', 23, 15); } },
      ],
      init(){},
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg){ fresh(mode, rand, lives, 'play'); st.msg = msg ? msg + ' Tap to start' : 'Level 1 \u00b7 Tap to start'; },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: st.lives, stat: st.level, score: st.score }; },
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
        st.drag = { id: b.id, x, y, r0: b.r, c0: b.c };
      },
      pointerMove(x, y){
        if (!st.drag) return;
        const b = st.blocks[st.drag.id]; if (!b || b.out) { st.drag = null; return; }
        const step = v => Math.sign(v) * Math.floor(Math.abs(v) + 0.62);   // a block moves once you drag about a third of a cell
        const fr = (y - st.drag.y) / st.cell, fc = (x - st.drag.x) / st.cell;
        const tr = st.drag.r0 + step(fr), tc = st.drag.c0 + step(fc);
        const g = occupied(b.id);
        for (let guard = 0; guard < 24; guard++) {
          const dr = Math.sign(tr - b.r), dc = Math.sign(tc - b.c);
          if (!dr && !dc) break;
          const preferX = Math.abs(tc - b.c) >= Math.abs(tr - b.r);
          let res = 'blocked';
          if (preferX && dc) res = tryStep(b, 0, dc, g);
          if (res === 'blocked' && dr) res = tryStep(b, dr, 0, g);
          if (res === 'blocked' && !preferX && dc) res = tryStep(b, 0, dc, g);
          if (res !== 'moved') break; if (PB.sfx) PB.sfx('slide');
        }
        if (!st.drag) return;
        // if a wall stops the block, re-anchor so sliding back the other way responds right away
        const wantR = st.drag.r0 + fr, wantC = st.drag.c0 + fc;
        if (Math.abs(wantC - b.c) > 0.9) { st.drag.x = x - (b.c - st.drag.c0) * st.cell - Math.sign(wantC - b.c) * 0.4 * st.cell; }
        if (Math.abs(wantR - b.r) > 0.9) { st.drag.y = y - (b.r - st.drag.r0) * st.cell - Math.sign(wantR - b.r) * 0.4 * st.cell; }
        // the block leans toward your finger a little, so it feels like it glides
        b.nx = Math.max(-0.22, Math.min(0.22, (st.drag.c0 + (x - st.drag.x) / st.cell - b.c) * 0.5));
        b.ny = Math.max(-0.22, Math.min(0.22, (st.drag.r0 + (y - st.drag.y) / st.cell - b.r) * 0.5));
      },
      pointerUp(){ if (st.drag && st.blocks[st.drag.id]) { st.blocks[st.drag.id].nx = 0; st.blocks[st.drag.id].ny = 0; } st.drag = null; },
      key(e){ if (e.key === ' ' && st.msg) { e.preventDefault(); st.msg = null; st.running = true; } },
    };
  }
  PB.register(createCubes);
})();
