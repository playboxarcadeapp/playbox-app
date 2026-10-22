(function(){
  const { $, N, INK, fmt, reduceMotion, ctx, layer, dpr } = PB;
  // ===============================================================
  //  BRICK BASH (neon)
  // ===============================================================
  function createBricks(shell){
    const W = 480, H = 640, BASE_W = 92, MAX_BALLS = 9, MAX_LIVES = 6, LIFE_EVERY = 3000;
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

    function paintBg(){
      [bgC, bgG] = layer(W, H); [brC, brG] = layer(W, H);
      const g = bgG;
      const grd = g.createLinearGradient(0,0,0,H); grd.addColorStop(0,'#0e1540'); grd.addColorStop(.55,'#080c26'); grd.addColorStop(1,'#120a2e');
      g.fillStyle = grd; g.fillRect(0,0,W,H);
      const glow = g.createRadialGradient(W/2, H*0.62, 10, W/2, H*0.62, W*0.8); glow.addColorStop(0,'rgba(139,107,255,.22)'); glow.addColorStop(1,'rgba(139,107,255,0)');
      g.fillStyle = glow; g.fillRect(0,0,W,H);
      g.strokeStyle = 'rgba(61,139,255,.22)'; g.lineWidth = 1;
      const vy = H*0.52;
      for (let i=-10;i<=10;i++){ g.beginPath(); g.moveTo(W/2 + i*12, vy); g.lineTo(W/2 + i*95, H); g.stroke(); }
      g.strokeStyle = 'rgba(34,228,255,.35)'; g.beginPath(); g.moveTo(0,vy); g.lineTo(W,vy); g.stroke();
      for (let i=0;i<60;i++){ g.fillStyle = `rgba(255,255,255,${0.15+Math.random()*0.5})`; g.fillRect(Math.random()*W, Math.random()*vy, 1.5, 1.5); }
    }

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
    const baseSpeed = () => 300 + Math.min(st.level, 12)*25;
    function fresh(mode, rand, lives, phase){
      st = { mode, phase, score:0, level:1, lives, nextLife: LIFE_EVERY, rand, parts:[], pops:[], shake:0, msg:null };
      st.bricks = newLevel(1); st.bdirty = true;
      st.paddle = { x: W/2 - BASE_W/2, w: BASE_W, h: 14, y: H - 54 };
      clearRound();
    }
    function clearRound(){ if (PB.sfx) PB.sfx('level');
      st.fx = { wide:0, laser:0, fire:0, slow:0, magnet:0, shrink:0 };
      st.drops = []; st.lasers = []; st.laserCD = 0; st.combo = 0;
      st.balls = [{ x: W/2, y: st.paddle.y - 10, r: 9, vx: 0, vy: -baseSpeed(), held:true, off:0, trail:[] }];
    }
    function nextLevel(){
      addPoints(100 * st.level); st.level++;
      st.bricks = newLevel(st.level); st.bdirty = true;
      clearRound(); updatePaddleW(); st.msg = 'Level ' + st.level + '! Tap to go';
    }
    function addPoints(n){
      st.score += n;
      while (st.score >= st.nextLife) { st.nextLife += LIFE_EVERY; if (st.lives < MAX_LIVES) { st.lives++; pop(W/2, H/2 - 80, 'Bonus life!', N.red, 1.4); } }
    }
    function fire(b){
      const p = st.paddle;
      const ang = b.off === 0 ? (st.rand() < .5 ? -0.35 : 0.35) : Math.max(-0.95, Math.min(0.95, b.off/(p.w/2))) * 1.05;
      const sp = Math.max(Math.hypot(b.vx, b.vy), baseSpeed());
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
      k.hp--; st.bdirty = true;
      if (k.hp > 0) { addPoints(5); burst(k.x+k.w/2, k.y+k.h/2, '#fff', 5); st.shake = Math.max(st.shake, 2); return; }
      st.combo++;
      const mult = Math.min(1 + Math.floor(st.combo/4), 5), pts = 10 * mult; addPoints(pts);
      burst(k.x+k.w/2, k.y+k.h/2, k.color, 12);
      if (mult > 1) pop(k.x+k.w/2, k.y, '+' + pts, N.yellow);
      if (st.combo === 8 || st.combo === 16 || st.combo === 24) pop(W/2, H/2 - 40, st.combo + ' COMBO!', N.pink, 1.2);
      if (st.rand() < 0.2) st.drops.push({ type: pickPower(), x: k.x + k.w/2 - 23, y: k.y, w: 46, h: 22, vy: 130 });
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
      const p = st.paddle, fx = st.fx;
      for (const k in fx) if (fx[k] > 0) { fx[k] = Math.max(0, fx[k] - dt); if (fx[k] === 0 && (k==='wide'||k==='shrink')) updatePaddleW(); }
      if (fx.magnet === 0 && !st.msg) for (const b of st.balls) if (b.held) fire(b);
      const slow = fx.slow > 0 ? 0.6 : 1;
      for (const b of st.balls) {
        if (b.held) { b.x = p.x + p.w/2 + b.off; b.y = p.y - b.r - 1; b.trail.length = 0; continue; }
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
            if (Math.hypot(b.vx,b.vy) < 640) { b.vx *= 1.012; b.vy *= 1.012; }
            break;
          }
        }
        if (Math.abs(b.vy) < 90) b.vy = b.vy < 0 ? -90 : 90;
      }
      st.balls = st.balls.filter(b => b.y < H + 20);
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
    function draw(clock){
      const fx = st.fx;
      ctx.save();
      if (st.shake > 0 && !reduceMotion) ctx.translate((Math.random()-.5)*st.shake, (Math.random()-.5)*st.shake);
      ctx.drawImage(bgC, 0, 0, W, H);
      const vy = H*0.52, off = reduceMotion ? 0 : (clock * 0.6) % 1;
      ctx.strokeStyle = fx.fire > 0 ? 'rgba(255,138,61,.28)' : 'rgba(61,139,255,.24)'; ctx.lineWidth = 1;
      for (let i=0;i<10;i++){ const t = (i + off)/10; const y = vy + (H - vy) * t * t; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
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
      for (const b of st.balls) {
        ctx.save(); ctx.shadowColor = ballCol; ctx.shadowBlur = fx.fire > 0 ? 26 : 16;
        ctx.fillStyle = fx.fire > 0 ? '#ffe2c4' : '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.restore();
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
      id:'bricks', music:'bricks', title:'BRICK BASH', W, H, statLabel:'Level', maxLives: MAX_LIVES, type:'endless', scoreKey:'bb-scores',
      tile:{ order:1, name:'Brick Bash', kind:'Neon brick breaker', art(g){ const { neonBg, rr, dot } = PB; neonBg(g); const cols=[N.pink,N.yellow,N.lime,N.cyan]; for(let r=0;r<4;r++)for(let c=0;c<6;c++) rr(g,14+c*36,18+r*20,32,14,4,cols[r]); rr(g,88,150,64,10,5,N.cyan); dot(g,140,118,7,'#fff'); rr(g,40,112,32,14,7,N.orange); } },
      controls: ['Slide your finger (or mouse) to move the paddle.', 'Tap to launch the ball.', 'Break bricks in a row without touching the paddle to multiply your points.', 'Every 3,000 points earns a bonus life.'],
      powers: Object.entries(POWERS).map(([k,p]) => ({ name:p.name, desc:p.desc, icon: (g) => capsule(g, 0, 3, 46, 22, k, false) })),
      init(){ if (!bgC) paintBg(); },
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg){ fresh(mode, rand, lives, 'play'); st.msg = msg ? msg + ' Tap to launch' : 'Tap to launch!'; },
      frame(dt, clock){
        if (st.phase === 'play') { for (let i=0;i<3;i++) { step(dt/3); if (st.phase !== 'play') break; } }
        effects(dt); draw(clock);
      },
      hud(){ return { lives: st.lives, stat: st.level, score: st.score }; },
      metrics(){ return { score: st.score, level: st.level }; },
      dailyGoals: [
        { text:'Score {n} points', m:'score', n:[2500, 4000, 6000] },
        { text:'Reach level {n}', m:'level', n:[3, 4, 5] },
        { text:'Reach level {n} without losing a ball', m:'level', n:[2, 3], noHit:true },
      ],
      pointerDown(x){ movePaddle(x); launch(); },
      pointerMove(x){ movePaddle(x); },
      pointerUp(){},
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
