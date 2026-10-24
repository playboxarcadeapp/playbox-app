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
    // One minute on the hourglass for every level. A new color joins every 3 levels (up to 12),
    // then mystery layers, fewer undos and trickier shuffles keep it tough. Some levels you will fail!
    const TIME = 60, MAX_K = 12;
    function levelSpec(n){
      const k = Math.min(4 + Math.floor((n - 1) / 3), MAX_K);
      const hidden = n >= 40 ? 'all' : n >= 15 ? 'bottom' : 'none';
      const undos = n >= 45 ? 1 : n >= 20 ? 2 : 3;
      const tries = 1 + Math.min(5, Math.floor(n / 6));
      // one minute up to level 20; bigger puzzles after that get a little more time so they stay beatable
      const time = n <= 20 ? TIME : Math.round(TIME + Math.min(30, (n - 20) * 1.5) + (hidden === 'all' ? 8 : 0));
      return { n, k, hidden, time, undos, tries, mixed: n >= 4, seed: 'potions-' + n };
    }
    function dailySpec(){ return { n:'daily', k: 9, hidden:'bottom', time: 70, undos: 2, tries: 4, mixed: true, seed: 'potions-daily-' + PB.today() }; }

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
        score: 0, over: false, parts: [], pops: [], glints: [], sealed: new Set(), shake: 0, bubbles: [], phase:'play', bats: [], batIn: 3, bolt: 0, boltIn: 6 + Math.random() * 8, warned: false,
        motes: Array.from({ length: 26 }, () => ({ x: 160 + Math.random() * 220, y: 160 + Math.random() * 440, v: 4 + Math.random() * 8, r: 0.8 + Math.random() * 1.4, ph: Math.random() * 6 })) };
      st.scene = sceneOf(spec); st.embers = []; st.flyer = null; st.puff = 0;
      st.fireflies = Array.from({ length: 22 }, (_, i) => ({ x: Math.random() * W, y: 120 + Math.random() * 520, ph: Math.random() * 6, k: i }));
      layout();
      for (let i=0;i<14;i++) st.bubbles.push({ x: W/2 - 6 + Math.random()*80, y: H - 72 - Math.random()*30, v: 10 + Math.random()*20, r: 2 + Math.random()*4 });
    }

    const topRun = b => { if (!b.length) return 0; const c = b[b.length-1].c; let r = 1; while (r < b.length && b[b.length-1-r].c === c && !b[b.length-1-r].hidden) r++; return r; };
    const isSealed = b => b.length === CAP && b.every(l => !l.hidden && l.c === b[0].c);
    function canPour(i, j){
      if (i === j) return false;
      const s = st.bottles[i], d = st.bottles[j];
      return s.length > 0 && d.length < CAP && !isSealed(s);
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
    const POUR_TIME = 0.48;
    const smooth = e => { e = Math.max(0, Math.min(1, e)); return e * e * (3 - 2 * e); };
    const pourF = a => a.moved ? 1 : smooth((a.t - 0.3) / 0.42);
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
        const a = st.anim; a.t += dt / POUR_TIME;
        const pf = pourF(a);
        if (pf > 0 && pf < 1 && !reduceMotion) {
          // splashes and bubbles where the stream lands
          const d = st.pos[a.j], lh = (d.h - 18) / CAP, sy = d.y + d.h - 4 - (st.bottles[a.j].length + a.amt * pf) * lh;
          if (Math.random() < 0.6) st.parts.push({ x: d.x + d.w / 2 + (Math.random() - .5) * d.w * 0.6, y: sy, vx: (Math.random() - .5) * 90, vy: -60 - Math.random() * 90, life: 0.35, color: COLORS[a.color], small: true });
          a.wob = (a.wob || 0) + dt;
        }
        if (!a.moved && a.t >= 0.74) { a.moved = true; finishPour(); a.ripple = 0.45; }
        if (a.ripple) a.ripple = Math.max(0, a.ripple - dt);
        if (st.anim.t >= 1) { st.anim = null; checkWin(); }
      }
      if (st.wiggle) { st.wiggle.t -= dt; if (st.wiggle.t <= 0) st.wiggle = null; }
      if (!reduceMotion) {
        // sealed potions shimmer with rising sparkles
        for (const j of st.sealed) { const p = st.pos[j]; if (p && Math.random() < dt * 5) st.glints.push({ x: p.x + 6 + Math.random() * (p.w - 12), y: p.y + 20 + Math.random() * (p.h - 40), vy: -18 - Math.random() * 20, life: 1.2, col: COLORS[st.bottles[j][0].c] }); }
        for (const q of st.glints) { q.y += q.vy * dt; q.life -= dt; }
        st.glints = st.glints.filter(q => q.life > 0);
        // bats swooping past the window
        sceneUpdate(dt);
        st.batIn -= dt; if (st.batIn <= 0 && (SCENES[st.scene].fly === 'bats' || st.scene === 1)) { const dir = Math.random() < .5 ? 1 : -1, n = 1 + Math.floor(Math.random() * 3); for (let i=0;i<n;i++) st.bats.push({ x: dir > 0 ? -30 - i * 34 : W + 30 + i * 34, y: 40 + Math.random() * 90, dir, sp: 90 + Math.random() * 60, ph: Math.random() * 6, s: 0.7 + Math.random() * 0.5 }); st.batIn = 6 + Math.random() * 8; }
        for (const b of st.bats) { b.x += b.dir * b.sp * dt; b.y += Math.sin(st.clock * 3 + b.ph) * 18 * dt; }
        st.bats = st.bats.filter(b => b.x > -80 && b.x < W + 80);
        // a storm outside: lightning now and then
        st.boltIn -= dt; if (st.boltIn <= 0 && SCENES[st.scene].storm) { st.bolt = 0.5; st.boltIn = 8 + Math.random() * 10; }
        st.bolt = Math.max(0, st.bolt - dt);
      }
      if (!st.over && st.time <= 10 && !st.warned) { st.warned = true; pop(W / 2, 120, 'Hurry! 10 seconds!', '#ff4d6d', 1.6); if (PB.sfx) PB.sfx('nope'); }
      for (const q of st.parts) { q.x += q.vx*dt; q.y += q.vy*dt; q.vy += (q.small ? 650 : 160)*dt; q.life -= dt; }
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
      const a = st.anim, animOut = a && a.i === i && !a.moved, animIn = a && a.j === i && !a.moved;
      // stack the layers into blocks: touching layers of the same color become one smooth potion
      const blocks = [];
      b.forEach((l, k) => {
        const bot = y + h - 4 - k * lh;
        let top = bot - lh;
        if (animOut && k >= b.length - a.amt) { const r = b.length - 1 - k, frac = Math.max(0, Math.min(1, 1 - (a.amt * pourF(a) - r))); if (frac <= 0) return; top = bot - lh * frac; }
        if (top >= bot) return;
        const col = l.hidden ? '#3a2a55' : COLORS[l.c], last = blocks[blocks.length - 1];
        if (last && !l.hidden && !last.hidden && last.col === col && Math.abs(last.top - bot) < 0.5) last.top = top;
        else blocks.push({ col, bot, top, hidden: l.hidden, n: 1 });
      });
      if (animIn) {
        const col = COLORS[a.color], bot = y + h - 4 - b.length * lh, top = bot - lh * a.amt * pourF(a), last = blocks[blocks.length - 1];
        if (top < bot - 0.2) { if (last && !last.hidden && last.col === col && Math.abs(last.top - bot) < 0.5) last.top = top; else blocks.push({ col, bot, top }); }
      }
      let surface = null, surfCol = null;
      for (const B of blocks) {
        const grd = ctx.createLinearGradient(x, 0, x + w, 0);
        grd.addColorStop(0, PB.shade(B.col, -0.55)); grd.addColorStop(0.22, PB.shade(B.col, -0.12)); grd.addColorStop(0.42, lighten(B.col)); grd.addColorStop(0.62, B.col); grd.addColorStop(1, PB.shade(B.col, -0.6));
        ctx.fillStyle = grd; ctx.fillRect(x, B.top, w, B.bot - B.top + 1);
        // gentle depth over the whole run (not per layer, so a color never looks like two shades)
        const vg = ctx.createLinearGradient(0, B.top, 0, y + h); vg.addColorStop(0, 'rgba(255,255,255,.08)'); vg.addColorStop(1, 'rgba(0,0,0,.16)');
        ctx.fillStyle = vg; ctx.fillRect(x, B.top, w, B.bot - B.top + 1);
        if (B.hidden) { ctx.fillStyle = 'rgba(255,243,214,.6)'; ctx.font = `900 ${Math.round(lh * 0.55)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', x + w/2, (B.top + B.bot) / 2 + 2); }
        else if (blocks.indexOf(B) > 0) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, B.bot - 1, w, 2); }
        surface = B.top; surfCol = B.col;
      }
      // ripples on the surface while potion is landing
      if (surface != null && a && a.j === i && (animIn || a.ripple)) {
        const k = animIn ? 1 : a.ripple / 0.45;
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * k})`; ctx.lineWidth = 1.5;
        for (let q=0;q<2;q++) { const rr = ((st.clock * 2 + q * 0.5) % 1); ctx.beginPath(); ctx.ellipse(x + w/2, surface + 1, w * 0.48 * rr, 3 * rr, 0, 0, 7); ctx.stroke(); }
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
    // ---------- five magical places, one per level on a rotation ----------
    const SCENES = [
      { name:'Wizard Tower',    wall:'stone',  sky:['#0d1b3d','#2a3f73'], moon:[255,250,225], banners:['#7a1e2b','#1f3a6b'], left:'wizard', right:'owl',   fly:'bats',  storm:true },
      { name:"Witch's Cottage", wall:'wood',   sky:['#2a1048','#8a3a7a'], moon:[255,190,90],  banners:['#4a2a6a','#2f5a2a'], left:'witch',  right:'cat',   fly:'witch' },
      { name:"Dragon's Lair",   wall:'cave',   sky:['#3a0a0a','#d0561a'], moon:null,          banners:null,                  left:'wizard', right:'dragon', fly:'dragon', embers:true },
      { name:'Haunted Library', wall:'books',  sky:['#06102a','#1d2f5a'], moon:[232,240,255], banners:['#1f4a3a','#5a1f3a'], left:'wizard', right:'ghost', fly:'books', storm:true },
      { name:'Moonlit Forest',  wall:'forest', sky:['#071430','#1e3f6a'], moon:[250,250,235], banners:null,                  left:'witch',  right:'cat',   fly:'witch', flies:true },
    ];
    const sceneOf = spec => spec.n === 'daily' ? (parseInt(PB.today().replace(/\D/g, ''), 10) || 0) % SCENES.length : (spec.n - 1) % SCENES.length;
    const hallCs = {};
    const hallFor = () => { const sc = st ? st.scene || 0 : 0; if (!hallCs[sc]) hallCs[sc] = paintHall(sc); return hallCs[sc]; };
    // the view through the big arched window
    function paintWindowView(g, S, wx, wTop, wBot, ww, R){
      const sky = g.createLinearGradient(0, 0, 0, wBot); sky.addColorStop(0, S.sky[0]); sky.addColorStop(1, S.sky[1]);
      g.fillStyle = sky; g.fillRect(wx - ww - 400, 0, ww * 2 + 800, wBot);
      for (let i=0;i<60;i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; g.fillRect(wx - ww - 200 + R() * (ww * 2 + 400), R() * (wBot - 40), 1.4, 1.4); }
      if (S.moon) { const [r, gg, b] = S.moon, mx = wx + 30, my = 44, big = S.wall === 'wood' ? 34 : 15; const moon = g.createRadialGradient(mx, my, 2, mx, my, big * 3.3); moon.addColorStop(0, `rgba(${r},${gg},${b},1)`); moon.addColorStop(0.3, `rgba(${r},${gg},${b},.95)`); moon.addColorStop(0.32, `rgba(${r},${gg},${b},.35)`); moon.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.fillStyle = moon; g.beginPath(); g.arc(mx, my, big * 3.3, 0, 7); g.fill();
        if (S.wall === 'wood') { g.fillStyle = 'rgba(200,110,40,.25)'; for (const [cx, cy, cr] of [[-8, -6, 6], [10, 8, 4], [-4, 12, 3]]) { g.beginPath(); g.arc(mx + cx, my + cy, cr, 0, 7); g.fill(); } } }
      g.fillStyle = S.wall === 'cave' ? '#2a0a06' : '#0f1630';
      if (S.wall === 'cave') {
        // a smoking volcano with glowing lava
        g.beginPath(); g.moveTo(wx - ww, wBot); g.lineTo(wx - ww, 120); g.lineTo(wx - 30, 70); g.lineTo(wx - 12, 66); g.lineTo(wx + 8, 68); g.lineTo(wx + 40, 104); g.lineTo(wx + ww, 118); g.lineTo(wx + ww, wBot); g.closePath(); g.fill();
        g.strokeStyle = '#ff7a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(wx - 4, 68); g.quadraticCurveTo(wx - 14, 96, wx - 30, 128); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(wx + 2, 70); g.quadraticCurveTo(wx + 14, 100, wx + 26, 130); g.stroke();
        const lg = g.createRadialGradient(wx - 2, 64, 2, wx - 2, 64, 40); lg.addColorStop(0, 'rgba(255,200,80,.9)'); lg.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = lg; g.beginPath(); g.arc(wx - 2, 64, 40, 0, 7); g.fill();
      } else if (S.wall === 'wood') {
        g.beginPath(); g.moveTo(wx - ww, wBot); g.lineTo(wx - ww, 118); g.quadraticCurveTo(wx - 30, 96, wx + 10, 112); g.quadraticCurveTo(wx + 40, 124, wx + ww, 108); g.lineTo(wx + ww, wBot); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(wx - 40, 116); g.lineTo(wx - 40, 92); g.lineTo(wx - 48, 92); g.lineTo(wx - 30, 66); g.lineTo(wx - 14, 92); g.lineTo(wx - 20, 92); g.lineTo(wx - 20, 114); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,200,90,.9)'; g.fillRect(wx - 33, 98, 5, 6);
        for (const tx of [wx + 30, wx + 50]) { g.fillStyle = '#0f1630'; g.beginPath(); g.moveTo(tx - 9, 118); g.lineTo(tx, 82); g.lineTo(tx + 9, 118); g.fill(); }
      } else {
        g.beginPath(); g.moveTo(wx - ww, wBot); g.lineTo(wx - ww, 128); g.lineTo(wx - 40, 120); g.lineTo(wx - 40, 92); g.lineTo(wx - 48, 92); g.lineTo(wx - 36, 70); g.lineTo(wx - 24, 92); g.lineTo(wx - 30, 92); g.lineTo(wx - 30, 112); g.lineTo(wx, 108); g.lineTo(wx, 84); g.lineTo(wx - 6, 84); g.lineTo(wx + 6, 58); g.lineTo(wx + 18, 84); g.lineTo(wx + 12, 84); g.lineTo(wx + 12, 114); g.lineTo(wx + 40, 116); g.lineTo(wx + 40, 100); g.lineTo(wx + 34, 100); g.lineTo(wx + 44, 84); g.lineTo(wx + 54, 100); g.lineTo(wx + 48, 100); g.lineTo(wx + 48, 124); g.lineTo(wx + ww, 128); g.lineTo(wx + ww, wBot); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,214,120,.85)'; for (const [x, y] of [[-35, 100], [5, 92], [44, 108], [-14, 116], [24, 120]]) g.fillRect(wx + x, y, 2.5, 3.5);
      }
    }
    function paintWall(g, S, R){
      if (S.wall === 'stone') {
        for (let y = 0, row = 0; y < FLOOR; y += 30, row++) for (let x = -(row % 2) * 34; x < W; x += 68) {
          const v = 0.85 + R() * 0.3, base = Math.round(52 * v), tint = Math.round(48 * v), b = Math.round(66 * v);
          g.fillStyle = `rgb(${base},${tint},${b})`; g.fillRect(x + 1, y + 1, 66, 28); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 1, y + 1, 66, 3); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 1, y + 25, 66, 4);
          for (let k=0;k<4;k++) { g.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`; g.beginPath(); g.arc(x + R() * 66, y + R() * 28, 1 + R() * 3, 0, 7); g.fill(); }
        }
      } else if (S.wall === 'wood') {
        for (let x = 0; x < W; x += 30) { const v = 0.85 + R() * 0.3; g.fillStyle = `rgb(${Math.round(92 * v)},${Math.round(58 * v)},${Math.round(40 * v)})`; g.fillRect(x, 0, 29, FLOOR); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 29, 0, 1.5, FLOOR);
          g.strokeStyle = 'rgba(40,20,10,.25)'; g.lineWidth = 1; for (let k=0;k<5;k++) { const xx = x + 4 + R() * 22; g.beginPath(); g.moveTo(xx, 0); g.bezierCurveTo(xx + 3, 200, xx - 3, 400, xx + 1, FLOOR); g.stroke(); }
          for (const y of [40, 300, 560]) { g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(x + 15, y, 1.8, 0, 7); g.fill(); } }
        g.fillStyle = '#3a2416'; for (const y of [0, 290]) g.fillRect(0, y, W, 16);
      } else if (S.wall === 'cave') {
        g.fillStyle = '#2a1612'; g.fillRect(0, 0, W, FLOOR);
        for (let i=0;i<180;i++) { const x = R() * W, y = R() * FLOOR, r = 18 + R() * 40, v = 0.7 + R() * 0.5; const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); rg.addColorStop(0, `rgb(${Math.round(92 * v)},${Math.round(52 * v)},${Math.round(40 * v)})`); rg.addColorStop(1, `rgba(${Math.round(40 * v)},${Math.round(20 * v)},${Math.round(16 * v)},0)`); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(255,120,30,.55)'; g.lineWidth = 2; g.shadowColor = '#ff7a1a'; g.shadowBlur = 8;
        for (let k=0;k<7;k++) { let x = R() * W, y = 180 + R() * 400; g.beginPath(); g.moveTo(x, y); for (let j=0;j<5;j++) { x += (R() - .5) * 40; y += 10 + R() * 20; g.lineTo(x, y); } g.stroke(); }
        g.shadowBlur = 0;
        for (let x = 0; x < W; x += 26 + R() * 20) { const h = 20 + R() * 50; g.fillStyle = '#1e0e0a'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 9, h); g.lineTo(x + 18, 0); g.fill(); }
      } else if (S.wall === 'books') {
        g.fillStyle = '#2a1a14'; g.fillRect(0, 0, W, FLOOR);
        for (let y = 20; y < FLOOR - 20; y += 52) {
          for (let x = 4; x < W - 4;) { const bw = 7 + R() * 9, bh = 30 + R() * 14; if (R() < 0.06) { x += 14; continue; } const col = ['#7a1e2b','#1f3a6b','#2f6b3a','#8a6a1f','#5a2a6a','#a04a1a','#2a5a6a','#6a4a3a'][Math.floor(R() * 8)];
            const lean = R() < 0.05; g.save(); g.translate(x, y + 44); if (lean) g.rotate(-0.2); g.fillStyle = col; g.fillRect(0, -bh, bw, bh); g.fillStyle = 'rgba(255,215,120,.5)'; g.fillRect(1, -bh + 5, bw - 2, 2); g.fillRect(1, -10, bw - 2, 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(bw - 2, -bh, 2, bh); g.restore(); x += bw + 1; }
          g.fillStyle = '#4a2c1a'; g.fillRect(0, y + 44, W, 8); g.fillStyle = 'rgba(255,230,190,.15)'; g.fillRect(0, y + 44, W, 2);
        }
      } else {
        const sky = g.createLinearGradient(0, 0, 0, FLOOR); sky.addColorStop(0, S.sky[0]); sky.addColorStop(1, S.sky[1]); g.fillStyle = sky; g.fillRect(0, 0, W, FLOOR);
        for (let i=0;i<140;i++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.7})`; g.fillRect(R() * W, R() * 380, 1.5, 1.5); }
        const [r, gg, b] = S.moon, mx = W * 0.5, my = 80; const moon = g.createRadialGradient(mx, my, 2, mx, my, 150); moon.addColorStop(0, `rgba(${r},${gg},${b},1)`); moon.addColorStop(0.22, `rgba(${r},${gg},${b},1)`); moon.addColorStop(0.24, `rgba(${r},${gg},${b},.3)`); moon.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.fillStyle = moon; g.beginPath(); g.arc(mx, my, 150, 0, 7); g.fill();
        g.fillStyle = 'rgba(200,200,190,.35)'; for (const [cx, cy, cr] of [[-10, -8, 7], [12, 6, 5], [-2, 14, 4]]) { g.beginPath(); g.arc(mx + cx, my + cy, cr, 0, 7); g.fill(); }
        const tree = (x, base, h, col) => { g.fillStyle = col; g.fillRect(x - h * 0.03, base - h * 0.35, h * 0.06, h * 0.35); for (let k=0;k<4;k++) { const w = h * (0.32 - k * 0.06), y = base - h * 0.25 - k * h * 0.18; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x, y - h * 0.3); g.lineTo(x + w, y); g.closePath(); g.fill(); } };
        for (let x = -20; x < W + 20; x += 34 + R() * 20) tree(x, FLOOR - 120 + R() * 20, 160 + R() * 80, '#14304a');
        for (let x = -30; x < W + 30; x += 46 + R() * 30) tree(x, FLOOR - 30 + R() * 20, 240 + R() * 120, '#0c1e30');
        g.fillStyle = 'rgba(190,220,255,.10)'; for (let i=0;i<5;i++) g.fillRect(0, FLOOR - 160 + i * 30, W, 14);
      }
    }
    function paintHall(sc){
      const S = SCENES[sc];
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
      const g = c.getContext('2d'); g.scale(2, 2);
      const R = PB.mulberry(77 + sc * 13);
      g.fillStyle = '#1e1a2b'; g.fillRect(0, 0, W, H);
      paintWall(g, S, R);
      const wx = W / 2, wTop = 6, wBot = 150, ww = 74;
      if (S.wall !== 'forest') {
        const arch = () => { g.beginPath(); g.moveTo(wx - ww, wBot); g.lineTo(wx - ww, wTop + 70); g.quadraticCurveTo(wx - ww, wTop, wx, wTop - 6); g.quadraticCurveTo(wx + ww, wTop, wx + ww, wTop + 70); g.lineTo(wx + ww, wBot); g.closePath(); };
        g.save(); arch(); g.clip(); paintWindowView(g, S, wx, wTop, wBot, ww, R); g.restore();
        g.strokeStyle = S.wall === 'wood' ? '#2a1a10' : S.wall === 'cave' ? '#1a0a06' : '#4a4258'; g.lineWidth = 7; arch(); g.stroke();
        g.strokeStyle = S.wall === 'cave' ? 'rgba(0,0,0,0)' : '#2c2638'; g.lineWidth = 3; g.beginPath(); g.moveTo(wx, wTop); g.lineTo(wx, wBot); g.moveTo(wx - ww, 80); g.lineTo(wx + ww, 80); g.stroke();
        const beam = g.createLinearGradient(0, wBot, 0, FLOOR); beam.addColorStop(0, S.wall === 'cave' ? 'rgba(255,140,60,.12)' : 'rgba(170,190,255,.10)'); beam.addColorStop(1, 'rgba(170,190,255,0)');
        g.fillStyle = beam; g.beginPath(); g.moveTo(wx - ww, wBot); g.lineTo(wx + ww, wBot); g.lineTo(wx + ww + 70, FLOOR); g.lineTo(wx - ww + 30, FLOOR); g.closePath(); g.fill();
      }
      if (S.banners) for (const [x, col] of [[34, S.banners[0]], [W - 34, S.banners[1]]]) {
        g.fillStyle = '#3a2a1a'; g.fillRect(x - 26, 4, 52, 5);
        const bg = g.createLinearGradient(x - 22, 0, x + 22, 0); bg.addColorStop(0, PB.shade(col, -0.3)); bg.addColorStop(0.5, col); bg.addColorStop(1, PB.shade(col, -0.35));
        g.fillStyle = bg; g.beginPath(); g.moveTo(x - 22, 8); g.lineTo(x + 22, 8); g.lineTo(x + 22, 128); g.lineTo(x, 112); g.lineTo(x - 22, 128); g.closePath(); g.fill();
        g.strokeStyle = '#c9a23c'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#c9a23c';
        if (S.wall === 'wood') { g.beginPath(); g.moveTo(x - 12, 66); g.lineTo(x + 12, 66); g.lineTo(x, 34); g.closePath(); g.fill(); g.fillRect(x - 16, 64, 32, 4); }
        else if (S.wall === 'books') { g.beginPath(); g.arc(x, 54, 11, 0.6, Math.PI * 2 - 0.6); g.arc(x + 5, 54, 9, Math.PI * 2 - 0.8, 0.8, true); g.fill(); }
        else { star(g, x, 54, 11, 4.6); g.fill(); }
      }
      // floor
      const floorCols = { stone: ['#2b2533', '#16121c'], books: ['#2b2533', '#16121c'], wood: ['#4a2e1c', '#24150c'], cave: ['#2a1410', '#120806'], forest: ['#16301e', '#0a1810'] }[S.wall];
      const fl = g.createLinearGradient(0, FLOOR, 0, H); fl.addColorStop(0, floorCols[0]); fl.addColorStop(1, floorCols[1]);
      g.fillStyle = fl; g.fillRect(0, FLOOR, W, H - FLOOR);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5;
      if (S.wall === 'stone' || S.wall === 'books') { for (let y = FLOOR, k = 0; y < H; y += 22 + k * 6, k++) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let i=-6;i<=6;i++) { g.beginPath(); g.moveTo(W/2 + i * 40, FLOOR); g.lineTo(W/2 + i * 90, H); g.stroke(); } }
      else if (S.wall === 'wood') { for (let i=-8;i<=8;i++) { g.beginPath(); g.moveTo(W/2 + i * 30, FLOOR); g.lineTo(W/2 + i * 70, H); g.stroke(); } }
      else if (S.wall === 'cave') {
        // piles of dragon gold
        for (const [cx, cy, rw] of [[70, H - 40, 90], [W - 60, H - 30, 80], [W / 2 - 120, H - 10, 60]]) { g.fillStyle = '#8a5a10'; g.beginPath(); g.ellipse(cx, cy, rw, rw * 0.35, 0, Math.PI, 0); g.fill(); for (let k=0;k<70;k++) { const a = R() * Math.PI, rr = R(); const x = cx + Math.cos(a) * rw * rr, y = cy - Math.sin(a) * rw * 0.35 * rr; g.fillStyle = ['#ffd23f','#f2b134','#ffe88a'][k % 3]; g.beginPath(); g.ellipse(x, y, 5, 3, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,70,0,.6)'; g.lineWidth = 0.8; g.stroke(); } g.fillStyle = '#c0392b'; g.beginPath(); g.arc(cx + 10, cy - rw * 0.25, 4, 0, 7); g.fill(); g.fillStyle = '#3fa9ff'; g.beginPath(); g.arc(cx - 16, cy - rw * 0.2, 3.5, 0, 7); g.fill(); }
      } else {
        for (let i=0;i<500;i++) { const x = R() * W, y = FLOOR + R() * (H - FLOOR); g.strokeStyle = ['#2a5a30','#1e4826','#3a6a3a'][i % 3]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 3, y - 4 - R() * 6); g.stroke(); }
        for (const [mx, my, s] of [[40, H - 30, 1.2], [70, H - 18, 0.8], [W - 30, H - 40, 1], [W - 90, H - 14, 0.7]]) { g.fillStyle = '#f2e6c8'; g.fillRect(mx - 3 * s, my - 14 * s, 6 * s, 14 * s); g.fillStyle = '#d6307a'; g.beginPath(); g.ellipse(mx, my - 14 * s, 13 * s, 8 * s, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; for (const [dx, dy] of [[-6, -18], [4, -20], [0, -16]]) { g.beginPath(); g.arc(mx + dx * s, my + dy * s, 1.6 * s, 0, 7); g.fill(); } }
      }
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, FLOOR, W, 6);
      if (S.wall === 'stone') {
        const N = PB.gl3d, nc = document.createElement('canvas'); nc.width = 160; nc.height = 200; const ng = nc.getContext('2d'), id = ng.createImageData(160, 200);
        for (let y=0;y<200;y++) for (let x=0;x<160;x++) { const v = N ? 128 + N.fbm(x / 9, y / 9, 2.2, 4) * 150 : 128 + (R() - .5) * 40; const k = (y * 160 + x) * 4; id.data[k] = id.data[k+1] = id.data[k+2] = Math.max(0, Math.min(255, v)); id.data[k+3] = 255; }
        ng.putImageData(id, 0, 0); g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.35; g.drawImage(nc, 0, 0, W, FLOOR); g.restore();
      }
      if (S.wall === 'stone' || S.wall === 'books' || S.wall === 'wood') for (const px of [0, W - 26]) {
        const cols = S.wall === 'wood' ? ['#2a1a10', '#5a3a24', '#22140a'] : ['#2a2534', '#4b4459', '#221e2b'];
        const pg = g.createLinearGradient(px, 0, px + 26, 0); pg.addColorStop(0, cols[0]); pg.addColorStop(0.45, cols[1]); pg.addColorStop(1, cols[2]);
        g.fillStyle = pg; g.fillRect(px, 0, 26, FLOOR); g.fillStyle = 'rgba(0,0,0,.3)'; for (let y=0;y<FLOOR;y+=46) g.fillRect(px, y, 26, 2);
        g.fillStyle = PB.shade(cols[1], -0.15); g.fillRect(px - 3, FLOOR - 16, 32, 16);
      }
      g.save(); g.globalCompositeOperation = 'lighter';
      const warm = S.wall === 'cave' ? 'rgba(255,110,40,.2)' : S.wall === 'forest' ? 'rgba(150,180,255,.08)' : 'rgba(255,170,80,.16)';
      for (const [x, y, r] of [[60, 120, 120], [240, 90, 150], [420, 120, 120]]) { const lg = g.createRadialGradient(x, y, 4, x, y, r); lg.addColorStop(0, warm); lg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = lg; g.fillRect(x - r, y - r, r * 2, r * 2); }
      const fg = g.createRadialGradient(W/2 + 34, H - 60, 10, W/2 + 34, H - 60, 260); fg.addColorStop(0, 'rgba(140,255,110,.16)'); fg.addColorStop(1, 'rgba(140,255,110,0)'); g.fillStyle = fg; g.fillRect(0, H - 320, W, 320);
      g.restore();
      if (S.wall === 'stone' || S.wall === 'books') for (const [ox, sx] of [[0, 1], [W, -1]]) {
        g.save(); g.translate(ox, 0); g.scale(sx, 1); g.strokeStyle = 'rgba(220,220,235,.22)'; g.lineWidth = 0.8;
        for (let k=0;k<6;k++) { const a = k / 5 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 70, Math.sin(a) * 70); g.stroke(); }
        for (let r=12;r<=66;r+=11) { g.beginPath(); for (let k=0;k<=5;k++) { const a = k / 5 * Math.PI / 2, rr = r - (k % 2 ? 3 : 0); if (k) g.quadraticCurveTo(Math.cos(a - 0.15) * (rr - 4), Math.sin(a - 0.15) * (rr - 4), Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
        g.restore();
      }
      if (S.wall === 'wood') { // hanging herbs and a broom on the wall
        for (const hx of [120, 360]) { g.strokeStyle = '#2a1a10'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx, 16); g.lineTo(hx, 40); g.stroke(); for (let k=0;k<7;k++) { g.strokeStyle = ['#4f8a3a','#6aa84a','#3f7a2a'][k % 3]; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, 40); g.quadraticCurveTo(hx + (k - 3) * 4, 60, hx + (k - 3) * 6, 84); g.stroke(); } g.fillStyle = '#c9a23c'; g.fillRect(hx - 5, 38, 10, 5); }
      }
      const vg = g.createRadialGradient(W/2, H * 0.45, H * 0.25, W/2, H * 0.5, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      return c;
    }
    // ---- animated characters ----
    function drawWitch(x, feet, t){
      const s = st.rowsY.length === 1 ? 1.0 : 0.82;
      ctx.save(); ctx.translate(x, feet); ctx.scale(s, s);
      const sway = reduceMotion ? 0 : Math.sin(t * 1.4) * 2;
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, -2, 56, 9, 0, 0, 7); ctx.fill();
      // striped stockings and pointy boots
      for (const lx of [-14, 14]) { ctx.fillStyle = '#fff'; ctx.fillRect(lx - 5, -34, 10, 30); ctx.fillStyle = '#9d4edd'; for (let k=0;k<4;k++) ctx.fillRect(lx - 5, -34 + k * 8, 10, 4); ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.moveTo(lx - 7, -6); ctx.lineTo(lx + 7, -6); ctx.quadraticCurveTo(lx + 20, -4, lx + 22, -12); ctx.lineTo(lx + 22, -2); ctx.lineTo(lx - 7, 0); ctx.closePath(); ctx.fill(); }
      // dress
      const dr = ctx.createLinearGradient(-48, 0, 48, 0); dr.addColorStop(0, '#2a0f3e'); dr.addColorStop(0.5, '#6a2a9a'); dr.addColorStop(1, '#22092f');
      ctx.fillStyle = dr; ctx.beginPath(); ctx.moveTo(-22, -140); ctx.quadraticCurveTo(-40, -80, -50, -30); ctx.quadraticCurveTo(-30, -24, -20, -34); ctx.quadraticCurveTo(0, -26, 20, -34); ctx.quadraticCurveTo(30, -24, 50, -30); ctx.quadraticCurveTo(40, -80, 22, -140); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2fbf71'; ctx.fillRect(-22, -104, 44, 8); ctx.fillStyle = '#f5c84c'; ctx.fillRect(-6, -106, 12, 12); ctx.fillStyle = '#2fbf71'; ctx.fillRect(-3, -103, 6, 6);
      ctx.fillStyle = 'rgba(255,230,150,.6)'; for (const [sx, sy] of [[-26, -60], [16, -80], [28, -50], [-12, -40]]) { star(ctx, sx, sy, 4, 1.6); ctx.fill(); }
      // braided orange hair behind the head
      ctx.fillStyle = '#ff7a1a'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 18, -150, 8, 22, sd * 0.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(sd * 22 + sway * 0.5, -122, 6, 12, sd * 0.3, 0, 7); ctx.fill(); ctx.fillStyle = '#2fbf71'; ctx.fillRect(sd * 22 - 5 + sway * 0.5, -112, 10, 4); ctx.fillStyle = '#ff7a1a'; }
      // face
      ctx.fillStyle = '#ffd6b8'; ctx.beginPath(); ctx.ellipse(0, -160, 15, 17, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,120,.4)'; ctx.beginPath(); ctx.ellipse(-9, -154, 4, 2.6, 0, 0, 7); ctx.ellipse(10, -154, 4, 2.6, 0, 0, 7); ctx.fill();
      const blink = Math.sin(t * 0.9 + 1) > 0.985;
      if (blink) { ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -163); ctx.lineTo(-3, -163); ctx.moveTo(4, -163); ctx.lineTo(10, -163); ctx.stroke(); }
      else { ctx.fillStyle = '#2a1a1a'; ctx.beginPath(); ctx.arc(-6, -163, 2.4, 0, 7); ctx.arc(7, -163, 2.4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5.2, -164, 0.8, 0, 7); ctx.arc(7.8, -164, 0.8, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#8a3a2a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(1, -154, 5, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = '#ffb894'; ctx.beginPath(); ctx.ellipse(2, -158, 3, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.ellipse(0, -174, 16, 6, 0, Math.PI, 0); ctx.fill();
      // big floppy hat
      ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.ellipse(0, -176, 42, 9, -0.05, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-22, -178); ctx.quadraticCurveTo(-10, -226, 2, -250); ctx.quadraticCurveTo(24 + sway * 2, -258, 30 + sway * 2, -240); ctx.quadraticCurveTo(14, -238, 12, -226); ctx.quadraticCurveTo(14, -200, 22, -178); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9d4edd'; ctx.fillRect(-21, -188, 43, 7); ctx.fillStyle = '#f5c84c'; ctx.fillRect(-4, -189, 8, 9); ctx.fillStyle = '#9d4edd'; ctx.fillRect(-2, -187, 4, 5);
      // arm stirring the cauldron with a big ladle (round and round)
      const stir = reduceMotion ? 0 : t * 2.4, ax = Math.cos(stir) * 10, ay = Math.sin(stir) * 4;
      ctx.save(); ctx.translate(18, -124); const ang = -0.05 + Math.sin(stir) * 0.08; ctx.rotate(ang);
      ctx.fillStyle = '#4a1a6a'; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(30, -8, 56 + ax * 0.4, 8); ctx.lineTo(52 + ax * 0.4, 22); ctx.quadraticCurveTo(26, 12, -4, 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd6b8'; ctx.beginPath(); ctx.arc(58 + ax * 0.4, 14, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(56 + ax * 0.4, 6); ctx.lineTo(108 + ax, 72 + ay); ctx.stroke();
      ctx.restore();
      ctx.restore();
      const a = ang, tx = (108 + ax) * Math.cos(a) - (72 + ay) * Math.sin(a), ty = (108 + ax) * Math.sin(a) + (72 + ay) * Math.cos(a);
      return { x: x + (18 + tx) * s, y: feet + (-124 + ty) * s };
    }
    function drawCat(x, y, t){
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 2, 34, 6, 0, 0, 7); ctx.fill();
      const tail = reduceMotion ? 0 : Math.sin(t * 2.2) * 0.5;
      ctx.strokeStyle = '#141018'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(16, -6); ctx.bezierCurveTo(44, -4, 40 + tail * 20, -40, 30 + tail * 30, -62); ctx.stroke();
      const body = ctx.createRadialGradient(-6, -40, 4, 0, -28, 36); body.addColorStop(0, '#3a3044'); body.addColorStop(1, '#100c14');
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -26, 24, 28, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-10, -2, 8, 5, 0, 0, 7); ctx.ellipse(10, -2, 8, 5, 0, 0, 7); ctx.fill();
      const tilt = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.12; ctx.save(); ctx.translate(0, -60); ctx.rotate(tilt);
      ctx.fillStyle = '#16121a'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 17, 0, 0, 7); ctx.fill();
      const twitch = Math.sin(t * 5) > 0.96 ? -0.25 : 0;
      for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 12, -10); ctx.rotate(sd * (0.2 + (sd > 0 ? twitch : 0))); ctx.fillStyle = '#16121a'; ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(0, -16); ctx.lineTo(7, 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ff8fb5'; ctx.beginPath(); ctx.moveTo(-3.5, 2); ctx.lineTo(0, -9); ctx.lineTo(3.5, 2); ctx.closePath(); ctx.fill(); ctx.restore(); }
      const blink = Math.sin(t * 0.8 + 3) > 0.975;
      for (const sd of [-1, 1]) { if (blink) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sd * 7 - 4, -1); ctx.lineTo(sd * 7 + 4, -1); ctx.stroke(); } else { ctx.fillStyle = '#ffd23f'; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.ellipse(sd * 7, -1, 5, 6, 0, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(sd * 7, -1, 1.6, 5, 0, 0, 7); ctx.fill(); } }
      ctx.fillStyle = '#ff8fb5'; ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(2, 5); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8; for (const sd of [-1, 1]) for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 4, 7); ctx.lineTo(sd * 20, 5 + k * 3); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#9d4edd'; ctx.beginPath(); ctx.ellipse(0, -46, 15, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f5c84c'; ctx.beginPath(); ctx.arc(0, -42, 3.4, 0, 7); ctx.fill();
      ctx.restore();
    }
    function drawPumpkin(x, y, s, t){
      const fl = reduceMotion ? 1 : 0.85 + Math.sin(t * 9 + x) * 0.15;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createRadialGradient(0, -14, 2, 0, -14, 60); lg.addColorStop(0, `rgba(255,150,40,${0.35 * fl})`); lg.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = lg; ctx.fillRect(-60, -74, 120, 120); ctx.restore();
      for (const [dx, w] of [[-12, 14], [12, 14], [0, 16]]) { const pg = ctx.createRadialGradient(dx - 4, -20, 2, dx, -14, 20); pg.addColorStop(0, '#ffb04a'); pg.addColorStop(1, '#d0560a'); ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(dx, -14, w, 15, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#4f7a2a'; ctx.fillRect(-2, -34, 4, 7);
      ctx.fillStyle = `rgba(255,${Math.round(220 * fl)},90,1)`; ctx.beginPath(); ctx.moveTo(-11, -20); ctx.lineTo(-5, -20); ctx.lineTo(-8, -26); ctx.closePath(); ctx.moveTo(5, -20); ctx.lineTo(11, -20); ctx.lineTo(8, -26); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(-6, -7); ctx.lineTo(-2, -10); ctx.lineTo(2, -7); ctx.lineTo(6, -10); ctx.lineTo(11, -10); ctx.quadraticCurveTo(0, 0, -11, -10); ctx.fill();
      ctx.restore();
    }
    function drawDragon(x, y, t){
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(0, 2, 60, 9, 0, 0, 7); ctx.fill();
      const flap = reduceMotion ? 0 : Math.sin(t * 2.4) * 0.25, breathe = reduceMotion ? 0 : Math.sin(t * 1.5) * 2;
      // wings
      for (const sd of [1, -1]) { ctx.save(); ctx.translate(sd * 14, -64); ctx.rotate(sd * (0.4 + flap)); ctx.fillStyle = sd > 0 ? '#2f7a4a' : '#3a8a56'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sd * 40, -60, sd * 70, -50); ctx.lineTo(sd * 58, -30); ctx.lineTo(sd * 62, -12); ctx.lineTo(sd * 44, -6); ctx.lineTo(sd * 40, 10); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#1f5a34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sd * 58, -30); ctx.moveTo(0, 0); ctx.lineTo(sd * 44, -6); ctx.stroke(); ctx.restore(); }
      // tail curling around
      ctx.strokeStyle = '#3fa063'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(20, -14); ctx.quadraticCurveTo(64, -6, 58, -36); ctx.stroke(); ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(56, -40); ctx.lineTo(66, -54); ctx.lineTo(70, -36); ctx.closePath(); ctx.fill();
      // body + belly
      const bg = ctx.createRadialGradient(-10, -60, 6, 0, -40, 50); bg.addColorStop(0, '#6ad08a'); bg.addColorStop(1, '#2a7a46');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, -40, 34, 40 + breathe, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(-4, -34, 20, 30 + breathe, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(200,150,60,.5)'; ctx.lineWidth = 1.5; for (let k=0;k<5;k++) { ctx.beginPath(); ctx.arc(-4, -56 + k * 10, 16, 0.4, Math.PI - 0.4); ctx.stroke(); }
      for (const sd of [-1, 1]) { ctx.fillStyle = '#2a7a46'; ctx.beginPath(); ctx.ellipse(sd * 20, -4, 14, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; for (let k=-1;k<=1;k++) { ctx.beginPath(); ctx.arc(sd * 20 + k * 6, 2, 2, 0, 7); ctx.fill(); } }
      // head looking toward the cauldron
      ctx.save(); ctx.translate(-16, -92 + breathe * 0.5); const look = reduceMotion ? 0 : Math.sin(t * 0.7) * 0.08; ctx.rotate(-0.15 + look);
      ctx.fillStyle = '#4fb874'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 22, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-24, 8, 22, 14, -0.1, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 10 + 4, -18); ctx.rotate(sd * 0.3 + 0.2); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(0, -16); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#ff7a1a'; for (let k=0;k<4;k++) { ctx.beginPath(); ctx.moveTo(14 + k * 6, -16 + k * 6); ctx.lineTo(22 + k * 6, -20 + k * 6); ctx.lineTo(18 + k * 6, -10 + k * 6); ctx.fill(); }
      const blink = Math.sin(t * 0.75 + 5) > 0.98;
      if (blink) { ctx.strokeStyle = '#1a3a22'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(0, -4); ctx.stroke(); }
      else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-5, -5, 8, 9, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#7a3ad0'; ctx.beginPath(); ctx.ellipse(-7, -4, 4.5, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-7, -4, 2.4, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8.5, -7, 1.6, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#1a3a22'; for (const nx of [-38, -30]) { ctx.beginPath(); ctx.ellipse(nx, 3, 2, 3, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#1a3a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-42, 14); ctx.quadraticCurveTo(-28, 20, -12, 14); ctx.stroke();
      ctx.restore();
      ctx.restore();
      return { x: x - 16 - 44, y: y - 88 };
    }
    function drawGhost(x, y, t){
      const bob = reduceMotion ? 0 : Math.sin(t * 1.6) * 8;
      ctx.save(); ctx.translate(x, y + bob); ctx.globalAlpha = 0.88;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(0, -40, 4, 0, -40, 80); gg.addColorStop(0, 'rgba(180,220,255,.25)'); gg.addColorStop(1, 'rgba(180,220,255,0)'); ctx.fillStyle = gg; ctx.fillRect(-80, -120, 160, 160); ctx.restore();
      const body = ctx.createLinearGradient(0, -90, 0, 10); body.addColorStop(0, '#ffffff'); body.addColorStop(1, '#cfe0ff');
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-32, -50); ctx.quadraticCurveTo(-32, -92, 0, -92); ctx.quadraticCurveTo(32, -92, 32, -50); ctx.lineTo(32, 0);
      for (let k=0;k<4;k++) { const wx = 32 - (k + 0.5) * 16, wv = Math.sin(t * 5 + k) * 4; ctx.quadraticCurveTo(wx + 4, 10 + wv, wx - 8, 0); }
      ctx.closePath(); ctx.fill();
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 34, -40 + Math.sin(t * 3 + sd) * 4, 9, 6, sd * 0.6, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      const blink = Math.sin(t * 0.9 + 2) > 0.98;
      ctx.fillStyle = '#1a1a3a'; if (blink) { ctx.fillRect(-14, -58, 9, 2); ctx.fillRect(5, -58, 9, 2); } else { ctx.beginPath(); ctx.ellipse(-10, -58, 4.5, 6, 0, 0, 7); ctx.ellipse(10, -58, 4.5, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-11, -60, 1.5, 0, 7); ctx.arc(9, -60, 1.5, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,140,170,.5)'; ctx.beginPath(); ctx.ellipse(-18, -48, 5, 3, 0, 0, 7); ctx.ellipse(18, -48, 5, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1a3a'; ctx.beginPath(); ctx.ellipse(0, -44, 5, 6 + Math.sin(t * 2) * 1.5, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    // things flying across the window
    function broomWitch(x, y, s, t, dir){
      ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s); ctx.rotate(Math.sin(t * 3) * 0.08);
      ctx.fillStyle = '#120a1e'; ctx.strokeStyle = '#120a1e'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-28, 4); ctx.lineTo(22, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-28, 4); ctx.lineTo(-44, -4); ctx.lineTo(-46, 6); ctx.lineTo(-42, 14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, 1); ctx.quadraticCurveTo(-12, -12, -2, -18); ctx.quadraticCurveTo(8, -12, 6, 1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -22, 5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-9, -24); ctx.lineTo(9, -24); ctx.lineTo(-4, -42); ctx.closePath(); ctx.fill();
      const cape = Math.sin(t * 10) * 3; ctx.beginPath(); ctx.moveTo(-4, -16); ctx.quadraticCurveTo(-18, -12 + cape, -24, -4 + cape); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(-14, -6, 3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-17, -9); ctx.lineTo(-16, -13); ctx.lineTo(-14, -9); ctx.moveTo(-13, -9); ctx.lineTo(-11, -13); ctx.lineTo(-11, -8); ctx.fill();
      ctx.restore();
    }
    function dragonShape(x, y, s, t, dir){
      ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s); ctx.fillStyle = '#1a0606';
      const f = Math.sin(t * 6) * 14;
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-10, -6, 18, -4); ctx.lineTo(30, -10); ctx.lineTo(28, -2); ctx.lineTo(18, 4); ctx.quadraticCurveTo(-8, 8, -30, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-46, -2, -54, 8); ctx.quadraticCurveTo(-44, 4, -30, 4); ctx.fill();
      for (const k of [1, -0.6]) { ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(-4, -24 - f * k, 14, -30 - f * k); ctx.lineTo(8, -14 - f * k * 0.5); ctx.lineTo(4, -2); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    function book(x, y, t, col){
      const f = Math.sin(t * 9) * 0.6;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.3) * 0.2);
      for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd, 1); ctx.transform(1, 0, 0, 1, 0, 0); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(18, -6 - f * 10); ctx.lineTo(18, 10 - f * 10); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(15, -4 - f * 9); ctx.lineTo(15, 8 - f * 9); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.restore();
    }
    // per-scene life: fliers in the window, embers, fireflies, books
    function sceneUpdate(dt){
      const S = SCENES[st.scene];
      st.flyIn = (st.flyIn ?? 2.5) - dt;
      if (st.flyIn <= 0 && !st.flyer && S.fly !== 'bats') { const dir = Math.random() < 0.5 ? 1 : -1; st.flyer = { x: dir > 0 ? (S.wall === 'forest' ? -60 : W / 2 - 110) : (S.wall === 'forest' ? W + 60 : W / 2 + 110), y: S.wall === 'forest' ? 70 + Math.random() * 60 : 50 + Math.random() * 50, dir, t: 0 }; st.flyIn = 6 + Math.random() * 5; }
      if (st.flyer) { const f = st.flyer; f.t += dt; f.x += f.dir * (S.fly === 'books' ? 26 : S.wall === 'forest' ? 90 : 46) * dt; f.y += Math.sin(f.t * 2) * 10 * dt; if (f.x < -100 || f.x > W + 100 || (S.wall !== 'forest' && Math.abs(f.x - W / 2) > 140)) st.flyer = null; }
      if (S.embers && Math.random() < dt * 14) st.embers.push({ x: Math.random() * W, y: H + 5, vx: (Math.random() - .5) * 20, vy: -40 - Math.random() * 50, life: 4 + Math.random() * 3, r: 1 + Math.random() * 1.8 });
      for (const e of st.embers) { e.x += (e.vx + Math.sin(st.clock + e.y * 0.02) * 10) * dt; e.y += e.vy * dt; e.life -= dt; }
      st.embers = st.embers.filter(e => e.life > 0 && e.y > -10);
      if (S.flies) for (const f of st.fireflies) { f.ph += dt; f.x += Math.cos(f.ph * 0.7 + f.k) * 14 * dt; f.y += Math.sin(f.ph * 0.9 + f.k * 2) * 10 * dt; if (f.x < 0) f.x += W; if (f.x > W) f.x -= W; }
      if (S.right === 'dragon') { st.puffIn = (st.puffIn ?? 3) - dt; if (st.puffIn <= 0) { st.puffIn = 4 + Math.random() * 3; st.puff = 0.9; if (PB.sfx) PB.sfx('whoosh'); } if (st.puff > 0) st.puff -= dt; }
    }
    function drawSceneSky(){
      const S = SCENES[st.scene];
      if (st.flyer) {
        const f = st.flyer; ctx.save();
        if (S.wall !== 'forest') { const wx = W / 2, ww = 74; ctx.beginPath(); ctx.moveTo(wx - ww, 150); ctx.lineTo(wx - ww, 76); ctx.quadraticCurveTo(wx - ww, 6, wx, 0); ctx.quadraticCurveTo(wx + ww, 6, wx + ww, 76); ctx.lineTo(wx + ww, 150); ctx.closePath(); ctx.clip(); }
        if (S.fly === 'witch') broomWitch(f.x, f.y, S.wall === 'forest' ? 1.3 : 0.9, f.t, f.dir);
        else if (S.fly === 'dragon') dragonShape(f.x, f.y, 0.8, f.t, f.dir);
        else if (S.fly === 'books') { book(f.x, f.y, f.t, '#7a1e2b'); book(f.x - f.dir * 40, f.y + 24, f.t + 1, '#1f3a6b'); }
        ctx.restore();
      }
      if (S.flies) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const f of st.fireflies) { const a = 0.4 + 0.6 * Math.max(0, Math.sin(f.ph * 2.5 + f.k * 5)); const gg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 10); gg.addColorStop(0, `rgba(230,255,140,${a})`); gg.addColorStop(1, 'rgba(230,255,140,0)'); ctx.fillStyle = gg; ctx.fillRect(f.x - 10, f.y - 10, 20, 20); } ctx.restore(); }
    }
    function drawSceneEmbers(){ if (!st.embers.length) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const e of st.embers) { ctx.globalAlpha = Math.min(1, e.life / 2) * 0.8; ctx.fillStyle = e.life > 3 ? '#ffd27a' : '#ff7a2a'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill(); } ctx.restore(); ctx.globalAlpha = 1; }
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
    function drawHourglass(x, y, h, frac, t){
      const w = h * 0.62, sand = '#ffd36b';
      ctx.save(); ctx.translate(x, y);
      // wooden frame
      const wood = ctx.createLinearGradient(-w/2, 0, w/2, 0); wood.addColorStop(0, '#5a3418'); wood.addColorStop(0.5, '#b07a45'); wood.addColorStop(1, '#4a2a12');
      ctx.fillStyle = wood; ctx.beginPath(); ctx.roundRect(-w/2 - 3, -h/2 - 4, w + 6, 6, 3); ctx.roundRect(-w/2 - 3, h/2 - 2, w + 6, 6, 3); ctx.fill();
      ctx.fillRect(-w/2 - 1, -h/2, 3, h); ctx.fillRect(w/2 - 2, -h/2, 3, h);
      // glass bulbs
      const bulb = () => { ctx.beginPath(); ctx.moveTo(-w/2 + 4, -h/2 + 2); ctx.bezierCurveTo(-w/2 + 4, -h * 0.12, -2.5, -h * 0.08, -2, 0); ctx.bezierCurveTo(-2.5, h * 0.08, -w/2 + 4, h * 0.12, -w/2 + 4, h/2 - 2); ctx.lineTo(w/2 - 4, h/2 - 2); ctx.bezierCurveTo(w/2 - 4, h * 0.12, 2.5, h * 0.08, 2, 0); ctx.bezierCurveTo(2.5, -h * 0.08, w/2 - 4, -h * 0.12, w/2 - 4, -h/2 + 2); ctx.closePath(); };
      ctx.fillStyle = 'rgba(180,200,255,.12)'; bulb(); ctx.fill();
      ctx.save(); bulb(); ctx.clip();
      const top = (h/2 - 4) * frac, bot = (h/2 - 4) * (1 - frac);
      ctx.fillStyle = sand; ctx.fillRect(-w/2, -top - 1, w, top);
      ctx.beginPath(); ctx.moveTo(-w/2, h/2); ctx.lineTo(-w/2, h/2 - bot * 0.7); ctx.quadraticCurveTo(0, h/2 - bot * 1.35, w/2, h/2 - bot * 0.7); ctx.lineTo(w/2, h/2); ctx.closePath(); ctx.fill();
      if (!st.over && frac > 0) { ctx.fillStyle = sand; ctx.fillRect(-0.8, -1, 1.6, h/2 - bot * 0.9); for (let k=0;k<3;k++) { const yy = ((t * 2.2 + k / 3) % 1) * (h/2 - bot); ctx.beginPath(); ctx.arc(0, yy, 0.9, 0, 7); ctx.fill(); } }
      ctx.restore();
      ctx.strokeStyle = 'rgba(230,240,255,.8)'; ctx.lineWidth = 1.4; bulb(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-w/2 + 6, -h/2 + 6, 1.6, h * 0.22);
      ctx.restore();
    }
    function drawBat(b, t){
      const flap = Math.sin(t * 18 + b.ph);
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.s * b.dir, b.s);
      ctx.fillStyle = '#120a1e';
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 4.5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -2, 3.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(4.5, -8); ctx.lineTo(6, -5); ctx.moveTo(6.5, -4.5); ctx.lineTo(8, -8); ctx.lineTo(8, -4); ctx.fill();
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, -1);
        const wy = -flap * 12 * sd * sd;
        ctx.quadraticCurveTo(-6 * sd, wy - 6, -18 * sd, wy); ctx.quadraticCurveTo(-13 * sd, wy + 2, -11 * sd, wy + 5); ctx.quadraticCurveTo(-7 * sd, wy + 3, -5 * sd, wy + 7); ctx.quadraticCurveTo(-3 * sd, 3, 0, 2); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ff5050'; ctx.beginPath(); ctx.arc(6.5, -2.6, 0.9, 0, 7); ctx.fill();
      ctx.restore();
    }
    function drawRunes(cx, cy, t){
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.28);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2);
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(0, 0, 20, 0, 0, 150); rg.addColorStop(0, `rgba(140,255,110,${0.10 + pulse * 0.08})`); rg.addColorStop(1, 'rgba(140,255,110,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 150, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(160,255,130,${0.35 + pulse * 0.3})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 130, 0, 7); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 112, 0, 7); ctx.stroke();
      ctx.rotate(t * 0.15);
      ctx.beginPath(); for (let i=0;i<=5;i++) { const a = i * Math.PI * 4 / 5 - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 112, Math.sin(a) * 112); } ctx.stroke();
      ctx.fillStyle = `rgba(200,255,170,${0.5 + pulse * 0.4})`; ctx.font = `900 18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const glyphs = '\u16a0\u16a2\u16a6\u16b1\u16b7\u16c9\u16df\u16de';
      for (let i=0;i<8;i++) { const a = i / 8 * Math.PI * 2; ctx.save(); ctx.translate(Math.cos(a) * 121, Math.sin(a) * 121); ctx.rotate(a + Math.PI / 2); ctx.fillText(glyphs[i], 0, 0); ctx.restore(); }
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
    // ---------- 3D look: glass flasks with glowing potion layers, lit by the floating candles ----------
    let E3 = null, A3 = null;
    function assets3D(){
      if (A3) return A3; if (A3 === false) return null;
      E3 = PB.gl3d && PB.gl3d.get(); if (!E3) { A3 = false; return null; }
      const G = E3.G, bowl = []; for (let k=0;k<=10;k++) { const a = -Math.PI / 2 + k / 10 * Math.PI / 2; bowl.push([Math.cos(a), Math.sin(a)]); }
      A3 = { glass: new Map(), cyl: E3.mesh(G.cylinder(1, 1, 1, 32)), bowl: E3.mesh(G.lathe(bowl, 32)), lip: E3.mesh(G.torus(1, 0.14, 40, 10)), sphere: E3.mesh(G.sphere(1, 18, 12)), box: E3.mesh(G.box(1, 1, 1)), tHall: null, tShelf: null };
      return A3;
    }
    function glassMesh(w, h){
      const k = w + 'x' + h; if (A3.glass.has(k)) return A3.glass.get(k);
      const r = w / 2, prof = [];
      for (let q=0;q<=10;q++) { const a = -Math.PI / 2 + q / 10 * Math.PI / 2; prof.push([Math.max(0.001, Math.cos(a) * r), -(h - r) + Math.sin(a) * r]); }
      prof.push([r, -6]); prof.push([r + 1.5, 0]);
      const m = E3.mesh(E3.G.lathe(prof, 36)); A3.glass.set(k, m); return m;
    }
    const hex3 = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
    // the same potion "blocks" the flat drawing uses: runs of one colour, with the pour animation applied
    function potionBlocks(i, y, h){
      const b = st.bottles[i], lh = (h - 18) / CAP, a = st.anim, animOut = a && a.i === i && !a.moved, animIn = a && a.j === i && !a.moved, blocks = [];
      b.forEach((l, k) => {
        const bot = y + h - 4 - k * lh; let top = bot - lh;
        if (animOut && k >= b.length - a.amt) { const r = b.length - 1 - k, frac = Math.max(0, Math.min(1, 1 - (a.amt * pourF(a) - r))); if (frac <= 0) return; top = bot - lh * frac; }
        if (top >= bot) return;
        const col = l.hidden ? '#3a2a55' : COLORS[l.c], last = blocks[blocks.length - 1];
        if (last && !l.hidden && !last.hidden && last.col === col && Math.abs(last.top - bot) < 0.5) last.top = top;
        else blocks.push({ col, bot, top, hidden: l.hidden });
      });
      if (animIn) { const col = COLORS[a.color], bot = y + h - 4 - b.length * lh, top = bot - lh * a.amt * pourF(a), last = blocks[blocks.length - 1];
        if (top < bot - 0.2) { if (last && !last.hidden && last.col === col && Math.abs(last.top - bot) < 0.5) last.top = top; else blocks.push({ col, bot, top }); } }
      return blocks;
    }
    function bottle3D(i, x, y, w, h, rot, front){
      const E = E3, M = E.M, cx = x + w / 2, r = w / 2 - 3.2, Bm = M.trs([cx, -y, 34 + (front || 0)], [0, 0, -rot]);
      const part = (mesh, l, sc, mat, rr) => E.draw(mesh, M.mul(Bm, M.trs(l, rr || [0, 0, 0], sc)), mat);
      const ly = sy => -(sy - y), yc = y + h - w / 2;
      const blocks = potionBlocks(i, y, h);
      blocks.forEach((B, bi) => {
        const c = hex3(B.col), mat = B.hidden ? { color: [0.24, 0.17, 0.36], spec: 0.8, shine: 40 } : { color: c, emissive: c.map(v => v * 0.12), spec: 1.2, shine: 70, rim: 0.15 };
        if (B.bot > yc + 0.5) {
          const top = Math.min(B.top, yc);
          if (B.top < yc) part(A3.cyl, [0, (ly(top) + ly(yc)) / 2, 0], [r, ly(top) - ly(yc), r], mat);
          const squash = B.top > yc ? Math.max(0.05, (B.bot - B.top) / (B.bot - yc)) : 1;
          part(A3.bowl, [0, ly(yc), 0], [r, (w / 2 - 4) * squash, r], { ...mat, doubleSided: true });
        } else part(A3.cyl, [0, (ly(B.top) + ly(B.bot)) / 2, 0], [r, ly(B.top) - ly(B.bot), r], mat);
        if (bi > 0 && !B.hidden && !blocks[bi - 1].hidden) part(A3.cyl, [0, ly(B.bot), 0], [r + 0.2, 1.2, r + 0.2], { color: [0, 0, 0], alpha: 0.25, noShadow: true });
        if (bi === blocks.length - 1) {
          const lc = B.hidden ? [0.35, 0.28, 0.5] : c.map(v => v * 0.6 + 0.4);
          part(A3.cyl, [0, ly(B.top) + 0.6, 0], [r - 0.5, 1.2, r - 0.5], { color: lc, emissive: lc.map(v => v * 0.25), spec: 1.6, shine: 90, noShadow: true });
          // bubbles drifting up through the potion
          if (!reduceMotion && !B.hidden) for (let k=0;k<3;k++) { const span = B.bot - B.top - 4; if (span < 8) break; const ph = (st.clock * (0.25 + k * 0.08) + k * 0.37 + i * 0.13) % 1, by = B.bot - 4 - ph * span;
            E.sprite(M.xform(Bm, [(k - 1) * r * 0.45, ly(by), r * 0.6]), 4 + k, [1, 1, 1], 0.4 * (1 - ph), true); }
        }
      });
      // the glass, its lip, and a cork once the flask is full of one colour
      part(glassMesh(w, h), [0, 0, 0], [1, 1, 1], { color: [0.82, 0.88, 1], alpha: 0.2, spec: 2.2, shine: 160, rim: 1.4, doubleSided: true, noShadow: true });
      part(A3.lip, [0, -1, 0], [w / 2 + 2, 6, w / 2 + 2], { color: [0.9, 0.94, 1], alpha: 0.75, spec: 2, shine: 120, rim: 0.8 });
      if (isSealed(st.bottles[i])) {
        part(A3.cyl, [0, 9, 0], [w / 2 - 5, 22, w / 2 - 5], { color: [0.66, 0.45, 0.26], spec: 0.2, shine: 12 });
        part(A3.sphere, [0, 7, w / 2 - 4], [7, 7, 3.5], { color: [0.7, 0.12, 0.1], spec: 1.2, shine: 60 });
        E.sprite(M.xform(Bm, [0, 38, 6]), 26, [1, 0.85, 0.35], 0.9, true);
      }
    }
    // where every flask is this frame (the one being poured flies over in an arc and tips)
    function animPose(){
      const a = st.anim, s = st.pos[a.i], d = st.pos[a.j];
      const side = d.x > s.x ? -1 : 1;
      const tx2 = d.x + d.w/2 + side * (d.w * 0.95), ty2 = d.y - 78;
      const go = smooth(a.t / 0.28), back = smooth((a.t - 0.8) / 0.2), e = go * (1 - back);
      const arc = Math.sin(Math.PI * Math.min(1, a.t / 0.28)) * 40 * (1 - back);
      const x = s.x + (tx2 - s.w/2 - s.x) * e, y = (s.y - 22) + (ty2 - (s.y - 22)) * e - arc;
      const pf = pourF(a), tilt = smooth((a.t - 0.22) / 0.12) * (1 - back);
      return { a, s, d, side, x, y, pf, rot: -side * (0.9 + 0.55 * pf) * tilt };
    }
    const CANDLE_LIGHTS = [1, 3, 6, 9];
    function draw3D(tile){
      const E = E3, M = E.M, P3 = E.px;
      if (!shelfC) paintShelf();
      A3.tHalls = A3.tHalls || {}; if (!A3.tHalls[st.scene]) A3.tHalls[st.scene] = E.texture(hallFor(), { repeat: false }); if (!A3.tShelf) A3.tShelf = E.texture(shelfC, { repeat: false });
      E.resize(W, H, tile ? 1 : E.quality(1.5));
      E.begin({ ortho: [W, H] }, {
        noSky: true, sunDir: [-0.35, -0.55, -0.75], sunColor: [0.75, 0.8, 1.05], ambSky: [0.24, 0.2, 0.34], ambGround: [0.12, 0.08, 0.14], toon: 0.2,
        shadow: { center: [W / 2, -H * 0.45, 0], radius: 380 },
        post: { bloom: 0.6, threshold: 0.84, saturation: 1.2, contrast: 1.08, vignette: 0.3 },
      });
      E.backdrop(A3.tHalls[st.scene], W, H, { shadow: 0.45 });
      // floating candles: real wax, flickering flames, and their light falls on the flasks
      CANDLES.forEach((c, ci) => {
        const bob = reduceMotion ? 0 : Math.sin(st.clock * 1.3 + c.ph) * 5, x = c.x, y = c.y + bob, s = c.s, fl = reduceMotion ? 0 : Math.sin(st.clock * 11 + c.ph) * 1.2;
        E.draw(A3.cyl, M.trs(P3(x, y + 13 * s, 60), [0, 0, 0], [4 * s, 26 * s, 4 * s]), { color: [1, 0.95, 0.84], emissive: [0.18, 0.12, 0.05], spec: 0.6, shine: 30 });
        E.sprite(P3(x + fl * 0.3, y - 7 * s, 66), 9 * s, [1, 0.75, 0.3], 0.95, true); E.sprite(P3(x + fl * 0.3, y - 5 * s, 67), 4 * s, [1, 1, 0.9], 1, true); E.sprite(P3(x, y - 6 * s, 64), 60 * s, [1, 0.65, 0.3], 0.25, true);
        if (CANDLE_LIGHTS.includes(ci)) E.light(P3(x, y - 6 * s, 110), [0.75, 0.48, 0.22].map(v => v * (0.9 + fl * 0.06)), 230);
      });
      E.light(P3(W / 2 + 34, H - 100, 80), [0.5, 1.4, 0.4], 300);
      // shelves
      for (const sy of st.rowsY) { const y = sy + 176 + 8; E.draw(A3.box, M.trs(P3(W / 2, y + 11, 30), [0, 0, 0], [W - 20, 30, 70]), { tex: A3.tShelf, color: [1, 1, 1], spec: 0.25, shine: 20 }); }
      // flasks
      for (let i=0;i<st.bottles.length;i++) {
        if (st.anim && st.anim.i === i) continue;
        const p = st.pos[i]; let y = p.y, x = p.x;
        if (st.sel === i) { y -= 22; E.sprite(P3(x + p.w / 2, y + p.h * 0.55, 10), p.w * 2.6, [1, 0.8, 0.3], 0.35, true); }
        if (st.wiggle && st.wiggle.i === i) x += Math.sin(st.clock * 60) * 4;
        bottle3D(i, x, y, p.w, p.h, 0);
      }
      if (st.anim) { const ap = animPose(); bottle3D(ap.a.i, ap.x, ap.y, ap.s.w, ap.s.h, ap.rot, 60); }
      E.end(); if (!tile) E.present(ctx, W, H);
    }
    function draw(){
      const in3D = !!assets3D();
      if (in3D) draw3D(); else ctx.drawImage(hallFor(), 0, 0, W, H);
      if (st.bolt > 0) {
        const k = st.bolt > 0.38 ? 1 : st.bolt > 0.3 ? 0.2 : st.bolt > 0.22 ? 0.8 : st.bolt / 0.22 * 0.4;
        ctx.save(); const wx = W / 2, ww = 74; ctx.beginPath(); ctx.moveTo(wx - ww, 150); ctx.lineTo(wx - ww, 76); ctx.quadraticCurveTo(wx - ww, 6, wx, 0); ctx.quadraticCurveTo(wx + ww, 6, wx + ww, 76); ctx.lineTo(wx + ww, 150); ctx.closePath(); ctx.clip();
        ctx.fillStyle = `rgba(220,230,255,${0.75 * k})`; ctx.fillRect(wx - ww, 0, ww * 2, 150);
        if (k > 0.5) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowColor = '#bcd0ff'; ctx.shadowBlur = 10; ctx.beginPath(); let bx = wx - 20, by = 0; ctx.moveTo(bx, by); for (let i=0;i<6;i++) { bx += (i % 2 ? 12 : -9); by += 17; ctx.lineTo(bx, by); } ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = `rgba(170,190,255,${0.08 * k})`; ctx.fillRect(0, 0, W, H);
      }
      drawSceneSky();
      for (const b of st.bats) drawBat(b, st.clock);
      // header
      ctx.fillStyle = 'rgba(14,8,26,.78)'; ctx.beginPath(); ctx.roundRect(10, 12, 206, 86, 14); ctx.fill(); ctx.strokeStyle = 'rgba(245,200,76,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = GOLD; ctx.font = `900 22px ${FONT}`;
      ctx.fillText(st.spec.n === 'daily' ? 'Daily Brew' : `Level ${st.spec.n}`, 22, 42);
      ctx.fillStyle = '#c9b8e8'; ctx.font = `700 13px ${BODY}`;
      ctx.fillText(`${st.spec.k} potions to sort${st.spec.hidden !== 'none' ? ' \u00b7 ? layers' : ''}`, 22, 62, 150);
      const frac = st.time / st.spec.time, tw = 100, tx = 22, ty = 74;
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(tx, ty, tw, 12, 6); ctx.fill();
      ctx.fillStyle = frac > 0.5 ? '#8ff06b' : frac > 0.25 ? GOLD : '#ff4d6d';
      ctx.beginPath(); ctx.roundRect(tx, ty, Math.max(12, tw * frac), 12, 6); ctx.fill();
      for (const m of [0.25, 0.5]) { ctx.fillStyle = frac >= m ? GOLD : 'rgba(255,255,255,.3)'; star(ctx, tx + tw * m, ty + 6, 7, 3); ctx.fill(); }
      const hurry = !st.over && st.time <= 10, beat = hurry ? 1 + 0.18 * Math.max(0, Math.sin(st.clock * 12)) : 1;
      ctx.save(); ctx.translate(tx + tw + 8, ty + 11); ctx.scale(beat, beat); ctx.fillStyle = hurry ? '#ff6b81' : '#fff3d6'; ctx.font = `800 14px ${BODY}`; ctx.fillText(timeStr(st.time), 0, 0); ctx.restore();
      drawHourglass(190, 55, 62, frac, st.clock);
      drawButton(W - 64, 32, 'Undo', st.undos, st.undos > 0 && st.undo.length > 0 && !st.anim);
      drawButton(W - 64, 74, 'Restart', null, !st.anim);
      if (!in3D) for (const c of CANDLES) floatingCandle(c, st.clock);

      // shelves
      if (!shelfC) paintShelf();
      if (!in3D) for (const sy of st.rowsY) {
        const y = sy + 176 + 8;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(12, y + 18, W - 24, 10);
        ctx.drawImage(shelfC, 10, y - 4, W - 20, 30);
      }
      // colored light spilling from the potions onto the wall, and soft shadows on the shelf
      if (!in3D) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i=0;i<st.bottles.length;i++) {
        const b = st.bottles[i], p = st.pos[i]; if (!b.length || (st.anim && st.anim.i === i)) continue;
        const top = b[b.length - 1], col = top.hidden ? '#6a4bb0' : COLORS[top.c], n = parseInt(col.slice(1), 16);
        const cx = p.x + p.w / 2, cy = p.y + p.h * 0.7, rr = p.w * 1.7;
        const lg = ctx.createRadialGradient(cx, cy, 4, cx, cy, rr); lg.addColorStop(0, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},.22)`); lg.addColorStop(1, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},0)`);
        ctx.fillStyle = lg; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      }
      ctx.restore();
      for (let i=0;i<st.bottles.length;i++) { const p = st.pos[i]; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(p.x + p.w / 2 + 3, p.y + p.h + 8, p.w * 0.55, 4, 0, 0, 7); ctx.fill(); } }
      // mystery layers show a question mark over the 3D flask
      if (in3D) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,243,214,.7)';
        for (let i=0;i<st.bottles.length;i++) { if (st.anim && st.anim.i === i) continue; const p = st.pos[i], y = p.y - (st.sel === i ? 22 : 0), lh = (p.h - 18) / CAP; ctx.font = `900 ${Math.round(lh * 0.55)}px ${FONT}`;
          for (const B of potionBlocks(i, y, p.h)) if (B.hidden) ctx.fillText('?', p.x + p.w / 2, (B.top + B.bot) / 2 + 2); } }

      if (!in3D) for (let i=0;i<st.bottles.length;i++) {
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
        const tx2 = d.x + d.w/2 + side * (d.w * 0.95), ty2 = d.y - 78;
        // lift, swoop over in an arc, tilt to pour, then glide home
        const go = smooth(a.t / 0.28), back = smooth((a.t - 0.8) / 0.2), e = go * (1 - back);
        const arc = Math.sin(Math.PI * Math.min(1, a.t / 0.28)) * 40 * (1 - back);
        const x = s.x + (tx2 - s.w/2 - s.x) * e, y = (s.y - 22) + (ty2 - (s.y - 22)) * e - arc;
        const pf = pourF(a), tilt = smooth((a.t - 0.22) / 0.12) * (1 - back);
        const rot = -side * (0.9 + 0.55 * pf) * tilt;
        if (a.t > 0.3 && a.t < 0.76) {
          // a wobbly, glowing stream with droplets
          const lip = [x + s.w/2 - side * (s.w/2) * Math.cos(rot) , y + 4], dlh = (d.h - 18) / CAP;
          const land = [d.x + d.w/2, d.y + d.h - 4 - (st.bottles[a.j].length + a.amt * pf) * dlh];
          const thick = 8 * Math.sin(Math.PI * Math.max(0, Math.min(1, (a.t - 0.3) / 0.46)));
          const wob = Math.sin(st.clock * 30) * 2;
          ctx.save(); ctx.lineCap = 'round';
          ctx.shadowColor = COLORS[a.color]; ctx.shadowBlur = 14;
          ctx.strokeStyle = COLORS[a.color]; ctx.lineWidth = thick;
          ctx.beginPath(); ctx.moveTo(lip[0], lip[1]); ctx.bezierCurveTo(lip[0] - side * 10, lip[1] - 6, land[0] + wob, lip[1] + 10, land[0] + wob * 0.5, land[1]); ctx.stroke();
          ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(1, thick * 0.25);
          ctx.beginPath(); ctx.moveTo(lip[0], lip[1]); ctx.bezierCurveTo(lip[0] - side * 10, lip[1] - 6, land[0] + wob - 2, lip[1] + 10, land[0] + wob * 0.5 - 1, land[1]); ctx.stroke();
          for (let q=0;q<4;q++) { const tt = (st.clock * 3 + q / 4) % 1; ctx.fillStyle = COLORS[a.color]; ctx.beginPath(); ctx.arc(land[0] + (lip[0] - land[0]) * (1 - tt) * 0.15 + Math.sin(q * 7) * 4, lip[1] + (land[1] - lip[1]) * tt, 2.5, 0, 7); ctx.fill(); }
          ctx.restore();
          // the target flask glows while it fills
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; const n = parseInt(COLORS[a.color].slice(1), 16);
          const gg = ctx.createRadialGradient(land[0], land[1], 2, land[0], land[1], d.w * 1.4); gg.addColorStop(0, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},.35)`); gg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gg; ctx.fillRect(land[0] - d.w * 1.4, land[1] - d.w * 1.4, d.w * 2.8, d.w * 2.8); ctx.restore();
        }
        if (!in3D) drawBottle(a.i, x, y, s.w, s.h, rot);
      }

      // the wizard brewing at the bottom of the hall
      const cx = W / 2 + 34, cy = H - 62;
      drawRunes(cx, cy + 46, st.clock);
      drawCauldron(cx, cy, st.clock);
      if (!wizL) wizL = PB.layer(W, H);
      const main = ctx; ctx = wizL[1]; ctx.clearRect(0, 0, W, H);
      const SC = SCENES[st.scene], lx = st.rowsY.length === 1 ? 104 : 108;
      const tip = SC.left === 'witch' ? drawWitch(lx, H - 6, st.clock) : drawWizard(lx, H - 6, st.clock);
      if (SC.right === 'owl') drawOwl(W - 48, H - 96, st.clock);
      else if (SC.right === 'cat') { drawPumpkin(W - 30, H - 8, 1.1, st.clock); drawCat(W - 78, H - 12, st.clock); if (SC.wall === 'wood') drawPumpkin(W - 128, H - 4, 0.8, st.clock); }
      else if (SC.right === 'ghost') drawGhost(W - 62, H - 60, st.clock);
      else if (SC.right === 'dragon') { const m = drawDragon(W - 70, H - 8, st.clock); if (st.puff > 0 && !reduceMotion) for (let k=0;k<3;k++) st.parts.push({ x: m.x, y: m.y, vx: -160 - Math.random() * 120, vy: 40 + Math.random() * 60, life: 0.5, color: ['#ffd27a','#ff9a2a','#ff5a1a'][k], small: true }); }
      ctx.globalCompositeOperation = 'source-atop';
      const gl = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, 210); gl.addColorStop(0, 'rgba(150,255,110,.55)'); gl.addColorStop(1, 'rgba(150,255,110,0)'); ctx.fillStyle = gl; ctx.fillRect(0, H - 360, W, 360);
      const fire = ctx.createRadialGradient(cx, cy + 40, 6, cx, cy + 40, 140); fire.addColorStop(0, 'rgba(255,150,60,.45)'); fire.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = fire; ctx.fillRect(0, H - 260, W, 260);
      const moonL = ctx.createLinearGradient(0, H - 330, W * 0.4, H - 200); moonL.addColorStop(0, 'rgba(160,180,255,.22)'); moonL.addColorStop(1, 'rgba(160,180,255,0)'); ctx.fillStyle = moonL; ctx.fillRect(0, H - 360, W, 360);
      const dk = ctx.createLinearGradient(0, H - 120, 0, H); dk.addColorStop(0, 'rgba(0,0,0,0)'); dk.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = dk; ctx.fillRect(0, H - 120, W, 120);
      ctx.globalCompositeOperation = 'source-over';
      ctx = main; ctx.drawImage(wizL[0], 0, 0, W, H);
      // dust motes drifting in the moonbeam
      if (!reduceMotion) for (const m of st.motes) { m.y += m.v * 0.016; m.x += Math.sin(st.clock * 0.6 + m.ph) * 0.15; if (m.y > FLOOR) { m.y = 160; } ctx.fillStyle = `rgba(210,220,255,${0.25 + 0.25 * Math.sin(st.clock * 2 + m.ph)})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill(); }
      drawSceneEmbers();
      if (!reduceMotion && SCENES[st.scene].left === 'wizard' && Math.random() < 0.5) st.parts.push({ x: tip.x, y: tip.y, vx: 40 + Math.random() * 60, vy: 10 + Math.random() * 40, life: 0.7, color: Math.random() < .5 ? '#fff3c4' : '#b9a6ff' });

      for (const q of st.parts) { ctx.fillStyle = q.color; if (q.small) { ctx.globalAlpha = Math.max(0, q.life / 0.35); ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, 7); ctx.fill(); } else { ctx.globalAlpha = Math.max(0, q.life / 0.8); star(ctx, q.x, q.y, 4, 1.8); ctx.fill(); } }
      ctx.globalAlpha = 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const q of st.glints) { const a = Math.min(1, q.life) * 0.9; ctx.globalAlpha = a; ctx.fillStyle = q.col; star(ctx, q.x, q.y, 3.2, 1.2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 0.9, 0, 7); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha = 1;
      if (!st.over && st.time <= 10 && st.time > 0) { const p = 0.5 + 0.5 * Math.sin(st.clock * 8); const vg = ctx.createRadialGradient(W/2, H/2, H * 0.3, W/2, H/2, H * 0.72); vg.addColorStop(0, 'rgba(255,40,60,0)'); vg.addColorStop(1, `rgba(255,40,60,${0.18 + p * 0.22})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) {
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = `900 20px ${FONT}`;
        ctx.shadowColor = q.color; ctx.shadowBlur = 12; ctx.fillStyle = q.color; ctx.fillText(q.text, Math.min(W - 80, Math.max(80, q.x)), q.y); ctx.restore();
      }
    }
    const timeStr = t => { const s = Math.ceil(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

    function artTile(g){
      if (assets3D()) { const keep = st; fresh('classic', 5); st.phase = 'menu'; draw3D(true); const k = E3.canvas.height / H; g.drawImage(E3.canvas, 0, 130 * k, 480 * k, 360 * k, 0, 0, 240, 180); st = keep; return; }
      g.drawImage(hallFor(), 0, 0, W * 2, 360 * 2, 0, 0, 240, 180);
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
      controls: ['Tap a flask to pick it up, then tap another flask to pour.', 'You can pour into any flask that has room, even onto a different color.', 'Fill every flask with a single color before the hourglass runs out. You get 1 minute!', 'New colors join as you go, so later levels get tough.', 'Finish faster for more stars.'],
      powers: [
        { name:'Undo', desc:'Take back a pour. You get 3 per level', icon: g => { g.fillStyle = '#2a1a4a'; g.strokeStyle = GOLD; g.lineWidth = 1.5; g.beginPath(); g.roundRect(2, 3, 42, 22, 11); g.fill(); g.stroke(); g.fillStyle = '#fff3d6'; g.font = `800 10px ${BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Undo', 23, 14); } },
        { name:'Corked flask', desc:'A full flask of one color seals itself', icon: g => { g.fillStyle = COLORS[0]; g.fillRect(15, 6, 16, 20); g.fillStyle = '#b07a45'; g.fillRect(16, 1, 14, 6); } },
        { name:'Mystery layers', desc:'From level 15, hidden layers show their color when uncovered', icon: g => { g.fillStyle = '#3a2a55'; g.fillRect(15, 4, 16, 22); g.fillStyle = '#fff3d6'; g.font = `900 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 23, 16); } },
      ],
      init(){ assets3D(); },
      preview(){ fresh('classic', 1); st.phase = 'menu'; },
      start(mode, rand, lives, msg, level){ fresh(mode, level); pop(W / 2, 236, SCENES[st.scene].name, GOLD, 2.4); },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: null, stat: timeStr(st.time), score: st.score }; },
      debug(){ return st; },
      metrics(){ return { score: st.score, won: st.won ? 1 : 0, timeLeft: st.won ? Math.ceil(st.time) : 0, undoUsed: (st.spec.undos || 3) - st.undos, pours: st.pours || 0 }; },
      dailyGoals: [
        { text:'Sort every potion with {n} seconds left', m:'timeLeft', n:[10, 15, 20] },
        { text:'Sort every potion without using Undo', m:'won', n:[1], zero:'undoUsed' },
        { text:'Sort every potion in {n} pours or less', m:'won', n:[1], max:'pours', limit:[50, 45, 40] },
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
