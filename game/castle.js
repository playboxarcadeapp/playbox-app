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
    // stone, rock pedestals from level 8, shield walls from level 4, bunkers, bridges and stilts, and
    // only about one shot per goblin plus two spare.
    function levelSpec(n, R){
      const blocks = [], statics = [];
      const pStone = Math.min(0.65, Math.max(0, (n - 4) / 30)), pIce = Math.min(0.5, Math.max(0, (n - 1) / 16));
      const mat = () => { const r = R(); return r < pStone ? 'dark' : r < pStone + pIce ? 'gray' : r < 0.93 ? 'sand' : 'wood'; };
      const add = (x, yBottom, w, h, type, m) => { blocks.push({ x, y: yBottom - h / 2, w, h, type, mat: m || mat(), flag: R() < 0.35 ? BANNERS[Math.floor(R() * BANNERS.length)] : null, roof: ROOFS[Math.floor(R() * ROOFS.length)] }); return yBottom - h; };
      const goblin = (x, yBottom) => blocks.push({ x, y: yBottom - 23, w: 34, h: 46, type: 'goblin', mat: 'goblin' });
      const B = {
        tower(x, k, y){ k = Math.min(k, 6); for (let i=0;i<k;i++) y = add(x, y, i % 2 ? 36 : 44, i % 2 ? 62 : 44, i % 2 ? 'tower' : 'keep'); return y; },
        arch(x, k, y){ const y1 = add(x - 34, y, 24, 62, 'tower'); add(x + 34, y, 24, 62, 'tower'); y = add(x, y1, 104, 20, 'wall'); for (let i=0;i<k;i++) y = add(x, y, 40, 40, 'keep'); return y; },
        pyramid(x, k, y){ const rows = Math.min(k, groups === 3 ? 3 : 4); let top = y; for (let r=0;r<rows;r++) for (let i=0;i<rows - r;i++) top = Math.min(top, add(x + (i - (rows - r - 1) / 2) * 42, y - r * 40, 40, 40, 'keep')); return top; },
        walls(x, k, y){ for (let i=0;i<k;i++) y = add(x, y, 84, 24, 'wall'); return y; },
        // classic "rooms": posts and planks with a goblin sitting inside each floor
        rooms(x, k, y){ for (let i=0;i<Math.min(k, 3);i++) { add(x - 38, y, 22, 62, 'post'); add(x + 38, y, 22, 62, 'post'); if (i > 0 || R() < 0.7) goblin(x, y); y = add(x, y - 62, 104, 18, 'wall'); } return y; },
        // a stone bunker: the goblin hides between thick walls under a heavy roof
        bunker(x, k, y){ add(x - 40, y, 20, 58, 'wall', n >= 8 ? 'dark' : 'gray'); add(x + 40, y, 20, 58, 'wall', n >= 8 ? 'dark' : 'gray'); goblin(x, y); y = add(x, y - 58, 108, 18, 'wall', n >= 12 ? 'dark' : mat()); for (let i=1;i<Math.min(k, 4);i++) y = add(x, y, 40, 40, 'keep'); return y; },
        // a rope-bridge style span between two towers with goblins standing on it
        bridge(x, k, y){ const h = 60 + Math.min(40, k * 8); add(x - 56, y, 24, h, 'tower'); add(x + 56, y, 24, h, 'tower'); y = add(x, y - h, 140, 16, 'wall'); goblin(x - 36, y); goblin(x + 36, y); return add(x, y, 26, 34, 'keep'); },
        // a platform on stilts with little battlements and a goblin in the middle
        stilts(x, k, y){ const h = 56 + Math.min(36, k * 6); for (const dx of [-44, 0, 44]) add(x + dx, y, 14, h, 'post'); y = add(x, y - h, 112, 16, 'wall'); add(x - 42, y, 24, 30, 'keep'); goblin(x, y); return add(x + 42, y, 24, 30, 'keep'); },
        fortress(x, k, y){ const y1 = add(x - 46, y, 28, 72, 'tower'); add(x + 46, y, 28, 72, 'tower'); add(x, y, 40, 40, 'keep'); y = add(x, y1, 136, 18, 'wall'); add(x - 44, y, 32, 32, 'keep'); add(x + 44, y, 32, 32, 'keep'); y = add(x, y, 36, 58, 'tower'); for (let i=1;i<k;i++) y = add(x, y, 34, 34, 'keep'); return y; },
      };
      const groups = n < 3 ? 1 : n < 10 ? 2 : (n % 3 === 0 || n >= 30 && n % 2 === 0) ? 3 : 2;
      const kinds = n < 3 ? ['tower'] : n < 6 ? ['tower', 'rooms', 'walls'] : n < 10 ? ['rooms', 'bunker', 'arch', 'stilts', 'tower'] : n < 18 ? ['rooms', 'bunker', 'arch', 'pyramid', 'stilts', 'bridge'] : ['bunker', 'fortress', 'rooms', 'pyramid', 'bridge', 'stilts', 'bunker'];
      const xs = groups === 1 ? [n < 3 ? 470 : 510] : groups === 2 ? [445, 590] : [405, 530, 655];
      const size = 2 + Math.min(6, Math.floor(n / 5));
      const wantGobs = Math.min(9, n < 3 ? n : 1 + Math.floor(n / 3));
      const freeTop = b => !blocks.some(o => o !== b && Math.abs((o.y + o.h / 2) - (b.y - b.h / 2)) < 3 && Math.abs(o.x - b.x) < (o.w + b.w) / 2 - 4);
      for (let g=0; g<groups; g++) {
        let kind = kinds[Math.floor(R() * kinds.length)];
        if (groups >= 2 && (kind === 'fortress' || kind === 'pyramid') && g > 0 && R() < 0.6) kind = 'tower';
        if (groups === 3 && (kind === 'bridge' || kind === 'fortress')) kind = 'bunker';
        let base = GROUND;
        // castles on rocky hills from level 8 (only narrow castles fit on a hill)
        const pw = groups === 1 ? 200 : groups === 2 ? 136 : 118;
        if (n >= 8 && R() < Math.min(0.7, 0.25 + n / 80)) { const ph = 40 + Math.floor(R() * Math.min(90, 20 + n * 2)); statics.push({ x: xs[g], y: GROUND - ph / 2, w: pw, h: ph }); base = GROUND - ph; if (kind === 'pyramid' || kind === 'fortress' || kind === 'walls' || kind === 'bridge' || (kind === 'bunker' && groups === 3)) kind = ['tower', 'arch', 'rooms', 'stilts'][Math.floor(R() * 4)]; }
        const k = Math.max(kind === 'tower' ? 3 : 1, size + Math.floor(R() * 2));
        const top = B[kind](xs[g], k, base);
        if (kind === 'rooms' ? R() < 0.5 : kind !== 'bridge' && kind !== 'stilts') goblin(xs[g], top);
        if (n >= 4 && base === GROUND && R() < Math.min(0.9, 0.3 + n / 40)) { const sh = Math.min(110, 44 + n * 1.6), sx = xs[g] - (g === 0 ? 95 : 72);
          if (!blocks.some(o => Math.abs(o.x - sx) < (o.w + 24) / 2 && o.y + o.h / 2 > GROUND - sh - 4)) add(sx, base, 20, sh, 'wall', n >= 20 ? 'dark' : 'gray'); }
      }
      // extra goblins sit on free ledges
      let extra = wantGobs - blocks.filter(b => b.type === 'goblin').length, guard = 0;
      while (extra > 0 && guard++ < 40) {
        const roomy = b => !blocks.some(o => o !== b && Math.abs(o.x - b.x) < (o.w + 36) / 2 && (o.y + o.h / 2) > b.y - b.h / 2 - 50 && (o.y - o.h / 2) < b.y - b.h / 2);
        const ledges = blocks.filter(b => b.type !== 'goblin' && b.type !== 'post' && freeTop(b) && roomy(b) && b.w >= 32 && b.y - b.h / 2 < GROUND - 30);
        if (!ledges.length) break;
        const b = ledges[Math.floor(R() * ledges.length)]; goblin(b.x, b.y - b.h / 2); extra--;
      }
      // any goblins still to place hide on the ground just behind a castle
      let hidden = 0;
      if (n >= 10) for (let g = groups - 1; g >= 0 && extra > 0; g--) {
        const near = [...blocks, ...statics].filter(o => Math.abs(o.x - xs[g]) < 75), right = Math.max(xs[g] + 30, ...near.map(o => o.x + o.w / 2)), gx = right + 21;
        if (g === groups - 1 && gx > xs[g] + 108) continue;
        if (!blocks.some(o => Math.abs(o.x - gx) < (o.w + 40) / 2 && o.y + o.h / 2 > GROUND - 50) && !statics.some(o => Math.abs(o.x - gx) < (o.w + 40) / 2)) { goblin(gx, GROUND); extra--; hidden++; } }
      const gobs = blocks.filter(b => b.type === 'goblin').length;
      const spare = n >= 25 ? 3 : 2;
      const total = Math.min(15, gobs + spare + hidden + Math.floor(blocks.length / 18));
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
        pull: null, drag: null, band: 0, bandV: 0, slow: 0, loadAnim: null, fwIn: 0, trayRects: [], preview: null, cam: null, camShot: null, camHold: 0, flash: 0, flyGobs: [], watch: null, hello: false };
      st.world = makeWorld(spec); st.world.iters = 16;
      st.blocks = spec.blocks.map(b => { const hp = MAT[b.mat].hp * (b.type === 'wall' ? 1.15 : 1); const body = P.makeBox(b.x, b.y, b.w, b.h, MAT[b.mat].d, { friction: 0.95, data: { block: true, ...b, hp, maxHp: hp } }); st.world.add(body); return body; });
      for (let i=0;i<300;i++) st.world.step(1 / 120);
      for (const b of st.blocks) { b.vx = b.vy = b.w = 0; b.data.y0 = b.y; b.data.a0 = b.a; b.data.x0 = b.x; }
      st.armed = true; pickAmmo();
      st.goblins = st.blocks.filter(b => b.data.mat === 'goblin').length;
      if (A && A.lumps) for (const sp of spec.statics) outcrop(sp);
    }
    function fire(vx, vy){ if (PB.sfx) { PB.sfx('launch'); PB.sfx('whoosh'); }
      const type = st.sel; if (!(st.inv[type] > 0)) return;
      st.inv[type]--;
      const Am = AMMO[type], P = PB.physics;
      const ball = P.makeCircle(REST.x + st.pull.dx, REST.y + st.pull.dy, Am.r, Am.d * 1.1, { friction: 0.6, data: { shot: true, type, main: true } });
      ball.vx = vx; ball.vy = vy; ball.age = 0;
      st.world.add(ball); st.shots.push(ball); st.camShot = ball;
      st.loaded = false; st.reload = 0; st.lastFire = st.time; st.watch = { gobs: st.gobs || 0 }; st.preview = null; st.loadAnim = null;
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
      bonkFx(b); launchGoblin(b); chunks([b.x, b.y], '#9cff5a', 5, 0.8); dust([b.x, b.y], '#9cff5a', 14);
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
      updateGoblins(dt);
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
    // Everything far away is painted pixel by pixel once at load: real mountain ranges with lit and
    // shaded faces, snow and valley mist, a forest belt, the king's castle, and rolling farmland.
    function makeNZ(){
      const N = 256, grid = new Float32Array(N * N), R = rnd(99); for (let i=0;i<N*N;i++) grid[i] = R();
      const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
        const x0 = xi & 255, y0 = yi & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, a = grid[y0 * N + x0], b = grid[y0 * N + x1], c = grid[y1 * N + x0], d = grid[y1 * N + x1];
        return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w; };
      const fbm = (x, y, o = 5) => { let s = 0, a = 0.5, t = 0; for (let i=0;i<o;i++) { s += a * v(x, y); t += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; } return s / t; };
      const ridge = (x, y, o = 5) => { let s = 0, a = 0.5, t = 0, w = 1; for (let i=0;i<o;i++) { let n = 1 - Math.abs(v(x, y) * 2 - 1); n *= n * w; w = Math.min(1, n * 1.6 + 0.2); s += a * n; t += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; } return s / t; };
      return { v, fbm, ridge };
    }
    const NZ = makeNZ();
    const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // paint one layer straight into pixels; fn(x, y) returns [r, g, b, a] in 0..1 or null for empty
    function pixels(w, h, top, fn){ const c = cv(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
      for (let x=0;x<w;x++) { const y0 = Math.max(0, Math.floor(top(x))); for (let y=y0;y<h;y++) { const p = fn(x, y); if (!p) continue; const i = (y * w + x) * 4; d[i] = p[0] * 255; d[i+1] = p[1] * 255; d[i+2] = p[2] * 255; d[i+3] = (p[3] ?? 1) * 255; } }
      g.putImageData(id, 0, 0); return c; }
    // a mountain range seen from afar. The face is a bumpy surface (ridges bulge toward us, gullies sink
    // back); light comes from the upper left, so each spur gets a bright side and a shaded side.
    function range(w, h, o){
      const hAt = x => o.base - o.amp * Math.pow(NZ.ridge(x / o.scale + o.seed, o.seed * 3.1, 5), o.pow || 1.5) - o.amp * 0.08 * NZ.fbm(x / 40, o.seed, 3);
      const H = new Float32Array(w); let top = h; for (let x=0;x<w;x++) { H[x] = hAt(x); top = Math.min(top, H[x]); }
      const c = cv(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data, D = new Float32Array(w);
      const { lit, shadow: shd, haze } = o;
      for (let y=Math.floor(top);y<h;y++) {
        for (let x=0;x<w;x++) { const t = y - H[x]; if (t < -2) { D[x] = NaN; continue; }
          const tt = Math.max(0, t), warp = (NZ.fbm(x / 160, y / 160 + o.seed, 3) - 0.5) * 90;
          D[x] = -(H[x] / o.amp) * 1.1 * Math.exp(-tt / (o.amp * 0.55)) + 0.42 * NZ.ridge((x + warp) / 75 + o.seed, tt / 230, 4) + 0.13 * NZ.ridge(x / 19, tt / 46 + o.seed, 3); }
        for (let x=1;x<w-1;x++) { const t = y - H[x]; if (t < 0 || isNaN(D[x])) continue;
          const dl = isNaN(D[x - 1]) ? D[x] : D[x - 1], dr = isNaN(D[x + 1]) ? D[x] : D[x + 1];
          let l = 0.5 + Math.max(-0.5, Math.min(0.5, (dl - dr) * 9));
          l += (NZ.v(x / 5, y / 5) - 0.5) * 0.12;
          let col = mixc(shd, lit, sstep(0.3, 0.7, l));
          if (o.green) { const gl = sstep(o.green - 50, o.green + 50, y + (NZ.fbm(x / 30, y / 30, 3) - 0.5) * 120); col = mixc(col, mixc(o.gshadow, o.glit, sstep(0.3, 0.7, l)), gl); }
          const sl = Math.min(o.snow, H[x] + o.amp * 0.42) + (NZ.fbm(x / 22, y / 22 + 7, 4) - 0.5) * 120 + (l - 0.5) * 90 + (NZ.ridge(x / 12, y / 30, 3) - 0.5) * 60;
          if (y < sl) { const sn = sstep(0, 10, sl - y); col = mixc(col, l > 0.48 ? [1, 0.99, 0.97] : [0.7, 0.77, 0.94], sn * (0.8 + 0.2 * NZ.v(x / 3, y / 3))); }
          const mist = sstep(o.base - o.amp * 0.2, h, y) * (o.mist ?? 0.9) + (o.hazeAll || 0);
          col = mixc(col, haze, Math.min(1, mist));
          const i = (y * w + x) * 4; d[i] = col[0] * 255; d[i+1] = col[1] * 255; d[i+2] = col[2] * 255; d[i+3] = 255 * Math.min(1, t + 0.5); }
      }
      g.putImageData(id, 0, 0); return c;
    }
    // a belt of fir trees painted one by one, back rows hazier and smaller
    function firBelt(g, w, yBase, rows, seed, cols){
      const R = rnd(seed), rgb = c => `rgb(${c.map(v => Math.max(0, Math.min(1, v)) * 255 | 0)})`;
      const fir = (x, yy, hh, dark, light) => { const ww = hh * 0.34, tiers = 6 + (hh > 50 ? 3 : 0);
        g.fillStyle = rgb(dark); g.beginPath(); g.moveTo(x, yy - hh);
        for (let i=1;i<=tiers;i++) { const ty = yy - hh + hh * Math.pow(i / tiers, 0.9), tw = ww * (i / tiers) * (0.8 + R() * 0.4); g.quadraticCurveTo(x + tw * 0.6, ty - hh * 0.05, x + tw, ty + hh * 0.015); g.lineTo(x + tw * 0.35, ty - hh * 0.02); }
        for (let i=tiers;i>=1;i--) { const ty = yy - hh + hh * Math.pow(i / tiers, 0.9), tw = ww * (i / tiers) * (0.8 + R() * 0.4); g.lineTo(x - tw * 0.35, ty - hh * 0.02); g.quadraticCurveTo(x - tw * 0.6, ty - hh * 0.05, x - tw, ty + hh * 0.015); }
        g.closePath(); g.fill();
        g.fillStyle = rgb(light);
        for (let i=1;i<=tiers;i++) { const ty = yy - hh + hh * Math.pow(i / tiers, 0.9), tw = ww * (i / tiers); g.beginPath(); g.moveTo(x - tw * 0.05, ty - hh / tiers * 0.9); g.quadraticCurveTo(x - tw * 0.55, ty - hh * 0.04, x - tw * 0.95, ty + hh * 0.01); g.lineTo(x - tw * 0.3, ty - hh * 0.015); g.closePath(); g.fill(); } };
      for (let r=0;r<rows;r++) { const k = r / Math.max(1, rows - 1), y0 = yBase + r * 34, haze = 1 - k;
        for (let x = -30; x < w + 30; x += 5 + R() * (6 + k * 10)) {
          const hh = (16 + k * 34) * (0.6 + R() * 0.8), yy = y0 + (NZ.fbm(x / 160, seed + r, 3) - 0.5) * 50 + R() * 8, v = (R() - 0.5) * 0.08;
          const dark = mixc(cols.dark, cols.haze, haze * 0.72).map(c => c + v), light = mixc(cols.light, cols.haze, haze * 0.66).map(c => c + v);
          fir(x, yy, hh, dark, light);
        }
        const mg = g.createLinearGradient(0, y0 - 20, 0, y0 + 40); const hz = cols.haze.map(v => v * 255 | 0);
        mg.addColorStop(0, `rgba(${hz},0)`); mg.addColorStop(1, `rgba(${hz},${0.55 * haze})`); g.fillStyle = mg; g.fillRect(0, y0 - 20, w, 60);
      }
    }
    // the king's castle far away on a rocky hill, lit warmly from the left
    function farCastle(g, kx, ky, s){
      const stone = '#b9b3d8', shadow = '#8e88b8', roof = '#5d4f9a', roofL = '#7f72c0';
      g.fillStyle = '#9aa5cf'; g.beginPath(); g.moveTo(kx - 220 * s, ky + 70 * s); g.quadraticCurveTo(kx - 60 * s, ky - 10 * s, kx, ky - 6 * s); g.quadraticCurveTo(kx + 80 * s, ky - 6 * s, kx + 240 * s, ky + 70 * s); g.closePath(); g.fill();
      const tower = (x, top, tw, cone) => { const gr = g.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0); gr.addColorStop(0, stone); gr.addColorStop(0.55, stone); gr.addColorStop(1, shadow); g.fillStyle = gr; g.fillRect(x - tw / 2, top, tw, ky - top + 4 * s);
        if (cone) { g.fillStyle = roofL; g.beginPath(); g.moveTo(x - tw * 0.62, top); g.lineTo(x, top - tw * 1.5); g.lineTo(x, top); g.fill(); g.fillStyle = roof; g.beginPath(); g.moveTo(x, top - tw * 1.5); g.lineTo(x + tw * 0.62, top); g.lineTo(x, top); g.fill();
          g.strokeStyle = '#6a5a8a'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x, top - tw * 1.5); g.lineTo(x, top - tw * 1.5 - 14 * s); g.stroke(); g.fillStyle = '#e8534a'; g.beginPath(); g.moveTo(x, top - tw * 1.5 - 14 * s); g.lineTo(x + 10 * s, top - tw * 1.5 - 11 * s); g.lineTo(x, top - tw * 1.5 - 8 * s); g.fill(); }
        else for (let k=0;k<3;k++) { g.fillStyle = stone; g.fillRect(x - tw / 2 + k * tw / 2.5, top - 5 * s, tw / 5, 5 * s); }
        g.fillStyle = 'rgba(255,214,140,.9)'; for (let k=0;k<2;k++) g.fillRect(x - 1.5 * s, top + (10 + k * 14) * s, 3 * s, 5 * s); };
      g.fillStyle = shadow; g.fillRect(kx - 70 * s, ky - 40 * s, 150 * s, 44 * s); g.fillStyle = stone; g.fillRect(kx - 70 * s, ky - 40 * s, 100 * s, 44 * s);
      for (let k=0;k<8;k++) { g.fillStyle = stone; g.fillRect(kx - 70 * s + k * 19 * s, ky - 46 * s, 10 * s, 6 * s); }
      tower(kx - 76 * s, ky - 80 * s, 22 * s, true); tower(kx + 82 * s, ky - 74 * s, 22 * s, true); tower(kx - 18 * s, ky - 120 * s, 30 * s, true); tower(kx + 34 * s, ky - 96 * s, 24 * s, true); tower(kx + 8 * s, ky - 62 * s, 18 * s, false);
      g.fillStyle = '#4a3a5a'; g.beginPath(); g.moveTo(kx - 8 * s, ky + 4 * s); g.lineTo(kx - 8 * s, ky - 14 * s); g.arc(kx, ky - 14 * s, 8 * s, Math.PI, 0); g.lineTo(kx + 8 * s, ky + 4 * s); g.fill();
    }
    function mountainsTex(){
      const w = 4096, h = 1024, c = cv(w, h), g = c.getContext('2d');
      const hazeFar = [0.74, 0.83, 0.96], hazeMid = [0.68, 0.8, 0.93];
      g.drawImage(range(w, h, { base: 760, amp: 600, scale: 900, seed: 3, pow: 1.3, lit: [0.82, 0.74, 0.76], shadow: [0.36, 0.42, 0.68], haze: hazeFar, snow: 470, mist: 0.9, hazeAll: 0.18 }), 0, 0);
      g.drawImage(range(w, h, { base: 900, amp: 480, scale: 520, seed: 11, pow: 1.2, lit: [0.66, 0.6, 0.6], shadow: [0.28, 0.33, 0.52], haze: hazeMid, snow: 560, mist: 0.75, hazeAll: 0.06, green: 760, glit: [0.46, 0.64, 0.44], gshadow: [0.2, 0.36, 0.38] }), 0, 0);
      farCastle(g, 2650, 800, 1.25);
      // sun haze glowing over the ranges
      const sg = g.createRadialGradient(3300, 300, 10, 3300, 300, 1200); sg.addColorStop(0, 'rgba(255,240,205,.35)'); sg.addColorStop(1, 'rgba(255,240,205,0)'); g.fillStyle = sg; g.fillRect(0, 0, w, h);
      firBelt(g, w, 830, 6, 7, { dark: [0.12, 0.3, 0.27], light: [0.32, 0.55, 0.36], haze: hazeMid });
      const bg = g.createLinearGradient(0, 900, 0, h); bg.addColorStop(0, 'rgba(40,86,62,0)'); bg.addColorStop(1, 'rgba(40,86,62,1)'); g.fillStyle = bg; g.fillRect(0, 900, w, h - 900);
      return c; }
    // fluffy clouds shaded like real cumulus: bright tops, soft blue-grey bellies
    function cloudTex(seed){
      seed = seed || 3; const w = 512, h = 256, R = rnd(seed), blobs = [];
      for (let i=0;i<14;i++) { const t = i / 13; blobs.push([60 + t * 390 + (R() - .5) * 40, 175 - Math.sin(t * Math.PI) * (40 + R() * 55), 26 + Math.sin(t * Math.PI) * 46 + R() * 18]); }
      const dens = (x, y) => { let d = 0; for (const [bx, by, br] of blobs) { const q = ((x - bx) ** 2 + (y - by) ** 2) / (br * br); if (q < 1) d = Math.max(d, 1 - q); } return d * (0.75 + 0.5 * NZ.fbm(x / 22 + seed, y / 22, 4)) - (y > 190 ? (y - 190) / 30 : 0); };
      return pixels(w, h, () => 0, (x, y) => {
        const d = dens(x, y); if (d <= 0.08) return null;
        const lit = Math.max(0, d - dens(x - 10, y - 14));        // light from the upper left
        const a = sstep(0.08, 0.3, d);
        const sh = sstep(120, 215, y);
        let col = mixc([1, 1, 1], [0.7, 0.76, 0.9], sh * 0.85 + (1 - Math.min(1, lit * 6)) * 0.25);
        col = mixc(col, [1, 0.97, 0.9], Math.min(1, lit * 3) * (1 - sh));
        return [col[0], col[1], col[2], a];
      });
    }
    // rich soil with stones, roots and darker layers for the cut-away slice in front
    function soilTex(){
      const w = 512, h = 512, R = rnd(29);
      const base = pixels(w, h, () => 0, (x, y) => {
        const n = NZ.fbm(x / 40, y / 40, 5), band = Math.sin(y / 512 * Math.PI * 6 + NZ.fbm(x / 120, y / 60, 3) * 4) * 0.5 + 0.5;
        let col = mixc([0.44, 0.27, 0.15], [0.28, 0.16, 0.08], y / h * 0.6 + band * 0.25);
        col = mixc(col, [0.55, 0.38, 0.22], sstep(0.55, 0.75, n) * 0.5);
        const f = (NZ.v(x / 1.6, y / 1.6) - 0.5) * 0.12; return [col[0] + f, col[1] + f, col[2] + f];
      });
      const g = base.getContext('2d');
      // roots
      g.lineCap = 'round'; for (let i=0;i<12;i++) { let x = R() * w, y = -10, lw = 7 + R() * 6; for (let k=0;k<9 && lw > 0.5;k++) { const nx = x + (R() - .5) * 60, ny = y + 20 + R() * 34; g.strokeStyle = 'rgba(70,40,18,.9)'; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + nx) / 2 + (R() - .5) * 20, (y + ny) / 2, nx, ny); g.stroke(); g.strokeStyle = 'rgba(150,100,60,.35)'; g.lineWidth = lw * 0.35; g.stroke(); x = nx; y = ny; lw *= 0.8; } }
      // stones half buried in the earth: irregular, earthy, with a soft top light
      for (let i=0;i<70;i++) { const x = R() * w, y = R() * h, r = 4 + R() * R() * 20, a = R() * 3, tone = 0.32 + R() * 0.26, warm = R() * 0.06;
        const pts = []; for (let k=0;k<9;k++) { const an = k / 9 * Math.PI * 2, rr = r * (0.75 + R() * 0.35); pts.push([x + Math.cos(an + a) * rr, y + Math.sin(an + a) * rr * 0.7]); }
        const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k=1;k<=9;k++) { const p0 = pts[k % 9], p1 = pts[(k + 1) % 9]; g.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2); } g.closePath(); };
        g.save(); g.translate(r * 0.12, r * 0.22); g.fillStyle = 'rgba(25,12,4,.55)'; path(); g.fill(); g.restore();
        const gr = g.createLinearGradient(x - r * 0.4, y - r * 0.7, x + r * 0.3, y + r * 0.7); gr.addColorStop(0, `rgb(${[tone + 0.2 + warm, tone + 0.17, tone + 0.12].map(v => v * 255 | 0)})`); gr.addColorStop(1, `rgb(${[tone * 0.6 + warm, tone * 0.52, tone * 0.45].map(v => v * 255 | 0)})`);
        g.fillStyle = gr; path(); g.fill();
        g.globalAlpha = 0.25; g.fillStyle = '#000'; for (let k=0;k<6;k++) { g.fillRect(x + (R() - .5) * r, y + (R() - .5) * r * 0.6, 1.5, 1.5); } g.globalAlpha = 1; }
      return base; }
    // rolling farmland: a patchwork of fields edged with hedgerows, copses of oaks, a river and cottages
    function hillsTex(){
      const w = 4096, h = 768, R = rnd(23), c = cv(w, h), g = c.getContext('2d');
      const FIELD = [[0.5, 0.74, 0.3], [0.6, 0.8, 0.34], [0.8, 0.8, 0.38], [0.44, 0.68, 0.28], [0.68, 0.84, 0.4], [0.92, 0.82, 0.44], [0.4, 0.62, 0.28], [0.56, 0.78, 0.36]];
      const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
      const hill = (base, amp, f, ph, seed, haze, hz, rowH) => {
        const top = x => base - (Math.sin(x * f + ph) * 0.5 + 0.5) * amp - Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.18 - (NZ.fbm(x / 200, seed, 3) - 0.5) * amp * 0.4;
        const T = new Float32Array(w + 2); for (let x=-1;x<=w;x++) T[x + 1] = top(x);
        const SM = new Float32Array(w); for (let x=0;x<w;x++) { let a = 0; for (let k=-20;k<=20;k++) { const i = Math.min(w - 1, Math.max(0, x + k)); a += (T[i] - T[i + 2]) * 0.5; } SM[x] = a / 41; }
        g.drawImage(pixels(w, h, x => T[x + 1], (x, y) => {
          const t = y - T[x + 1]; if (t < 0) return null;
          const lgt = Math.max(-0.3, Math.min(0.3, SM[x] * 2.2)) * Math.exp(-t / 160);
          // fields: irregular patches (squashed by distance) edged with hedgerows
          const fu = (x + (NZ.fbm(x / 300, y / 80 + seed, 3) - 0.5) * 60) / (60 + rowH * 22), fv = Math.sqrt(t) * rowH / 26;
          const cu = Math.floor(fu), cv0 = Math.floor(fv); let d1 = 9, d2 = 9, id = 0;
          for (let a=-1;a<=1;a++) for (let b=-1;b<=1;b++) { const iu = cu + a, iv = cv0 + b, px = iu + hash(iu, iv + seed), py = iv + hash(iv + 7, iu - seed);
            const dd = (fu - px) * (fu - px) + (fv - py) * (fv - py) * 2.2; if (dd < d1) { d2 = d1; d1 = dd; id = hash(iu * 3 + 1, iv * 5 + seed); } else if (dd < d2) d2 = dd; }
          let col = FIELD[Math.floor(id * FIELD.length)];
          if (id > 0.6 && id < 0.78) { const stripe = Math.sin((x * (0.3 + id * 0.4) + y * 2.2)) > 0 ? 1.05 : 0.94; col = col.map(c => c * stripe); }
          const n = (NZ.fbm(x / 7, y / 7, 3) - 0.5) * 0.1; col = col.map((c, k) => c + n * (k === 1 ? 1.2 : 1));
          col = col.map(c => c * (0.92 + lgt) + (lgt > 0 ? lgt * 0.12 : 0));
          const edge = (Math.sqrt(d2) - Math.sqrt(d1)) * (60 + rowH * 22) / (1 + 40 / (t + 20)), hw = 1.6 + t / 140 + NZ.v(x / 4, y / 4) * 1.4;
          if (edge < hw && hash(Math.floor(d2 * 50), 3) < 0.85) { const k = edge / hw; col = mixc([0.14, 0.33, 0.15], [0.4, 0.6, 0.26], (1 - k) * 0.4 + NZ.v(x / 1.7, y / 1.7) * 0.4); }
          if (t < 2.5) col = mixc(col, [0.95, 1, 0.8], 0.25);
          return mixc(col, haze, hz * (1 - Math.min(1, t / 500) * 0.4));
        }), 0, 0);
        return T;
      };
      const rgb = c => `rgb(${c.map(v => Math.max(0, Math.min(1, v)) * 255 | 0)})`;
      const oak = (x, y, s, haze) => { const L = mixc([0.46, 0.7, 0.3], [0.72, 0.82, 0.9], haze), D = mixc([0.12, 0.3, 0.14], [0.6, 0.72, 0.84], haze), M = mixc(L, D, 0.5);
        g.fillStyle = 'rgba(20,50,20,.3)'; g.beginPath(); g.ellipse(x + 6 * s, y + 1, 15 * s, 3.5 * s, 0, 0, 7); g.fill();
        g.fillStyle = rgb(mixc([0.3, 0.2, 0.12], [0.6, 0.66, 0.78], haze)); g.fillRect(x - 1.4 * s, y - 12 * s, 2.8 * s, 12 * s);
        const puffs = []; for (let k=0;k<11;k++) { const a = R() * Math.PI * 2, d = R() * 9 * s; puffs.push([x + Math.cos(a) * d * 1.2, y - 22 * s + Math.sin(a) * d * 0.8, (5 + R() * 4) * s]); }
        puffs.sort((p, q) => q[1] - p[1]);
        for (const [bx, by, r] of puffs) { g.fillStyle = rgb(D); g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill(); }
        for (const [bx, by, r] of puffs) { g.fillStyle = rgb(M); g.beginPath(); g.arc(bx - r * 0.2, by - r * 0.25, r * 0.75, 0, 7); g.fill(); g.fillStyle = rgb(L); g.beginPath(); g.arc(bx - r * 0.4, by - r * 0.45, r * 0.4, 0, 7); g.fill(); } };
      const cottage = (x, y, s, roofC) => { g.fillStyle = 'rgba(30,50,20,.3)'; g.fillRect(x - 2 * s, y - 1, 36 * s, 3 * s);
        g.fillStyle = '#f4ead6'; g.fillRect(x, y - 16 * s, 26 * s, 16 * s); g.fillStyle = '#cbbb9c'; g.fillRect(x + 18 * s, y - 16 * s, 8 * s, 16 * s);
        g.fillStyle = roofC; g.beginPath(); g.moveTo(x - 3 * s, y - 15 * s); g.lineTo(x + 13 * s, y - 28 * s); g.lineTo(x + 29 * s, y - 15 * s); g.fill();
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(x + 13 * s, y - 28 * s); g.lineTo(x + 29 * s, y - 15 * s); g.lineTo(x + 18 * s, y - 15 * s); g.fill();
        g.fillStyle = '#5a3a22'; g.fillRect(x + 5 * s, y - 8 * s, 5 * s, 8 * s); g.fillStyle = '#ffd98a'; g.fillRect(x + 12 * s, y - 11 * s, 4 * s, 4 * s);
        g.fillStyle = '#8a7a6a'; g.fillRect(x + 19 * s, y - 31 * s, 4 * s, 9 * s); g.fillStyle = 'rgba(235,240,250,.6)'; for (let k=0;k<3;k++) { g.beginPath(); g.arc(x + 22 * s + k * 4 * s, y - 35 * s - k * 6 * s, (2 + k) * s, 0, 7); g.fill(); } };
      const T1 = hill(300, 110, 0.0021, 0.8, 5, [0.72, 0.83, 0.94], 0.45, 3);
      for (let x = 0; x < w; x += 4 + R() * 10) if (NZ.v(x / 90, 3) > 0.62) oak(x, T1[Math.min(w, x | 0) + 1] + 10 + R() * 50 * NZ.v(x / 40, 1), 0.45 + R() * 0.25, 0.48);
      // the river, with sky reflections and sparkles
      g.save(); const ry = x => 455 + Math.sin(x / 420) * 26 + Math.sin(x / 150) * 8;
      g.beginPath(); g.moveTo(0, ry(0)); for (let x=0;x<=w;x+=16) g.lineTo(x, ry(x) - 6 - Math.sin(x / 300) * 4); for (let x=w;x>=0;x-=16) g.lineTo(x, ry(x) + 7 + Math.sin(x / 260) * 3); g.closePath();
      const rg = g.createLinearGradient(0, 430, 0, 490); rg.addColorStop(0, '#d4efff'); rg.addColorStop(1, '#5fa6e0'); g.fillStyle = rg; g.fill(); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; for (let i=0;i<300;i++) { const x = R() * w, y = ry(x) + (R() - .5) * 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + R() * 14, y); g.stroke(); } g.restore();
      const T2 = hill(560, 150, 0.0016, 2.4, 9, [0.72, 0.83, 0.92], 0.12, 5);
      for (let i=0;i<9;i++) { const x = 200 + i * 440 + R() * 160; cottage(x, T2[(x | 0) + 1] + 40 + R() * 50, 1.15, ['#b8483a', '#3e6fae', '#8a5aa8', '#c7802e'][i % 4]); }
      for (let x = 0; x < w; x += 5 + R() * 14) if (NZ.v(x / 70, 9) > 0.6) oak(x, T2[Math.min(w, x | 0) + 1] + 8 + R() * 110 * NZ.v(x / 50, 2), 0.85 + R() * 0.5, 0.08);
      const bg = g.createLinearGradient(0, 660, 0, h); bg.addColorStop(0, 'rgba(80,140,60,0)'); bg.addColorStop(1, 'rgba(80,140,60,1)'); g.fillStyle = bg; g.fillRect(0, 660, w, h - 660);
      return c; }

    // ---------- textures for the 3D scenery, goblins and slingshot ----------
    const rgbs = c => `rgb(${c.map(v => Math.max(0, Math.min(1, v)) * 255 | 0)})`;
    function leafTex(){ const s = 256, c = cv(s, s), g = c.getContext('2d'), R = rnd(61);
      g.fillStyle = '#2f5a24'; g.fillRect(0, 0, s, s);
      for (let i=0;i<1400;i++) { const x = R() * s, y = R() * s, l = 7 + R() * 7, a = R() * Math.PI * 2, k = R();
        const col = mixc([0.16, 0.34, 0.14], [0.55, 0.78, 0.32], k);
        for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) { g.save(); g.translate(x + ox, y + oy); g.rotate(a);
          const gr = g.createLinearGradient(-l, -l * 0.4, l, l * 0.4); gr.addColorStop(0, rgbs(col.map(v => v * 1.18))); gr.addColorStop(1, rgbs(col.map(v => v * 0.7)));
          g.fillStyle = gr; g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -l * 0.55, l, 0); g.quadraticCurveTo(0, l * 0.55, -l, 0); g.fill();
          g.strokeStyle = 'rgba(20,40,10,.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-l * 0.9, 0); g.lineTo(l * 0.9, 0); g.stroke(); g.restore(); } }
      return c; }
    function needleTex(){ const s = 256, c = cv(s, s), g = c.getContext('2d'), R = rnd(63);
      g.fillStyle = '#1c3d2c'; g.fillRect(0, 0, s, s); g.lineCap = 'round';
      for (let i=0;i<2600;i++) { const x = R() * s, y = R() * s, l = 6 + R() * 9, a = Math.PI / 2 + (R() - .5) * 1.4, k = R();
        g.strokeStyle = rgbs(mixc([0.1, 0.24, 0.17], [0.36, 0.58, 0.36], k)); g.lineWidth = 1.2 + R();
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      return c; }
    function barkTex(){ const w = 256, h = 512, R = rnd(65);
      const c = pixels(w, h, () => 0, (x, y) => { const n = NZ.fbm(x / 9, y / 70, 4), r = NZ.ridge(x / 14, y / 90, 3); let col = mixc([0.24, 0.15, 0.09], [0.52, 0.38, 0.26], n * 0.8 + 0.1); col = mixc(col, [0.12, 0.07, 0.04], sstep(0.55, 0.8, r) * 0.8); const f = (NZ.v(x / 1.5, y / 1.5) - 0.5) * 0.08; return col.map(v => v + f); });
      const g = c.getContext('2d'); for (let i=0;i<5;i++) { const x = R() * w, y = R() * h, r = 6 + R() * 8; const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, '#1a0e06'); gr.addColorStop(0.6, '#4a3020'); gr.addColorStop(1, 'rgba(74,48,32,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 1.5, 0, 0, 7); g.fill(); }
      return c; }
    // a tuft of grass blades with a transparent background (drawn as cut-outs)
    function tuftTex(seed, flowers){ const s = 128, c = cv(s, s), g = c.getContext('2d', { willReadFrequently: true }), R = rnd(seed);
      for (let i=0;i<15;i++) { const bx = 64 + (R() - .5) * 90, lean = (R() - .5) * 70, hh = 50 + R() * 76, w = 2 + R() * 2.2, k = R();
        const tip = [bx + lean, 128 - hh], gr = g.createLinearGradient(0, 128, 0, 128 - hh); gr.addColorStop(0, rgbs(mixc([0.4, 0.6, 0.24], [0.5, 0.68, 0.28], k))); gr.addColorStop(1, rgbs(mixc([0.62, 0.84, 0.34], [0.85, 0.94, 0.5], k)));
        g.fillStyle = gr; g.beginPath(); g.moveTo(bx - w, 128); g.quadraticCurveTo(bx - w * 0.5 + lean * 0.4, 128 - hh * 0.55, tip[0], tip[1]); g.quadraticCurveTo(bx + w * 0.5 + lean * 0.4, 128 - hh * 0.55, bx + w, 128); g.fill(); }
      if (flowers) for (let i=0;i<3;i++) { const x = 30 + R() * 68, y = 20 + R() * 40, col = ['#fff6e8', '#ffd84a', '#ff8fbf', '#b9a6ff'][Math.floor(R() * 4)];
        g.strokeStyle = '#3c7a28'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 8, 128); g.stroke();
        g.fillStyle = col; for (let k=0;k<5;k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4.5, 3, a, 0, 7); g.fill(); } g.fillStyle = '#ffb21f'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
      return c; }
    function goblinSkinTex(){ const w = 256, h = 128, R = rnd(71);
      const c = pixels(w, h, () => 0, (x, y) => { const n = NZ.fbm(x / 14, y / 14, 4); let col = mixc([0.42, 0.64, 0.2], [0.62, 0.82, 0.3], n); col = mixc(col, [0.3, 0.5, 0.16], sstep(0.6, 0.75, NZ.fbm(x / 6 + 9, y / 6, 3)) * 0.5); return col; });
      const g = c.getContext('2d'); for (let i=0;i<40;i++) { const x = R() * w, y = 20 + R() * 90, r = 1 + R() * 2.2; g.fillStyle = 'rgba(60,90,20,.45)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      // rosy cheeks on the front of the head
      for (const d of [-1, 1]) { const gr = g.createRadialGradient(w * 0.25 + d * 30, h * 0.62, 1, w * 0.25 + d * 30, h * 0.62, 16); gr.addColorStop(0, 'rgba(230,110,90,.45)'); gr.addColorStop(1, 'rgba(230,110,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      return c; }
    function tunicTex(){ const s = 128, R = rnd(73);
      const c = pixels(s, s, () => 0, (x, y) => { const n = NZ.fbm(x / 10, y / 10, 4); return mixc([0.36, 0.22, 0.12], [0.56, 0.36, 0.2], n); });
      const g = c.getContext('2d'); g.fillStyle = '#7a5a34'; g.fillRect(70, 40, 30, 26); g.strokeStyle = '#2a1608'; g.setLineDash([3, 3]); g.lineWidth = 1.5; g.strokeRect(70, 40, 30, 26); g.setLineDash([]);
      g.strokeStyle = 'rgba(30,15,5,.6)'; g.lineWidth = 2; for (let y=10;y<s;y+=24) { g.beginPath(); g.moveTo(0, y); for (let x=0;x<=s;x+=8) g.lineTo(x, y + (x % 16 ? 3 : -3)); g.stroke(); }
      return c; }
    function ropeTex(){ const c = cv(64, 64), g = c.getContext('2d'); g.fillStyle = '#b08a4e'; g.fillRect(0, 0, 64, 64);
      for (let i=-64;i<128;i+=12) { const gr = g.createLinearGradient(i, 0, i + 12, 0); gr.addColorStop(0, '#6a4a22'); gr.addColorStop(0.5, '#e0c080'); gr.addColorStop(1, '#6a4a22'); g.fillStyle = gr; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 10, 0); g.lineTo(i + 10 + 64, 64); g.lineTo(i + 64, 64); g.fill(); }
      return c; }
    function leatherTex(){ const s = 128, R = rnd(75);
      const c = pixels(s, s, () => 0, (x, y) => { const n = NZ.fbm(x / 5, y / 5, 4); return mixc([0.26, 0.14, 0.07], [0.48, 0.28, 0.14], n * 0.9 + 0.05); });
      const g = c.getContext('2d'); g.strokeStyle = '#e8d2a0'; g.lineWidth = 2; g.setLineDash([5, 4]); g.strokeRect(8, 8, s - 16, s - 16); g.setLineDash([]); return c; }
    function rockTex2(){ return pixels(256, 256, () => 0, (x, y) => { const n = NZ.fbm(x / 22, y / 22, 5), r = NZ.ridge(x / 30 + 3, y / 18, 4), st2 = Math.sin(y / 9 + NZ.fbm(x / 60, y / 40, 3) * 5) * 0.5 + 0.5;
      let col = mixc([0.42, 0.39, 0.36], [0.74, 0.7, 0.64], n * 0.85 + st2 * 0.15); col = mixc(col, [0.2, 0.18, 0.16], sstep(0.62, 0.82, r) * 0.75); const f = (NZ.v(x / 1.3, y / 1.3) - 0.5) * 0.1; return col.map(v => v + f); }); }
    function mushroomTex(){ const c = cv(128, 64), g = c.getContext('2d'), R = rnd(77); const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#ff4a3a'); gr.addColorStop(1, '#b81f1a'); g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
      g.fillStyle = '#fff6e6'; for (let i=0;i<16;i++) { g.beginPath(); g.ellipse(R() * 128, 6 + R() * 40, 4 + R() * 4, 3 + R() * 3, 0, 0, 7); g.fill(); } g.fillStyle = '#f2e2c4'; g.fillRect(0, 52, 128, 12); return c; }

    function cutout(c, rgb){ const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data;
      for (let i=0;i<d.length;i+=4) if (d[i + 3] < 250) { const a = d[i + 3] / 255; d[i] = d[i] * a + rgb[0] * (1 - a); d[i + 1] = d[i + 1] * a + rgb[1] * (1 - a); d[i + 2] = d[i + 2] * a + rgb[2] * (1 - a); d[i + 3] = a > 0.45 ? 255 : 0; }
      return id; }
    // ---------- geometry helpers ----------
    const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
      cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
    // a smooth tube through a list of points (branches, trunks, rubber bands)
    function tube(path, radii, seg = 10, vScale = 1){
      const P = [], N = [], U = [], I = [], n = path.length; let nPrev = null, len = 0;
      for (let i=0;i<n;i++) {
        const T = v3.norm(v3.sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)]));
        let Nn = nPrev ? v3.sub(nPrev, v3.mul(T, v3.dot(nPrev, T))) : v3.cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]); Nn = v3.norm(Nn); nPrev = Nn;
        const B = v3.cross(T, Nn), r = typeof radii === 'number' ? radii : radii[i];
        if (i) len += Math.hypot(...v3.sub(path[i], path[i - 1]));
        for (let j=0;j<=seg;j++) { const a = j / seg * Math.PI * 2, d = v3.add(v3.mul(Nn, Math.cos(a)), v3.mul(B, Math.sin(a))); P.push(...v3.add(path[i], v3.mul(d, r))); N.push(...d); U.push(j / seg, len * vScale); }
      }
      for (let i=0;i<n-1;i++) for (let j=0;j<seg;j++) { const a = i * (seg + 1) + j, b = a + seg + 1; I.push(a, a + 1, b, a + 1, b + 1, b); }
      // round-ish caps
      for (const [i, sgn] of [[0, -1], [n - 1, 1]]) { const T = v3.norm(v3.sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)])), r = typeof radii === 'number' ? radii : radii[i], c0 = P.length / 3;
        P.push(...v3.add(path[i], v3.mul(T, sgn * r * 0.5))); N.push(...v3.mul(T, sgn)); U.push(0.5, 0.5); const base = i * (seg + 1);
        for (let j=0;j<seg;j++) sgn > 0 ? I.push(c0, base + j, base + j + 1) : I.push(c0, base + j + 1, base + j); }
      return { p: P, n: N, uv: U, idx: I };
    }
    // a lumpy blob (leaf clumps, rocks)
    function lumpy(Gm, seed, amt, ws = 14, hs = 10){ const g = Gm.sphere(1, ws, hs); return Gm.displace(g, (x, y, z) => (NZ.fbm(x * 1.7 + seed, y * 1.7 + z * 1.3 + seed * 0.7, 3) - 0.5) * amt); }
    // one droopy layer of a fir tree: a cone with a jagged hanging rim
    function skirt(r, h, n, seed){ const P = [0, h, 0], N = [0, 1, 0], U = [0.5, 0], I = [], R = rnd(seed);
      for (let i=0;i<2*n;i++) { const a = i / (2 * n) * Math.PI * 2, tip = i % 2 === 0, rr = r * (tip ? 1 + R() * 0.15 : 0.72), y = tip ? -h * 0.14 : h * 0.06; P.push(Math.cos(a) * rr, y, Math.sin(a) * rr); N.push(Math.cos(a), 0.5, Math.sin(a)); U.push(i / (2 * n) * 4, 1); }
      const c = P.length / 3; P.push(0, h * 0.12, 0); N.push(0, -1, 0); U.push(0.5, 0.5);
      for (let i=0;i<2*n;i++) { const a = 1 + i, b = 1 + (i + 1) % (2 * n); I.push(0, b, a, c, a, b); }
      return { p: P, n: N, uv: U, idx: I }; }
    // per-vertex colors (given in sRGB, stored linear) so one merged mesh can hold many shades
    function paint(g, fn){ g.col = []; for (let i=0;i<g.p.length;i+=3) { const c = fn(g.p[i], g.p[i + 1], g.p[i + 2], g.n[i], g.n[i + 1], g.n[i + 2]); g.col.push(Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2), 1); } return g; }
    function mergeC(list){ const out = { p: [], n: [], uv: [], col: [], idx: [] }; for (const g of list) { const o = out.p.length / 3; for (const v of g.p) out.p.push(v); for (const v of g.n) out.n.push(v); for (const v of g.uv) out.uv.push(v); if (g.col) for (const v of g.col) out.col.push(v); else for (let i=0;i<g.p.length/3;i++) out.col.push(1, 1, 1, 1); for (const i of g.idx) out.idx.push(i + o); } return out; }

    // ---------- the 3D meadow: trees, bushes, rocks, fence, grass and flowers (built once) ----------
    function buildScenery(){
      const Gm = E.G, M = E.M, T = (g, t, r, s) => Gm.transform(g, M.trs(t, r || [0, 0, 0], s || [1, 1, 1])), R = rnd(41);
      A.tLeaf = E.texture(leafTex()); A.tNeedle = E.texture(needleTex()); A.tBark = E.texture(barkTex()); A.tSoil = E.texture(soilTex());
      A.tTuft = [E.texture(cutout(tuftTex(5, false), [96, 150, 50])), E.texture(cutout(tuftTex(9, true), [96, 150, 50]))]; A.tRope = E.texture(ropeTex()); A.tRock2 = E.texture(rockTex2()); A.tLeather = E.texture(leatherTex()); A.tShroom = E.texture(mushroomTex());
      A.tCloud = [cloudTex(3), cloudTex(8), cloudTex(13)].map(c => E.texture(c, { repeat: false }));
      const trunks = [], crowns = [], needles = [], bushes = [], rocks = [];
      const LUMPS = Array.from({ length: 6 }, (_, i) => lumpy(Gm, i * 13.7 + 2, 0.55, 12, 9)), lump = () => LUMPS[Math.floor(R() * LUMPS.length)]; A.lumps = LUMPS;
      const oak = (x, z, s) => { const lean = (R() - .5) * 0.25, top = [x + lean * s, 1.7 * s, z];
        trunks.push(paint(tube([[x, -0.1, z], [x + lean * 0.3 * s, 0.8 * s, z], top], [0.2 * s, 0.15 * s, 0.11 * s], 9, 0.8), () => [1, 1, 1]));
        for (let b=0;b<3;b++) { const a = R() * Math.PI * 2, L = (0.6 + R() * 0.4) * s, st0 = [x + lean * 0.5 * s, (1.1 + b * 0.25) * s, z]; trunks.push(paint(tube([st0, [st0[0] + Math.cos(a) * L * 0.5, st0[1] + L * 0.45, z + Math.sin(a) * L * 0.4], [st0[0] + Math.cos(a) * L, st0[1] + L * 0.8, z + Math.sin(a) * L * 0.7]], [0.08 * s, 0.06 * s, 0.035 * s], 7, 0.8), () => [1, 1, 1])); }
        const tint = (R() - .5) * 0.08, n = 16 + Math.floor(R() * 7);
        for (let k=0;k<n;k++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()), c = [top[0] + Math.cos(a) * d * 0.95 * s, top[1] + 0.55 * s + (R() - 0.35) * 0.75 * s, z + Math.sin(a) * d * 0.7 * s], r = (0.3 + R() * 0.24) * s;
          crowns.push(paint(T(lump(), c, [R(), R(), R()], [r, r * 0.88, r]), (px, py, pz, nx, ny, nz) => { const up = (py - top[1] + 0.3 * s) / (1.6 * s), lit = Math.max(0, nx * -0.5 + ny * 0.62 + nz * 0.6); const k2 = Math.max(0, Math.min(1, up * 0.55 + lit * 0.5)); return mixc([0.4 + tint, 0.5, 0.32], [0.95 + tint, 0.98, 0.72], k2); })); } };
      const fir = (x, z, s) => { trunks.push(paint(tube([[x, -0.1, z], [x, 2.6 * s, z]], [0.13 * s, 0.05 * s], 8, 0.8), () => [1, 1, 1]));
        const layers = 6 + Math.floor(R() * 2);
        for (let k=0;k<layers;k++) { const t = k / layers, r = (1.05 - t * 0.85) * s, y = (0.55 + t * 2.4) * s;
          needles.push(paint(T(skirt(r, 0.75 * s * (1 - t * 0.35), 9 + Math.floor((1 - t) * 4), R() * 99), [x, y, z], [0, R() * 3, 0]), (px, py, pz, nx, ny, nz) => { const lit = Math.max(0, nx * -0.5 + ny * 0.5 + nz * 0.6); return mixc([0.4, 0.52, 0.42], [1, 1.08, 0.95], Math.min(1, 0.25 + lit * 0.6 + t * 0.2)); })); } };
      // the tree line behind the castle field, with a couple of big trees framing the slingshot
      for (let x = -9; x < 22; x += 1.1 + R() * 1.5) { const z = -7.5 - R() * 6.5, s = 0.8 + R() * 0.55; if (R() < 0.42) fir(x, z, s * 1.05); else oak(x, z, s * 1.05); }
      oak(-2.6, -3.6, 1.35); fir(-4.4, -5, 1.15); oak(10.5, -5.2, 1.15);
      // bushes and rocks scattered behind the action
      for (let x = -9; x < 22; x += 0.5 + R() * 1.1) { if (R() < 0.35) continue; const z = -1.4 - R() * 3.6, s = 0.22 + R() * 0.28, tint = (R() - .5) * 0.1;
        for (let k=0;k<3 + Math.floor(R() * 3);k++) { const c = [x + (R() - .5) * s * 2.2, s * (0.45 + R() * 0.5), z + (R() - .5) * s], r = s * (0.6 + R() * 0.5);
          bushes.push(paint(T(lump(), c, [R(), R(), R()], [r, r * 0.85, r]), (px, py, pz, nx, ny, nz) => mixc([0.3, 0.42 + tint, 0.24], [0.9, 0.98 + tint, 0.7], Math.max(0, Math.min(1, py / (s * 1.4) * 0.6 + Math.max(0, ny) * 0.45))))); } }
      for (let i=0;i<26;i++) { const x = -8 + R() * 29, z = -0.9 - R() * 5, s = 0.1 + R() * R() * 0.32;
        rocks.push(paint(T(lump(), [x, s * 0.25, z], [0, R() * 3, 0], [s * 1.3, s * 0.75, s]), (px, py, pz, nx, ny, nz) => ny > 0.55 ? mixc([0.7, 0.72, 0.62], [0.55, 0.75, 0.35], (ny - 0.55) * 2.2) : [0.78 + nx * 0.05, 0.75, 0.7])); }
      A.trunks = E.mesh(mergeC(trunks)); A.crowns = E.mesh(mergeC(crowns)); A.needles = E.mesh(mergeC(needles)); A.bushes = E.mesh(mergeC(bushes)); A.rocks = E.mesh(mergeC(rocks));
      // a little wooden fence behind the slingshot
      const fence = [];
      for (let x = -7; x <= 0.4; x += 0.85) { const h = 0.62 + R() * 0.08, tilt = (R() - .5) * 0.08; fence.push(T(Gm.roundBox(0.11, h, 0.11, 0.025, 2), [x, h / 2 - 0.04, -2.1], [0, 0, tilt])); fence.push(T(Gm.cylinder(0, 0.08, 0.08, 4), [x, h - 0.0, -2.1], [0, Math.PI / 4, 0])); }
      for (const y of [0.22, 0.46]) for (let x = -7; x < 0.4; x += 0.85) fence.push(T(Gm.roundBox(0.92, 0.07, 0.04, 0.015, 2), [x + 0.425, y + (R() - .5) * 0.03, -2.04], [0, 0, (R() - .5) * 0.05]));
      A.fence = E.mesh(Gm.merge(fence));
      // grass tufts as crossed cut-out cards; every vertex faces up so the lighting stays soft
      const tufts = [[], []];
      const tuft = (x, z, h, kind) => { const w = h * 1.1, rot = R() * Math.PI, tint = 0.85 + R() * 0.3;
        for (const a of [rot, rot + Math.PI / 2]) { const q = T(Gm.quad(w, h), [x, h / 2 - 0.01, z], [0, a, 0]); q.n = q.n.map((v, i) => i % 3 === 1 ? 1 : 0); paint(q, () => [tint, tint, tint * 0.95]); tufts[kind].push(q); } };
      for (let x = -9; x < 22; x += 0.05 + R() * 0.09) tuft(x, 1.25 + R() * 0.32, 0.1 + R() * 0.1, R() < 0.12 ? 1 : 0);
      for (let x = -9; x < 22; x += 0.08 + R() * 0.2) tuft(x, 0.3 + R() * 0.9, 0.07 + R() * 0.07, R() < 0.15 ? 1 : 0);
      for (let i=0;i<420;i++) tuft(-9 + R() * 31, -0.6 - R() * 8, 0.16 + R() * 0.2, R() < 0.25 ? 1 : 0);
      A.tufts = tufts.map(t => E.mesh(mergeC(t)));
      // toadstools near the slingshot
      const caps = [], stems = [];
      for (const [x, z, s] of [[-0.6, 1.0, 1], [-0.35, 1.25, 0.7], [2.5, 1.15, 0.8], [-1.6, -0.6, 1.3], [12.4, 0.9, 0.9]]) {
        stems.push(T(Gm.lathe([[0.035, 0], [0.03, 0.08], [0.028, 0.12]], 10), [x, 0, z], [0, 0, 0], [s, s, s]));
        caps.push(T(Gm.lathe([[0.012, 0.0], [0.085, 0.0], [0.09, 0.02], [0.07, 0.06], [0.03, 0.085], [0, 0.09]], 14), [x, 0.11 * s, z], [0, 0, 0], [s, s, s])); }
      A.shroomCaps = E.mesh(Gm.merge(caps)); A.shroomStems = E.mesh(Gm.merge(stems));
      // the ground: a gently mottled meadow
      const gw = 32, gd = 16, nx = 64, nz = 32, gP = [], gN = [], gU = [], gI = [], gC = [];
      for (let j=0;j<=nz;j++) for (let i=0;i<=nx;i++) { const x = -10 + i / nx * gw, z = 1.5 - j / nz * gd; gP.push(x, 0, z); gN.push(0, 1, 0); gU.push(x * 0.5, z * 0.5);
        const n = NZ.fbm(x * 0.35, z * 0.5, 4), p = NZ.fbm(x * 0.12 + 5, z * 0.2, 3); let c = mixc([0.78, 0.86, 0.66], [1.08, 1.1, 0.9], n); if (p > 0.6) c = mixc(c, [1.15, 1.06, 0.72], (p - 0.6) * 2); gC.push(...c.map(v => Math.pow(v, 2.2)), 1); }
      for (let j=0;j<nz;j++) for (let i=0;i<nx;i++) { const a = j * (nx + 1) + i, b = a + nx + 1; gI.push(a, a + 1, b, a + 1, b + 1, b); }
      A.ground = E.mesh({ p: gP, n: gN, uv: gU, col: gC, idx: gI });
    }

    // ---------- goblins: little full-body troublemakers that tease you between shots ----------
    const TAUNT_LINES = ['Nyah nyah!', 'Missed me!', "Can't hit me!", 'Too slow!', 'Hee hee hee!', 'Is that all?', 'Wobbly aim!', 'Over here!', 'Try again!', 'La la la!'];
    const TAUNT_KINDS = ['ears', 'wiggle', 'laugh', 'dance'];
    function buildGoblinAssets(){
      const Gm = E.G;
      A.tGobSkin = E.texture(goblinSkinTex()); A.tTunic = E.texture(tunicTex());
      A.gTorso = E.mesh(Gm.lathe([[0.0, -0.31], [0.2, -0.31], [0.25, -0.27], [0.24, -0.19], [0.215, -0.1], [0.2, -0.02], [0.15, 0.04], [0.07, 0.07], [0, 0.075]], 20));
      A.gDome = E.mesh(Gm.lathe([[0.335, 0], [0.33, 0.05], [0.3, 0.13], [0.24, 0.2], [0.14, 0.25], [0, 0.27]], 22));
      A.gRim = E.mesh(Gm.torus(1, 0.09, 28, 8));
      A.gEar = E.mesh(Gm.cylinder(0, 0.5, 1, 10, true));
    }
    function goblinPose(b, d){
      const t = st.time + b.id * 1.37;
      if (d.fly) return { kind: 'fly', k: d.fly.t };
      if (d.hitT > 0 || (st.panicT > 0 && st.phase !== 'menu')) return { kind: 'panic', k: t };
      if (d.taunt) return { kind: d.taunt.kind, k: d.taunt.t };
      const per = 6.5 + (b.id % 3) * 0.8, ph = t % per;
      if (ph < 2.6) return { kind: TAUNT_KINDS[(b.id + Math.floor(t / per)) % 4], k: ph };
      return { kind: 'idle', k: t };
    }
    function drawGoblin(b, fly){
      const M = E.M, d = fly ? { w: 34, hitT: 0, fly } : b.data, s = (d.w || 34) * S, pose = goblinPose(b, d), K = pose.kind, k = pose.k, tt = st.time;
      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x), inOut = (a, len) => ease(k / a) * (1 - ease((k - (len - a)) / a));
      // whole-body motion for this pose
      let hop = 0, lean = 0, yaw = -0.42, sway = 0, headTilt = Math.sin(tt * 1.3 + b.id) * 0.06, headYaw = 0, armL = [0.28, 0, 0.35], armR = [0.28, 0, 0.35], legL = 0, legR = 0, mouth = 'grin', eyes = 'open', look = -0.022, earFlap = Math.sin(tt * 2 + b.id) * 0.06;
      armL[0] += Math.sin(tt * 1.6 + b.id) * 0.08; armR[0] += Math.sin(tt * 1.6 + b.id + 2) * 0.08;
      if (K === 'idle') { const bl = (tt * 0.7 + b.id * 0.31) % 3.3; if (bl < 0.12) eyes = 'closed'; if (st.pull) look = -0.03; }
      else if (K === 'ears') { const e = inOut(0.25, 2.6); armL = [0.28 + e * 2.05 + Math.sin(tt * 22) * 0.12 * e, -0.2 * e, 0.35 + e * 1.35]; armR = [0.28 + e * 2.05 + Math.sin(tt * 22 + 1) * 0.12 * e, -0.2 * e, 0.35 + e * 1.35]; headTilt = Math.sin(tt * 9) * 0.22 * e; mouth = e > 0.4 ? 'tongue' : 'grin'; eyes = e > 0.4 ? 'squint' : 'open'; earFlap = Math.sin(tt * 18) * 0.25 * e; }
      else if (K === 'wiggle') { const e = inOut(0.35, 2.6); yaw = -0.42 + e * (Math.PI + 0.84); sway = Math.sin(tt * 13) * 0.24 * e; armR = [0.5 + e * 0.3, 0.6 * e, 0.6 + e * 0.9 + Math.sin(tt * 13) * 0.4 * e]; armL = [0.5, 0.3 * e, 0.4]; headYaw = -1.1 * e; mouth = 'open'; eyes = 'squint'; hop = Math.abs(Math.sin(tt * 13)) * 0.03 * e; }
      else if (K === 'laugh') { const e = inOut(0.2, 2.6); lean = -0.16 * e + Math.sin(tt * 26) * 0.04 * e; hop = Math.abs(Math.sin(tt * 13)) * 0.05 * e; armL = [0.28 + e * 1.3, -0.25 * e, 0.35 - 0.35 * e]; armR = [0.28 + e * 0.05, -0.9 * e, 0.35 + e * 1.5]; mouth = e > 0.3 ? 'open' : 'grin'; eyes = e > 0.3 ? 'squint' : 'open'; headTilt = -0.12 * e; }
      else if (K === 'dance') { const e = inOut(0.2, 2.6), beat = Math.sin(tt * 9); hop = Math.abs(beat) * 0.16 * e; armL = [0.28 + e * (2.3 + beat * 0.45), 0, 0.35 + e * 0.1]; armR = [0.28 + e * (2.3 - beat * 0.45), 0, 0.35 + e * 0.1]; legL = Math.max(0, beat) * 0.08 * e; legR = Math.max(0, -beat) * 0.08 * e; sway = beat * 0.12 * e; mouth = 'open'; headTilt = beat * 0.15 * e; }
      else if (K === 'panic') { const f = Math.sin(tt * 30 + b.id); armL = [2.5 + f * 0.5, -0.2, 0.3]; armR = [2.5 - f * 0.5, -0.2, 0.3]; hop = Math.abs(Math.sin(tt * 20 + b.id)) * 0.06; sway = f * 0.06; mouth = 'o'; eyes = 'wide'; earFlap = f * 0.3; look = -0.03; legL = Math.max(0, f) * 0.05; legR = Math.max(0, -f) * 0.05; }
      else if (K === 'fly') { const f = Math.sin(tt * 24 + b.id); armL = [2.2 + f * 0.6, 0.4, 0.2]; armR = [2.2 - f * 0.6, -0.4, 0.2]; legL = 0.1 + f * 0.05; legR = 0.1 - f * 0.05; mouth = 'o'; eyes = 'dizzy'; earFlap = f * 0.4; }
      const pos = fly ? P3(fly.x, fly.y) : P3(b.x - Math.sin(b.a) * ((d.h || 34) - (d.w || 34)) / 2, b.y + Math.cos(b.a) * ((d.h || 34) - (d.w || 34)) / 2);
      const m = M.trs([pos[0], pos[1] + hop * s, pos[2] + (fly ? 0.25 : 0)], [0, yaw, -(fly ? fly.a : b.a) + lean + sway], [1, 1 + (K === 'idle' ? Math.sin(tt * 3 + b.id) * 0.025 : 0), 1]);
      const D = (mesh, par, l, r, sc, mat) => E.draw(mesh, M.mul(par, M.trs([l[0] * s, l[1] * s, l[2] * s], r || [0, 0, 0], sc.map ? sc.map(v => v * s) : sc * s)), mat);
      const skin = { tex: A.tGobSkin, color: [1, 1, 1], spec: 0.35, shine: 26, rim: 0.35 }, skinD = { color: [0.42, 0.62, 0.2], spec: 0.3, shine: 20, rim: 0.3 }, cloth = { tex: A.tTunic, color: [1, 1, 1], spec: 0.15, shine: 14 };
      const metal = { color: [0.52, 0.56, 0.64], spec: 1.5, shine: 90, rim: 0.3 }, dark = { color: [0.12, 0.06, 0.04], spec: 0.2 }, boot = { color: [0.3, 0.17, 0.09], spec: 0.5, shine: 30 };
      // legs and boots
      for (const [sd, lift] of [[-1, legL], [1, legR]]) { D(A.cyl, m, [sd * 0.095, -0.37 + lift * 0.5, 0], [0, 0, sd * 0.05], [0.1, 0.17, 0.1], { color: [0.34, 0.24, 0.16], spec: 0.15 }); D(A.sphere, m, [sd * 0.1, -0.465 + lift, 0.035], [0, sd * 0.3, 0], [0.085, 0.06, 0.12], boot); }
      // tunic, belt and buckle
      const torso = M.mul(m, M.trs([0, -0.02 * s, 0], [0, 0, 0], [s, s, s]));
      E.draw(A.gTorso, torso, cloth); E.draw(A.gTorso, torso, INK);
      D(A.gRim, m, [0, -0.19, 0], [0, 0, 0], [0.245, 0.4, 0.245], { color: [0.2, 0.11, 0.06], spec: 0.4 });
      D(A.box, m, [0, -0.19, 0.24], [0, 0, 0], [0.09, 0.07, 0.03], { color: [1, 0.8, 0.3], spec: 1.6, shine: 90 });
      // arms: shoulder swing (out), forward swing, elbow bend
      const arm = (sd, a) => { const sh = M.mul(m, M.trs([sd * 0.19 * s, -0.02 * s, 0], [a[1], 0, sd * a[0]]));
        D(A.sphere, sh, [0, 0, 0], null, 0.06, cloth);
        D(A.cyl, sh, [0, -0.08, 0], null, [0.09, 0.17, 0.09], skin);
        const el = M.mul(sh, M.trs([0, -0.165 * s, 0], [0, 0, -sd * a[2]]));
        D(A.sphere, el, [0, 0, 0], null, 0.047, skin);
        D(A.cyl, el, [0, -0.07, 0], null, [0.08, 0.14, 0.08], skin);
        D(A.sphere, el, [0, -0.16, 0.005], null, [0.062, 0.058, 0.05], skinD);
        D(A.sphere, el, [-sd * 0.035, -0.14, 0.03], null, [0.025, 0.035, 0.025], skinD); };
      arm(-1, armL); arm(1, armR);
      // the head
      const hm = M.mul(m, M.trs([0, 0.24 * s, 0], [0, headYaw, headTilt]));
      D(A.sphere, hm, [0, 0, 0], [0, 0.35, 0], [0.3, 0.27, 0.28], skin); D(A.sphere, hm, [0, 0, 0], [0, 0.35, 0], [0.3, 0.27, 0.28], INK);
      for (const sd of [-1, 1]) { const er = [0, 0, -sd * (1.25 + earFlap * sd)];
        D(A.gEar, hm, [sd * 0.34, 0.05, -0.02], er, [0.13, 0.34, 0.06], skin); D(A.gEar, hm, [sd * 0.34, 0.05, 0.005], er, [0.08, 0.26, 0.03], { color: [0.95, 0.55, 0.5], spec: 0.2 }); D(A.gEar, hm, [sd * 0.34, 0.05, -0.02], er, [0.13, 0.34, 0.06], INK); }
      // eyes: whites, pupils that look at you, and a sparkle; lids for blinking and squinting
      const eyeY = eyes === 'closed' || eyes === 'dizzy' ? 0.15 : eyes === 'squint' ? 0.4 : eyes === 'wide' ? 1.2 : 1;
      for (const sd of [-1, 1]) { const ex = sd * 0.105;
        D(A.sphere, hm, [ex, 0.04, 0.222], null, [0.1, 0.105 * eyeY, 0.07], { color: [1, 1, 0.96], spec: 0.8, shine: 60 }); D(A.sphere, hm, [ex, 0.04, 0.222], null, [0.1, 0.105 * eyeY, 0.07], INK);
        if (eyes === 'dizzy') { for (const r of [0.7, -0.7]) D(A.box, hm, [ex, 0.045, 0.29], [0, 0, r], [0.1, 0.02, 0.01], dark); }
        else if (eyeY > 0.3) { D(A.sphere, hm, [ex + look, 0.035, 0.275], null, [0.052, 0.056 * Math.min(1, eyeY), 0.03], { color: [0.08, 0.05, 0.03], spec: 1.2, shine: 90 }); D(A.sphere, hm, [ex + look + 0.018, 0.056, 0.3], null, 0.015, { color: [1, 1, 1], unlit: true }); }
        else D(A.box, hm, [ex, 0.045, 0.285], [0, 0, sd * 0.15], [0.1, 0.018, 0.01], dark);
        D(A.box, hm, [ex * 1.05, 0.118 + (eyes === 'wide' ? 0.02 : 0), 0.262], [0, 0, sd * (K === 'panic' ? -0.3 : 0.38)], [0.1, 0.024, 0.03], { color: [0.2, 0.32, 0.08] }); }
      // big pointy nose
      D(A.sphere, hm, [-0.02, -0.03, 0.29], [0, -0.3, 0], [0.062, 0.055, 0.1], { color: [0.48, 0.7, 0.22], spec: 0.5, shine: 40, rim: 0.3 });
      // mouth: cheeky grin, open laugh, scared "o" or a stuck-out tongue
      const mo = mouth === 'open' ? 1.6 + Math.abs(Math.sin(tt * 26)) * 0.5 : mouth === 'o' ? 1.4 : mouth === 'tongue' ? 1.1 : 0.7, mw = mouth === 'o' ? 0.06 : 0.125;
      D(A.sphere, hm, [0, -0.125, 0.225], null, [mw, 0.045 * mo, 0.05], { color: [0.36, 0.06, 0.06], spec: 0.3 });
      if (mouth !== 'o') for (const sd of [-1, 1]) D(A.cone, hm, [sd * 0.055, -0.1, 0.262], [Math.PI, 0, 0], [0.03, 0.045, 0.03], { color: [1, 0.98, 0.9], spec: 0.6 });
      if (mouth === 'tongue') D(A.sphere, hm, [0, -0.17 - Math.abs(Math.sin(tt * 9)) * 0.02, 0.27], [0.5, 0, 0], [0.055, 0.04, 0.075], { color: [1, 0.45, 0.55], spec: 0.8, shine: 50 });
      if (mouth === 'open') D(A.sphere, hm, [0, -0.16, 0.245], null, [0.06, 0.025, 0.035], { color: [1, 0.45, 0.55], spec: 0.5 });
      // dented steel helmet with a red spike (the thing you need to knock off)
      if (fly) return;
      const helm = M.mul(hm, M.trs([0, 0.135 * s, -0.01 * s], [-0.12, 0, 0], [0.93 * s, 0.9 * s, 0.93 * s]));
      E.draw(A.gDome, helm, metal); E.draw(A.gDome, helm, INK);
      D(A.gRim, hm, [0, 0.135, -0.01], [-0.12, 0, 0], [0.32, 0.5, 0.31], { color: [0.5, 0.53, 0.6], spec: 1.2, shine: 70 });
      D(A.box, hm, [0, 0.31, -0.03], [-0.12, 0, 0], [0.04, 0.1, 0.44], { color: [0.55, 0.58, 0.66], spec: 1.2, shine: 70 });
      D(A.cone, hm, [0, 0.43, -0.04], [-0.12, 0, 0], [0.09, 0.17, 0.09], { color: [0.9, 0.24, 0.2], spec: 0.7, shine: 50 });
      if (K === 'panic' && !reduceMotion) { const dp = (tt * 1.6 + b.id * 0.3) % 1; E.sprite(M.xform(hm, [0.3 * s, (0.12 - dp * 0.25) * s, 0.15 * s]), 0.05, [0.6, 0.85, 1], 1 - dp, false); }
    }
    // a goblin knocked out of the castle tumbles away instead of just vanishing
    function launchGoblin(b){ if (reduceMotion) return; st.flyGobs.push({ x: b.x, y: b.y, vx: 120 + Math.random() * 160, vy: -380 - Math.random() * 140, a: b.a, va: (Math.random() < .5 ? -1 : 1) * (8 + Math.random() * 6), t: 0, id: b.id }); }
    function updateGoblins(dt){
      for (const f of st.flyGobs) { f.t += dt; f.vy += G * 0.9 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt; }
      st.flyGobs = st.flyGobs.filter(f => f.t < 3 && f.y < GROUND + 600);
      for (const b of st.blocks) { const d = b.data; if (d.mat !== 'goblin' || d.off) continue; if (d.taunt) { d.taunt.t += dt; if (d.taunt.t > 2.8) d.taunt = null; } }
      // a goblin cheers when a shot misses everyone
      if (st.watch && !st.shots.length && !st.over) { const missed = (st.gobs || 0) === st.watch.gobs; st.watch = null; if (missed) taunt(true); }
      if (st.phase === 'play' && !st.hello && st.time > 1.4) { st.hello = true; taunt(false, 'Come and get us!'); }
    }
    function taunt(sound, text){
      const alive = st.blocks.filter(b => b.data.mat === 'goblin' && !b.data.off); if (!alive.length) return;
      const b = alive[Math.floor(Math.random() * alive.length)]; b.data.taunt = { kind: TAUNT_KINDS[Math.floor(Math.random() * 4)], t: 0 };
      pop([b.x, b.y - 58], text || TAUNT_LINES[Math.floor(Math.random() * TAUNT_LINES.length)], '#ffffff', 1.5);
      if (sound && PB.sfx) PB.sfx(Math.random() < 0.5 ? 'giggle' : 'nyah');
    }

    // ---------- the slingshot: a forked branch bound with rope, set in a pile of stones ----------
    const SL_TIPL = [SLX - 30, GROUND - 158, -12], SL_TIPR = [SLX + 27, GROUND - 155, 12], SL_FORK = GROUND - 96;
    function buildSlingAssets(){
      const Gm = E.G, M = E.M, T = (g, t, r, s) => Gm.transform(g, M.trs(t, r || [0, 0, 0], s || [1, 1, 1])), w = (x, y, z) => P3(x, y, z || 0);
      const curve = (a, b, c, n) => { const out = []; for (let i=0;i<=n;i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], u * u * a[2] + 2 * u * t * b[2] + t * t * c[2]]); } return out; };
      const trunk = curve(w(SLX + 4, GROUND + 6), w(SLX - 6, GROUND - 50), w(SLX, SL_FORK + 6), 8);
      const armL = curve(w(SLX, SL_FORK + 6), w(SLX - 6, SL_FORK - 28, -6), w(SL_TIPL[0], SL_TIPL[1], SL_TIPL[2]), 8);
      const armR = curve(w(SLX, SL_FORK + 6), w(SLX + 8, SL_FORK - 26, 6), w(SL_TIPR[0], SL_TIPR[1], SL_TIPR[2]), 8);
      const rads = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => (a + (b - a) * i / n) * S);
      A.slWood = E.mesh(Gm.merge([tube(trunk, rads(19, 15, 8), 14, 3), tube(armL, rads(14, 9.5, 8), 12, 3), tube(armR, rads(14, 9.5, 8), 12, 3),
        T(lumpy(Gm, 3, 0.4, 10, 8), w(SLX + 1, SL_FORK + 2), [0, 0, 0], [0.17, 0.15, 0.15]),
        tube([w(SLX - 10, GROUND - 60, 6), w(SLX - 22, GROUND - 76, 14), w(SLX - 27, GROUND - 80, 16)], [0.045, 0.03, 0.015], 6, 3)]));
      // rope bindings near the fork and the tips
      const ring = (p, r, tilt) => T(Gm.torus(1, 0.22, 16, 6), p, [0, 0, tilt], [r, r * 1.3, r]);
      const rings = [];
      for (let k=0;k<3;k++) rings.push(ring(w(SLX, SL_FORK + 18 - k * 7), 0.175, 0.05));
      for (const [tip, sd] of [[SL_TIPL, -1], [SL_TIPR, 1]]) for (let k=0;k<3;k++) { const p = w(tip[0] - sd * (3 + k * 1.5), tip[1] + 10 + k * 6, tip[2]); rings.push(ring(p, 0.105, sd * 0.25)); }
      A.slRope = E.mesh(Gm.merge(rings));
      // stones piled around the foot of the slingshot
      const R = rnd(55), stones = [];
      for (let i=0;i<9;i++) { const a = i / 9 * Math.PI * 2 + R() * 0.4, d = 0.24 + R() * 0.12, r = 0.07 + R() * 0.07; stones.push(paint(T(lumpy(Gm, R() * 40, 0.5, 10, 8), [SLX * S + Math.cos(a) * d, r * 0.4, Math.sin(a) * d * 0.8], [0, R() * 3, 0], [r * 1.3, r * 0.8, r]), (x, y, z, nx, ny) => ny > 0.6 ? [0.72, 0.8, 0.6] : [0.82, 0.8, 0.76])); }
      stones.push(paint(T(lumpy(Gm, 9, 0.3, 12, 8), [SLX * S, 0.0, 0], [0, 0, 0], [0.32, 0.09, 0.26]), () => [0.5, 0.38, 0.26]));
      A.slStones = E.mesh(mergeC(stones));
    }
    function drawSling(){
      const M = E.M, skin = PB.meta && PB.meta.look('castle', 'sling'), I = M.trs([0, 0, 0]);
      if (skin === 'sling_candy' && !A.tCandy) { const c = cv(64, 256), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#ff4f8b'; for (let y=-64;y<256;y+=32) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 32); g.lineTo(64, y + 48); g.lineTo(0, y + 16); g.closePath(); g.fill(); } A.tCandy = E.texture(c); }
      const wood = skin === 'sling_gold' ? { color: [1, 0.78, 0.2], emissive: [0.2, 0.13, 0.02], spec: 1.6, shine: 90, rim: 0.4 } : skin === 'sling_candy' ? { tex: A.tCandy, color: [1, 1, 1], spec: 0.8, shine: 60, uvScale: [1, 0.5] } : { tex: A.tBark, color: [0.95, 0.85, 0.75], spec: 0.2, shine: 18, uvScale: [1, 0.5], rim: 0.25 };
      E.draw(A.slStones, I, { tex: A.tRock2, color: [1.1, 1.06, 1.02], spec: 0.2 });
      E.draw(A.slWood, I, wood); E.draw(A.slWood, I, INK);
      E.draw(A.slRope, I, { tex: A.tRope, color: [1, 1, 1], spec: 0.25, uvScale: [6, 1] });
      // rubber bands, the leather pouch and the loaded ball
      const pull = st.pull || { dx: 0, dy: 0 }, bandK = st.pull ? 0 : st.band, pouch = [REST.x + pull.dx + bandK * 8, REST.y + pull.dy - bandK * 6, 0];
      const L0 = Math.hypot(pull.dx, pull.dy);
      const band = (tip, z) => { const a = P3(tip[0], tip[1] + 6, z), b = P3(pouch[0], pouch[1], z * 0.3), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ang = Math.atan2(dx, dy);
        const th = (7 - Math.min(3.5, L0 / 30)) * S, rub = { color: [0.32, 0.1, 0.07], spec: 0.45, shine: 40 };
        for (const off of [-0.55, 0.55]) E.draw(A.cyl, M.trs([mid[0] + off * th * Math.cos(ang), mid[1] - off * th * Math.sin(ang), mid[2]], [0, 0, -ang], [th * 1.1, L, th * 1.1]), rub); };
      band(SL_TIPL, -12);
      const showBall = st.loaded && st.inv[st.sel] > 0 && !st.over;
      const pa = Math.atan2(pouch[1] - REST.y + 0.001, pouch[0] - REST.x - 0.001);
      E.draw(A.sphere, M.trs(P3(pouch[0] - 3, pouch[1], -3), [0, 0, -pa], [0.075, 0.17, 0.15]), { tex: A.tLeather, color: [1, 1, 1], spec: 0.5, shine: 30 });
      if (showBall) {
        const type = st.sel, r = AMMO[type].r; let bp = P3(pouch[0], pouch[1] - 2, 0), sc = 1;
        if (st.loadAnim && st.loadAnim.type === type) { const kk = Math.min(1, st.loadAnim.t), e = 1 - Math.pow(1 - kk, 2), from = [SLX - 70, GROUND - r]; bp = P3(from[0] + (pouch[0] - from[0]) * e, from[1] + (pouch[1] - 2 - from[1]) * e - Math.sin(kk * Math.PI) * 90, 0); sc = 0.8 + 0.2 * e; }
        drawBall(bp, type, r * S * sc, st.pull ? 0 : (st.loadAnim ? st.loadAnim.t * 10 : 0));
        if (!st.pull && !st.loadAnim) E.sprite(bp, r * S * 6, [1, 0.85, 0.35], 0.18 + 0.08 * Math.sin(st.time * 5), true);
      }
      band(SL_TIPR, 12);
      // the rest of the ammo waiting in line beside the sling
      let x = SLX - 64; const queue = []; for (const kk of AMMO_ORDER) for (let i=0;i<(st.inv[kk] || 0) - (kk === st.sel && showBall ? 1 : 0);i++) queue.push(kk);
      for (let i=0;i<Math.min(6, queue.length);i++) { const r = AMMO[queue[i]].r, bob = Math.abs(Math.sin(st.time * 3 + i)) * 4; drawBall(P3(x - r, GROUND - r - bob, 8), queue[i], r * S, 0); x -= r * 2 + 6; }
    }

    // The big paintings take a few seconds to make, so they are painted on background threads when the
    // device allows it (the game shows simple hills meanwhile), or on the main thread a moment later.
    function paintBackdrops(){
      if (A.painting) return; A.painting = true;
      let done = 0; const apply = (which, img) => { if (!A) return; E.updateTexture(which === 'mount' ? A.tMount : A.tHills, img); if (img.close) img.close();
        // repaint the game tile on the hub once the scenery is ready
        if (++done === 2) { const hub = document.getElementById('hub'); if (hub && !hub.hidden && A.tiles && !(st && st.phase === 'play')) for (const g of A.tiles) artTile(g); } };
      const shrink = c0 => { const c = cv(c0.width * 0.75, c0.height * 0.75), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c0, 0, 0, c.width, c.height); return c; };
      const fallback = () => { let i = 0; const next = () => { if (!A) return; if (i === 0) apply('mount', shrink(mountainsTex())); else if (i === 1) apply('hills', shrink(hillsTex())); i++; if (i < 2) setTimeout(next, 30); }; setTimeout(next, 60); };
      try {
        if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') throw 0;
        const src = 'const mulberry = ' + PB.mulberry.toString() + ';\nfunction rnd(s){ return mulberry(s); }\nfunction cv(w, h){ return new OffscreenCanvas(w, h); }\nconst NZ = (' + makeNZ.toString() + ')();\nconst mixc = ' + mixc.toString() + ';\nconst sstep = ' + sstep.toString() + ';\n'
          + [pixels, range, firBelt, farCastle, mountainsTex, hillsTex].map(f => f.toString()).join('\n')
          + '\nonmessage = e => { try { const c0 = e.data === "mount" ? mountainsTex() : hillsTex(), c = new OffscreenCanvas(c0.width * 0.75, c0.height * 0.75), g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(c0, 0, 0, c.width, c.height); const b = c.transferToImageBitmap(); postMessage({ which: e.data, b }, [b]); } catch (err) { postMessage({ which: e.data, err: String(err) }); } };';
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        let failed = false;
        for (const which of ['mount', 'hills']) { const wk = new Worker(url);
          wk.onmessage = e => { wk.terminate(); if (e.data.err) { if (!failed) { failed = true; fallback(); } return; } apply(which, e.data.b); };
          wk.onerror = () => { wk.terminate(); if (!failed) { failed = true; fallback(); } };
          wk.postMessage(which); }
      } catch (e) { fallback(); }
    }
    function placeholderHills(){ const c = cv(512, 96), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 20, 0, 96); gr.addColorStop(0, '#9cc77e'); gr.addColorStop(1, '#5f9a48'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 96); for (let x=0;x<=512;x+=8) g.lineTo(x, 34 + Math.sin(x / 60) * 10 + Math.sin(x / 23) * 4); g.lineTo(512, 96); g.fill(); return c; }
    function loadAssets(){
      if (A) return A;
      E = PB.gl3d.get(); if (!E) return null;
      const Gm = E.G, M = E.M, T = (g, t, r, s) => Gm.transform(g, M.trs(t, r || [0,0,0], s || [1,1,1]));
      A = {};
      A.tStone = {}; for (const k of Object.keys(MAT)) if (k !== 'goblin') A.tStone[k] = E.texture(stoneTex(MAT[k], k.length * 7));
      A.tGoblin = E.texture(goblinTex()); A.tFace = { stone: E.texture(faceTex('#a7a39d', '#3a2a20', 1)), triple: E.texture(faceTex('#d9a86a', '#5a3010', 2)), iron: E.texture(faceTex('#4a4e58', '#111', 3)), fire: E.texture(faceTex('#ff6a2a', '#5a1000', 4)), boulder: E.texture(faceTex('#9a8f80', '#3a2a20', 5)) };
      A.tCrack = [crackTex(31, 5), crackTex(57, 11)];
      A.tPlank = E.texture(plankTex()); A.tGrass = E.texture(grassTex()); A.tDirt = E.texture(soilTex()); A.tRock = E.texture(rockTex());
      A.tMount = E.texture(cv(4, 4), { repeat: false }); A.tHills = E.texture(placeholderHills(), { repeat: false });
      A.tCloth = E.texture(clothTex('#8e1f1a', '#e0b43c'));
      A.box = E.mesh(Gm.roundBox(1, 1, 1, 0.1, 3)); A.flat = E.mesh(Gm.box(1, 1, 1)); A.sphere = E.mesh(Gm.sphere(1, 24, 16)); A.cyl = E.mesh(Gm.cylinder(0.5, 0.5, 1, 20)); A.cone = E.mesh(Gm.cylinder(0, 0.5, 1, 20, true));
      A.log = E.mesh(Gm.cylinder(0.5, 0.42, 1, 14)); A.quad = E.mesh(Gm.quad(1, 1)); A.ring = E.mesh(Gm.torus(1, 0.08, 40, 6));
      A.flag = E.mesh(Gm.extrude([[0, 0], [1, -0.32], [0, -0.64]], 0.02)); A.chunk = E.mesh(Gm.roundBox(1, 1, 1, 0.2, 2));
      buildScenery(); buildGoblinAssets(); buildSlingAssets(); paintBackdrops();
      return A;
    }

    // ---------- camera ----------
    const FOV = 0.55, ASPECT = W / H;
    function camTarget(){
      if (st.camLock) return st.camLock;
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
    // the rocky hills some castles stand on: a craggy core with boulders on its face, moss and a grassy lip
    function outcrop(sp){
      const key = [sp.x, sp.y, sp.w, sp.h].join(','); A.crops = A.crops || {}; if (A.crops[key]) return A.crops[key];
      const Gm = E.G, M = E.M, T = (g, t, r, sc) => Gm.transform(g, M.trs(t, r || [0, 0, 0], sc || [1, 1, 1])), R = rnd(Math.round(sp.x * 7 + sp.h * 13));
      const w = sp.w * S, h = sp.h * S, cx = sp.x * S, cy = (GROUND - sp.y) * S, top = cy + h / 2, parts = [], moss = (ny, base) => ny > 0.55 ? mixc(base, [0.5, 0.7, 0.32], Math.min(1, (ny - 0.55) * 2.5)) : base;
      parts.push(paint(T(Gm.roundBox(w, h, 1.0, 0.08, 3), [cx, cy, -0.02]), (x, y, z, nx, ny) => moss(ny, [0.95, 0.92, 0.88])));
      const n = Math.round(w * 7 + h * 5);
      for (let i=0;i<n;i++) { const r = 0.05 + R() * 0.11, bx = cx + (R() - .5) * (w - r), by = cy - h / 2 + r * 0.3 + R() * (h - r * 1.4); if (by + r * 0.7 > top - 0.04) continue; const tone = 0.8 + R() * 0.25;
        parts.push(paint(T(A.lumps[Math.floor(R() * A.lumps.length)], [bx, by, 0.47 + R() * 0.06], [R() * 3, R() * 3, R() * 3], [r * 1.25, r * 0.85, r * 0.7]), (x, y, z, nx, ny) => moss(ny, [tone, tone * 0.96, tone * 0.9]))); }
      for (const sd of [-1, 1]) for (let i=0;i<3;i++) { const r = 0.08 + R() * 0.1, by = cy - h / 2 + r * 0.4 + R() * h * 0.6; if (by + r > top - 0.04) continue; parts.push(paint(T(A.lumps[i % A.lumps.length], [cx + sd * (w / 2 + r * 0.2), by, (R() - .5) * 0.7], [R() * 3, R() * 3, 0], [r, r * 0.9, r]), (x, y, z, nx, ny) => moss(ny, [0.88, 0.85, 0.8]))); }
      const g = mergeC(parts); for (let i=0, j=0;i<g.p.length;i+=3, j+=2) { g.uv[j] = (g.p[i] + g.p[i + 2] * 0.6) * 1.4; g.uv[j + 1] = -g.p[i + 1] * 1.4; }
      const tq = []; for (let x = cx - w / 2 + 0.03; x < cx + w / 2 - 0.03; x += 0.06 + R() * 0.07) { const th = 0.07 + R() * 0.07, rot = R() * Math.PI; for (const a of [rot, rot + Math.PI / 2]) { const q = T(Gm.quad(th * 1.1, th), [x, top + th / 2 - 0.01, 0.42 + R() * 0.08], [0, a, 0]); q.n = q.n.map((v, k) => k % 3 === 1 ? 1 : 0); tq.push(paint(q, () => [1, 1, 1])); } }
      return (A.crops[key] = { rock: E.mesh(g), tufts: E.mesh(mergeC(tq)) });
    }
    function scenery(M){
      const cx = st.cam.x;
      // far mountains, then farmland, then the sun and drifting clouds
      E.draw(A.quad, M.trs([cx * S * 0.72 + 4.5, 8.68, -30], [0, 0, 0], [41, 10.24, 1]), { tex: A.tMount, raw: true, recv: 0, color: [1, 1, 1], blend: true, noShadow: true });
      E.draw(A.quad, M.trs([cx * S * 0.45 + 4.5, 2.49, -16], [0, 0, 0], [37.2, 6.98, 1]), { tex: A.tHills, raw: true, recv: 0, color: [1, 1, 1], blend: true, noShadow: true });
      E.sprite([cx * S * 0.85 + 8, 15.5, -28], 9, [1, 0.88, 0.62], 0.35, true); E.sprite([cx * S * 0.85 + 8, 15.5, -28], 3, [1, 0.97, 0.88], 0.9, true);
      for (let k=0;k<7;k++) { const x = ((k * 4.6 + st.time * (0.05 + (k % 3) * 0.025)) % 34) - 9 + cx * S * 0.6, y = 10.5 + (k % 3) * 1.6 + (k % 2) * 0.7, sc = 4.2 + (k % 3) * 1.6;
        E.draw(A.quad, M.trs([x, y, -24 - (k % 2) * 3], [0, 0, 0], [sc, sc * 0.5, 1]), { tex: A.tCloud[k % 3], raw: true, recv: 0, color: [1, 1, 1], blend: true, noShadow: true }); }
      for (let k=0;k<5;k++) { const t = (st.time * 40 + k * 60) % 2400 - 800, bx = t + (k % 2) * 30, by = GROUND - 520 - k * 16 + Math.sin(st.time + k) * 8, flap = Math.sin(st.time * 9 + k) * 0.5; for (const sd of [-1, 1]) E.draw(A.flat, M.trs(P3(bx + sd * 8, by, -300), [0, 0, sd * (0.35 + flap)], [0.18, 0.02, 0.05]), { color: [0.15, 0.13, 0.16], noShadow: true, unlit: true }); }
      const I = M.trs([0, 0, 0]), sway = Math.sin(st.time * 0.9) * 0.01;
      E.draw(A.trunks, I, { tex: A.tBark, color: [1, 1, 1], spec: 0.05, uvScale: [1, 1] });
      E.draw(A.crowns, M.trs([sway, 0, 0]), { tex: A.tLeaf, color: [0.82, 0.88, 0.72], spec: 0.1, shine: 16 });
      E.draw(A.needles, I, { tex: A.tNeedle, color: [0.82, 0.95, 0.86], spec: 0.08 });
      E.draw(A.bushes, I, { tex: A.tLeaf, color: [0.78, 0.86, 0.68], spec: 0.1, uvScale: [2, 2] });
      E.draw(A.rocks, I, { tex: A.tRock2, color: [1.05, 1.02, 1], spec: 0.15, shine: 20 });
      E.draw(A.fence, I, { tex: A.tPlank, color: [0.85, 0.66, 0.46], spec: 0.1, uvScale: [0.3, 0.3] });
      E.draw(A.shroomStems, I, { color: [0.96, 0.92, 0.84], spec: 0.2 }); E.draw(A.shroomCaps, I, { tex: A.tShroom, color: [1, 1, 1], spec: 0.6, shine: 50 });
      // ground: meadow on top, a cut-away slice of earth in front
      E.draw(A.ground, I, { tex: A.tGrass, color: [0.5, 0.56, 0.38], spec: 0.04 });
      E.draw(A.flat, M.trs([6, -1.0, 1.5 - 0.01], [0, 0, 0], [32, 2, 0.02]), { tex: A.tSoil, color: [1, 1, 1], spec: 0.05, uvScale: [16, 1] });
      E.draw(A.tufts[0], I, { tex: A.tTuft[0], color: [0.8, 0.88, 0.7], spec: 0.05, doubleSided: true, noShadow: true, cutout: true });
      E.draw(A.tufts[1], I, { tex: A.tTuft[1], color: [0.8, 0.88, 0.7], spec: 0.05, doubleSided: true, noShadow: true, cutout: true });
      // rocky hills under some castles
      for (const s of st.spec.statics) { const o = outcrop(s); E.draw(o.rock, I, { tex: A.tRock2, color: [1, 1, 1], spec: 0.14, shine: 22 }); E.draw(A.flat, M.trs(P3(s.x, s.y - s.h / 2 - 1, -2), [0, 0, 0], [s.w * S * 1.0, 0.035, 1.0]), { tex: A.tGrass, color: [0.5, 0.58, 0.38], uvScale: [3, 1] }); E.draw(o.tufts, I, { tex: A.tTuft[0], color: [0.8, 0.88, 0.7], spec: 0.05, doubleSided: true, noShadow: true, cutout: true }); }
    }
    function render(snapshot){
      const M = E.M, cam = st.cam, hh = cam.w / ASPECT, dist = (hh * S / 2) / Math.tan(FOV / 2);
      const shake = st.shake > 0 && !reduceMotion ? [(Math.random() - .5) * st.shake * 0.004, (Math.random() - .5) * st.shake * 0.004] : [0, 0];
      const c = P3(cam.x, cam.y);
      E.begin({ pos: [c[0] + shake[0], c[1] + 0.25 + shake[1], dist], target: [c[0], c[1], 0], fov: FOV, near: 0.1, far: 400 }, {
        sunDir: [0.5, -0.62, -0.6], sunColor: [2.45, 2.15, 1.75], ambSky: [0.46, 0.55, 0.78], ambGround: [0.3, 0.28, 0.2], toon: 0.3,
        fogColor: [0.74, 0.84, 0.96], fogDensity: 0.03, fogStart: 22,
        shadow: { center: P3(cam.x, GROUND - 120), radius: Math.max(4, cam.w * S * 0.7) },
        post: { bloom: 0.38, threshold: 0.88, saturation: 1.1, contrast: 1.06, vignette: 0.3, tint: [1.03, 1, 0.96] },
        sky: { zenith: [0.14, 0.4, 0.88], horizon: [0.7, 0.84, 0.97], ground: [0.5, 0.6, 0.4], sunColor: [1, 0.9, 0.7], sunSize: 2 },
      });
      scenery(M);
      if (st.boomLight) E.light(P3(st.boomLight.p[0], st.boomLight.p[1] - 20, 30), [6 * st.boomLight.t / 0.35, 3 * st.boomLight.t / 0.35, 0.8], 3.5);
      for (const b of st.blocks) { if (b.data.gone || b.data.off && b.y > GROUND + 200) continue; if (b.data.mat === 'goblin') drawGoblin(b); else drawBlock(b); }
      for (const f of st.flyGobs) drawGoblin({ id: f.id, x: f.x, y: f.y, a: f.a, data: {} }, f);
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
      (A.tiles || (A.tiles = new Set())).add(g);
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
