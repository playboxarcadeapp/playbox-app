// GALAXY RACER (3D): fly a starfighter through asteroid fields and race rivals across the galaxy.
(function(){
  const { fmt, reduceMotion, ctx, mulberry, seedFrom, dpr } = PB;

  function createRacer(shell){
    const W = 480, H = 720, MAX_LIVES = 5, XR = 6.5, YR = 3.4, VIEW = 420;
    const FONT = '"Russo One", "Arial Black", sans-serif';
    const GALAXIES = [
      { name:'Candy Nebula',    neb:[[1.0,0.35,0.7],[0.55,0.25,1.0],[1.0,0.6,0.8]], planet:'gas',  pc:[[0.95,0.55,0.75],[0.7,0.35,0.6],[1,0.85,0.9]], ring:true,  sun:[1, 0.85, 0.95] },
      { name:'Frost Rings',     neb:[[0.06,0.26,0.58],[0.14,0.12,0.48],[0.24,0.46,0.78]], planet:'ice',  pc:[[0.42,0.62,0.85],[0.18,0.3,0.55],[0.7,0.82,0.95]], ring:true,  sun:[0.6, 0.72, 0.9], skyBright:0.5, sunGlow:0.5, bloom:0.35, ringA:0.3, planetDim:0.7 },
      { name:'Lava Belt',       neb:[[0.7,0.26,0.08],[0.55,0.08,0.12],[0.8,0.45,0.15]], planet:'lava', pc:[[0.35,0.2,0.15],[0.15,0.08,0.06],[1,0.5,0.1]], ring:false, sun:[1, 0.75, 0.5], skyBright:0.85, sunGlow:0.55, bloom:0.35, planetDim:0.75 },
      { name:'Emerald Cluster', neb:[[0.25,0.95,0.6],[0.15,0.6,1.0],[0.8,1.0,0.5]], planet:'earth',pc:[[0.15,0.35,0.75],[0.2,0.55,0.25],[0.95,0.95,0.95]], ring:false, sun:[1, 0.95, 0.85] },
      { name:'Solar Storm',     neb:[[1.0,0.85,0.25],[1.0,0.5,0.2],[1.0,0.95,0.7]], planet:'gas',  pc:[[0.9,0.7,0.4],[0.7,0.45,0.25],[1,0.9,0.7]],    ring:true,  sun:[1, 0.9, 0.6] },
      { name:'Black Hole Run',  neb:[[0.55,0.35,1.0],[1.0,0.25,0.85],[0.3,0.2,0.6]], planet:'rock', pc:[[0.45,0.4,0.5],[0.25,0.22,0.3],[0.7,0.65,0.75]], ring:false, sun:[0.85, 0.75, 1] },
    ];
    const POWERS = {
      turbo:  { name:'Turbo',       color:'#ff9a3d', time:4,  weight:14, desc:'Blast ahead and smash through rocks' },
      shield: { name:'Force field', color:'#5ee0ff', time:20, weight:16, desc:'Bounces off one crash' },
      magnet: { name:'Star magnet', color:'#ffd23f', time:10, weight:16, desc:'Pulls in stars from far away' },
      blaster:{ name:'Blasters',    color:'#ff5d7a', time:8,  weight:14, desc:'Auto-fire lasers break asteroids' },
      mini:   { name:'Mini ship',   color:'#7dff6a', time:10, weight:12, desc:'Shrink to slip through tight gaps' },
      life:   { name:'Extra life',  color:'#ff3d6e', time:0,  weight:7,  desc:'Adds one heart (up to 5)' },
    };
    const RIVALS = [ { name:'Comet', color:'#e84a4a' }, { name:'Nova', color:'#3fcf8e' }, { name:'Zip', color:'#9b7bff' } ];
    const PLACE = ['1st','2nd','3rd','4th'];
    let st = null, E = null, A = null;
    const STARS = (() => { const R = PB.mulberry(77), out = []; for (let i=0;i<900;i++) { let x, y, z, l; do { x = R()*2-1; y = R()*2-1; z = R()*2-1; l = Math.hypot(x, y, z); } while (l > 1 || l < 0.1); const b = Math.pow(R(), 3), t = R(); out.push({ d: [x/l, y/l, z/l], size: 1.4 + b * 3.2, a: 0.35 + b * 0.65, c: t < 0.15 ? [1, 0.8, 0.6] : t < 0.35 ? [0.7, 0.8, 1] : [1, 1, 1], flare: b > 0.75 }); } return out; })();
    const SKY = {}, PLAN = {};
    const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

    // ---------- procedural textures ----------
    function cv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function skyTexture(gi){
      const gal = GALAXIES[gi], N = PB.gl3d;
      const w = 1536, h = 768, lw = 384, lh = 192;
      const low = cv(lw, lh), lg = low.getContext('2d'), id = lg.createImageData(lw, lh);
      for (let y=0;y<lh;y++) for (let x=0;x<lw;x++) {
        const th = y / lh * Math.PI, ph = x / lw * Math.PI * 2;
        const dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph);
        const n1 = N.fbm(dx * 1.6 + gi * 3, dy * 1.6, dz * 1.6, 5), n2 = N.fbm(dx * 3 + 10, dy * 3, dz * 3 + gi, 4);
        const band = Math.exp(-Math.pow((dy * 0.9 + dx * 0.35) * 1.8, 2));
        const dens = Math.max(0, n1 * 1.7 + 0.24) * (0.45 + band);
        const dust = Math.max(0, n2 * 1.4) * band;
        const c = gal.neb[0], c2 = gal.neb[1], c3 = gal.neb[2];
        const mix = Math.max(0, Math.min(1, n2 + 0.5));
        const r = (c[0] * (1 - mix) + c2[0] * mix) * dens * 0.85 + c3[0] * Math.pow(dens, 3) * 0.9;
        const g = (c[1] * (1 - mix) + c2[1] * mix) * dens * 0.85 + c3[1] * Math.pow(dens, 3) * 0.9;
        const b = (c[2] * (1 - mix) + c2[2] * mix) * dens * 0.85 + c3[2] * Math.pow(dens, 3) * 0.9;
        const dk = 1 - Math.min(0.85, dust * 0.9);
        const i = (y * lw + x) * 4; id.data[i] = Math.min(255, (r * dk + 0.012) * 255); id.data[i+1] = Math.min(255, (g * dk + 0.012) * 255); id.data[i+2] = Math.min(255, (b * dk + 0.025) * 255); id.data[i+3] = 255;
      }
      lg.putImageData(id, 0, 0);
      const c = cv(w, h), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high'; g.drawImage(low, 0, 0, w, h);
      const R = PB.mulberry(500 + gi);
      for (let i=0;i<2600;i++) { const y = R() * h, x = R() * w, b = R(); const t = R(); const col = t < 0.15 ? '255,210,170' : t < 0.3 ? '170,200,255' : '255,255,255';
        g.fillStyle = `rgba(${col},${0.1 + b * 0.3})`; const s = 0.8; g.fillRect(x, y, s, s); }
      for (let i=0;i<36;i++) { const x = R() * w, y = 60 + R() * (h - 120), r = 6 + R() * 10; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.2, 'rgba(220,230,255,.4)'); gr.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - r * 1.6, y - 0.4, r * 3.2, 0.8); g.fillRect(x - 0.4, y - r * 1.6, 0.8, r * 3.2); }
      return c;
    }
    function planetTexture(gi){
      const gal = GALAXIES[gi], N = PB.gl3d, w = 512, h = 256;
      const c = cv(w, h), g = c.getContext('2d'), id = g.createImageData(w, h);
      const [c1, c2, c3] = gal.pc;
      for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
        const th = y / h * Math.PI, ph = x / w * Math.PI * 2;
        const dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph);
        let r, gg, b;
        if (gal.planet === 'gas' || gal.planet === 'ice') {
          const turb = N.fbm(dx * 3, dy * 3, dz * 3, 4) * 0.6;
          const band = Math.sin((dy + turb * 0.25) * 18) * 0.5 + 0.5, band2 = Math.sin((dy + turb * 0.4) * 47) * 0.5 + 0.5;
          const t = band * 0.7 + band2 * 0.3;
          r = c1[0] * t + c2[0] * (1 - t); gg = c1[1] * t + c2[1] * (1 - t); b = c1[2] * t + c2[2] * (1 - t);
          const storm = Math.exp(-((dy + 0.3) ** 2) * 80 - ((ph - 2) ** 2) * 6); r += (c3[0] - r) * storm; gg += (c3[1] - gg) * storm; b += (c3[2] - b) * storm;
        } else {
          const n = N.fbm(dx * 2.2 + 5, dy * 2.2, dz * 2.2, 6);
          if (gal.planet === 'earth') {
            if (n > 0.05) { const m = Math.min(1, (n - 0.05) * 4); r = 0.2 + m * 0.35; gg = 0.45 - m * 0.1; b = 0.2; if (Math.abs(dy) > 0.82) { r = gg = b = 0.95; } }
            else { r = 0.06; gg = 0.22 + n; b = 0.55 + n; }
            const cl = N.fbm(dx * 4 + 20, dy * 4, dz * 4, 5); if (cl > 0.12) { const a = Math.min(0.9, (cl - 0.12) * 4); r += (1 - r) * a; gg += (1 - gg) * a; b += (1 - b) * a; }
          } else if (gal.planet === 'lava') {
            const cr = Math.abs(N.fbm(dx * 5, dy * 5, dz * 5, 4)); const glow = cr < 0.04 ? 1 - cr / 0.04 : 0;
            r = c1[0] + n * 0.2 + glow * 0.9; gg = c1[1] + n * 0.1 + glow * 0.45; b = c1[2] + glow * 0.05;
          } else { const t = n * 0.5 + 0.5; r = c2[0] + (c3[0] - c2[0]) * t; gg = c2[1] + (c3[1] - c2[1]) * t; b = c2[2] + (c3[2] - c2[2]) * t; }
        }
        const i = (y * w + x) * 4; id.data[i] = Math.max(0, Math.min(255, r * 255)); id.data[i+1] = Math.max(0, Math.min(255, gg * 255)); id.data[i+2] = Math.max(0, Math.min(255, b * 255)); id.data[i+3] = 255;
      }
      g.putImageData(id, 0, 0);
      return c;
    }
    function rockTexture(){
      const N = PB.gl3d, w = 256, h = 128, c = cv(w, h), g = c.getContext('2d'), id = g.createImageData(w, h);
      for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
        const n = N.fbm(x / 22, y / 22, 3.3, 5), n2 = N.fbm(x / 6, y / 6, 7.1, 3);
        const v = 0.42 + n * 0.45 + n2 * 0.18;
        const i = (y * w + x) * 4; id.data[i] = v * 168; id.data[i+1] = v * 156; id.data[i+2] = v * 146; id.data[i+3] = 255;
      }
      g.putImageData(id, 0, 0);
      for (let i=0;i<26;i++) { const x = Math.random() * w, y = Math.random() * h, r = 3 + Math.random() * 10; const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.8, 'rgba(0,0,0,.15)'); gr.addColorStop(1, 'rgba(255,255,255,.12)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      return c;
    }
    function hullTexture(){
      const c = cv(256, 256), g = c.getContext('2d');
      g.fillStyle = '#c9ced6'; g.fillRect(0, 0, 256, 256);
      for (let i=0;i<14;i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${0.03 + Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 90, 20 + Math.random() * 60); }
      g.strokeStyle = 'rgba(40,46,56,.45)'; g.lineWidth = 1.2;
      for (let x=0;x<256;x+=32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
      for (let y=0;y<256;y+=48) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
      g.fillStyle = 'rgba(40,46,56,.5)'; for (let i=0;i<120;i++) g.fillRect(Math.floor(Math.random() * 8) * 32 + 3, Math.random() * 256, 1.4, 1.4);
      return c;
    }

    // ---------- meshes ----------
    function loadAssets(){
      if (A) return A;
      E = PB.gl3d.get(); if (!E) return null;
      const G = E.G, M = E.M, N = PB.gl3d;
      const rocks = [];
      for (let i=0;i<6;i++) { const s = i * 3.7; rocks.push(E.mesh(G.displace(G.sphere(1, 36, 26), (x, y, z) => N.fbm(x * 1.2 + s, y * 1.2, z * 1.2, 5) * 0.55 - Math.abs(N.noise3(x * 3 + s, y * 3, z * 3)) * 0.12))); }
      // starfighter built from simple parts, nose pointing -z
      const T = (g, t, r, s) => G.transform(g, M.trs(t, r, s));
      const hull = G.merge([
        T(G.cylinder(0.32, 0.5, 2.6, 18), [0, 0, 0.2], [Math.PI / 2, 0, 0], [1, 1, 0.75]),
        T(G.cylinder(0.02, 0.32, 1.5, 18), [0, 0, -1.85], [-Math.PI / 2, 0, 0], [1, 1, 0.75]),
        T(G.box(0.7, 0.24, 1.4), [0, -0.12, 0.6]),
      ]);
      const wingShape = [[0, -0.9], [2.4, 0.55], [2.5, 0.9], [0.35, 0.95]];
      const wings = G.merge([
        T(G.extrude(wingShape, 0.08), [0.3, -0.05, 0.2], [Math.PI / 2, 0, 0]),
        T(G.extrude(wingShape.map(([x, y]) => [-x, y]).reverse(), 0.08), [-0.3, -0.05, 0.2], [Math.PI / 2, 0, 0]),
      ]);
      const finShape = [[0, 0], [0.75, 0], [0.95, 0.75], [0.6, 0.75]];
      const fins = G.merge([ T(G.extrude(finShape, 0.06), [0.45, 0.15, 1.0], [0, Math.PI / 2, 0.35]), T(G.extrude(finShape, 0.06), [-0.45, 0.15, 1.0], [0, Math.PI / 2, -0.35]) ]);
      const stripe = G.merge([ T(G.box(1.2, 0.1, 0.22), [1.25, -0.02, 0.62], [0, -0.52, 0]), T(G.box(1.2, 0.1, 0.22), [-1.25, -0.02, 0.62], [0, 0.52, 0]), T(G.box(0.24, 0.05, 1.6), [0, 0.32, -0.4]) ]);
      const pods = G.merge([ T(G.cylinder(0.24, 0.26, 1.5, 16), [0.62, -0.1, 0.75], [Math.PI / 2, 0, 0]), T(G.cylinder(0.24, 0.26, 1.5, 16), [-0.62, -0.1, 0.75], [Math.PI / 2, 0, 0]) ]);
      const nozzles = G.merge([ T(G.cylinder(0.19, 0.19, 0.06, 16), [0.62, -0.1, 1.52], [Math.PI / 2, 0, 0]), T(G.cylinder(0.19, 0.19, 0.06, 16), [-0.62, -0.1, 1.52], [Math.PI / 2, 0, 0]) ]);
      const canopy = T(G.sphere(0.5, 24, 16), [0, 0.28, -0.55], [0, 0, 0], [0.55, 0.42, 1.25]);
      // wingtip cannons and glowing light strips along the wing edges
      const cannons = G.merge([ T(G.cylinder(0.07, 0.07, 1.4, 10), [2.62, -0.1, 0.3], [Math.PI / 2, 0, 0]), T(G.cylinder(0.07, 0.07, 1.4, 10), [-2.62, -0.1, 0.3], [Math.PI / 2, 0, 0]),
        T(G.cylinder(0.11, 0.11, 0.35, 10), [2.62, -0.1, 0.85], [Math.PI / 2, 0, 0]), T(G.cylinder(0.11, 0.11, 0.35, 10), [-2.62, -0.1, 0.85], [Math.PI / 2, 0, 0]) ]);
      const edges = G.merge([ T(G.box(2.75, 0.05, 0.09), [1.5, -0.02, 0.02], [0, -0.544, 0]), T(G.box(2.75, 0.05, 0.09), [-1.5, -0.02, 0.02], [0, 0.544, 0]), T(G.box(0.08, 0.06, 2.2), [0, 0.36, 0.55]) ]);
      const spine = T(G.box(0.12, 0.18, 1.1), [0, 0.3, 0.85]);
      A = {
        rocks, tRock: E.texture(rockTexture()), tHull: E.texture(hullTexture()),
        hull: E.mesh(hull), wings: E.mesh(wings), fins: E.mesh(fins), stripe: E.mesh(stripe), pods: E.mesh(pods), nozzles: E.mesh(nozzles), canopy: E.mesh(canopy), cannons: E.mesh(cannons), edges: E.mesh(edges), spine: E.mesh(spine),
        sphere: E.mesh(G.sphere(1, 48, 32)), ring: E.mesh(G.torus(2.6, 0.16, 48, 12)),
        planetRing: E.mesh(G.transform(G.torus(1.9, 0.35, 96, 4), M.trs([0,0,0], [0,0,0], [1, 0.02, 1]))),
        star: E.mesh(G.extrude((() => { const p = []; for (let i=0;i<10;i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.26 : 0.6; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; })(), 0.18)),
        box: E.mesh(G.box(1, 1, 1)), cyl: E.mesh(G.cylinder(0.5, 0.5, 1, 20)),
        checker: E.texture((() => { const c = cv(256, 64), g = c.getContext('2d'); for (let i=0;i<16;i++) for (let j=0;j<4;j++) { g.fillStyle = (i + j) % 2 ? '#f4f4f4' : '#141414'; g.fillRect(i * 16, j * 16, 16, 16); } return c; })()),
      };
      return A;
    }
    function ensureGalaxy(gi){
      if (!SKY[gi]) SKY[gi] = E.texture(skyTexture(gi), { clampV: true });
      if (!PLAN[gi]) PLAN[gi] = E.texture(planetTexture(gi), { clampV: true });
    }

    // ---------- game state ----------
    const RACE_HEARTS = 3;
    function fresh(mode, rand, lives, phase, level){
      const lv = typeof level === 'number' ? level : 1;
      st = { mode, phase, rand, lives, lives0: lives, score:0, level: lv, stars:0, parts:[], pops:[], dust:[], trail:[], shake:0, msg:null, clock:0, t:0 };
      startRace();
    }
    // Course length grows every level: about 30 seconds at level 1, over 3 minutes by level 40.
    const courseLength = L => Math.round(2000 + Math.min(L, 60) * 460 + Math.max(0, L - 60) * 150);
    function startRace(){
      const g = GALAXIES[(st.level - 1) % GALAXIES.length];
      const R = st.mode === 'daily' ? mulberry(seedFrom('racer-daily-' + PB.today() + '-' + st.level)) : st.rand;
      st.R = R; st.gal = g; st.gi = (st.level - 1) % GALAXIES.length;
      st.length = courseLength(st.level);
      st.lives = Math.max(st.lives, st.lives0); // a full set of hearts for every race
      st.d = 0; st.speed = 0; st.base = 70 + Math.min(st.level, 12) * 2.4;
      st.objs = []; st.bolts = []; st.nextSpawn = 70; st.powIn = 5;
      st.fx = { turbo:0, shield:0, magnet:0, blaster:0, mini:0 }; st.boost = 0; st.hitSlow = 0; st.inv = 0; st.fireCD = 0;
      st.p = { x: 0, y: 0, tx: 0, ty: 0, bank: 0 };
      st.rivals = RIVALS.map((r, i) => ({ ...r, d: [1, 3, 8][i], x: [-4.2, 4.2, 0][i], y: [0.4, -0.4, 2.2][i], tx: 0, ty: 0, skill: Math.min([1.02, 1.06, 1.1][i], [0.92, 0.95, 0.98][i] + (st.level - 1) * 0.004), ph: R() * 6, boostT: 0, boostIn: 3 + i * 1.5 + R() * 4 }));
      st.count = 2.6; st.finished = false; st.place = 4; st.raceStars = 0; st.planetSpin = R() * 6;
      st.drag = null;
      st.dust = Array.from({ length: 90 }, () => ({ x: (Math.random() - .5) * 40, y: (Math.random() - .5) * 26, z: -Math.random() * 160 }));
    }
    function pickPower(){
      const e = Object.entries(POWERS).filter(([k]) => !(k === 'life' && st.lives >= MAX_LIVES));
      let roll = st.R() * e.reduce((s,[,p]) => s + p.weight, 0);
      for (const [k,p] of e) { roll -= p.weight; if (roll <= 0) return k; }
      return 'shield';
    }
    const rnd = (a, b) => a + st.R() * (b - a);
    function rock(x, y, d, r){ return { kind:'rock', x, y, d, r, m: Math.floor(Math.random() * 6), rot: [Math.random() * 6, Math.random() * 6, 0], vr: [(Math.random() - .5) * 0.8, (Math.random() - .5) * 0.8], vx: 0 }; }
    function spawn(){
      const R = st.R, d = st.d + 220, L = st.level, r = R();
      if (r < 0.3) {
        // a small cluster of rocks (a few more as you go, but never a crowd)
        const n = 2 + Math.floor(R() * Math.min(3, 1 + L / 6));
        for (let i=0;i<n;i++) st.objs.push(rock(rnd(-XR, XR), rnd(-YR, YR), d + R() * 30, rnd(0.9, 1.3 + Math.min(L, 25) * 0.03)));
      } else if (r < 0.42 && L >= 8) {
        const gx = rnd(-XR + 2, XR - 2), gy = rnd(-YR + 1.5, YR - 1.5), gap = Math.max(2.9, 3.8 - L * 0.03);
        for (let x = -XR - 1; x <= XR + 1; x += 2.4) for (let y = -YR - 0.5; y <= YR + 0.5; y += 2.4) if (Math.hypot(x - gx, y - gy) > gap) st.objs.push(rock(x + rnd(-0.4, 0.4), y + rnd(-0.4, 0.4), d + rnd(-1, 1), rnd(1.0, 1.4)));
        for (let i=0;i<3;i++) st.objs.push({ kind:'star', x: gx, y: gy, d: d + 10 + i * 8 });
      } else if (r < 0.75) {
        const x0 = rnd(-XR + 1, XR - 1), y0 = rnd(-YR + 1, YR - 1), wav = R() < 0.5;
        for (let i=0;i<6;i++) st.objs.push({ kind:'star', x: wav ? x0 + Math.sin(i * 0.9) * 2.2 : x0, y: y0 + (wav ? Math.cos(i * 0.9) * 1.2 : 0), d: d + i * 7 });
      } else if (r < 0.88) {
        st.objs.push({ kind:'gate', x: rnd(-XR + 2, XR - 2), y: rnd(-YR + 1, YR - 1), d });
        if (R() < 0.5) st.objs.push(rock(rnd(-XR, XR), rnd(-YR, YR), d + 24, 1.3));
      } else {
        const o = rock(R() < .5 ? -XR - 8 : XR + 8, rnd(-YR, YR), d, rnd(1.3, 2)); o.vx = (o.x < 0 ? 1 : -1) * rnd(4, 7); st.objs.push(o);
      }
      if (st.powIn <= 0) { st.objs.push({ kind:'pow', type: pickPower(), x: rnd(-XR + 1, XR - 1), y: rnd(-YR + 1, YR - 1), d: d + 30 }); st.powIn = 6 + R() * 4; }
      st.nextSpawn = st.d + Math.max(42, 72 - L * 0.9) + R() * 22;
    }
    const rel = o => o.d - st.d;
    function pop(wp, text, color, life){ st.pops.push({ wp, text, color, life: life || 1, rise: 0 }); }
    function burst(p, color, n, speed = 8){ if (reduceMotion) return; for (let i=0;i<n;i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.4 + Math.random()); st.parts.push({ p: [...p], v: [Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s], life: 0.7, color, size: 0.35 + Math.random() * 0.4 }); } }
    const shipPos = () => [st.p.x, st.p.y, 0];
    function crash(o){
      o.dead = true;
      burst([o.x, o.y, -rel(o)], [1, 0.7, 0.4], 26, 10); st.flash = 0.25;
      if (st.fx.turbo > 0) { if (PB.sfx) PB.sfx('crash'); st.score += 20; pop(shipPos(), 'SMASH!', '#ff9a3d'); return; }
      if (st.inv > 0) return;
      if (st.fx.shield > 0) { st.fx.shield = 0; st.inv = 0.8; pop(shipPos(), 'Shield saved you!', '#5ee0ff'); return; }
      st.lives--; st.inv = 1.6; st.hitSlow = 1; st.shake = 14;
      pop(shipPos(), 'Ouch!', '#ff5d7a');
      if (st.lives <= 0) {
        st.phase = 'over';
        if (st.mode === 'daily') shell.gameOver(st.level - 1, st.level > 1 ? `You finished ${st.level - 1} race${st.level > 2 ? 's' : ''} and reached ${st.gal.name}` : `You crashed out of race 1. Try again!`);
        else { st.failTitle = 'Crashed out!'; shell.levelDone({ win: false, stars: 0, score: st.level, summary: `Your ship ran out of hearts in ${st.gal.name}. Dodge the rocks and try again!` }); }
      }
    }
    function collect(o){ if (PB.sfx) PB.sfx('coin');
      o.dead = true;
      if (o.kind === 'star') { st.stars++; st.raceStars++; st.score += 10; burst([o.x, o.y, -rel(o)], [1, 0.85, 0.3], 8, 4); return; }
      const P = POWERS[o.type];
      if (o.type === 'life') st.lives = Math.min(MAX_LIVES, st.lives + 1); else st.fx[o.type] = P.time;
      burst([o.x, o.y, -rel(o)], hex(P.color), 20, 6); pop(shipPos(), P.name + '!', P.color, 1.3);
    }
    function finish(){
      st.finished = true;
      const place = 1 + st.rivals.filter(r => r.d >= st.length).length;
      st.place = place;
      const bonus = [600, 400, 250, 120][place - 1] * st.level;
      st.score += bonus;
      pop([st.p.x, st.p.y + 2, -3], PLACE[place - 1] + ' PLACE!', place === 1 ? '#ffd23f' : '#fff', 2.2);
      st.between = 1.8;
    }
    function update(dt){
      st.clock += dt;
      const flySpeed = st.phase === 'play' && !st.msg && st.count <= 0 ? st.speed : 22;
      for (const q of st.dust) { q.z += flySpeed * dt * 1.4; if (q.z > 8) { q.z -= 168; q.x = (Math.random() - .5) * 40; q.y = (Math.random() - .5) * 26; } }
      if (st.phase !== 'play' || st.msg) { st.speed = 0; return effects(dt); }
      if (st.count > 0) { st.count -= dt; if (st.count <= 0) pop([0, 2, -6], 'GO!', '#7dff6a', 0.8); return effects(dt); }
      if (st.between != null) {
        st.speed *= 0.97; st.d += st.speed * dt; st.between -= dt;
        if (st.between <= 0) {
          st.between = null;
          if (st.mode !== 'daily') {
            st.phase = 'over';
            const won = st.place === 1, lost = st.lives0 - st.lives;
            if (won) shell.levelDone({ win: true, stars: lost === 0 ? 3 : lost === 1 ? 2 : 1, score: st.level, summary: `1st place in ${st.gal.name}! ${st.raceStars} stars collected.` });
            else { st.failTitle = `${PLACE[st.place - 1]} place`; shell.levelDone({ win: false, stars: 0, score: st.level, summary: `You came ${PLACE[st.place - 1]}. You need 1st place to unlock the next level. Fly through the blue rings for speed boosts!` }); }
          } else { st.level++; startRace(); st.msg = `Next: ${st.gal.name} \u00b7 Tap to race`; }
        }
        return effects(dt);
      }
      st.t += dt;
      for (const k in st.fx) if (st.fx[k] > 0) st.fx[k] = Math.max(0, st.fx[k] - dt);
      st.powIn -= dt; st.inv = Math.max(0, st.inv - dt); st.hitSlow = Math.max(0, st.hitSlow - dt); st.boost = Math.max(0, st.boost - dt);
      const want = st.base * (st.fx.turbo > 0 ? 1.7 : st.boost > 0 ? 1.45 : 1) * (st.hitSlow > 0 ? 0.55 : 1);
      st.speed += (want - st.speed) * Math.min(1, dt * 3);
      st.d += st.speed * dt;
      const p = st.p, px0 = p.x;
      p.x += (p.tx - p.x) * Math.min(1, dt * 9); p.y += (p.ty - p.y) * Math.min(1, dt * 9);
      p.bank += (Math.max(-1, Math.min(1, (p.x - px0) / Math.max(dt, 0.001) * -0.09)) - p.bank) * Math.min(1, dt * 8);
      for (const r of st.rivals) {
        // rivals fly through boost rings too (better pilots find them more often) and never fall too far behind
        const gap = r.d - st.d, band = gap > 260 ? 0.9 : gap < -200 ? 1.2 : gap < -80 ? 1.08 : 1;
        r.boostT = Math.max(0, r.boostT - dt); r.boostIn -= dt;
        if (r.boostIn <= 0) { r.boostT = 1.3; r.boostIn = 9 - r.skill * 3 + Math.random() * 4; }
        r.d += st.base * r.skill * band * (r.boostT > 0 ? 1.35 : 1) * (1 + 0.05 * Math.sin(st.t * 0.7 + r.ph)) * dt;
        if (Math.hypot(r.x - r.tx, r.y - r.ty) < 0.3) {
          const ring = st.objs.find(o => o.kind === 'gate' && o.d > r.d + 20 && o.d < r.d + 140);
          if (ring) { r.tx = ring.x; r.ty = ring.y; } else { r.tx = (Math.random() - .5) * XR * 1.6; r.ty = (Math.random() - .5) * YR * 1.4; }
        }
        r.x += (r.tx - r.x) * Math.min(1, dt * 0.8); r.y += (r.ty - r.y) * Math.min(1, dt * 0.8);
      }
      if (st.d >= st.nextSpawn && st.d < st.length - 160) spawn();
      if (st.fx.blaster > 0) { st.fireCD -= dt; if (st.fireCD <= 0) { st.fireCD = 0.2; st.bolts.push({ x: p.x - 0.62, y: p.y - 0.1, z: -1 }, { x: p.x + 0.62, y: p.y - 0.1, z: -1 }); } }
      for (const b of st.bolts) b.z -= 220 * dt;
      st.bolts = st.bolts.filter(b => b.z > -200);
      const hitR = st.fx.mini > 0 ? 0.45 : 0.95;
      for (const o of st.objs) {
        if (o.dead) continue;
        const z = -rel(o);
        if (o.kind === 'rock') { o.rot[0] += o.vr[0] * dt; o.rot[1] += o.vr[1] * dt; o.x += o.vx * dt; }
        if (z < -VIEW || z > 10) continue;
        if (o.kind === 'star' && st.fx.magnet > 0 && z > -60) { const k = Math.min(1, dt * 5); o.x += (p.x - o.x) * k; o.y += (p.y - o.y) * k; }
        const near = Math.abs(z) < 1.6;
        if (o.kind === 'rock') {
          for (const b of st.bolts) if (Math.abs(b.x - o.x) < o.r && Math.abs(b.y - o.y) < o.r && Math.abs(b.z - z) < o.r + 2) { o.dead = true; b.z = -999; st.score += 15; burst([o.x, o.y, z], [1, 0.6, 0.3], 22, 9); break; }
          if (!o.dead && Math.abs(z) < o.r + 0.6 && Math.hypot(o.x - p.x, o.y - p.y) < o.r * 0.82 + hitR) crash(o);
          if (st.phase !== 'play') return;
        } else if (o.kind === 'star' && near && Math.hypot(o.x - p.x, o.y - p.y) < 1.5) collect(o);
        else if (o.kind === 'pow' && near && Math.hypot(o.x - p.x, o.y - p.y) < 1.7) collect(o);
        else if (o.kind === 'gate' && !o.used && near && Math.hypot(o.x - p.x, o.y - p.y) < 2.6) { o.used = true; st.boost = 1.6; if (PB.sfx) PB.sfx('whoosh'); pop(shipPos(), 'BOOST!', '#5ee0ff', 0.8); }
      }
      st.objs = st.objs.filter(o => !o.dead && -rel(o) < 12);
      st.score += st.speed * dt * 0.15;
      if (st.d >= st.length) finish();
      effects(dt);
    }
    function effects(dt){
      const sc = st.fx && st.fx.mini > 0 ? 0.55 : 1;
      if (st.phase === 'play' && !st.msg && st.count <= 0 && !reduceMotion) for (const sx of [-0.62, 0.62]) st.trail.push({ p: [st.p.x + sx * sc, st.p.y - 0.1 * sc, 1.6 * sc], life: 0.45, size: 0.55 * sc });
      for (const t of st.trail) { t.p[2] += (st.speed * 0.9 + 6) * dt; t.life -= dt; t.size += dt * 0.8; }
      st.trail = st.trail.filter(t => t.life > 0);
      for (const q of st.parts) { q.p[0] += q.v[0]*dt; q.p[1] += q.v[1]*dt; q.p[2] += q.v[2]*dt + st.speed * dt * 0.6; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.rise += 40 * dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      st.shake = Math.max(0, st.shake - dt * 30);
      if (st.boostFlash) { st.boostFlash.t -= dt; if (st.boostFlash.t <= 0) st.boostFlash = null; }
      if (st.flash) st.flash = Math.max(0, st.flash - dt);
    }

    // ---------- rendering ----------
    // Swag Shop ships (built the first time they are needed)
    let SHIPS = null;
    function shipModels(){
      if (SHIPS) return SHIPS;
      const G = E.G, M = E.M, T = (g, t, r, s) => G.transform(g, M.trs(t, r || [0, 0, 0], s || [1, 1, 1]));
      const fin = (pts, d) => G.extrude(pts, d);
      SHIPS = {
        saucer: { body: E.mesh(T(G.sphere(1, 36, 18), [0, 0, 0], [0, 0, 0], [1.6, 0.32, 1.6])), trim: E.mesh(T(G.torus(1.55, 0.09, 48, 8), [0, 0, 0], [Math.PI / 2, 0, 0])),
          dome: E.mesh(T(G.sphere(1, 24, 16), [0, 0.22, 0], [0, 0, 0], [0.7, 0.55, 0.7])), under: E.mesh(T(G.cylinder(0.6, 0.35, 0.25, 24), [0, -0.3, 0])), lights: E.mesh(G.merge(Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return T(G.sphere(0.1, 8, 6), [Math.cos(a) * 1.35, 0.02, Math.sin(a) * 1.35]); }))),
          jets: [[0, -0.4, 0.2]] },
        shark: { body: E.mesh(G.merge([T(G.sphere(1, 32, 20), [0, 0, 0], [0, 0, 0], [0.62, 0.55, 2.0]), T(G.cylinder(0.05, 0.4, 0.9, 16), [0, 0, 2.1], [-Math.PI / 2, 0, 0], [1, 1, 0.8])])),
          belly: E.mesh(T(G.sphere(1, 24, 16), [0, -0.18, -0.2], [0, 0, 0], [0.5, 0.36, 1.7])),
          fins: E.mesh(G.merge([T(fin([[0, 0], [0.9, 0], [0.3, 1.0]], 0.08), [0, 0.45, 0.1], [0, Math.PI / 2, 0]), T(fin([[0, 0], [1.6, 0.4], [1.5, 0.75], [0.2, 0.55]], 0.07), [0.45, -0.15, -0.1], [Math.PI / 2, 0, -0.2]), T(fin([[0, 0], [-1.6, 0.4], [-1.5, 0.75], [-0.2, 0.55]].reverse(), 0.07), [-0.45, -0.15, -0.1], [Math.PI / 2, 0, 0.2]), T(fin([[0, 0], [0.7, -0.5], [0.8, 0.6]], 0.07), [0, 0, 2.55], [0, Math.PI / 2, Math.PI / 2])])),
          eyes: E.mesh(G.merge([T(G.sphere(0.12, 12, 8), [0.38, 0.18, -1.2]), T(G.sphere(0.12, 12, 8), [-0.38, 0.18, -1.2])])),
          teeth: E.mesh(G.merge(Array.from({ length: 6 }, (_, i) => T(G.cylinder(0, 0.05, 0.12, 4), [(i - 2.5) * 0.11, -0.2, -1.78 + Math.abs(i - 2.5) * 0.04], [Math.PI, 0, 0])))),
          jets: [[0.25, -0.05, 2.3], [-0.25, -0.05, 2.3]] },
        rocket: { body: E.mesh(G.merge([T(G.cylinder(0.5, 0.5, 2.4, 24), [0, 0, 0.3], [Math.PI / 2, 0, 0]), T(G.cylinder(0.02, 0.5, 1.2, 24), [0, 0, -1.5], [-Math.PI / 2, 0, 0])])),
          bands: E.mesh(G.merge([T(G.cylinder(0.52, 0.52, 0.16, 24), [0, 0, -0.85], [Math.PI / 2, 0, 0]), T(G.cylinder(0.52, 0.52, 0.16, 24), [0, 0, 1.3], [Math.PI / 2, 0, 0])])),
          fins: E.mesh(G.merge([0, 1, 2].map(i => T(T(T(fin([[0, 0], [0.7, 0.3], [0.7, 0.95], [0, 0.75]], 0.08), [0.42, 0, 0]), [0, 0, 0.75], [Math.PI / 2, 0, 0]), [0, 0, 0], [0, 0, i * Math.PI * 2 / 3 + Math.PI / 2])))),
          windows: E.mesh(G.merge([T(G.cylinder(0.2, 0.2, 0.06, 16), [0, 0.47, -0.4]), T(G.cylinder(0.14, 0.14, 0.06, 16), [0, 0.48, 0.25])])),
          jets: [[0, 0, 1.65]] },
      };
      return SHIPS;
    }
    // the player's ship: the classic starfighter, or one from the Swag Shop
    function drawPlayerShip(M, pos, rot, scale, paint, engine, hot){
      const kind = PB.meta && PB.meta.look('racer', 'ship'), model = kind && shipModels()[kind.replace('model_', '')];
      if (!model) return drawShip(M, pos, rot, scale, paint, engine, hot);
      const m = M.trs(pos, rot, [scale, scale, scale]), INK = { color: [0.06, 0.04, 0.14], unlit: true, outline: 0.045, noShadow: true };
      const part = (mesh, mat, ink = true) => { E.draw(mesh, m, mat); if (ink) E.draw(mesh, m, INK); };
      const metal = { color: [0.82, 0.84, 0.9], spec: 1.2, shine: 80 }, pt = { color: paint, spec: 0.9, shine: 60 };
      if (kind === 'model_saucer') { const spin = M.mul(m, M.trs([0, 0, 0], [0, st.clock * 2, 0])); E.draw(model.body, m, metal); E.draw(model.body, m, INK); E.draw(model.trim, m, pt); E.draw(model.under, m, pt); E.draw(model.dome, m, { color: [0.4, 0.8, 1], spec: 1.8, shine: 120, alpha: 0.85, rim: 0.8 }); E.draw(model.lights, spin, { color: [1, 1, 0.8], emissive: [1.6, 1.4, 0.6], noShadow: true }); }
      else if (kind === 'model_shark') { part(model.body, pt); part(model.belly, { color: [0.95, 0.95, 0.92], spec: 0.6 }, false); part(model.fins, pt); E.draw(model.eyes, m, { color: [0.05, 0.05, 0.08], spec: 2, shine: 120 }); E.draw(model.teeth, m, { color: [1, 1, 1], spec: 0.8 }); }
      else { part(model.body, { color: [0.96, 0.96, 0.98], spec: 1, shine: 70 }); part(model.bands, pt, false); part(model.fins, pt); E.draw(model.windows, m, { color: [0.3, 0.7, 1], emissive: [0.2, 0.4, 0.7], spec: 2, shine: 120 }); }
      for (const j of model.jets) { const wp = M.xform(m, j); E.sprite(wp, (0.6 + engine * 0.6) * scale, [0.45, 0.7, 1], 0.85, true); E.sprite(wp, (0.3 + engine * 0.15) * scale, [1, 1, 1], 0.85, true); if (hot) E.sprite([wp[0], wp[1], wp[2] + 0.6 * scale], (1.3 + engine) * scale, [1, 0.55, 0.2], 0.5 * engine, true); }
    }
    function drawShip(M, pos, rot, scale, paint, engine, hot){
      const m = M.trs(pos, rot, [scale, scale, scale]);
      const INK = { color: [0.06, 0.04, 0.14], unlit: true, outline: 0.045, noShadow: true };
      const part = (mesh, mat) => { E.draw(mesh, m, mat); if (mesh !== A.nozzles && mesh !== A.stripe && mesh !== A.canopy && mesh !== A.edges) E.draw(mesh, m, INK); };
      part(A.hull, { tex: A.tHull, color: [0.8, 0.83, 0.9], spec: 1.3, shine: 110, rim: 0.35 });
      part(A.wings, { color: paint, emissive: paint.map(v => v * 0.08), spec: 1.6, shine: 100, rim: 0.5 });
      part(A.fins, { color: paint, spec: 1.5, shine: 90, rim: 0.4 });
      part(A.stripe, { color: paint.map(v => v * 0.5 + 0.5), emissive: paint.map(v => v * 0.9 + 0.1), spec: 0.6 });
      part(A.pods, { color: [0.32, 0.34, 0.38], spec: 0.9, shine: 60 });
      part(A.nozzles, { color: [0.3, 0.6, 1], emissive: [engine * 1.2, engine * 2.2, engine * 4], noShadow: true });
      part(A.canopy, { color: [0.08, 0.3, 0.6], emissive: [0.02, 0.12, 0.3], spec: 2.2, shine: 140, rim: 1.1 });
      part(A.cannons, { color: [0.22, 0.24, 0.3], spec: 1.4, shine: 90, rim: 0.4 });
      part(A.spine, { color: paint, spec: 1.4, shine: 90 });
      part(A.edges, { color: paint.map(v => v * 0.4 + 0.6), emissive: paint.map(v => v * 1.6 + 0.3), noShadow: true });
      // engines: a hot core plus a long flame that grows with speed
      for (const sx of [-0.62, 0.62]) {
        const wp = M.xform(m, [sx, -0.1, 1.62]);
        E.sprite(wp, (0.6 + engine * 0.6) * scale, [0.45, 0.7, 1], 0.9, true);
        E.sprite(wp, (0.3 + engine * 0.15) * scale, [1, 1, 1], 0.9, true);
        E.sprite([wp[0], wp[1], wp[2] + (0.7 + engine * 0.6) * scale], (0.32 + engine * 0.1) * scale, hot ? [1, 0.6, 0.25] : [0.4, 0.65, 1], 0.75, true, 0, null, [0, 0, (0.7 + engine * 1.1) * scale]);
        if (hot) E.sprite([wp[0], wp[1], wp[2] + 0.6 * scale], (1.2 + engine) * scale, [1, 0.55, 0.2], 0.5 * engine, true);
      }
      // blinking nav lights on the wingtips (red left, green right) and the cannon muzzles
      const blink = 0.55 + 0.45 * Math.sin(st.clock * 7 + pos[0]);
      E.sprite(M.xform(m, [-2.62, -0.1, -0.42]), 0.55 * scale, [1, 0.25, 0.3], 0.8 * blink, true);
      E.sprite(M.xform(m, [2.62, -0.1, -0.42]), 0.55 * scale, [0.3, 1, 0.45], 0.8 * blink, true);
    }
    const ROCK_INK = { color: [0.12, 0.03, 0.02], unlit: true, outline: 0.07, noShadow: true };
    function render(w, h){
      const M = E.M, gal = st.gal, gi = st.gi, p = st.p;
      ensureGalaxy(gi);
      const shake = st.shake > 0 && !reduceMotion ? [(Math.random() - .5) * st.shake * 0.02, (Math.random() - .5) * st.shake * 0.02] : [0, 0];
      const fovBoost = Math.min(0.25, Math.max(0, (st.speed - st.base * 0.9) / st.base) * 0.4);
      const camP = [p.x * 0.6 + shake[0], p.y * 0.6 + 2.7 + shake[1], 10.5];
      E.begin({ pos: camP, target: [p.x * 0.85, p.y * 0.8 + 0.7, -20], fov: 1.0 + fovBoost, near: 0.2, far: 2400 }, {
        sunDir: [-0.6, -0.4, -0.7], toon: 0.55, sunColor: gal.sun.map(v => v * 3.1 * (gal.sunGlow || 1)), ambSky: [0.16, 0.17, 0.24], ambGround: [0.08, 0.07, 0.1],
        fogColor: [0.02, 0.02, 0.04], fogDensity: 0.0026, fogStart: 140,
        sky: { tex: SKY[gi], texBright: gal.skyBright || 3.0, sunColor: gal.sun.map(v => v * 1.6 * (gal.sunGlow || 1)), sunSize: 3 },
        post: { bloom: (gal.bloom || 0.75) * 0.8, threshold: gal.bloom ? 0.88 : 0.84, saturation: 1.2, contrast: 1.1, vignette: 0.3 },
      });
      const pp = [-300, 90, -1150], pr = 170;
      E.draw(A.sphere, M.trs(pp, [0.2, st.planetSpin + st.clock * 0.01, 0.15], pr), { tex: PLAN[gi], color: [0.5, 0.5, 0.54].map(v => v * (gal.planetDim || 1)), spec: gal.planet === 'earth' ? 0.4 : 0.1, shine: 30, rim: 0.8, fogless: true, emissive: gal.planet === 'lava' ? [0.25, 0.08, 0.02] : [0, 0, 0] });
      E.draw(A.sphere, M.trs(pp, [0, 0, 0], pr * 1.035), { color: gal.pc[0].map(v => v * 0.9 + 0.1), alpha: 0.2, additive: true, rim: 3, spec: 0, fogless: true, noShadow: true });
      if (gal.ring) E.draw(A.planetRing, M.trs(pp, [0.35, 0.3, -0.25], pr), { color: gal.pc[2], alpha: gal.ringA || 0.55, spec: 0.1, fogless: true, doubleSided: true, noShadow: true });
      for (let k=0;k<9;k++) { const a = k * 2.4 + gi, rr = 380 + (k % 3) * 120, col = gal.neb[k % 3].map(v => Math.min(1, v * 0.9 + 0.08)); E.sprite([camP[0] + Math.cos(a) * rr, camP[1] + Math.sin(a * 1.7) * 140 + 40, -900 - (k % 4) * 120], 520 + (k % 3) * 160, col, 0.13, true); }
      for (const s of STARS) E.sprite([camP[0] + s.d[0] * 900, camP[1] + s.d[1] * 900, camP[2] + s.d[2] * 900], s.size, s.c, s.a, true);
      for (const s of STARS) if (s.flare) E.sprite([camP[0] + s.d[0] * 900, camP[1] + s.d[1] * 900, camP[2] + s.d[2] * 900], s.size * 7, s.c, 0.25, true);
      for (const q of st.dust) { const len = Math.min(6, st.speed * 0.05); E.sprite([q.x, q.y, q.z], 0.05 + len * 0.01, [0.8, 0.85, 1], 0.4, true, 0, null, [0, 0, len * 0.5 + 0.04]); }
      const fz = -(st.length - st.d);
      if (fz > -VIEW && fz < 12) {
        for (const sx of [-1, 1]) {
          E.draw(A.cyl, M.trs([sx * (XR + 2), 0, fz], [0, 0, 0], [0.9, 16, 0.9]), { color: [0.75, 0.78, 0.84], spec: 0.9, shine: 60 });
          E.draw(A.sphere, M.trs([sx * (XR + 2), YR + 4.8, fz], [0, 0, 0], 0.8), { color: [1, 0.85, 0.3], emissive: [3, 2.2, 0.6] });
          E.sprite([sx * (XR + 2), YR + 4.8, fz], 5, [1, 0.8, 0.3], 0.7, true);
        }
        E.draw(A.box, M.trs([0, YR + 3.4, fz], [0, 0, 0], [XR * 2 + 4, 1.4, 0.2]), { tex: A.checker, uvScale: [6, 1], spec: 0.2, emissive: [0.15, 0.15, 0.15] });
      }
      for (const o of st.objs) {
        const z = -rel(o); if (z < -VIEW || z > 12) continue;
        if (o.kind === 'rock') {
          // bright, outlined rocks with a hot orange warning glow behind them, so they pop out of the busy sky
          const rm = M.trs([o.x, o.y, z], o.rot, o.r);
          E.draw(A.rocks[o.m], rm, { tex: A.tRock, color: [1.25, 1.05, 0.85], emissive: [0.16, 0.07, 0.03], spec: 0.35, shine: 18, rim: 1.2, uvScale: [2, 2] });
          E.draw(A.rocks[o.m], rm, ROCK_INK);
          const near = Math.max(0, Math.min(1, (z + 200) / 160));
          E.sprite([o.x, o.y, z - o.r * 0.9], o.r * (3.2 + near * 0.8), [1, 0.38, 0.12], 0.22 + near * 0.18, true);
        }
        else if (o.kind === 'star') {
          E.draw(A.star, M.trs([o.x, o.y, z], [0, st.clock * 3 + o.d, 0], 1), { color: [1, 0.78, 0.2], emissive: [0.9, 0.6, 0.1], spec: 1.2, shine: 80 });
          E.sprite([o.x, o.y, z], 2.6, [1, 0.8, 0.3], 0.5, true);
        } else if (o.kind === 'pow') {
          const c = hex(POWERS[o.type].color);
          E.draw(A.sphere, M.trs([o.x, o.y, z], [0, st.clock, 0], 0.75), { color: c, emissive: c.map(v => v * 1.4), spec: 1, shine: 90 });
          E.draw(A.sphere, M.trs([o.x, o.y, z], [0, 0, 0], 1.05), { color: [1, 1, 1], alpha: 0.18, rim: 3, spec: 1, noShadow: true });
          E.sprite([o.x, o.y, z], 4, c, 0.6, true);
        } else if (o.kind === 'gate') {
          const c = o.used ? [0.3, 0.5, 0.6] : [0.35, 0.9, 1];
          E.draw(A.ring, M.trs([o.x, o.y, z], [Math.PI / 2, 0, st.clock], 1), { color: c, emissive: o.used ? [0.1, 0.2, 0.3] : [0.6, 2.2, 3], spec: 1 });
          if (!o.used) E.sprite([o.x, o.y, z], 7, [0.35, 0.85, 1], 0.35, true);
        }
      }
      for (const r of st.rivals) { const z = -(r.d - st.d); if (z < -VIEW || z > 1.5) continue; drawShip(M, [r.x, r.y, z], [0, 0, (r.tx - r.x) * 0.05], 0.95, hex(r.color), r.boostT > 0 ? 1.4 : 0.7, r.boostT > 0); }
      for (const b of st.bolts) E.sprite([b.x, b.y, b.z], 0.35, [1, 0.35, 0.45], 1, true, 0, null, [0, 0, 2.2]);
      const inv = st.inv > 0 && Math.floor(st.inv * 12) % 2;
      const sc = st.fx.mini > 0 ? 0.55 : 1;
      if (!inv) drawPlayerShip(M, [p.x, p.y, 0], [p.y * 0.04 + (p.ty - p.y) * 0.08, 0, p.bank * 0.6], sc, ({ ship_red: [1, 0.2, 0.18], ship_blue: [0.35, 0.78, 1], ship_gold: [1, 0.8, 0.2] })[PB.meta && PB.meta.look('racer', 'paint')] || [1, 0.55, 0.15], st.fx.turbo > 0 ? 1.6 : st.boost > 0 ? 1.1 : 0.55, st.fx.turbo > 0 || st.boost > 0);
      for (const t of st.trail) E.sprite(t.p, t.size, st.fx.turbo > 0 ? [1, 0.6, 0.25] : [0.45, 0.7, 1], t.life * 0.5, true);
      if (st.fx.shield > 0) E.draw(A.sphere, M.trs([p.x, p.y, 0], [0, st.clock, 0], 2.3 * sc), { color: [0.4, 0.85, 1], alpha: 0.16, additive: true, rim: 4, spec: 1, noShadow: true });
      for (const q of st.parts) E.sprite(q.p, q.size * (0.5 + q.life), q.color, Math.min(1, q.life * 1.6), true);
      E.end();
    }
    function drawOrb2D(g, type, x, y, r){
      const P = POWERS[type];
      g.save(); g.shadowColor = P.color; g.shadowBlur = 14;
      const grd = g.createRadialGradient(x - r*0.3, y - r*0.3, 2, x, y, r); grd.addColorStop(0, '#fff'); grd.addColorStop(.35, P.color); grd.addColorStop(1, PB.shade(P.color, -0.4));
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
      g.fillStyle = '#fff'; g.font = `${Math.round(r * 0.75)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText({ turbo:'\u00bb', shield:'\u25ef', magnet:'\u2605', blaster:'\u205e', mini:'m', life:'\u2665' }[type], x, y + 1);
    }
    // ---------- power-ups from the Swag Shop (buttons along the bottom) ----------
    const SHOP_FX = { r_turbo: 'turbo', r_shield: 'shield', r_blaster: 'blaster' };
    const boostList = () => (PB.meta && PB.meta.boostsFor && PB.meta.boostsFor('racer')) || [];
    const boostN = id => (PB.meta && PB.meta.boostCount) ? PB.meta.boostCount(id) : 0;
    const BAR_Y = H - 52, BAR_R = 25, boostX = i => W / 2 - 10 + (i - 1.5) * 72;
    const racing = () => st.phase === 'play' && !st.msg && st.count <= 0 && st.between == null && !st.finished;
    function boostAt(x, y){ const L = boostList(); for (let i=0;i<L.length;i++) if (Math.hypot(x - boostX(i), y - BAR_Y) < BAR_R + 8) return L[i]; return null; }
    function pressBoost(b){
      const say = (t, c) => pop([st.p.x, st.p.y + 1.5, -3], t, c, 1.3);
      if (boostN(b.id) <= 0) { say('Get more in the Swag Shop!', '#ffd23f'); if (PB.sfx) PB.sfx('nope'); return; }
      const fx = SHOP_FX[b.id];
      if (b.id === 'r_heart' && st.lives >= MAX_LIVES) { say('Hearts are full!', '#ff8fc4'); if (PB.sfx) PB.sfx('nope'); return; }
      if (fx && st.fx[fx] > 1) { say('Already on!', POWERS[fx].color); if (PB.sfx) PB.sfx('nope'); return; }
      if (!PB.meta.useBoost(b.id)) return;
      if (b.id === 'r_heart') { st.lives++; say('+1 heart!', '#ff3d6e'); }
      else { st.fx[fx] = POWERS[fx].time; say(POWERS[fx].name + '!', POWERS[fx].color); }
      st.boostFlash = { id: b.id, t: 0.6 }; if (PB.sfx) PB.sfx('power');
    }
    function drawBoosts(){
      const L = boostList(); if (!L.length || st.phase !== 'play') return;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const x0 = boostX(0) - BAR_R - 12, x1 = boostX(L.length - 1) + BAR_R + 12;
      ctx.fillStyle = 'rgba(20,12,70,.6)'; ctx.beginPath(); ctx.roundRect(x0, BAR_Y - BAR_R - 9, x1 - x0, BAR_R * 2 + 18, 24); ctx.fill();
      ctx.strokeStyle = 'rgba(127,232,255,.8)'; ctx.lineWidth = 2.5; ctx.stroke();
      const live = racing();
      L.forEach((b, i) => {
        const x = boostX(i), y = BAR_Y, n = boostN(b.id), fl = st.boostFlash && st.boostFlash.id === b.id ? st.boostFlash.t / 0.6 : 0, rr = BAR_R * (1 + fl * 0.2);
        if (fl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(x, y, 4, x, y, rr * 1.9); gg.addColorStop(0, 'rgba(150,230,255,.9)'); gg.addColorStop(1, 'rgba(80,160,255,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, rr * 1.9, 0, 7); ctx.fill(); ctx.restore(); }
        const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.4, 2, x, y, rr); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, b.sw[0]); g.addColorStop(1, b.sw[1]);
        ctx.globalAlpha = n > 0 && live ? 1 : 0.5;
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.font = `${Math.round(rr * 1.0)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(b.ic, x, y + 2);
        ctx.globalAlpha = 1;
        const bx = x + rr * 0.78, by = y - rr * 0.72; ctx.fillStyle = n > 0 ? '#ff3d6e' : '#2fb36b'; ctx.beginPath(); ctx.arc(bx, by, 10, 0, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.font = `12px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(n > 0 ? String(Math.min(n, 99)) : '+', bx, by + 1);
      });
      ctx.restore();
    }
    function drawHUD(){
      const g = st.gal;
      if (st.flash) { ctx.fillStyle = `rgba(255,220,180,${st.flash * 1.2})`; ctx.fillRect(0, 0, W, H); }
      const vg = ctx.createRadialGradient(W/2, H/2, H * 0.35, W/2, H/2, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (st.phase !== 'menu') {
        const place = 1 + st.rivals.filter(r => r.d > st.d).length;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,30,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; const hp = ctx.createLinearGradient(0, 10, 0, 106); hp.addColorStop(0, 'rgba(70,60,190,.92)'); hp.addColorStop(1, 'rgba(30,20,90,.92)'); ctx.fillStyle = hp; ctx.beginPath(); ctx.roundRect(8, 10, 262, 98, 20); ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#7fe8ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(8, 10, 262, 98, 20); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.roundRect(14, 14, 250, 20, 10); ctx.fill();
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `13px ${FONT}`; ctx.fillText(`${st.mode === 'daily' ? 'RACE' : 'LEVEL'} ${st.level} \u00b7 ${g.name.toUpperCase()}`, 18, 30);
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 8;
        ctx.font = `italic 40px ${FONT}`; ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#1a1050'; ctx.strokeText(st.finished ? PLACE[st.place - 1] : PLACE[place - 1], 18, 72); ctx.fillStyle = place === 1 ? '#ffd23f' : '#fff'; ctx.fillText(st.finished ? PLACE[st.place - 1] : PLACE[place - 1], 18, 72); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `13px ${FONT}`; ctx.fillText(`\u2605 ${st.raceStars}   ${Math.round(st.speed * 9)} km/h   ${Math.max(0, Math.ceil((st.length - st.d) / 10))}m to go`, 20, 94);
        const rx = W - 20, top = 40, bot = H - 60;
        ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(rx, top); ctx.lineTo(rx, bot); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(rx - 8, top - 2, 16, 4);
        const yOf = d => bot - (bot - top) * Math.max(0, Math.min(1, d / st.length));
        for (const r of st.rivals) { ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(rx, yOf(r.d), 5, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#ff9a3d'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rx, yOf(st.d), 7, 0, 7); ctx.fill(); ctx.stroke();
        let tx = 30;
        for (const k of ['turbo','shield','magnet','blaster','mini']) {
          if (st.fx[k] <= 0) continue;
          drawOrb2D(ctx, k, tx, 124, 13);
          ctx.strokeStyle = POWERS[k].color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, 124, 18, -Math.PI/2, -Math.PI/2 + Math.PI*2*st.fx[k]/POWERS[k].time); ctx.stroke();
          tx += 44;
        }
        for (const r of st.rivals) { const z = -(r.d - st.d); if (z > -120 && z < 4) { const sp = E.project([r.x, r.y - 1.2, z]); if (sp[2] < 1) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(r.name, sp[0], sp[1]); } } }
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (st.phase === 'play' && !st.msg && st.count > 0) {
        const n = Math.ceil(st.count - 0.2);
        ctx.save(); ctx.fillStyle = '#fff'; ctx.shadowColor = '#ff9a3d'; ctx.shadowBlur = 24; ctx.font = `italic 96px ${FONT}`;
        ctx.fillText(n > 0 ? n : 'GO!', W/2, H/2 - 60); ctx.restore();
      }
      for (const q of st.pops) {
        const sp = E.project(q.wp);
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.fillStyle = q.color; ctx.shadowColor = q.color; ctx.shadowBlur = 14; ctx.font = `italic 30px ${FONT}`;
        ctx.fillText(q.text, Math.max(90, Math.min(W - 90, sp[0])), sp[1] - 70 - q.rise); ctx.restore();
      }
      drawBoosts();
      if (st.msg && st.phase === 'play') {
        ctx.font = `18px ${FONT}`;
        const tw = Math.min(ctx.measureText(st.msg).width + 44, W - 30), y = H/2 + 40;
        ctx.fillStyle = 'rgba(8,4,32,.85)'; ctx.beginPath(); ctx.roundRect(W/2 - tw/2, y - 26, tw, 52, 26); ctx.fill();
        ctx.strokeStyle = '#ff9a3d'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(st.msg, W/2, y + 1, W - 60);
      }
    }
    function draw(){
      if (!loadAssets()) { ctx.fillStyle = '#05030f'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '700 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('This game needs a device with 3D graphics.', W/2, H/2); return; }
      E.resize(W, H, E.quality(1.5)); render(W, H);
      E.present(ctx, W, H);
      drawHUD();
    }
    function artTile(g){
      if (!loadAssets()) { g.fillStyle = '#120a30'; g.fillRect(0, 0, 240, 180); return; }
      const keep = st; fresh('classic', Math.random, 3, 'menu');
      st.objs.push(rock(-3.5, 1.2, 40, 1.6), rock(4.2, -1.4, 70, 2.2), { kind:'star', x: 0, y: 0.8, d: 22 }, { kind:'star', x: 0, y: 0.8, d: 30 }, { kind:'gate', x: 0.5, y: 0.5, d: 55 });
      st.rivals[0].d = 18; st.rivals[0].x = 2.5; st.rivals[1].d = 30; st.rivals[1].x = -3;
      st.speed = 60;
      E.resize(240, 180, 2); render(240, 180);
      g.drawImage(E.canvas, 0, 0, 240, 180);
      st = keep;
    }

    return {
      id:'racer', sfxScore:false, music:'racer', title:'GALAXY RACER', W, H, statLabel:'Place', maxLives: MAX_LIVES, type:'levels', levels:100, scoreLabel:'Races won', boardScore: (s, lvl) => lvl, boardFmt: n => `${fmt(n)} race${n === 1 ? '' : 's'} won`, levelScoreText: (s, win) => win ? `Race ${s} won!` : `Race ${s}`,
      get failTitle(){ return (st && st.failTitle) || 'Race lost'; }, dailyText:'Race as far as you can, one try a day',
      tile:{ order:6, name:'Galaxy Racer', kind:'Spaceship racing \u00b7 100 levels', art: artTile },
      controls: ['Drag anywhere to steer your ship up, down, left and right.', 'Dodge asteroids and grab gold stars for points.', 'Fly through glowing rings for a burst of speed.', 'Win 1st place to unlock the next level. Each level is a longer course.', 'You get 3 hearts per race. Finish without crashing for 3 stars.', 'Tap the buttons at the bottom to use Turbo, Force Field, Blasters or an Extra Heart. Get more in the Swag Shop!'],
      powers: Object.entries(POWERS).map(([k,p]) => ({ name:p.name, desc:p.desc, icon: g => drawOrb2D(g, k, 23, 14, 12) })),
      init(){ loadAssets(); },
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg, level){ const daily = mode === 'daily'; fresh(mode, rand, daily ? 3 : RACE_HEARTS, 'play', daily ? 1 : level); st.msg = daily ? `${st.gal.name} \u00b7 Tap to race` : `Level ${st.level} \u00b7 ${st.gal.name} \u00b7 Win 1st!`; },
      frame(dt){ update(dt); draw(); },
      hud(){ const pl = st.finished ? st.place : 1 + st.rivals.filter(r => r.d > st.d).length, won = st.level - 1 + (st.finished && st.place === 1 ? 1 : 0), best = Math.max(won, (PB.bestOf && PB.bestOf('racer')) || 0); return st.mode === 'daily' ? { lives: st.lives, stat: st.level, statLabel: 'Race', score: won } : { lives: st.lives, stat: PLACE[pl - 1], score: won, best }; },
      metrics(){ return { score: st.score, level: st.level, stars: st.stars }; },
      dailyGoals: [
        { text:'Collect {n} stars', m:'stars', n:[40, 60, 80] },
        { text:'Reach race {n}', m:'level', n:[3, 4] },
        { text:'Reach race {n} without crashing', m:'level', n:[2, 3], noHit:true },
      ],
      pointerDown(x, y){
        if (st.phase !== 'play') return;
        if (st.msg) { st.msg = null; st.count = st.count > 0 ? st.count : 2.6; return; }
        const bz = boostAt(x, y); if (bz) { st.drag = null; if (racing()) pressBoost(bz); return; }
        st.drag = { x, y, px: st.p.tx, py: st.p.ty };
      },
      pointerMove(x, y){
        if (!st.drag) return;
        st.p.tx = Math.max(-XR, Math.min(XR, st.drag.px + (x - st.drag.x) * 0.032));
        st.p.ty = Math.max(-YR, Math.min(YR, st.drag.py - (y - st.drag.y) * 0.03));
      },
      pointerUp(){ st.drag = null; },
      debug(){ return { st, race(l){ st.level = l; startRace(); st.msg = null; st.count = 0; } }; },
      key(e){
        if (st.msg && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); st.msg = null; return; }
        const m = { ArrowLeft:[-1.2,0], ArrowRight:[1.2,0], ArrowUp:[0,1], ArrowDown:[0,-1] }[e.key];
        if (m) { e.preventDefault(); st.p.tx = Math.max(-XR, Math.min(XR, st.p.tx + m[0])); st.p.ty = Math.max(-YR, Math.min(YR, st.p.ty + m[1])); }
      },
    };
  }
  PB.register(createRacer);
})();
