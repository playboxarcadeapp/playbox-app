(function(){
  const { $, N, INK, fmt, reduceMotion, ctx, layer, dpr } = PB;
  // ===============================================================
  //  BRICK BASH (neon)
  // ===============================================================
  function createBricks(shell){
    const W = 480, H = 640, PADDLE_Y = H - 122, MAX_DROPS = 3, BASE_W = 92, MAX_BALLS = 9, MAX_LIVES = 6, LIFE_EVERY = 3000;
    const DISPLAY = '"Orbitron", "Arial Black", sans-serif';
    const POWERS = {
      wide:   { label:'WIDE', color:N.lime,   weight:20, time:12, name:'Wide paddle',  desc:'Bigger paddle for 12 seconds' },
      multi:  { label:'\u00d73',   color:N.cyan,   weight:17, time:0,  name:'Multi-ball',   desc:'Every ball splits into three' },
      laser:  { label:'ZAP',  color:N.pink,   weight:13, time:10, name:'Lasers',       desc:'Paddle shoots bricks for 10 seconds' },
      fire:   { label:'FIRE', color:N.orange, weight:10, time:8,  name:'Fireball',     desc:'Ball blasts through bricks' },
      slow:   { label:'SLOW', color:N.violet, weight:12, time:10, name:'Slow-mo',      desc:'Ball moves slower for 10 seconds' },
      magnet: { label:'GRAB', color:N.yellow, weight:9,  time:15, name:'Sticky paddle', desc:'Ball sticks; tap to aim and fire' },
      life:   { label:'+\u2665',   color:N.red,    weight:8,  time:0,  name:'Extra life',   desc:'Adds one heart (up to 6)' },
      shrink: { label:'TINY', color:'#5a6488', weight:13, time:10, name:'Tiny paddle', desc:'Dodge this one! Shrinks your paddle' },
    };
    let bgC, bgG, brC, brG, st = null;

    // synthwave night: striped sunset sun, neon mountains, glowing grid floor
    function paintBg(){
      [bgC, bgG] = layer(W, H); [brC, brG] = layer(W, H);
      const g = bgG, vy = H * 0.52;
      const sky = g.createLinearGradient(0, 0, 0, vy); sky.addColorStop(0, '#07051c'); sky.addColorStop(0.45, '#1b0b48'); sky.addColorStop(0.8, '#4a0f6b'); sky.addColorStop(1, '#8a1c78');
      g.fillStyle = sky; g.fillRect(0, 0, W, vy + 1);
      // stars
      for (let i=0;i<140;i++){ const y = Math.random() * vy * 0.85; g.fillStyle = `rgba(255,${200 + Math.random() * 55},255,${0.2 + Math.random() * 0.6 * (1 - y / vy)})`; const r = Math.random() < 0.1 ? 1.6 : 0.9; g.beginPath(); g.arc(Math.random() * W, y, r, 0, 7); g.fill(); }
      // the sun
      const sx = W / 2, sy = vy - 70, sr = 104;
      const halo = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 2.4); halo.addColorStop(0, 'rgba(255,90,170,.45)'); halo.addColorStop(1, 'rgba(255,60,160,0)');
      g.fillStyle = halo; g.fillRect(0, 0, W, vy);
      g.save(); g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.clip();
      const sun = g.createLinearGradient(0, sy - sr, 0, sy + sr); sun.addColorStop(0, '#ffe66d'); sun.addColorStop(0.5, '#ff8a3d'); sun.addColorStop(1, '#ff2d95');
      g.fillStyle = sun; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      g.globalCompositeOperation = 'destination-out';
      for (let k=0;k<7;k++){ const yy = sy + 10 + k * 12; g.fillRect(sx - sr, yy, sr * 2, 2 + k * 1.3); }
      g.restore();
      // neon mountains
      const ridge = (base, amp, seed, fill, line) => { const R = PB.mulberry(seed); g.beginPath(); g.moveTo(0, vy); let x = 0; const pts = []; while (x <= W) { pts.push([x, base - R() * amp]); x += 30 + R() * 40; } pts.push([W, base - R() * amp * 0.5]); pts.forEach(([px, py]) => g.lineTo(px, py)); g.lineTo(W, vy); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = line; g.lineWidth = 1.6; g.shadowColor = line; g.shadowBlur = 8; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); g.shadowBlur = 0; };
      ridge(vy - 10, 70, 7, '#1a0838', 'rgba(255,61,220,.8)');
      ridge(vy + 2, 40, 13, '#0c0424', 'rgba(34,228,255,.9)');
      // grid floor
      const fl = g.createLinearGradient(0, vy, 0, H); fl.addColorStop(0, '#2a0a4a'); fl.addColorStop(1, '#07051a');
      g.fillStyle = fl; g.fillRect(0, vy, W, H - vy);
      g.strokeStyle = 'rgba(255,61,220,.45)'; g.lineWidth = 1.2; g.shadowColor = '#ff3ddc'; g.shadowBlur = 6;
      for (let i=-14;i<=14;i++){ g.beginPath(); g.moveTo(W/2 + i*10, vy); g.lineTo(W/2 + i*80, H); g.stroke(); }
      for (let k=0;k<12;k++){ const t = k / 11, y = vy + (H - vy) * t * t; g.globalAlpha = 0.3 + t * 0.6; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.globalAlpha = 1; g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,200,240,.9)'; g.lineWidth = 2; g.shadowColor = '#ff3ddc'; g.shadowBlur = 14; g.beginPath(); g.moveTo(0, vy); g.lineTo(W, vy); g.stroke(); g.shadowBlur = 0;
      // dim the playfield a touch so bricks pop
      g.fillStyle = 'rgba(5,4,20,.16)'; g.fillRect(0, 0, W, H);
    }
    const TW = Array.from({ length: 24 }, () => ({ x: Math.random() * 480, y: Math.random() * 300, p: Math.random() * 6 }));

    const LAYOUTS = [
      (r,c,rows) => true,
      (r,c,rows) => (r + c) % 2 === 0 || r === 0,
      (r,c,rows) => c >= r/1.4 && c <= 7 - r/1.4,
      (r,c,rows) => Math.abs(c - 3.5) + Math.abs(r - (rows-1)/2) <= 4.2,
      (r,c,rows) => (c !== 3 && c !== 4) || r % 2 === 0,
    ];
    const ROWCOL = [N.pink, N.orange, N.yellow, N.lime, N.cyan, N.blue, N.violet, N.pink, N.orange];
    function newLevel(level){
      const R = st.rand;
      const rows = Math.min(4 + Math.floor(level/2), 9), cols = 8, bw = 52, bh = 20, gap = 6;
      const left = (W - (cols*bw + (cols-1)*gap))/2;
      let present;
      if (st.mode === 'daily') {
        const half = []; for (let r=0;r<rows;r++){ half.push([]); for (let c=0;c<4;c++) half[r].push(R() < 0.72); }
        present = (r,c) => half[r][c < 4 ? c : 7 - c];
      } else { const lay = LAYOUTS[(level-1) % LAYOUTS.length]; present = (r,c) => lay(r,c,rows); }
      const toughChance = Math.min(0.08 * (level - 1) + (st.mode==='daily' ? 0.08 : 0), 0.45);
      const bricks = [];
      for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
        if (!present(r,c)) continue;
        const hp = R() < toughChance ? 2 : 1;
        bricks.push({ x:left+c*(bw+gap), y:76+r*(bh+gap), w:bw, h:bh, hp, max:hp, color: ROWCOL[r % ROWCOL.length] });
      }
      if (bricks.length < 12) return newLevel(level);
      return bricks;
    }
    // Ball speed: each level starts slow and builds up the longer you stay in it, topping out at the old full speed.
    const topSpeed = () => Math.min(640, (300 + Math.min(st.level, 12)*25) * 1.12);
    const startSpeed = () => 235 + Math.min(st.level, 12)*6;
    const RAMP_TIME = 75; // seconds in a level to reach top speed
    const baseSpeed = () => { const t = Math.min(1, (st.levelTime || 0) / RAMP_TIME); const e = t * t * (3 - 2 * t); return startSpeed() + (topSpeed() - startSpeed()) * e; };
    function fresh(mode, rand, lives, phase){
      st = { mode, phase, score:0, level:1, lives, nextLife: LIFE_EVERY, rand, parts:[], pops:[], shards:[], rings:[], flash:0, shake:0, msg:null };
      st.bricks = newLevel(1); st.bdirty = true; st.dropsLeft = 2; st.time = 0; st.levelTime = 0;
      st.paddle = { x: W/2 - BASE_W/2, w: BASE_W, h: 14, y: PADDLE_Y };
      clearRound();
    }
    function clearRound(){ if (PB.sfx) PB.sfx('level');
      st.fx = { wide:0, laser:0, fire:0, slow:0, magnet:0, shrink:0 };
      st.drops = []; st.lasers = []; st.laserCD = 0; st.combo = 0; st.lastDrop = -99;
      st.balls = [{ x: W/2, y: st.paddle.y - 10, r: 9, vx: 0, vy: -baseSpeed(), held:true, off:0, trail:[] }];
    }
    function nextLevel(){
      addPoints(100 * st.level); st.level++; st.flash = 1; st.levelTime = 0;
      st.bricks = newLevel(st.level); st.bdirty = true; st.dropsLeft = Math.min(MAX_DROPS, 2 + Math.floor(st.level / 3));
      clearRound(); updatePaddleW(); st.msg = 'Level ' + st.level + '! Tap to go';
    }
    function addPoints(n){
      st.score += n;
      while (st.score >= st.nextLife) { st.nextLife += LIFE_EVERY; if (st.lives < MAX_LIVES) { st.lives++; pop(W/2, H/2 - 80, 'Bonus life!', N.red, 1.4); } }
    }
    function fire(b){
      const p = st.paddle;
      const ang = b.off === 0 ? (st.rand() < .5 ? -0.35 : 0.35) : Math.max(-0.95, Math.min(0.95, b.off/(p.w/2))) * 1.05;
      const sp = baseSpeed();
      b.vx = sp*Math.sin(ang); b.vy = -Math.abs(sp*Math.cos(ang)); b.held = false;
    }
    function launch(){
      if (!st || st.phase !== 'play') return;
      let any = false; for (const b of st.balls) if (b.held) { fire(b); any = true; }
      if (any) { st.msg = null; if (PB.sfx) PB.sfx('jump'); }
    }
    function setPaddleW(w){ const p = st.paddle, cx = p.x + p.w/2; p.w = w; p.x = Math.max(0, Math.min(W - p.w, cx - p.w/2)); }
    function updatePaddleW(){ setPaddleW(st.fx.wide > 0 ? 148 : st.fx.shrink > 0 ? 56 : BASE_W); }
    function movePaddle(x){ if (st.phase !== 'play') return; st.paddle.x = Math.max(0, Math.min(W - st.paddle.w, x - st.paddle.w/2)); }
    function pickPower(){
      const entries = Object.entries(POWERS).filter(([k]) => !(k==='life' && st.lives >= MAX_LIVES));
      let roll = st.rand() * entries.reduce((s,[,p]) => s + p.weight, 0);
      for (const [k,p] of entries) { roll -= p.weight; if (roll <= 0) return k; }
      return 'wide';
    }
    function burst(x,y,color,n){
      if (reduceMotion) return;
      for (let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, s=60+Math.random()*180; st.parts.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 50, life:0.6, color, size:2+Math.random()*3 }); }
    }
    function pop(x,y,text,color,life){ st.pops.push({ x, y, text, color: color||'#fff', life: life||0.9 }); }
    function breakBrick(k){
      k.hp--; st.bdirty = true; k.hit = 0.3;
      if (k.hp > 0) { addPoints(5); burst(k.x+k.w/2, k.y+k.h/2, '#fff', 5); st.shake = Math.max(st.shake, 2); return; }
      st.combo++;
      const mult = Math.min(1 + Math.floor(st.combo/4), 5), pts = 10 * mult; addPoints(pts);
      burst(k.x+k.w/2, k.y+k.h/2, k.color, 12);
      if (!reduceMotion) {
        for (let i=0;i<7;i++) st.shards.push({ x: k.x + Math.random() * k.w, y: k.y + Math.random() * k.h, vx: (Math.random() - .5) * 260, vy: -80 - Math.random() * 160, r: Math.random() * 6, vr: (Math.random() - .5) * 14, w: 5 + Math.random() * 9, h: 3 + Math.random() * 5, color: k.color, life: 0.9 });
        st.rings.push({ x: k.x + k.w/2, y: k.y + k.h/2, r: 6, life: 0.4, color: k.color });
      }
      if (mult > 1) pop(k.x+k.w/2, k.y, '+' + pts, N.yellow);
      if (st.combo === 8 || st.combo === 16 || st.combo === 24) pop(W/2, H/2 - 40, st.combo + ' COMBO!', N.pink, 1.2);
      if (st.dropsLeft > 0 && st.time - st.lastDrop > 6 && st.rand() < 0.12) { st.dropsLeft--; st.lastDrop = st.time; st.drops.push({ type: pickPower(), x: k.x + k.w/2 - 23, y: k.y, w: 46, h: 22, vy: 130 }); }
    }
    function catchPower(type){ if (PB.sfx) PB.sfx('power');
      const P = POWERS[type], fx = st.fx;
      if (type === 'wide') { fx.wide = P.time; fx.shrink = 0; }
      else if (type === 'shrink') { fx.shrink = P.time; fx.wide = 0; }
      else if (type === 'multi') {
        const add = [];
        for (const b of st.balls) {
          if (b.held) { fire(b); st.msg = null; }
          for (const t of [-0.4, 0.4]) {
            if (st.balls.length + add.length >= MAX_BALLS) break;
            const c = Math.cos(t), s = Math.sin(t);
            add.push({ x:b.x, y:b.y, r:b.r, vx: b.vx*c - b.vy*s, vy: b.vx*s + b.vy*c, held:false, off:0, trail:[] });
          }
        }
        st.balls.push(...add);
      }
      else if (type === 'life') st.lives = Math.min(st.lives+1, MAX_LIVES);
      else fx[type] = P.time;
      updatePaddleW();
      pop(st.paddle.x + st.paddle.w/2, st.paddle.y - 24, P.name + '!', type === 'shrink' ? '#aab6ff' : P.color, 1.1);
    }
    function step(dt){
      const p = st.paddle, fx = st.fx; st.time = (st.time || 0) + dt;
      for (const k in fx) if (fx[k] > 0) { fx[k] = Math.max(0, fx[k] - dt); if (fx[k] === 0 && (k==='wide'||k==='shrink')) updatePaddleW(); }
      if (fx.magnet === 0 && !st.msg) for (const b of st.balls) if (b.held) fire(b);
      const slow = fx.slow > 0 ? 0.6 : 1;
      if (!st.msg && st.balls.some(b => !b.held)) st.levelTime += dt;
      const want = baseSpeed();
      for (const b of st.balls) {
        if (b.held) { b.x = p.x + p.w/2 + b.off; b.y = p.y - b.r - 1; b.trail.length = 0; continue; }
        { const cur = Math.hypot(b.vx, b.vy) || 1, k = want / cur; b.vx *= k; b.vy *= k; }
        b.x += b.vx*dt*slow; b.y += b.vy*dt*slow;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x > W-b.r) { b.x = W-b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y + b.r >= p.y && b.y + b.r <= p.y + p.h + 10 && b.x >= p.x - b.r && b.x <= p.x + p.w + b.r) {
          st.combo = 0;
          if (fx.magnet > 0) { b.held = true; b.off = Math.max(-p.w/2+6, Math.min(p.w/2-6, b.x - (p.x + p.w/2))) || 0.01; }
          else {
            const hit = (b.x - (p.x + p.w/2)) / (p.w/2), speed = Math.hypot(b.vx, b.vy);
            const ang = Math.max(-1.1, Math.min(1.1, hit * 1.05));
            b.vx = speed * Math.sin(ang); b.vy = -Math.abs(speed * Math.cos(ang)); b.y = p.y - b.r; if (PB.sfx) PB.sfx('tap');
          }
          continue;
        }
        for (const k of st.bricks) {
          if (k.hp <= 0) continue;
          const cx = Math.max(k.x, Math.min(b.x, k.x+k.w)), cy = Math.max(k.y, Math.min(b.y, k.y+k.h));
          const dx = b.x - cx, dy = b.y - cy;
          if (dx*dx + dy*dy <= b.r*b.r) {
            if (fx.fire > 0) { k.hp = 1; breakBrick(k); continue; }
            breakBrick(k);
            if (Math.abs(dx) > Math.abs(dy)) b.vx = -b.vx; else b.vy = -b.vy;
            break;
          }
        }
        if (Math.abs(b.vy) < 90) b.vy = b.vy < 0 ? -90 : 90;
      }
      st.balls = st.balls.filter(b => b.y < PADDLE_Y + 70);
      if (fx.laser > 0) { st.laserCD -= dt; if (st.laserCD <= 0) { st.laserCD = 0.32; st.lasers.push({ x:p.x+8, y:p.y }, { x:p.x+p.w-8, y:p.y }); } }
      for (const L of st.lasers) {
        L.y -= 640*dt;
        for (const k of st.bricks) if (k.hp > 0 && L.x >= k.x && L.x <= k.x+k.w && L.y <= k.y+k.h && L.y >= k.y) { breakBrick(k); L.y = -99; break; }
      }
      st.lasers = st.lasers.filter(L => L.y > -20);
      for (const d of st.drops) {
        d.y += d.vy*dt;
        if (d.y + d.h >= p.y && d.y <= p.y + p.h && d.x + d.w >= p.x && d.x <= p.x + p.w) { catchPower(d.type); d.y = H + 99; }
      }
      st.drops = st.drops.filter(d => d.y < H + 30);
      if (st.balls.length === 0) {
        st.lives--; st.shake = 10;
        if (st.lives <= 0) { st.phase = 'over'; st.msg = null; shell.gameOver(st.score, `You reached level ${st.level}`); return; }
        clearRound(); updatePaddleW(); st.msg = 'Oops! Tap to try again'; return;
      }
      if (st.bricks.every(k => k.hp <= 0)) nextLevel();
    }
    function effects(dt){
      for (const k of st.bricks) if (k.hit > 0) k.hit = Math.max(0, k.hit - dt);
      for (const q of st.shards) { q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 620*dt; q.r += q.vr*dt; q.life -= dt; }
      st.shards = st.shards.filter(q => q.life > 0 && q.y < H + 20);
      for (const q of st.rings) { q.r += 220*dt; q.life -= dt; }
      st.rings = st.rings.filter(q => q.life > 0);
      st.flash = Math.max(0, st.flash - dt * 2.5);
      for (const q of st.parts) { q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 420*dt; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.y -= 36*dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      for (const b of st.balls) if (!b.held) { b.trail.unshift({x:b.x, y:b.y}); if (b.trail.length > 9) b.trail.pop(); }
      st.shake = Math.max(0, st.shake - dt*30);
    }
    function drawBricks(){
      const g = brG; g.clearRect(0,0,W,H);
      for (const k of st.bricks) {
        if (k.hp <= 0) continue;
        g.save(); g.shadowColor = k.color; g.shadowBlur = 14; g.fillStyle = k.color; g.globalAlpha = 0.9;
        g.beginPath(); g.roundRect(k.x, k.y, k.w, k.h, 5); g.fill(); g.restore();
        const body = g.createLinearGradient(0, k.y, 0, k.y + k.h);
        body.addColorStop(0, PB.shade(k.color, 0.35)); body.addColorStop(0.5, k.color); body.addColorStop(1, PB.shade(k.color, -0.4));
        g.fillStyle = body; g.beginPath(); g.roundRect(k.x, k.y, k.w, k.h, 5); g.fill();
        const gloss = g.createLinearGradient(0, k.y + 1, 0, k.y + k.h * 0.5);
        gloss.addColorStop(0, 'rgba(255,255,255,.6)'); gloss.addColorStop(1, 'rgba(255,255,255,.05)');
        g.fillStyle = gloss; g.beginPath(); g.roundRect(k.x + 3, k.y + 2, k.w - 6, k.h * 0.42, 3); g.fill();
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(k.x + 4, k.y + k.h - 3, k.w - 8, 1.5);
        g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(k.x + 8, k.y + 4.5, 3, 1.4, 0, 0, 7); g.fill();
        g.strokeStyle = PB.shade(k.color, 0.55); g.lineWidth = 1.2; g.beginPath(); g.roundRect(k.x+.6, k.y+.6, k.w-1.2, k.h-1.2, 5); g.stroke();
        if (k.max > 1) {
          g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.roundRect(k.x+2, k.y+2, k.w-4, k.h-4, 4); g.stroke();
          g.fillStyle = '#fff';
          for (const [bx,by] of [[k.x+6,k.y+6],[k.x+k.w-6,k.y+6],[k.x+6,k.y+k.h-6],[k.x+k.w-6,k.y+k.h-6]]) { g.beginPath(); g.arc(bx,by,1.6,0,7); g.fill(); }
          if (k.hp < k.max) {
            g.strokeStyle = 'rgba(7,11,31,.85)'; g.lineWidth = 1.6;
            g.beginPath(); g.moveTo(k.x+k.w*.3, k.y+2); g.lineTo(k.x+k.w*.45, k.y+k.h*.5); g.lineTo(k.x+k.w*.38, k.y+k.h-2);
            g.moveTo(k.x+k.w*.45, k.y+k.h*.5); g.lineTo(k.x+k.w*.7, k.y+k.h*.4); g.stroke();
          }
        }
      }
      st.bdirty = false;
    }
    function capsule(g,x,y,w,h,type,glow){
      const P = POWERS[type];
      g.save(); if (glow) { g.shadowColor = P.color; g.shadowBlur = 14; }
      g.fillStyle = P.color; g.beginPath(); g.roundRect(x,y,w,h,h/2); g.fill(); g.restore();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(x+6,y+3,w-12,5,3); g.fill();
      g.fillStyle = type === 'magnet' || type === 'wide' ? '#10160a' : '#fff';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 11px ${DISPLAY}`;
      g.fillText(P.label, x+w/2, y+h/2+1);
    }
    // ---------- 3D look: glossy glowing bricks, a chrome hover-paddle and a ball that lights up the bricks ----------
    let E3 = null, A3 = null;
    function assets3D(){
      if (A3) return A3; if (A3 === false) return null;
      E3 = PB.gl3d && PB.gl3d.get(); if (!E3) { A3 = false; return null; }
      const G = E3.G, M = E3.M, T = (g, t, r, sc) => G.transform(g, M.trs(t, r || [0,0,0], sc || [1,1,1]));
      const crack = document.createElement('canvas'); crack.width = 128; crack.height = 48; { const g = crack.getContext('2d'); g.strokeStyle = 'rgba(10,6,30,.9)'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(38, 0); g.lineTo(56, 22); g.lineTo(46, 48); g.moveTo(56, 22); g.lineTo(88, 16); g.lineTo(104, 30); g.moveTo(56, 22); g.lineTo(70, 36); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(40, 0); g.lineTo(58, 21); g.lineTo(90, 14); g.stroke(); }
      A3 = {
        brick: E3.mesh(G.roundBox(52, 20, 16, 6, 7)), core: E3.mesh(G.roundBox(40, 11, 6, 4, 3)),
        frame: E3.mesh(G.roundBox(52, 20, 12, 5, 3)), rivet: E3.mesh(G.sphere(1, 10, 8)),
        ball: E3.mesh(G.sphere(1, 28, 20)), chunk: E3.mesh(G.roundBox(1, 1, 1, 0.25, 2)),
        paddle: E3.mesh(G.merge([T(G.cylinder(1, 1, 1, 28, false), [0, 0, 0], [0, 0, Math.PI / 2]), T(G.sphere(1, 24, 16), [0.5, 0, 0], [0, 0, 0], [0.02, 1, 1]), T(G.sphere(1, 24, 16), [-0.5, 0, 0], [0, 0, 0], [0.02, 1, 1])])),
        cap: E3.mesh(G.sphere(1, 20, 14)), pill: E3.mesh(G.cylinder(1, 1, 1, 24, false)),
        tCrack: E3.texture(crack, { repeat: false }), quad: E3.mesh(G.quad(1, 1)),
        tBg: null,
      };
      return A3;
    }
    const hex3 = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    function draw3D(clock, tile){
      const E = E3, M = E.M, fx = st.fx, P3 = E.px;
      if (!A3.tBg) A3.tBg = E.texture(bgC, { repeat: false });
      E.resize(W, H, tile ? 1 : E.quality(1.5));
      const sx = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0, sy = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0;
      E.begin({ ortho: [W, H], pos: [-sx, sy, 1500], target: [-sx, sy, 0] }, {
        noSky: true, sunDir: [0.42, -0.62, -0.66], sunColor: [1.35, 1.25, 1.45], ambSky: [0.3, 0.26, 0.44], ambGround: [0.16, 0.08, 0.2], toon: 0.35,
        shadow: { center: [W / 2, -H / 2, 0], radius: 420 },
        post: { bloom: 0.7, threshold: 0.8, saturation: 1.22, contrast: 1.08, vignette: 0.32 },
      });
      E.backdrop(A3.tBg, W, H, { shadow: 0.45 });
      const ballCol = fx.fire > 0 ? [1, 0.55, 0.2] : [0.35, 0.95, 1];
      for (const b of st.balls) E.light(P3(b.x, b.y, 34), ballCol.map(v => v * 2.2), 140);
      // bricks
      for (const k of st.bricks) {
        if (k.hp <= 0) continue;
        const c = hex3(k.color), wob = k.hit > 0 ? Math.sin(k.hit * 40) * k.hit * 0.5 : 0, s = 1 + (k.hit > 0 ? k.hit * 0.35 : 0);
        const m = M.trs(P3(k.x + k.w / 2, k.y + k.h / 2, 10), [0, 0, wob], [s, s, s]);
        if (k.max > 1) {
          E.draw(A3.frame, m, { color: [0.78, 0.8, 0.88], spec: 1.6, shine: 90, rim: 0.5 });
          E.draw(A3.core, M.mul(m, M.trs([0, 0, 6])), { color: c, emissive: c.map(v => v * (k.hp < k.max ? 0.35 + 0.25 * Math.sin(clock * 14) : 0.6)), spec: 1.2, shine: 60 });
          for (const [rx, ry] of [[-21, 6], [21, 6], [-21, -6], [21, -6]]) E.draw(A3.rivet, M.mul(m, M.trs([rx, ry, 6], [0, 0, 0], 1.8)), { color: [1, 1, 1], spec: 2, shine: 100, noShadow: true });
          if (k.hp < k.max) E.draw(A3.quad, M.mul(m, M.trs([0, 0, 9.2], [0, 0, 0], [52, 20, 1])), { tex: A3.tCrack, blend: true, unlit: true, color: [1, 1, 1], noShadow: true });
        } else E.draw(A3.brick, m, { color: c, emissive: c.map(v => v * 0.1), spec: 1.1, shine: 70, rim: 0.3 });
      }
      // falling power-up capsules
      for (const d of st.drops) {
        const c = hex3(POWERS[d.type].color), m = M.trs(P3(d.x + d.w / 2, d.y + d.h / 2, 16), [clock * 3, 0, 0], [1, 1, 1]);
        E.draw(A3.pill, M.mul(m, M.trs([0, 0, 0], [0, 0, Math.PI / 2], [d.h / 2, d.w - d.h, d.h / 2])), { color: c, emissive: c.map(v => v * 0.45), spec: 1.4, shine: 80 });
        for (const e of [-1, 1]) E.draw(A3.cap, M.mul(m, M.trs([e * (d.w - d.h) / 2, 0, 0], [0, 0, 0], d.h / 2)), { color: c, emissive: c.map(v => v * 0.45), spec: 1.4, shine: 80 });
        E.sprite(P3(d.x + d.w / 2, d.y + d.h / 2, 30), 60, c, 0.35, true);
      }
      // paddle
      const p = st.paddle, pc = fx.shrink > 0 ? '#8a96d0' : fx.magnet > 0 ? N.yellow : N.cyan, pcol = hex3(pc);
      const pm = M.trs(P3(p.x + p.w / 2, p.y + p.h / 2, 14), [0, 0, 0], [p.w - p.h, p.h / 2 + 1, p.h / 2 + 4]);
      const pk = PB.meta && PB.meta.look('bricks', 'paddle'); E.draw(A3.paddle, pm, pk === 'paddle_lava' ? { color: [1, 0.45, 0.2], emissive: [0.5, 0.15, 0.02], spec: 1.4, shine: 90, rim: 0.6 } : pk === 'paddle_neon' ? { color: [0.45, 1, 0.5], emissive: [0.15, 0.45, 0.2], spec: 1.4, shine: 90, rim: 0.6 } : { color: [0.86, 0.88, 0.95], spec: 1.8, shine: 110, rim: 0.6 });
      E.draw(A3.pill, M.trs(P3(p.x + p.w / 2, p.y + p.h / 2, 14), [0, 0, Math.PI / 2], [p.h / 2 + 1.6, p.w - p.h - 4, p.h / 2 + 1.6].map((v, i) => i === 1 ? v * 0.5 : v)), { color: pcol, emissive: pcol.map(v => v * 0.9), spec: 1, shine: 60, noShadow: true });
      for (const e of [-1, 1]) { E.draw(A3.cap, M.trs(P3(p.x + p.w / 2 + e * (p.w - p.h) / 2, p.y + p.h / 2, 14), [0, 0, 0], [p.h / 2 + 1.2, p.h / 2 + 1.2, p.h / 2 + 4]), { color: pcol, emissive: pcol.map(v => v * 0.6), spec: 1.6, shine: 90 }); E.sprite(P3(p.x + p.w / 2 + e * (p.w / 2 - 12), p.y + p.h + 4, 20), 26 + Math.sin(clock * 30 + e) * 4, pcol, 0.8, true); }
      if (fx.laser > 0) for (const e of [p.x + 8, p.x + p.w - 8]) E.draw(A3.pill, M.trs(P3(e, p.y - 2, 16), [0, 0, 0], [3.5, 12, 3.5]), { color: hex3(N.pink), emissive: hex3(N.pink).map(v => v * 0.8), spec: 1.4 });
      // balls with glowing trails
      for (const b of st.balls) {
        b.trail.forEach((t, i) => E.sprite(P3(t.x, t.y, 22), b.r * 2.6 * (1 - i / 11), ballCol, (1 - i / 9) * 0.45, true));
        E.draw(A3.ball, M.trs(P3(b.x, b.y, 22), [clock * 4, clock * 3, 0], b.r), { color: fx.fire > 0 ? [1, 0.85, 0.7] : [0.95, 1, 1], emissive: ballCol.map(v => v * 1.4), spec: 2, shine: 120 });
        E.sprite(P3(b.x, b.y, 30), b.r * 9, ballCol, 0.5, true);
      }
      // shards tumble as little 3D chunks
      for (const q of st.shards) { const c = hex3(q.color), a = Math.min(1, q.life * 2); E.draw(A3.chunk, M.trs(P3(q.x, q.y, 24), [q.r, q.r * 0.7, q.r * 1.3], [q.w * a, q.h * a, q.h * a]), { color: c, emissive: c.map(v => v * 0.5), spec: 1.2, shine: 60 }); }
      for (const q of st.parts) E.sprite(P3(q.x, q.y, 30), q.size * 2.6, hex3(q.color.length === 7 ? q.color : '#ffffff'), Math.max(q.life / 0.6, 0), true);
      for (const L of st.lasers) E.sprite(P3(L.x, L.y - 9, 26), 8, hex3(N.pink), 1, true, 0, null, [0, 12, 0]);
      E.end(); if (!tile) E.present(ctx, W, H);
    }
    let drag = null;
    function draw(clock){
      const fx = st.fx;
      if (assets3D()) {
        draw3D(clock);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const t of TW) { const a = 0.5 + 0.5 * Math.sin(clock * 3 + t.p); ctx.fillStyle = `rgba(255,220,255,${0.5 * a})`; ctx.fillRect(t.x - 0.5, t.y - 4 * a, 1, 8 * a); ctx.fillRect(t.x - 4 * a, t.y - 0.5, 8 * a, 1); }
        for (const q of st.rings) { ctx.globalAlpha = q.life / 0.4; ctx.strokeStyle = q.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.stroke(); }
        ctx.restore();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 11px ${DISPLAY}`;
        for (const d of st.drops) { const P = POWERS[d.type]; ctx.fillStyle = d.type === 'magnet' || d.type === 'wide' ? '#10160a' : '#fff'; ctx.fillText(P.label, d.x + d.w / 2, d.y + d.h / 2 + 1); }
        return overlay2D();
      }
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      ctx.drawImage(bgC, 0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const t of TW) { const a = 0.5 + 0.5 * Math.sin(clock * 3 + t.p); ctx.fillStyle = `rgba(255,220,255,${0.5 * a})`; ctx.fillRect(t.x - 0.5, t.y - 4 * a, 1, 8 * a); ctx.fillRect(t.x - 4 * a, t.y - 0.5, 8 * a, 1); }
      ctx.restore();
      if (st.bdirty) drawBricks();
      ctx.drawImage(brC, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const q of st.parts) { ctx.globalAlpha = Math.max(q.life/0.6, 0); ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, q.size, q.size); }
      ctx.globalAlpha = 1;
      for (const L of st.lasers) { const lg = ctx.createLinearGradient(0, L.y-18, 0, L.y); lg.addColorStop(0,'rgba(255,61,220,0)'); lg.addColorStop(1, N.pink); ctx.fillStyle = lg; ctx.fillRect(L.x-2, L.y-18, 4, 18); }
      ctx.globalCompositeOperation = 'source-over';
      for (const d of st.drops) capsule(ctx, d.x, d.y, d.w, d.h, d.type, true);
      const p = st.paddle;
      const pc = fx.shrink > 0 ? ['#aab6ff','#5a6488'] : fx.magnet > 0 ? ['#fff0a8', N.yellow] : [N.cyan, N.violet];
      ctx.save(); ctx.shadowColor = pc[0]; ctx.shadowBlur = 18;
      const pg = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0); pg.addColorStop(0, pc[1]); pg.addColorStop(.5, pc[0]); pg.addColorStop(1, pc[1]);
      ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.roundRect(p.x+10, p.y+3, p.w-20, 3, 2); ctx.fill();
      if (fx.laser > 0) { ctx.fillStyle = N.pink; ctx.beginPath(); ctx.roundRect(p.x+4,p.y-7,8,9,2); ctx.roundRect(p.x+p.w-12,p.y-7,8,9,2); ctx.fill(); }
      const ballCol = fx.fire > 0 ? N.orange : N.cyan;
      ctx.globalCompositeOperation = 'lighter';
      for (const b of st.balls) b.trail.forEach((t,i) => { ctx.globalAlpha = (1 - i/9) * 0.35; ctx.fillStyle = ballCol; ctx.beginPath(); ctx.arc(t.x, t.y, b.r * (1 - i/12), 0, Math.PI*2); ctx.fill(); });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter';
      for (const q of st.rings) { ctx.globalAlpha = q.life / 0.4; ctx.strokeStyle = q.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.stroke(); }
      for (const b of st.balls) { const hg = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 46); hg.addColorStop(0, fx.fire > 0 ? 'rgba(255,150,60,.55)' : 'rgba(34,228,255,.45)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 1; ctx.fillStyle = hg; ctx.fillRect(b.x - 46, b.y - 46, 92, 92); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      for (const q of st.shards) { ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.color; ctx.shadowColor = q.color; ctx.shadowBlur = 8; ctx.fillRect(-q.w/2, -q.h/2, q.w, q.h); ctx.restore(); }
      for (const b of st.balls) {
        ctx.save(); ctx.shadowColor = ballCol; ctx.shadowBlur = fx.fire > 0 ? 26 : 16;
        ctx.fillStyle = fx.fire > 0 ? '#ffe2c4' : '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.restore();
      overlay2D();
    }
    function overlay2D(){
      const fx = st.fx;
      if (st.flash > 0) { ctx.fillStyle = `rgba(255,220,255,${st.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
      // finger zone under the paddle
      const zy = PADDLE_Y + 34;
      ctx.fillStyle = 'rgba(34,228,255,.05)'; ctx.beginPath(); ctx.roundRect(14, zy, W - 28, H - zy - 12, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(34,228,255,.18)'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(154,166,214,.55)'; ctx.font = `700 12px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('\u2039  SLIDE HERE  \u203a', W / 2, zy + (H - zy - 12) / 2);
      let tx = 10;
      for (const k of ['wide','laser','fire','slow','magnet','shrink']) {
        if (fx[k] <= 0) continue;
        capsule(ctx, tx, 10, 46, 22, k, false);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(tx+4, 36, 38, 3);
        ctx.fillStyle = POWERS[k].color; ctx.fillRect(tx+4, 36, 38 * fx[k] / POWERS[k].time, 3);
        tx += 52;
      }
      const mult = Math.min(1 + Math.floor(st.combo/4), 5);
      if (mult > 1) { ctx.save(); ctx.textAlign='right'; ctx.textBaseline='top'; ctx.fillStyle = N.yellow; ctx.shadowColor = N.yellow; ctx.shadowBlur = 12; ctx.font = `900 22px ${DISPLAY}`; ctx.fillText('\u00d7' + mult, W - 12, 10); ctx.restore(); }
      ctx.textAlign='center'; ctx.textBaseline='middle';
      for (const q of st.pops) { ctx.save(); ctx.globalAlpha = Math.min(1, q.life*1.6); ctx.fillStyle = q.color; ctx.shadowColor = q.color; ctx.shadowBlur = 10; ctx.font = `900 18px ${DISPLAY}`; ctx.fillText(q.text, q.x, q.y); ctx.restore(); }
      if (st.msg && st.phase === 'play') {
        ctx.font = `900 17px ${DISPLAY}`;
        const tw = Math.min(ctx.measureText(st.msg).width + 40, W - 30), y = H/2 + 70;
        ctx.fillStyle = 'rgba(7,11,31,.82)'; ctx.beginPath(); ctx.roundRect(W/2 - tw/2, y - 24, tw, 48, 24); ctx.fill();
        ctx.strokeStyle = N.cyan; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(st.msg, W/2, y + 1, W - 50);
      }
    }
    return {
      id:'bricks', music:'bricks', touchAnywhere: true, title:'BRICK BASH', W, H, statLabel:'Level', maxLives: MAX_LIVES, type:'endless', scoreKey:'bb-scores',
      tile:{ order:1, name:'Brick Bash', kind:'Neon brick breaker', art(g){ if (!bgC) paintBg(); if (assets3D()) { const keep = st; fresh('classic', Math.random, 3, 'menu'); const b = st.balls[0]; b.held = false; b.x = 300; b.y = 330; for (let i=0;i<8;i++) b.trail.push({ x: 300 - i * 7, y: 330 + i * 9 }); draw3D(0, true); g.drawImage(E3.canvas, 0, 50 * E3.canvas.height / H, E3.canvas.width, 360 * E3.canvas.height / H, 0, 0, 240, 180); st = keep; return; } const { rr, dot } = PB; if (!bgC) paintBg(); g.drawImage(bgC, 0, 150, 480, 360, 0, 0, 240, 180); g.shadowBlur = 10; const cols=[N.pink,'#ff9f1c',N.yellow,N.lime]; for(let r=0;r<4;r++)for(let c=0;c<6;c++) rr(g,14+c*36,14+r*17,32,12,4,cols[r]); rr(g,88,156,64,9,5,N.cyan); const hg = g.createRadialGradient(150,120,1,150,120,26); hg.addColorStop(0,'rgba(34,228,255,.7)'); hg.addColorStop(1,'rgba(34,228,255,0)'); g.fillStyle = hg; g.fillRect(120,90,60,60); dot(g,150,120,7,'#fff'); } },
      controls: ['Slide your finger anywhere (the strip at the bottom is easiest) and the paddle follows.', 'Tap to launch the ball.', 'Break bricks in a row without touching the paddle to multiply your points.', 'Every 3,000 points earns a bonus life.'],
      powers: Object.entries(POWERS).map(([k,p]) => ({ name:p.name, desc:p.desc, icon: (g) => capsule(g, 0, 3, 46, 22, k, false) })),
      init(){ if (!bgC) paintBg(); assets3D(); },
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg){ fresh(mode, rand, lives, 'play'); st.msg = msg ? msg + ' Tap to launch' : 'Tap to launch!'; },
      frame(dt, clock){
        if (st.phase === 'play') { for (let i=0;i<3;i++) { step(dt/3); if (st.phase !== 'play') break; } }
        effects(dt); draw(clock);
      },
      hud(){ return { lives: st.lives, stat: st.level, score: st.score }; },
      debug(){ return { st, speed: baseSpeed }; },
      metrics(){ return { score: st.score, level: st.level }; },
      dailyGoals: [
        { text:'Score {n} points', m:'score', n:[2500, 4000, 6000] },
        { text:'Reach level {n}', m:'level', n:[3, 4, 5] },
        { text:'Reach level {n} without losing a ball', m:'level', n:[2, 3], noHit:true },
      ],
      // Slide anywhere: the paddle follows your finger sideways, so your finger can stay low and out of the way
      pointerDown(x){ drag = { x, px: st.paddle.x }; launch(); },
      pointerMove(x){ if (!drag || st.phase !== 'play') return; st.paddle.x = Math.max(0, Math.min(W - st.paddle.w, drag.px + (x - drag.x) * 1.15)); },
      pointerUp(){ drag = null; },
      key(e){
        if (st.phase !== 'play') return;
        if (e.key==='ArrowLeft') st.paddle.x = Math.max(0, st.paddle.x - 30);
        if (e.key==='ArrowRight') st.paddle.x = Math.min(W-st.paddle.w, st.paddle.x + 30);
        if (e.key===' ') { e.preventDefault(); launch(); }
      },
    };
  }

  PB.register(createBricks);
})();
