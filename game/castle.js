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
    const LAUNCH = { d: 203, y: COUNTER_Y - 96 };
    const FONT = '"MedievalSharp", "Georgia", serif';
    const BODY = '"Nunito", "Segoe UI", sans-serif';
    // Blocks are heavy and tough now: a hit has to be hard enough to crack them, and they only count once they
    // are smashed to pieces or fall off the table. hp = how much smashing a block can take.
    const MAT = {
      sand: { d: 1.7, hp: 95,  base: '#d99c52', name:'Wood', look:'wood' },
      gray: { d: 2.6, hp: 150, base: '#a9e6ff', name:'Ice', look:'ice' },
      dark: { d: 4.2, hp: 270, base: '#b9bec8', name:'Stone', look:'stone' },
      wood: { d: 1.1, hp: 75,  base: '#d98f4a', name:'Oak', look:'wood' },
      goblin: { d: 1.0, hp: 115, base: '#7ccf4a', name:'Goblin', look:'goblin' },
    };
    const AMMO = {
      stone:  { name:'Stone',       r: 12, d: 11, hit: 1.15, color:'#8d8a86', desc:'A trusty round rock. Good all-rounder' },
      triple: { name:'Triple shot', r: 9,  d: 11, hit: 0.8, color:'#a3876a', desc:'Splits into three stones (tap again to split early)' },
      iron:   { name:'Iron ball',   r: 14, d: 26, hit: 2.7, color:'#3d4048', desc:'Very heavy. Cracks stone and smashes walls' },
      fire:   { name:'Fire pot',    r: 12, d: 6,  hit: 0.6, color:'#e8641c', desc:'Explodes and blasts everything nearby' },
      boulder:{ name:'Boulder',     r: 20, d: 10, hit: 1.9, color:'#9a8f80', desc:'A huge rock that rolls through towers' },
    };
    const AMMO_ORDER = ['stone', 'triple', 'iron', 'fire', 'boulder'];
    const OUTLINE = { color: [0.24, 0.13, 0.07], unlit: true, outline: 0.0065, noShadow: true, fogless: false };
    const BANNERS = ['#b3261e','#1f4fa8','#e0a800','#2e7d32','#6a1b9a'];
    const TARGET_OL = { color: [1, 0.85, 0.2], unlit: true, outline: 0.02, noShadow: true };
    const ROOFS = ['#9e2a22','#2b4f9a','#3f6b45','#7a3d8f'];
    let st = null, E = null, A = null;
    const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    const W3 = (d, y, lat) => [lat * S, (GROUND - y) * S, -d * S];

    // ---------- Level design (same castles as before, one castle per lane) ----------
    // Castles grow level by level: taller towers, more goblins, tougher ice and stone, shield walls in front
    // of the goblins from level 10, and fewer spare shots. Levels 1-3 are a gentle warm-up.
    function levelSpec(n, R){
      const blocks = [];
      const pStone = Math.min(0.6, Math.max(0, (n - 6) / 45)), pIce = Math.min(0.45, Math.max(0, (n - 2) / 28));
      const mat = () => { const r = R(); return r < pStone ? 'dark' : r < pStone + pIce ? 'gray' : r < 0.93 ? 'sand' : 'wood'; };
      let lane = 0;
      const add = (x, yBottom, w, h, type) => { blocks.push({ x, y: yBottom - h / 2, w, h, type, lane, lat: type === 'wall' ? Math.min(30, w * 0.42) : w / 2, mat: mat(), flag: R() < 0.4 ? BANNERS[Math.floor(R() * BANNERS.length)] : null, roof: ROOFS[Math.floor(R() * ROOFS.length)] }); return yBottom - h; };
      const goblin = (x, yBottom) => { add(x, yBottom, 24, 24, 'goblin'); const gb = blocks[blocks.length - 1]; gb.mat = 'goblin'; gb.flag = null; gb.lat = 12; };
      const builders = {
        tower(x, k){ let y = TABLE_Y; for (let i=0;i<k;i++) y = add(x, y, i % 2 ? 28 : 34, i % 2 ? 50 : 34, i % 2 ? 'tower' : 'keep'); },
        arch(x, k){ let y = add(x - 22, TABLE_Y, 22, 48, 'tower'); add(x + 22, TABLE_Y, 22, 48, 'tower'); y = add(x, y, 70, 18, 'wall'); for (let i=0;i<k;i++) y = add(x, y, 30, 30, 'keep'); },
        pyramid(x, k){ const rows = Math.min(k, 4); for (let r=0;r<rows;r++) for (let i=0;i<rows - r;i++) add(x + (i - (rows - r - 1) / 2) * 30, TABLE_Y - r * 28, 28, 28, 'keep'); },
        walls(x, k){ let y = TABLE_Y; for (let i=0;i<k;i++) y = add(x, y, 60, 22, 'wall'); },
        fortress(x, k){ let y1 = add(x - 30, TABLE_Y, 22, 56, 'tower'); add(x + 30, TABLE_Y, 22, 56, 'tower'); add(x, TABLE_Y, 30, 30, 'keep'); let y = add(x, y1, 90, 16, 'wall'); add(x - 30, y, 24, 24, 'keep'); add(x + 30, y, 24, 24, 'keep'); y = add(x, y, 28, 46, 'tower'); for (let i=1;i<k;i++) y = add(x, y, 26, 26, 'keep'); },
      };
      const kinds = n < 3 ? ['tower'] : n < 6 ? ['tower', 'walls'] : n < 10 ? ['tower', 'walls', 'arch'] : n < 18 ? ['tower', 'walls', 'arch', 'pyramid'] : ['tower', 'arch', 'pyramid', 'fortress', 'fortress'];
      const groups = n < 4 ? 1 : n < 12 ? 2 : 3;
      const size = 2 + Math.min(5, Math.floor(n / 6));
      const wantGobs = Math.min(7, 1 + Math.floor(n / 4));
      // is anything resting on top of this block?
      const freeTop = (b) => !blocks.some(o => o !== b && o.lane === b.lane && Math.abs((o.y + o.h / 2) - (b.y - b.h / 2)) < 3 && Math.abs(o.x - b.x) < (o.w + b.w) / 2 - 4);
      for (let g=0; g<groups; g++) {
        lane = g;
        const kind = kinds[Math.floor(R() * kinds.length)];
        const k = Math.max(kind === 'tower' ? 3 : 1, size + Math.floor(R() * 2));
        const cx = AIMD + 30 + (R() - 0.5) * 30;
        builders[kind](cx, k);
        const mine = blocks.filter(b => b.lane === g);
        const top = mine.reduce((a, b) => (b.y - b.h / 2 < a.y - a.h / 2 ? b : a));
        goblin(top.x, top.y - top.h / 2);
        // a thick shield wall in front of the castle from level 10
        if (n >= 10 && R() < Math.min(0.85, 0.35 + n / 60)) { add(cx - 62, TABLE_Y, 16, Math.min(70, 34 + n * 0.8), 'wall'); blocks[blocks.length - 1].lat = 24; blocks[blocks.length - 1].mat = n >= 25 ? 'dark' : 'gray'; }
      }
      // extra goblins hide on ledges (or behind the castle on the table)
      let extra = wantGobs - groups, guard = 0;
      const tableSlots = Array.from({ length: groups }, () => 0);
      while (extra > 0 && guard++ < 30) {
        lane = guard % groups;
        const ledges = blocks.filter(b => b.lane === lane && b.type !== 'goblin' && b.y - b.h / 2 < TABLE_Y - 20 && freeTop(b) && b.w >= 26);
        if (ledges.length) { const b = ledges[Math.floor(R() * ledges.length)]; goblin(b.x, b.y - b.h / 2); extra--; }
        else { const base = blocks.filter(o => o.lane === lane && Math.abs(o.y + o.h / 2 - TABLE_Y) < 3), maxX = Math.max(AIMD, ...base.map(o => o.x + o.w / 2)), x = maxX + 17 + tableSlots[lane] * 28;
          if (x + 13 <= TX1 - 3) { goblin(x, TABLE_Y); tableSlots[lane]++; extra--; } else tableSlots[lane] = 99; }
        if (tableSlots.every(v => v >= 99) && !blocks.some(b => b.type !== 'goblin' && freeTop(b) && b.w >= 26 && b.y - b.h / 2 < TABLE_Y - 20)) break;
      }
      // ammo: enough for every goblin plus a few spare shots early on, fewer spares later
      const gobs = blocks.filter(b => b.type === 'goblin').length;
      const spare = n <= 3 ? 3 : n <= 12 ? 2 : n <= 30 ? 2 : 1;
      const total = Math.min(14, Math.round(gobs * 1.5) + spare + Math.floor(blocks.length / 16));
      const ammo = { stone: 0, triple: 0, iron: 0, fire: 0, boulder: 0 };
      if (n >= 3) ammo.triple = 1 + (n >= 20 && R() < 0.5 ? 1 : 0);
      if (n >= 4) ammo.iron = 1 + (n >= 15 ? 1 : 0);
      if (n >= 6) ammo.fire = 1 + (n >= 30 ? 1 : 0);
      if (n >= 9) ammo.boulder = 1;
      const special = ammo.triple + ammo.iron + ammo.fire + ammo.boulder;
      ammo.stone = Math.max(1, total - special);
      const lanes = groups === 1 ? [0] : groups === 2 ? [-46, 46] : [-72, 0, 72];
      return { n, blocks, ammo, lanes };
    }

    // ---------- World ----------
    function makeWorld(){
      const P = PB.physics, w = new P.World(G);
      w.add(P.makeBox((TX0 + TX1) / 2, TABLE_Y + 10, TX1 - TX0, 20, 0, { friction: 0.4, data: { table: true } }));
      w.add(P.makeBox(AIMD, GROUND + 30, 3000, 60, 0, { friction: 0.9, data: { ground: true } }));
      w.onContact = (a, b, cs) => {
        if (!st || !st.armed) return;
        const c = cs[0], vn = c ? Math.abs((b.vx - a.vx) * c.nx + (b.vy - a.vy) * c.ny) : 0;
        hurt(a, b, vn); hurt(b, a, vn);
        const shot = a.data && a.data.shot ? a : b.data && b.data.shot ? b : null;
        const other = shot === a ? b : a;
        if (!shot) return;
        if (shot.data.type === 'fire' && !shot.data.burst && other.data && (other.data.block || other.data.table)) st.pendingBurst.push(shot);
        if (other.data && other.data.block && !shot.data.thud) {
          shot.data.thud = true; st.shake = Math.max(st.shake, Math.min(18, 6 + vn / 50)); const p = shotPos(shot);
          if (vn > 220 && !reduceMotion) { if (!shot.data.slowed && shot.data.main) { shot.data.slowed = true; st.slow = 0.42; } st.comics.push({ p, t: 0, text: ['POW!', 'BAM!', 'CRASH!', 'WHAM!', 'KA-BOOM!'][Math.floor(Math.random() * 5)], col: ['#ffd23f', '#ff7a2a', '#5ee0ff', '#ff4f8b'][Math.floor(Math.random() * 4)], big: vn > 380 }); }
          dust3(p, MAT[other.data.mat].base, 10); chunks(p, MAT[other.data.mat].base, 8);
          if (!reduceMotion) st.waves.push({ p, t: 0, big: vn > 320 });
          if (PB.sfx) PB.sfx('crash');
        }
      };
      return w;
    }
    // how hard a hit is decides how much it cracks a block (heavier things hitting it crack it more)
    function hurt(body, other, vn){
      const d = body.data; if (!d || !d.block || d.off || d.broken) return;
      const mO = other.invM ? 1 / other.invM : 40, mS = body.invM ? 1 / body.invM : 40;
      const k = other.data && other.data.shot ? (AMMO[other.data.type].hit || 1) : 1;
      const dmg = Math.max(0, vn - 110) * (mO / (mO + mS)) * 0.5 * k;
      if (dmg <= 0) return;
      d.hp -= dmg; d.hitT = 0.3;
      if (d.hp <= 0) d.broken = true;
      else if (d.mat === 'goblin' && dmg > 20 && !d.ouch) { d.ouch = 0.6; pop(W3(body.x, body.y - 20, st.lanes[d.lane].lat), 'Ouch! Hit him again!', '#ffe08a', 1.1); }
    }
    function ammoLeft(){ return AMMO_ORDER.reduce((n, k) => n + (st.inv[k] || 0), 0); }
    function pickAmmo(){ if (st.inv[st.sel] > 0) return; st.sel = AMMO_ORDER.find(k => st.inv[k] > 0) || st.sel; }
    function fresh(mode, level){
      const R = mode === 'daily' ? mulberry(seedFrom('castle-daily-' + PB.today())) : mulberry(seedFrom('castle-' + level));
      const spec = levelSpec(mode === 'daily' ? 35 : level, R);
      const P = PB.physics;
      const lanes = spec.lanes.map((lat, i) => ({ lat, half: Math.max(14, ...spec.blocks.filter(b => b.lane === i).map(b => b.lat)), world: null }));
      const free = makeWorld();
      st = { mode, level, spec, lanes, free, blocks: [], inv: { ...spec.ammo }, sel: 'stone', shots: [], score: 0, knocked: 0, broken: 0, phase:'play', armed: false,
        aim: null, arm: REST, armV: 0, loaded: true, reload: 0, parts: [], pops: [], waves: [], time: 0, shake: 0, settle: 0, over: false, endTimer: null, pendingBurst: [], lastFire: 0,
        yaw: 0, camK: 0, camF: null, aimV: null, preview: null, trayRects: [], comics: [], helmets: [], slow: 0, windup: 0, recoil: 0, loadAnim: null, needAuto: true, fwIn: 0, fireRect: null, touch: null };
      for (const L of lanes) L.world = makeWorld();
      st.blocks = spec.blocks.map(b => { const hp = MAT[b.mat].hp * (b.type === 'wall' ? 1.15 : 1); const body = P.makeBox(b.x, b.y, b.w, b.h, MAT[b.mat].d, { friction: 0.78, data: { block: true, ...b, hp, maxHp: hp } }); lanes[b.lane].world.add(body); return body; });
      for (const L of lanes) { for (let i=0;i<120;i++) L.world.step(1/120); }
      // a goblin that slipped off its perch while the castle settled goes to stand on the table instead
      let moved = false;
      for (const b of st.blocks) { const d = b.data; if (d.mat !== 'goblin') continue; if (Math.abs(b.y - d.y) > 6 || Math.abs(b.a) > 0.3) { const taken = st.blocks.filter(o => o !== b && o.data.lane === d.lane && o.y > TABLE_Y - 30 && o.x > AIMD + 50); let x = AIMD + 74; while (taken.some(o => Math.abs(o.x - x) < 28) && x < TX1 - 14) x += 30; b.x = Math.min(TX1 - 14, x); b.y = TABLE_Y - 12; b.a = 0; b.vx = b.vy = b.w = 0; moved = true; } }
      if (moved) for (const L of lanes) for (let i=0;i<60;i++) L.world.step(1/120);
      for (const b of st.blocks) { b.vx = b.vy = b.w = 0; b.data.y0 = b.y; b.data.a0 = b.a; b.data.x0 = b.x; }
      st.armed = true; pickAmmo();
      st.goblins = st.blocks.filter(b => b.data.mat === 'goblin').length;
      const mid = lanes[Math.floor(lanes.length / 2)];
      st.target = { d: AIMD + 25, lat: mid.lat, y: TABLE_Y - 40 };
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
        if (d < 105 && d > 0 && !b.data.off) { const k = (1 - d / 105) * 400, dd = Math.hypot(dx, dy) || 1; b.vx += dx / dd * k * 0.8 + k * 0.35; b.vy += dy / dd * k * 0.6 - 160 * (1 - d / 115); b.w += (Math.random() - .5) * 6;
          b.data.hp -= 140 * (1 - d / 105); b.data.hitT = 0.3; if (b.data.hp <= 0) b.data.broken = true; }
      }
      st.shake = 14; st.flash = 0.25;
      const p = shotPos(shot);
      if (!reduceMotion) for (let i=0;i<40;i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - 0.3, s = 1 + Math.random() * 3; st.parts.push({ p: [...p], v: [Math.cos(a) * Math.cos(b) * s, Math.abs(Math.sin(b)) * s * 0.8 + 0.5, Math.sin(a) * Math.cos(b) * s], life: 0.8, max: 0.8, color: [[1, 0.7, 0.15], [1, 0.35, 0.1], [1, 0.9, 0.5]][i % 3], size: 0.12 + Math.random() * 0.14, add: true, g: 2 }); }
      for (let i=0;i<14;i++) st.parts.push({ p: [p[0] + (Math.random() - .5) * 0.3, p[1], p[2]], v: [(Math.random() - .5) * 0.6, 0.6 + Math.random() * 0.6, (Math.random() - .5) * 0.6], life: 1.6, max: 1.6, color: [0.35, 0.33, 0.32], size: 0.3 + Math.random() * 0.3, grow: 0.5, g: 0 });
      chunks(p, '#6b4a2a', 14, 1.6); st.boomLight = { p, t: 0.35 }; if (!reduceMotion) st.waves.push({ p, t: 0, big: true, fire: true });
      pop(p, 'BOOM!', '#ff7a1f');
    }
    function fire(){ if (PB.sfx) PB.sfx('launch');
      const type = st.sel; if (!(st.inv[type] > 0)) return;
      st.inv[type]--;
      const Am = AMMO[type], P = PB.physics, v = st.fireV || launchVelocity(st.target);
      const ball = P.makeCircle(LAUNCH.d, LAUNCH.y, Am.r, Am.d * 1.1, { friction: 0.6, data: { shot: true, type, main: true } });
      ball.vx = v.vx; ball.vy = v.vy; ball.lat = 0; ball.vlat = v.vl; ball.age = 0; ball.lane = -1;
      st.free.add(ball); st.shots.push(ball); st.camShot = ball;
      st.loaded = false; st.reload = 0.7; st.lastFire = st.time; st.preview = null; st.recoil = 1; st.loadAnim = null;
      if (!reduceMotion) for (const l of [-34, 34]) for (const d of [142, 226]) for (let i=0;i<4;i++) st.parts.push({ p: W3(d, COUNTER_Y - 2, l), v: [(Math.random() - .5) * 0.8, 0.3 + Math.random() * 0.5, 0.3 + Math.random() * 0.6], life: 0.7, max: 0.7, color: [0.82, 0.74, 0.6], size: 0.08, grow: 0.35, g: 0 });
      if (!reduceMotion) for (let i=0;i<8;i++) st.parts.push({ p: W3(LAUNCH.d, LAUNCH.y, 0), v: [(Math.random() - .5) * 0.8, Math.random() * 0.6, (Math.random() - .5) * 0.8], life: 0.6, max: 0.6, color: [0.75, 0.68, 0.55], size: 0.1, grow: 0.3, g: 0 });
    }
    // a lob from the catapult cup that reaches the target point (lane units: d = depth, y = height (down), lat = sideways)
    function launchVelocity(t){
      const T = Math.max(0.45, Math.min(1.1, 0.4 + (t.d - LAUNCH.d) * 0.0011 + Math.max(0, LAUNCH.y - t.y) * 0.0007));
      return { vx: (t.d - LAUNCH.d) / T, vy: (t.y - LAUNCH.y - 0.5 * G * T * T) / T, vl: t.lat / T, T };
    }
    // follow that lob through the air and find the first thing it will hit
    function simulate(v, r){
      let d = LAUNCH.d, y = LAUNCH.y, lat = 0, vy = v.vy; const pts = [], dt = 1 / 90;
      for (let i=0;i<260;i++) {
        d += v.vx * dt; y += vy * dt; lat += v.vl * dt; vy += G * dt;
        if (i % 3 === 0) pts.push(W3(d, y, lat));
        for (const b of st.blocks) {
          const bd = b.data; if (bd.off) continue;
          const L = st.lanes[bd.lane]; if (Math.abs(lat - L.lat) > bd.lat + r) continue;
          const dx = d - b.x, dy = y - b.y, c = Math.cos(b.a), s = Math.sin(b.a), lx = c * dx + s * dy, ly = -s * dx + c * dy;
          if (Math.abs(lx) <= b.hw + r && Math.abs(ly) <= b.hh + r) return { pts, hit: W3(d, y, lat), block: b };
        }
        if (y + r >= TABLE_Y && d > TX0 && d < TX1 && Math.abs(lat) < 155) return { pts, hit: W3(d, TABLE_Y, lat), block: null };
        if (y + r >= GROUND) return { pts, hit: W3(d, GROUND, lat), block: null };
      }
      return { pts, hit: pts[pts.length - 1], block: null };
    }
    function split(ball){
      if (ball.data.split) return; ball.data.split = true;
      const P = PB.physics, w = ball.lane < 0 ? st.free : st.lanes[ball.lane].world;
      for (const dv of [-150, 150]) {
        const b = P.makeCircle(ball.x, ball.y, ball.r, 12, { friction: 0.6, data: { shot: true, type: 'triple', split: true } });
        b.vx = ball.vx; b.vy = ball.vy - 30; b.lat = ball.lat; b.vlat = ball.vlat + dv; b.age = ball.age; b.lane = ball.lane;
        w.add(b); st.shots.push(b);
      }
      const p = shotPos(ball);
      for (let i=0;i<10;i++) st.parts.push({ p: [...p], v: [(Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2], life: .4, max: .4, color: [1, 0.95, 0.75], size: 0.06, add: true, g: 0 });
    }
    function pop(p, text, color, life){ st.pops.push({ p, text, color, life: life || 1.1, rise: 0 }); }
    function chunks(p, col, n, power = 1){ if (reduceMotion) return; const c = hex(col); st.debris = st.debris || []; for (let i=0;i<n;i++) st.debris.push({ p: [p[0] + (Math.random() - .5) * 0.15, p[1] + (Math.random() - .3) * 0.15, p[2] + (Math.random() - .5) * 0.15], v: [(Math.random() - .5) * 2.2 * power, (0.6 + Math.random() * 1.8) * power, (Math.random() - .3) * 2 * power], r: [Math.random() * 6, Math.random() * 6, Math.random() * 6], vr: [(Math.random() - .5) * 12, (Math.random() - .5) * 12, 0], s: 0.025 + Math.random() * 0.035, col: c.map(v => v * (0.75 + Math.random() * 0.3)), life: 2.2 }); }
    function dust3(p, col, n){ if (reduceMotion) return; const c = hex(col).map(v => v * 0.9 + 0.08); for (let i=0;i<n;i++) st.parts.push({ p: [p[0] + (Math.random() - .5) * 0.2, p[1] + (Math.random() - .3) * 0.2, p[2] + (Math.random() - .5) * 0.2], v: [(Math.random() - .5) * 1.4, Math.random() * 1.6, (Math.random() - .5) * 1.4], life: 0.7, max: 0.7, color: c, size: 0.08 + Math.random() * 0.1, g: 4, grow: 0.15 }); }

    function update(rdt){
      // a big hit plays in slow motion for a moment
      if (st.slow > 0) st.slow = Math.max(0, st.slow - rdt);
      const dt = st.slow > 0 ? rdt * 0.3 : rdt;
      st.time += dt;
      for (const c of st.comics) c.t += rdt; st.comics = st.comics.filter(c => c.t < 0.9);
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
      if (st.windup > 0) { st.windup = Math.max(0, st.windup - dt); st.arm += (REST + 0.42 - st.arm) * Math.min(1, dt * 14); if (st.windup === 0) { st.armV = 12; if (PB.sfx) PB.sfx('whoosh'); } }
      else if (st.armV > 0) { st.arm -= st.armV * dt; st.armV += 80 * dt; if (st.arm <= FIRE) { st.arm = FIRE; st.armV = 0; fire(); st.armBounce = 0.55; st.shake = Math.max(st.shake, 5); } }
      else {
        const target = st.loaded ? REST + (st.aim ? 0.12 : 0) : FIRE + 0.05;
        st.arm += (target - st.arm) * Math.min(1, dt * (st.loaded ? 4 : 6));
      }
      if (st.armBounce) st.armBounce = Math.max(0, st.armBounce - dt);
      st.recoil = Math.max(0, st.recoil - dt * 2.2);
      if (st.loadAnim) { st.loadAnim.t += dt / 0.42; if (st.loadAnim.t >= 1) { const cp = st.cupPos; if (cp && !reduceMotion) for (let i=0;i<14;i++) st.parts.push({ p: [...cp], v: [(Math.random() - .5) * 1.4, Math.random() * 1.4, (Math.random() - .5) * 1.4], life: 0.5, max: 0.5, color: [1, 0.9, 0.4], size: 0.05, add: true, g: 1 }); if (PB.sfx) PB.sfx('tap'); st.loadAnim = null; } }
      if (!st.loaded && st.armV === 0 && st.windup === 0) { st.reload -= dt; if (st.reload <= 0 && ammoLeft()) { st.loaded = true; pickAmmo(); loadBall(st.sel); st.needAuto = true; } }
      if (st.needAuto && st.loaded && !st.touch) { st.needAuto = false; autoAim(); }
      // goblins panic while a shot is in the air
      st.panicT = st.shots.some(s => s.age < 2.2 && s.rest === 0) ? 0.3 : Math.max(0, (st.panicT || 0) - dt);
      // the catapult swings round to face where you're aiming
      { const want = -Math.atan2(st.target.lat, Math.max(40, st.target.d - 185)); st.yaw += (want - st.yaw) * Math.min(1, dt * 8); }
      // the camera follows a shot through the air, then drifts back
      { const s = st.camShot && !st.camShot.dead && st.camShot.age < 2.4 ? st.camShot : null; st.camK += ((s ? 1 : 0) - st.camK) * Math.min(1, dt * (s ? 2.2 : 1.4));
        if (s) { const p = shotPos(s); st.camF = st.camF ? st.camF.map((v, i) => v + (p[i] - v) * Math.min(1, dt * 5)) : p; } }
      for (const w of st.waves) w.t += dt; st.waves = st.waves.filter(w => w.t < 0.5);
      for (const b of st.shots) {
        b.age += dt;
        if (!reduceMotion && b.rest === 0 && b.age < 2 && Math.random() < 0.6) { const p = shotPos(b); st.parts.push({ p: [p[0], p[1], p[2]], v: [(Math.random() - .5) * 0.1, 0.15, (Math.random() - .5) * 0.1], life: 0.55, max: 0.55, color: b.data.type === 'iron' ? [0.5, 0.5, 0.55] : [0.86, 0.82, 0.74], size: b.r * S * 0.9, grow: 0.25, g: 0 }); }
        if (b.data.type === 'triple' && !b.data.split && b.age > 0.35) split(b);
        if (b.data.type === 'fire' && !reduceMotion && Math.random() < 0.7) { const p = shotPos(b); st.parts.push({ p: [p[0], p[1] + 0.1, p[2]], v: [0, 0.8, 0], life: 0.3, max: 0.3, color: [1, 0.6, 0.15], size: 0.12, add: true, g: 0 }); }
        if (b.y > GROUND + 40 || b.x > TX1 + 500 || b.x < -100 || Math.abs(b.lat) > 700 || b.rest > 1.2 || b.dead) b.dead = true;
      }
      for (const b of st.shots.filter(b => b.dead)) (b.lane < 0 ? st.free : st.lanes[b.lane].world).remove(b);
      st.shots = st.shots.filter(b => !b.dead);
      for (const b of st.blocks) {
        const d = b.data;
        if (d.off) { if (b.y > GROUND - b.hh - 4 && !d.landed) { d.landed = true; dust3(W3(b.x, GROUND, st.lanes[d.lane].lat), '#b7a27a', 8); chunks(W3(b.x, GROUND - 4, st.lanes[d.lane].lat), MAT[d.mat].base, 6, 0.7); } continue; }
        // A goblin that tumbles down from its perch or gets knocked over is bonked, wherever it lands
        if (d.mat === 'goblin' && (b.y > d.y0 + 16 || Math.abs(b.a - d.a0) > 1.0) && b.y <= TABLE_Y + 6 && b.x >= TX0 - 4 && b.x <= TX1 + 4) {
          d.off = true; d.gone = true; st.knocked++; st.gobs = (st.gobs || 0) + 1; st.score += 500;
          const wp = W3(b.x, b.y, st.lanes[d.lane].lat); bonkFx(wp, b); chunks(wp, '#9cff5a', 5, 0.8);
          pop(wp, 'Goblin bonked! +500', '#9cff5a', 1.4); dust3(wp, '#9cff5a', 14);
          st.lanes[d.lane].world.remove(b); if (PB.sfx) PB.sfx('bonk');
          continue;
        }
        if (d.hitT) d.hitT = Math.max(0, d.hitT - dt);
        if (d.ouch) d.ouch = Math.max(0, d.ouch - dt) || 0;
        // smashed to pieces
        if (d.broken) {
          d.off = true; d.gone = true; st.knocked++;
          const wp = W3(b.x, b.y, st.lanes[d.lane].lat);
          if (d.mat === 'goblin') { bonkFx(wp, b); st.gobs = (st.gobs || 0) + 1; st.score += 500; pop(wp, 'Goblin bonked! +500', '#9cff5a', 1.4); dust3(wp, '#9cff5a', 16); if (PB.sfx) PB.sfx('bonk'); }
          else { st.broken++; const pts = d.mat === 'dark' ? 200 : d.mat === 'gray' ? 150 : 100; st.score += pts; pop(wp, 'Smash! +' + pts, '#ffe08a', 0.9); if (PB.sfx) PB.sfx('crash'); }
          dust3(wp, MAT[d.mat].base, 16); chunks(wp, MAT[d.mat].base, d.mat === 'goblin' ? 6 : 16, 1.1); st.shake = Math.max(st.shake, 6);
          st.lanes[d.lane].world.remove(b);
          continue;
        }
        if (b.y > TABLE_Y + 6 || b.x < TX0 - 4 || b.x > TX1 + 4) {
          d.off = true; st.knocked++; if (d.mat === 'goblin') { st.gobs = (st.gobs || 0) + 1; bonkFx(W3(b.x, Math.min(TABLE_Y - 10, b.y), st.lanes[d.lane].lat), b); }
          const pts = d.mat === 'goblin' ? 500 : 100 + (d.mat === 'dark' ? 60 : d.mat === 'gray' ? 30 : 0);
          st.score += pts; if (PB.sfx) PB.sfx(d.mat === 'goblin' ? 'bonk' : 'crash'); pop(W3(b.x, Math.min(TABLE_Y - 10, b.y), st.lanes[d.lane].lat), d.mat === 'goblin' ? 'Goblin bonked! +500' : '+' + pts, d.mat === 'goblin' ? '#9cff5a' : '#ffe08a', d.mat === 'goblin' ? 1.4 : 0.9);
        }
      }
      if (!st.over) {
        const gobs = st.blocks.filter(b => b.data.mat === 'goblin' && !b.data.off).length;
        if (gobs === 0) { st.over = true; st.endTimer = 2.8; st.win = true; if (PB.sfx) PB.sfx('fanfare'); pop(W3(AIMD, TABLE_Y - 140, 0), 'All goblins bonked!', '#ffd23f', 1.8);
          if (!reduceMotion) { const c0 = W3(AIMD, TABLE_Y - 200, 0); const cols = [[1, 0.3, 0.3], [1, 0.85, 0.2], [0.3, 0.7, 1], [0.4, 0.9, 0.4], [1, 0.5, 0.9]]; for (let i=0;i<90;i++) st.parts.push({ p: [c0[0] + (Math.random() - .5) * 2.5, c0[1] + Math.random(), c0[2] + (Math.random() - .5) * 1.5], v: [(Math.random() - .5) * 3, 1 + Math.random() * 3, (Math.random() - .5) * 2], life: 1.8, max: 1.8, color: cols[i % 5], size: 0.07 + Math.random() * 0.05, g: 2.5 }); }
        }
        else if (!ammoLeft() && !st.shots.length && st.armV === 0) {
          const calm = st.blocks.every(b => b.data.off || b.rest > 0.6);
          st.settle = calm ? st.settle + dt : 0;
          if (st.settle > 0.8 || st.time - (st.lastFire || 0) > 9) { st.over = true; st.endTimer = 0.4; st.win = false; }
        }
      } else if (st.endTimer != null) {
        st.endTimer -= dt;
        if (st.win && !reduceMotion) { st.fwIn -= dt; if (st.fwIn <= 0) { st.fwIn = 0.3; firework(); } }
        if (st.endTimer <= 0) { st.endTimer = null; finish(); }
      }
      effects(dt);
    }
    function castleDone(){ const all = st.blocks.filter(b => b.data.mat !== 'goblin'); return all.length ? all.filter(b => b.data.off).length / all.length : 1; }
    function finish(){
      const left = ammoLeft(), pct = castleDone(), gl = st.goblins - (st.gobs || 0);
      if (st.win) st.score += left * 300 + Math.round(pct * 1000);
      const stars = !st.win ? 0 : 1 + (left >= 1 ? 1 : 0) + (pct >= 0.5 ? 1 : 0);
      if (st.mode === 'daily') { shell.gameOver(st.score, `You bonked ${st.gobs || 0} of ${st.goblins} goblins and wrecked ${Math.round(pct * 100)}% of the castle`); return; }
      shell.levelDone({ win: st.win, stars, score: st.score, summary: st.win ? `${Math.round(pct * 100)}% of the castle wrecked${left ? ` \u00b7 ${left} shot${left > 1 ? 's' : ''} to spare` : ''}` : `${gl} goblin${gl === 1 ? '' : 's'} still standing. Try a different ball or a new spot!` });
    }
    function bonkFx(wp, b){
      if (reduceMotion) return;
      st.helmets.push({ p: [wp[0], wp[1] + 0.08, wp[2]], v: [(Math.random() - .5) * 1.6, 2.6 + Math.random() * 1.2, 0.6 + Math.random()], r: [0, 0, 0], vr: [(Math.random() - .5) * 14, (Math.random() - .5) * 10, (Math.random() - .5) * 14], s: (b.data.w || 24) * S, life: 2.2 });
      st.comics.push({ p: wp, t: 0, text: 'BONK!', col: '#9cff5a', big: true });
      for (let k=0;k<6;k++) st.parts.push({ p: [wp[0], wp[1] + 0.15, wp[2]], v: [Math.cos(k) * 0.9, 0.9, Math.sin(k) * 0.9], life: 0.9, max: 0.9, color: [1, 0.92, 0.3], size: 0.07, add: true, g: 0.5 });
    }
    function firework(){
      const c = W3(AIMD + (Math.random() - .5) * 120, TABLE_Y - 230 - Math.random() * 120, (Math.random() - .5) * 220), cols = [[1, 0.3, 0.35], [1, 0.85, 0.2], [0.35, 0.75, 1], [0.5, 1, 0.45], [1, 0.5, 0.95]], col = cols[Math.floor(Math.random() * cols.length)];
      for (let i=0;i<40;i++) { const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), sp = 1.6 + Math.random() * 0.6; st.parts.push({ p: [...c], v: [Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp, Math.sin(b) * Math.sin(a) * sp], life: 1.1, max: 1.1, color: col, size: 0.07, add: true, g: 1.2 }); }
      st.parts.push({ p: [...c], v: [0, 0, 0], life: 0.25, max: 0.25, color: [1, 1, 0.9], size: 0.9, add: true, g: 0 });
      if (PB.sfx) PB.sfx('boom');
    }
    // put the chosen ball into the catapult cup (it arcs in from the tray)
    function loadBall(type){ if (!type) return; st.loadAnim = { type, t: 0, from: st.trayRects && st.trayRects.find(r => r.k === type) }; if (PB.sfx) PB.sfx('pick'); }
    function fireNow(){
      if (!st.loaded || !(st.inv[st.sel] > 0) || st.armV > 0 || st.windup > 0 || st.over) return;
      if (!st.preview) updatePreview();
      st.loaded = false; st.windup = 0.26; st.loadAnim = null; if (PB.sfx) PB.sfx('slide');
    }
    function effects(dt){
      for (const q of st.helmets) { q.v[1] -= 9 * dt; q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt; for (let k=0;k<3;k++) q.r[k] += q.vr[k] * dt; if (q.p[1] < q.s * 0.3) { q.p[1] = q.s * 0.3; q.v[1] = Math.abs(q.v[1]) * 0.4; q.v[0] *= 0.6; q.v[2] *= 0.6; q.vr = q.vr.map(v => v * 0.6); } q.life -= dt; }
      st.helmets = st.helmets.filter(q => q.life > 0);
      for (const q of st.parts) { q.p[0] += q.v[0]*dt; q.p[1] += q.v[1]*dt; q.p[2] += q.v[2]*dt; q.v[1] -= (q.g ?? 4) * dt; if (q.grow) q.size += q.grow * dt; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      if (st.debris) {
        const tableTop = (GROUND - TABLE_Y) * S, x0 = -1.55, x1 = 1.55, z0 = -TX1 * S, z1 = -TX0 * S;
        for (const q of st.debris) {
          q.v[1] -= 9 * dt; q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt; q.r[0] += q.vr[0] * dt; q.r[1] += q.vr[1] * dt; q.life -= dt;
          const floor = q.p[0] > x0 && q.p[0] < x1 && q.p[2] > z0 && q.p[2] < z1 ? tableTop + q.s : q.s;
          if (q.p[1] < floor) { q.p[1] = floor; q.v[1] = Math.abs(q.v[1]) * 0.35; q.v[0] *= 0.6; q.v[2] *= 0.6; q.vr[0] *= 0.5; q.vr[1] *= 0.5; }
        }
        st.debris = st.debris.filter(q => q.life > 0);
      }
      for (const q of st.pops) { q.rise += 34 * dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      st.shake = Math.max(0, st.shake - dt * 30);
      if (st.flash) st.flash = Math.max(0, st.flash - dt);
    }

    // ---------- textures ----------
    function cv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function rnd(seed){ return mulberry(seed); }
    // Soft noise layer: low-res fractal noise scaled up, used to give every texture natural variation.
    function noiseLayer(w, h, scale, seed, oct = 4){
      const N = PB.gl3d, lw = Math.max(8, Math.round(w / 4)), lh = Math.max(8, Math.round(h / 4)), c = cv(lw, lh), g = c.getContext('2d'), id = g.createImageData(lw, lh);
      for (let y=0;y<lh;y++) for (let x=0;x<lw;x++) { const v = 128 + N.fbm(x * 4 / scale + seed, y * 4 / scale, seed * 0.37, oct) * 170; const i = (y * lw + x) * 4; id.data[i] = id.data[i+1] = id.data[i+2] = Math.max(0, Math.min(255, v)); id.data[i+3] = 255; }
      g.putImageData(id, 0, 0);
      const o = cv(w, h), og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, 0, 0, w, h); return o;
    }
    function overlayNoise(g, w, h, scale, seed, alpha, mode = 'overlay'){ g.save(); g.globalCompositeOperation = mode; g.globalAlpha = alpha; g.drawImage(noiseLayer(w, h, scale, seed), 0, 0); g.restore(); }
    function grain(g, w, h, R, n, alpha){ for (let i=0;i<n;i++) { g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${alpha * R()})` : `rgba(255,255,255,${alpha * R()})`; g.fillRect(R() * w, R() * h, 1 + R() * 1.5, 1 + R() * 1.5); } }
    function stoneTex(m, seed){
      const c = cv(512, 512), g = c.getContext('2d'), R = rnd(seed); g.scale(2, 2);
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
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (m.look === 'wood') {
        overlayNoise(g, 512, 512, 60, seed, 0.55);
        // long grain streaks
        g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.25; g.drawImage(noiseLayer(64, 512, 6, seed + 3), 0, 0, 512, 512); g.restore();
        grain(g, 512, 512, R, 1600, 0.12);
      } else if (m.look === 'ice') {
        overlayNoise(g, 512, 512, 90, seed, 0.35, 'soft-light');
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2; for (let k=0;k<26;k++) { const x = R() * 512, y = R() * 512, l = 6 + R() * 18, a = R() * 6; g.beginPath(); g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.8)'; for (let k=0;k<70;k++) { g.beginPath(); g.arc(R() * 512, R() * 512, 0.8 + R() * 1.6, 0, 7); g.fill(); }
      } else {
        overlayNoise(g, 512, 512, 40, seed, 0.6);
        // moss creeping up from the bottom, and a few cracks
        const moss = g.createLinearGradient(0, 512, 0, 300); moss.addColorStop(0, 'rgba(70,110,40,.5)'); moss.addColorStop(1, 'rgba(70,110,40,0)');
        g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = moss; g.fillRect(0, 300, 512, 212); g.restore();
        g.fillStyle = 'rgba(90,140,50,.35)'; for (let k=0;k<40;k++) { g.beginPath(); g.arc(R() * 512, 420 + R() * 90, 2 + R() * 6, 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(30,30,35,.55)'; g.lineWidth = 1.5; for (let k=0;k<3;k++) { let x = 60 + R() * 390, y = 60 + R() * 390; g.beginPath(); g.moveTo(x, y); for (let j=0;j<5;j++) { x += (R() - .5) * 40; y += 8 + R() * 18; g.lineTo(x, y); } g.stroke(); }
        grain(g, 512, 512, R, 2400, 0.14);
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
    // cracks drawn over a block as it gets damaged
    function crackTex(seed, n){
      const c = cv(256, 256), g = c.getContext('2d'), R = rnd(seed);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let k=0;k<n;k++) {
        let x = 30 + R() * 196, y = 30 + R() * 196; const pts = [[x, y]];
        for (let j=0;j<5;j++) { x += (R() - .5) * 70; y += (R() - .5) * 70; pts.push([x, y]); }
        g.strokeStyle = 'rgba(20,12,6,.85)'; g.lineWidth = 4 - k * 0.15; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
        g.strokeStyle = 'rgba(255,245,220,.35)'; g.lineWidth = 1.2; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px + 1.5, py + 1.5) : g.moveTo(px + 1.5, py + 1.5)); g.stroke();
      }
      return E.texture(c);
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
      const c = cv(1024, 512), g = c.getContext('2d'), R = rnd(11);
      const tones = ['#8a5a2e', '#a06a38', '#94602f', '#b07a44', '#7e5129', '#9c6634'];
      for (let y=0;y<512;y+=64) {
        const base = tones[Math.floor(R() * tones.length)];
        const gr = g.createLinearGradient(0, y, 0, y + 64); gr.addColorStop(0, shade(base, 0.1)); gr.addColorStop(0.5, base); gr.addColorStop(1, shade(base, -0.14)); g.fillStyle = gr; g.fillRect(0, y, 1024, 64);
        g.strokeStyle = 'rgba(60,32,10,.32)'; g.lineWidth = 1.4;
        for (let k=0;k<10;k++) { const yy = y + 4 + R() * 56, ph = R() * 6; g.beginPath(); g.moveTo(0, yy); for (let x=0;x<=1024;x+=32) g.lineTo(x, yy + Math.sin(x * 0.006 + ph) * 3 + Math.sin(x * 0.03 + ph) * 0.8); g.stroke(); }
        for (let k=0;k<2;k++) { const kx = R() * 1000, ky = y + 14 + R() * 36; g.fillStyle = 'rgba(55,28,8,.55)'; g.beginPath(); g.ellipse(kx, ky, 9 + R() * 6, 4 + R() * 2, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(55,28,8,.35)'; for (let r=1;r<4;r++) { g.beginPath(); g.ellipse(kx, ky, 10 + r * 6, 5 + r * 3, 0, 0, 7); g.stroke(); } }
        g.fillStyle = 'rgba(30,14,2,.75)'; g.fillRect(0, y, 1024, 3); const j = 120 + R() * 780; g.fillRect(j, y, 3, 64);
        g.fillStyle = 'rgba(255,235,200,.16)'; g.fillRect(0, y + 3, 1024, 2);
        for (const nx of [j - 14, j + 14]) for (const ny of [y + 14, y + 50]) { g.fillStyle = '#3b3f46'; g.beginPath(); g.arc(nx, ny, 3, 0, 7); g.fill(); g.fillStyle = 'rgba(220,225,235,.6)'; g.beginPath(); g.arc(nx - 0.8, ny - 0.8, 1, 0, 7); g.fill(); }
      }
      overlayNoise(g, 1024, 512, 120, 4, 0.45);
      grain(g, 1024, 512, R, 5000, 0.1);
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
      const c = cv(512, 512), g = c.getContext('2d'), R = rnd(5);
      g.fillStyle = '#5fae3c'; g.fillRect(0, 0, 512, 512);
      overlayNoise(g, 512, 512, 140, 8, 0.7);
      g.save(); g.scale(2, 2);
      for (let i=0;i<60;i++) { g.fillStyle = `rgba(${R() < .5 ? '40,70,25' : '130,170,80'},.18)`; g.beginPath(); g.arc(R() * 256, R() * 256, 10 + R() * 30, 0, 7); g.fill(); }
      for (let i=0;i<4200;i++) { const x = R() * 256, y = R() * 256; g.strokeStyle = `rgba(${R() < .5 ? '40,78,26' : '160,205,100'},${0.3 + R() * 0.45})`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 3, y - 3 - R() * 4); g.stroke(); }
      // little meadow flowers
      for (let i=0;i<70;i++) { const x = R() * 256, y = R() * 256, col = ['#fff7e0', '#ffe14d', '#ff9ec7', '#c9b6ff'][Math.floor(R() * 4)]; g.fillStyle = col; for (let k=0;k<5;k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.3, 1, 0, 7); g.fill(); } g.fillStyle = '#f5b400'; g.beginPath(); g.arc(x, y, 0.7, 0, 7); g.fill(); }
      g.restore();
      return c;
    }
    function dirtTex(){
      const c = cv(256, 256), g = c.getContext('2d'), R = rnd(21);
      g.fillStyle = '#a3845a'; g.fillRect(0, 0, 256, 256); overlayNoise(g, 256, 256, 50, 12, 0.7);
      for (let i=0;i<220;i++) { const r = 1 + R() * 3.5; g.fillStyle = `rgba(${R() < .5 ? '120,100,80' : '200,185,160'},.7)`; g.beginPath(); g.ellipse(R() * 256, R() * 256, r, r * 0.7, R() * 3, 0, 7); g.fill(); }
      grain(g, 256, 256, R, 1500, 0.15);
      return c;
    }
    function balloonTex(){ const c = cv(256, 128), g = c.getContext('2d'); const cols = ['#e63946', '#ffd166', '#118ab2', '#ffffff', '#ef476f', '#06d6a0']; for (let i=0;i<12;i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(i * 256 / 12, 0, 256 / 12 + 1, 128); } g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 100, 256, 28); return c; }
    function rockTex(){ const c = cv(128, 64), g = c.getContext('2d'), N = PB.gl3d, id = g.createImageData(128, 64); for (let y=0;y<64;y++) for (let x=0;x<128;x++) { const v = 0.5 + N.fbm(x / 14, y / 14, 1.7, 4) * 0.6; const i = (y * 128 + x) * 4; id.data[i] = v * 150; id.data[i+1] = v * 144; id.data[i+2] = v * 138; id.data[i+3] = 255; } g.putImageData(id, 0, 0); return c; }
    function backdropTex(){
      const w = 2048, h = 512, c = cv(w, h), g = c.getContext('2d'), R = rnd(9);
      const ridge = (base, amp, f, ph, col, alpha) => { g.fillStyle = col; g.globalAlpha = alpha; g.beginPath(); g.moveTo(0, h); for (let x=0;x<=w;x+=8) g.lineTo(x, base - Math.sin(x * f + ph) * amp - Math.sin(x * f * 2.7 + ph * 1.3) * amp * 0.35); g.lineTo(w, h); g.closePath(); g.fill(); g.globalAlpha = 1; };
      // faraway snowy mountains in the haze
      ridge(240, 110, 0.0019, 4, '#a9c9e6', 1);
      g.save(); g.globalCompositeOperation = 'source-atop'; const snow = g.createLinearGradient(0, 120, 0, 230); snow.addColorStop(0, 'rgba(255,255,255,.95)'); snow.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = snow; g.fillRect(0, 100, w, 140); g.restore();
      ridge(300, 60, 0.0031, 1, '#8fc4e2', 1);
      // distant castle on the ridge
      g.fillStyle = '#6fb0d8'; const cx = 1180, cy = 262;
      g.fillRect(cx - 90, cy - 40, 180, 60);
      for (const [x, ww, hh] of [[-100, 30, 110], [-30, 40, 150], [70, 30, 120]]) { g.fillRect(cx + x, cy - hh + 20, ww, hh); g.beginPath(); g.moveTo(cx + x - 6, cy - hh + 20); g.lineTo(cx + x + ww / 2, cy - hh - 30); g.lineTo(cx + x + ww + 6, cy - hh + 20); g.fill(); }
      for (let x = cx - 90; x < cx + 90; x += 14) g.fillRect(x, cy - 50, 8, 10);
      g.fillStyle = '#ffe6a0'; for (const [x, y] of [[-88, -40], [-12, -60], [-18, -20], [82, -50], [30, -10]]) g.fillRect(cx + x, cy + y, 4, 7);
      for (const [x, hh, col] of [[-85, 110, '#c62f26'], [-10, 150, '#e0b43c'], [85, 120, '#1f4fa8']]) { g.fillStyle = '#5a7f99'; g.fillRect(cx + x, cy - hh - 62, 2, 26); g.fillStyle = col; g.beginPath(); g.moveTo(cx + x + 2, cy - hh - 62); g.lineTo(cx + x + 22, cy - hh - 56); g.lineTo(cx + x + 2, cy - hh - 50); g.fill(); }
      // a windmill on the far hill
      { const mx = 520, my = 300; g.fillStyle = '#7fb5d6'; g.beginPath(); g.moveTo(mx - 14, my + 10); g.lineTo(mx - 8, my - 50); g.lineTo(mx + 8, my - 50); g.lineTo(mx + 14, my + 10); g.fill(); g.strokeStyle = '#7fb5d6'; g.lineWidth = 5; for (let k=0;k<4;k++) { const a = k * Math.PI / 2 + 0.4; g.beginPath(); g.moveTo(mx, my - 50); g.lineTo(mx + Math.cos(a) * 50, my - 50 + Math.sin(a) * 50); g.stroke(); } }
      ridge(350, 40, 0.0052, 3, '#7ccf52', 1);
      for (let i=0;i<70;i++) { const x = R() * w, y = 330 + R() * 50; g.fillStyle = R() < .5 ? '#3fae3a' : '#57c046'; g.beginPath(); g.ellipse(x, y, 14 + R() * 16, 20 + R() * 22, 0, 0, 7); g.fill(); }
      ridge(410, 20, 0.008, 5, '#6cc443', 1);
      for (let i=0;i<40;i++) { const x = R() * w, y = 400 + R() * 30; g.fillStyle = '#2f9a34'; g.beginPath(); g.ellipse(x, y, 20 + R() * 20, 26 + R() * 18, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(x - 6, y - 10, 10, 10, 0, 0, 7); g.fill(); }
      g.fillStyle = '#5fae3c'; g.fillRect(0, 440, w, 72);
      // patchwork fields on the middle hills
      g.save(); g.globalCompositeOperation = 'source-atop';
      for (let i=0;i<26;i++) { const x = R() * w, y = 330 + R() * 70; g.fillStyle = ['rgba(230,200,90,.35)', 'rgba(120,170,60,.35)', 'rgba(180,140,70,.3)'][i % 3]; g.beginPath(); g.ellipse(x, y, 60 + R() * 70, 10 + R() * 10, (R() - .5) * 0.3, 0, 7); g.fill(); }
      g.restore();
      // haze toward the horizon
      const hz = g.createLinearGradient(0, 120, 0, 440); hz.addColorStop(0, 'rgba(225,235,245,0)'); hz.addColorStop(0.55, 'rgba(225,235,245,.18)'); hz.addColorStop(1, 'rgba(225,235,245,0)');
      g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = hz; g.fillRect(0, 0, w, h); g.restore();
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
      A.tGoblin = E.texture(goblinTex()); A.tFace = { stone: E.texture(faceTex('#a7a39d', '#3a2a20', 1)), triple: E.texture(faceTex('#d9a86a', '#5a3010', 2)), iron: E.texture(faceTex('#4a4e58', '#111', 3)), fire: E.texture(faceTex('#ff6a2a', '#5a1000', 4)), boulder: E.texture(faceTex('#9a8f80', '#3a2a20', 5)) };
      A.tCrack = [crackTex(31, 5), crackTex(57, 11)]; A.ring = E.mesh(Gm.torus(1, 0.08, 40, 6));
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
      A.tDirt = E.texture(dirtTex()); A.tBalloon = E.texture(balloonTex());
      // trees, fences and hay around the fairground are merged into a few meshes so they draw fast
      const Rs = rnd(41), pines = [], crowns = [], trunks = [], fence = [], hay = [];
      const spots = [];
      for (let i=0;i<34;i++) { const side = i % 2 ? 1 : -1; const x = side * (6.5 + Rs() * 20), z = -14 - Rs() * 40; if (Math.abs(x) < 9 && z > -40) continue; spots.push([x, z]); }
      for (const [x, z] of spots) {
        const sc = 0.8 + Rs() * 0.7;
        if (Rs() < 0.55) { trunks.push(T(Gm.cylinder(0.12, 0.16, 1.2, 8), [x, 0.6 * sc, z], [0, 0, 0], [sc, sc, sc])); for (let k=0;k<3;k++) pines.push(T(Gm.cylinder(0, 1.1 - k * 0.22, 1.5, 10, true), [x, (1.2 + k * 0.8) * sc, z], [0, Rs() * 3, 0], [sc, sc, sc])); }
        else { trunks.push(T(Gm.cylinder(0.14, 0.2, 1.6, 8), [x, 0.8 * sc, z], [0, 0, 0], [sc, sc, sc])); for (let k=0;k<5;k++) crowns.push(T(Gm.sphere(1, 12, 9), [x + (Rs() - .5) * 1.1 * sc, (2.1 + Rs() * 0.8) * sc, z + (Rs() - .5) * 1.1 * sc], [0, 0, 0], [0.75 * sc, 0.68 * sc, 0.75 * sc])); }
      }
      for (const sx of [-1, 1]) for (let i=0;i<18;i++) { const z = -6 - i * 1.6, x = sx * 5.6; fence.push(T(Gm.box(0.1, 0.8, 0.1), [x, 0.4, z])); fence.push(T(Gm.box(0.05, 0.08, 1.62), [x, 0.6, z - 0.8])); fence.push(T(Gm.box(0.05, 0.08, 1.62), [x, 0.3, z - 0.8])); }
      for (const [x, z, r] of [[4.4, -9.5, 0.2], [4.8, -10.6, 1.4], [-4.7, -11.2, 0.6], [-4.3, -12.4, 2]]) hay.push(T(Gm.cylinder(0.42, 0.42, 0.7, 16, true), [x, 0.42, z], [Math.PI / 2, r, 0]));
      A.pines = E.mesh(Gm.merge(pines)); A.crowns = E.mesh(Gm.merge(crowns)); A.trunks = E.mesh(Gm.merge(trunks)); A.fence = E.mesh(Gm.merge(fence)); A.hay = E.mesh(Gm.merge(hay));
      A.chunk = E.mesh(Gm.roundBox(1, 1, 1, 0.2, 2));
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
      // the whole catapult swivels on its base towards the target
      const rk = st.recoil, rb = Math.sin(rk * Math.PI) * 0.16, pc = W3(185, COUNTER_Y, 0), SW = M.mul(M.trs([pc[0], pc[1] + Math.abs(Math.sin(rk * 9)) * rk * 0.03, pc[2] + rb], [rk * Math.sin(rk * 12) * 0.05, st.yaw, 0]), M.trs([-pc[0], -pc[1], -pc[2]]));
      const DC = (mesh, m, mat) => E.draw(mesh, M.mul(SW, m), mat);
      const wood = { tex: A.tPlank, color: [0.8, 0.6, 0.42], spec: 0.15, uvScale: [0.6, 0.3] }, dark = { tex: A.tPlank, color: [0.5, 0.36, 0.24], spec: 0.15, uvScale: [0.6, 0.3] };
      const baseY = COUNTER_Y - 4;
      const P = (d, y, l) => W3(d, y, l);
      for (const l of [-24, 24]) { const mm = M.trs(P(185, baseY - 8, l), [0, 0, 0], [0.09, 0.09, 1.1]); DC(A.box, mm, wood); DC(A.box, mm, OUTLINE); }
      for (const d of [138, 185, 228]) DC(A.box, M.trs(P(d, baseY - 8, 0), [0, 0, 0], [0.56, 0.07, 0.08]), dark);
      for (const l of [-34, 34]) for (const d of [142, 226]) {
        const m = M.trs(P(d, baseY - 4, l), [st.time * 0 , 0, 0], [0.16, 0.16, 0.16]);
        DC(A.wheel, m, { color: [0.35, 0.24, 0.15], spec: 0.2 }); DC(A.spokes, m, { color: [0.45, 0.31, 0.2] });
        DC(A.cyl, M.trs(P(d, baseY - 4, l), [0, 0, Math.PI / 2], [0.05, 0.03, 0.05]), { color: [0.5, 0.5, 0.55], spec: 0.8 });
      }
      for (const l of [-24, 24]) {
        DC(A.box, M.trs(P(PIV.d, (baseY + PIV.y) / 2 - 6, l), [0, 0, 0], [0.08, (baseY - PIV.y) * S + 0.14, 0.08]), wood);
        DC(A.box, M.trs(P(PIV.d - 28, (baseY + PIV.y) / 2 - 2, l), [-0.75, 0, 0], [0.06, 0.62, 0.06]), dark);
      }
      DC(A.cyl, M.trs(P(PIV.d, PIV.y, 0), [0, 0, Math.PI / 2], [0.08, 0.5, 0.08]), { color: [0.45, 0.45, 0.5], spec: 0.8 });
      for (const l of [-14, 14]) DC(A.cyl, M.trs(P(PIV.d, PIV.y, l), [0, 0, Math.PI / 2], [0.13, 0.1, 0.13]), { color: [0.5, 0.36, 0.22], spec: 0.05 });
      const phi = st.arm + (st.armBounce ? Math.sin(st.armBounce * 26) * st.armBounce * 0.42 : 0);
      const dir = [0, Math.sin(phi), -Math.cos(phi)], piv = P(PIV.d, PIV.y, 0);
      const mid = [piv[0] + dir[0] * ARM * S / 2, piv[1] + dir[1] * ARM * S / 2, piv[2] + dir[2] * ARM * S / 2];
      DC(A.box, M.trs(mid, [phi, 0, 0], [0.07, 0.07, ARM * S + 0.06]), OUTLINE);
      DC(A.box, M.trs(mid, [phi, 0, 0], [0.07, 0.07, ARM * S + 0.06]), { tex: A.tPlank, color: [0.85, 0.64, 0.44], spec: 0.2, uvScale: [1, 0.2] });
      const tip = [piv[0] + dir[0] * ARM * S, piv[1] + dir[1] * ARM * S, piv[2] + dir[2] * ARM * S];
      const up = [0, -Math.cos(phi), -Math.sin(phi)];
      const cupC = [tip[0] + up[0] * 0.05, tip[1] + up[1] * 0.05, tip[2] + up[2] * 0.05];
      DC(A.cup, M.trs(cupC, [phi + Math.PI, 0, 0], [0.27, 0.27, 0.27]), { color: [0.62, 0.4, 0.22], spec: 0.2, doubleSided: true });
      DC(A.cyl, M.trs([cupC[0] - up[0] * 0.06, cupC[1] - up[1] * 0.06, cupC[2] - up[2] * 0.06], [phi + Math.PI, 0, 0], [0.18, 0.02, 0.18]), { color: [0.35, 0.23, 0.14] });
      for (const l of [-0.05, 0.05]) DC(A.box, M.trs([tip[0] + l, tip[1] - up[1] * 0.0, tip[2]], [phi, 0, 0], [0.012, 0.012, 0.16]), { color: [0.55, 0.55, 0.6], spec: 0.8 });
      // counterweight box and the winding rope
      DC(A.box, M.trs(P(PIV.d - 10, PIV.y + 14, 0), [phi - Math.PI / 2, 0, 0], [0.34, 0.26, 0.26]), { tex: A.tPlank, color: [0.55, 0.4, 0.28], spec: 0.15, uvScale: [0.5, 0.4] });
      DC(A.cyl, M.trs(P(138, baseY - 14, 0), [0, 0, Math.PI / 2], [0.1, 0.42, 0.1]), { color: [0.55, 0.45, 0.32], spec: 0.1 });
      if ((st.loaded && ammoLeft() && st.armV === 0) || st.armV > 0 || st.windup > 0) {
        const type = st.sel; if (type && (st.inv[type] > 0 || st.armV > 0 || st.windup > 0)) {
          let bp = M.xform(SW, [cupC[0] + up[0] * 0.08 * AMMO[type].r / 12, cupC[1] + up[1] * 0.08 * AMMO[type].r / 12, cupC[2] + up[2] * 0.08 * AMMO[type].r / 12]); st.cupPos = bp;
          let sc = 1;
          // the ball arcs up from the tray and drops into the cup
          if (st.loadAnim && st.loadAnim.type === type) { const k = Math.min(1, st.loadAnim.t), e = 1 - Math.pow(1 - k, 2), fr = st.loadAnim.from;
            const sx = fr ? fr.x + fr.w / 2 : W / 2, sy = fr ? fr.y + 30 : H - 40, a = E.unproject(sx, sy, -1), b = E.unproject(sx, sy, 1), dl = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1, from = [a[0] + (b[0] - a[0]) / dl * 0.9, a[1] + (b[1] - a[1]) / dl * 0.9, a[2] + (b[2] - a[2]) / dl * 0.9];
            bp = [from[0] + (bp[0] - from[0]) * e, from[1] + (bp[1] - from[1]) * e + Math.sin(k * Math.PI) * 0.45, from[2] + (bp[2] - from[2]) * e]; sc = 0.6 + 0.4 * e + (k > 0.85 ? Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.15 : 0); }
          drawBall(bp, type, AMMO[type].r * S * sc, st.loadAnim ? st.loadAnim.t * 8 : 0);
          if (st.loaded && !st.loadAnim) E.sprite(bp, AMMO[type].r * S * 4.5, [1, 0.85, 0.35], 0.18 + 0.08 * Math.sin(st.time * 5), true);
        }
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
      const M = E.M, d = b.data, s = d.w * S, panic = d.hitT > 0 || st.panicT > 0, t = st.time * (panic ? 18 : 3) + b.id;
      const hop = panic ? Math.abs(Math.sin(st.time * 14 + b.id)) * s * 0.25 : (Math.sin(st.time * 1.7 + b.id * 2) > 0.92 ? Math.abs(Math.sin(st.time * 11)) * s * 0.3 : 0); p = [p[0], p[1] + hop, p[2]];
      const m = M.trs(p, [-b.a + (panic ? Math.sin(t) * 0.12 : 0), Math.sin(st.time * 0.8 + b.id) * 0.4, 0], [1, 1 + Math.sin(t) * (panic ? 0.08 : 0.035), 1]);
      const bm = M.mul(m, M.trs([0, -s * 0.02, 0], [0, 0, 0], [s * 0.56, s * 0.5, s * 0.52]));
      E.draw(A.sphere, bm, { tex: A.tGoblin, color: [1, 1, 1], spec: 0.35, shine: 30 }); E.draw(A.sphere, bm, OUTLINE);
      // little arms: one waves a taunt, both flail when a shot is coming
      for (const sd of [-1, 1]) { const wave = panic ? Math.sin(t * 1.3 + sd) * 0.6 + 2.4 : sd > 0 ? 1.6 + Math.sin(st.time * 7 + b.id) * 0.6 : 0.5;
        const am = M.mul(m, M.mul(M.trs([sd * s * 0.5, s * 0.02, 0], [0, 0, sd * -wave]), M.trs([0, -s * 0.22, 0], [0, 0, 0], [s * 0.12, s * 0.44, s * 0.12]))); E.draw(A.cyl, am, { color: hex('#7cbf44'), spec: 0.3 }); E.draw(A.cyl, am, OUTLINE);
        const hm2 = M.mul(m, M.mul(M.trs([sd * s * 0.5, s * 0.02, 0], [0, 0, sd * -wave]), M.trs([0, -s * 0.46, 0], [0, 0, 0], [s * 0.13, s * 0.13, s * 0.13]))); E.draw(A.sphere, hm2, { color: hex('#8fd052'), spec: 0.3 }); }
      const hm = M.mul(m, M.trs([0, s * 0.2, -0.004], [0, 0, 0], [s * 0.56, s * 0.32, s * 0.55]));
      E.draw(A.sphere, hm, { color: [0.55, 0.58, 0.66], spec: 0.9, shine: 60 }); E.draw(A.sphere, hm, OUTLINE);
      const rim = M.mul(m, M.trs([0, s * 0.12, -0.004], [0, 0, 0], [s * 1.18, s * 0.05, s * 1.12])); E.draw(A.cyl, rim, { color: [0.45, 0.48, 0.55], spec: 0.8 }); E.draw(A.cyl, rim, OUTLINE);
      const nm = M.mul(m, M.trs([0, -s * 0.06, s * 0.55], [Math.PI / 2 + 0.3, 0, 0], [s * 0.16, s * 0.3, s * 0.16])); E.draw(A.cone, nm, { color: hex('#8fb84a'), spec: 0.3 }); E.draw(A.cone, nm, OUTLINE);
      const pl = M.mul(m, M.trs([0, s * 0.56, 0], [0, 0, 0], [s * 0.12, s * 0.22, s * 0.12])); E.draw(A.cone, pl, { color: hex('#e8463a'), spec: 0.5 }); E.draw(A.cone, pl, OUTLINE);
      for (const sd of [-1, 1]) { const em = M.mul(m, M.trs([sd * s * 0.68, s * 0.02, 0], [0, 0, sd * -1.3], [s * 0.2, s * 0.42, s * 0.08])); E.draw(A.cone, em, { color: hex('#9cc456'), spec: 0.3 }); E.draw(A.cone, em, OUTLINE); }
    }
    function scenery(M){
      E.draw(A.ground, M.trs([0, 0, -10], [0, 0, 0], [80, 1, 80]), { tex: A.tGrass, color: [0.46, 0.58, 0.42], spec: 0.05, uvScale: [14, 14] });
      // dirt walkways through the fair
      E.draw(A.flat, M.trs([0, 0.004, -12], [0, 0, 0], [2.4, 0.01, 16]), { tex: A.tDirt, color: [0.78, 0.7, 0.6], spec: 0.04, uvScale: [1.2, 8], noShadow: true });
      E.draw(A.flat, M.trs([0, 0.005, -21], [0, 0, 0], [26, 0.01, 2.2]), { tex: A.tDirt, color: [0.78, 0.7, 0.6], spec: 0.04, uvScale: [12, 1], noShadow: true });
      // woods and fences around the fairground
      const leaf = { color: [0.36, 0.62, 0.26], spec: 0.08 }, pine = { color: [0.2, 0.46, 0.26], spec: 0.06 };
      E.draw(A.trunks, M.trs([0, 0, 0], [0, 0, 0], 1), { color: [0.42, 0.28, 0.16], spec: 0.05 });
      E.draw(A.pines, M.trs([0, 0, 0], [0, 0, 0], 1), pine);
      E.draw(A.crowns, M.trs([0, 0, 0], [0, 0, 0], 1), leaf);
      E.draw(A.fence, M.trs([0, 0, 0], [0, 0, 0], 1), { tex: A.tPlank, color: [0.95, 0.85, 0.72], spec: 0.08, uvScale: [0.3, 0.3] });
      E.draw(A.hay, M.trs([0, 0, 0], [0, 0, 0], 1), { color: [0.78, 0.64, 0.34], spec: 0.05 });
      // hot-air balloons drifting over the hills
      for (const [bx, by, bz, ph] of [[-7, 5.2, -44, 0], [9, 6.4, -52, 2]]) {
        const x = bx + Math.sin(st.time * 0.05 + ph) * 3, y = by + Math.sin(st.time * 0.4 + ph) * 0.25;
        E.draw(A.sphere, M.trs([x, y, bz], [0, st.time * 0.1, 0], [1.4, 1.65, 1.4]), { tex: A.tBalloon, color: [1, 1, 1], spec: 0.25, shine: 20, noShadow: true });
        E.draw(A.box, M.trs([x, y - 2.25, bz], [0, 0, 0], [0.45, 0.32, 0.45]), { color: [0.55, 0.36, 0.2], noShadow: true });
        for (const sx of [-0.18, 0.18]) E.draw(A.flat, M.trs([x + sx, y - 1.75, bz], [0, 0, 0], [0.02, 0.7, 0.02]), { color: [0.3, 0.2, 0.1], noShadow: true });
        E.sprite([x, y - 1.95, bz], 0.4, [1, 0.6, 0.2], 0.6 + Math.sin(st.time * 9) * 0.2, true);
      }
      // a flock of birds gliding past
      for (let k=0;k<5;k++) { const tt = (st.time * 0.9 + k * 0.6) % 70 - 35, bx = tt + (k % 2) * 0.8, by = 4.6 + k * 0.25 + Math.sin(st.time + k) * 0.1, bz = -38 - k, flap = Math.sin(st.time * 9 + k) * 0.5;
        for (const sd of [-1, 1]) E.draw(A.flat, M.trs([bx + sd * 0.16, by, bz], [0, 0, sd * (0.35 + flap)], [0.34, 0.03, 0.08]), { color: [0.15, 0.13, 0.16], noShadow: true, unlit: true }); }
      // floating dandelion seeds and sparkles in the sunlight
      if (!reduceMotion) for (let k=0;k<16;k++) { const ph = k * 7.3, x = Math.sin(st.time * 0.13 + ph) * 3.2, y = 0.8 + ((st.time * 0.08 + k * 0.137) % 1) * 2.6, z = -2.5 - (k % 5) * 1.2; E.sprite([x, y, z], 0.05, [1, 0.97, 0.85], 0.55 + 0.35 * Math.sin(st.time * 3 + ph), true); }
      E.draw(A.quad, M.trs([0, 8.5, -60], [0, 0, 0], [140, 35, 1]), { tex: A.tBack, unlit: true, color: [0.98, 1, 1], blend: true, fogless: true, noShadow: true });
      // puffy clouds drifting over the fair
      for (let k=0;k<6;k++) { const cx = ((k * 23 + st.time * (0.6 + k * 0.1)) % 120) - 60, cy = 13 + (k % 3) * 2.5, cz = -55 - (k % 2) * 6;
        for (let q=0;q<5;q++) E.sprite([cx + (q - 2) * 2.2, cy + Math.sin(q * 1.7 + k) * 0.8 + (q === 2 ? 0.8 : 0), cz], 4.5 + (q === 2 ? 1.5 : 0), [1, 1, 1], 0.92, false); }
      // dirt patch under the table
      E.draw(A.flat, M.trs(W3(AIMD, GROUND, 0), [0, 0, 0], [5.5, 0.01, 4.2]), { color: [0.62, 0.5, 0.34], spec: 0.05, noShadow: true });
      // table
      const tw = 3.1, td = (TX1 - TX0 + 14) * S, tc = W3((TX0 + TX1) / 2, TABLE_Y + 10, 0);
      E.draw(A.flat, M.trs(tc, [0, 0, 0], [tw, 0.2, td]), { tex: A.tPlank, color: [0.78, 0.66, 0.56], spec: 0.35, shine: 40, uvScale: [2.4, 2.2] });
      // carved trim around the table top, with brass studs
      const trim = { tex: A.tPlank, color: [0.5, 0.33, 0.2], spec: 0.3, shine: 40, uvScale: [1, 0.15] };
      for (const sz of [-1, 1]) E.draw(A.flat, M.trs([0, tc[1] + 0.02, tc[2] + sz * (td / 2 + 0.03)], [0, 0, 0], [tw + 0.12, 0.26, 0.06]), trim);
      for (const sx of [-1, 1]) E.draw(A.flat, M.trs([sx * (tw / 2 + 0.03), tc[1] + 0.02, tc[2]], [0, 0, 0], [0.06, 0.26, td + 0.12]), trim);
      for (let i=0;i<9;i++) E.draw(A.sphere, M.trs([-tw / 2 + i * tw / 8, tc[1] + 0.04, tc[2] + td / 2 + 0.062], [0, 0, 0], 0.014), { color: [0.7, 0.55, 0.25], spec: 1.1, shine: 80, noShadow: true });
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
        E.draw(A.pennant, M.trs([x, y, bz], [0, 0, Math.sin(st.time * 3 + i) * 0.08], [0.13, 0.17, 1]), { color: hex(BANNERS[i % 5]), doubleSided: true, spec: 0.1, noShadow: true });
        if (i % 6 === 3) { const ly = y - 0.32 + Math.sin(st.time * 2 + i) * 0.015; E.draw(A.sphere, M.trs([x, ly, bz], [0, 0, 0], [0.09, 0.12, 0.09]), { color: [1, 0.75, 0.35], emissive: [1.6, 0.9, 0.3], noShadow: true }); E.sprite([x, ly, bz], 0.55, [1, 0.75, 0.35], 0.35 + 0.1 * Math.sin(st.time * 5 + i), true); } }
      // clouds
      for (const [x, y, z, s] of [[-30, 22, -70, 26], [18, 26, -75, 30], [45, 18, -68, 22], [-60, 16, -70, 24]]) E.sprite([x + Math.sin(st.time * 0.02) * 2, y, z], s, [1, 1, 1], 0.85, false, 0, A.tCloud);
    }
    function render(w, h, snapshot){
      const M = E.M;
      const shake = st.shake > 0 && !reduceMotion ? [(Math.random() - .5) * st.shake * 0.002, (Math.random() - .5) * st.shake * 0.002] : [0, 0];
      let eye = W3(-50, TABLE_Y - 150, 0), look = W3(AIMD + 10, TABLE_Y - 40, 0), fov = 0.86;
      // cinematic camera: lean towards what you're aiming at, and ride along with the shot
      if (!snapshot) {
        const aimW = W3(st.target.d, st.target.y, st.target.lat), ak = st.aim ? 0.18 : 0.08;
        look = look.map((v, i) => v + (aimW[i] - v) * ak * (i === 1 ? 0.3 : 1));
        if (st.camK > 0.001 && st.camF) { const k = st.camK; look = look.map((v, i) => v + (st.camF[i] - v) * 0.5 * k); eye = eye.map((v, i) => v + (st.camF[i] - v) * (i === 1 ? 0.08 : 0.2) * k); fov -= 0.18 * k; }
      }
      E.begin({ pos: [eye[0] + shake[0], eye[1] + shake[1], eye[2]], target: snapshot ? W3(AIMD, TABLE_Y - 40, 0) : look, fov: snapshot ? 0.62 : fov, near: 0.05, far: 200 }, {
        sunDir: [-0.45, -0.68, -0.55], sunColor: [2.35, 2.05, 1.7], ambSky: [0.42, 0.52, 0.76], ambGround: [0.3, 0.3, 0.2], toon: 0.65,
        fogColor: [0.78, 0.86, 0.95], fogDensity: 0.011, fogStart: 12,
        shadow: { center: W3(AIMD - 40, TABLE_Y, 0), radius: 3.4 },
        post: { bloom: 0.4, threshold: 0.88, saturation: 1.02, contrast: 1.12, vignette: 0.48, tint: [1.03, 0.99, 0.93] },
        sky: { zenith: [0.16, 0.42, 0.92], horizon: [0.96, 0.88, 0.74], ground: [0.5, 0.6, 0.4], sunColor: [1, 0.9, 0.7], sunSize: 1.6 },
      });
      scenery(M);
      if (st.boomLight && st.boomLight.t > 0) { E.light([st.boomLight.p[0], st.boomLight.p[1] + 0.3, st.boomLight.p[2]], [6 * st.boomLight.t / 0.35, 3 * st.boomLight.t / 0.35, 0.8], 3.5); st.boomLight.t -= 1 / 60; }
      for (const b of st.blocks) {
        const d = b.data; if (d.gone || d.off && b.y > GROUND + 200) continue;
        const L = st.lanes[d.lane], p = W3(b.x, b.y, L.lat);
        if (d.mat === 'goblin') { drawGoblin(b, p); if (st.preview && st.preview.block === b) E.sprite(p, 0.5, [1, 0.85, 0.3], 0.5 + 0.3 * Math.sin(st.time * 10), true); continue; }
        const mm = blockMeshes(d), m = M.trs(p, [-b.a, 0, 0], [1, 1, 1]);
        const flash = d.hitT > 0 ? d.hitT / 0.3 : 0;
        E.draw(mm.body, m, { tex: A.tStone[d.mat], color: [1, 1, 1], emissive: flash ? [0.4 * flash, 0.32 * flash, 0.2 * flash] : undefined, spec: d.mat === 'gray' ? 1.2 : d.mat === 'dark' ? 0.3 : 0.15, shine: d.mat === 'gray' ? 80 : 24, uvScale: mm.uv });
        E.draw(mm.body, m, st.preview && st.preview.block === b ? TARGET_OL : OUTLINE);
        const dmg = 1 - d.hp / d.maxHp;
        if (dmg > 0.2) E.draw(mm.body, M.mul(m, M.trs([0, 0, 0], [0, 0, 0], [1.006, 1.006, 1.006])), { tex: A.tCrack[dmg > 0.6 ? 1 : 0], blend: true, color: [1, 1, 1], alpha: Math.min(1, 0.4 + dmg), spec: 0, uvScale: mm.uv, noShadow: true });
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
      // aim guide: the real flight path, marching dots, and a marker where it will hit
      if (st.preview && st.loaded && !snapshot && !st.over) {
        const pv = st.preview, n = pv.pts.length, march = (st.time * 3) % 1;
        for (let i=1;i<n;i++) { const k = i / n, pulse = ((i * 0.25 - march) % 1 + 1) % 1, a = (st.aim ? 1 : 0.6);
          E.sprite(pv.pts[i], 0.11 + 0.025 * pulse, [0.2, 0.1, 0.02], 0.35 * a, false); E.sprite(pv.pts[i], 0.07 + 0.02 * pulse, [1, 0.97 - k * 0.2, 0.75 - k * 0.45], a, false); E.sprite(pv.pts[i], 0.05, [1, 0.8, 0.3], 0.35 * a * pulse, true); }
        const hp = pv.hit; if (hp) {
          const r = 0.12 + Math.sin(st.time * 8) * 0.015;
          E.draw(A.ring, M.trs(hp, [Math.PI / 2, 0, 0], [r, r, r]), { color: [1, 0.85, 0.3], emissive: [1.4, 1, 0.3], unlit: true, noShadow: true });
          E.sprite(hp, 0.32, [1, 0.8, 0.3], 0.6, true); E.sprite(hp, 0.1, [1, 1, 0.9], 1, true);
        }
      }
      // shockwaves where shots slam into the castle
      for (const w of st.waves) { const k = w.t / 0.5; E.sprite(w.p, (w.big ? 1.6 : 0.9) * (0.3 + k), w.fire ? [1, 0.6, 0.25] : [1, 0.95, 0.85], (1 - k) * 0.55, true); }
      for (const q of st.helmets) { const hm = M.trs(q.p, q.r, [q.s * 0.56, q.s * 0.32, q.s * 0.55]); E.draw(A.sphere, hm, { color: [0.62, 0.65, 0.72], spec: 1.1, shine: 70 }); E.draw(A.sphere, hm, OUTLINE); E.draw(A.cyl, M.trs(q.p, q.r, [q.s * 1.18, q.s * 0.05, q.s * 1.12]), { color: [0.5, 0.53, 0.6], spec: 0.8 }); }
      for (const q of st.debris || []) { const k = Math.min(1, q.life * 2); E.draw(A.chunk, M.trs(q.p, q.r, q.s * 2 * k), { color: q.col, spec: 0.2, noShadow: true }); }
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
      if (type === 'boulder' || type === 'stone') { g.fillStyle = 'rgba(0,0,0,.18)'; for (const [dx, dy, rr] of [[-0.3, 0.2, 0.18], [0.25, -0.1, 0.14], [0.1, 0.35, 0.1]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, rr * r, 0, 7); g.fill(); } }
      g.strokeStyle = 'rgba(40,24,10,.7)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    }
    function drawHUD(){
      if (st.flash) { ctx.fillStyle = `rgba(255,200,120,${st.flash})`; ctx.fillRect(0, 0, W, H); }
      // level card with a goblin for every one left to bonk
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(40,24,10,.66)'; ctx.beginPath(); ctx.roundRect(12, 12, 232, 70, 14); ctx.fill(); ctx.strokeStyle = 'rgba(224,180,60,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe9b8'; ctx.font = `24px ${FONT}`;
      ctx.fillText(st.mode === 'daily' ? 'Daily Siege' : `Level ${st.spec.n}`, 24, 40);
      ctx.font = `800 12px ${BODY}`; ctx.fillStyle = '#e8d3a6'; ctx.fillText('GOBLINS', 24, 63);
      const done = st.gobs || 0;
      for (let i=0;i<st.goblins;i++) { const x = 92 + i * 24, y = 59, hit = i < done;
        ctx.globalAlpha = hit ? 0.45 : 1; ctx.fillStyle = '#8fc44a'; ctx.beginPath(); ctx.arc(x, y + 2, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#9aa0ab'; ctx.beginPath(); ctx.arc(x, y - 1, 8.5, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#ffe96a'; ctx.beginPath(); ctx.arc(x - 3, y + 2, 1.8, 0, 7); ctx.arc(x + 3, y + 2, 1.8, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (hit) { ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 7, y - 6); ctx.lineTo(x + 7, y + 8); ctx.moveTo(x + 7, y - 6); ctx.lineTo(x - 7, y + 8); ctx.stroke(); } }
      ctx.textAlign = 'right'; ctx.font = `800 12px ${BODY}`; ctx.fillStyle = '#ffe9b8';
      ctx.fillText(`Castle wrecked ${Math.round(castleDone() * 100)}%`, W - 16, 30);
      // ammo tray: tap a ball to load it
      const types = AMMO_ORDER.filter(k => st.spec.ammo[k] > 0), n = types.length, bw = Math.min(88, (W - 28) / n - 6), ty = H - 78, total = n * (bw + 6) - 6, x0 = W / 2 - total / 2;
      ctx.fillStyle = 'rgba(40,24,10,.72)'; ctx.beginPath(); ctx.roundRect(x0 - 10, ty - 8, total + 20, 78, 16); ctx.fill(); ctx.strokeStyle = 'rgba(224,180,60,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.textAlign = 'left'; ctx.font = `900 11px ${BODY}`; ctx.fillStyle = 'rgba(40,24,10,.8)'; ctx.beginPath(); ctx.roundRect(x0 - 10, ty - 30, 118, 20, 10); ctx.fill(); ctx.fillStyle = '#ffd98a'; ctx.fillText('LOAD NEXT SHOT', x0, ty - 16); ctx.restore();
      st.trayRects = [];
      types.forEach((k, i) => {
        const x = x0 + i * (bw + 6), cnt = st.inv[k] || 0, sel = st.sel === k && cnt > 0;
        st.trayRects.push({ k, x, y: ty - 8, w: bw, h: 78 });
        ctx.save(); if (sel) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16; }
        ctx.fillStyle = sel ? '#f7e3a6' : cnt ? '#e8d3a6' : 'rgba(232,211,166,.35)'; ctx.beginPath(); ctx.roundRect(x, ty, bw, 62, 12); ctx.fill(); ctx.restore();
        ctx.strokeStyle = sel ? '#e0a800' : '#6b4423'; ctx.lineWidth = sel ? 3 : 1.5; ctx.beginPath(); ctx.roundRect(x, ty, bw, 62, 12); ctx.stroke();
        ctx.globalAlpha = cnt ? 1 : 0.35; drawBall2D(ctx, x + bw / 2, ty + 24, k, Math.min(15, AMMO[k].r * 0.75 + 4));
        ctx.fillStyle = '#3d2814'; ctx.textAlign = 'center'; ctx.font = `800 11px ${BODY}`; ctx.fillText(AMMO[k].name, x + bw / 2, ty + 55, bw - 6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = cnt ? '#a8322d' : '#7a5a3a'; ctx.beginPath(); ctx.arc(x + bw - 9, ty + 9, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff3d6'; ctx.font = `900 12px ${BODY}`; ctx.textBaseline = 'middle'; ctx.fillText(cnt, x + bw - 9, ty + 9.5); ctx.textBaseline = 'alphabetic';
      });
      // crosshair where the shot will land
      if (st.preview && st.preview.hit && st.loaded && !st.over) {
        const sp = E.project(st.preview.hit), a = st.aim ? 1 : 0.6;
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
        const r = 14 + Math.sin(st.time * 8) * 1.5;
        ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, 7); ctx.stroke();
        ctx.beginPath(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { ctx.moveTo(sp[0] + dx * (r - 6), sp[1] + dy * (r - 6)); ctx.lineTo(sp[0] + dx * (r + 8), sp[1] + dy * (r + 8)); } ctx.stroke();
        ctx.restore();
      }
      // the big FIRE button
      { const ready = st.loaded && st.inv[st.sel] > 0 && !st.over && st.windup === 0 && st.armV === 0, cx = W - 58, cy = H - 136, r = 38, pul = ready ? 1 + Math.sin(st.time * 5) * 0.05 : 0.92;
        st.fireRect = { x: cx, y: cy, r: r + 8 };
        ctx.save(); ctx.translate(cx, cy); ctx.scale(pul, pul); ctx.globalAlpha = ready ? 1 : 0.45;
        ctx.fillStyle = 'rgba(40,10,0,.45)'; ctx.beginPath(); ctx.arc(2, 5, r, 0, 7); ctx.fill();
        const fg = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 4, 0, 0, r); fg.addColorStop(0, '#ffb35a'); fg.addColorStop(0.6, '#e8461c'); fg.addColorStop(1, '#a8240c');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.45, r * 0.4, r * 0.18, -0.4, 0, 7); ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `24px ${FONT}`; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#5a1606'; ctx.strokeText('FIRE!', 0, 2); ctx.fillStyle = '#fff6dc'; ctx.fillText('FIRE!', 0, 2);
        ctx.restore(); }
      // comic-book bursts on big hits
      for (const c of st.comics) {
        const sp = E.project(c.p), k = c.t / 0.9, sc = (c.t < 0.12 ? c.t / 0.12 * 1.25 : 1.25 - Math.min(0.25, (c.t - 0.12) * 1.2)) * (c.big ? 1.25 : 1), a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(sp[0], sp[1] - 40 - c.t * 30); ctx.scale(sc, sc); ctx.rotate(-0.12);
        ctx.beginPath(); for (let i=0;i<18;i++) { const an = i / 18 * Math.PI * 2, rr = i % 2 ? 26 : 44; ctx.lineTo(Math.cos(an) * rr * 1.25, Math.sin(an) * rr * 0.85); } ctx.closePath();
        ctx.fillStyle = c.col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2b1408'; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `26px ${FONT}`; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#2b1408'; ctx.strokeText(c.text, 0, 2); ctx.fillStyle = '#ffffff'; ctx.fillText(c.text, 0, 2);
        ctx.restore();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) {
        const sp = E.project(q.p);
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = `26px ${FONT}`;
        ctx.lineWidth = 5; ctx.strokeStyle = '#3d2814'; ctx.lineJoin = 'round'; ctx.strokeText(q.text, sp[0], sp[1] - q.rise);
        ctx.fillStyle = q.color; ctx.fillText(q.text, sp[0], sp[1] - q.rise); ctx.restore();
      }
      if (st.phase === 'play' && !st.lastFire && !st.aim && !st.over) {
        ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(st.time * 3); ctx.font = `700 15px ${BODY}`;
        const msg = 'Drag anywhere to aim, then tap FIRE!'; const tw = Math.min(W - 24, ctx.measureText(msg).width + 32);
        ctx.fillStyle = 'rgba(40,24,10,.82)'; ctx.beginPath(); ctx.roundRect(W/2 - tw/2, 98, tw, 38, 19); ctx.fill();
        ctx.fillStyle = '#fff3d6'; ctx.fillText(msg, W/2, 118, W - 40);
        ctx.restore();
      }
    }
    function draw(){
      if (!loadAssets()) { ctx.fillStyle = '#2a1a0c'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '700 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('This game needs a device with 3D graphics.', W/2, H/2); return; }
      E.resize(W, H, E.quality(1.5)); render(W, H);
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
    // Aiming: the crosshair sits a little above your finger (so you can see it) on whatever block or patch of
    // table is there. The catapult works out a lob to that spot and shows the path and what it will hit first.
    const AIM_LIFT = 58;
    function aimAt(x, y, touch){
      const sy = y - (touch === false ? 0 : AIM_LIFT);
      const a = E.unproject(x, sy, -1), b = E.unproject(x, sy, 1), dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      let best = null, bt = Infinity;
      for (const blk of st.blocks) {
        const d = blk.data; if (d.off) continue;
        const L = st.lanes[d.lane], c = W3(blk.x, blk.y, L.lat), h = [d.lat * S, blk.hh * S, blk.hw * S];
        const ca = Math.cos(blk.a), sa = Math.sin(blk.a);
        // ray into the block's own frame (blocks only tip forwards/backwards, around the sideways axis)
        const o = [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
        const ro = [o[0], o[1] * ca - o[2] * sa, o[1] * sa + o[2] * ca], rd = [dir[0], dir[1] * ca - dir[2] * sa, dir[1] * sa + dir[2] * ca];
        let t0 = -Infinity, t1 = Infinity, ok = true;
        for (let k=0;k<3;k++) { if (Math.abs(rd[k]) < 1e-9) { if (Math.abs(ro[k]) > h[k]) { ok = false; break; } continue; } let u = (-h[k] - ro[k]) / rd[k], v = (h[k] - ro[k]) / rd[k]; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) { ok = false; break; } }
        if (ok && t0 > 0 && t0 < bt) { bt = t0; best = blk; }
      }
      let P;
      if (best) P = [a[0] + dir[0] * bt, a[1] + dir[1] * bt, a[2] + dir[2] * bt];
      else { const yt = (GROUND - TABLE_Y) * S, t = (yt - a[1]) / dir[1]; P = t > 0 ? [a[0] + dir[0] * t, yt, a[2] + dir[2] * t] : [a[0] + dir[0] * 4, a[1] + dir[1] * 4, a[2] + dir[2] * 4]; }
      st.target = { lat: Math.max(-200, Math.min(200, P[0] / S)), y: Math.max(TABLE_Y - 300, Math.min(TABLE_Y, GROUND - P[1] / S)), d: Math.max(TX0 - 20, Math.min(TX1 + 60, -P[2] / S)) };
      updatePreview();
    }
    // lock the crosshair onto a goblin (unless you are already aiming at something still standing)
    function autoAim(){
      if (st.preview && st.preview.block && !st.preview.block.data.off) { updatePreview(); return; }
      const gobs = st.blocks.filter(b => b.data.mat === 'goblin' && !b.data.off); if (!gobs.length) return;
      const cur = st.target; let best = gobs[0], bd = Infinity;
      for (const g of gobs) { const L = st.lanes[g.data.lane], dd = Math.abs(L.lat - cur.lat) + Math.abs(g.x - cur.d) * 0.5; if (dd < bd) { bd = dd; best = g; } }
      st.target = { d: best.x, y: best.y, lat: st.lanes[best.data.lane].lat }; updatePreview();
    }
    // a crosshair close to a goblin sticks to it
    function snapToGoblin(x, y){
      let best = null, bd = 30;
      for (const g of st.blocks) { if (g.data.mat !== 'goblin' || g.data.off) continue; const sp = E.project(W3(g.x, g.y, st.lanes[g.data.lane].lat)), d = Math.hypot(sp[0] - x, sp[1] - y); if (d < bd) { bd = d; best = g; } }
      if (best) { st.target = { d: best.x, y: best.y, lat: st.lanes[best.data.lane].lat }; updatePreview(); }
    }
    function updatePreview(){
      const v = launchVelocity(st.target); st.fireV = v;
      st.preview = simulate(v, AMMO[st.sel] ? AMMO[st.sel].r : 12);
    }

    return {
      id:'castle', sfxScore:false, music:'castle', title:'CASTLE CRASH', W, H, statLabel:'Ammo', type:'levels', levels:100, maxLives:0,
      failTitle:'Out of ammo', dailyText:'One giant fortress a day', powersTitle:'Catapult ammo',
      tile:{ order:7, name:'Castle Crash', kind:'Medieval catapult \u00b7 100 levels', art: artTile, isNew: true },
      controls: ['Bonk every goblin in a helmet to win!', 'The crosshair starts on a goblin. Drag anywhere on the screen to move it, or tap a spot to aim right there. It sticks to goblins when it gets close.', 'The glowing path shows exactly what your shot will hit first. Tap the big FIRE! button to launch.', 'Tap a ball in the LOAD NEXT SHOT tray to load it: save iron balls for stone walls and fire pots for big clusters. You can pick your next ball while a shot is still flying.', 'Blocks crack when they are hit hard and smash after enough hits. Wood breaks easily, ice takes more, stone is the toughest.', 'Wreck at least half the castle and keep a shot spare for 3 stars.'],
      powers: AMMO_ORDER.map(k => ({ name: AMMO[k].name, desc: AMMO[k].desc, icon: g => drawBall2D(g, 23, 14, k, 11) })),
      init(){ loadAssets(); },
      preview(){ fresh('classic', 1); st.phase = 'menu'; },
      start(mode, rand, lives, msg, level){ fresh(mode, level === 'daily' ? 1 : level); },
      frame(dt){ update(dt); draw(); },
      hud(){ return { lives: null, stat: ammoLeft(), score: st.score }; },
      metrics(){ return { score: st.score, blocks: st.knocked - (st.gobs || 0), goblins: st.gobs || 0, left: st.over && st.win ? ammoLeft() : 0, won: st.over && st.win ? 1 : 0 }; },
      dailyGoals: [
        { text:'Smash or knock off {n} castle blocks', m:'blocks', n:[10, 14, 18] },
        { text:'Bonk every goblin with {n} shots to spare', m:'left', n:[1, 2] },
        { text:'Bonk {n} goblins', m:'goblins', n:[3, 4] },
      ],
      // Aiming: drag anywhere (like a trackpad) to move the crosshair, or tap a spot to aim right at it.
      // It sticks to goblins when it gets close. Nothing fires until you tap the FIRE button.
      pointerDown(x, y){
        if (st.over || !E) return;
        const tr = st.trayRects.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (tr) { if (st.inv[tr.k] > 0 && st.sel !== tr.k) { st.sel = tr.k; if (st.loaded && st.armV === 0 && st.windup === 0) loadBall(tr.k); else if (PB.sfx) PB.sfx('pick'); pop(W3(LAUNCH.d, LAUNCH.y - 40, 0), AMMO[tr.k].name + (st.loaded ? ' loaded!' : ' is next!'), '#ffe08a', 0.9); if (st.preview) updatePreview(); } return; }
        if (st.fireRect && Math.hypot(x - st.fireRect.x, y - st.fireRect.y) < st.fireRect.r) { fireNow(); return; }
        const tri = st.shots.find(s => s.data.type === 'triple' && !s.data.split);
        if (tri) { split(tri); return; }
        const sp = E.project(W3(st.target.d, st.target.y, st.target.lat));
        st.touch = { x0: x, y0: y, moved: false, rx: sp[0], ry: sp[1], t: st.time }; st.aim = true;
      },
      pointerMove(x, y){
        const T = st.touch; if (!T) return;
        if (!T.moved && Math.hypot(x - T.x0, y - T.y0) > 10) T.moved = true;
        if (!T.moved) return;
        const rx = Math.max(10, Math.min(W - 10, T.rx + (x - T.x0) * 1.15)), ry = Math.max(60, Math.min(H - 100, T.ry + (y - T.y0) * 1.15));
        aimAt(rx, ry, false); snapToGoblin(rx, ry);
      },
      pointerUp(x, y){
        const T = st.touch; if (!T) return;
        st.touch = null; st.aim = null;
        if (!T.moved && y < H - 90) { aimAt(x, y, false); snapToGoblin(x, y); if (PB.sfx) PB.sfx('pick'); }
      },
      debug(){ return { st, step(n){ for (let i=0;i<n;i++) update(1 / 60); }, aim(d, y, lat){ st.target = { d, y, lat }; updatePreview(); return st.preview; }, fire(d, y, lat, type){ if (type) st.sel = type; st.target = { d, y, lat }; updatePreview(); st.armV = 9; st.loaded = false; } }; },
      key(e){
        if (!st || st.over) return;
        const m = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
        if (m) { e.preventDefault(); st.target.lat = Math.max(-200, Math.min(200, st.target.lat + m[0])); st.target.d = Math.max(TX0 - 20, Math.min(TX1 + 60, st.target.d + m[1])); updatePreview(); }
        const num = '12345'.indexOf(e.key); if (num >= 0) { const types = AMMO_ORDER.filter(k => st.inv[k] > 0); if (types[num]) st.sel = types[num]; }
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fireNow(); }
      },
    };
  }
  PB.register(createCastle);
})();
