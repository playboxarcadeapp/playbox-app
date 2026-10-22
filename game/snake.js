// ANACONDA: a jungle snake game. Eat fruit, grow longer, don't bite your own tail.
(function(){
  const { fmt, reduceMotion, ctx, mulberry, seedFrom, shade } = PB;

  function createSnake(shell){
    const W = 480, H = 680, COLS = 16, ROWS = 18, CELL = 28, BX = (W - COLS * CELL) / 2, BY = 140, MAX_LIVES = 5;
    const FONT = '"Lilita One", "Arial Rounded MT Bold", sans-serif';
    const BODY = '"Nunito", "Segoe UI", sans-serif';
    const FRUITS = ['mango', 'banana', 'berries'];
    const POWERS = {
      slow:   { name:'Sloth mode',    color:'#8fd16a', time:8,  weight:16, desc:'The snake slows down for 8 seconds' },
      ghost:  { name:'Ghost scales',  color:'#b9a6ff', time:8,  weight:12, desc:'Slide through your own tail and rocks' },
      double: { name:'Double points', color:'#ffc93c', time:12, weight:14, desc:'Fruit is worth 2\u00d7' },
      portal: { name:'Jungle portals',color:'#3fd0c9', time:12, weight:12, desc:'Go off one edge and come out the other' },
      shrink: { name:'Shed skin',     color:'#ff9f5a', time:0,  weight:10, desc:'Lose 4 tail pieces to make room' },
      life:   { name:'Extra life',    color:'#ff5d7a', time:0,  weight:6,  desc:'Adds one heart (up to 5)' },
    };
    const DIRS = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
    let st = null, bgC = null;

    function fresh(mode, rand, lives, phase){
      st = { mode, phase, rand, lives, score: 0, level: 1, eaten: 0, perLevel: 8, rocks: [], fx: { slow:0, ghost:0, double:0, portal:0 },
        parts: [], pops: [], time: 0, shake: 0, msg: null, items: [], powIn: 9, inv: 0 };
      resetSnake();
      placeFood();
    }
    function resetSnake(){
      const cx = Math.floor(COLS / 2) - 2, cy = Math.floor(ROWS / 2) + 3;
      st.snake = []; for (let i=0;i<4;i++) st.snake.push({ x: cx - i, y: cy, px: cx - i, py: cy });
      st.dir = 'right'; st.queue = []; st.acc = 0; st.t = 1; st.grow = 3; st.dead = false; st.bulges = [];
      if (st.rocks) st.rocks = st.rocks.filter(r => !(r.y === cy && r.x >= cx - 4 && r.x <= cx + 5));
    }
    const occupied = (x, y) => st.snake.some(s => s.x === x && s.y === y) || st.rocks.some(r => r.x === x && r.y === y) || st.items.some(i => i.x === x && i.y === y);
    function freeCell(){
      for (let tries=0; tries<400; tries++) {
        const x = Math.floor(st.rand() * COLS), y = Math.floor(st.rand() * ROWS);
        if (occupied(x, y)) continue;
        const h = st.snake[0]; if (Math.abs(h.x - x) + Math.abs(h.y - y) < 3) continue;
        return { x, y };
      }
      return null;
    }
    function placeFood(){
      const c = freeCell(); if (!c) return;
      const golden = st.eaten > 2 && st.rand() < 0.1;
      st.items.push({ kind: golden ? 'egg' : 'fruit', type: FRUITS[Math.floor(st.rand() * FRUITS.length)], x: c.x, y: c.y, born: st.time });
    }
    function placePower(){
      const c = freeCell(); if (!c) return;
      const e = Object.entries(POWERS).filter(([k]) => !(k === 'life' && st.lives >= MAX_LIVES) && !(k === 'shrink' && st.snake.length < 9));
      let roll = st.rand() * e.reduce((s,[,p]) => s + p.weight, 0), type = 'slow';
      for (const [k, p] of e) { roll -= p.weight; if (roll <= 0) { type = k; break; } }
      st.items.push({ kind:'pow', type, x: c.x, y: c.y, born: st.time, ttl: 9 });
    }
    function addRocks(n){
      for (let i=0;i<n;i++) {
        const c = freeCell(); if (!c) return;
        const h = st.snake[0], [dx, dy] = DIRS[st.dir];
        if (c.y === h.y && Math.sign(c.x - h.x) === dx && dx) continue;
        if (c.x === h.x && Math.sign(c.y - h.y) === dy && dy) continue;
        st.rocks.push({ x: c.x, y: c.y, log: st.rand() < 0.35, v: st.rand() });
      }
    }
    const stepTime = () => Math.max(0.065, 0.17 - (st.level - 1) * 0.011) * (st.fx.slow > 0 ? 1.6 : 1);
    function turn(d){
      if (st.phase === 'ready') { st.phase = 'play'; st.msg = null; }
      if (st.phase !== 'play') return;
      const last = st.queue.length ? st.queue[st.queue.length - 1] : st.dir;
      const [lx, ly] = DIRS[last], [dx, dy] = DIRS[d];
      if (lx + dx === 0 && ly + dy === 0) return;
      if (d === last) return;
      if (st.queue.length < 2) st.queue.push(d);
    }
    function step(){
      if (st.queue.length) st.dir = st.queue.shift();
      const [dx, dy] = DIRS[st.dir];
      const head = st.snake[0];
      let nx = head.x + dx, ny = head.y + dy, wrapped = false;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        if (st.fx.portal > 0) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; wrapped = true; }
        else return crash('Bonk! You hit the edge');
      }
      const ghost = st.fx.ghost > 0 || st.inv > 0;
      const tailLeaving = st.grow === 0;
      const hitSelf = st.snake.some((s, i) => s.x === nx && s.y === ny && !(tailLeaving && i === st.snake.length - 1));
      const hitRock = st.rocks.some(r => r.x === nx && r.y === ny);
      if (!ghost && (hitSelf || hitRock)) return crash(hitRock ? 'Ouch! A rock' : 'Oops! You bit your tail');
      for (const s of st.snake) { s.px = s.x; s.py = s.y; }
      for (let i = st.snake.length - 1; i > 0; i--) { st.snake[i].x = st.snake[i-1].x; st.snake[i].y = st.snake[i-1].y; }
      head.x = nx; head.y = ny;
      head.wrap = wrapped;
      if (st.grow > 0) { const t = st.snake[st.snake.length - 1]; st.snake.push({ x: t.px, y: t.py, px: t.px, py: t.py }); st.grow--; }
      if (st.bulges) { st.bulges.forEach(b => b.pos++); st.bulges = st.bulges.filter(b => b.pos < st.snake.length + 1); }
      const it = st.items.find(i => i.x === nx && i.y === ny);
      if (it) eat(it);
    }
    function eat(it){
      st.items.splice(st.items.indexOf(it), 1);
      const cx = BX + (it.x + 0.5) * CELL, cy = BY + (it.y + 0.5) * CELL;
      if (it.kind === 'pow') {
        const P = POWERS[it.type];
        if (it.type === 'life') st.lives = Math.min(MAX_LIVES, st.lives + 1);
        else if (it.type === 'shrink') { const n = Math.min(4, st.snake.length - 4); st.snake.splice(st.snake.length - n, n); }
        else st.fx[it.type] = P.time;
        burst(cx, cy, P.color, 16); pop(cx, cy - 20, P.name + '!', P.color, 1.3);
        return;
      }
      const mult = (st.fx.double > 0 ? 2 : 1) * st.level;
      const pts = (it.kind === 'egg' ? 50 : 10) * mult;
      st.score += pts; st.eaten++;
      st.grow += it.kind === 'egg' ? 3 : 1;
      (st.bulges = st.bulges || []).push({ pos: 0 });
      ring(cx, cy, it.kind === 'egg' ? '#ffd23f' : ({ mango:'#ff9f1c', banana:'#ffe14d', berries:'#9d4edd' })[it.type]);
      burst(cx, cy, it.kind === 'egg' ? '#ffd23f' : '#ffb347', 10);
      pop(cx, cy - 18, '+' + pts, it.kind === 'egg' ? '#ffd23f' : '#fff', 0.9);
      if (st.eaten % st.perLevel === 0) levelUp();
      placeFood();
    }
    function levelUp(){
      st.level++;
      st.score += 100 * st.level;
      pop(W / 2, BY + ROWS * CELL / 2, `Level ${st.level}!`, '#ffd23f', 1.6);
      addRocks(st.level <= 2 ? 1 : 2);
    }
    function crash(why){
      st.lives--; st.shake = 12; st.dead = true;
      pop(W / 2, BY + 120, why, '#ff5d7a', 1.4);
      const h = st.snake[0];
      burst(BX + (h.x + .5) * CELL, BY + (h.y + .5) * CELL, '#6b8e23', 20);
      if (st.lives <= 0) { st.phase = 'over'; shell.gameOver(st.score, `Your anaconda grew to ${st.snake.length} long and reached level ${st.level}`); return; }
      st.respawn = 1.0;
    }
    function ring(x, y, color){ st.rings = st.rings || []; st.rings.push({ x, y, color, life: 0.45 }); burst(x, y, color, 14); }
    function burst(x, y, color, n){ if (reduceMotion) return; for (let i=0;i<n;i++) { const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 150; st.parts.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 40, life: .6, color, r: 2 + Math.random() * 3 }); } }
    function pop(x, y, text, color, life){ st.pops.push({ x, y, text, color, life: life || 1 }); }

    function update(dt){
      st.time += dt;
      if (st.phase === 'play') {
        if (st.respawn != null) {
          st.respawn -= dt;
          if (st.respawn <= 0) { st.respawn = null; resetSnake(); st.inv = 1.5; st.phase = 'ready'; st.msg = 'Swipe to slither again'; }
        } else if (!st.dead) {
          for (const k in st.fx) if (st.fx[k] > 0) st.fx[k] = Math.max(0, st.fx[k] - dt);
          st.inv = Math.max(0, st.inv - dt);
          st.powIn -= dt; if (st.powIn <= 0) { placePower(); st.powIn = 10 + st.rand() * 8; }
          st.items = st.items.filter(i => !(i.kind === 'pow' && st.time - i.born > i.ttl));
          st.acc += dt;
          const T = stepTime();
          while (st.acc >= T && !st.dead && st.phase === 'play') { st.acc -= T; step(); }
          st.t = Math.min(1, st.acc / T);
        }
      } else st.t = 1;
      for (const q of st.parts) { q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 300*dt; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.y -= 28*dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      if (st.rings) { for (const r of st.rings) r.life -= dt; st.rings = st.rings.filter(r => r.life > 0); }
      st.shake = Math.max(0, st.shake - dt * 30);
    }

    // ---------- Drawing ----------
    function leaf(g, x, y, len, wid, ang, c1, c2){
      g.save(); g.translate(x, y); g.rotate(ang);
      const gr = g.createLinearGradient(0, -wid, 0, wid); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.45, -wid, len, 0); g.quadraticCurveTo(len * 0.45, wid, 0, 0); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(2, 0); g.lineTo(len * 0.92, 0); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; for (let i=1;i<6;i++) { const px = len * i / 6; g.beginPath(); g.moveTo(px, 0); g.lineTo(px + len * 0.08, -wid * 0.55 * Math.sin(Math.PI * i / 6)); g.moveTo(px, 0); g.lineTo(px + len * 0.08, wid * 0.55 * Math.sin(Math.PI * i / 6)); g.stroke(); }
      g.restore();
    }
    function paintBg(){
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
      const g = c.getContext('2d'); g.scale(2, 2);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0f3b25'); bg.addColorStop(1, '#0a2618');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // light shafts through the canopy
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x, w] of [[90, 60], [260, 40], [380, 70]]) { const lg = g.createLinearGradient(x, 0, x + 120, H); lg.addColorStop(0, 'rgba(255,240,170,.16)'); lg.addColorStop(1, 'rgba(255,240,170,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w + 160, H); g.lineTo(x + 140, H); g.closePath(); g.fill(); }
      g.restore();
      const R = mulberry(5);
      const greens = [['#2f8a3e','#1b5c27'], ['#3fa34d','#21692c'], ['#4b9e3a','#2b6a1f'], ['#1f7a52','#0f4a31']];
      for (let i=0;i<40;i++) { const gc = greens[i % 4]; const side = i % 2 ? 0 : W; leaf(g, side + (side ? -1 : 1) * R() * 40, R() * H, 70 + R() * 60, 18 + R() * 12, side ? Math.PI - 0.6 + R() * 1.2 : -0.6 + R() * 1.2, gc[0], gc[1]); }
      for (let i=0;i<18;i++) { const gc = greens[i % 4]; leaf(g, R() * W, -10 + R() * 30, 60 + R() * 50, 16 + R() * 10, 0.6 + R() * 1.9, gc[0], gc[1]); }
      // hanging vines
      g.strokeStyle = '#2e5b1f'; g.lineWidth = 3;
      for (const x of [30, 110, 400, 455]) { g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 10, 40, x - 12, 80, x + 4, 120); g.stroke(); for (let y = 16; y < 120; y += 18) leaf(g, x + (y % 36 ? 2 : -2), y, 16, 6, y % 36 ? 0.4 : Math.PI - 0.4, '#4fae4a', '#2b6a1f'); }
      // board frame: bamboo
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(BX - 12, BY - 10, COLS * CELL + 24, ROWS * CELL + 24, 16); g.fill();
      const bam = (x, y, w, h) => { const gr = g.createLinearGradient(x, y, x + (w > h ? 0 : w), y + (w > h ? h : 0)); gr.addColorStop(0, '#d7c27a'); gr.addColorStop(0.5, '#b49a4e'); gr.addColorStop(1, '#7d6a2f'); g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, h, 5); g.fill(); g.fillStyle = 'rgba(80,60,20,.55)'; if (w > h) for (let k = x + 40; k < x + w - 10; k += 56) g.fillRect(k, y, 3, h); else for (let k = y + 40; k < y + h - 10; k += 56) g.fillRect(x, k, w, 3); };
      bam(BX - 12, BY - 12, COLS * CELL + 24, 10); bam(BX - 12, BY + ROWS * CELL + 2, COLS * CELL + 24, 10);
      bam(BX - 12, BY - 12, 10, ROWS * CELL + 24); bam(BX + COLS * CELL + 2, BY - 12, 10, ROWS * CELL + 24);
      // jungle floor tiles
      for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
        g.fillStyle = (x + y) % 2 ? '#5f9a3b' : '#689f40';
        g.fillRect(BX + x * CELL, BY + y * CELL, CELL, CELL);
        if (R() < 0.35) { g.fillStyle = 'rgba(30,60,10,.25)'; g.beginPath(); g.ellipse(BX + x * CELL + R() * CELL, BY + y * CELL + R() * CELL, 3 + R() * 4, 1.5, R() * 3, 0, 7); g.fill(); }
        if (R() < 0.08) { g.fillStyle = ['#ffe36e','#ff8fb1','#ffffff'][Math.floor(R() * 3)]; g.beginPath(); g.arc(BX + x * CELL + 6 + R() * 16, BY + y * CELL + 6 + R() * 16, 2, 0, 7); g.fill(); }
      }
      const vg = g.createRadialGradient(W/2, BY + ROWS*CELL/2, 120, W/2, BY + ROWS*CELL/2, 330); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,30,10,.35)');
      g.fillStyle = vg; g.fillRect(BX, BY, COLS * CELL, ROWS * CELL);
      bgC = c;
    }
    function drawFruit(type, cx, cy, s){
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(30,20,10,.55)'; ctx.lineWidth = 1.2;
      if (type === 'mango') {
        const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, 12); g.addColorStop(0, '#ffe36e'); g.addColorStop(0.55, '#ff9f1c'); g.addColorStop(1, '#e0402a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 1, 9, 11, 0.5, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3e9b3a'; ctx.beginPath(); ctx.ellipse(5, -10, 6, 2.6, -0.5, 0, 7); ctx.fill();
      } else if (type === 'banana') {
        const g = ctx.createLinearGradient(-10, -6, 10, 8); g.addColorStop(0, '#fff07a'); g.addColorStop(1, '#e8b51e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-6, 10, 11, 4); ctx.quadraticCurveTo(-2, 4, -6, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-11, -9, 3, 4);
      } else {
        for (const [x, y] of [[-5, 2], [4, 3], [0, -4], [-1, 7], [6, -3]]) { const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5); g.addColorStop(0, '#c7a3ff'); g.addColorStop(1, '#4b1d8a'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 4.6, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#3e9b3a'; ctx.beginPath(); ctx.ellipse(1, -9, 6, 2.4, 0.2, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    function drawEgg(cx, cy, t){
      ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 14 + Math.sin(t * 6) * 4;
      const g = ctx.createRadialGradient(cx - 3, cy - 5, 1, cx, cy, 12); g.addColorStop(0, '#fff7c2'); g.addColorStop(1, '#e0a800');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, 8.5, 11, 0, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(cx - 3, cy - 4, 2, 3.5, 0.3, 0, 7); ctx.fill();
    }
    function powOrb(g, type, cx, cy, r){
      const P = POWERS[type];
      const gr = g.createRadialGradient(cx - r*0.3, cy - r*0.35, 1, cx, cy, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, P.color); gr.addColorStop(1, PB.shade(P.color, -0.4));
      g.save(); g.shadowColor = P.color; g.shadowBlur = 12; g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.restore();
      g.fillStyle = '#fff'; g.font = `${Math.round(r * 1.05)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText({ slow:'z', ghost:'\u2601', double:'2\u00d7', portal:'\u21c4', shrink:'\u2702', life:'\u2665' }[type], cx, cy + 1);
    }
    function drawRock(r){
      const x = BX + r.x * CELL, y = BY + r.y * CELL;
      if (r.log) {
        const g = ctx.createLinearGradient(0, y + 6, 0, y + 22); g.addColorStop(0, '#9b6a3e'); g.addColorStop(1, '#5a3a1e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 1, y + 7, CELL - 2, 14, 6); ctx.fill();
        ctx.fillStyle = '#c99a63'; ctx.beginPath(); ctx.ellipse(x + CELL - 4, y + 14, 3.5, 6.5, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x + CELL - 4, y + 14, 2, 4, 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#4fae4a'; ctx.beginPath(); ctx.ellipse(x + 8, y + 8, 5, 2, -0.4, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 15, y + 22, 12, 4, 0, 0, 7); ctx.fill();
        const g = ctx.createRadialGradient(x + 10, y + 9, 1, x + 14, y + 14, 15); g.addColorStop(0, '#b9b4ab'); g.addColorStop(1, '#5d5a54');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + 3, y + 20); ctx.quadraticCurveTo(x + 2, y + 6, x + 12, y + 4); ctx.quadraticCurveTo(x + 26, y + 3, x + 26, y + 16); ctx.quadraticCurveTo(x + 25, y + 24, x + 14, y + 24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(80,140,50,.8)'; ctx.beginPath(); ctx.ellipse(x + 12, y + 6, 7, 3, -0.2, 0, 7); ctx.fill();
      }
    }
    function snakePoints(){
      const t = st.t;
      return st.snake.map((s, i) => {
        let x = s.px + (s.x - s.px) * t, y = s.py + (s.y - s.py) * t;
        if (Math.abs(s.x - s.px) > 1 || Math.abs(s.y - s.py) > 1) { x = s.x; y = s.y; }
        return { x: BX + (x + 0.5) * CELL, y: BY + (y + 0.5) * CELL };
      });
    }
    function drawSnake(){
      const pts = snakePoints(), n = pts.length;
      const ghost = st.fx.ghost > 0 || (st.inv > 0 && Math.floor(st.inv * 10) % 2);
      ctx.save(); if (ghost) ctx.globalAlpha = 0.6;
      const bulge = i => { let m = 1; for (const b of st.bulges || []) m += 0.42 * Math.exp(-((i - b.pos) ** 2) / 1.6); return m; };
      const rad = i => { const f = i / Math.max(1, n - 1); return CELL * (0.5 - 0.27 * Math.pow(f, 1.5)) * bulge(i); };
      // soft shadow
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i=n-1;i>0;i--) { ctx.lineWidth = rad(i) * 2; ctx.beginPath(); ctx.moveTo(pts[i].x + 4, pts[i].y + 5); ctx.lineTo(pts[i-1].x + 4, pts[i-1].y + 5); ctx.stroke(); }
      if (st.fx.ghost > 0) { ctx.save(); ctx.shadowColor = '#b9a6ff'; ctx.shadowBlur = 18; }
      const tube = (width, color, ox, oy) => {
        ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i=n-1;i>0;i--) { ctx.lineWidth = width(i); ctx.beginPath(); ctx.moveTo(pts[i].x + ox, pts[i].y + oy); ctx.lineTo(pts[i-1].x + ox, pts[i-1].y + oy); ctx.stroke(); }
      };
      tube(i => rad(i) * 2 + 3, '#1a240a', 0, 0);
      if (st.fx.ghost > 0) ctx.restore();
      tube(i => rad(i) * 2, '#4f6b1c', 0, 0);
      tube(i => rad(i) * 1.1, '#cbb862', 1.5, 2.5);
      tube(i => rad(i) * 1.45, '#6f8f26', -1, -1.6);
      tube(i => rad(i) * 0.95, '#86a832', -1.6, -2.4);
      // scales: rows of small arcs along the body
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(25,35,8,.35)';
      for (let i=n-1;i>0;i--) {
        const A = pts[i], B = pts[i-1], ang = Math.atan2(B.y - A.y, B.x - A.x), r = rad(i);
        for (let k=0;k<3;k++) {
          const f = k / 3, x = A.x + (B.x - A.x) * f, y = A.y + (B.y - A.y) * f;
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          for (let row=-1; row<=1; row++) { const oy = row * r * 0.48 + (k % 2 ? r * 0.24 : 0); if (Math.abs(oy) > r * 0.8) continue; ctx.beginPath(); ctx.arc(-2, oy, r * 0.26, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
          ctx.restore();
        }
      }
      // anaconda blotches with golden rims
      for (let i=1;i<n;i++) {
        const A = pts[i], B = pts[i-1], ang = Math.atan2(B.y - A.y, B.x - A.x), r = rad(i);
        ctx.save(); ctx.translate((A.x + B.x) / 2, (A.y + B.y) / 2); ctx.rotate(ang);
        const side = i % 2 ? -1 : 1;
        ctx.fillStyle = '#c99a2e'; ctx.beginPath(); ctx.ellipse(0, side * r * 0.38, r * 0.5, r * 0.34, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#141b06'; ctx.beginPath(); ctx.ellipse(0, side * r * 0.38, r * 0.42, r * 0.27, 0, 0, 7); ctx.fill();
        if (i % 3 === 0) { ctx.fillStyle = '#141b06'; ctx.beginPath(); ctx.arc(r * 0.1, -side * r * 0.62, r * 0.14, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      // glossy highlight along the back
      tube(i => Math.max(1, rad(i) * 0.22), 'rgba(255,255,220,.55)', -2.4, -3.6);
      // head: broad jaw tapering to the snout
      const h = pts[0], nb = pts[1] || { x: h.x - 1, y: h.y };
      const ang = Math.atan2(h.y - nb.y, h.x - nb.x), L = CELL * 0.86, Wd = CELL * 0.62;
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
      const headPath = (k) => { ctx.beginPath(); ctx.moveTo(-L * 0.55 * k, -Wd * 0.8 * k); ctx.quadraticCurveTo(L * 0.3, -Wd * 1.08 * k, L * 0.95 * k, -Wd * 0.38 * k); ctx.quadraticCurveTo(L * 1.12 * k, 0, L * 0.95 * k, Wd * 0.38 * k); ctx.quadraticCurveTo(L * 0.3, Wd * 1.08 * k, -L * 0.55 * k, Wd * 0.8 * k); ctx.closePath(); };
      ctx.fillStyle = '#1a240a'; headPath(1.08); ctx.fill();
      const hg = ctx.createLinearGradient(0, -Wd, 0, Wd); hg.addColorStop(0, '#9dbd3e'); hg.addColorStop(0.5, '#6f8f26'); hg.addColorStop(1, '#4a6418');
      ctx.fillStyle = hg; headPath(1); ctx.fill();
      // head plates and dark stripe behind the eyes
      ctx.strokeStyle = 'rgba(25,35,8,.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L * 0.1, -Wd * 0.3); ctx.lineTo(L * 0.6, -Wd * 0.2); ctx.moveTo(L * 0.1, Wd * 0.3); ctx.lineTo(L * 0.6, Wd * 0.2); ctx.moveTo(L * 0.1, -Wd * 0.3); ctx.lineTo(L * 0.1, Wd * 0.3); ctx.stroke();
      ctx.fillStyle = '#141b06'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(L * 0.4, sd * Wd * 0.55); ctx.quadraticCurveTo(0, sd * Wd * 0.82, -L * 0.5, sd * Wd * 0.7); ctx.lineTo(-L * 0.5, sd * Wd * 0.5); ctx.quadraticCurveTo(0, sd * Wd * 0.6, L * 0.4, sd * Wd * 0.42); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,220,.35)'; ctx.beginPath(); ctx.ellipse(L * 0.25, -Wd * 0.12, L * 0.38, Wd * 0.14, 0, 0, 7); ctx.fill();
      // tongue
      if (!reduceMotion && Math.sin(st.time * 7) > 0.35) {
        const ext = (Math.sin(st.time * 30) * 0.15 + 0.85);
        ctx.strokeStyle = '#e0234e'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(L * 1.0, 0); ctx.lineTo(L * (1.0 + 0.5 * ext), 0); ctx.lineTo(L * (1.15 + 0.5 * ext), -4); ctx.moveTo(L * (1.0 + 0.5 * ext), 0); ctx.lineTo(L * (1.15 + 0.5 * ext), 4); ctx.stroke();
      }
      // glowing eyes with slit pupils and brow ridges
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8;
        const eg = ctx.createRadialGradient(L * 0.42, sd * Wd * 0.5, 0.5, L * 0.42, sd * Wd * 0.5, 5); eg.addColorStop(0, '#fff3a0'); eg.addColorStop(1, '#e09a14');
        ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(L * 0.42, sd * Wd * 0.5, 4.6, 3.8, 0, 0, 7); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#0b0b0b'; ctx.beginPath(); ctx.ellipse(L * 0.45, sd * Wd * 0.5, 1.1, 3.3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(L * 0.38, sd * Wd * 0.5 - 1.6, 1, 0, 7); ctx.fill();
        ctx.strokeStyle = '#1a240a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(L * 0.42, sd * Wd * 0.5, 5.4, sd < 0 ? Math.PI * 1.1 : Math.PI * 0.1, sd < 0 ? Math.PI * 1.9 : Math.PI * 0.9); ctx.stroke();
        ctx.fillStyle = '#141b06'; ctx.beginPath(); ctx.arc(L * 0.9, sd * Wd * 0.2, 1.2, 0, 7); ctx.fill();
      }
      ctx.restore();
      ctx.restore();
    }
    function draw(){
      if (!bgC) paintBg();
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      ctx.drawImage(bgC, 0, 0, W, H);
      if (st.fx.portal > 0) { ctx.save(); ctx.strokeStyle = 'rgba(63,208,201,.85)'; ctx.shadowColor = '#3fd0c9'; ctx.shadowBlur = 16; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -st.time * 30; ctx.strokeRect(BX - 2, BY - 2, COLS * CELL + 4, ROWS * CELL + 4); ctx.restore(); }
      for (const r of st.rocks) drawRock(r);
      for (const it of st.items) {
        const cx = BX + (it.x + 0.5) * CELL, cy = BY + (it.y + 0.5) * CELL;
        const pop = Math.min(1, (st.time - it.born) * 4), bob = Math.sin(st.time * 4 + it.x) * 1.5;
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx + 2, cy + 10, 8, 3, 0, 0, 7); ctx.fill();
        if (it.kind === 'fruit') drawFruit(it.type, cx, cy + bob, pop);
        else if (it.kind === 'egg') drawEgg(cx, cy + bob, st.time);
        else { const left = it.ttl - (st.time - it.born); if (left > 2 || Math.floor(left * 8) % 2) powOrb(ctx, it.type, cx, cy + bob, 12 * pop); }
      }
      drawSnake();
      for (const r of st.rings || []) { ctx.strokeStyle = r.color; ctx.globalAlpha = r.life / 0.45; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, 10 + (0.45 - r.life) * 70, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life / 0.6); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.restore();

      // header
      ctx.fillStyle = 'rgba(5,25,12,.6)'; ctx.beginPath(); ctx.roundRect(10, 16, 300, 88, 14); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffe9a8'; ctx.font = `28px ${FONT}`; ctx.fillText(st.mode === 'daily' ? `Daily Jungle \u00b7 ${st.level}` : `Level ${st.level}`, 20, 48);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `700 13px ${BODY}`;
      const toGo = st.perLevel - (st.eaten % st.perLevel);
      ctx.fillText(`${toGo} more fruit to level up \u00b7 length ${st.snake.length}`, 20, 70);
      const bw = 200; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(20, 82, bw, 10, 5); ctx.fill();
      ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.roundRect(20, 82, Math.max(10, bw * (1 - toGo / st.perLevel)), 10, 5); ctx.fill();
      let tx = W - 34;
      for (const k of ['slow','ghost','double','portal']) {
        if (st.fx[k] <= 0) continue;
        powOrb(ctx, k, tx, 62, 14);
        ctx.strokeStyle = POWERS[k].color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, 62, 19, -Math.PI/2, -Math.PI/2 + Math.PI*2*st.fx[k]/POWERS[k].time); ctx.stroke();
        tx -= 46;
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) {
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = `26px ${FONT}`; ctx.lineWidth = 5; ctx.strokeStyle = '#0b2614'; ctx.lineJoin = 'round';
        ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y); ctx.restore();
      }
      if (st.msg && st.phase === 'ready') {
        ctx.font = `22px ${FONT}`;
        const tw = Math.min(ctx.measureText(st.msg).width + 44, W - 30), y = BY + ROWS * CELL / 2 + 60;
        ctx.fillStyle = 'rgba(11,38,20,.85)'; ctx.beginPath(); ctx.roundRect(W/2 - tw/2, y - 26, tw, 52, 26); ctx.fill();
        ctx.strokeStyle = '#ffc93c'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff3c4'; ctx.fillText(st.msg, W/2, y + 1, W - 60);
      }
    }
    function artTile(g){
      g.fillStyle = '#0f3b25'; g.fillRect(0, 0, 240, 180);
      for (let y=0;y<7;y++) for (let x=0;x<10;x++) { g.fillStyle = (x + y) % 2 ? '#5f9a3b' : '#689f40'; g.fillRect(20 + x * 20, 20 + y * 20, 20, 20); }
      g.strokeStyle = '#b49a4e'; g.lineWidth = 5; g.strokeRect(18, 18, 204, 144);
      const path = [[40,130],[60,130],[80,130],[100,130],[100,110],[100,90],[120,90],[140,90],[160,90],[160,70],[160,50]];
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = '#26330e'; g.lineWidth = 17; g.beginPath(); path.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.stroke();
      g.strokeStyle = '#6f8a28'; g.lineWidth = 14; g.stroke();
      g.fillStyle = '#1c240a'; path.forEach(([x,y],i) => { if (i % 2 && i < path.length - 1) { g.beginPath(); g.ellipse(x, y, 4, 3, 0, 0, 7); g.fill(); } });
      g.fillStyle = '#7f9a30'; g.beginPath(); g.ellipse(160, 46, 10, 12, 0, 0, 7); g.fill();
      g.fillStyle = '#f2d34a'; g.beginPath(); g.arc(155, 42, 3, 0, 7); g.arc(165, 42, 3, 0, 7); g.fill();
      g.fillStyle = '#111'; g.fillRect(154.5, 40, 1.2, 4); g.fillRect(164.5, 40, 1.2, 4);
      g.strokeStyle = '#e0234e'; g.lineWidth = 2; g.beginPath(); g.moveTo(160, 34); g.lineTo(160, 26); g.lineTo(156, 22); g.moveTo(160, 26); g.lineTo(164, 22); g.stroke();
      const m = g.createRadialGradient(196, 46, 1, 198, 50, 10); m.addColorStop(0, '#ffe36e'); m.addColorStop(1, '#e0402a'); g.fillStyle = m; g.beginPath(); g.ellipse(198, 50, 7, 9, 0.5, 0, 7); g.fill();
    }

    let down = null;
    function swipe(dx, dy){ turn(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')); }
    return {
      id:'snake', title:'ANACONDA', W, H, statLabel:'Level', maxLives: MAX_LIVES, type:'endless',
      tile:{ order:8, name:'Anaconda', kind:'Jungle snake', art: artTile, isNew: true },
      controls: ['Swipe up, down, left or right to steer the anaconda.', 'Or tap on the side of the board you want to turn toward.', 'Eat fruit to grow. Golden eggs are worth extra and grow you by 3.', 'Every 8 fruit is a new level: faster, with more rocks and logs.', "Don't hit the edge, a rock, or your own tail.", 'On a keyboard, use the arrow keys.'],
      powers: Object.entries(POWERS).map(([k,p]) => ({ name:p.name, desc:p.desc, icon: g => powOrb(g, k, 23, 14, 12) })),
      init(){},
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg){ const R = mode === 'daily' ? mulberry(seedFrom('snake-daily-' + PB.today())) : rand; fresh(mode, R, lives, 'ready'); st.msg = msg ? msg + ' Swipe to go' : 'Swipe to start slithering'; },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: st.lives, stat: st.level, score: st.score }; },
      pointerDown(x, y){ down = { x, y, used: false }; },
      pointerMove(x, y){ if (!down || down.used) return; const dx = x - down.x, dy = y - down.y; if (Math.hypot(dx, dy) > 26) { down.used = true; swipe(dx, dy); } },
      pointerUp(x, y){
        if (!down) return;
        if (!down.used) {
          const h = st.snake[0], hx = BX + (h.x + .5) * CELL, hy = BY + (h.y + .5) * CELL;
          const dx = x - hx, dy = y - hy;
          const horiz = st.dir === 'up' || st.dir === 'down';
          if (st.phase === 'ready') swipe(dx, dy);
          else if (horiz) turn(dx < 0 ? 'left' : 'right'); else turn(dy < 0 ? 'up' : 'down');
        }
        down = null;
      },
      key(e){
        const m = { ArrowUp:'up', w:'up', ArrowDown:'down', s:'down', ArrowLeft:'left', a:'left', ArrowRight:'right', d:'right' }[e.key];
        if (m) { e.preventDefault(); turn(m); }
      },
    };
  }
  PB.register(createSnake);
})();
