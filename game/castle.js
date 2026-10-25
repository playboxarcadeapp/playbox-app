// CASTLE CRASH: a side-view catapult game. Pull the ball back in the sling, let go, and knock the
// helmeted goblins off their castles. Physics runs in a 2D rigid-body world (x right, y down);
// everything is drawn in 3D from the side with layered hills behind for depth.
(function(){
  const { reduceMotion, ctx, mulberry, seedFrom, shade } = PB;

  function createCastle(shell){
    const W = 480, H = 720, G = 900, S = 0.01, GROUND = 600, DEPTH = 46;
    const SLX = 112, REST = { x: SLX, y: GROUND - 146 }, MAXPULL = 96, VMAX = 820, SPK = 3;
    const FONT = '"MedievalSharp", "Georgia", serif';
    const BODY = '"Nunito", "Segoe UI", sans-serif';
    const MAT = {
      sand: { d: 1.7, hp: 95,  base: '#d99c52', name:'Wood', look:'wood' },
      gray: { d: 2.6, hp: 150, base: '#a9e6ff', name:'Ice', look:'ice' },
      dark: { d: 4.2, hp: 270, base: '#b9bec8', name:'Stone', look:'stone' },
      wood: { d: 1.1, hp: 75,  base: '#d98f4a', name:'Oak', look:'wood' },
      goblin: { d: 1.0, hp: 115, base: '#7ccf4a', name:'Goblin', look:'goblin' },
    };
    const AMMO = {
      stone:  { name:'Stone',       r: 13, d: 11, hit: 1.15, color:'#8d8a86', desc:'A trusty round rock. Good all-rounder' },
      triple: { name:'Triple shot', r: 10, d: 11, hit: 0.85, color:'#a3876a', desc:'Tap while it flies to split it into three' },
      iron:   { name:'Iron ball',   r: 14, d: 26, hit: 2.7, color:'#3d4048', desc:'Very heavy. Cracks stone and smashes walls' },
      fire:   { name:'Fire pot',    r: 13, d: 6,  hit: 0.6, color:'#e8641c', desc:'Explodes and blasts everything nearby' },
      boulder:{ name:'Boulder',     r: 21, d: 10, hit: 1.9, color:'#9a8f80', desc:'A huge rock that rolls through towers' },
    };
    const AMMO_ORDER = ['stone', 'triple', 'iron', 'fire', 'boulder'];
    const BANNERS = ['#b3261e','#1f4fa8','#e0a800','#2e7d32','#6a1b9a'];
    const ROOFS = ['#9e2a22','#2b4f9a','#3f6b45','#7a3d8f'];
    const INK = { color: [0.16, 0.09, 0.05], unlit: true, outline: 0.0055, noShadow: true };
    let st = null, E = null, A = null;
    const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    const P3 = (x, y, z = 0) => [x * S, (GROUND - y) * S, z * S];

    // ---------- Level design ----------
    // Castles get bigger level by level: taller towers, more goblins (some hiding inside), tougher ice and
    // stone, rock pedestals from level 8, shield walls from level 10 and fewer spare shots.
    function levelSpec(n, R){
      const blocks = [], statics = [];
      const pStone = Math.min(0.6, Math.max(0, (n - 6) / 45)), pIce = Math.min(0.45, Math.max(0, (n - 2) / 28));
      const mat = () => { const r = R(); return r < pStone ? 'dark' : r < pStone + pIce ? 'gray' : r < 0.93 ? 'sand' : 'wood'; };
      const add = (x, yBottom, w, h, type, m) => { blocks.push({ x, y: yBottom - h / 2, w, h, type, mat: m || mat(), flag: R() < 0.35 ? BANNERS[Math.floor(R() * BANNERS.length)] : null, roof: ROOFS[Math.floor(R() * ROOFS.length)] }); return yBottom - h; };
      const goblin = (x, yBottom) => blocks.push({ x, y: yBottom - 17, w: 34, h: 34, type: 'goblin', mat: 'goblin' });
      const B = {
        tower(x, k, y){ k = Math.min(k, 6); for (let i=0;i<k;i++) y = add(x, y, i % 2 ? 36 : 44, i % 2 ? 62 : 44, i % 2 ? 'tower' : 'keep'); return y; },
        arch(x, k, y){ const y1 = add(x - 34, y, 24, 62, 'tower'); add(x + 34, y, 24, 62, 'tower'); y = add(x, y1, 104, 20, 'wall'); for (let i=0;i<k;i++) y = add(x, y, 40, 40, 'keep'); return y; },
        pyramid(x, k, y){ const rows = Math.min(k, groups === 3 ? 3 : 4); let top = y; for (let r=0;r<rows;r++) for (let i=0;i<rows - r;i++) top = Math.min(top, add(x + (i - (rows - r - 1) / 2) * 42, y - r * 40, 40, 40, 'keep')); return top; },
        walls(x, k, y){ for (let i=0;i<k;i++) y = add(x, y, 84, 24, 'wall'); return y; },
        // classic "rooms": posts and planks with a goblin sitting inside each floor
        rooms(x, k, y){ for (let i=0;i<Math.min(k, 3);i++) { add(x - 38, y, 22, 62, 'post'); add(x + 38, y, 22, 62, 'post'); if (i > 0 || R() < 0.7) goblin(x, y); y = add(x, y - 62, 104, 18, 'wall'); } return y; },
        fortress(x, k, y){ const y1 = add(x - 46, y, 28, 72, 'tower'); add(x + 46, y, 28, 72, 'tower'); add(x, y, 40, 40, 'keep'); y = add(x, y1, 136, 18, 'wall'); add(x - 44, y, 32, 32, 'keep'); add(x + 44, y, 32, 32, 'keep'); y = add(x, y, 36, 58, 'tower'); for (let i=1;i<k;i++) y = add(x, y, 34, 34, 'keep'); return y; },
      };
      const groups = n < 4 ? 1 : n < 12 ? 2 : (n < 24 || n % 2) ? 2 : 3;
      const kinds = n < 3 ? ['tower'] : n < 6 ? ['tower', 'walls'] : n < 10 ? ['tower', 'walls', 'arch', 'rooms'] : n < 18 ? ['tower', 'arch', 'pyramid', 'rooms'] : groups === 3 ? ['arch', 'pyramid', 'rooms', 'tower'] : ['arch', 'pyramid', 'fortress', 'rooms', 'fortress'];
      const xs = groups === 1 ? [n < 3 ? 470 : 510] : groups === 2 ? [445, 590] : [405, 530, 655];
      const size = 2 + Math.min(5, Math.floor(n / 6));
      const wantGobs = Math.min(8, 1 + Math.floor(n / 4));
      const freeTop = b => !blocks.some(o => o !== b && Math.abs((o.y + o.h / 2) - (b.y - b.h / 2)) < 3 && Math.abs(o.x - b.x) < (o.w + b.w) / 2 - 4);
      for (let g=0; g<groups; g++) {
        let kind = kinds[Math.floor(R() * kinds.length)];
        if (groups >= 2 && (kind === 'fortress' || kind === 'pyramid') && g > 0 && R() < 0.6) kind = 'tower';
        let base = GROUND;
        // castles on rocky hills from level 8 (only narrow castles fit on a hill)
        const pw = groups === 1 ? 200 : groups === 2 ? 136 : 118;
        if (n >= 8 && R() < Math.min(0.7, 0.25 + n / 80)) { const ph = 40 + Math.floor(R() * Math.min(90, 20 + n * 2)); statics.push({ x: xs[g], y: GROUND - ph / 2, w: pw, h: ph }); base = GROUND - ph; if (kind === 'pyramid' || kind === 'fortress' || kind === 'walls') kind = ['tower', 'arch', 'rooms'][Math.floor(R() * 3)]; }
        const k = Math.max(kind === 'tower' ? 3 : 1, size + Math.floor(R() * 2));
        const top = B[kind](xs[g], k, base);
        if (kind !== 'rooms' || R() < 0.6) goblin(xs[g], top);
        if (n >= 10 && g === 0 && base === GROUND && R() < Math.min(0.85, 0.35 + n / 60)) add(xs[g] - 95, base, 20, Math.min(110, 46 + n * 1.1), 'wall', n >= 25 ? 'dark' : 'gray');
      }
      // extra goblins sit on free ledges
      let extra = wantGobs - blocks.filter(b => b.type === 'goblin').length, guard = 0;
      while (extra > 0 && guard++ < 40) {
        const ledges = blocks.filter(b => b.type !== 'goblin' && b.type !== 'post' && freeTop(b) && b.w >= 32 && b.y - b.h / 2 < GROUND - 30);
        if (!ledges.length) break;
        const b = ledges[Math.floor(R() * ledges.length)]; goblin(b.x, b.y - b.h / 2); extra--;
      }
      const gobs = blocks.filter(b => b.type === 'goblin').length;
      const spare = n <= 3 ? 3 : n <= 30 ? 2 : 1;
      const total = Math.min(14, Math.round(gobs * 1.5) + spare + Math.floor(blocks.length / 16));
      const ammo = { stone: 0, triple: 0, iron: 0, fire: 0, boulder: 0 };
      if (n >= 3) ammo.triple = 1 + (n >= 20 && R() < 0.5 ? 1 : 0);
      if (n >= 4) ammo.iron = 1 + (n >= 15 ? 1 : 0);
      if (n >= 6) ammo.fire = 1 + (n >= 30 ? 1 : 0);
      if (n >= 9) ammo.boulder = 1;
      ammo.stone = Math.max(1, total - (ammo.triple + ammo.iron + ammo.fire + ammo.boulder));
      return { n, blocks, statics, ammo, maxX: xs[xs.length - 1] + 110 };
    }

    // ---------- World ----------
    function makeWorld(spec){
      const P = PB.physics, w = new P.World(G);
      w.add(P.makeBox(800, GROUND + 100, 5000, 200, 0, { friction: 0.85, data: { ground: true } }));
      for (const s of spec.statics) w.add(P.makeBox(s.x, s.y, s.w, s.h, 0, { friction: 0.85, data: { rock: true } }));
      w.onContact = (a, b, cs) => {
        if (!st || !st.armed) return;
        const c = cs[0], vn = c ? Math.abs((b.vx - a.vx) * c.nx + (b.vy - a.vy) * c.ny) : 0;
        hurt(a, b, vn); hurt(b, a, vn);
        const shot = a.data && a.data.shot ? a : b.data && b.data.shot ? b : null, other = shot === a ? b : a;
        if (!shot) return;
        if (shot.data.type === 'fire' && !shot.data.burst && other.data && (other.data.block || other.data.ground || other.data.rock)) st.pendingBurst.push(shot);
        if (other.data && other.data.block && !shot.data.thud) {
          shot.data.thud = true; st.shake = Math.max(st.shake, Math.min(18, 6 + vn / 50));
          const p = [shot.x, shot.y]; dust(p, MAT[other.data.mat].base, 10); chunks(p, MAT[other.data.mat].base, 8);
          if (vn > 220 && !reduceMotion) { if (!shot.data.slowed && shot.data.main) { shot.data.slowed = true; st.slow = 0.4; } st.comics.push({ p, t: 0, text: ['POW!', 'BAM!', 'CRASH!', 'WHAM!', 'KA-BOOM!'][Math.floor(Math.random() * 5)], col: ['#ffd23f', '#ff7a2a', '#5ee0ff', '#ff4f8b'][Math.floor(Math.random() * 4)], big: vn > 380 }); }
          if (!reduceMotion) st.waves.push({ p, t: 0, big: vn > 320 });
          if (PB.sfx) PB.sfx('crash');
        }
      };
      return w;
    }
    function hurt(body, other, vn){
      const d = body.data; if (!d || !d.block || d.off || d.broken) return;
      const mO = other.invM ? 1 / other.invM : 40, mS = body.invM ? 1 / body.invM : 40;
      const k = other.data && other.data.shot ? (AMMO[other.data.type].hit || 1) : 1;
      const dmg = Math.max(0, vn - 110) * (mO / (mO + mS)) * 0.5 * k;
      if (dmg <= 0) return;
      d.hp -= dmg; d.hitT = 0.3; d.wob = 1;
      if (d.hp <= 0) d.broken = true;
      else if (d.mat === 'goblin' && dmg > 20 && !d.ouch) { d.ouch = 0.6; pop([body.x, body.y - 30], 'Ouch! Hit him again!', '#ffe08a', 1.1); }
    }
    function ammoLeft(){ return AMMO_ORDER.reduce((n, k) => n + (st.inv[k] || 0), 0); }
    function pickAmmo(){ if (st.inv[st.sel] > 0) return; st.sel = AMMO_ORDER.find(k => st.inv[k] > 0) || st.sel; }
    function fresh(mode, level){
      const R = mode === 'daily' ? mulberry(seedFrom('castle-daily-' + PB.today())) : mulberry(seedFrom('castle2-' + level));
      const spec = levelSpec(mode === 'daily' ? 35 : level, R), P = PB.physics;
      st = { mode, level, spec, blocks: [], inv: { ...spec.ammo }, sel: 'stone', shots: [], score: 0, knocked: 0, broken: 0, phase: 'play', armed: false,
        loaded: true, reload: 0, parts: [], pops: [], waves: [], comics: [], helmets: [], debris: [], time: 0, shake: 0, settle: 0, over: false, endTimer: null, pendingBurst: [], lastFire: 0,
        pull: null, drag: null, band: 0, bandV: 0, slow: 0, loadAnim: null, fwIn: 0, trayRects: [], preview: null, cam: null, camShot: null, camHold: 0, flash: 0 };
      st.world = makeWorld(spec); st.world.iters = 16;
      st.blocks = spec.blocks.map(b => { const hp = MAT[b.mat].hp * (b.type === 'wall' ? 1.15 : 1); const body = P.makeBox(b.x, b.y, b.w, b.h, MAT[b.mat].d, { friction: 0.95, data: { block: true, ...b, hp, maxHp: hp } }); st.world.add(body); return body; });
      for (let i=0;i<300;i++) st.world.step(1 / 120);
      for (const b of st.blocks) { b.vx = b.vy = b.w = 0; b.data.y0 = b.y; b.data.a0 = b.a; b.data.x0 = b.x; }
      st.armed = true; pickAmmo();
      st.goblins = st.blocks.filter(b => b.data.mat === 'goblin').length;
    }
    function fire(vx, vy){ if (PB.sfx) { PB.sfx('launch'); PB.sfx('whoosh'); }
      const type = st.sel; if (!(st.inv[type] > 0)) return;
      st.inv[type]--;
      const Am = AMMO[type], P = PB.physics;
      const ball = P.makeCircle(REST.x + st.pull.dx, REST.y + st.pull.dy, Am.r, Am.d * 1.1, { friction: 0.6, data: { shot: true, type, main: true } });
      ball.vx = vx; ball.vy = vy; ball.age = 0;
      st.world.add(ball); st.shots.push(ball); st.camShot = ball;
      st.loaded = false; st.reload = 0; st.lastFire = st.time; st.preview = null; st.loadAnim = null;
      st.bandV = -14; st.band = 1; st.pull = null;
      if (!reduceMotion) for (let i=0;i<10;i++) st.parts.push({ p: [REST.x, REST.y, 0], v: [(Math.random() - .5) * 60, (Math.random() - .5) * 60, (Math.random() - .5) * 30], life: 0.5, max: 0.5, color: [1, 0.95, 0.75], size: 0.05, add: true, g: 0 });
    }
    function launchV(pull){ const k = Math.min(1, Math.hypot(pull.dx, pull.dy) / MAXPULL), L = Math.hypot(pull.dx, pull.dy) || 1; return { vx: -pull.dx / L * k * VMAX, vy: -pull.dy / L * k * VMAX }; }
    // where the shot will go (the dots fade out part way, like the real thing)
    function simulate(v, r){
      let x = REST.x + st.pull.dx, y = REST.y + st.pull.dy, vy = v.vy; const pts = [], dt = 1 / 60;
      for (let i=0;i<240;i++) {
        x += v.vx * dt; y += vy * dt; vy += G * dt;
        if (i % 3 === 0) pts.push([x, y]);
        if (y + r >= GROUND) break;
        let hit = false; for (const b of st.blocks) { if (b.data.off) continue; const dx = x - b.x, dy = y - b.y, c = Math.cos(b.a), s = Math.sin(b.a), lx = c * dx + s * dy, ly = -s * dx + c * dy; if (Math.abs(lx) <= b.hw + r && Math.abs(ly) <= b.hh + r) { hit = true; break; } }
        for (const s of st.spec.statics) if (Math.abs(x - s.x) < s.w / 2 + r && Math.abs(y - s.y) < s.h / 2 + r) hit = true;
        if (hit) break;
      }
      return pts;
    }
    function split(ball){
      if (ball.data.split) return; ball.data.split = true;
      const P = PB.physics, sp = Math.hypot(ball.vx, ball.vy), an = Math.atan2(ball.vy, ball.vx);
      for (const da of [-0.2, 0.2]) { const b = P.makeCircle(ball.x, ball.y, ball.r, 12, { friction: 0.6, data: { shot: true, type: 'triple', split: true } }); b.vx = Math.cos(an + da) * sp; b.vy = Math.sin(an + da) * sp; b.age = ball.age; st.world.add(b); st.shots.push(b); }
      for (let i=0;i<12;i++) st.parts.push({ p: [ball.x, ball.y, 0], v: [(Math.random() - .5) * 200, (Math.random() - .5) * 200, (Math.random() - .5) * 80], life: .4, max: .4, color: [1, 0.95, 0.75], size: 0.06, add: true, g: 0 });
      if (PB.sfx) PB.sfx('pick');
    }
    function explode(shot){ if (PB.sfx) PB.sfx('boom');
      shot.data.burst = true; shot.dead = true;
      for (const b of st.blocks) { const dx = b.x - shot.x, dy = b.y - shot.y, d = Math.hypot(dx, dy);
        if (d < 120 && d > 0 && !b.data.off) { const k = (1 - d / 120) * 520; b.vx += dx / d * k; b.vy += dy / d * k - 160 * (1 - d / 120); b.w += (Math.random() - .5) * 6; b.data.hp -= 150 * (1 - d / 120); b.data.hitT = 0.3; if (b.data.hp <= 0) b.data.broken = true; } }
      st.shake = 16; st.flash = 0.25;
      const p = [shot.x, shot.y];
      if (!reduceMotion) for (let i=0;i<46;i++) { const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 260; st.parts.push({ p: [p[0], p[1], 0], v: [Math.cos(a) * s, Math.sin(a) * s, (Math.random() - .5) * 120], life: 0.8, max: 0.8, color: [[1, 0.7, 0.15], [1, 0.35, 0.1], [1, 0.9, 0.5]][i % 3], size: 0.13 + Math.random() * 0.14, add: true, g: 300 }); }
      for (let i=0;i<14;i++) st.parts.push({ p: [p[0] + (Math.random() - .5) * 30, p[1], 0], v: [(Math.random() - .5) * 60, -60 - Math.random() * 60, 0], life: 1.6, max: 1.6, color: [0.35, 0.33, 0.32], size: 0.3 + Math.random() * 0.3, grow: 0.5, g: 0 });
      chunks(p, '#6b4a2a', 14, 1.6); st.boomLight = { p, t: 0.35 }; if (!reduceMotion) st.waves.push({ p, t: 0, big: true, fire: true });
      st.comics.push({ p, t: 0, text: 'BOOM!', col: '#ff7a1f', big: true });
    }
    function pop(p, text, color, life){ st.pops.push({ p, text, color, life: life || 1.1, rise: 0 }); }
    // debris and dust live in world units (x, y like the physics; z in front/behind)
    function chunks(p, col, n, power = 1){ if (reduceMotion) return; const c = hex(col); for (let i=0;i<n;i++) st.debris.push({ p: [p[0] + (Math.random() - .5) * 14, p[1] + (Math.random() - .5) * 14, (Math.random() - .5) * 30], v: [(Math.random() - .5) * 260 * power, (-80 - Math.random() * 200) * power, (Math.random() - .5) * 120], r: [Math.random() * 6, Math.random() * 6, Math.random() * 6], vr: [(Math.random() - .5) * 12, (Math.random() - .5) * 12, (Math.random() - .5) * 12], s: 4 + Math.random() * 5, col: c.map(v => v * (0.75 + Math.random() * 0.3)), life: 2.2 }); }
    function dust(p, col, n){ if (reduceMotion) return; const c = hex(col).map(v => v * 0.85 + 0.1); for (let i=0;i<n;i++) st.parts.push({ p: [p[0] + (Math.random() - .5) * 20, p[1] + (Math.random() - .5) * 20, (Math.random() - .5) * 20], v: [(Math.random() - .5) * 140, -Math.random() * 140, (Math.random() - .5) * 60], life: 0.7, max: 0.7, color: c, size: 0.1 + Math.random() * 0.12, g: 200, grow: 0.15 }); }
    function bonkFx(b){
      if (reduceMotion) return;
      st.helmets.push({ p: [b.x, b.y - 12, 0], v: [(Math.random() - .5) * 160 + 60, -320 - Math.random() * 120, 60 + Math.random() * 60], r: [0, 0, 0], vr: [(Math.random() - .5) * 14, (Math.random() - .5) * 10, (Math.random() - .5) * 14], life: 2.4 });
      st.comics.push({ p: [b.x, b.y], t: 0, text: 'BONK!', col: '#9cff5a', big: true });
      for (let k=0;k<8;k++) st.parts.push({ p: [b.x, b.y - 20, 0], v: [Math.cos(k) * 90, -90 + Math.sin(k) * 30, Math.sin(k * 2) * 40], life: 0.9, max: 0.9, color: [1, 0.92, 0.3], size: 0.08, add: true, g: 60 });
    }
    function bonk(b, text){
      const d = b.data; d.off = true; d.gone = true; st.knocked++; st.gobs = (st.gobs || 0) + 1; st.score += 500;
      bonkFx(b); chunks([b.x, b.y], '#9cff5a', 5, 0.8); dust([b.x, b.y], '#9cff5a', 14);
      pop([b.x, b.y - 20], text || 'Goblin bonked! +500', '#9cff5a', 1.4); st.world.remove(b); if (PB.sfx) PB.sfx('bonk');
    }
    function firework(){
      const cx = st.spec.maxX - 160 + (Math.random() - .5) * 260, cy = GROUND - 330 - Math.random() * 160, cols = [[1, 0.3, 0.35], [1, 0.85, 0.2], [0.35, 0.75, 1], [0.5, 1, 0.45], [1, 0.5, 0.95]], col = cols[Math.floor(Math.random() * cols.length)];
      for (let i=0;i<44;i++) { const a = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 70; st.parts.push({ p: [cx, cy, -40], v: [Math.cos(a) * sp, Math.sin(a) * sp, (Math.random() - .5) * 60], life: 1.1, max: 1.1, color: col, size: 0.08, add: true, g: 120 }); }
      st.parts.push({ p: [cx, cy, -40], v: [0, 0, 0], life: 0.25, max: 0.25, color: [1, 1, 0.9], size: 1, add: true, g: 0 });
      if (PB.sfx) PB.sfx('boom');
    }
    function loadBall(type){ if (!type) return; st.loadAnim = { type, t: 0 }; if (PB.sfx) PB.sfx('pick'); }

    function update(rdt){
      if (st.slow > 0) st.slow = Math.max(0, st.slow - rdt);
      const dt = st.slow > 0 ? rdt * 0.3 : rdt;
      st.time += dt;
      for (const c of st.comics) c.t += rdt; st.comics = st.comics.filter(c => c.t < 0.9);
      if (st.phase === 'menu') { effects(dt); return; }
      const steps = Math.min(16, Math.max(2, Math.ceil(dt * 120))), h = dt / steps;
      for (let i=0;i<steps;i++) st.world.step(h);
      while (st.pendingBurst.length) { const s = st.pendingBurst.shift(); if (!s.data.burst) explode(s); }
      // the sling's rubber band snaps back and wobbles
      if (!st.pull) { st.bandV += (-st.band * 260 - st.bandV * 9) * dt; st.band += st.bandV * dt; }
      if (st.loadAnim) { st.loadAnim.t += dt / 0.5; if (st.loadAnim.t >= 1) { if (!reduceMotion) for (let i=0;i<12;i++) st.parts.push({ p: [REST.x, REST.y, 0], v: [(Math.random() - .5) * 120, -Math.random() * 120, (Math.random() - .5) * 60], life: 0.5, max: 0.5, color: [1, 0.9, 0.4], size: 0.05, add: true, g: 60 }); if (PB.sfx) PB.sfx('tap'); st.loadAnim = null; } }
      // reload once the last shot has had its moment
      if (!st.loaded) { const live = st.shots.filter(s => !s.dead && s.age < 3.2 && s.rest < 0.4); st.reload += dt; if ((st.reload > 1.4 && !live.length) || st.reload > 4) { if (ammoLeft() && !st.over) { st.loaded = true; pickAmmo(); loadBall(st.sel); } } }
      st.panicT = st.shots.some(s => s.age < 2.5 && s.rest === 0 && !s.dead) ? 0.3 : Math.max(0, (st.panicT || 0) - dt);
      for (const w of st.waves) w.t += dt; st.waves = st.waves.filter(w => w.t < 0.5);
      for (const b of st.shots) {
        b.age += dt;
        if (!reduceMotion && b.rest === 0 && b.age < 2.4 && Math.random() < 0.7) st.parts.push({ p: [b.x, b.y, 0], v: [(Math.random() - .5) * 10, -12, (Math.random() - .5) * 10], life: 0.55, max: 0.55, color: b.data.type === 'iron' ? [0.5, 0.5, 0.55] : [0.92, 0.88, 0.8], size: b.r * S * 0.4, grow: 0.12, g: 0 });
        const tr = PB.meta && PB.meta.look('castle', 'trail');
        if (tr && !reduceMotion && b.rest === 0 && b.age < 3) for (let k=0;k<1;k++) { const hue = (st.time * 2 + k * 0.5 + b.age) % 1;
          const col = tr === 'trail_rainbow' ? [0.5 + 0.5 * Math.cos(6.28 * hue), 0.5 + 0.5 * Math.cos(6.28 * (hue - 0.33)), 0.5 + 0.5 * Math.cos(6.28 * (hue - 0.67))] : tr === 'trail_hearts' ? [1, 0.35 + Math.random() * 0.3, 0.6] : [1, 0.9, 0.35 + Math.random() * 0.5];
          st.parts.push({ p: [b.x + (Math.random() - .5) * 10, b.y + (Math.random() - .5) * 10, 0], v: [(Math.random() - .5) * 40, (Math.random() - .5) * 40, (Math.random() - .5) * 20], life: 0.7, max: 0.7, color: col, size: (tr === 'trail_stars' ? 0.12 : 0.1) + Math.random() * 0.05, add: !!(tr === 'trail_stars'), g: tr === 'trail_hearts' ? -40 : 0 }); }
        if (b.data.type === 'fire' && !reduceMotion && Math.random() < 0.8) st.parts.push({ p: [b.x, b.y - 8, 0], v: [0, -60, 0], life: 0.3, max: 0.3, color: [1, 0.6, 0.15], size: 0.13, add: true, g: 0 });
        if (b.y > GROUND + 100 || b.x > st.spec.maxX + 600 || b.x < -300 || b.rest > 1.2 || b.age > 9 || b.dead) b.dead = true;
      }
      for (const b of st.shots.filter(b => b.dead)) st.world.remove(b);
      st.shots = st.shots.filter(b => !b.dead);
      for (const b of st.blocks) {
        const d = b.data;
        if (d.off) { if (!d.landed && b.y > GROUND - b.hh - 4) { d.landed = true; dust([b.x, GROUND], '#b7a27a', 8); } continue; }
        if (d.hitT) d.hitT = Math.max(0, d.hitT - dt);
        if (d.wob) d.wob = Math.max(0, d.wob - dt * 4);
        if (d.ouch) d.ouch = Math.max(0, d.ouch - dt) || 0;
        if (d.mat === 'goblin') {
          if (!st.lastFire) { d.hp = d.maxHp; d.broken = false; d.y0 = b.y; d.a0 = b.a; continue; }
          if (d.broken || b.y > d.y0 + 14 || Math.abs(b.a - d.a0) > 0.9 || b.x < -100 || b.x > st.spec.maxX + 400) { bonk(b); continue; }
          continue;
        }
        if (d.broken) {
          d.off = true; d.gone = true; st.knocked++; st.broken++;
          const pts = d.mat === 'dark' ? 200 : d.mat === 'gray' ? 150 : 100; st.score += pts; pop([b.x, b.y], 'Smash! +' + pts, '#ffe08a', 0.9); if (PB.sfx) PB.sfx('crash');
          dust([b.x, b.y], MAT[d.mat].base, 16); chunks([b.x, b.y], MAT[d.mat].base, 16, 1.1); st.shake = Math.max(st.shake, 6);
          st.world.remove(b); continue;
        }
        if (!st.lastFire) { d.hp = d.maxHp; continue; }
        if (b.y > GROUND + 60 || b.x < -200 || b.x > st.spec.maxX + 500) { d.off = true; st.knocked++; st.world.remove(b); }
      }
      if (!st.over) {
        const gobs = st.blocks.filter(b => b.data.mat === 'goblin' && !b.data.off).length;
        if (gobs === 0) { st.over = true; st.endTimer = 2.8; st.win = true; if (PB.sfx) PB.sfx('fanfare'); pop([st.spec.maxX - 200, GROUND - 300], 'All goblins bonked!', '#ffd23f', 1.8); }
        else if (!ammoLeft() && !st.shots.length && !st.pull && st.loaded === false) {
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
      shell.levelDone({ win: st.win, stars, score: st.score, summary: st.win ? `${Math.round(pct * 100)}% of the castle wrecked${left ? ` · ${left} shot${left > 1 ? 's' : ''} to spare` : ''}` : `${gl} goblin${gl === 1 ? '' : 's'} still standing. Try a different ball or a new angle!` });
    }
    function effects(dt){
      for (const q of st.parts) { q.p[0] += q.v[0]*dt; q.p[1] += q.v[1]*dt; q.p[2] += q.v[2]*dt; q.v[1] += (q.g ?? 200) * dt; if (q.grow) q.size += q.grow * dt; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.debris) { q.v[1] += 900 * dt; for (let k=0;k<3;k++) { q.p[k] += q.v[k] * dt; q.r[k] += q.vr[k] * dt; } q.life -= dt; if (q.p[1] > GROUND - q.s) { q.p[1] = GROUND - q.s; q.v[1] = -Math.abs(q.v[1]) * 0.35; q.v[0] *= 0.6; q.v[2] *= 0.6; q.vr = q.vr.map(v => v * 0.5); } }
      st.debris = st.debris.filter(q => q.life > 0);
      for (const q of st.helmets) { q.v[1] += 900 * dt; for (let k=0;k<3;k++) { q.p[k] += q.v[k] * dt; q.r[k] += q.vr[k] * dt; } if (q.p[1] > GROUND - 8) { q.p[1] = GROUND - 8; q.v[1] = -Math.abs(q.v[1]) * 0.4; q.v[0] *= 0.6; q.vr = q.vr.map(v => v * 0.6); } q.life -= dt; }
      st.helmets = st.helmets.filter(q => q.life > 0);
      for (const q of st.pops) { q.rise += 34 * dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      st.shake = Math.max(0, st.shake - dt * 30);
      if (st.flash) st.flash = Math.max(0, st.flash - dt);
      if (st.boomLight) { st.boomLight.t -= dt; if (st.boomLight.t <= 0) st.boomLight = null; }
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
    function cloudTexOld(){ const c = cv(256, 128), g = c.getContext('2d'), R = rnd(3); for (let i=0;i<22;i++) { const x = 40 + R() * 176, y = 50 + R() * 40, r = 16 + R() * 28; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } return c; }

    // ---------- meshes ----------

    // ---------- painted backdrops (side view) ----------
    // shaded, snow-capped mountain ranges with the king's castle far away (painted column by column)
    function mountainsTex(){ const c = cv(2048, 512), g = c.getContext('2d'), N = PB.gl3d, R = rnd(17);
      const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, 'rgba(0,0,0,0)'); g.fillStyle = sky;
      const range = (base, amp, f, seed, lit, dark, snowLine, haze) => {
        const hAt = x => { const r = 1 - Math.abs(N.fbm(x * f, seed, 0.5, 4) * 2.2); return base - amp * (0.65 * Math.max(0, r) + 0.35 * (N.fbm(x * f * 2.3, seed + 9, 0, 3) + 0.5)); };
        let prev = hAt(-1);
        for (let x=0;x<2048;x++) { const h = hAt(x), slope = h - prev; prev = h; const k = Math.max(0, Math.min(1, 0.5 + slope * 0.8));
          const gr = g.createLinearGradient(0, h, 0, 512); const col = PB.shade(k > 0.5 ? lit : dark, (k - 0.5) * 0.3);
          gr.addColorStop(0, col); gr.addColorStop(1, haze); g.fillStyle = gr; g.fillRect(x, h, 1, 512 - h);
          if (h < snowLine) { const sh = Math.min(snowLine - h, 18 + (N.fbm(x * 0.05, seed, 2, 2) + 0.5) * 30); g.fillStyle = k > 0.5 ? '#ffffff' : '#c8d2f0'; g.fillRect(x, h, 1, sh); } }
      };
      range(300, 210, 0.0028, 3, '#a9a6e0', '#7c78bf', 170, 'rgba(190,205,240,.9)');
      // the king's castle on a far hill
      const kx = 1300, ky = 330; g.fillStyle = '#8c94cc'; g.beginPath(); g.ellipse(kx, ky + 100, 300, 100, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#7d84bd'; g.fillRect(kx - 90, ky - 30, 180, 90); for (const [tx, th] of [[-100, 120], [100, 120], [-30, 165], [40, 140]]) { g.fillRect(kx + tx - 15, ky + 60 - th, 30, th); g.fillStyle = '#6a5fa8'; g.beginPath(); g.moveTo(kx + tx - 21, ky + 60 - th); g.lineTo(kx + tx, ky + 60 - th - 46); g.lineTo(kx + tx + 21, ky + 60 - th); g.fill(); g.fillStyle = '#7d84bd'; }
      for (const tx of [-100, -30, 40, 100]) { g.strokeStyle = '#6a5fa8'; g.lineWidth = 2; g.beginPath(); g.moveTo(kx + tx, ky - 110 - (tx === -30 ? 45 : 0)); g.lineTo(kx + tx, ky - 140 - (tx === -30 ? 45 : 0)); g.stroke(); g.fillStyle = '#ff6a6a'; g.fillRect(kx + tx, ky - 140 - (tx === -30 ? 45 : 0), 14, 8); }
      g.fillStyle = 'rgba(255,230,150,.75)'; for (let i=0;i<12;i++) g.fillRect(kx - 80 + R() * 160, ky - 10 + R() * 60, 4, 6);
      range(400, 120, 0.0045, 11, '#93a8d8', '#6a7eb8', 300, 'rgba(200,220,245,.9)');
      range(470, 60, 0.008, 23, '#7fb08c', '#5d8f70', 0, 'rgba(210,228,240,.8)');
      return c; }
    // soft cartoon cumulus clouds
    function cloudTex(){ const c = cv(512, 256), g = c.getContext('2d'), R = rnd(3); const puffs = [];
      for (let i=0;i<16;i++) { const t = i / 15; puffs.push([70 + t * 370 + (R() - .5) * 30, 170 - Math.sin(t * Math.PI) * (50 + R() * 40), 30 + Math.sin(t * Math.PI) * 40 + R() * 14]); }
      for (const [x, y, r] of puffs) { g.fillStyle = 'rgba(170,185,225,1)'; g.beginPath(); g.arc(x, y + 10, r, 0, 7); g.fill(); }
      for (const [x, y, r] of puffs) { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.45, r * 0.1, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#f4f6ff'); gr.addColorStop(1, '#dfe6fb'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'destination-out'; const f = g.createLinearGradient(0, 190, 0, 230); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = f; g.fillRect(0, 190, 512, 66);
      return c; }
    // rich soil with pebbles, roots and layers for the slice of ground in front
    function soilTex(){ const c = cv(256, 256), g = c.getContext('2d'), R = rnd(29);
      const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#6a4428'); gr.addColorStop(1, '#3e2614'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      for (const y of [70, 150, 215]) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y, 256, 10); g.fillStyle = 'rgba(255,220,170,.06)'; g.fillRect(0, y - 3, 256, 3); }
      for (let i=0;i<70;i++) { const x = R() * 256, y = R() * 256, r = 3 + R() * 8; g.fillStyle = ['#8a7a6c', '#a59585', '#6d5f53'][i % 3]; g.beginPath(); g.ellipse(x, y, r, r * 0.7, R() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.2, 0, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(40,24,10,.6)'; g.lineWidth = 2; for (let i=0;i<6;i++) { let x = R() * 256, y = 0; g.beginPath(); g.moveTo(x, y); for (let k=0;k<5;k++) { x += (R() - .5) * 30; y += 12 + R() * 14; g.lineTo(x, y); } g.stroke(); }
      grain(g, 256, 256, R, 2500, 0.18); return c; }
    function hillsTex(){ const c = cv(2048, 384), g = c.getContext('2d'), R = rnd(23);
      const hill = (base, amp, f, ph, c1, c2) => { const gr = g.createLinearGradient(0, base - amp, 0, 384); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 384); for (let x=0;x<=2048;x+=12) g.lineTo(x, base - (Math.sin(x * f + ph) * 0.5 + 0.5) * amp - Math.sin(x * f * 2.3 + ph) * amp * 0.15); g.lineTo(2048, 384); g.closePath(); g.fill(); };
      hill(230, 120, 0.004, 1.2, '#8fd06a', '#5aa047');
      for (let i=0;i<40;i++) { const x = R() * 2048, y = 170 + R() * 90, s = 0.7 + R() * 0.8; g.fillStyle = '#3f8a3a'; g.beginPath(); g.arc(x, y - 18 * s, 16 * s, 0, 7); g.fill(); g.fillStyle = '#56a64a'; g.beginPath(); g.arc(x - 4 * s, y - 22 * s, 9 * s, 0, 7); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(x - 2 * s, y - 4 * s, 4 * s, 8 * s); }
      for (let i=0;i<8;i++) { const x = 120 + i * 250 + R() * 80, y = 230 + R() * 40; g.fillStyle = ['#ffe0b0', '#ffd0d0', '#d8ecff'][i % 3]; g.fillRect(x, y - 18, 28, 18); g.fillStyle = ['#c0392b', '#2e6fb7', '#7a3d8f'][i % 3]; g.beginPath(); g.moveTo(x - 4, y - 18); g.lineTo(x + 14, y - 32); g.lineTo(x + 32, y - 18); g.fill(); }
      hill(300, 70, 0.006, 3.3, '#7cc456', '#4f9440');
      return c; }
    function grassEdgeTex(){ const c = cv(256, 64), g = c.getContext('2d'); g.fillStyle = '#5fb43f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); for (let x=256;x>=0;x-=16) g.quadraticCurveTo(x + 8, 34 + (x % 32 ? 6 : 0), x, 26); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 2, 256, 4); for (let i=0;i<120;i++) { g.strokeStyle = ['#4f9c36','#7dcb5a','#3f8a2c'][i % 3]; g.lineWidth = 2; const x = Math.random() * 256; g.beginPath(); g.moveTo(x, 18); g.lineTo(x + (Math.random() - .5) * 4, 4 + Math.random() * 6); g.stroke(); } return c; }

    function loadAssets(){
      if (A) return A;
      E = PB.gl3d.get(); if (!E) return null;
      const Gm = E.G, M = E.M, T = (g, t, r, s) => Gm.transform(g, M.trs(t, r || [0,0,0], s || [1,1,1]));
      A = {};
      A.tStone = {}; for (const k of Object.keys(MAT)) if (k !== 'goblin') A.tStone[k] = E.texture(stoneTex(MAT[k], k.length * 7));
      A.tGoblin = E.texture(goblinTex()); A.tFace = { stone: E.texture(faceTex('#a7a39d', '#3a2a20', 1)), triple: E.texture(faceTex('#d9a86a', '#5a3010', 2)), iron: E.texture(faceTex('#4a4e58', '#111', 3)), fire: E.texture(faceTex('#ff6a2a', '#5a1000', 4)), boulder: E.texture(faceTex('#9a8f80', '#3a2a20', 5)) };
      A.tCrack = [crackTex(31, 5), crackTex(57, 11)];
      A.tPlank = E.texture(plankTex()); A.tGrass = E.texture(grassTex()); A.tDirt = E.texture(soilTex()); A.tRock = E.texture(rockTex());
      A.tCloud = E.texture(cloudTex(), { repeat: false }); A.tMount = E.texture(mountainsTex(), { repeat: true, clampV: true }); A.tHills = E.texture(hillsTex(), { repeat: true, clampV: true }); A.tEdge = E.texture(grassEdgeTex(), { repeat: true, clampV: true });
      A.tCloth = E.texture(clothTex('#8e1f1a', '#e0b43c'));
      A.box = E.mesh(Gm.roundBox(1, 1, 1, 0.1, 3)); A.flat = E.mesh(Gm.box(1, 1, 1)); A.sphere = E.mesh(Gm.sphere(1, 24, 16)); A.cyl = E.mesh(Gm.cylinder(0.5, 0.5, 1, 20)); A.cone = E.mesh(Gm.cylinder(0, 0.5, 1, 20, true));
      A.log = E.mesh(Gm.cylinder(0.5, 0.42, 1, 14)); A.quad = E.mesh(Gm.quad(1, 1)); A.ring = E.mesh(Gm.torus(1, 0.08, 40, 6));
      A.flag = E.mesh(Gm.extrude([[0, 0], [1, -0.32], [0, -0.64]], 0.02)); A.chunk = E.mesh(Gm.roundBox(1, 1, 1, 0.2, 2));
      // trees, bushes and flowers along the meadow, merged so they draw fast
      const R = rnd(41), trunks = [], crowns = [], pines = [], bushes = [], flowers = [];
      for (let x = -600; x < 1600; x += 90 + R() * 110) { const z = -7 - R() * 6, s = 0.55 + R() * 0.45, wx = x * S;
        if (R() < 0.45) { trunks.push(T(Gm.cylinder(0.1, 0.14, 1.0, 8), [wx, 0.5 * s, z], [0, 0, 0], [s, s, s])); for (let k=0;k<3;k++) pines.push(T(Gm.cylinder(0, 0.85 - k * 0.18, 1.2, 10, true), [wx, (1.0 + k * 0.62) * s, z], [0, R() * 3, 0], [s, s, s])); }
        else { trunks.push(T(Gm.cylinder(0.12, 0.17, 1.4, 8), [wx, 0.7 * s, z], [0, 0, 0], [s, s, s])); for (let k=0;k<5;k++) crowns.push(T(Gm.sphere(1, 12, 9), [wx + (R() - .5) * 0.9 * s, (1.8 + R() * 0.7) * s, z + (R() - .5) * 0.6], [0, 0, 0], [0.62 * s, 0.56 * s, 0.62 * s])); } }
      for (let x = -600; x < 1600; x += 40 + R() * 60) bushes.push(T(Gm.sphere(1, 10, 8), [x * S, 0.1, -2.2 - R() * 2], [0, 0, 0], [0.26 + R() * 0.16, 0.2 + R() * 0.08, 0.26]));
      for (let x = -600; x < 1600; x += 14 + R() * 26) flowers.push(T(Gm.sphere(1, 6, 5), [x * S, 0.03, 0.6 + R() * 0.5], [0, 0, 0], [0.045, 0.045, 0.045]));
      A.trunks = E.mesh(Gm.merge(trunks)); A.crowns = E.mesh(Gm.merge(crowns)); A.pines = E.mesh(Gm.merge(pines)); A.bushes = E.mesh(Gm.merge(bushes)); A.flowers = E.mesh(Gm.merge(flowers));
      return A;
    }

    // ---------- camera ----------
    const FOV = 0.55, ASPECT = W / H;
    function camTarget(){
      const s = st.camShot && !st.camShot.dead && st.camShot.age < 3 ? st.camShot : null;
      const widthAll = Math.max(540, Math.min(780, st.spec.maxX + 30));
      if (s && st.phase !== 'menu') { const w = Math.min(widthAll, 600), hh = w / ASPECT; const cx = Math.max(w / 2 - 10, Math.min(st.spec.maxX + 40 - w / 2, s.x + 60)); return { x: cx, y: Math.min(GROUND - 0.3 * hh, s.y + 40), w }; }
      const w = widthAll, hh = w / ASPECT; return { x: w / 2 - 10, y: GROUND - 0.3 * hh, w };
    }
    function updateCam(dt){
      const t = camTarget();
      if (!st.cam) st.cam = { ...t };
      const k = Math.min(1, dt * (st.camShot && !st.camShot.dead ? 3 : 1.6));
      st.cam.x += (t.x - st.cam.x) * k; st.cam.y += (t.y - st.cam.y) * k; st.cam.w += (t.w - st.cam.w) * k;
    }
    const camScale = () => H / (st.cam.w / ASPECT);   // screen pixels per world unit

    // ---------- drawing ----------
    function drawBall(p, type, r, rot){
      const M = E.M, fm = M.trs(p, [0, 0, -rot], r);
      E.draw(A.sphere, fm, { tex: A.tFace[type], color: [1, 1, 1], spec: type === 'iron' ? 1.2 : 0.35, shine: type === 'iron' ? 70 : 24 });
      E.draw(A.sphere, fm, INK);
      if (type === 'fire') { E.draw(A.cyl, M.trs([p[0], p[1] + r * 0.9, p[2]], [0, 0, 0], [r * 0.9, r * 0.5, r * 0.9]), { color: [0.45, 0.22, 0.12] }); E.sprite([p[0], p[1] + r * 1.5, p[2]], r * 3.2, [1, 0.6, 0.15], 0.9, true); E.sprite([p[0], p[1] + r * 1.3, p[2]], r * 1.6, [1, 0.95, 0.6], 0.9, true); E.light([p[0], p[1] + r * 2, p[2]], [2.5, 1.2, 0.3], 1.4); }
    }
    function drawGoblin(b){
      const M = E.M, d = b.data, s = d.w * S, panic = d.hitT > 0 || st.panicT > 0, t = st.time * (panic ? 18 : 3) + b.id;
      const hop = panic ? Math.abs(Math.sin(st.time * 14 + b.id)) * s * 0.25 : (Math.sin(st.time * 1.7 + b.id * 2) > 0.92 ? Math.abs(Math.sin(st.time * 11)) * s * 0.3 : 0);
      const p = P3(b.x, b.y); p[1] += hop;
      const m = M.trs(p, [0, Math.sin(st.time * 0.8 + b.id) * 0.4 - 0.3, -b.a + (panic ? Math.sin(t) * 0.12 : 0)], [1, 1 + Math.sin(t) * (panic ? 0.08 : 0.035), 1]);
      const bm = M.mul(m, M.trs([0, -s * 0.02, 0], [0, 0, 0], [s * 0.56, s * 0.5, s * 0.52]));
      E.draw(A.sphere, bm, { tex: A.tGoblin, color: [1, 1, 1], spec: 0.35, shine: 30 }); E.draw(A.sphere, bm, INK);
      for (const sd of [-1, 1]) { const wave = panic ? Math.sin(t * 1.3 + sd) * 0.6 + 2.4 : sd > 0 ? 1.6 + Math.sin(st.time * 7 + b.id) * 0.6 : 0.5;
        const sh = M.mul(m, M.trs([sd * s * 0.5, s * 0.02, 0], [0, 0, sd * -wave]));
        E.draw(A.cyl, M.mul(sh, M.trs([0, -s * 0.22, 0], [0, 0, 0], [s * 0.12, s * 0.44, s * 0.12])), { color: hex('#7cbf44'), spec: 0.3 });
        E.draw(A.sphere, M.mul(sh, M.trs([0, -s * 0.46, 0], [0, 0, 0], [s * 0.13, s * 0.13, s * 0.13])), { color: hex('#8fd052'), spec: 0.3 }); }
      const hm = M.mul(m, M.trs([0, s * 0.2, -0.004], [0, 0, 0], [s * 0.56, s * 0.32, s * 0.55])); E.draw(A.sphere, hm, { color: [0.6, 0.63, 0.72], spec: 1.0, shine: 60 }); E.draw(A.sphere, hm, INK);
      const rim = M.mul(m, M.trs([0, s * 0.12, -0.004], [0, 0, 0], [s * 1.18, s * 0.05, s * 1.12])); E.draw(A.cyl, rim, { color: [0.48, 0.5, 0.58], spec: 0.8 });
      E.draw(A.cone, M.mul(m, M.trs([0, -s * 0.06, s * 0.55], [Math.PI / 2 + 0.3, 0, 0], [s * 0.16, s * 0.3, s * 0.16])), { color: hex('#8fb84a'), spec: 0.3 });
      E.draw(A.cone, M.mul(m, M.trs([0, s * 0.56, 0], [0, 0, 0], [s * 0.12, s * 0.22, s * 0.12])), { color: hex('#e8463a'), spec: 0.5 });
      for (const sd of [-1, 1]) E.draw(A.cone, M.mul(m, M.trs([sd * s * 0.68, s * 0.02, 0], [0, 0, sd * -1.3], [s * 0.2, s * 0.42, s * 0.08])), { color: hex('#9cc456'), spec: 0.3 });
    }
    const covered = b => st.blocks.some(o => o !== b && !o.data.off && Math.abs(o.x - b.x) < (o.hw + b.hw) * 0.7 && Math.abs((o.y + o.hh) - (b.y - b.hh)) < 8);
    function drawBlock(b){
      const M = E.M, d = b.data, p = P3(b.x, b.y), wob = d.wob ? 1 + Math.sin(d.wob * 30) * d.wob * 0.05 : 1;
      const m = M.trs(p, [0, 0, -b.a], [d.w * S * wob, d.h * S / wob, DEPTH * S]);
      const flash = d.hitT > 0 ? d.hitT / 0.3 : 0;
      const look = MAT[d.mat].look, uv = look === 'wood' ? [Math.max(1, d.w / 40), Math.max(1, d.h / 40)] : [Math.max(1, d.w / 50), Math.max(1, d.h / 50)];
      E.draw(A.box, m, { tex: A.tStone[d.mat], color: [1, 1, 1], emissive: flash ? [0.4 * flash, 0.32 * flash, 0.2 * flash] : undefined, spec: d.mat === 'gray' ? 1.3 : d.mat === 'dark' ? 0.3 : 0.15, shine: d.mat === 'gray' ? 80 : 24, uvScale: uv });
      E.draw(A.box, m, INK);
      const dmg = 1 - d.hp / d.maxHp;
      if (dmg > 0.2) E.draw(A.box, M.mul(m, M.trs([0, 0, 0], [0, 0, 0], [1.01, 1.01, 1.01])), { tex: A.tCrack[dmg > 0.6 ? 1 : 0], blend: true, color: [1, 1, 1], alpha: Math.min(1, 0.4 + dmg), spec: 0, uvScale: uv, noShadow: true });
      // windows and doors painted on castle pieces
      if (d.type === 'keep' || d.type === 'tower') { const wm = M.mul(M.trs(p, [0, 0, -b.a]), M.trs([0, d.type === 'keep' ? -d.h * S * 0.18 : d.h * S * 0.05, DEPTH * S * 0.51], [0, 0, 0], [Math.min(0.13, d.w * S * 0.3), d.type === 'keep' ? d.h * S * 0.5 : d.h * S * 0.32, 0.01])); E.draw(A.flat, wm, { color: [0.12, 0.08, 0.06], spec: 0.1 }); }
      if (!covered(b) && !d.off) {
        if (d.type === 'tower') { const rm = M.mul(M.trs(p, [0, 0, -b.a]), M.trs([0, d.h * S / 2 + 0.16, 0], [0, Math.PI / 4, 0], [d.w * S * 1.5, 0.32, DEPTH * S * 1.3])); E.draw(A.cone, rm, { color: hex(d.roof), spec: 0.6, shine: 40 }); E.draw(A.cone, rm, INK);
          if (d.flag) { const top = M.mul(M.trs(p, [0, 0, -b.a]), M.trs([0, d.h * S / 2 + 0.32, 0])); E.draw(A.cyl, M.mul(top, M.trs([0, 0.11, 0], [0, 0, 0], [0.012, 0.22, 0.012])), { color: [0.3, 0.2, 0.12] }); E.draw(A.flag, M.mul(top, M.trs([0, 0.2, 0], [0, -0.6 + Math.sin(st.time * 5 + b.id) * 0.3, 0], [0.16, 0.16, 0.16])), { color: hex(d.flag), doubleSided: true, spec: 0.2 }); } }
        else if (d.type === 'keep') for (let k=0;k<3;k++) { const mm = M.mul(M.trs(p, [0, 0, -b.a]), M.trs([(k - 1) * d.w * S * 0.36, d.h * S / 2 + 0.04, 0], [0, 0, 0], [d.w * S * 0.22, 0.08, DEPTH * S * 0.9])); E.draw(A.box, mm, { tex: A.tStone[d.mat], color: [1, 1, 1], spec: 0.2 }); E.draw(A.box, mm, INK); }
      }
    }
    // the slingshot: a forked log on a stone base with a stretchy leather band
    function drawSling(){
      const M = E.M, skin = PB.meta && PB.meta.look('castle', 'sling');
      if (skin === 'sling_candy' && !A.tCandy) { const c = cv(64, 256), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#ff4f8b'; for (let y=-64;y<256;y+=32) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 32); g.lineTo(64, y + 48); g.lineTo(0, y + 16); g.closePath(); g.fill(); } A.tCandy = E.texture(c); }
      const wood = skin === 'sling_gold' ? { color: [1, 0.78, 0.2], emissive: [0.25, 0.16, 0.02], spec: 1.6, shine: 90 } : skin === 'sling_candy' ? { tex: A.tCandy, color: [1, 1, 1], spec: 0.8, shine: 60, uvScale: [1, 2] } : { tex: A.tPlank, color: [0.72, 0.5, 0.32], spec: 0.15, uvScale: [0.5, 1] };
      E.draw(A.box, M.trs(P3(SLX, GROUND - 18, 0), [0, 0, 0], [0.8, 0.36, 0.6]), { tex: A.tStone.dark, color: [0.9, 0.9, 0.9], spec: 0.2 }); E.draw(A.box, M.trs(P3(SLX, GROUND - 18, 0), [0, 0, 0], [0.8, 0.36, 0.6]), INK);
      const fork = GROUND - 96, tipL = [SLX - 30, GROUND - 158, -12], tipR = [SLX + 27, GROUND - 155, 12];
      const log = (a, b, r) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ang = Math.atan2(dx, -dy); const m = M.trs(P3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), [0, 0, -ang], [r * S, L * S, r * S]); E.draw(A.log, m, wood); E.draw(A.log, m, INK); };
      log([SLX, GROUND - 32, 0], [SLX, fork, 0], 30);
      log([SLX, fork + 8, 0], tipL, 21);
      // ball in the pouch (or hopping in from the pile)
      const pull = st.pull || { dx: 0, dy: 0 }, bandK = st.pull ? 0 : st.band, pouch = [REST.x + pull.dx + bandK * 8, REST.y + pull.dy - bandK * 6, 0];
      const band = (tip, z) => { const dx = pouch[0] - tip[0], dy = pouch[1] - tip[1], L = Math.hypot(dx, dy), ang = Math.atan2(dx, -dy), th = 10 - Math.min(4, L / 30); E.draw(A.flat, M.trs(P3((pouch[0] + tip[0]) / 2, (pouch[1] + tip[1]) / 2, z), [0, 0, -ang], [th * S, L * S, th * S]), { color: [0.32, 0.16, 0.1], spec: 0.4 }); };
      band(tipL, -8);
      const showBall = st.loaded && st.inv[st.sel] > 0 && !st.over;
      if (showBall) {
        const type = st.sel, r = AMMO[type].r; let bp = P3(pouch[0], pouch[1] - 2, 0), sc = 1;
        if (st.loadAnim && st.loadAnim.type === type) { const k = Math.min(1, st.loadAnim.t), e = 1 - Math.pow(1 - k, 2), from = [SLX - 70, GROUND - r]; bp = P3(from[0] + (pouch[0] - from[0]) * e, from[1] + (pouch[1] - 2 - from[1]) * e - Math.sin(k * Math.PI) * 90, 0); sc = 0.8 + 0.2 * e; }
        drawBall(bp, type, r * S * sc, st.pull ? 0 : (st.loadAnim ? st.loadAnim.t * 10 : 0));
        if (!st.pull && !st.loadAnim) E.sprite(bp, r * S * 6, [1, 0.85, 0.35], 0.2 + 0.08 * Math.sin(st.time * 5), true);
      }
      E.draw(A.box, M.trs(P3(pouch[0] - 4, pouch[1], 4), [0, 0, 0], [0.16, 0.28, 0.08]), { color: [0.4, 0.22, 0.12], spec: 0.3 });
      log([SLX, fork + 8, 0], tipR, 21);
      band(tipR, 12);
      // the rest of the ammo waiting in line beside the sling
      let x = SLX - 64; const queue = []; for (const k of AMMO_ORDER) for (let i=0;i<(st.inv[k] || 0) - (k === st.sel && showBall ? 1 : 0);i++) queue.push(k);
      for (let i=0;i<Math.min(6, queue.length);i++) { const r = AMMO[queue[i]].r, bob = Math.abs(Math.sin(st.time * 3 + i)) * 4; drawBall(P3(x - r, GROUND - r - bob, 8), queue[i], r * S, 0); x -= r * 2 + 6; }
    }
    function scenery(M){
      const cx = st.cam.x;
      E.draw(A.quad, M.trs(P3(cx * 0.75 + 250, GROUND - 330, -2400), [0, 0, 0], [44, 11, 1]), { tex: A.tMount, unlit: true, color: [1, 1, 1], uvScale: [1, 1], fogless: true, blend: true, noShadow: true });
      E.draw(A.quad, M.trs(P3(cx * 0.35 + 200, GROUND - 120, -1000), [0, 0, 0], [90, 17, 1]), { tex: A.tHills, unlit: true, color: [0.95, 1, 0.95], uvScale: [1.6, 1], fogless: true, blend: true, noShadow: true });
      E.sprite(P3(cx * 0.8 + 520, GROUND - 1300, -2000), 5, [1, 0.9, 0.6], 0.5, true); E.sprite(P3(cx * 0.8 + 520, GROUND - 1300, -2000), 1.8, [1, 1, 0.92], 1, true);
      for (let k=0;k<6;k++) { const x = ((k * 420 + st.time * (6 + k * 2)) % 2800) - 800, y = GROUND - 760 - (k % 3) * 120, sc = 3.2 + (k % 3) * 1.1; E.draw(A.quad, M.trs(P3(x, y, -1100 - (k % 2) * 300), [0, 0, 0], [sc, sc * 0.5, 1]), { tex: A.tCloud, unlit: true, color: [1, 1, 1], fogless: true, blend: true, noShadow: true }); }
      for (let k=0;k<5;k++) { const t = (st.time * 40 + k * 60) % 2400 - 800, bx = t + (k % 2) * 30, by = GROUND - 520 - k * 16 + Math.sin(st.time + k) * 8, flap = Math.sin(st.time * 9 + k) * 0.5; for (const sd of [-1, 1]) E.draw(A.flat, M.trs(P3(bx + sd * 8, by, -300), [0, 0, sd * (0.35 + flap)], [0.18, 0.02, 0.05]), { color: [0.15, 0.13, 0.16], noShadow: true, unlit: true }); }
      E.draw(A.trunks, M.trs([0, 0, 0]), { color: [0.42, 0.28, 0.16], spec: 0.05 });
      E.draw(A.pines, M.trs([0, 0, 0]), { color: [0.18, 0.48, 0.28], spec: 0.06 });
      E.draw(A.crowns, M.trs([0, 0, 0]), { color: [0.36, 0.66, 0.28], spec: 0.08, rim: 0.3 });
      E.draw(A.bushes, M.trs([0, 0, 0]), { color: [0.3, 0.6, 0.26], spec: 0.08 });
      // the ground: grassy top and a slice of earth in front
      E.draw(A.flat, M.trs([5, -1.0, -2.5], [0, 0, 0], [40, 2, 8]), { tex: A.tDirt, color: [1, 1, 1], spec: 0.04, uvScale: [40, 2] });
      E.draw(A.flat, M.trs([5, -0.02, -3], [0, 0, 0], [40, 0.06, 7]), { tex: A.tGrass, color: [0.7, 0.86, 0.56], spec: 0.05, uvScale: [40, 7] });
      E.draw(A.quad, M.trs([5, -0.12, 1.505], [0, 0, 0], [40, 0.26, 1]), { tex: A.tEdge, color: [1, 1, 1], uvScale: [80, 1], blend: true, noShadow: true });
      E.draw(A.flowers, M.trs([0, 0, 0]), { color: [1, 0.85, 0.35], emissive: [0.2, 0.15, 0.05], spec: 0.2, noShadow: true });
      // rocky hills under some castles
      for (const s of st.spec.statics) { const m = M.trs(P3(s.x, s.y, -2), [0, 0, 0], [s.w * S, s.h * S, 1.0]); E.draw(A.box, m, { tex: A.tRock, color: [0.95, 0.9, 0.85], spec: 0.1, uvScale: [s.w / 60, s.h / 60] }); E.draw(A.box, m, INK); E.draw(A.flat, M.trs(P3(s.x, s.y - s.h / 2 - 2, -2), [0, 0, 0], [s.w * S * 1.02, 0.05, 1.02]), { tex: A.tGrass, color: [0.7, 0.86, 0.56], uvScale: [3, 1] }); }
    }
    function render(snapshot){
      const M = E.M, cam = st.cam, hh = cam.w / ASPECT, dist = (hh * S / 2) / Math.tan(FOV / 2);
      const shake = st.shake > 0 && !reduceMotion ? [(Math.random() - .5) * st.shake * 0.004, (Math.random() - .5) * st.shake * 0.004] : [0, 0];
      const c = P3(cam.x, cam.y);
      E.begin({ pos: [c[0] + shake[0], c[1] + 0.25 + shake[1], dist], target: [c[0], c[1], 0], fov: FOV, near: 0.1, far: 400 }, {
        sunDir: [0.5, -0.62, -0.6], sunColor: [2.6, 2.2, 1.7], ambSky: [0.42, 0.5, 0.74], ambGround: [0.32, 0.3, 0.2], toon: 0.65,
        fogColor: [0.72, 0.83, 0.97], fogDensity: 0.003, fogStart: 24,
        shadow: { center: P3(cam.x, GROUND - 120), radius: Math.max(4, cam.w * S * 0.7) },
        post: { bloom: 0.42, threshold: 0.86, saturation: 1.18, contrast: 1.12, vignette: 0.38, tint: [1.03, 1, 0.95] },
        sky: { zenith: [0.12, 0.36, 0.86], horizon: [0.62, 0.8, 0.98], ground: [0.5, 0.6, 0.4], sunColor: [1, 0.9, 0.7], sunSize: 2 },
      });
      scenery(M);
      if (st.boomLight) E.light(P3(st.boomLight.p[0], st.boomLight.p[1] - 20, 30), [6 * st.boomLight.t / 0.35, 3 * st.boomLight.t / 0.35, 0.8], 3.5);
      for (const b of st.blocks) { if (b.data.gone || b.data.off && b.y > GROUND + 200) continue; if (b.data.mat === 'goblin') drawGoblin(b); else drawBlock(b); }
      drawSling();
      for (const s of st.shots) drawBall(P3(s.x, s.y), s.data.type, s.r * S, s.a);
      // aiming dots: the path fades out part of the way, like the real thing
      if (st.pull && st.preview) { const n = st.preview.length, show = Math.max(4, Math.floor(n * 0.62));
        for (let i=1;i<Math.min(n, show);i++) { const a = 1 - i / show; const dm = M.trs(P3(st.preview[i][0], st.preview[i][1], 10), [0, 0, 0], 0.075 * (0.55 + 0.45 * a)); E.draw(A.sphere, dm, { color: [1, 1, 1], emissive: [0.6, 0.6, 0.6], spec: 0.2, noShadow: true }); E.draw(A.sphere, dm, INK); } }
      for (const w of st.waves) { const k = w.t / 0.5; E.sprite(P3(w.p[0], w.p[1], 20), (w.big ? 1.8 : 1.0) * (0.3 + k) * 2.2, w.fire ? [1, 0.6, 0.25] : [1, 0.95, 0.85], (1 - k) * 0.55, true); }
      for (const q of st.debris) { const k = Math.min(1, q.life * 2); E.draw(A.chunk, M.trs(P3(q.p[0], q.p[1], q.p[2]), q.r, q.s * S * 2 * k), { color: q.col, spec: 0.2, noShadow: true }); }
      for (const q of st.helmets) { const p = P3(q.p[0], q.p[1], q.p[2]), s = 30 * S, hm = M.trs(p, q.r, [s * 0.56, s * 0.32, s * 0.55]); E.draw(A.sphere, hm, { color: [0.62, 0.65, 0.72], spec: 1.1, shine: 70 }); E.draw(A.sphere, hm, INK); E.draw(A.cyl, M.trs(p, q.r, [s * 1.18, s * 0.05, s * 1.12]), { color: [0.5, 0.53, 0.6], spec: 0.8 }); }
      for (const q of st.parts) E.sprite(P3(q.p[0], q.p[1], q.p[2]), q.size * SPK, q.color, Math.min(1, q.life / q.max * 1.6) * (q.add ? 1 : 0.8), !!q.add);
      E.end();
    }
    function drawBall2D(g, x, y, type, r){
      const Am = AMMO[type], gr = g.createRadialGradient(x - r*0.35, y - r*0.35, 1, x, y, r);
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
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(40,24,10,.66)'; ctx.beginPath(); ctx.roundRect(12, 12, 232, 70, 14); ctx.fill(); ctx.strokeStyle = 'rgba(224,180,60,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe9b8'; ctx.font = `24px ${FONT}`; ctx.fillText(st.mode === 'daily' ? 'Daily Siege' : `Level ${st.spec.n}`, 24, 40);
      ctx.font = `800 12px ${BODY}`; ctx.fillStyle = '#e8d3a6'; ctx.fillText('GOBLINS', 24, 63);
      const done = st.gobs || 0;
      for (let i=0;i<st.goblins;i++) { const x = 92 + i * 19, y = 59, hit = i < done;
        ctx.globalAlpha = hit ? 0.45 : 1; ctx.fillStyle = '#8fc44a'; ctx.beginPath(); ctx.arc(x, y + 2, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#9aa0ab'; ctx.beginPath(); ctx.arc(x, y - 1, 7.5, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
        if (hit) { ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 6, y - 5); ctx.lineTo(x + 6, y + 7); ctx.moveTo(x + 6, y - 5); ctx.lineTo(x - 6, y + 7); ctx.stroke(); } }
      ctx.textAlign = 'right'; ctx.font = `800 12px ${BODY}`; ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,24,10,.8)'; const wt = `Castle wrecked ${Math.round(castleDone() * 100)}%`; ctx.strokeText(wt, W - 16, 30); ctx.fillText(wt, W - 16, 30);
      // ammo tray: tap a ball to load it next
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
        ctx.globalAlpha = cnt ? 1 : 0.35; drawBall2D(ctx, x + bw / 2, ty + 24, k, Math.min(15, AMMO[k].r * 0.7 + 4));
        ctx.fillStyle = '#3d2814'; ctx.textAlign = 'center'; ctx.font = `800 11px ${BODY}`; ctx.fillText(AMMO[k].name, x + bw / 2, ty + 55, bw - 6); ctx.globalAlpha = 1;
        ctx.fillStyle = cnt ? '#a8322d' : '#7a5a3a'; ctx.beginPath(); ctx.arc(x + bw - 9, ty + 9, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff3d6'; ctx.font = `900 12px ${BODY}`; ctx.textBaseline = 'middle'; ctx.fillText(cnt, x + bw - 9, ty + 9.5); ctx.textBaseline = 'alphabetic';
      });
      // pull-strength meter while aiming
      if (st.pull) { const sp = E.project(P3(REST.x, REST.y)), k = Math.min(1, Math.hypot(st.pull.dx, st.pull.dy) / MAXPULL); ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(sp[0], sp[1], 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); ctx.strokeStyle = k > 0.9 ? '#ff5a3c' : k > 0.5 ? '#ffd23f' : '#7dff6a'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
      for (const c of st.comics) {
        const sp = E.project(P3(c.p[0], c.p[1], 20)), k = c.t / 0.9, sc = (c.t < 0.12 ? c.t / 0.12 * 1.25 : 1.25 - Math.min(0.25, (c.t - 0.12) * 1.2)) * (c.big ? 1.2 : 0.95), a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(sp[0], sp[1] - 40 - c.t * 30); ctx.scale(sc, sc); ctx.rotate(-0.12);
        ctx.beginPath(); for (let i=0;i<18;i++) { const an = i / 18 * Math.PI * 2, rr = i % 2 ? 26 : 44; ctx.lineTo(Math.cos(an) * rr * 1.25, Math.sin(an) * rr * 0.85); } ctx.closePath();
        ctx.fillStyle = c.col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2b1408'; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `26px ${FONT}`; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#2b1408'; ctx.strokeText(c.text, 0, 2); ctx.fillStyle = '#ffffff'; ctx.fillText(c.text, 0, 2);
        ctx.restore();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) { const sp = E.project(P3(q.p[0], q.p[1], 20)); ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = `24px ${FONT}`; ctx.lineWidth = 5; ctx.strokeStyle = '#3d2814'; ctx.lineJoin = 'round'; ctx.strokeText(q.text, sp[0], sp[1] - q.rise); ctx.fillStyle = q.color; ctx.fillText(q.text, sp[0], sp[1] - q.rise); ctx.restore(); }
      if (st.phase === 'play' && !st.lastFire && !st.pull && !st.over) {
        const sp = E.project(P3(REST.x, REST.y)), t = (st.time % 1.6) / 1.6, hx = sp[0] + 20 - Math.sin(t * Math.PI) * 50, hy = sp[1] + 30 + Math.sin(t * Math.PI) * 26;
        ctx.save(); ctx.globalAlpha = 0.9; ctx.font = '30px sans-serif'; ctx.fillText('\u{1F446}', hx, hy + 18); ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(st.time * 3); ctx.font = `700 15px ${BODY}`;
        const msg = 'Pull the ball back, aim, and let go!'; const tw = Math.min(W - 24, ctx.measureText(msg).width + 32);
        ctx.fillStyle = 'rgba(40,24,10,.82)'; ctx.beginPath(); ctx.roundRect(W/2 - tw/2, 98, tw, 38, 19); ctx.fill();
        ctx.fillStyle = '#fff3d6'; ctx.fillText(msg, W/2, 118, W - 40); ctx.restore();
      }
    }
    function draw(){
      if (!loadAssets()) { ctx.fillStyle = '#2a1a0c'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '700 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('This game needs a device with 3D graphics.', W/2, H/2); return; }
      E.resize(W, H, E.quality(1.5)); render(); E.present(ctx, W, H); drawHUD();
    }
    function artTile(g){
      if (!loadAssets()) { g.fillStyle = '#6fa8dc'; g.fillRect(0, 0, 240, 180); return; }
      const keep = st; fresh('classic', 14); st.phase = 'menu'; st.cam = { x: 500, y: GROUND - 140, w: 210 };
      E.resize(240, 180, 2);
      render(true); g.drawImage(E.canvas, 0, 0, 240, 180);
      st = keep;
    }

    return {
      id:'castle', sfxScore:false, music:'castle', title:'CASTLE CRASH', W, H, statLabel:'Ammo', type:'levels', levels:100, maxLives:0,
      failTitle:'Out of ammo', dailyText:'One giant fortress a day', powersTitle:'Catapult ammo',
      tile:{ order:7, name:'Castle Crash', kind:'Slingshot siege · 100 levels', art: artTile, isNew: true },
      controls: ['Bonk every goblin in a helmet to win!', 'Pull the ball back in the slingshot (touch anywhere and drag back), aim with the dotted line, and let go to fire.', 'Pull further for a stronger shot. Slide back toward the start to cancel.', 'Tap a ball in the LOAD NEXT SHOT tray to choose what goes in the sling next. Tap the screen while a triple shot flies to split it.', 'Blocks crack when they are hit hard and smash after enough hits. Wood breaks easily, ice takes more, stone is the toughest.', 'Wreck at least half the castle and keep a shot spare for 3 stars.'],
      powers: AMMO_ORDER.map(k => ({ name: AMMO[k].name, desc: AMMO[k].desc, icon: g => drawBall2D(g, 23, 14, k, 11) })),
      init(){ loadAssets(); },
      preview(){ fresh('classic', 1); st.phase = 'menu'; },
      start(mode, rand, lives, msg, level){ fresh(mode, level === 'daily' ? 1 : level); },
      frame(dt){ update(dt); updateCam(dt); draw(); },
      hud(){ return { lives: null, stat: ammoLeft(), score: st.score }; },
      metrics(){ return { score: st.score, blocks: st.knocked - (st.gobs || 0), goblins: st.gobs || 0, left: st.over && st.win ? ammoLeft() : 0, won: st.over && st.win ? 1 : 0 }; },
      dailyGoals: [
        { text:'Smash or knock down {n} castle blocks', m:'blocks', n:[10, 14, 18] },
        { text:'Bonk every goblin with {n} shots to spare', m:'left', n:[1, 2] },
        { text:'Bonk {n} goblins', m:'goblins', n:[3, 4] },
      ],
      pointerDown(x, y){
        if (st.over || !E || !st.cam) return;
        const tr = st.trayRects.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (tr) { if (st.inv[tr.k] > 0 && st.sel !== tr.k && !st.pull) { st.sel = tr.k; if (st.loaded) loadBall(tr.k); else if (PB.sfx) PB.sfx('pick'); pop([REST.x, REST.y - 50], AMMO[tr.k].name + (st.loaded ? ' loaded!' : ' is next!'), '#ffe08a', 0.9); } return; }
        const tri = st.shots.find(s => s.data.type === 'triple' && !s.data.split);
        if (tri) { split(tri); return; }
        if (!st.loaded || !(st.inv[st.sel] > 0) || st.loadAnim) return;
        st.drag = { x0: x, y0: y };
      },
      pointerMove(x, y){
        if (!st.drag) return;
        const k = 1 / camScale(); let dx = (x - st.drag.x0) * k * 0.9, dy = (y - st.drag.y0) * k * 0.9;
        const L = Math.hypot(dx, dy); if (L > MAXPULL) { dx *= MAXPULL / L; dy *= MAXPULL / L; }
        dy = Math.min(dy, GROUND - 16 - REST.y);
        if (!st.pull && L > 4 && PB.sfx) PB.sfx('slide');
        st.pull = { dx, dy };
        st.preview = simulate(launchV(st.pull), AMMO[st.sel].r);
      },
      pointerUp(){
        if (!st.drag) return;
        st.drag = null;
        if (st.pull && Math.hypot(st.pull.dx, st.pull.dy) > 14) { const v = launchV(st.pull); fire(v.vx, v.vy); }
        else { st.pull = null; st.preview = null; }
      },
      debug(){ return { st, step(n){ for (let i=0;i<n;i++) { update(1 / 60); updateCam(1 / 60); } }, shoot(dx, dy, type){ if (type) st.sel = type; st.loadAnim = null; st.pull = { dx, dy }; const v = launchV(st.pull); fire(v.vx, v.vy); }, launchV, REST, MAXPULL }; },
      key(e){
        if (!st || st.over) return;
        const num = '12345'.indexOf(e.key); if (num >= 0) { const types = AMMO_ORDER.filter(k => st.inv[k] > 0); if (types[num]) { st.sel = types[num]; if (st.loaded) loadBall(st.sel); } }
        if ((e.key === ' ' || e.key === 'Enter') && st.loaded && st.inv[st.sel] > 0) { e.preventDefault(); st.pull = { dx: -60, dy: 50 }; const v = launchV(st.pull); fire(v.vx, v.vy); }
      },
    };
  }
  PB.register(createCastle);
})();
