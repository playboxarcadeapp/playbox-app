// POTION SORT: a witch's potion shelf. Pour until every flask holds one color, before the hourglass runs out.
(function(){
  const { fmt, reduceMotion, mulberry, seedFrom, shuffle } = PB;
  let ctx = PB.ctx;

  function createPotions(shell){
    const W = 480, H = 800, CAP = 4, FLOOR = 600;
    const FONT = '"Cinzel Decorative", Georgia, serif';
    const BODY = '"Nunito", "Segoe UI", sans-serif';
    const GOLD = '#f5c84c';
    const COLORS = ['#ff4d6d','#ff9f1c','#ffe14d','#b5e655','#2fbf71','#2ec4b6','#5ad1ff','#4361ee','#9d4edd','#f72585','#a0673a','#f2f2f2','#ffb3c6','#8c1c3a'];
    const NAMES = ['Dragon fire','Pumpkin brew','Sunbeam','Frog juice','Forest tonic','Mermaid tears','Sky elixir','Midnight ink','Wizard mist','Pixie punch','Troll tea','Unicorn milk','Fairy blush','Vampire wine'];
    let st = null;

    // ---------- Level design ----------
    // Every few levels adds a new potion color (up to 14). Later levels hide layers, give less time,
    // fewer undos, and pick the trickiest shuffle out of several.
    function levelSpec(n){
      const k = Math.min(3 + Math.floor((n - 1) / 4), COLORS.length);
      const hidden = n >= 55 ? 'all' : n >= 22 ? 'bottom' : 'none';
      const time = Math.round((22 + k * 12) * (1.25 - Math.min(0.5, n / 160)));
      const undos = n >= 60 ? 1 : n >= 25 ? 2 : 3;
      const tries = 1 + Math.min(4, Math.floor(n / 10));
      return { n, k, hidden, time, undos, tries, mixed: n >= 10, seed: 'potions-' + n };
    }
    function dailySpec(){ return { n:'daily', k: 10, hidden:'bottom', time: 150, undos: 2, tries: 4, mixed: true, seed: 'potions-daily-' + PB.today() }; }

    function solvable(bottles){
      const seen = new Set(); let nodes = 0;
      const done = b => b.every(t => t.length === 0 || (t.length === CAP && t.every(c => c === t[0])));
      function key(b){ return b.map(t => t.join(',')).sort().join('|'); }
      function dfs(b){
        if (done(b)) return true;
        if (++nodes > 60000) return false;
        const k = key(b); if (seen.has(k)) return false; seen.add(k);
        for (let i=0;i<b.length;i++) {
          const s = b[i]; if (!s.length) continue;
          const top = s[s.length-1];
          if (s.length === CAP && s.every(c => c === top)) continue;
          let run = 1; while (run < s.length && s[s.length-1-run] === top) run++;
          for (let j=0;j<b.length;j++) {
            if (i === j) continue;
            const d = b[j]; if (d.length >= CAP) continue;
            if (d.length && d[d.length-1] !== top) continue;
            if (!d.length && run === s.length) continue;
            const amt = Math.min(run, CAP - d.length);
            const nb = b.map(t => t.slice());
            for (let a=0;a<amt;a++) nb[j].push(nb[i].pop());
            if (dfs(nb)) return true;
          }
        }
        return false;
      }
      return dfs(bottles.map(t => t.slice())) ? nodes : 0;
    }
    function makeBottles(spec){
      const R = mulberry(seedFrom(spec.seed));
      let best = null, bestHard = -1, fallback = null, found = 0;
      for (let attempt = 0; attempt < 40 && found < (spec.tries || 1); attempt++) {
        const pool = []; for (let c=0;c<spec.k;c++) for (let i=0;i<CAP;i++) pool.push(c);
        shuffle(pool, R);
        const bottles = []; for (let b=0;b<spec.k;b++) bottles.push(pool.slice(b*CAP, b*CAP + CAP));
        bottles.push([], []);
        const trivial = bottles.some(t => t.length === CAP && t.every(c => c === t[0]));
        if (trivial) continue;
        // harder levels: no two layers of the same color touching
        const pairs = bottles.reduce((a, t) => a + t.filter((c, i) => i && c === t[i - 1]).length, 0);
        if (spec.mixed && pairs > (attempt > 25 ? 2 : 0)) continue;
        fallback = fallback || bottles;
        const hard = solvable(bottles);
        if (!hard) continue;
        found++;
        if (hard > bestHard) { bestHard = hard; best = bottles; }
      }
      best = best || fallback;
      if (!best) return makeBottles({ ...spec, mixed: false, seed: spec.seed + '-b' });
      return best.map(t => t.map((c, i) => ({ c, hidden: (spec.hidden === 'all' && i < t.length - 1) || (spec.hidden === 'bottom' && i === 0) })));
    }

    // ---------- Layout ----------
    function layout(){
      const n = st.bottles.length;
      const rows = n <= 6 ? 1 : 2;
      const perRow = Math.ceil(n / rows);
      const bw = Math.min(56, Math.floor((W - 40) / perRow) - 14), bh = 176;
      const pos = [];
      for (let i=0;i<n;i++) {
        const row = rows === 1 ? 0 : (i < perRow ? 0 : 1);
        const inRow = row === 0 ? Math.min(perRow, n) : n - perRow;
        const idx = row === 0 ? i : i - perRow;
        const gap = (W - 40) / inRow;
        const x = 20 + gap * idx + gap / 2 - bw / 2;
        const y = rows === 1 ? 250 : (row === 0 ? 150 : 392);
        pos.push({ x, y, w: bw, h: bh });
      }
      st.pos = pos; st.rowsY = rows === 1 ? [250] : [150, 392];
    }

    function fresh(mode, level){
      const spec = mode === 'daily' ? dailySpec() : levelSpec(level);
      st = { mode, spec, bottles: makeBottles(spec), sel: -1, anim: null, undo: [], undos: spec.undos || 3, time: spec.time, clock: 0,
        score: 0, over: false, parts: [], pops: [], sealed: new Set(), shake: 0, bubbles: [], phase:'play',
        motes: Array.from({ length: 26 }, () => ({ x: 160 + Math.random() * 220, y: 160 + Math.random() * 440, v: 4 + Math.random() * 8, r: 0.8 + Math.random() * 1.4, ph: Math.random() * 6 })) };
      layout();
      for (let i=0;i<14;i++) st.bubbles.push({ x: W/2 - 6 + Math.random()*80, y: H - 72 - Math.random()*30, v: 10 + Math.random()*20, r: 2 + Math.random()*4 });
    }

    const topRun = b => { if (!b.length) return 0; const c = b[b.length-1].c; let r = 1; while (r < b.length && b[b.length-1-r].c === c && !b[b.length-1-r].hidden) r++; return r; };
    const isSealed = b => b.length === CAP && b.every(l => !l.hidden && l.c === b[0].c);
    function canPour(i, j){
      if (i === j) return false;
      const s = st.bottles[i], d = st.bottles[j];
      if (!s.length || d.length >= CAP || isSealed(s)) return false;
      return !d.length || d[d.length-1].c === s[s.length-1].c;
    }
    function tap(i){
      if (st.anim || st.over) return;
      if (st.sel < 0) { if (st.bottles[i].length && !isSealed(st.bottles[i])) { st.sel = i; if (PB.sfx) PB.sfx('pick'); } return; }
      if (st.sel === i) { st.sel = -1; return; }
      if (canPour(st.sel, i)) { startPour(st.sel, i); st.sel = -1; }
      else if (st.bottles[i].length && !isSealed(st.bottles[i])) { st.wiggle = { i: st.sel, t: 0.3 }; st.sel = i; if (PB.sfx) PB.sfx('nope'); }
      else { st.wiggle = { i: st.sel, t: 0.3 }; st.sel = -1; if (PB.sfx) PB.sfx('nope'); }
    }
    function startPour(i, j){ if (PB.sfx) PB.sfx('pour');
      const s = st.bottles[i], d = st.bottles[j]; st.pours = (st.pours || 0) + 1;
      const amt = Math.min(topRun(s), CAP - d.length);
      st.undo.push(st.bottles.map(b => b.map(l => ({ ...l }))));
      if (st.undo.length > 30) st.undo.shift();
      st.anim = { i, j, t: 0, amt, color: s[s.length-1].c, moved: false };
    }
    function finishPour(){
      const { i, j, amt } = st.anim;
      for (let a=0;a<amt;a++) st.bottles[j].push(st.bottles[i].pop());
      const s = st.bottles[i];
      if (s.length) s[s.length-1].hidden = false;
      if (isSealed(st.bottles[j]) && !st.sealed.has(j)) {
        st.sealed.add(j); st.score += 100;
        sparkle(st.pos[j].x + st.pos[j].w/2, st.pos[j].y + 6, COLORS[st.bottles[j][0].c], 22);
        if (PB.sfx) PB.sfx('seal'); pop(st.pos[j].x + st.pos[j].w/2, st.pos[j].y - 22, NAMES[st.bottles[j][0].c] + '!', COLORS[st.bottles[j][0].c]);
      }
    }
    function checkWin(){
      if (st.bottles.every(b => !b.length || isSealed(b))) {
        st.over = true; st.won = true;
        const frac = st.time / st.spec.time;
        const stars = frac >= 0.5 ? 3 : frac >= 0.25 ? 2 : 1;
        st.score += Math.round(st.time * 10) + st.spec.k * 50;
        pop(W/2, 120, 'All sorted!', GOLD, 1.6);
        for (let i=0;i<st.pos.length;i++) sparkle(st.pos[i].x + st.pos[i].w/2, st.pos[i].y + 40, GOLD, 10);
        if (st.mode === 'daily') shell.gameOver(st.score, `Sorted with ${Math.ceil(st.time)} seconds to spare`);
        else shell.levelDone({ win: true, stars, score: st.score, summary: `${Math.ceil(st.time)} seconds left on the hourglass` });
      }
    }
    function timeUp(){
      st.over = true;
      const done = st.bottles.filter(isSealed).length;
      if (st.mode === 'daily') shell.gameOver(st.score, `You sealed ${done} of ${st.spec.k} potions`);
      else shell.levelDone({ win: false, stars: 0, score: st.score, summary: `You sealed ${done} of ${st.spec.k} potions. Try again!` });
    }
    function doUndo(){
      if (st.anim || st.over || !st.undo.length || st.undos <= 0) return;
      st.bottles = st.undo.pop(); st.undos--; st.sel = -1;
      st.sealed = new Set(st.bottles.map((b, i) => isSealed(b) ? i : -1).filter(i => i >= 0));
    }
    function restart(){
      if (st.anim || st.over) return;
      const time = st.time, spec = st.spec;
      st.bottles = makeBottles(spec); st.sel = -1; st.undo = []; st.undos = spec.undos || 3; st.sealed = new Set(); st.score = 0;
      st.time = time; layout();
    }
    function sparkle(x, y, color, n){
      if (reduceMotion) return;
      for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, s = 40 + Math.random()*140; st.parts.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 40, life: .8, color }); }
    }
    function pop(x, y, text, color, life){ st.pops.push({ x, y, text, color, life: life || 1.3 }); }

    function update(dt){
      st.clock += dt;
      if (!st.over && st.phase === 'play') {
        st.time = Math.max(0, st.time - dt);
        if (st.time <= 0) timeUp();
      }
      if (st.anim) {
        st.anim.t += dt / 0.75;
        if (!st.anim.moved && st.anim.t >= 0.55) { st.anim.moved = true; finishPour(); }
        if (st.anim.t >= 1) { st.anim = null; checkWin(); }
      }
      if (st.wiggle) { st.wiggle.t -= dt; if (st.wiggle.t <= 0) st.wiggle = null; }
      for (const q of st.parts) { q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 160*dt; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.y -= 26*dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      for (const b of st.bubbles) { b.y -= b.v * dt; if (b.y < H - 112) { b.y = H - 72; b.x = W/2 - 6 + Math.random()*80; } }
    }

    // ---------- Drawing ----------
    function tubePath(g, x, y, w, h){
      const r = w / 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h - r); g.arc(x + r, y + h - r, r, Math.PI, 0, true); g.lineTo(x + w, y); g.closePath();
    }
    function drawBottle(i, x, y, w, h, rot){
      const b = st.bottles[i], r = w / 2, t = st.clock;
      ctx.save();
      if (rot) { ctx.translate(x + w/2, y); ctx.rotate(rot); ctx.translate(-(x + w/2), -y); }
      if (st.sel === i) { ctx.save(); ctx.shadowColor = GOLD; ctx.shadowBlur = 26; ctx.strokeStyle = 'rgba(245,200,76,.9)'; ctx.lineWidth = 4; tubePath(ctx, x, y, w, h); ctx.stroke(); ctx.restore(); }
      // back of the glass: a faint cool tint, darker toward the edges
      const back = ctx.createLinearGradient(x, 0, x + w, 0);
      back.addColorStop(0, 'rgba(10,14,30,.45)'); back.addColorStop(0.5, 'rgba(150,170,220,.10)'); back.addColorStop(1, 'rgba(10,14,30,.5)');
      ctx.fillStyle = back; tubePath(ctx, x, y, w, h); ctx.fill();
      // liquid layers
      ctx.save(); tubePath(ctx, x + 3, y + 3, w - 6, h - 6); ctx.clip();
      const lh = (h - 18) / CAP;
      const animOut = st.anim && st.anim.i === i && !st.anim.moved;
      let surface = null, surfCol = null;
      b.forEach((l, k) => {
        const ly = y + h - 4 - (k + 1) * lh;
        const col = l.hidden ? '#3a2a55' : COLORS[l.c];
        let top = ly;
        if (animOut && k >= b.length - st.anim.amt) { const f = Math.min(1, st.anim.t / 0.55); top = ly + lh * f; }
        if (top >= ly + lh) return;
        const grd = ctx.createLinearGradient(x, 0, x + w, 0);
        grd.addColorStop(0, PB.shade(col, -0.55)); grd.addColorStop(0.22, PB.shade(col, -0.12)); grd.addColorStop(0.42, lighten(col)); grd.addColorStop(0.62, col); grd.addColorStop(1, PB.shade(col, -0.6));
        ctx.fillStyle = grd; ctx.fillRect(x, top, w, ly + lh - top + 1);
        // soft depth: darker at the bottom of each layer
        const vg = ctx.createLinearGradient(0, top, 0, ly + lh); vg.addColorStop(0, 'rgba(255,255,255,.10)'); vg.addColorStop(1, 'rgba(0,0,0,.18)');
        ctx.fillStyle = vg; ctx.fillRect(x, top, w, ly + lh - top + 1);
        if (l.hidden) { ctx.fillStyle = 'rgba(255,243,214,.6)'; ctx.font = `900 ${Math.round(lh * 0.55)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', x + w/2, ly + lh/2 + 2); }
        surface = top; surfCol = col;
      });
      if (st.anim && st.anim.j === i && !st.anim.moved) {
        const f = Math.max(0, (st.anim.t - 0.2) / 0.35), col = COLORS[st.anim.color];
        const base = y + h - 4 - b.length * lh, hh = lh * st.anim.amt * Math.min(1, f);
        if (hh > 0) {
          const grd = ctx.createLinearGradient(x, 0, x + w, 0); grd.addColorStop(0, PB.shade(col, -0.55)); grd.addColorStop(0.42, lighten(col)); grd.addColorStop(1, PB.shade(col, -0.6));
          ctx.fillStyle = grd; ctx.fillRect(x, base - hh, w, hh); surface = base - hh; surfCol = col;
        }
      }
      if (surface != null) {
        // magical inner glow and rising bubbles
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(x + w * 0.45, (surface + y + h) / 2, 2, x + w * 0.45, (surface + y + h) / 2, h * 0.5);
        gl.addColorStop(0, 'rgba(255,255,255,.16)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(x, surface, w, y + h - surface);
        if (!reduceMotion) for (let k=0;k<5;k++) {
          const span = y + h - 8 - surface; if (span < 10) break;
          const ph = ((t * (0.25 + k * 0.07) + k * 0.37 + i * 0.13) % 1), by = y + h - 8 - ph * span;
          const bx = x + w * (0.25 + ((k * 37 + i * 11) % 50) / 100) + Math.sin(t * 3 + k) * 2;
          ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - ph)})`; ctx.beginPath(); ctx.arc(bx, by, 1.2 + (k % 3) * 0.7, 0, 7); ctx.fill();
        }
        ctx.restore();
        // meniscus
        ctx.fillStyle = lighten(surfCol); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(x + w/2, surface + 1, w/2, 4, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x + w/2, surface + 1, w/2 - 2, 3.4, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
      }
      ctx.restore();
      // front of the glass
      const edge = ctx.createLinearGradient(x, 0, x + w, 0);
      edge.addColorStop(0, 'rgba(235,245,255,.95)'); edge.addColorStop(0.5, 'rgba(235,245,255,.35)'); edge.addColorStop(1, 'rgba(235,245,255,.8)');
      ctx.strokeStyle = edge; ctx.lineWidth = 2.6; tubePath(ctx, x, y, w, h); ctx.stroke();
      const spec = ctx.createLinearGradient(0, y + 10, 0, y + h - 20);
      spec.addColorStop(0, 'rgba(255,255,255,.65)'); spec.addColorStop(0.6, 'rgba(255,255,255,.25)'); spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec; ctx.beginPath(); ctx.roundRect(x + w * 0.16, y + 12, Math.max(3, w * 0.1), h - 44, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.roundRect(x + w * 0.78, y + 20, 2, h * 0.42, 1); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + r, y + h - r, r - 5, Math.PI * 0.62, Math.PI * 0.9); ctx.stroke();
      // lip of the flask
      const lip = ctx.createLinearGradient(x - 5, 0, x + w + 5, 0);
      lip.addColorStop(0, '#9fb0cc'); lip.addColorStop(0.35, '#ffffff'); lip.addColorStop(1, '#8b9ab8');
      ctx.fillStyle = lip; ctx.beginPath(); ctx.ellipse(x + w/2, y - 1, w/2 + 5, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(20,24,45,.75)'; ctx.beginPath(); ctx.ellipse(x + w/2, y - 2, w/2 - 1, 3.4, 0, 0, 7); ctx.fill();
      if (isSealed(b)) {
        const ck = ctx.createLinearGradient(x + 6, 0, x + w - 6, 0); ck.addColorStop(0, '#7a5230'); ck.addColorStop(0.4, '#c99360'); ck.addColorStop(1, '#6a4526');
        ctx.fillStyle = ck; ctx.beginPath(); ctx.moveTo(x + 7, y + 2); ctx.lineTo(x + 4, y - 20); ctx.quadraticCurveTo(x + w/2, y - 26, x + w - 4, y - 20); ctx.lineTo(x + w - 7, y + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(60,35,15,.5)'; for (let k=0;k<6;k++) { ctx.beginPath(); ctx.arc(x + 10 + (k * 13) % (w - 18), y - 6 - (k * 7) % 12, 1.2, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#b3261e'; ctx.beginPath(); ctx.arc(x + w/2, y - 8, 7, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(x + w/2 - 2, y - 10, 2.5, 0, 7); ctx.fill();
        ctx.save(); ctx.shadowColor = GOLD; ctx.shadowBlur = 10; ctx.fillStyle = GOLD; star(ctx, x + w/2, y - 38, 8, 3.5); ctx.fill(); ctx.restore();
      }
      ctx.restore();
    }
    function lighten(hex){ const n = parseInt(hex.slice(1), 16); const f = v => Math.min(255, Math.round(v + (255 - v) * 0.35)); return `rgb(${f(n>>16)},${f((n>>8)&255)},${f(n&255)})`; }
    function star(g, cx, cy, ro, ri){ g.beginPath(); for (let i=0;i<10;i++){ const a = -Math.PI/2 + i*Math.PI/5, r = i%2 ? ri : ro; g.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r); } g.closePath(); }
    // The castle hall behind the shelves is painted once; candles, wizard, owl and cauldron are animated.
    let hallC = null, shelfC = null, wizL = null;
    function paintShelf(){
      const c = document.createElement('canvas'); c.width = 920; c.height = 60; const g = c.getContext('2d'), R = PB.mulberry(31);
      const top = g.createLinearGradient(0, 0, 0, 14); top.addColorStop(0, '#b07a4a'); top.addColorStop(1, '#8a5531'); g.fillStyle = top; g.fillRect(0, 6, 920, 14);
      const fr = g.createLinearGradient(0, 20, 0, 52); fr.addColorStop(0, '#7a4826'); fr.addColorStop(1, '#3e2210'); g.fillStyle = fr; g.fillRect(0, 20, 920, 32);
      g.strokeStyle = 'rgba(40,20,5,.35)'; g.lineWidth = 1.4; for (let k=0;k<14;k++) { const yy = 22 + R() * 28; g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(300, yy + (R() - .5) * 8, 600, yy + (R() - .5) * 8, 920, yy); g.stroke(); }
      g.fillStyle = 'rgba(255,230,190,.35)'; g.fillRect(0, 19, 920, 2);
      g.fillStyle = '#2b2b30'; for (const x of [30, 890]) { g.fillRect(x - 10, 20, 20, 32); g.fillStyle = '#5a5a63'; g.beginPath(); g.arc(x, 36, 3, 0, 7); g.fill(); g.fillStyle = '#2b2b30'; }
      shelfC = c;
    }
    function paintHall(){
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
      const g = c.getContext('2d'); g.scale(2, 2);
      const R = PB.mulberry(77);
      g.fillStyle = '#1e1a2b'; g.fillRect(0, 0, W, H);
      // stone blocks
      for (let y = 0, row = 0; y < FLOOR; y += 30, row++) {
        for (let x = -(row % 2) * 34; x < W; x += 68) {
          const v = 0.85 + R() * 0.3;
          const base = Math.round(52 * v), tint = Math.round(48 * v), b = Math.round(66 * v);
          g.fillStyle = `rgb(${base},${tint},${b})`; g.fillRect(x + 1, y + 1, 66, 28);
          g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 1, y + 1, 66, 3);
          g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 1, y + 25, 66, 4);
          for (let k=0;k<4;k++) { g.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`; g.beginPath(); g.arc(x + R() * 66, y + R() * 28, 1 + R() * 3, 0, 7); g.fill(); }
        }
      }
      // tall gothic window with moonlit sky and distant towers
      const wx = W / 2, wTop = 6, wBot = 150, ww = 74;
      const arch = () => { g.beginPath(); g.moveTo(wx - ww, wBot); g.lineTo(wx - ww, wTop + 70); g.quadraticCurveTo(wx - ww, wTop, wx, wTop - 6); g.quadraticCurveTo(wx + ww, wTop, wx + ww, wTop + 70); g.lineTo(wx + ww, wBot); g.closePath(); };
      g.save(); arch(); g.clip();
      const sky = g.createLinearGradient(0, 0, 0, wBot); sky.addColorStop(0, '#0d1b3d'); sky.addColorStop(1, '#2a3f73');
      g.fillStyle = sky; g.fillRect(wx - ww, 0, ww * 2, wBot);
      for (let i=0;i<40;i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; g.fillRect(wx - ww + R() * ww * 2, R() * 110, 1.4, 1.4); }
      const moon = g.createRadialGradient(wx + 30, 44, 2, wx + 30, 44, 50); moon.addColorStop(0, 'rgba(255,250,225,1)'); moon.addColorStop(0.3, 'rgba(255,250,225,.95)'); moon.addColorStop(0.32, 'rgba(255,240,200,.35)'); moon.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = moon; g.beginPath(); g.arc(wx + 30, 44, 50, 0, 7); g.fill();
      g.fillStyle = '#0f1630';
      g.beginPath(); g.moveTo(wx - ww, wBot); g.lineTo(wx - ww, 128); g.lineTo(wx - 40, 120); g.lineTo(wx - 40, 92); g.lineTo(wx - 48, 92); g.lineTo(wx - 36, 70); g.lineTo(wx - 24, 92); g.lineTo(wx - 30, 92); g.lineTo(wx - 30, 112); g.lineTo(wx, 108); g.lineTo(wx, 84); g.lineTo(wx - 6, 84); g.lineTo(wx + 6, 58); g.lineTo(wx + 18, 84); g.lineTo(wx + 12, 84); g.lineTo(wx + 12, 114); g.lineTo(wx + 40, 116); g.lineTo(wx + 40, 100); g.lineTo(wx + 34, 100); g.lineTo(wx + 44, 84); g.lineTo(wx + 54, 100); g.lineTo(wx + 48, 100); g.lineTo(wx + 48, 124); g.lineTo(wx + ww, 128); g.lineTo(wx + ww, wBot); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,214,120,.85)'; for (const [x, y] of [[-35, 100], [5, 92], [44, 108], [-14, 116], [24, 120]]) g.fillRect(wx + x, y, 2.5, 3.5);
      g.restore();
      g.strokeStyle = '#4a4258'; g.lineWidth = 7; arch(); g.stroke();
      g.strokeStyle = '#2c2638'; g.lineWidth = 3; g.beginPath(); g.moveTo(wx, wTop); g.lineTo(wx, wBot); g.moveTo(wx - ww, 80); g.lineTo(wx + ww, 80); g.stroke();
      // moonlight falling into the hall
      const beam = g.createLinearGradient(0, wBot, 0, FLOOR); beam.addColorStop(0, 'rgba(170,190,255,.10)'); beam.addColorStop(1, 'rgba(170,190,255,0)');
      g.fillStyle = beam; g.beginPath(); g.moveTo(wx - ww, wBot); g.lineTo(wx + ww, wBot); g.lineTo(wx + ww + 70, FLOOR); g.lineTo(wx - ww + 30, FLOOR); g.closePath(); g.fill();
      // hanging banners
      for (const [x, col] of [[34, '#7a1e2b'], [W - 34, '#1f3a6b']]) {
        g.fillStyle = '#3a2a1a'; g.fillRect(x - 26, 4, 52, 5);
        const bg = g.createLinearGradient(x - 22, 0, x + 22, 0); bg.addColorStop(0, PB.shade(col, -0.3)); bg.addColorStop(0.5, col); bg.addColorStop(1, PB.shade(col, -0.35));
        g.fillStyle = bg; g.beginPath(); g.moveTo(x - 22, 8); g.lineTo(x + 22, 8); g.lineTo(x + 22, 128); g.lineTo(x, 112); g.lineTo(x - 22, 128); g.closePath(); g.fill();
        g.strokeStyle = '#c9a23c'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#c9a23c'; star(g, x, 54, 11, 4.6); g.fill();
      }
      // flagstone floor
      const fl = g.createLinearGradient(0, FLOOR, 0, H); fl.addColorStop(0, '#2b2533'); fl.addColorStop(1, '#16121c');
      g.fillStyle = fl; g.fillRect(0, FLOOR, W, H - FLOOR);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5;
      for (let y = FLOOR, k = 0; y < H; y += 22 + k * 6, k++) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let i=-6;i<=6;i++) { g.beginPath(); g.moveTo(W/2 + i * 40, FLOOR); g.lineTo(W/2 + i * 90, H); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, FLOOR, W, 6);
      // stone grain
      const N = PB.gl3d, nc = document.createElement('canvas'); nc.width = 160; nc.height = 200; const ng = nc.getContext('2d'), id = ng.createImageData(160, 200);
      for (let y=0;y<200;y++) for (let x=0;x<160;x++) { const v = N ? 128 + N.fbm(x / 9, y / 9, 2.2, 4) * 150 : 128 + (R() - .5) * 40; const k = (y * 160 + x) * 4; id.data[k] = id.data[k+1] = id.data[k+2] = Math.max(0, Math.min(255, v)); id.data[k+3] = 255; }
      ng.putImageData(id, 0, 0);
      g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.35; g.drawImage(nc, 0, 0, W, FLOOR); g.restore();
      // stone pillars framing the hall
      for (const px of [0, W - 26]) {
        const pg = g.createLinearGradient(px, 0, px + 26, 0); pg.addColorStop(0, '#2a2534'); pg.addColorStop(0.45, '#4b4459'); pg.addColorStop(1, '#221e2b');
        g.fillStyle = pg; g.fillRect(px, 0, 26, FLOOR);
        g.fillStyle = 'rgba(0,0,0,.3)'; for (let y=0;y<FLOOR;y+=46) g.fillRect(px, y, 26, 2);
        g.fillStyle = '#3d3748'; g.fillRect(px - 3, FLOOR - 16, 32, 16);
      }
      // warm candle light pooling on the upper wall
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x, y, r] of [[60, 120, 120], [240, 90, 150], [420, 120, 120]]) { const lg = g.createRadialGradient(x, y, 4, x, y, r); lg.addColorStop(0, 'rgba(255,170,80,.16)'); lg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = lg; g.fillRect(x - r, y - r, r * 2, r * 2); }
      const fg = g.createRadialGradient(W/2 + 34, H - 60, 10, W/2 + 34, H - 60, 260); fg.addColorStop(0, 'rgba(140,255,110,.16)'); fg.addColorStop(1, 'rgba(140,255,110,0)'); g.fillStyle = fg; g.fillRect(0, H - 320, W, 320);
      g.restore();
      // vignette
      const vg = g.createRadialGradient(W/2, H * 0.45, H * 0.25, W/2, H * 0.5, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      hallC = c;
    }
    const CANDLES = [[186,40,.8],[214,96,.9],[268,70,.75],[298,112,.95],[236,128,.7],[30,124,.85],[86,118,.75],[150,124,.8],[336,124,.8],[400,118,.75],[452,126,.85]].map(([x, y, s], i) => ({ x, y, s, ph: i * 1.7 }));
    function floatingCandle(c, t){
      const bob = reduceMotion ? 0 : Math.sin(t * 1.3 + c.ph) * 5;
      const x = c.x, y = c.y + bob, s = c.s;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(x, y - 6 * s, 1, x, y - 6 * s, 46 * s); glow.addColorStop(0, 'rgba(255,190,100,.55)'); glow.addColorStop(0.25, 'rgba(255,170,80,.18)'); glow.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - 46 * s, y - 52 * s, 92 * s, 92 * s); ctx.restore();
      const wax = ctx.createLinearGradient(x - 4 * s, 0, x + 4 * s, 0); wax.addColorStop(0, '#d9ccb0'); wax.addColorStop(0.5, '#fff6e0'); wax.addColorStop(1, '#c4b59a');
      ctx.fillStyle = wax; ctx.fillRect(x - 4 * s, y, 8 * s, 26 * s);
      ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(x + 2 * s, y + 6 * s, 1.6 * s, 0, 7); ctx.fill();
      const fl = reduceMotion ? 0 : Math.sin(t * 11 + c.ph) * 1.2;
      ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.ellipse(x - 2 * s, y + 9 * s, 1.3 * s, 4 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 3 * s); ctx.stroke();
      const fg = ctx.createRadialGradient(x, y - 5 * s, 0.5, x, y - 6 * s, 7 * s); fg.addColorStop(0, '#fffbe8'); fg.addColorStop(0.4, '#ffd86b'); fg.addColorStop(1, 'rgba(255,120,40,.0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x + fl * 0.3, y - 7 * s, 3.4 * s, (7.5 + fl) * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.ellipse(x + fl * 0.3, y - 4 * s, 1.1 * s, 2.6 * s, 0, 0, 7); ctx.fill();
    }
    function drawWizard(x, feet, t){
      const s = st.rowsY.length === 1 ? 1.0 : 0.82;
      ctx.save(); ctx.translate(x, feet); ctx.scale(s, s);
      const sway = reduceMotion ? 0 : Math.sin(t * 1.2) * 2;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, -2, 62, 10, 0, 0, 7); ctx.fill();
      // robe
      const robe = ctx.createLinearGradient(-50, 0, 50, 0); robe.addColorStop(0, '#1b1238'); robe.addColorStop(0.45, '#3d2b78'); robe.addColorStop(1, '#170f30');
      ctx.fillStyle = robe; ctx.beginPath(); ctx.moveTo(-26, -150); ctx.quadraticCurveTo(-44, -60, -58, 0); ctx.lineTo(58, 0); ctx.quadraticCurveTo(44, -60, 28, -150); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; for (const fx of [-20, 4, 26]) { ctx.beginPath(); ctx.moveTo(fx * 0.4, -130); ctx.quadraticCurveTo(fx, -60, fx * 1.3, 0); ctx.stroke(); }
      const trim = ctx.createLinearGradient(0, -10, 0, 0); trim.addColorStop(0, '#f0cf6a'); trim.addColorStop(1, '#8a6a1f'); ctx.fillStyle = trim; ctx.fillRect(-58, -9, 116, 7);
      ctx.fillStyle = '#3d2b78'; for (let k=-50;k<=50;k+=12) { ctx.beginPath(); ctx.arc(k, -5.5, 2, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(-10, -148); ctx.quadraticCurveTo(-20, -70, -26, 0); ctx.lineTo(-6, 0); ctx.quadraticCurveTo(-4, -80, 0, -148); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,150,.7)'; for (const [sx, sy] of [[-30, -40], [18, -70], [-8, -100], [32, -24], [-40, -16]]) { star(ctx, sx, sy, 4, 1.6); ctx.fill(); }
      // far arm resting
      ctx.fillStyle = '#2a1d55'; ctx.beginPath(); ctx.moveTo(-24, -140); ctx.quadraticCurveTo(-46, -100, -34, -78); ctx.lineTo(-22, -82); ctx.quadraticCurveTo(-30, -104, -14, -128); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f0c8a2'; ctx.beginPath(); ctx.arc(-29, -78, 6, 0, 7); ctx.fill();
      // beard (behind the face, over the robe)
      const beard = ctx.createLinearGradient(0, -170, 0, -60); beard.addColorStop(0, '#ffffff'); beard.addColorStop(1, '#c9ccd6');
      ctx.fillStyle = beard; ctx.beginPath(); ctx.moveTo(-18, -164); ctx.quadraticCurveTo(-26, -110, -8 + sway, -64); ctx.quadraticCurveTo(0 + sway, -58, 6 + sway, -66); ctx.quadraticCurveTo(26, -112, 18, -164); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(150,155,170,.6)'; ctx.lineWidth = 1.2; for (const bx of [-10, -2, 6]) { ctx.beginPath(); ctx.moveTo(bx, -150); ctx.quadraticCurveTo(bx - 4, -110, bx * 0.4 + sway, -72); ctx.stroke(); }
      // face
      ctx.fillStyle = '#f0c8a2'; ctx.beginPath(); ctx.ellipse(0, -176, 15, 17, 0, 0, 7); ctx.fill();
      const fshade = ctx.createRadialGradient(-4, -182, 2, 0, -176, 18); fshade.addColorStop(0, 'rgba(255,235,215,.6)'); fshade.addColorStop(1, 'rgba(160,90,70,.35)'); ctx.fillStyle = fshade; ctx.beginPath(); ctx.ellipse(0, -176, 15, 17, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(230,120,110,.35)'; ctx.beginPath(); ctx.ellipse(-9, -170, 4, 2.6, 0, 0, 7); ctx.ellipse(11, -170, 4, 2.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e3a98a'; ctx.beginPath(); ctx.ellipse(3, -172, 4.5, 6, 0.2, 0, 7); ctx.fill();
      const blink = Math.sin(t * 0.8) > 0.985;
      ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      if (blink) { ctx.beginPath(); ctx.moveTo(-9, -180); ctx.lineTo(-3, -180); ctx.moveTo(6, -180); ctx.lineTo(12, -180); ctx.stroke(); }
      else { ctx.fillStyle = '#3a2a2a'; ctx.beginPath(); ctx.arc(-6, -180, 2, 0, 7); ctx.arc(9, -180, 2, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-12, -186); ctx.lineTo(-2, -184); ctx.moveTo(5, -184); ctx.lineTo(15, -186); ctx.stroke();
      ctx.fillStyle = '#f4f4f6'; ctx.beginPath(); ctx.moveTo(-14, -166); ctx.quadraticCurveTo(0, -172, 16, -166); ctx.quadraticCurveTo(10, -160, 1, -164); ctx.quadraticCurveTo(-8, -160, -14, -166); ctx.fill();
      // half-moon glasses
      ctx.strokeStyle = '#c9a23c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-6, -178, 5, 0, Math.PI); ctx.moveTo(14, -178); ctx.arc(9, -178, 5, 0, Math.PI); ctx.moveTo(-1, -178); ctx.lineTo(4, -178); ctx.stroke();
      // hat with a bent tip
      const hat = ctx.createLinearGradient(-30, 0, 30, 0); hat.addColorStop(0, '#1b1238'); hat.addColorStop(0.5, '#3a2a74'); hat.addColorStop(1, '#160e2e');
      ctx.fillStyle = hat; ctx.beginPath(); ctx.ellipse(0, -192, 38, 9, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-22, -194); ctx.quadraticCurveTo(-8, -240, 6, -262); ctx.quadraticCurveTo(26 + sway, -268, 34 + sway, -250); ctx.quadraticCurveTo(18, -252, 14, -238); ctx.quadraticCurveTo(14, -214, 22, -194); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9a23c'; ctx.fillRect(-21, -202, 43, 6);
      ctx.fillStyle = 'rgba(255,230,150,.85)'; star(ctx, 2, -222, 5, 2); ctx.fill(); ctx.beginPath(); ctx.arc(-8, -236, 1.6, 0, 7); ctx.fill();
      // wand arm reaching to the cauldron
      const wave = reduceMotion ? 0 : Math.sin(t * 3) * 0.12;
      ctx.save(); ctx.translate(22, -138); ctx.rotate(-0.15 + wave);
      ctx.fillStyle = '#2f2160'; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(30, -10, 58, 6); ctx.lineTo(54, 22); ctx.quadraticCurveTo(26, 12, -4, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f0c8a2'; ctx.beginPath(); ctx.arc(60, 12, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(58, 14); ctx.lineTo(98, 36); ctx.stroke();
      ctx.restore();
      ctx.restore();
      // wand tip position in screen space (for sparkles)
      const a = -0.15 + wave, tx = 98 * Math.cos(a) - 36 * Math.sin(a), ty = 98 * Math.sin(a) + 36 * Math.cos(a);
      return { x: x + (22 + tx) * s, y: feet + (-138 + ty) * s };
    }
    function drawOwl(x, y, t){
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 3, y, 6, H - y); ctx.fillRect(x - 26, y - 2, 52, 6);
      const blink = Math.sin(t * 0.7 + 2) > 0.97, tilt = reduceMotion ? 0 : Math.sin(t * 0.5) * 0.12;
      ctx.save(); ctx.translate(x, y - 2);
      const body = ctx.createRadialGradient(-6, -40, 4, 0, -30, 34); body.addColorStop(0, '#a98a64'); body.addColorStop(1, '#5b4128');
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -30, 22, 30, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e6d3b0'; ctx.beginPath(); ctx.ellipse(0, -22, 13, 19, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(90,65,40,.6)'; ctx.lineWidth = 1.2; for (let k=0;k<4;k++) { ctx.beginPath(); ctx.arc(0, -30 + k * 8, 7, 0.3, Math.PI - 0.3); ctx.stroke(); }
      ctx.rotate(tilt);
      ctx.fillStyle = '#6e5234'; ctx.beginPath(); ctx.ellipse(0, -60, 20, 15, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18, -66); ctx.lineTo(-14, -80); ctx.lineTo(-8, -68); ctx.fill(); ctx.beginPath(); ctx.moveTo(18, -66); ctx.lineTo(14, -80); ctx.lineTo(8, -68); ctx.fill();
      for (const sd of [-1, 1]) {
        ctx.fillStyle = '#e6d3b0'; ctx.beginPath(); ctx.arc(sd * 8, -60, 8, 0, 7); ctx.fill();
        if (!blink) { ctx.fillStyle = '#ffb21a'; ctx.beginPath(); ctx.arc(sd * 8, -60, 5.5, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sd * 8, -60, 2.8, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sd * 8 - 1.3, -61.5, 1, 0, 7); ctx.fill(); }
        else { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sd * 8 - 5, -60); ctx.lineTo(sd * 8 + 5, -60); ctx.stroke(); }
      }
      ctx.fillStyle = '#d9a23c'; ctx.beginPath(); ctx.moveTo(-3, -55); ctx.lineTo(3, -55); ctx.lineTo(0, -49); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#d9a23c'; for (const fx of [-8, 8]) { ctx.beginPath(); ctx.arc(x + fx, y - 1, 3, 0, 7); ctx.fill(); }
    }
    function drawCauldron(cx, cy, t){
      // fire
      for (let i=0;i<6;i++) {
        const fx = cx - 30 + i * 12, h = 18 + (reduceMotion ? 6 : Math.sin(t * 12 + i * 1.7) * 6 + 6);
        const fg = ctx.createLinearGradient(0, cy + 44 - h, 0, cy + 44); fg.addColorStop(0, 'rgba(255,230,120,0)'); fg.addColorStop(0.4, '#ffb020'); fg.addColorStop(1, '#ff4a1a');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(fx - 7, cy + 44); ctx.quadraticCurveTo(fx, cy + 44 - h * 1.4, fx + 7, cy + 44); ctx.fill();
      }
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(cx - 44, cy + 42, 88, 6);
      const glow = ctx.createRadialGradient(cx, cy + 30, 4, cx, cy + 30, 90); glow.addColorStop(0, 'rgba(255,150,40,.3)'); glow.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy + 30, 90, 0, 7); ctx.fill();
      // pot
      const pot = ctx.createRadialGradient(cx - 18, cy - 4, 4, cx, cy + 10, 60); pot.addColorStop(0, '#4a4a55'); pot.addColorStop(1, '#0d0d12');
      ctx.fillStyle = pot; ctx.beginPath(); ctx.moveTo(cx - 54, cy - 10); ctx.quadraticCurveTo(cx - 62, cy + 40, cx - 18, cy + 46); ctx.lineTo(cx + 18, cy + 46); ctx.quadraticCurveTo(cx + 62, cy + 40, cx + 54, cy - 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1f1f27'; ctx.beginPath(); ctx.ellipse(cx, cy - 10, 58, 12, 0, 0, 7); ctx.fill();
      const brew = ctx.createRadialGradient(cx, cy - 10, 2, cx, cy - 10, 52); brew.addColorStop(0, '#d4ff9a'); brew.addColorStop(1, '#4fbf3a');
      ctx.fillStyle = brew; ctx.beginPath(); ctx.ellipse(cx, cy - 10, 50, 8.5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(160,170,190,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy - 10, 58, 12, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.ellipse(cx - 30, cy + 12, 8, 16, 0.4, 0, 7); ctx.fill();
      for (const b of st.bubbles) { ctx.fillStyle = 'rgba(190,255,150,.75)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, 7); ctx.fill(); }
      // glowing steam curling up from the brew
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k=0;k<6;k++) { const ph = ((t * 0.18 + k / 6) % 1), sx = cx - 20 + k * 8 + Math.sin(t * 0.9 + k * 2) * 14 * ph, sy = cy - 16 - ph * 120, rr = 14 + ph * 30;
        const sg = ctx.createRadialGradient(sx, sy, 1, sx, sy, rr); sg.addColorStop(0, `rgba(170,255,140,${0.16 * (1 - ph)})`); sg.addColorStop(1, 'rgba(170,255,140,0)'); ctx.fillStyle = sg; ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); }
      ctx.restore();
    }
    function drawButton(x, y, label, sub, enabled){
      ctx.globalAlpha = enabled ? 1 : 0.4;
      ctx.fillStyle = 'rgba(30,20,50,.85)'; ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - 54, y - 17, 108, 34, 17); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 14px ${BODY}`; ctx.fillText(label + (sub != null ? ` (${sub})` : ''), x, y + 1);
      ctx.globalAlpha = 1;
    }
    function draw(){
      if (!hallC) paintHall();
      ctx.drawImage(hallC, 0, 0, W, H);
      // header
      ctx.fillStyle = 'rgba(14,8,26,.72)'; ctx.beginPath(); ctx.roundRect(10, 12, 166, 86, 14); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = GOLD; ctx.font = `900 22px ${FONT}`;
      ctx.fillText(st.spec.n === 'daily' ? 'Daily Brew' : `Level ${st.spec.n}`, 22, 42);
      ctx.fillStyle = '#c9b8e8'; ctx.font = `700 13px ${BODY}`;
      ctx.fillText(`${st.spec.k} potions to sort${st.spec.hidden !== 'none' ? ' \u00b7 mystery layers' : ''}`, 22, 62);
      const frac = st.time / st.spec.time, tw = 100, tx = 22, ty = 74;
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(tx, ty, tw, 12, 6); ctx.fill();
      ctx.fillStyle = frac > 0.5 ? '#8ff06b' : frac > 0.25 ? GOLD : '#ff4d6d';
      ctx.beginPath(); ctx.roundRect(tx, ty, Math.max(12, tw * frac), 12, 6); ctx.fill();
      for (const m of [0.25, 0.5]) { ctx.fillStyle = frac >= m ? GOLD : 'rgba(255,255,255,.3)'; star(ctx, tx + tw * m, ty + 6, 7, 3); ctx.fill(); }
      ctx.fillStyle = '#fff3d6'; ctx.font = `800 14px ${BODY}`; ctx.fillText(timeStr(st.time), tx + tw + 8, ty + 11);
      drawButton(W - 64, 32, 'Undo', st.undos, st.undos > 0 && st.undo.length > 0 && !st.anim);
      drawButton(W - 64, 74, 'Restart', null, !st.anim);
      for (const c of CANDLES) floatingCandle(c, st.clock);

      // shelves
      if (!shelfC) paintShelf();
      for (const sy of st.rowsY) {
        const y = sy + 176 + 8;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(12, y + 18, W - 24, 10);
        ctx.drawImage(shelfC, 10, y - 4, W - 20, 30);
      }
      // colored light spilling from the potions onto the wall, and soft shadows on the shelf
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i=0;i<st.bottles.length;i++) {
        const b = st.bottles[i], p = st.pos[i]; if (!b.length || (st.anim && st.anim.i === i)) continue;
        const top = b[b.length - 1], col = top.hidden ? '#6a4bb0' : COLORS[top.c], n = parseInt(col.slice(1), 16);
        const cx = p.x + p.w / 2, cy = p.y + p.h * 0.7, rr = p.w * 1.7;
        const lg = ctx.createRadialGradient(cx, cy, 4, cx, cy, rr); lg.addColorStop(0, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},.22)`); lg.addColorStop(1, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},0)`);
        ctx.fillStyle = lg; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      }
      ctx.restore();
      for (let i=0;i<st.bottles.length;i++) { const p = st.pos[i]; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(p.x + p.w / 2 + 3, p.y + p.h + 8, p.w * 0.55, 4, 0, 0, 7); ctx.fill(); }

      for (let i=0;i<st.bottles.length;i++) {
        const p = st.pos[i];
        if (st.anim && st.anim.i === i) continue;
        let y = p.y, x = p.x;
        if (st.sel === i) y -= 22;
        if (st.wiggle && st.wiggle.i === i) x += Math.sin(st.clock * 60) * 4;
        drawBottle(i, x, y, p.w, p.h, 0);
      }
      if (st.anim) {
        const a = st.anim, s = st.pos[a.i], d = st.pos[a.j];
        const side = d.x > s.x ? -1 : 1;
        const tx2 = d.x + d.w/2 + side * (d.w * 0.9), ty2 = d.y - 70;
        const e = a.t < 0.25 ? a.t / 0.25 : a.t > 0.8 ? (1 - a.t) / 0.2 : 1;
        const ease = e * e * (3 - 2 * e);
        const x = s.x + (tx2 - s.w/2 - s.x) * ease, y = (s.y - 22) + (ty2 - (s.y - 22)) * ease;
        const rot = -side * 1.15 * ease;
        if (a.t > 0.22 && a.t < 0.58) {
          ctx.strokeStyle = COLORS[a.color]; ctx.lineWidth = 7; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x + s.w/2 - side * 2 - side * (s.w/2), y + 6); ctx.quadraticCurveTo(d.x + d.w/2, y, d.x + d.w/2, d.y + d.h - 10 - st.bottles[a.j].length * ((d.h - 18) / CAP)); ctx.stroke();
        }
        drawBottle(a.i, x, y, s.w, s.h, rot);
      }

      // the wizard brewing at the bottom of the hall
      const cx = W / 2 + 34, cy = H - 62;
      drawCauldron(cx, cy, st.clock);
      if (!wizL) wizL = PB.layer(W, H);
      const main = ctx; ctx = wizL[1]; ctx.clearRect(0, 0, W, H);
      const tip = drawWizard(st.rowsY.length === 1 ? 104 : 108, H - 6, st.clock);
      drawOwl(W - 48, H - 96, st.clock);
      ctx.globalCompositeOperation = 'source-atop';
      const gl = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, 210); gl.addColorStop(0, 'rgba(150,255,110,.55)'); gl.addColorStop(1, 'rgba(150,255,110,0)'); ctx.fillStyle = gl; ctx.fillRect(0, H - 360, W, 360);
      const fire = ctx.createRadialGradient(cx, cy + 40, 6, cx, cy + 40, 140); fire.addColorStop(0, 'rgba(255,150,60,.45)'); fire.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = fire; ctx.fillRect(0, H - 260, W, 260);
      const moonL = ctx.createLinearGradient(0, H - 330, W * 0.4, H - 200); moonL.addColorStop(0, 'rgba(160,180,255,.22)'); moonL.addColorStop(1, 'rgba(160,180,255,0)'); ctx.fillStyle = moonL; ctx.fillRect(0, H - 360, W, 360);
      const dk = ctx.createLinearGradient(0, H - 120, 0, H); dk.addColorStop(0, 'rgba(0,0,0,0)'); dk.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = dk; ctx.fillRect(0, H - 120, W, 120);
      ctx.globalCompositeOperation = 'source-over';
      ctx = main; ctx.drawImage(wizL[0], 0, 0, W, H);
      // dust motes drifting in the moonbeam
      if (!reduceMotion) for (const m of st.motes) { m.y += m.v * 0.016; m.x += Math.sin(st.clock * 0.6 + m.ph) * 0.15; if (m.y > FLOOR) { m.y = 160; } ctx.fillStyle = `rgba(210,220,255,${0.25 + 0.25 * Math.sin(st.clock * 2 + m.ph)})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill(); }
      if (!reduceMotion && Math.random() < 0.5) st.parts.push({ x: tip.x, y: tip.y, vx: 40 + Math.random() * 60, vy: 10 + Math.random() * 40, life: 0.7, color: Math.random() < .5 ? '#fff3c4' : '#b9a6ff' });

      for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life / 0.8); ctx.fillStyle = q.color; star(ctx, q.x, q.y, 4, 1.8); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) {
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = `900 20px ${FONT}`;
        ctx.shadowColor = q.color; ctx.shadowBlur = 12; ctx.fillStyle = q.color; ctx.fillText(q.text, Math.min(W - 80, Math.max(80, q.x)), q.y); ctx.restore();
      }
    }
    const timeStr = t => { const s = Math.ceil(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

    function artTile(g){
      if (!hallC) paintHall();
      g.drawImage(hallC, 0, 0, W * 2, 360 * 2, 0, 0, 240, 180);
      g.fillStyle = '#6b3f22'; g.fillRect(8, 150, 224, 9);
      const cols = [[0,0,8,8],[8,1,1,0],[1,1,8],[]];
      cols.forEach((col, i) => {
        const x = 30 + i * 46, y = 60, w = 28, h = 88, r = 14;
        g.save(); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h - r); g.arc(x + r, y + h - r, r, Math.PI, 0, true); g.lineTo(x + w, y); g.closePath(); g.clip();
        col.forEach((c, k) => { g.fillStyle = COLORS[c]; g.fillRect(x, y + h - (k + 1) * 20 - 2, w, 20); });
        g.restore();
        g.strokeStyle = 'rgba(230,240,255,.85)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h - r); g.arc(x + r, y + h - r, r, Math.PI, 0, true); g.lineTo(x + w, y); g.stroke();
        if (i === 0) { g.fillStyle = '#b07a45'; g.fillRect(x + 4, y - 11, w - 8, 9); }
      });
      // wizard hat peeking in from the side
      g.fillStyle = '#3a2a74'; g.beginPath(); g.ellipse(214, 112, 26, 6, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(198, 110); g.quadraticCurveTo(208, 78, 218, 62); g.quadraticCurveTo(232, 58, 238, 70); g.quadraticCurveTo(226, 70, 224, 82); g.quadraticCurveTo(224, 98, 230, 110); g.closePath(); g.fill();
      g.fillStyle = '#c9a23c'; g.fillRect(199, 102, 31, 4);
      for (const [x, y] of [[40, 24], [120, 14], [200, 30]]) { const gl = g.createRadialGradient(x, y, 1, x, y, 16); gl.addColorStop(0, 'rgba(255,200,110,.5)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); g.fillStyle = '#fff6e0'; g.fillRect(x - 2.5, y + 2, 5, 14); g.fillStyle = '#ffd86b'; g.beginPath(); g.ellipse(x, y - 2, 2, 4.5, 0, 0, 7); g.fill(); }
    }

    return {
      id:'potions', sfxScore:false, music:'potions', title:'POTION SORT', W, H, statLabel:'Time', type:'levels', levels:100, maxLives:0,
      failTitle:"Time's up!", dailyText:'One big brew, one try a day', powersTitle:'Magic tips',
      tile:{ order:4, name:'Potion Sort', kind:"Wizard's potion puzzle \u00b7 100 levels", art: artTile },
      controls: ['Tap a flask to pick it up, then tap another flask to pour.', 'You can only pour onto the same color, or into an empty flask.', 'Fill every flask with a single color before the hourglass runs out.', 'Finish faster for more stars.'],
      powers: [
        { name:'Undo', desc:'Take back a pour. You get 3 per level', icon: g => { g.fillStyle = '#2a1a4a'; g.strokeStyle = GOLD; g.lineWidth = 1.5; g.beginPath(); g.roundRect(2, 3, 42, 22, 11); g.fill(); g.stroke(); g.fillStyle = '#fff3d6'; g.font = `800 10px ${BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Undo', 23, 14); } },
        { name:'Corked flask', desc:'A full flask of one color seals itself', icon: g => { g.fillStyle = COLORS[0]; g.fillRect(15, 6, 16, 20); g.fillStyle = '#b07a45'; g.fillRect(16, 1, 14, 6); } },
        { name:'Mystery layers', desc:'From level 30, hidden layers show their color when uncovered', icon: g => { g.fillStyle = '#3a2a55'; g.fillRect(15, 4, 16, 22); g.fillStyle = '#fff3d6'; g.font = `900 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 23, 16); } },
      ],
      init(){},
      preview(){ fresh('classic', 1); st.phase = 'menu'; },
      start(mode, rand, lives, msg, level){ fresh(mode, level); },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: null, stat: timeStr(st.time), score: st.score }; },
      metrics(){ return { score: st.score, won: st.won ? 1 : 0, timeLeft: st.won ? Math.ceil(st.time) : 0, undoUsed: (st.spec.undos || 3) - st.undos, pours: st.pours || 0 }; },
      dailyGoals: [
        { text:'Sort every potion with {n} seconds left', m:'timeLeft', n:[30, 45, 60] },
        { text:'Sort every potion without using Undo', m:'won', n:[1], zero:'undoUsed' },
        { text:'Sort every potion in {n} pours or less', m:'won', n:[1], max:'pours', limit:[60, 55, 50] },
      ],
      pointerDown(x, y){
        if (st.over) return;
        if (x > W - 122 && y < 94) { if (y < 53) doUndo(); else restart(); return; }
        for (let i=0;i<st.pos.length;i++) { const p = st.pos[i]; if (x > p.x - 8 && x < p.x + p.w + 8 && y > p.y - 40 && y < p.y + p.h + 14) { tap(i); return; } }
        st.sel = -1;
      },
      pointerMove(){}, pointerUp(){}, key(e){ if (e.key === 'z' || e.key === 'u') doUndo(); },
    };
  }
  PB.register(createPotions);
})();
