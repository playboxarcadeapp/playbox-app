// CASTLE CRASH (3D): a medieval fair game seen from behind the catapult.
// Aim at the castles on the table and knock every block off before you run out of stones.
// Physics: each castle sits in its own "lane" and runs a 2D rigid-body world in the depth/height plane.
// Shots fly in 3D and hop into whichever lane they are passing through.
(function(){
  const { reduceMotion, ctx, mulberry, seedFrom, shade, dpr } = PB;

  function createCastle(shell){
    const W = 480, H = 720, TABLE_Y = 452, TX0 = 236, TX1 = 470, GROUND = TABLE_Y + 90, G = 900;
    const S = 0.01, AIMD = (TX0 + TX1) / 2, COUNTER_Y = TABLE_Y + 30;
    const PIV = { d: 185, y: COUNTER_Y - 34 }, ARM = 62, REST = Math.PI - 0.62, FIRE = Math.PI / 2 - 0.32;
    const LAUNCH = { d: 203, y: COUNTER_Y - 96 }, FLIGHT = window.__castleFlight || 0.3;
    const FONT = '"MedievalSharp", "Georgia", serif';
    const BODY = '"Nunito", "Segoe UI", sans-serif';
    const MAT = {
      sand: { d: 1.0, base: '#f0b85e', name:'Wood', look:'wood' },
      gray: { d: 1.7, base: '#a9e6ff', name:'Ice', look:'ice' },
      dark: { d: 2.6, base: '#b9bec8', name:'Stone', look:'stone' },
      wood: { d: 0.6, base: '#d98f4a', name:'Oak', look:'wood' },
      goblin: { d: 0.8, base: '#7ccf4a', name:'Goblin', look:'goblin' },
    };
    const AMMO = {
      stone: { name:'Stone', r: 12, d: 11,  color:'#8d8a86', desc:'A trusty round rock' },
      iron:  { name:'Iron ball', r: 14, d: 24, color:'#3d4048', desc:'Very heavy. Smashes through walls' },
      triple:{ name:'Triple shot', r: 9, d: 11, color:'#a3876a', desc:'Splits into three stones in the air' },
      fire:  { name:'Fire pot', r: 12, d: 6, color:'#e8641c', desc:'Bursts and blasts nearby blocks away' },
    };
    const OUTLINE = { color: [0.24, 0.13, 0.07], unlit: true, outline: 0.0065, noShadow: true, fogless: false };
    const BANNERS = ['#b3261e','#1f4fa8','#e0a800','#2e7d32','#6a1b9a'];
    const ROOFS = ['#9e2a22','#2b4f9a','#3f6b45','#7a3d8f'];
    let st = null, E = null, A = null;
    const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    const W3 = (d, y, lat) => [lat * S, (GROUND - y) * S, -d * S];

    // ---------- Level design (same castles as before, one castle per lane) ----------
    function levelSpec(n, R){
      const blocks = [];
      const heavy = Math.min(0.75, n / 90), mid = Math.min(0.6, 0.15 + n / 120);
      const mat = () => { const r = R(); return r < heavy * 0.5 ? 'dark' : r < heavy * 0.5 + mid ? 'gray' : r < 0.92 ? 'sand' : 'wood'; };
      let lane = 0;
      const add = (x, yBottom, w, h, type) => { blocks.push({ x, y: yBottom - h / 2, w, h, type, lane, lat: type === 'wall' ? Math.min(30, w * 0.42) : w / 2, mat: mat(), flag: R() < 0.4 ? BANNERS[Math.floor(R() * BANNERS.length)] : null, roof: ROOFS[Math.floor(R() * ROOFS.length)] }); return yBottom - h; };
      const builders = {
        tower(x, k){ let y = TABLE_Y; for (let i=0;i<k;i++) y = add(x, y, i % 2 ? 28 : 34, i % 2 ? 50 : 34, i % 2 ? 'tower' : 'keep'); },
        arch(x, k){ let y = add(x - 22, TABLE_Y, 22, 48, 'tower'); add(x + 22, TABLE_Y, 22, 48, 'tower'); y = add(x, y, 70, 18, 'wall'); for (let i=0;i<k;i++) y = add(x, y, 30, 30, 'keep'); },
        pyramid(x, k){ const rows = Math.min(k, 4); for (let r=0;r<rows;r++) for (let i=0;i<rows - r;i++) add(x + (i - (rows - r - 1) / 2) * 30, TABLE_Y - r * 28, 28, 28, 'keep'); },
        walls(x, k){ let y = TABLE_Y; for (let i=0;i<k;i++) y = add(x, y, 60, 22, 'wall'); },
        fortress(x, k){ let y1 = add(x - 30, TABLE_Y, 22, 56, 'tower'); add(x + 30, TABLE_Y, 22, 56, 'tower'); add(x, TABLE_Y, 30, 30, 'keep'); let y = add(x, y1, 90, 16, 'wall'); add(x - 30, y, 24, 24, 'keep'); add(x + 30, y, 24, 24, 'keep'); y = add(x, y, 28, 46, 'tower'); for (let i=1;i<k;i++) y = add(x, y, 26, 26, 'keep'); },
      };
      const kinds = n < 3 ? ['tower'] : n < 8 ? ['tower','walls','arch'] : n < 20 ? ['tower','walls','arch','pyramid'] : ['tower','walls','arch','pyramid','fortress'];
      const groups = n < 6 ? 1 : n < 25 ? 2 : 3;
      const size = 2 + Math.min(4, Math.floor(n / 10));
      for (let g=0; g<groups; g++) {
        lane = g;
        const kind = kinds[Math.floor(R() * kinds.length)];
        const k = Math.max(kind === 'tower' ? 3 : 1, size + Math.floor(R() * 2));
        builders[kind](AIMD + 25 + (R() - 0.5) * 30, k);
        const mine = blocks.filter(b => b.lane === g);
        const top = mine.reduce((a, b) => (b.y - b.h / 2 < a.y - a.h / 2 ? b : a));
        add(top.x, top.y - top.h / 2, 24, 24, 'goblin');
        const gb = blocks[blocks.length - 1]; gb.mat = 'goblin'; gb.flag = null; gb.lat = 12;
        if (n >= 15 && mine.length > 5 && R() < 0.6) { const mid = mine.filter(b => b.type === 'wall')[0]; if (mid) { add(mid.x + (R() < .5 ? -18 : 18), mid.y - mid.h / 2, 22, 22, 'goblin'); const g2 = blocks[blocks.length - 1]; g2.mat = 'goblin'; g2.flag = null; g2.lat = 11; } }
      }
      const ammoN = Math.max(3 + groups, Math.min(12, Math.ceil(blocks.length / 2) + 2 - Math.floor(n / 40)));
      const ammo = [];
      for (let i=0;i<ammoN;i++) {
        const r = R();
        ammo.push(n < 4 ? 'stone' : r < 0.12 ? 'triple' : r < 0.22 && n >= 8 ? 'fire' : r < 0.3 && n >= 12 ? 'iron' : 'stone');
      }
      const lanes = groups === 1 ? [0] : groups === 2 ? [-46, 46] : [-72, 0, 72];
      return { n, blocks, ammo, lanes };
    }

    // ---------- World ----------
    function makeWorld(){
      const P = PB.physics, w = new P.World(G);
      w.add(P.makeBox((TX0 + TX1) / 2, TABLE_Y + 10, TX1 - TX0, 20, 0, { friction: 0.4, data: { table: true } }));
      w.add(P.makeBox(AIMD, GROUND + 30, 3000, 60, 0, { friction: 0.9, data: { ground: true } }));
      w.onContact = (a, b) => {
        const shot = a.data && a.data.shot ? a : b.data && b.data.shot ? b : null;
        const other = shot === a ? b : a;
        if (!shot) return;
        if (shot.data.type === 'fire' && !shot.data.burst && other.data && (other.data.block || other.data.table)) st.pendingBurst.push(shot);
        if (other.data && other.data.block && !shot.data.thud) { shot.data.thud = true; st.shake = Math.max(st.shake, 5); dust3(shotPos(shot), MAT[other.data.mat].base, 8); }
      };
      return w;
    }
    function fresh(mode, level){
      const R = mode === 'daily' ? mulberry(seedFrom('castle-daily-' + PB.today())) : mulberry(seedFrom('castle-' + level));
      const spec = levelSpec(mode === 'daily' ? 35 : level, R);
      const P = PB.physics;
      const lanes = spec.lanes.map((lat, i) => ({ lat, half: Math.max(14, ...spec.blocks.filter(b => b.lane === i).map(b => b.lat)), world: null }));
      const free = makeWorld();
      st = { mode, level, spec, lanes, free, blocks: [], ammo: spec.ammo.slice(), shots: [], score: 0, knocked: 0, phase:'play',
        aim: null, arm: REST, armV: 0, loaded: true, reload: 0, parts: [], pops: [], time: 0, shake: 0, settle: 0, over: false, endTimer: null, pendingBurst: [], lastFire: 0 };
      for (const L of lanes) L.world = makeWorld();
      st.blocks = spec.blocks.map(b => { const body = P.makeBox(b.x, b.y, b.w, b.h, MAT[b.mat].d, { friction: 0.5, data: { block: true, ...b } }); lanes[b.lane].world.add(body); return body; });
      for (const L of lanes) { for (let i=0;i<60;i++) L.world.step(1/120); }
      for (const b of st.blocks) { b.vx = b.vy = b.w = 0; b.data.y0 = b.y; b.data.a0 = b.a; b.data.x0 = b.x; }
      st.target = { lat: lanes[Math.floor(lanes.length / 2)].lat, y: TABLE_Y - 30 };
    }
    const worldsOf = () => [st.free, ...st.lanes.map(L => L.world)];
    const shotPos = s => W3(s.x, s.y, s.lat);
    function laneFor(lat, r){
      let best = -1, bd = 1e9;
      st.lanes.forEach((L, i) => { const d = Math.abs(lat - L.lat); if (d < L.half + r && d < bd) { bd = d; best = i; } });
      return best;
    }
    function moveShot(s, lane){
      if (s.lane === lane) return;
      (s.lane < 0 ? st.free : st.lanes[s.lane].world).remove(s);
      (lane < 0 ? st.free : st.lanes[lane].world).add(s);
      s.lane = lane;
    }
    function explode(shot){ if (PB.sfx) PB.sfx('boom');
      shot.data.burst = true; shot.dead = true;
      for (const b of st.blocks) {
        const dx = b.x - shot.x, dy = b.y - shot.y, dl = b.data.lat ? (st.lanes[b.data.lane].lat - shot.lat) : 0, d = Math.hypot(dx, dy, dl * 0.8);
        if (d < 115 && d > 0) { const k = (1 - d / 115) * 560, dd = Math.hypot(dx, dy) || 1; b.vx += dx / dd * k * 0.8 + k * 0.35; b.vy += dy / dd * k * 0.6 - 160 * (1 - d / 115); b.w += (Math.random() - .5) * 6; }
      }
      st.shake = 14; st.flash = 0.25;
      const p = shotPos(shot);
      if (!reduceMotion) for (let i=0;i<40;i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - 0.3, s = 1 + Math.random() * 3; st.parts.push({ p: [...p], v: [Math.cos(a) * Math.cos(b) * s, Math.abs(Math.sin(b)) * s * 0.8 + 0.5, Math.sin(a) * Math.cos(b) * s], life: 0.8, max: 0.8, color: [[1, 0.7, 0.15], [1, 0.35, 0.1], [1, 0.9, 0.5]][i % 3], size: 0.12 + Math.random() * 0.14, add: true, g: 2 }); }
      for (let i=0;i<14;i++) st.parts.push({ p: [p[0] + (Math.random() - .5) * 0.3, p[1], p[2]], v: [(Math.random() - .5) * 0.6, 0.6 + Math.random() * 0.6, (Math.random() - .5) * 0.6], life: 1.6, max: 1.6, color: [0.35, 0.33, 0.32], size: 0.3 + Math.random() * 0.3, grow: 0.5, g: 0 });
      pop(p, 'BOOM!', '#ff7a1f');
    }
    function fire(){ if (PB.sfx) PB.sfx('launch');
      const type = st.ammo.shift(), Am = AMMO[type], P = PB.physics;
      const t = st.target, T = FLIGHT;
      const ball = P.makeCircle(LAUNCH.d, LAUNCH.y, Am.r, Am.d * 1.8, { friction: 0.6, data: { shot: true, type } });
      ball.vx = (AIMD - LAUNCH.d) / T; ball.vy = (t.y - LAUNCH.y - 0.5 * G * T * T) / T;
      ball.lat = 0; ball.vlat = t.lat / T; ball.age = 0; ball.lane = -1;
      st.free.add(ball); st.shots.push(ball);
      st.loaded = false; st.reload = 0.55; st.lastFire = st.time;
    }
    function split(ball){
      if (ball.data.split) return; ball.data.split = true;
      const P = PB.physics, w = ball.lane < 0 ? st.free : st.lanes[ball.lane].world;
      for (const dv of [-260, 260]) {
        const b = P.makeCircle(ball.x, ball.y, ball.r, 20, { friction: 0.6, data: { shot: true, type: 'triple', split: true } });
        b.vx = ball.vx; b.vy = ball.vy - 30; b.lat = ball.lat; b.vlat = ball.vlat + dv; b.age = ball.age; b.lane = ball.lane;
        w.add(b); st.shots.push(b);
      }
      const p = shotPos(ball);
      for (let i=0;i<10;i++) st.parts.push({ p: [...p], v: [(Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2], life: .4, max: .4, color: [1, 0.95, 0.75], size: 0.06, add: true, g: 0 });
    }
    function pop(p, text, color, life){ st.pops.push({ p, text, color, life: life || 1.1, rise: 0 }); }
    function dust3(p, col, n){ if (reduceMotion) return; const c = hex(col).map(v => v * 0.9 + 0.08); for (let i=0;i<n;i++) st.parts.push({ p: [p[0] + (Math.random() - .5) * 0.2, p[1] + (Math.random() - .3) * 0.2, p[2] + (Math.random() - .5) * 0.2], v: [(Math.random() - .5) * 1.4, Math.random() * 1.6, (Math.random() - .5) * 1.4], life: 0.7, max: 0.7, color: c, size: 0.08 + Math.random() * 0.1, g: 4, grow: 0.15 }); }

    function update(dt){
      st.time += dt;
      if (st.phase === 'menu') return effects(dt);
      const steps = Math.min(16, Math.max(2, Math.ceil(dt * 120))), h = dt / steps;
      for (let i=0;i<steps;i++) {
        for (const w of worldsOf()) w.step(h);
        for (const s of st.shots) {
          s.lat += s.vlat * h;
          if (s.rest > 0.05 || s.y > TABLE_Y - s.r - 2 && s.x > TX0 && s.x < TX1) s.vlat *= 1 - 3 * h;
          moveShot(s, laneFor(s.lat, s.r));
        }
      }
      while (st.pendingBurst.length) { const s = st.pendingBurst.shift(); if (!s.data.burst) explode(s); }
      // catapult arm
      if (st.armV > 0) { st.arm -= st.armV * dt; st.armV += 60 * dt; if (st.arm <= FIRE) { st.arm = FIRE; st.armV = 0; fire(); st.armBounce = 0.35; } }
      else {
        const target = st.loaded ? REST + (st.aim ? 0.12 : 0) : FIRE + 0.05;
        st.arm += (target - st.arm) * Math.min(1, dt * (st.loaded ? 4 : 6));
      }
      if (st.armBounce) st.armBounce = Math.max(0, st.armBounce - dt);
      if (!st.loaded && st.armV === 0) { st.reload -= dt; if (st.reload <= 0 && st.ammo.length) st.loaded = true; }
      for (const b of st.shots) {
        b.age += dt;
        if (b.data.type === 'triple' && !b.data.split && b.age > 0.14) split(b);
        if (b.data.type === 'fire' && !reduceMotion && Math.random() < 0.7) { const p = shotPos(b); st.parts.push({ p: [p[0], p[1] + 0.1, p[2]], v: [0, 0.8, 0], life: 0.3, max: 0.3, color: [1, 0.6, 0.15], size: 0.12, add: true, g: 0 }); }
        if (b.y > GROUND + 40 || b.x > TX1 + 500 || b.x < -100 || Math.abs(b.lat) > 700 || b.rest > 1.2 || b.dead) b.dead = true;
      }
      for (const b of st.shots.filter(b => b.dead)) (b.lane < 0 ? st.free : st.lanes[b.lane].world).remove(b);
      st.shots = st.shots.filter(b => !b.dead);
      for (const b of st.blocks) {
        const d = b.data;
        if (d.off) { if (b.y > GROUND - b.hh - 4 && !d.landed) { d.landed = true; dust3(W3(b.x, GROUND, st.lanes[d.lane].lat), '#b7a27a', 8); } continue; }
        // A goblin that tumbles down from its perch or gets knocked over is bonked, wherever it lands
        if (d.mat === 'goblin' && (b.y > d.y0 + 16 || Math.abs(b.a - d.a0) > 1.0) && b.y <= TABLE_Y + 6 && b.x >= TX0 - 4 && b.x <= TX1 + 4) {
          d.off = true; d.gone = true; st.knocked++; st.gobs = (st.gobs || 0) + 1; st.score += 500;
          const wp = W3(b.x, b.y, st.lanes[d.lane].lat);
          pop(wp, 'Goblin bonked! +500', '#9cff5a', 1.4); dust3(wp, '#9cff5a', 14);
          st.lanes[d.lane].world.remove(b); if (PB.sfx) PB.sfx('bonk');
          continue;
        }
        if (d.mat !== 'goblin' && b.rest > 1.0 && b.x < AIMD - 40 && (b.y > d.y0 + 8 || Math.abs(b.a - d.a0) > 0.4 || Math.abs(b.x - (d.x0 ?? b.x)) > 20)) {
          d.off = true; d.gone = true; st.knocked++; st.score += 100;
          const wp = W3(b.x, b.y, st.lanes[d.lane].lat);
          pop(wp, 'Crumble! +100', '#ffe08a', 0.9); dust3(wp, '#c9b48a', 14);
          st.lanes[d.lane].world.remove(b); if (PB.sfx) PB.sfx('crash');
          continue;
        }
        if (b.y > TABLE_Y + 6 || b.x < TX0 - 4 || b.x > TX1 + 4) {
          d.off = true; st.knocked++; if (d.mat === 'goblin') st.gobs = (st.gobs || 0) + 1;
          const pts = d.mat === 'goblin' ? 500 : 100 + (d.mat === 'dark' ? 60 : d.mat === 'gray' ? 30 : 0);
          st.score += pts; if (PB.sfx) PB.sfx(d.mat === 'goblin' ? 'bonk' : 'crash'); pop(W3(b.x, Math.min(TABLE_Y - 10, b.y), st.lanes[d.lane].lat), d.mat === 'goblin' ? 'Goblin bonked! +500' : '+' + pts, d.mat === 'goblin' ? '#9cff5a' : '#ffe08a', d.mat === 'goblin' ? 1.4 : 0.9);
        }
      }
      if (!st.over) {
        const left = st.blocks.filter(b => !b.data.off).length, gobs = st.blocks.filter(b => b.data.mat === 'goblin' && !b.data.off).length;
        if (left === 0) { st.over = true; st.endTimer = 1.4; st.win = true; pop(W3(AIMD, TABLE_Y - 140, 0), 'Castle crushed!', '#ffd23f', 1.8); }
        else if (!st.ammo.length && !st.shots.length && st.armV === 0) {
          const calm = st.blocks.every(b => b.data.off || b.rest > 0.6);
          st.settle = calm ? st.settle + dt : 0;
          if (st.settle > 0.8 || st.time - (st.lastFire || 0) > 9) { st.over = true; st.endTimer = 0.4; st.win = false; }
        }
      } else if (st.endTimer != null) {
        st.endTimer -= dt;
        if (st.endTimer <= 0) { st.endTimer = null; finish(); }
      }
      effects(dt);
    }
    function finish(){
      const left = st.ammo.length;
      if (st.win) st.score += left * 500;
      const stars = !st.win ? 0 : left >= 2 ? 3 : left >= 1 ? 2 : 1;
      const total = st.blocks.length;
      if (st.mode === 'daily') { shell.gameOver(st.score, `You knocked off ${st.knocked} of ${total} castle blocks`); return; }
      shell.levelDone({ win: st.win, stars, score: st.score, summary: st.win ? (left ? `${left} stone${left > 1 ? 's' : ''} to spare` : 'Just in time!') : `${total - st.knocked} block${total - st.knocked === 1 ? '' : 's'} still on the table. Try a new spot!` });
    }
    function effects(dt){
      for (const q of st.parts) { q.p[0] += q.v[0]*dt; q.p[1] += q.v[1]*dt; q.p[2] += q.v[2]*dt; q.v[1] -= (q.g ?? 4) * dt; if (q.grow) q.size += q.grow * dt; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.rise += 34 * dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      st.shake = Math.max(0, st.shake - dt * 30);
      if (st.flash) st.flash = Math.max(0, st.flash - dt);
    }

    // ---------- textures ----------
    function cv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function rnd(seed){ return mulberry(seed); }
    function stoneTex(m, seed){
      const c = cv(256, 256), g = c.getContext('2d'), R = rnd(seed);
      const frame = (col, inner) => { g.strokeStyle = col; g.lineWidth = 14; g.strokeRect(7, 7, 242, 242); g.strokeStyle = inner; g.lineWidth = 4; g.strokeRect(17, 17, 222, 222); };
      if (m.look === 'wood') {
        const base = m.base;
        for (let i=0;i<3;i++) { const y = i * 256 / 3; const gr = g.createLinearGradient(0, y, 0, y + 86); gr.addColorStop(0, shade(base, 0.12)); gr.addColorStop(1, shade(base, -0.12)); g.fillStyle = gr; g.fillRect(0, y, 256, 86); g.fillStyle = shade(base, -0.45); g.fillRect(0, y + 82, 256, 4); }
        g.strokeStyle = shade(base, -0.35); g.lineWidth = 3; g.lineCap = 'round';
        for (let k=0;k<9;k++) { const y = 20 + R() * 220, x = R() * 120; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 40, y - 8, x + 80, y + 8, x + 120 + R() * 60, y); g.stroke(); }
        g.fillStyle = shade(base, -0.4); for (let k=0;k<3;k++) { g.beginPath(); g.ellipse(40 + R() * 180, 40 + R() * 180, 9, 5, 0, 0, 7); g.fill(); }
        frame(shade(base, -0.5), 'rgba(255,240,200,.55)');
        g.fillStyle = '#6b6f78'; for (const [x, y] of [[28, 28], [228, 28], [28, 228], [228, 228]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.fillStyle = '#c9ced6'; g.beginPath(); g.arc(x - 2, y - 2, 2, 0, 7); g.fill(); g.fillStyle = '#6b6f78'; }
      } else if (m.look === 'ice') {
        const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#e6fbff'); gr.addColorStop(0.5, '#a9e6ff'); gr.addColorStop(1, '#7fd0f5'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        g.fillStyle = 'rgba(255,255,255,.7)'; for (const [x, w] of [[40, 26], [92, 10], [150, 18]]) { g.beginPath(); g.moveTo(x, 256); g.lineTo(x + w, 256); g.lineTo(x + w + 140, 0); g.lineTo(x + 140, 0); g.closePath(); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1; }
        g.strokeStyle = 'rgba(70,160,210,.5)'; g.lineWidth = 2; for (let k=0;k<4;k++) { let x = 40 + R() * 180, y = 40 + R() * 180; g.beginPath(); g.moveTo(x, y); for (let j=0;j<3;j++) { x += (R() - .5) * 50; y += (R() - .5) * 50; g.lineTo(x, y); } g.stroke(); }
        frame('#3d9fd1', 'rgba(255,255,255,.85)');
      } else {
        g.fillStyle = '#7d828c'; g.fillRect(0, 0, 256, 256);
        for (let r=0;r<4;r++) for (let k=0;k<3;k++) { const x = k * 86 + (r % 2) * 43 - 20, y = r * 64; const col = shade(m.base, (R() - .5) * 0.18);
          g.fillStyle = col; g.beginPath(); g.roundRect(x + 4, y + 4, 78, 56, 16); g.fill();
          g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.roundRect(x + 10, y + 8, 50, 10, 5); g.fill();
          g.strokeStyle = '#4c5058'; g.lineWidth = 3; g.beginPath(); g.roundRect(x + 4, y + 4, 78, 56, 16); g.stroke(); }
        frame('#4c5058', 'rgba(255,255,255,.35)');
      }
      return c;
    }
    function faceTex(base, dark, seed){
      const w = 256, h = 128, c = cv(w, h), g = c.getContext('2d'), R = rnd(seed);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, shade(base, 0.2)); gr.addColorStop(1, shade(base, -0.25)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i=0;i<30;i++) { g.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 6, 0, 7); g.fill(); }
      const cx = w * 0.25, cy = h * 0.5;
      for (const d of [-1, 1]) {
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx + d * 13, cy - 4, 10, 12, 0, 0, 7); g.fill(); g.strokeStyle = '#1a1010'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#1a1010'; g.beginPath(); g.arc(cx + d * 10, cy - 1, 4.5, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + d * 10 - 1.5, cy - 3, 1.5, 0, 7); g.fill();
        g.fillStyle = dark; g.beginPath(); g.moveTo(cx + d * 27, cy - 22); g.lineTo(cx + d * 3, cy - 12); g.lineTo(cx + d * 4, cy - 6); g.lineTo(cx + d * 27, cy - 15); g.closePath(); g.fill();
      }
      g.strokeStyle = '#1a1010'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 9, cy + 18); g.quadraticCurveTo(cx, cy + 11, cx + 9, cy + 18); g.stroke();
      return c;
    }
    function goblinTex(){
      const w = 256, h = 128, c = cv(w, h), g = c.getContext('2d'), R = rnd(77);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b4d66a'); gr.addColorStop(1, '#6f9a2c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i=0;i<24;i++) { g.fillStyle = 'rgba(40,90,20,.25)'; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 4, 0, 7); g.fill(); }
      const cx = w * 0.25, cy = h * 0.52;
      for (const d of [-1, 1]) { g.fillStyle = '#ffe96a'; g.beginPath(); g.arc(cx + d * 17, cy - 8, 9, 0, 7); g.fill(); g.strokeStyle = '#1d3a0d'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#1a1010'; g.beginPath(); g.arc(cx + d * 15, cy - 7, 4, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + d * 14, cy - 9, 1.4, 0, 7); g.fill(); }
      g.fillStyle = '#2b1010'; g.beginPath(); g.moveTo(cx - 16, cy + 18); g.quadraticCurveTo(cx, cy + 34, cx + 16, cy + 18); g.closePath(); g.fill();
      g.fillStyle = '#fff'; for (const d of [-8, 6]) { g.beginPath(); g.moveTo(cx + d, cy + 19); g.lineTo(cx + d + 4, cy + 19); g.lineTo(cx + d + 2, cy + 25); g.fill(); }
      return c;
    }
    function plankTex(){
      const c = cv(512, 256), g = c.getContext('2d'), R = rnd(11);
      for (let y=0;y<256;y+=32) { g.fillStyle = shade('#a8743f', (R() - .5) * 0.18); g.fillRect(0, y, 512, 32);
        g.strokeStyle = 'rgba(80,45,15,.3)'; for (let k=0;k<7;k++) { const yy = y + 3 + R() * 26; g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(170, yy + 3, 340, yy - 3, 512, yy + 1); g.stroke(); }
        g.fillStyle = 'rgba(40,20,5,.55)'; g.fillRect(0, y, 512, 2); const j = R() * 512; g.fillRect(j, y, 2, 32);
        g.fillStyle = 'rgba(255,240,210,.12)'; g.fillRect(0, y + 2, 512, 2); }
      return c;
    }
    function clothTex(c1, trim){
      const c = cv(256, 128), g = c.getContext('2d');
      for (let x=0;x<256;x++) { const f = Math.sin(x / 256 * Math.PI * 12); g.fillStyle = shade(c1, f * 0.18); g.fillRect(x, 0, 1, 128); }
      g.fillStyle = trim; g.fillRect(0, 0, 256, 10); g.fillRect(0, 104, 256, 8);
      g.fillStyle = shade(trim, -0.3); for (let x=0;x<256;x+=8) g.fillRect(x, 112, 3, 16);
      g.fillStyle = trim; for (let x=4;x<256;x+=32) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 8, 52); g.lineTo(x, 64); g.lineTo(x - 8, 52); g.closePath(); g.fill(); }
      return c;
    }
    function stripeTex(a, b, n){ const c = cv(256, 64), g = c.getContext('2d'); for (let i=0;i<n;i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 256 / n, 0, 256 / n + 1, 64); } g.fillStyle = 'rgba(0,0,0,.08)'; for (let i=0;i<n;i++) g.fillRect(i * 256 / n, 0, 3, 64); return c; }
    function valanceTex(a, b){ const c = cv(512, 64), g = c.getContext('2d'); const n = 16, w = 512 / n; for (let i=0;i<n;i++) { g.fillStyle = i % 2 ? b : a; g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w + w, 0); g.lineTo(i * w + w, 30); g.arc(i * w + w / 2, 30, w / 2, 0, Math.PI); g.closePath(); g.fill(); } g.fillStyle = '#e0b43c'; g.fillRect(0, 0, 512, 6); return c; }
    function grassTex(){
      const c = cv(256, 256), g = c.getContext('2d'), R = rnd(5);
      g.fillStyle = '#74c94a'; g.fillRect(0, 0, 256, 256);
      for (let i=0;i<60;i++) { g.fillStyle = `rgba(${R() < .5 ? '40,70,25' : '130,170,80'},.18)`; g.beginPath(); g.arc(R() * 256, R() * 256, 10 + R() * 30, 0, 7); g.fill(); }
      for (let i=0;i<2600;i++) { const x = R() * 256, y = R() * 256; g.strokeStyle = `rgba(${R() < .5 ? '45,80,30' : '150,190,95'},${0.3 + R() * 0.4})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 3, y - 3 - R() * 4); g.stroke(); }
      return c;
    }
    function rockTex(){ const c = cv(128, 64), g = c.getContext('2d'), N = PB.gl3d, id = g.createImageData(128, 64); for (let y=0;y<64;y++) for (let x=0;x<128;x++) { const v = 0.5 + N.fbm(x / 14, y / 14, 1.7, 4) * 0.6; const i = (y * 128 + x) * 4; id.data[i] = v * 150; id.data[i+1] = v * 144; id.data[i+2] = v * 138; id.data[i+3] = 255; } g.putImageData(id, 0, 0); return c; }
    function backdropTex(){
      const w = 2048, h = 512, c = cv(w, h), g = c.getContext('2d'), R = rnd(9);
      const ridge = (base, amp, f, ph, col, alpha) => { g.fillStyle = col; g.globalAlpha = alpha; g.beginPath(); g.moveTo(0, h); for (let x=0;x<=w;x+=8) g.lineTo(x, base - Math.sin(x * f + ph) * amp - Math.sin(x * f * 2.7 + ph * 1.3) * amp * 0.35); g.lineTo(w, h); g.closePath(); g.fill(); g.globalAlpha = 1; };
      ridge(300, 60, 0.0031, 1, '#8fd0ee', 1);
      // distant castle on the ridge
      g.fillStyle = '#6fb0d8'; const cx = 1180, cy = 262;
      g.fillRect(cx - 90, cy - 40, 180, 60);
      for (const [x, ww, hh] of [[-100, 30, 110], [-30, 40, 150], [70, 30, 120]]) { g.fillRect(cx + x, cy - hh + 20, ww, hh); g.beginPath(); g.moveTo(cx + x - 6, cy - hh + 20); g.lineTo(cx + x + ww / 2, cy - hh - 30); g.lineTo(cx + x + ww + 6, cy - hh + 20); g.fill(); }
      for (let x = cx - 90; x < cx + 90; x += 14) g.fillRect(x, cy - 50, 8, 10);
      ridge(350, 40, 0.0052, 3, '#7ccf52', 1);
      for (let i=0;i<70;i++) { const x = R() * w, y = 330 + R() * 50; g.fillStyle = R() < .5 ? '#3fae3a' : '#57c046'; g.beginPath(); g.ellipse(x, y, 14 + R() * 16, 20 + R() * 22, 0, 0, 7); g.fill(); }
      ridge(410, 20, 0.008, 5, '#6cc443', 1);
      for (let i=0;i<40;i++) { const x = R() * w, y = 400 + R() * 30; g.fillStyle = '#2f9a34'; g.beginPath(); g.ellipse(x, y, 20 + R() * 20, 26 + R() * 18, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(x - 6, y - 10, 10, 10, 0, 0, 7); g.fill(); }
      g.fillStyle = '#74c94a'; g.fillRect(0, 440, w, 72);
      return c;
    }
    function cloudTex(){ const c = cv(256, 128), g = c.getContext('2d'), R = rnd(3); for (let i=0;i<22;i++) { const x = 40 + R() * 176, y = 50 + R() * 40, r = 16 + R() * 28; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } return c; }

    // ---------- meshes ----------
    function loadAssets(){
      if (A) return A;
      E = PB.gl3d.get(); if (!E) return null;
      const Gm = E.G, M = E.M, T = (g, t, r, s) => Gm.transform(g, M.trs(t, r || [0,0,0], s || [1,1,1]));
      A = { cache: new Map() };
      A.tStone = {}; for (const k of Object.keys(MAT)) if (k !== 'goblin') A.tStone[k] = E.texture(stoneTex(MAT[k], k.length * 7));
      A.tGoblin = E.texture(goblinTex()); A.tFace = { stone: E.texture(faceTex('#a7a39d', '#3a2a20', 1)), triple: E.texture(faceTex('#d9a86a', '#5a3010', 2)), iron: E.texture(faceTex('#4a4e58', '#111', 3)), fire: E.texture(faceTex('#ff6a2a', '#5a1000', 4)) };
      A.tPlank = E.texture(plankTex()); A.tCloth = E.texture(clothTex('#8e1f1a', '#e0b43c'));
      A.tGrass = E.texture(grassTex()); A.tRock = E.texture(rockTex());
      A.tAwning = E.texture(stripeTex('#c62f26', '#f6efe2', 12)); A.tValance = E.texture(valanceTex('#c62f26', '#f6efe2'));
      A.tents = [['#2b56b0', '#f2c94c'], ['#2e7d32', '#f5e6c8'], ['#7b2d8f', '#f6efe2'], ['#c62f26', '#ffffff'], ['#d9831f', '#fff1cc']].map(([a, b]) => E.texture(stripeTex(a, b, 10)));
      A.tBack = E.texture(backdropTex(), { repeat: false }); A.tCloud = E.texture(cloudTex(), { repeat: false });
      A.box = E.mesh(Gm.roundBox(1, 1, 1, 0.12, 3)); A.flat = E.mesh(Gm.box(1, 1, 1)); A.sphere = E.mesh(Gm.sphere(1, 24, 16)); A.cyl = E.mesh(Gm.cylinder(0.5, 0.5, 1, 20)); A.cone = E.mesh(Gm.cylinder(0, 0.5, 1, 20, true));
      A.wheel = E.mesh(T(Gm.torus(1, 0.18, 24, 8), [0, 0, 0], [0, 0, Math.PI / 2]));
      A.spokes = E.mesh(Gm.merge([0, 1, 2, 3].map(i => T(Gm.box(0.08, 1.9, 0.1), [0, 0, 0], [i * Math.PI / 4, 0, 0]))));
      A.cup = E.mesh(Gm.cylinder(0.5, 0.32, 0.4, 16, false));
      A.ground = E.mesh(Gm.plane(1, 1, 40, 40));
      A.quad = E.mesh(Gm.quad(1, 1));
      A.flag = E.mesh(Gm.extrude([[0, 0], [1, -0.32], [0, -0.64]], 0.02));
      A.pennant = E.mesh(Gm.extrude([[-0.5, 0], [0.5, 0], [0, -1.2]], 0.02));
      A.tentBody = E.mesh(Gm.cylinder(1, 1, 1, 24, false)); A.tentRoof = E.mesh(Gm.cylinder(0, 1.12, 1, 24, true));
      A.barrel = E.mesh(Gm.displace(Gm.cylinder(0.5, 0.5, 1.2, 20, true), (x, y) => 0.12 * Math.cos(y * 2.4)));
      return A;
    }
    // A block's stone body plus the bits that sit on top when nothing is stacked on it.
    function blockMeshes(d){
      const key = `${d.type}|${d.w}|${d.h}|${d.lat}`;
      if (A.cache.has(key)) return A.cache.get(key);
      const Gm = E.G, M = E.M, T = (g, t, r, s) => Gm.transform(g, M.trs(t, r || [0,0,0], s || [1,1,1]));
      const w = d.w * S, h = d.h * S, l = d.lat * 2 * S, out = {};
      if (d.type === 'tower') {
        const r = d.w / 2 * S;
        out.body = E.mesh(Gm.cylinder(r, r, h, 24, true)); out.uv = [3, 1];
        const merl = []; for (let i=0;i<8;i++) { const a = i / 8 * Math.PI * 2; merl.push(T(Gm.roundBox(0.055, 0.07, 0.045, 0.015, 2), [Math.cos(a) * r * 0.92, h / 2 + 0.03, Math.sin(a) * r * 0.92], [0, -a + Math.PI / 2, 0])); }
        out.crown = E.mesh(Gm.merge([T(Gm.torus(r * 1.0, 0.022, 24, 8), [0, h / 2 + 0.01, 0]), T(Gm.cylinder(r * 1.02, r * 1.02, 0.03, 24, true), [0, h / 2 + 0.005, 0]), ...merl]));
        out.roofY = h / 2; out.roofR = r * 1.15;
        out.detail = E.mesh(Gm.merge([T(Gm.box(0.022, Math.min(0.12, h * 0.3), 0.01), [0, h * 0.08, r + 0.003]), T(Gm.box(0.022, Math.min(0.12, h * 0.3), 0.01), [r * 0.7, h * 0.08, r * 0.7 + 0.003], [0, Math.PI / 4, 0])]));
      } else {
        out.body = E.mesh(Gm.roundBox(l, h, w, Math.min(0.04, Math.min(l, h, w) * 0.22), 5)); out.uv = [1, 1];
        const merl = [], m = 0.06, step = 0.12;
        const edge = (len, f) => { const n = Math.max(2, Math.round(len / step)); for (let i=0;i<n;i++) { const t = (i + 0.5) / n - 0.5; merl.push(f(t * len)); } };
        edge(l, t => T(Gm.roundBox(m, 0.07, 0.05, 0.015, 2), [t, h / 2 + 0.03, w / 2 - 0.025]));
        edge(l, t => T(Gm.roundBox(m, 0.07, 0.05, 0.015, 2), [t, h / 2 + 0.03, -w / 2 + 0.025]));
        edge(w - 0.1, t => T(Gm.roundBox(0.05, 0.07, m, 0.015, 2), [l / 2 - 0.025, h / 2 + 0.03, t]));
        edge(w - 0.1, t => T(Gm.roundBox(0.05, 0.07, m, 0.015, 2), [-l / 2 + 0.025, h / 2 + 0.03, t]));
        out.crown = E.mesh(Gm.merge(merl));
        if (d.type === 'keep') {
          const dw = Math.min(l * 0.36, 0.13), dh = Math.min(h * 0.5, 0.16), doorShape = [[-dw / 2, 0], [dw / 2, 0]];
          for (let i=0;i<=10;i++) { const a = i / 10 * Math.PI; doorShape.push([Math.cos(a) * dw / 2, dh - dw / 2 + Math.sin(a) * dw / 2]); }
          out.detail = E.mesh(Gm.merge([T(Gm.extrude(doorShape, 0.01), [0, -h / 2, w / 2 + 0.002]), T(Gm.extrude(doorShape, 0.01), [0, -h / 2, -w / 2 - 0.002])]));
        } else {
          const n = Math.max(1, Math.round(l / 0.2)), sl = [];
          for (let i=0;i<n;i++) sl.push(T(Gm.box(0.02, h * 0.42, 0.01), [((i + 0.5) / n - 0.5) * l, 0, w / 2 + 0.002]));
          out.detail = E.mesh(Gm.merge(sl));
        }
      }
      A.cache.set(key, out);
      return out;
    }

    // ---------- rendering ----------
    function covered(b){
      const d = b.data; if (d.off) return false;
      const top = b.y - b.hh;
      for (const o of st.blocks) { if (o === b || o.data.lane !== d.lane || o.data.off) continue; if (Math.abs(o.x - b.x) < (o.hw + b.hw) * 0.7 && Math.abs((o.y + o.hh) - top) < 8) return true; }
      return false;
    }
    function drawCatapult(M){
      const wood = { tex: A.tPlank, color: [0.8, 0.6, 0.42], spec: 0.15, uvScale: [0.6, 0.3] }, dark = { tex: A.tPlank, color: [0.5, 0.36, 0.24], spec: 0.15, uvScale: [0.6, 0.3] };
      const baseY = COUNTER_Y - 4;
      const P = (d, y, l) => W3(d, y, l);
      for (const l of [-24, 24]) { const mm = M.trs(P(185, baseY - 8, l), [0, 0, 0], [0.09, 0.09, 1.1]); E.draw(A.box, mm, wood); E.draw(A.box, mm, OUTLINE); }
      for (const d of [138, 185, 228]) E.draw(A.box, M.trs(P(d, baseY - 8, 0), [0, 0, 0], [0.56, 0.07, 0.08]), dark);
      for (const l of [-34, 34]) for (const d of [142, 226]) {
        const m = M.trs(P(d, baseY - 4, l), [st.time * 0 , 0, 0], [0.16, 0.16, 0.16]);
        E.draw(A.wheel, m, { color: [0.35, 0.24, 0.15], spec: 0.2 }); E.draw(A.spokes, m, { color: [0.45, 0.31, 0.2] });
        E.draw(A.cyl, M.trs(P(d, baseY - 4, l), [0, 0, Math.PI / 2], [0.05, 0.03, 0.05]), { color: [0.5, 0.5, 0.55], spec: 0.8 });
      }
      for (const l of [-24, 24]) {
        E.draw(A.box, M.trs(P(PIV.d, (baseY + PIV.y) / 2 - 6, l), [0, 0, 0], [0.08, (baseY - PIV.y) * S + 0.14, 0.08]), wood);
        E.draw(A.box, M.trs(P(PIV.d - 28, (baseY + PIV.y) / 2 - 2, l), [-0.75, 0, 0], [0.06, 0.62, 0.06]), dark);
      }
      E.draw(A.cyl, M.trs(P(PIV.d, PIV.y, 0), [0, 0, Math.PI / 2], [0.08, 0.5, 0.08]), { color: [0.45, 0.45, 0.5], spec: 0.8 });
      for (const l of [-14, 14]) E.draw(A.cyl, M.trs(P(PIV.d, PIV.y, l), [0, 0, Math.PI / 2], [0.13, 0.1, 0.13]), { color: [0.5, 0.36, 0.22], spec: 0.05 });
      const phi = st.arm + (st.armBounce ? Math.sin(st.armBounce * 30) * st.armBounce * 0.2 : 0);
      const dir = [0, Math.sin(phi), -Math.cos(phi)], piv = P(PIV.d, PIV.y, 0);
      const mid = [piv[0] + dir[0] * ARM * S / 2, piv[1] + dir[1] * ARM * S / 2, piv[2] + dir[2] * ARM * S / 2];
      E.draw(A.box, M.trs(mid, [phi, 0, 0], [0.07, 0.07, ARM * S + 0.06]), OUTLINE);
      E.draw(A.box, M.trs(mid, [phi, 0, 0], [0.07, 0.07, ARM * S + 0.06]), { tex: A.tPlank, color: [0.85, 0.64, 0.44], spec: 0.2, uvScale: [1, 0.2] });
      const tip = [piv[0] + dir[0] * ARM * S, piv[1] + dir[1] * ARM * S, piv[2] + dir[2] * ARM * S];
      const up = [0, -Math.cos(phi), -Math.sin(phi)];
      const cupC = [tip[0] + up[0] * 0.05, tip[1] + up[1] * 0.05, tip[2] + up[2] * 0.05];
      E.draw(A.cup, M.trs(cupC, [phi + Math.PI, 0, 0], [0.27, 0.27, 0.27]), { color: [0.62, 0.4, 0.22], spec: 0.2, doubleSided: true });
      E.draw(A.cyl, M.trs([cupC[0] - up[0] * 0.06, cupC[1] - up[1] * 0.06, cupC[2] - up[2] * 0.06], [phi + Math.PI, 0, 0], [0.18, 0.02, 0.18]), { color: [0.35, 0.23, 0.14] });
      for (const l of [-0.05, 0.05]) E.draw(A.box, M.trs([tip[0] + l, tip[1] - up[1] * 0.0, tip[2]], [phi, 0, 0], [0.012, 0.012, 0.16]), { color: [0.55, 0.55, 0.6], spec: 0.8 });
      if (st.loaded && st.ammo.length && st.armV === 0 || st.armV > 0) {
        const type = st.ammo[0]; if (type) drawBall([cupC[0] + up[0] * 0.08, cupC[1] + up[1] * 0.08, cupC[2] + up[2] * 0.08], type, AMMO[type].r * S, 0);
      }
    }
    function drawBall(p, type, r, rot){
      const M = E.M;
      const fm = M.trs(p, [-rot, 0, 0], r);
      E.draw(A.sphere, fm, { tex: A.tFace[type], color: [1, 1, 1], spec: type === 'iron' ? 1.2 : 0.35, shine: type === 'iron' ? 70 : 24 });
      E.draw(A.sphere, fm, OUTLINE);
      if (type === 'fire') {
        E.draw(A.cyl, M.trs([p[0], p[1] + r * 0.9, p[2]], [0, 0, 0], [r * 0.9, r * 0.5, r * 0.9]), { color: [0.45, 0.22, 0.12] });
        E.sprite([p[0], p[1] + r * 1.5, p[2]], r * 3.2, [1, 0.6, 0.15], 0.9, true); E.sprite([p[0], p[1] + r * 1.3, p[2]], r * 1.6, [1, 0.95, 0.6], 0.9, true);
        E.light([p[0], p[1] + r * 2, p[2]], [2.5, 1.2, 0.3], 1.4);
      }
    }
    function drawGoblin(b, p){
      const M = E.M, d = b.data, s = d.w * S, m = M.trs(p, [-b.a, 0, 0], [1, 1, 1]);
      const bm = M.mul(m, M.trs([0, -s * 0.02, 0], [0, 0, 0], [s * 0.56, s * 0.5, s * 0.52]));
      E.draw(A.sphere, bm, { tex: A.tGoblin, color: [1, 1, 1], spec: 0.35, shine: 30 }); E.draw(A.sphere, bm, OUTLINE);
      const hm = M.mul(m, M.trs([0, s * 0.2, -0.004], [0, 0, 0], [s * 0.56, s * 0.32, s * 0.55]));
      E.draw(A.sphere, hm, { color: [0.55, 0.58, 0.66], spec: 0.9, shine: 60 }); E.draw(A.sphere, hm, OUTLINE);
      const rim = M.mul(m, M.trs([0, s * 0.12, -0.004], [0, 0, 0], [s * 1.18, s * 0.05, s * 1.12])); E.draw(A.cyl, rim, { color: [0.45, 0.48, 0.55], spec: 0.8 }); E.draw(A.cyl, rim, OUTLINE);
      const nm = M.mul(m, M.trs([0, -s * 0.06, s * 0.55], [Math.PI / 2 + 0.3, 0, 0], [s * 0.16, s * 0.3, s * 0.16])); E.draw(A.cone, nm, { color: hex('#8fb84a'), spec: 0.3 }); E.draw(A.cone, nm, OUTLINE);
      const pl = M.mul(m, M.trs([0, s * 0.56, 0], [0, 0, 0], [s * 0.12, s * 0.22, s * 0.12])); E.draw(A.cone, pl, { color: hex('#e8463a'), spec: 0.5 }); E.draw(A.cone, pl, OUTLINE);
      for (const sd of [-1, 1]) { const em = M.mul(m, M.trs([sd * s * 0.68, s * 0.02, 0], [0, 0, sd * -1.3], [s * 0.2, s * 0.42, s * 0.08])); E.draw(A.cone, em, { color: hex('#9cc456'), spec: 0.3 }); E.draw(A.cone, em, OUTLINE); }
    }
    function scenery(M){
      E.draw(A.ground, M.trs([0, 0, -10], [0, 0, 0], [80, 1, 80]), { tex: A.tGrass, color: [0.9, 0.95, 0.85], spec: 0.05, uvScale: [1, 1] });
      E.draw(A.quad, M.trs([0, 8.5, -60], [0, 0, 0], [140, 35, 1]), { tex: A.tBack, unlit: true, color: [0.98, 1, 1], blend: true, fogless: true, noShadow: true });
      // dirt patch under the table
      E.draw(A.flat, M.trs(W3(AIMD, GROUND, 0), [0, 0, 0], [5.5, 0.01, 4.2]), { color: [0.62, 0.5, 0.34], spec: 0.05, noShadow: true });
      // table
      const tw = 3.1, td = (TX1 - TX0 + 14) * S, tc = W3((TX0 + TX1) / 2, TABLE_Y + 10, 0);
      E.draw(A.flat, M.trs(tc, [0, 0, 0], [tw, 0.2, td]), { tex: A.tPlank, color: [1, 0.95, 0.9], spec: 0.25, shine: 30, uvScale: [3.2, 2.6] });
      const drop = 0.62;
      E.draw(A.flat, M.trs([0, tc[1] - 0.1 - drop / 2, tc[2] + td / 2 + 0.01], [0, 0, 0], [tw + 0.04, drop, 0.02]), { tex: A.tCloth, color: [1, 1, 1], spec: 0.1, uvScale: [3, 1] });
      for (const s of [-1, 1]) E.draw(A.flat, M.trs([s * (tw / 2 + 0.01), tc[1] - 0.1 - drop / 2, tc[2]], [0, 0, 0], [0.02, drop, td]), { tex: A.tCloth, color: [1, 1, 1], spec: 0.1, uvScale: [2, 1] });
      for (const s of [-1, 1]) E.draw(A.flat, M.trs([s * (tw / 2 - 0.12), tc[1] - 0.5, tc[2] - td / 2 + 0.12], [0, 0, 0], [0.1, 0.8, 0.1]), { color: [0.4, 0.27, 0.15] });
      // counter in front of the player
      const cc = W3(150, COUNTER_Y + 8, 0);
      E.draw(A.flat, M.trs(cc, [0, 0, 0], [2.6, 0.16, 1.5]), { tex: A.tPlank, color: [0.85, 0.75, 0.65], spec: 0.2, uvScale: [1.2, 0.8] });
      E.draw(A.flat, M.trs([0, cc[1] - 0.45, cc[2] - 0.74], [0, 0, 0], [2.6, 0.8, 0.04]), { tex: A.tCloth, color: [0.9, 0.9, 1], uvScale: [3, 1] });
      // awning overhead
      const aw = W3(40, TABLE_Y - 250, 0);
      E.draw(A.flat, M.trs([0, aw[1], aw[2] + 0.3], [-0.32, 0, 0], [4.6, 0.03, 2.4]), { tex: A.tAwning, color: [1, 1, 1], spec: 0.05, uvScale: [5, 1], noShadow: true });
      E.draw(A.quad, M.trs([0, aw[1] - 0.52, aw[2] - 0.8], [0, 0, 0], [4.6, 0.4, 1]), { tex: A.tValance, color: [1, 1, 1], spec: 0.05, uvScale: [3, 1], doubleSided: true, noShadow: true });
      for (const s of [-1, 1]) E.draw(A.cyl, M.trs([s * 2.2, 1.4, aw[2] - 0.8], [0, 0, 0], [0.12, 2.8, 0.12]), { color: [0.55, 0.38, 0.22], noShadow: true });
      // tents and props on the fairground
      const tents = [[-7, -13, 2.2, 0], [7.5, -15, 2.6, 1], [-14, -22, 3, 2], [15, -24, 3.2, 3], [1.5, -26, 2.8, 4], [-3.5, -34, 3, 1], [9, -36, 2.4, 2]];
      for (const [x, z, r, t] of tents) {
        E.draw(A.tentBody, M.trs([x, r * 0.55, z], [0, 0.3, 0], [r, r * 1.1, r]), { tex: A.tents[t], color: [1, 1, 1], spec: 0.05, uvScale: [3, 1], doubleSided: true });
        E.draw(A.tentRoof, M.trs([x, r * 1.1 + r * 0.45, z], [0, 0.3, 0], [r, r * 0.9, r]), { tex: A.tents[t], color: [1, 1, 1], spec: 0.05, uvScale: [3, 1] });
        E.draw(A.cyl, M.trs([x, r * 2.15, z], [0, 0, 0], [0.04, 0.6, 0.04]), { color: [0.4, 0.3, 0.2] });
        E.draw(A.flag, M.trs([x, r * 2.42, z], [0, Math.sin(st.time * 2 + x) * 0.3, 0], [0.5, 0.5, 0.5]), { color: hex(BANNERS[t % 5]), doubleSided: true });
      }
      for (const [x, z] of [[-2.2, -5.4], [2.4, -5.9], [-2.6, -6.4]]) E.draw(A.barrel, M.trs([x, 0.33, z], [0, x, 0], [0.32, 0.55, 0.32]), { tex: A.tPlank, color: [0.75, 0.55, 0.38], uvScale: [1, 1] });
      for (const [x, z] of [[2.5, -3.2], [-2.7, -3.0]]) E.draw(A.flat, M.trs([x, 0.22, z], [0, 0.2 * x, 0], [0.9, 0.44, 0.5]), { color: [0.85, 0.72, 0.38], spec: 0.05 });
      // bunting across the fair
      const by = W3(0, TABLE_Y - 230, 0)[1], bz = W3(TX1 + 90, 0, 0)[2];
      for (const s of [-1, 1]) E.draw(A.cyl, M.trs([s * 2.6, by / 2, bz], [0, 0, 0], [0.08, by + 0.2, 0.08]), { color: [0.5, 0.35, 0.2] });
      for (let i=0;i<=26;i++) { const t = i / 26, x = -2.6 + t * 5.2, y = by - Math.sin(t * Math.PI) * 0.45;
        if (i < 26) E.draw(A.flat, M.trs([x + 0.1, y - 0.01, bz], [0, 0, 0], [0.2, 0.01, 0.01]), { color: [0.3, 0.2, 0.1], noShadow: true });
        E.draw(A.pennant, M.trs([x, y, bz], [0, 0, Math.sin(st.time * 3 + i) * 0.08], [0.13, 0.17, 1]), { color: hex(BANNERS[i % 5]), doubleSided: true, spec: 0.1, noShadow: true }); }
      // clouds
      for (const [x, y, z, s] of [[-30, 22, -70, 26], [18, 26, -75, 30], [45, 18, -68, 22], [-60, 16, -70, 24]]) E.sprite([x + Math.sin(st.time * 0.02) * 2, y, z], s, [1, 1, 1], 0.85, false, 0, A.tCloud);
    }
    function render(w, h, snapshot){
      const M = E.M;
      const shake = st.shake > 0 && !reduceMotion ? [(Math.random() - .5) * st.shake * 0.002, (Math.random() - .5) * st.shake * 0.002] : [0, 0];
      const eye = W3(-50, TABLE_Y - 150, 0), look = W3(AIMD + 10, TABLE_Y - 40, 0);
      E.begin({ pos: [eye[0] + shake[0], eye[1] + shake[1], eye[2]], target: snapshot ? W3(AIMD, TABLE_Y - 40, 0) : look, fov: snapshot ? 0.62 : 0.86, near: 0.05, far: 200 }, {
        sunDir: [-0.4, -0.75, -0.5], sunColor: [3.0, 2.8, 2.4], ambSky: [0.55, 0.68, 0.9], ambGround: [0.4, 0.45, 0.3], toon: 0.8,
        fogColor: [0.72, 0.9, 1.0], fogDensity: 0.008, fogStart: 14,
        shadow: { center: W3(AIMD - 40, TABLE_Y, 0), radius: 3.4 },
        sky: { zenith: [0.12, 0.5, 1.0], horizon: [0.68, 0.92, 1.0], ground: [0.5, 0.6, 0.4], sunColor: [1, 0.95, 0.85], sunSize: 1 },
      });
      scenery(M);
      for (const b of st.blocks) {
        const d = b.data; if (d.gone || d.off && b.y > GROUND + 200) continue;
        const L = st.lanes[d.lane], p = W3(b.x, b.y, L.lat);
        if (d.mat === 'goblin') { drawGoblin(b, p); continue; }
        const mm = blockMeshes(d), m = M.trs(p, [-b.a, 0, 0], [1, 1, 1]);
        E.draw(mm.body, m, { tex: A.tStone[d.mat], color: [1, 1, 1], spec: d.mat === 'gray' ? 1.2 : d.mat === 'dark' ? 0.3 : 0.15, shine: d.mat === 'gray' ? 80 : 24, uvScale: mm.uv });
        E.draw(mm.body, m, OUTLINE);
        E.draw(mm.detail, m, { color: [0.12, 0.08, 0.06], spec: 0.1 });
        if (!covered(b)) {
          if (d.type === 'tower') {
            const rm = M.mul(m, M.trs([0, mm.roofY + 0.12, 0], [0, 0, 0], [mm.roofR * 2, 0.24, mm.roofR * 2])); E.draw(A.cone, rm, { color: hex(d.roof), spec: 0.6, shine: 40 }); E.draw(A.cone, rm, OUTLINE);
          } else { E.draw(mm.crown, m, { tex: A.tStone[d.mat], color: [1, 1, 1], spec: 0.18 }); E.draw(mm.crown, m, OUTLINE); }
          if (d.flag && !d.off) {
            const topY = d.type === 'tower' ? mm.roofY + 0.24 : d.h / 2 * S + 0.06;
            E.draw(A.cyl, M.mul(m, M.trs([0, topY + 0.1, 0], [0, 0, 0], [0.012, 0.22, 0.012])), { color: [0.3, 0.2, 0.12] });
            E.draw(A.flag, M.mul(m, M.trs([0, topY + 0.2, 0], [0, -0.4 + Math.sin(st.time * 5 + b.id) * 0.25, 0], [0.13, 0.13, 0.13])), { color: hex(d.flag), doubleSided: true, spec: 0.2 });
          }
        }
      }
      drawCatapult(M);
      for (const s of st.shots) drawBall(shotPos(s), s.data.type, s.r * S, s.a);
      // aim guide: predicted arc
      if (st.aim && st.loaded && !snapshot) {
        const T = FLIGHT, vx = (AIMD - LAUNCH.d) / T, vy = (st.target.y - LAUNCH.y - 0.5 * G * T * T) / T, vl = st.target.lat / T;
        for (let i=1;i<=14;i++) { const t = i / 14 * T; E.sprite(W3(LAUNCH.d + vx * t, LAUNCH.y + vy * t + 0.5 * G * t * t, vl * t), 0.05, [1, 0.97, 0.85], 0.95, true); }
      }
      for (const q of st.parts) E.sprite(q.p, q.size, q.color, Math.min(1, q.life / q.max * 1.6) * (q.add ? 1 : 0.8), !!q.add);
      E.end();
    }
    function drawBall2D(g, x, y, type, r){
      const Am = AMMO[type];
      const gr = g.createRadialGradient(x - r*0.35, y - r*0.35, 1, x, y, r);
      gr.addColorStop(0, shade(Am.color, 0.45)); gr.addColorStop(1, shade(Am.color, -0.4));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (type === 'fire') { g.fillStyle = '#ffd04a'; g.beginPath(); g.moveTo(x - 4, y - r + 1); g.quadraticCurveTo(x, y - r - 9, x + 4, y - r + 1); g.fill(); }
      if (type === 'triple') { g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `800 ${Math.round(r)}px ${BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('3', x, y + 1); }
      if (type === 'iron') { g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r * 0.65, -2.4, -1.2); g.stroke(); }
    }
    function drawHUD(){
      if (st.flash) { ctx.fillStyle = `rgba(255,200,120,${st.flash})`; ctx.fillRect(0, 0, W, H); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(40,24,10,.6)'; ctx.beginPath(); ctx.roundRect(12, 12, 216, 62, 12); ctx.fill();
      ctx.fillStyle = '#ffe9b8'; ctx.font = `24px ${FONT}`;
      ctx.fillText(st.mode === 'daily' ? 'Daily Siege' : `Level ${st.spec.n}`, 24, 40);
      const left = st.blocks.filter(b => !b.data.off).length;
      ctx.font = `700 13px ${BODY}`; ctx.fillStyle = '#fff3d6';
      ctx.fillText(`${left} castle block${left === 1 ? '' : 's'} on the table`, 24, 62);
      ctx.fillStyle = 'rgba(40,24,10,.6)'; ctx.beginPath(); ctx.roundRect(12, H - 52, Math.max(120, 34 + st.ammo.length * 30), 40, 12); ctx.fill();
      st.ammo.forEach((t, i) => drawBall2D(ctx, 32 + i * 30, H - 32, t, i === 0 ? 11 : 9));
      if (!st.ammo.length) { ctx.fillStyle = '#fff3d6'; ctx.font = `700 13px ${BODY}`; ctx.fillText('No stones left', 24, H - 27); }
      // reticle
      if (st.phase === 'play' && st.loaded && st.ammo.length && !st.over) {
        const sp = E.project(W3(AIMD, st.target.y, st.target.lat)), a = st.aim ? 1 : 0.55 + Math.sin(st.time * 4) * 0.2;
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(sp[0], sp[1], 16, 0, 7); ctx.stroke();
        ctx.beginPath(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { ctx.moveTo(sp[0] + dx * 9, sp[1] + dy * 9); ctx.lineTo(sp[0] + dx * 24, sp[1] + dy * 24); } ctx.stroke();
        ctx.fillStyle = '#ff5a3c'; ctx.beginPath(); ctx.arc(sp[0], sp[1], 3.5, 0, 7); ctx.fill();
        ctx.restore();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) {
        const sp = E.project(q.p);
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = `26px ${FONT}`;
        ctx.lineWidth = 5; ctx.strokeStyle = '#3d2814'; ctx.lineJoin = 'round'; ctx.strokeText(q.text, sp[0], sp[1] - q.rise);
        ctx.fillStyle = q.color; ctx.fillText(q.text, sp[0], sp[1] - q.rise); ctx.restore();
      }
      if (st.phase === 'play' && st.time < 4 && !st.lastFire && !st.aim) {
        ctx.save(); ctx.globalAlpha = Math.min(1, (4 - st.time)); ctx.font = `700 15px ${BODY}`;
        const msg = 'Touch a castle to aim, let go to fire!'; const tw = ctx.measureText(msg).width + 32;
        ctx.fillStyle = 'rgba(40,24,10,.78)'; ctx.beginPath(); ctx.roundRect(W/2 - tw/2, 96, tw, 38, 19); ctx.fill();
        ctx.fillStyle = '#fff3d6'; ctx.fillText(msg, W/2, 116);
        ctx.restore();
      }
    }
    function draw(){
      if (!loadAssets()) { ctx.fillStyle = '#2a1a0c'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '700 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('This game needs a device with 3D graphics.', W/2, H/2); return; }
      E.resize(W, H, Math.min(dpr, 1.75)); render(W, H);
      E.present(ctx, W, H);
      drawHUD();
    }
    function artTile(g){
      if (!loadAssets()) { g.fillStyle = '#6fa8dc'; g.fillRect(0, 0, 240, 180); return; }
      const keep = st; fresh('classic', 30); st.phase = 'menu';
      E.resize(240, 180, 2); render(240, 180, true);
      g.drawImage(E.canvas, 0, 0, 240, 180);
      st = keep;
    }
    function aimAt(x, y){
      const a = E.unproject(x, y, -1), b = E.unproject(x, y, 1), z = W3(AIMD, 0, 0)[2];
      const t = (z - a[2]) / (b[2] - a[2]); if (!(t > 0)) return;
      const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      st.target = { lat: Math.max(-170, Math.min(170, px / S)), y: Math.max(TABLE_Y - 230, Math.min(TABLE_Y - 4, GROUND - py / S)) };
    }

    return {
      id:'castle', sfxScore:false, music:'castle', title:'CASTLE CRASH', W, H, statLabel:'Stones', type:'levels', levels:100, maxLives:0,
      failTitle:'Out of stones', dailyText:'One giant fortress a day', powersTitle:'Catapult ammo',
      tile:{ order:7, name:'Castle Crash', kind:'Medieval catapult \u00b7 100 levels', art: artTile, isNew: true },
      controls: ['Touch the castle you want to hit. Drag to move the target.', 'Let go to fire the catapult at the target.', 'Knock every block off the table to win. Blocks that tumble to the front edge crumble away.', 'Stones you have left at the end are worth bonus points and stars.', 'Bonk the goblins in helmets for big bonus points!', 'Wood is light, ice is medium, stone is heavy.'],
      powers: Object.entries(AMMO).map(([k]) => ({ name: AMMO[k].name, desc: AMMO[k].desc, icon: g => drawBall2D(g, 23, 14, k, 11) })),
      init(){ loadAssets(); },
      preview(){ fresh('classic', 1); st.phase = 'menu'; },
      start(mode, rand, lives, msg, level){ fresh(mode, level === 'daily' ? 1 : level); },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: null, stat: st.ammo.length, score: st.score }; },
      metrics(){ return { score: st.score, blocks: st.knocked - (st.gobs || 0), goblins: st.gobs || 0, left: st.over && st.win ? st.ammo.length : 0, won: st.over && st.win ? 1 : 0 }; },
      dailyGoals: [
        { text:'Knock {n} blocks off the table', m:'blocks', n:[14, 18, 22] },
        { text:'Crush the whole castle with {n} stones to spare', m:'left', n:[1, 2] },
        { text:'Bonk {n} goblins', m:'goblins', n:[3, 4] },
      ],
      pointerDown(x, y){
        if (st.over || !E) return;
        const tri = st.shots.find(s => s.data.type === 'triple' && !s.data.split);
        if (tri) { split(tri); return; }
        if (!st.loaded || !st.ammo.length || st.armV > 0) return;
        st.aim = true; aimAt(x, y);
      },
      pointerMove(x, y){ if (st.aim) aimAt(x, y); },
      pointerUp(x, y){
        if (!st.aim) return;
        aimAt(x, y); st.aim = null;
        if (st.loaded && st.ammo.length) { st.armV = 9; st.loaded = false; }
      },
      debug(){ return { st, fire(lat, y){ st.target = { lat, y }; st.armV = 9; st.loaded = false; } }; },
      key(e){
        if (!st || st.over) return;
        const m = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
        if (m) { e.preventDefault(); st.target.lat = Math.max(-170, Math.min(170, st.target.lat + m[0])); st.target.y = Math.max(TABLE_Y - 230, Math.min(TABLE_Y - 4, st.target.y + m[1])); }
        if ((e.key === ' ' || e.key === 'Enter') && st.loaded && st.ammo.length && st.armV === 0) { e.preventDefault(); st.armV = 9; st.loaded = false; }
      },
    };
  }
  PB.register(createCastle);
})();
