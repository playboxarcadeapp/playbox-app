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
      life:   { name:'Extra life',    color:'#ff5d7a', time:0,  weight:13, desc:'Adds one heart (up to 5). You start with just one!' },
    };
    const DIRS = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
    let st = null, bgC = null;

    function fresh(mode, rand, lives, phase){
      st = { mode, phase, rand, lives, score: 0, level: 1, eaten: 0, perLevel: 8, rocks: [], fx: { slow:0, ghost:0, double:0, portal:0 },
        parts: [], pops: [], time: 0, shake: 0, msg: null, items: [], powIn: 9, inv: 0, heartIn: 18 };
      resetSnake();
      placeFood();
    }
    // After a crash the anaconda comes back at the same length: coiled along the bottom of the board, head pointing up into open jungle.
    function respawnSnake(){
      const len = Math.max(7, st.snake.length + st.grow);
      if (len <= 10) { resetSnake(); st.grow = Math.max(0, len - 4); return; }
      const x0 = 1, x1 = COLS - 2, rowW = x1 - x0 + 1, bodyN = len - 1;
      const rowsUsed = Math.min(ROWS - 5, Math.ceil(bodyN / rowW));
      const path = [];
      for (let r = 0; r < rowsUsed && path.length < bodyN; r++) {
        const y = ROWS - 1 - r;
        for (let i = 0; i < rowW && path.length < bodyN; i++) path.push({ x: r % 2 === 0 ? x0 + i : x1 - i, y });
      }
      const last = path[path.length - 1], head = { x: last.x, y: last.y - 1 };
      const cells = [head, ...path.reverse()];
      st.snake = cells.map(c => ({ x: c.x, y: c.y, px: c.x, py: c.y }));
      st.dir = 'up'; st.queue = []; st.acc = 0; st.t = 1; st.grow = Math.max(0, len - st.snake.length); st.dead = false; st.bulges = [];
      const topY = head.y - 4;
      st.rocks = st.rocks.filter(r => !(r.y >= topY && (r.y > head.y || r.x === head.x || Math.abs(r.x - head.x) <= 1)));
      st.rocks = st.rocks.filter(r => !st.snake.some(s => s.x === r.x && s.y === r.y));
      const under = st.items.filter(i => st.snake.some(s => s.x === i.x && s.y === i.y));
      st.items = st.items.filter(i => !under.includes(i));
      if (under.some(i => i.kind !== 'pow')) placeFood();
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
        // nothing hides in the corners until the snake is very long (they're too hard to reach)
        if (st.snake.length < 40 && (x <= 1 || x >= COLS - 2) && (y <= 1 || y >= ROWS - 2)) continue;
        return { x, y };
      }
      return null;
    }
    function placeFood(){
      const c = freeCell(); if (!c) return;
      const golden = st.eaten > 2 && st.rand() < 0.1;
      st.items.push({ kind: golden ? 'egg' : 'fruit', type: FRUITS[Math.floor(st.rand() * FRUITS.length)], x: c.x, y: c.y, born: st.time });
    }
    function placePower(force){
      const c = freeCell(); if (!c) return;
      if (force) { st.items.push({ kind:'pow', type: force, x: c.x, y: c.y, born: st.time, ttl: 14 }); return; }
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
    function eat(it){ if (PB.sfx) PB.sfx('eat');
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
          if (st.respawn <= 0) { st.respawn = null; respawnSnake(); st.inv = 1.5; st.phase = 'ready'; st.msg = 'Swipe to slither again'; }
        } else if (!st.dead) {
          for (const k in st.fx) if (st.fx[k] > 0) st.fx[k] = Math.max(0, st.fx[k] - dt);
          st.inv = Math.max(0, st.inv - dt);
          st.powIn -= dt; if (st.powIn <= 0) { placePower(); st.powIn = 10 + st.rand() * 8; }
          // you start with one heart, so a spare heart always shows up early on
          if (st.heartIn != null) { st.heartIn -= dt; if (st.heartIn <= 0) { st.heartIn = null; if (st.lives < MAX_LIVES) { placePower('life'); pop(W / 2, BY + 60, 'A heart appeared!', '#ff5d7a', 1.4); } } }
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
      // lush jungle floor: two-tone mowed squares, soft moss and dirt patches, thousands of grass blades, clover and tiny flowers
      for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
        const tg = g.createLinearGradient(0, BY + y * CELL, 0, BY + (y + 1) * CELL);
        if ((x + y) % 2) { tg.addColorStop(0, '#6aa844'); tg.addColorStop(1, '#5a963a'); } else { tg.addColorStop(0, '#77b44c'); tg.addColorStop(1, '#68a443'); }
        g.fillStyle = tg; g.fillRect(BX + x * CELL, BY + y * CELL, CELL, CELL);
      }
      g.save(); g.beginPath(); g.rect(BX, BY, COLS * CELL, ROWS * CELL); g.clip();
      for (let i=0;i<26;i++) { const x = BX + R() * COLS * CELL, y = BY + R() * ROWS * CELL, r = 20 + R() * 40; const mg = g.createRadialGradient(x, y, 0, x, y, r); mg.addColorStop(0, R() < 0.25 ? 'rgba(150,110,60,.22)' : 'rgba(30,80,20,.22)'); mg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = mg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      for (let i=0;i<5200;i++) { const x = BX + R() * COLS * CELL, y = BY + R() * ROWS * CELL; g.strokeStyle = ['#8ccf5e','#4f8a31','#9ad86a','#5d9c3a','#3f7a2a'][i % 5]; g.globalAlpha = 0.55; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 3, y - 2.5 - R() * 3.5); g.stroke(); }
      g.globalAlpha = 1;
      for (let i=0;i<34;i++) { const x = BX + R() * COLS * CELL, y = BY + R() * ROWS * CELL; g.fillStyle = '#4f9a36'; for (let k=0;k<3;k++) { const a = k * 2.1 + R(); g.beginPath(); g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.6, 0, 7); g.fill(); } }
      for (let i=0;i<28;i++) { const x = BX + R() * COLS * CELL, y = BY + R() * ROWS * CELL, c = ['#ffe36e','#ff8fb1','#ffffff','#c7a6ff'][i % 4]; g.fillStyle = c; for (let k=0;k<5;k++) { const a = k * 1.256; g.beginPath(); g.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.7, 0, 7); g.fill(); } g.fillStyle = '#ffb000'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); }
      // soft shade where the bamboo frame meets the grass
      const ed = 26; for (const [x0, y0, x1, y1] of [[BX, BY, BX, BY + ed], [BX, BY + ROWS * CELL, BX, BY + ROWS * CELL - ed], [BX, BY, BX + ed, BY], [BX + COLS * CELL, BY, BX + COLS * CELL - ed, BY]]) { const sg = g.createLinearGradient(x0, y0, x1, y1); sg.addColorStop(0, 'rgba(10,30,5,.4)'); sg.addColorStop(1, 'rgba(10,30,5,0)'); g.fillStyle = sg; g.fillRect(BX, BY, COLS * CELL, ROWS * CELL); }
      g.restore();
      const vg = g.createRadialGradient(W/2, BY + ROWS*CELL/2, 120, W/2, BY + ROWS*CELL/2, 330); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,30,10,.35)');
      g.fillStyle = vg; g.fillRect(BX, BY, COLS * CELL, ROWS * CELL);
      bgC = c;
      // overhanging leaves drawn on top of the board
      const f = document.createElement('canvas'); f.width = W * 2; f.height = H * 2; const fg = f.getContext('2d'); fg.scale(2, 2);
      const R2 = mulberry(77);
      for (let i=0;i<9;i++) { const gc = greens[i % 4], top = i < 5; const x = top ? BX - 20 + R2() * (COLS * CELL + 40) : (i % 2 ? BX - 18 : BX + COLS * CELL + 18), y = top ? BY - 14 : BY + R2() * ROWS * CELL;
        fg.save(); fg.shadowColor = 'rgba(0,0,0,.45)'; fg.shadowBlur = 10; fg.shadowOffsetY = 6; leaf(fg, x, y, 46 + R2() * 30, 15 + R2() * 8, top ? 1.2 + R2() * 0.8 : (i % 2 ? 0.2 : Math.PI - 0.2) + (R2() - .5) * 0.6, gc[0], gc[1]); fg.restore(); }
      fgC = f;
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
    // ---------- 3D look: a smooth, scaly anaconda body, 3D fruit, mossy rocks and logs ----------
    let E3 = null, A3 = null;
    const SUB = 4, SIDES = 14, CAP = COLS * ROWS * SUB + 8;
    // Swag Shop skins: back color, blotches, side spots, spot centers
    const SKINS = { skin_coral: { back: '#d8452e', blot: '#1a1210', spot: '#ffd23f', mid: '#1a1210' }, skin_ocean: { back: '#2f6fd0', blot: '#123068', spot: '#7fe0ff', mid: '#0c2448' }, skin_gold: { back: '#d9a520', blot: '#7a5208', spot: '#fff1a0', mid: '#6a4206' } };
    const skinPal = () => SKINS[PB.meta && PB.meta.look('snake', 'skin')] || { back: '#6f8f26', blot: '#1a2208', spot: '#d6a632', mid: '#141b06' };
    function skinTex(){
      const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'), R = mulberry(9);
      // around the body: v 0..1 = side, top (0.25), other side (0.5), belly (0.75)
      const base = g.createLinearGradient(0, 0, 0, 256);
      const P = skinPal(), sh = (c, k) => PB.shade(c, k);
      base.addColorStop(0, P.back); base.addColorStop(0.18, sh(P.back, 0.08)); base.addColorStop(0.25, sh(P.back, 0.14)); base.addColorStop(0.32, sh(P.back, 0.08)); base.addColorStop(0.5, P.back);
      base.addColorStop(0.6, '#a69a4a'); base.addColorStop(0.68, '#e6d58a'); base.addColorStop(0.75, '#f0e2a0'); base.addColorStop(0.82, '#e6d58a'); base.addColorStop(0.92, '#a69a4a'); base.addColorStop(1, '#6f8f26');
      g.fillStyle = base; g.fillRect(0, 0, 512, 256);
      // big blotches on the back, golden-rimmed spots on the sides
      for (let i=0;i<8;i++) { const x = i * 64 + 32 + (R() - .5) * 14;
        for (const [y, s] of [[64, 1], [64 + 256, 1], [-192, 1]]) { g.fillStyle = P.blot; g.beginPath(); g.ellipse(x, y + (i % 2 ? 14 : -14), 22, 15, 0, 0, 7); g.fill(); }
        for (const vy of [10, 118]) { const y = vy + (i % 2 ? 6 : -6), xx = x + 32; g.fillStyle = P.spot; g.beginPath(); g.ellipse(xx, y, 15, 11, 0, 0, 7); g.fill(); g.fillStyle = P.mid; g.beginPath(); g.ellipse(xx, y, 11, 7.5, 0, 0, 7); g.fill(); }
      }
      // belly plates
      g.strokeStyle = 'rgba(120,100,40,.35)'; g.lineWidth = 2; for (let x=0;x<512;x+=16) { g.beginPath(); g.moveTo(x, 160); g.lineTo(x, 224); g.stroke(); }
      // fine scales all over
      g.strokeStyle = 'rgba(20,28,6,.28)'; g.lineWidth = 1;
      for (let y=0;y<256;y+=8) for (let x=(y / 8 % 2) * 5;x<512;x+=10) { g.beginPath(); g.arc(x, y, 5, 0.2, Math.PI - 0.2); g.stroke(); }
      g.fillStyle = 'rgba(255,255,220,.06)'; for (let i=0;i<600;i++) g.fillRect(R() * 512, R() * 120, 2, 1);
      return c;
    }
    function assets3D(){
      if (A3) return A3; if (A3 === false) return null;
      E3 = PB.gl3d && PB.gl3d.get(); if (!E3) { A3 = false; return null; }
      const G = E3.G, M = E3.M;
      // the body: a fixed-size tube; each frame moves its vertices and draws as many rings as the snake is long
      const nv = CAP * (SIDES + 1), P = new Array(nv * 3).fill(0), Nn = new Array(nv * 3).fill(0), U = [], I = [];
      for (let k=0;k<CAP;k++) for (let j=0;j<=SIDES;j++) U.push(k / SUB * 0.5, j / SIDES);
      for (let k=0;k<CAP-1;k++) for (let j=0;j<SIDES;j++) { const a = k * (SIDES + 1) + j, b = a + SIDES + 1; I.push(a, a + 1, b, a + 1, b + 1, b); }
      const body = E3.mesh({ p: P, n: Nn, uv: U, idx: I, dynamic: true });
      const rockG = G.faceted(G.displace(G.sphere(1, 10, 8), (x, y, z) => PB.gl3d.fbm(x * 1.8 + 7, y * 1.8, z * 1.8, 3) * 0.32));
      A3 = { body, TP: new Float32Array(nv * 3), TN: new Float32Array(nv * 3), tSkin: E3.texture(skinTex()), sphere: E3.mesh(G.sphere(1, 24, 16)), sphereLo: E3.mesh(G.sphere(1, 14, 10)),
        rock: E3.mesh(rockG), log: E3.mesh(G.cylinder(1, 1, 1, 18)), ring: E3.mesh(G.torus(1, 0.12, 20, 6)), cone: E3.mesh(G.cylinder(0, 1, 1, 12, true)), box: E3.mesh(G.box(1, 1, 1)),
        tBg: null };
      return A3;
    }
    const hex3 = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
    // smooth path through the cell centres (rounded corners), with a radius for every point
    function bodyPath(pts, rad){
      const out = [], n = pts.length;
      if (n < 2) return out;
      const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
      for (let i=0;i<n-1;i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(n - 1, i + 2)];
        const far = Math.hypot(c.x - b.x, c.y - b.y) > CELL * 1.5; // wrapped through a portal: don't draw across the board
        for (let k=0;k<SUB;k++) { const t = k / SUB; out.push({ x: far ? b.x : cr(a.x, b.x, c.x, d.x, t), y: far ? b.y : cr(a.y, b.y, c.y, d.y, t), r: rad(i) * (1 - t) + rad(i + 1) * t, gap: far && k === SUB - 1 }); }
      }
      const L = pts[n - 1], P2 = pts[n - 2], dx = L.x - P2.x, dy = L.y - P2.y, dl = Math.hypot(dx, dy) || 1;
      out.push({ x: L.x, y: L.y, r: rad(n - 1) }); out.push({ x: L.x + dx / dl * CELL * 0.35, y: L.y + dy / dl * CELL * 0.35, r: 0.5 });
      return out;
    }
    function buildBody(path){
      const TP = A3.TP, TN = A3.TN, m = Math.min(path.length, CAP);
      let o = 0;
      for (let k=0;k<m;k++) {
        const p = path[k], a = path[Math.max(0, k - 1)], b = path[Math.min(m - 1, k + 1)];
        let tx = b.x - a.x, ty = -(b.y - a.y); const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const sx = -ty, sy = tx, rw = p.r, rz = p.r * 0.78, cz = rz * 0.92;
        for (let j=0;j<=SIDES;j++) { const ang = j / SIDES * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
          TP[o] = p.x + sx * c * rw; TP[o + 1] = -p.y + sy * c * rw; TP[o + 2] = cz + s * rz;
          let nx = sx * c / rw, ny = sy * c / rw, nz = s / rz; const nl = Math.hypot(nx, ny, nz) || 1; TN[o] = nx / nl; TN[o + 1] = ny / nl; TN[o + 2] = nz / nl; o += 3; }
      }
      E3.updateMesh(A3.body, TP.subarray(0, o), TN.subarray(0, o));
      A3.body.count = Math.max(0, m - 1) * SIDES * 6;
    }
    function drawItem3D(it, cx, cy, s, M, P3){
      const D = (mesh, pos, rot, sc, mat) => E3.draw(mesh, M.trs(P3(...pos), rot, sc), mat);
      const t = st.time;
      if (it.kind === 'egg') { D(A3.sphere, [cx, cy, 12], [0, 0, Math.sin(t * 2) * 0.1], [8.5 * s, 11 * s, 8.5 * s], { color: [1, 0.82, 0.25], emissive: [0.35, 0.25, 0.02], spec: 2, shine: 120 }); E3.sprite(P3(cx, cy, 20), 40 * s, [1, 0.85, 0.3], 0.35 + 0.15 * Math.sin(t * 6), true); return; }
      if (it.kind === 'pow') { const c = hex3(POWERS[it.type].color); D(A3.sphere, [cx, cy, 14], [t, t * 0.7, 0], 12 * s, { color: c, emissive: c.map(v => v * 0.45), spec: 1.8, shine: 100 }); E3.sprite(P3(cx, cy, 22), 46 * s, c, 0.45, true); return; }
      const spin = Math.sin(t * 1.5 + it.x) * 0.25;
      if (it.type === 'mango') { D(A3.sphere, [cx, cy, 10], [0, spin, 0.5], [9 * s, 11 * s, 8 * s], { color: [1, 0.55, 0.12], emissive: [0.1, 0.04, 0], spec: 0.9, shine: 50, rim: 0.3 }); D(A3.sphere, [cx - 3 * s, cy - 4 * s, 15], [0, 0, 0.5], [4 * s, 4 * s, 3 * s], { color: [1, 0.3, 0.15], spec: 0.6, noShadow: true }); D(A3.sphereLo, [cx + 5 * s, cy - 10 * s, 14], [0, 0, -0.5], [6 * s, 2.4 * s, 1.2 * s], { color: [0.24, 0.62, 0.22], spec: 0.3 }); }
      else if (it.type === 'banana') { for (let k=0;k<5;k++) { const a = -0.9 + k * 0.45, r = 10 * s; D(A3.sphere, [cx + Math.sin(a) * r, cy - Math.cos(a) * r * 0.6 + 4 * s, 9], [0, 0, a], [4.6 * s * (k === 0 || k === 4 ? 0.7 : 1), 5.5 * s, 4.2 * s], { color: [1, 0.86, 0.22], spec: 0.8, shine: 40 }); } D(A3.box, [cx - 9 * s, cy - 4 * s, 10], [0, 0, 0.6], [2.5 * s, 4 * s, 2.5 * s], { color: [0.35, 0.22, 0.1] }); }
      else { for (const [x, y] of [[-5, 2], [4, 3], [0, -4], [-1, 7], [6, -3]]) D(A3.sphereLo, [cx + x * s, cy + y * s, 8 + (y < 0 ? 2 : 0)], [0, 0, 0], 4.8 * s, { color: [0.42, 0.18, 0.7], emissive: [0.05, 0.02, 0.1], spec: 1.4, shine: 70 }); D(A3.sphereLo, [cx + 1 * s, cy - 9 * s, 13], [0, 0, 0.2], [6 * s, 2.4 * s, 1.2 * s], { color: [0.24, 0.62, 0.22], spec: 0.3 }); }
    }
    function draw3D(tile){
      const E = E3, M = E.M, P3 = E.px;
      if (!A3.tBg) A3.tBg = E.texture(bgC, { repeat: false });
      E.resize(W, H, tile ? 1 : E.quality(1.5));
      const sx = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0, sy = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0;
      E.begin({ ortho: [W, H], pos: [-sx, sy, 1500], target: [-sx, sy, 0] }, {
        noSky: true, sunDir: [0.45, -0.6, -0.66], sunColor: [1.3, 1.22, 0.95], ambSky: [0.26, 0.32, 0.26], ambGround: [0.1, 0.12, 0.07], toon: 0.4,
        shadow: { center: [W / 2, -(BY + ROWS * CELL / 2), 0], radius: 330 },
        post: { bloom: 0.45, threshold: 0.85, saturation: 1.12, contrast: 1.06, vignette: 0.3, tint: [1.02, 1.02, 0.95] },
      });
      E.backdrop(A3.tBg, W, H, { shadow: 0.42 });
      for (const r of st.rocks) {
        const x = BX + (r.x + 0.5) * CELL, y = BY + (r.y + 0.5) * CELL;
        if (r.log) { E.draw(A3.log, M.trs(P3(x, y, 8), [0, 0, Math.PI / 2 + (r.v - 0.5) * 0.4], [8, CELL * 1.05, 8]), { color: [0.55, 0.36, 0.2], spec: 0.15, shine: 10 }); E.draw(A3.sphereLo, M.trs(P3(x - 6, y - 5, 15), [0, 0, 0], [6, 3, 2.5]), { color: [0.3, 0.62, 0.25], spec: 0.1 }); }
        else { E.draw(A3.rock, M.trs(P3(x, y, 8), [r.v * 6, r.v * 3, r.v * 4], [CELL * 0.46, CELL * 0.4, 11]), { color: [0.62, 0.6, 0.56], spec: 0.25, shine: 14 }); E.draw(A3.sphereLo, M.trs(P3(x - 2, y - 6, 16), [0, 0, -0.2], [8, 4, 2.6]), { color: [0.33, 0.58, 0.22], spec: 0.05 }); }
      }
      for (const it of st.items) {
        const cx = BX + (it.x + 0.5) * CELL, cy = BY + (it.y + 0.5) * CELL, pop = Math.min(1, (st.time - it.born) * 4), bob = Math.sin(st.time * 4 + it.x) * 1.5;
        if (it.kind === 'pow') { const left = it.ttl - (st.time - it.born); if (!(left > 2 || Math.floor(left * 8) % 2)) continue; }
        drawItem3D(it, cx, cy + bob, pop, M, P3);
      }
      // the anaconda
      const pts = snakePoints(), n = pts.length;
      const flick = st.inv > 0 && Math.floor(st.inv * 10) % 2;
      if (n && !flick) {
        const bulge = i => { let m = 1; for (const b of st.bulges || []) m += 0.42 * Math.exp(-((i - b.pos) ** 2) / 1.6); return m; };
        const rad = i => { const f = i / Math.max(1, n - 1); return CELL * (0.46 - 0.24 * Math.pow(f, 1.5)) * bulge(i); };
        const ghost = st.fx.ghost > 0;
        buildBody(bodyPath(pts, rad));
        E.draw(A3.body, M.ident(), { tex: A3.tSkin, color: ghost ? [0.85, 0.85, 1.1] : [1, 1, 1], spec: 0.9, shine: 40, rim: 0.35, alpha: ghost ? 0.6 : undefined, emissive: ghost ? [0.12, 0.1, 0.25] : undefined });
        // head
        const h = pts[0], nb = pts[1] || { x: h.x - 1, y: h.y }, ang = Math.atan2(-(h.y - nb.y), h.x - nb.x), hr = CELL * 0.56;
        const Hm = M.trs(P3(h.x, h.y, hr * 0.8), [0, 0, ang], [1, 1, 1]), part = (mesh, l, r, sc, mat) => E.draw(mesh, M.mul(Hm, M.trs(l, r, sc)), mat);
        const skin = { color: [0.47, 0.62, 0.17], spec: 1, shine: 50, rim: 0.3, alpha: ghost ? 0.6 : undefined };
        part(A3.sphere, [hr * 0.25, 0, 0], [0, 0, 0], [hr * 1.15, hr * 0.92, hr * 0.62], skin);
        part(A3.sphere, [hr * 0.85, 0, -hr * 0.05], [0, 0, 0], [hr * 0.65, hr * 0.62, hr * 0.42], skin);
        part(A3.sphere, [hr * 0.2, 0, hr * 0.38], [0, 0, 0], [hr * 0.7, hr * 0.42, hr * 0.12], { color: [0.12, 0.16, 0.05], spec: 0.5, noShadow: true });
        for (const sd of [-1, 1]) {
          part(A3.sphere, [hr * 0.55, sd * hr * 0.48, hr * 0.32], [0, 0, 0], [hr * 0.3, hr * 0.27, hr * 0.27], { color: [1, 0.78, 0.15], emissive: [0.6, 0.38, 0.02], spec: 2, shine: 120 });
          part(A3.sphere, [hr * 0.62, sd * hr * 0.5, hr * 0.5], [0, 0, 0], [hr * 0.07, hr * 0.2, hr * 0.12], { color: [0.03, 0.03, 0.03], spec: 2, shine: 140, noShadow: true });
          part(A3.sphereLo, [hr * 0.5, sd * hr * 0.55, hr * 0.58], [0, 0, 0], [hr * 0.36, hr * 0.12, hr * 0.06], { color: [0.2, 0.28, 0.07], spec: 0.3, noShadow: true });
          part(A3.sphereLo, [hr * 1.38, sd * hr * 0.16, hr * 0.12], [0, 0, 0], [hr * 0.05, hr * 0.05, hr * 0.03], { color: [0.05, 0.05, 0.02], noShadow: true });
        }
        if (!reduceMotion && Math.sin(st.time * 7) > 0.35) { const ext = (Math.sin(st.time * 30) * 0.15 + 0.85) * hr;
          part(A3.box, [hr * 1.45 + ext * 0.4, 0, -hr * 0.05], [0, 0, 0], [ext * 0.8, 2, 1.5], { color: [0.88, 0.14, 0.3], spec: 0.8, noShadow: true });
          for (const sd of [-1, 1]) part(A3.box, [hr * 1.45 + ext * 0.85, sd * 2.5, -hr * 0.05], [0, 0, sd * 0.6], [ext * 0.3, 1.6, 1.4], { color: [0.88, 0.14, 0.3], spec: 0.8, noShadow: true }); }
        if (ghost) E.sprite(P3(h.x, h.y, 20), CELL * 3, [0.72, 0.65, 1], 0.35, true);
      }
      E.end(); if (!tile) E.present(ctx, W, H);
    }
    let fgC = null;
    const FLIES = Array.from({ length: 12 }, () => ({ x: Math.random() * 480, y: 140 + Math.random() * 500, p: Math.random() * 6, s: 0.4 + Math.random() * 0.6 }));
    function draw(){
      if (!bgC) paintBg();
      const in3D = !!assets3D();
      if (in3D) draw3D();
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      if (!in3D) ctx.drawImage(bgC, 0, 0, W, H);
      if (st.fx.portal > 0) { ctx.save(); ctx.strokeStyle = 'rgba(63,208,201,.85)'; ctx.shadowColor = '#3fd0c9'; ctx.shadowBlur = 16; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -st.time * 30; ctx.strokeRect(BX - 2, BY - 2, COLS * CELL + 4, ROWS * CELL + 4); ctx.restore(); }
      if (!in3D) for (const r of st.rocks) drawRock(r);
      if (in3D) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = `14px ${FONT}`;
        for (const it of st.items) if (it.kind === 'pow') { const left = it.ttl - (st.time - it.born); if (left > 2 || Math.floor(left * 8) % 2) ctx.fillText({ slow:'z', ghost:'\u2601', double:'2\u00d7', portal:'\u21c4', shrink:'\u2702', life:'\u2665' }[it.type], BX + (it.x + 0.5) * CELL, BY + (it.y + 0.5) * CELL + Math.sin(st.time * 4 + it.x) * 1.5 - 1); } }
      else for (const it of st.items) {
        const cx = BX + (it.x + 0.5) * CELL, cy = BY + (it.y + 0.5) * CELL;
        const pop = Math.min(1, (st.time - it.born) * 4), bob = Math.sin(st.time * 4 + it.x) * 1.5;
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx + 2, cy + 10, 8, 3, 0, 0, 7); ctx.fill();
        if (it.kind === 'fruit') drawFruit(it.type, cx, cy + bob, pop);
        else if (it.kind === 'egg') drawEgg(cx, cy + bob, st.time);
        else { const left = it.ttl - (st.time - it.born); if (left > 2 || Math.floor(left * 8) % 2) powOrb(ctx, it.type, cx, cy + bob, 12 * pop); }
      }
      // sunlight dappling through the canopy, slowly drifting
      if (!reduceMotion) { ctx.save(); ctx.beginPath(); ctx.rect(BX, BY, COLS * CELL, ROWS * CELL); ctx.clip(); ctx.globalCompositeOperation = 'soft-light';
        for (let k=0;k<6;k++) { const x = BX + ((k * 97 + st.time * (6 + k)) % (COLS * CELL + 120)) - 60, y = BY + 40 + ((k * 151) % (ROWS * CELL - 60)) + Math.sin(st.time * 0.5 + k) * 20, r = 60 + (k % 3) * 25;
          const dg = ctx.createRadialGradient(x, y, 0, x, y, r); dg.addColorStop(0, `rgba(255,250,200,${in3D ? 0.3 : 0.55})`); dg.addColorStop(1, 'rgba(255,250,200,0)'); ctx.fillStyle = dg; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
        ctx.restore(); }
      if (!in3D) drawSnake();
      for (const r of st.rings || []) { ctx.strokeStyle = r.color; ctx.globalAlpha = r.life / 0.45; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, 10 + (0.45 - r.life) * 70, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life / 0.6); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (fgC) ctx.drawImage(fgC, Math.sin(st.time * 0.8) * 1.5, Math.cos(st.time * 0.6) * 1, W, H);
      // fireflies
      if (!reduceMotion) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const f of FLIES) { const x = f.x + Math.sin(st.time * f.s + f.p) * 30, y = f.y + Math.cos(st.time * f.s * 0.7 + f.p) * 20, a = 0.4 + 0.6 * Math.max(0, Math.sin(st.time * 2 * f.s + f.p));
          const fg2 = ctx.createRadialGradient(x, y, 0, x, y, 9); fg2.addColorStop(0, `rgba(230,255,140,${a})`); fg2.addColorStop(1, 'rgba(230,255,140,0)'); ctx.fillStyle = fg2; ctx.fillRect(x - 9, y - 9, 18, 18); }
        ctx.restore(); }
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
      if (!bgC) paintBg();
      if (assets3D()) { const keep = st; fresh('classic', Math.random, 3, 'menu'); st.t = 1; const path = [[4,12],[5,12],[6,12],[7,12],[7,11],[7,10],[7,9],[8,9],[9,9],[10,9],[10,8],[10,7]].reverse(); st.snake = path.map(([x, y]) => ({ x, y, px: x, py: y })); st.items = [{ kind:'fruit', type:'mango', x: 10, y: 5, born: -9 }, { kind:'egg', x: 4, y: 8, born: -9 }]; st.rocks = [{ x: 12, y: 11, log: false, v: 0.3 }, { x: 3, y: 5, log: true, v: 0.5 }]; st.bulges = [{ pos: 4 }]; draw3D(true); const k = E3.canvas.height / H; g.drawImage(E3.canvas, BX * k, (BY + 70) * k, COLS * CELL * k, COLS * CELL * 0.75 * k, 0, 0, 240, 180); st = keep; return; }
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
      id:'snake', sfxScore:false, music:'snake', title:'ANACONDA', W, H, statLabel:'Level', maxLives: MAX_LIVES, type:'endless', fixedLives: true,
      tile:{ order:8, name:'Anaconda', kind:'Jungle snake', art: artTile, isNew: true },
      controls: ['Keep your finger on the screen and slide it the way you want to go. No need to lift it!', 'Or tap on the side of the board you want to turn toward.', 'Eat fruit to grow. Golden eggs are worth extra and grow you by 3.', 'Every 8 fruit is a new level: faster, with more rocks and logs.', "Don't hit the edge, a rock, or your own tail.", 'You start with one heart. Grab heart power-ups for more. If you crash, you come back at the same length.', 'On a keyboard, use the arrow keys.'],
      powers: Object.entries(POWERS).map(([k,p]) => ({ name:p.name, desc:p.desc, icon: g => powOrb(g, k, 23, 14, 12) })),
      init(){ assets3D(); },
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg){ if (A3 && E3) { const k = (PB.meta && PB.meta.look('snake', 'skin')) || ''; if (A3.skinKey !== k) { A3.skinKey = k; A3.tSkin = E3.texture(skinTex()); } } const R = mode === 'daily' ? mulberry(seedFrom('snake-daily-' + PB.today())) : rand; fresh(mode, R, 1, 'ready'); st.msg = 'Swipe to start slithering'; },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: st.lives, stat: st.level, score: st.score }; },
      debug(){ return st; },
      metrics(){ return { score: st.score, eaten: st.eaten, level: st.level, length: st.snake.length }; },
      dailyGoals: [
        { text:'Eat {n} fruit', m:'eaten', n:[20, 30, 40] },
        { text:'Grow to {n} long', m:'length', n:[25, 35, 45] },
        { text:'Reach level {n} without bumping into anything', m:'level', n:[3, 4], noHit:true },
      ],
      // Keep your finger down and slide it around: every new direction you drag turns the snake (no need to lift)
      pointerDown(x, y){ down = { x, y, used: false, last: null }; },
      pointerMove(x, y){
        if (!down) return;
        const dx = x - down.x, dy = y - down.y;
        if (Math.hypot(dx, dy) < 16) return;
        const d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        if (d !== down.last) { turn(d); down.last = d; }
        down.used = true; down.x = x; down.y = y;
      },
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
