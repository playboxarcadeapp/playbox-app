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
      const lv = genLevel(st.level, R);
      st.size = lv.size; st.exits = lv.exits;
      st.blocks = lv.blocks.map((b, i) => ({ ...b, id: i, vx: b.c, vy: b.r, out: null }));
      st.cell = Math.min(54, Math.floor(400 / st.size));
      st.bx = Math.round((W - st.cell * st.size) / 2); st.by = 160 + Math.round((440 - st.cell * st.size) / 2);
      st.timeMax = Math.round((22 + st.blocks.length * 7) * Math.max(0.72, 1 - st.level * 0.012));
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
      if (!e) { st.bump = { id: b.id, t: 0.2 }; return 'blocked'; }
      const along = side === 'top' || side === 'bottom';
      const lo = Math.min(...b.cells.map(p => along ? b.c + p[1] : b.r + p[0])), hi = Math.max(...b.cells.map(p => along ? b.c + p[1] : b.r + p[0]));
      if (lo >= e.start && hi < e.start + e.len) { exitBlock(b, side); return 'exit'; }
      st.bump = { id: b.id, t: 0.2 }; return 'blocked';
    }
    function exitBlock(b, side){
      b.out = { side, t: 0 }; st.drag = null;
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
        b.vx += (b.c - b.vx) * Math.min(1, dt * 22); b.vy += (b.r - b.vy) * Math.min(1, dt * 22);
      }
      if (st.bump) { st.bump.t -= dt; if (st.bump.t <= 0) st.bump = null; }
      for (const q of st.parts) { q.x += q.vx*dt; q.y += q.vy*dt; q.vx *= 0.96; q.vy *= 0.96; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.y -= 30*dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      st.shake = Math.max(0, st.shake - dt*30);
    }

    // ---------- Drawing ----------
    function drawBlock(b, alpha, ox, oy){
      const cs = st.cell, col = COLS[b.color];
      const bx = st.bx + b.vx * cs + ox, by = st.by + b.vy * cs + oy;
      const set = new Set(b.cells.map(([r,c]) => r + ',' + c));
      const lifted = st.drag && st.drag.id === b.id;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.shadowColor = col; ctx.shadowBlur = lifted ? 26 : 14;
      ctx.fillStyle = col;
      const pad = 4;
      ctx.beginPath();
      for (const [r,c] of b.cells) {
        ctx.roundRect(bx + c*cs + pad, by + r*cs + pad, cs - pad*2, cs - pad*2, 8);
        if (set.has(r + ',' + (c+1))) ctx.rect(bx + c*cs + cs - pad - 1, by + r*cs + pad + 6, pad*2 + 2, cs - pad*2 - 12);
        if (set.has((r+1) + ',' + c)) ctx.rect(bx + c*cs + pad + 6, by + r*cs + cs - pad - 1, cs - pad*2 - 12, pad*2 + 2);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      for (const [r,c] of b.cells) {
        const x = bx + c*cs + pad, y = by + r*cs + pad, s = cs - pad*2;
        const g = ctx.createLinearGradient(0, y, 0, y + s); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, s, s, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(5,10,20,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + s*0.3, y + s*0.3, s*0.4, s*0.4, 4); ctx.stroke();
      }
      ctx.restore();
    }
    function draw(){
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      const bg = ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0, '#071224'); bg.addColorStop(1, '#03060d');
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      const glow = ctx.createRadialGradient(W/2, st.by + 200, 20, W/2, st.by + 200, 340); glow.addColorStop(0, 'rgba(61,255,181,.13)'); glow.addColorStop(1, 'rgba(61,255,181,0)');
      ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);

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
      ctx.fillStyle = '#0a1628'; ctx.beginPath(); ctx.roundRect(st.bx - 8, st.by - 8, bw + 16, bw + 16, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(61,255,181,.10)'; ctx.lineWidth = 1;
      for (let i=1;i<s;i++) { ctx.beginPath(); ctx.moveTo(st.bx + i*cs, st.by); ctx.lineTo(st.bx + i*cs, st.by + bw); ctx.moveTo(st.bx, st.by + i*cs); ctx.lineTo(st.bx + bw, st.by + i*cs); ctx.stroke(); }
      ctx.strokeStyle = '#1f3b5c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(st.bx - 8, st.by - 8, bw + 16, bw + 16, 14); ctx.stroke();

      // exit bars
      for (const e of st.exits) {
        const col = COLS[e.color];
        let x, y, w, h;
        if (e.side === 'top') { x = st.bx + e.start*cs + 3; y = st.by - 14; w = e.len*cs - 6; h = 8; }
        else if (e.side === 'bottom') { x = st.bx + e.start*cs + 3; y = st.by + bw + 6; w = e.len*cs - 6; h = 8; }
        else if (e.side === 'left') { x = st.bx - 14; y = st.by + e.start*cs + 3; w = 8; h = e.len*cs - 6; }
        else { x = st.bx + bw + 6; y = st.by + e.start*cs + 3; w = 8; h = e.len*cs - 6; }
        const pulse = reduceMotion ? 1 : 0.75 + Math.sin(st.clock * 4 + e.color) * 0.25;
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18 * pulse; ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.restore();
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
      neonBg(g);
      g.strokeStyle = '#1f3b5c'; g.lineWidth = 2; g.strokeRect(50, 22, 140, 140);
      g.shadowBlur = 12;
      rr(g, 46, 60, 6, 50, 3, N.pink); rr(g, 92, 158, 50, 6, 3, N.cyan); rr(g, 188, 30, 6, 40, 3, N.lime);
      rr(g, 56, 64, 40, 40, 6, N.pink); rr(g, 100, 112, 40, 40, 6, N.cyan); rr(g, 100, 112-0, 40, 40, 6, N.cyan);
      rr(g, 144, 28, 40, 40, 6, N.lime); rr(g, 144, 72, 40, 40, 6, N.yellow); rr(g, 56, 112, 40, 40, 6, N.yellow);
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '900 20px sans-serif'; g.fillText('\u2190', 20, 92);
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
        const tr = st.drag.r0 + Math.round((y - st.drag.y) / st.cell), tc = st.drag.c0 + Math.round((x - st.drag.x) / st.cell);
        const g = occupied(b.id);
        for (let guard = 0; guard < 24; guard++) {
          const dr = Math.sign(tr - b.r), dc = Math.sign(tc - b.c);
          if (!dr && !dc) break;
          const preferX = Math.abs(tc - b.c) >= Math.abs(tr - b.r);
          let res = 'blocked';
          if (preferX && dc) res = tryStep(b, 0, dc, g);
          if (res === 'blocked' && dr) res = tryStep(b, dr, 0, g);
          if (res === 'blocked' && !preferX && dc) res = tryStep(b, 0, dc, g);
          if (res !== 'moved') break; if (PB.sfx) PB.sfx('tap');
        }
      },
      pointerUp(){ st.drag = null; },
      key(e){ if (e.key === ' ' && st.msg) { e.preventDefault(); st.msg = null; st.running = true; } },
    };
  }
  PB.register(createCubes);
})();
