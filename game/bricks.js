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

    // ---------- stages: the background changes every 20 levels (and loops after the last one) ----------
    const STAGE_LEN = 20;
    const STAGES = [
      { name: 'Synthwave Sunset', icon: '\u{1F305}' },
      { name: 'Deep Space',       icon: '\u{1FA90}' },
      { name: 'Under the Sea',    icon: '\u{1F420}' },
      { name: 'Neon City',        icon: '\u{1F306}' },
      { name: 'Candy Land',       icon: '\u{1F36D}' },
      { name: 'Volcano Valley',   icon: '\u{1F30B}' },
      { name: 'Aurora Peaks',     icon: '\u{1F3D4}\uFE0F' },
      { name: 'Jungle Night',     icon: '\u{1F334}' },
    ];
    const stageOf = n => Math.floor((Math.max(1, n) - 1) / STAGE_LEN) % STAGES.length;
    const bgCache = [];
    function bgFor(i){
      if (!bgC) paintBg();
      if (!i) return bgC;
      if (bgCache[i]) return bgCache[i];
      const [c, g] = layer(W, H), R = PB.mulberry(900 + i);
      const grad = (y0, y1, stops) => { const q = g.createLinearGradient(0, y0, 0, y1); stops.forEach((col, k) => q.addColorStop(k / (stops.length - 1), col)); return q; };
      const glow = (x, y, r, col) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); };
      const stars = (n, maxY, col) => { for (let k = 0; k < n; k++) { g.fillStyle = col || `rgba(255,255,255,${0.3 + R() * 0.6})`; g.beginPath(); g.arc(R() * W, R() * maxY, R() < 0.1 ? 1.6 : 0.9, 0, 7); g.fill(); } };
      const ridge = (base, amp, step, fill, line) => { const pts = []; for (let x = 0; x <= W + step; x += step * (0.6 + R() * 0.8)) pts.push([x, base - R() * amp]); g.beginPath(); g.moveTo(0, H); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(W, H); g.closePath(); g.fillStyle = fill; g.fill(); if (line) { g.save(); g.strokeStyle = line; g.lineWidth = 1.6; g.shadowColor = line; g.shadowBlur = 8; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.restore(); } };
      if (i === 1) {          // deep space: nebula clouds, a ringed planet and a little moon
        g.fillStyle = grad(0, H, ['#02030f', '#0b0f2e', '#060418']); g.fillRect(0, 0, W, H);
        glow(120, 180, 220, 'rgba(150,60,255,.28)'); glow(380, 320, 240, 'rgba(30,200,220,.18)'); glow(260, 80, 160, 'rgba(255,70,170,.16)');
        stars(260, H);
        const px = 370, py = 470, pr = 78; glow(px, py, pr * 2, 'rgba(255,150,80,.25)');
        g.save(); g.beginPath(); g.arc(px, py, pr, 0, 7); g.clip(); g.fillStyle = grad(py - pr, py + pr, ['#ffb36b', '#ff6a3d', '#8a1f5a']); g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        g.globalAlpha = 0.25; g.fillStyle = '#fff'; for (let k = 0; k < 5; k++) g.fillRect(px - pr, py - pr + 20 + k * 30, pr * 2, 6); g.restore();
        g.save(); g.strokeStyle = 'rgba(255,220,180,.7)'; g.lineWidth = 5; g.beginPath(); g.ellipse(px, py, pr * 1.7, pr * 0.42, -0.3, 0, 7); g.stroke(); g.restore();
        g.fillStyle = '#c9cfe8'; g.beginPath(); g.arc(90, 520, 26, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,30,.35)'; g.beginPath(); g.arc(100, 515, 26, 0, 7); g.fill();
      } else if (i === 2) {   // under the sea: light rays, bubbles, coral and swaying weed
        g.fillStyle = grad(0, H, ['#0a4a7a', '#04304f', '#011526']); g.fillRect(0, 0, W, H);
        g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 6; k++) { const x = 40 + k * 80 + R() * 30; g.fillStyle = 'rgba(160,230,255,.05)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x + 130, H * 0.8); g.lineTo(x + 50, H * 0.8); g.closePath(); g.fill(); } g.restore();
        g.fillStyle = grad(H - 90, H, ['#c9a86a', '#7a5a30']); g.beginPath(); g.moveTo(0, H - 60); for (let x = 0; x <= W; x += 40) g.lineTo(x, H - 66 + Math.sin(x * 0.03) * 10); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
        for (let k = 0; k < 9; k++) { const x = 20 + k * 55 + R() * 20, h = 80 + R() * 120; g.strokeStyle = ['#1f9a5a', '#2fbf6a', '#178a7a'][k % 3]; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, H - 60); for (let y = 0; y < h; y += 10) g.lineTo(x + Math.sin(y * 0.06 + k) * 12, H - 60 - y); g.stroke(); }
        for (const [x, col] of [[70, '#ff5f8f'], [250, '#ff9a3d'], [410, '#c77dff']]) { g.fillStyle = col; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (k - 2) * 12, H - 70 - (k % 2) * 18, 14, 0, 7); g.fill(); } }
        for (let k = 0; k < 40; k++) { const x = R() * W, y = R() * H * 0.9, r = 2 + R() * 6; g.strokeStyle = 'rgba(200,240,255,.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, 7); g.fill(); }
      } else if (i === 3) {   // neon city: a skyline full of lit windows and neon signs
        g.fillStyle = grad(0, H, ['#050818', '#120a33', '#2a0f4a']); g.fillRect(0, 0, W, H); stars(80, H * 0.4);
        g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(380, 110, 34, 0, 7); g.fill(); glow(380, 110, 120, 'rgba(255,240,200,.15)');
        for (const [base, shade, lit] of [[H - 170, '#1a1440', 0.25], [H - 110, '#0f0b2a', 0.4], [H - 40, '#07051a', 0.55]]) {
          let x = -10; while (x < W) { const w = 40 + R() * 50, h = 80 + R() * 200; g.fillStyle = shade; g.fillRect(x, base - h, w, h + 200);
            for (let wy = base - h + 10; wy < base + 30; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 11) if (R() < lit) { g.fillStyle = R() < 0.7 ? 'rgba(255,214,120,.8)' : 'rgba(120,230,255,.8)'; g.fillRect(wx, wy, 5, 7); }
            x += w + 4; } }
        for (const [x, y, col, w] of [[60, 330, '#ff3ddc', 70], [300, 360, '#22e4ff', 90], [180, 410, '#ffd23f', 60]]) { g.save(); g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 14; g.lineWidth = 3; g.strokeRect(x, y, w, 22); g.restore(); }
        g.fillStyle = grad(H - 40, H, ['rgba(255,61,220,.25)', 'rgba(7,5,26,1)']); g.fillRect(0, H - 40, W, 40);
      } else if (i === 4) {   // candy land at dusk: lollipops, candy canes and cotton-candy clouds
        g.fillStyle = grad(0, H, ['#2a0f45', '#7a2a80', '#ff7ab8']); g.fillRect(0, 0, W, H); stars(60, H * 0.35);
        for (let k = 0; k < 5; k++) { const x = R() * W, y = 60 + R() * 220; g.fillStyle = 'rgba(255,190,230,.35)'; for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(x + j * 22, y + (j % 2) * 6, 20, 0, 7); g.fill(); } }
        ridge(H - 70, 40, 60, '#5a1f6a');
        for (const [x, r, a, b] of [[70, 34, '#ff3d6e', '#fff'], [220, 26, '#22e4ff', '#fff'], [400, 40, '#ffd23f', '#ff7a2a']]) { g.fillStyle = '#f2e6ff'; g.fillRect(x - 3, H - 70 - r * 3, 6, r * 3); g.save(); g.translate(x, H - 70 - r * 3); g.fillStyle = a; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.strokeStyle = b; g.lineWidth = 4; g.beginPath(); for (let t = 0; t < 14; t += 0.2) g.lineTo(Math.cos(t) * t * r / 14, Math.sin(t) * t * r / 14); g.stroke(); g.restore(); }
        for (const x of [140, 320]) { g.save(); g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x, H - 60); g.lineTo(x, H - 170); g.arc(x + 16, H - 170, 16, Math.PI, 0); g.stroke(); g.setLineDash([8, 8]); g.strokeStyle = '#ff3d6e'; g.stroke(); g.restore(); }
      } else if (i === 5) {   // volcano valley: a glowing crater, lava rivers and embers
        g.fillStyle = grad(0, H, ['#12020a', '#3a0810', '#6a1208']); g.fillRect(0, 0, W, H);
        glow(240, 330, 260, 'rgba(255,90,20,.25)');
        g.fillStyle = '#1a0808'; g.beginPath(); g.moveTo(40, H); g.lineTo(200, 340); g.lineTo(280, 340); g.lineTo(440, H); g.closePath(); g.fill();
        glow(240, 340, 90, 'rgba(255,160,40,.7)'); g.fillStyle = '#ffb02e'; g.fillRect(200, 336, 80, 8);
        g.save(); g.strokeStyle = '#ff6a1a'; g.shadowColor = '#ff6a1a'; g.shadowBlur = 12; g.lineWidth = 5; for (const dx of [-30, 10, 34]) { g.beginPath(); g.moveTo(240 + dx * 0.5, 344); for (let y = 344; y < H; y += 20) g.lineTo(240 + dx * (1 + (y - 344) / 90) + Math.sin(y * 0.05) * 8, y); g.stroke(); } g.restore();
        ridge(H - 30, 60, 50, '#0c0303', 'rgba(255,90,30,.6)');
        for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(255,${120 + R() * 100 | 0},40,${0.4 + R() * 0.5})`; g.fillRect(R() * W, R() * H * 0.8, 2, 2); }
      } else if (i === 6) {   // aurora peaks: dancing northern lights over snowy mountains
        g.fillStyle = grad(0, H, ['#020a1c', '#06203a', '#0a2a3a']); g.fillRect(0, 0, W, H); stars(160, H * 0.6);
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const [y0, col] of [[120, 'rgba(60,255,170,'], [190, 'rgba(80,180,255,'], [150, 'rgba(200,90,255,']]) for (let x = 0; x < W; x += 3) { const y = y0 + Math.sin(x * 0.02 + y0) * 40, h = 90 + Math.sin(x * 0.05) * 40; const q = g.createLinearGradient(0, y, 0, y + h); q.addColorStop(0, col + '0)'); q.addColorStop(0.3, col + '.2)'); q.addColorStop(1, col + '0)'); g.fillStyle = q; g.fillRect(x, y, 3, h); }
        g.restore();
        // snowy mountains: dark slopes with white caps
        for (const [y0, col, n] of [[H - 230, '#2a3f66', 4], [H - 150, '#18284a', 5]]) for (let k = 0; k < n; k++) {
          const x = (k + 0.3 + R() * 0.4) * W / (n - 1), h = 110 + R() * 90, hw = 90 + R() * 50, top = y0 - h + 120;
          g.fillStyle = col; g.beginPath(); g.moveTo(x - hw, H); g.lineTo(x, top); g.lineTo(x + hw, H); g.closePath(); g.fill();
          g.fillStyle = 'rgba(235,248,255,.9)'; g.beginPath(); g.moveTo(x, top); g.lineTo(x - hw * 0.28, top + 44); g.lineTo(x - hw * 0.1, top + 36); g.lineTo(x + hw * 0.05, top + 48); g.lineTo(x + hw * 0.28, top + 44); g.closePath(); g.fill(); }
        g.fillStyle = grad(H - 60, H, ['#d8ecff', '#9fc4e8']); g.beginPath(); g.moveTo(0, H - 40); for (let x = 0; x <= W; x += 30) g.lineTo(x, H - 44 + Math.sin(x * 0.04) * 6); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      } else {                // jungle night: big leaves, fireflies and a full moon
        g.fillStyle = grad(0, H, ['#021208', '#06240f', '#0a2a14']); g.fillRect(0, 0, W, H); stars(50, H * 0.3);
        g.fillStyle = '#f2ffd8'; g.beginPath(); g.arc(120, 120, 40, 0, 7); g.fill(); glow(120, 120, 150, 'rgba(220,255,180,.15)');
        for (let k = 0; k < 14; k++) { const left = k % 2 === 0, x = left ? -20 + R() * 60 : W + 20 - R() * 60, y = 80 + R() * (H - 120), a = left ? -0.5 + R() * 0.6 : Math.PI + 0.5 - R() * 0.6, L = 80 + R() * 60;
          g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = ['#0f3a1a', '#145a22', '#0b2a12'][k % 3]; g.beginPath(); g.ellipse(L / 2, 0, L / 2, L / 6, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,220,120,.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(L, 0); g.stroke(); g.restore(); }
        ridge(H - 40, 30, 30, '#031006');
        for (let k = 0; k < 40; k++) glow(R() * W, 120 + R() * (H - 160), 6 + R() * 6, 'rgba(220,255,90,.7)');
      }
      g.fillStyle = 'rgba(5,4,20,.22)'; g.fillRect(0, 0, W, H);   // dim a touch so the bricks stand out
      bgCache[i] = c; return c;
    }

    const LAYOUTS = [
      (r,c,rows) => true,
      (r,c,rows) => (r + c) % 2 === 0 || r === 0,
      (r,c,rows) => c >= r/1.4 && c <= 7 - r/1.4,
      (r,c,rows) => Math.abs(c - 3.5) + Math.abs(r - (rows-1)/2) <= 4.2,
      (r,c,rows) => (c !== 3 && c !== 4) || r % 2 === 0,
    ];
    const ROWCOL = [N.pink, N.orange, N.yellow, N.lime, N.cyan, N.blue, N.violet, N.pink, N.orange];
    // ---------- 500 classic levels ----------
    // Each level is a little picture made of bricks (8 wide). Letters are colors; the level builder then mixes in
    // the special bricks as you go: TNT (level 5), steel you can't break (8), 3-hit bricks (12), sliding bricks (15)
    // and bricks that grow back (25). Difficulty follows the shared groups-of-10 pattern with HARD and SUPER HARD levels.
    const PAL = { p: N.pink, o: N.orange, y: N.yellow, g: N.lime, c: N.cyan, b: N.blue, v: N.violet, r: '#ff3b5c', w: '#e8ecff' };
    const PICS = [
      ['heart',    '.rr..rr.', 'rrrrrrrr', 'rrrwrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...'],
      ['smiley',   '..yyyy..', '.yyyyyy.', 'yybyybyy', 'yyyyyyyy', 'ybyyyyby', 'yybbbbyy', '.yyyyyy.', '..yyyy..'],
      ['rocket',   '...ww...', '..wwww..', '..wccw..', '..wwww..', '..wwww..', '.vwwwwv.', 'vv.ww.vv', '...oo...', '...yy...'],
      ['invader',  '..g..g..', '...gg...', '..gggg..', '.gg.g.g.', 'gggggggg', 'g.gggg.g', 'g.g..g.g', '...gg...'],
      ['star',     '...yy...', '...yy...', 'yyyyyyyy', '.yyyyyy.', '..yyyy..', '.yyyyyy.', 'yyy..yyy', 'yy....yy'],
      ['mushroom', '..rrrr..', '.rrwwrr.', 'rrwwrrrr', 'rrrrrwwr', 'rrrrrrrr', '..wwww..', '..wwww..', '..wwww..'],
      ['ghost',    '..vvvv..', '.vvvvvv.', 'vvwvvwvv', 'vvbvvbvv', 'vvvvvvvv', 'vvvvvvvv', 'vvvvvvvv', 'v.vv.vv.'],
      ['tree',     '...gg...', '..gggg..', '.gggggg.', '..gggg..', '.gggggg.', 'gggggggg', '...oo...', '...oo...'],
      ['fish',     '........', '..cccc.c', '.cccccccc'.slice(0, 8), 'cwcccccc', 'cccccccc', '.cccccc.', '..cccc.c', '........'],
      ['cat',      'o......o', 'oo....oo', 'oooooooo', 'ogooogoo', 'oooooooo', 'ooopoooo', '.oooooo.', '..o..o..'],
      ['house',    '...rr...', '..rrrr..', '.rrrrrr.', 'rrrrrrrr', '.wwwwww.', '.wbwwbw.', '.wwwoww.', '.wwwoww.'],
      ['diamond',  '...cc...', '..cccc..', '.ccwccc.', 'cccccccc', '.cccccc.', '..cccc..', '...cc...'],
      ['crown',    'y..y..y.', 'yy.yy.yy', 'yyyyyyyy', 'yryybyyr', 'yyyyyyyy', 'yyyyyyyy'],
      ['flower',   '..pp.pp.', '.pppppp.', '..pyyp..', '.pppppp.', '..pp.pp.', '...gg...', '.g.gg...', '..ggg...'],
      ['sun',      'y..yy..y', '.y.yy.y.', '..oooo..', 'yyooooyy', 'yyooooyy', '..oooo..', '.y.yy.y.', 'y..yy..y'],
      ['icecream', '..pppp..', '.pwpppp.', '.pppppp.', '..cccc..', '..oooo..', '...oo...', '...oo...'],
      ['robot',    '...ww...', '.wwwwww.', '.wcwwcw.', '.wwwwww.', '..wrrw..', 'bbbbbbbb', 'b.bbbb.b', '..b..b..'],
      ['planet',   '..vvvv..', '.vvvvvvy', 'vvvvvyy.', 'vvvyyvv.', '.yyvvvv.', 'yy.vvv..', '........'],
      ['car',      '........', '..rrrr..', '.rwrrwr.', 'rrrrrrrr', 'rrrrrrrr', '.bb..bb.', '.bb..bb.'],
      ['umbrella', '..vvvv..', '.vpvvpv.', 'vvvvvvvv', 'v..y...v', '...y....', '...y....', '.y.y....', '..yy....'],
      ['pyramid',  '...oo...', '..oooo..', '..oyyo..', '.oooooo.', '.oyoyoo.', 'oooooooo', 'oyoooyoo'],
      ['bunny',    '.w....w.', '.wp..pw.', '.wp..pw.', '.wwwwww.', 'wwbwwbww', 'wwwppwww', '.wwwwww.', '..w..w..'],
      ['checker',  'pcpcpcpc', 'cpcpcpcp', 'pcpcpcpc', 'cpcpcpcp', 'pcpcpcpc', 'cpcpcpcp'],
      ['rainbow',  'rrrrrrrr', 'oooooooo', 'yyyyyyyy', 'gggggggg', 'cccccccc', 'bbbbbbbb', 'vvvvvvvv'],
      ['frame',    'vvvvvvvv', 'v......v', 'v.pppp.v', 'v.pyyp.v', 'v.pyyp.v', 'v.pppp.v', 'v......v', 'vvvvvvvv'],
      ['zigzag',   'g.......', 'gg......', '.gg....c', '..gg..cc', '...gccc.', '..cc.gg.', '.cc...gg', 'cc.....g'],
    ];
    const SWAP = ['pocygbvrw', 'cbvpoygrw', 'gyobcvprw', 'vpcgybory'];   // color swaps so repeated pictures look new
    const FIRST = { tnt: 5, steel: 8, tough3: 12, mover: 15, regrow: 25 };
    const NEW_MSG = { 5: 'NEW! TNT bricks blow up the bricks around them', 8: "NEW! Steel bricks can't break. Bounce around them!", 12: 'NEW! Gold bricks take 3 hits', 15: 'NEW! Some bricks slide back and forth', 25: 'NEW! Ghost bricks grow back once. Break them twice!' };
    function levelBricks(n){
      const R = PB.mulberry(PB.seedFrom('bricks-level-' + n)), c = PB.levels.challenge(n), tier = PB.levels.tier(n);
      const cols = 8, bw = 52, bh = 20, gap = 6, left = (W - (cols * bw + (cols - 1) * gap)) / 2;
      // every picture once in each run through the list, shuffled, with a color swap after the first time round
      const round = Math.floor((n - 1) / PICS.length), order = PB.shuffle(PICS.map((_, i) => i), PB.mulberry(PB.seedFrom('bricks-order-' + round)));
      const pic = PICS[n <= 3 ? [0, 1, 4][n - 1] : order[(n - 1) % PICS.length]], swap = round ? SWAP[(round - 1) % SWAP.length] : 'pocygbvrw';
      const rows = pic.slice(1).map(r => r.slice(0, 8).padEnd(8, '.')), top = 70 + Math.max(0, 8 - rows.length) * 8;
      const bricks = [], at = (r, col) => bricks.find(k => k.r === r && k.c === col);
      rows.forEach((row, r) => [...row].forEach((ch, col) => { if (ch === '.') return;
        const key = swap['pocygbvrw'.indexOf(ch)] || ch;
        bricks.push({ r, c: col, x: left + col * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, hp: 1, max: 1, color: PAL[key] || N.cyan, kind: 'normal' }); }));
      const pickFrom = list => list.splice(Math.floor(R() * list.length), 1)[0];
      // tougher bricks
      const p2 = n <= 3 ? 0 : Math.min(0.55, 0.06 + c * 0.55), p3 = n >= FIRST.tough3 ? Math.min(0.3, c * 0.32) : 0;
      for (const k of bricks) { const q = R(); if (q < p3) { k.hp = k.max = 3; k.kind = 'gold'; k.color = '#ffd23f'; } else if (q < p3 + p2) k.hp = k.max = 2; }
      // TNT: a few, inside the picture
      if (n >= FIRST.tnt) { const pool = bricks.filter(k => k.kind === 'normal'); for (let i = 0, nt = 1 + Math.round(c * 2) + (n === FIRST.tnt ? 1 : 0); i < nt && pool.length; i++) { const k = pickFrom(pool); Object.assign(k, { kind: 'tnt', hp: 1, max: 1, color: '#ff4a1c' }); } }
      // ghost bricks that grow back
      if (n >= FIRST.regrow) { const pool = bricks.filter(k => k.kind === 'normal' && k.max === 1); for (let i = 0, ng = Math.round(1 + c * 3); i < ng && pool.length; i++) Object.assign(pickFrom(pool), { kind: 'ghost', color: '#b9a8ff' }); }
      const below = top + rows.length * (bh + gap) + 10;
      // steel: a shield row under the picture with gaps to aim through (and a few steel bricks in harder pictures)
      if (n >= FIRST.steel && (n === FIRST.steel || R() < 0.35 + c * 0.6)) {
        const gapAt = Math.floor(R() * 6) + 1, wide = c > 0.55 ? 1 : 2;
        for (let col = 0; col < cols; col++) if (col < gapAt || col >= gapAt + wide) bricks.push({ r: 99, c: col, x: left + col * (bw + gap), y: below, w: bw, h: bh, hp: 1, max: 1, color: '#9aa3b8', kind: 'steel' });
        if (c > 0.45) { const pool = bricks.filter(k => k.kind === 'normal' && k.r !== 99); for (let i = 0, ns = Math.round((c - 0.45) * 8); i < ns && pool.length; i++) Object.assign(pickFrom(pool), { kind: 'steel', color: '#9aa3b8' }); }
      }
      // sliding bricks: a short row that glides from side to side under everything
      if (n >= FIRST.mover && (n === FIRST.mover || R() < 0.3 + c * 0.5)) {
        const y = below + (bricks.some(k => k.r === 99) ? bh + gap + 8 : 0), count = c > 0.5 ? 3 : 2;
        for (let i = 0; i < count; i++) { const x0 = 60 + i * 130; bricks.push({ r: 98, c: i, x: x0, x0, y, w: bw, h: bh, hp: c > 0.4 ? 2 : 1, max: c > 0.4 ? 2 : 1, color: N.cyan, kind: 'normal', move: { amp: 50 + c * 30, sp: 0.9 + c * 0.9, ph: i * 1.3 } }); }
      }
      return { bricks, c, tier, pic: pic[0] };
    }
    function newLevel(level){
      if (st.mode !== 'daily' && st.classic) return st.spec.bricks;
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
    const effLevel = () => st.classic ? (st.classic <= 3 ? st.classic : 1 + Math.round(st.spec.c * 12)) : st.level;
    const topSpeed = () => Math.min(640, (300 + Math.min(effLevel(), 12)*25) * 1.12);
    const startSpeed = () => 235 + Math.min(effLevel(), 12)*6;
    const RAMP_TIME = 75; // seconds in a level to reach top speed
    const baseSpeed = () => { const t = Math.min(1, (st.levelTime || 0) / RAMP_TIME); const e = t * t * (3 - 2 * t); return startSpeed() + (topSpeed() - startSpeed()) * e; };
    function fresh(mode, rand, lives, phase, classic){
      st = { mode, phase, score:0, level:1, lives, nextLife: LIFE_EVERY, rand, parts:[], pops:[], shards:[], rings:[], flash:0, shake:0, msg:null, classic: mode !== 'daily' && classic ? classic : 0, lost: 0, ghosts: [] };
      st.theme = st.classic ? stageOf(st.classic) : 0;
      if (st.classic) { st.spec = levelBricks(st.classic); st.level = st.classic; st.rand = PB.mulberry(PB.seedFrom('bricks-play-' + st.classic + '-' + Math.random())); }
      st.bricks = newLevel(1); st.bdirty = true; st.dropsLeft = st.classic ? (st.spec.tier === 'super' ? 2 : 3) : 2; st.time = 0; st.levelTime = 0;
      st.paddle = { x: W/2 - BASE_W/2, w: BASE_W, h: 14, y: PADDLE_Y };
      clearRound();
    }
    function clearRound(){ if (PB.sfx) PB.sfx('level');
      st.fx = { wide:0, laser:0, fire:0, slow:0, magnet:0, shrink:0 };
      st.drops = []; st.lasers = []; st.laserCD = 0; st.combo = 0; st.lastDrop = -99;
      st.balls = [{ x: W/2, y: st.paddle.y - 10, r: 9, vx: 0, vy: -baseSpeed(), held:true, off:0, trail:[] }];
    }
    function nextLevel(){
      addPoints(100 * st.level); st.level++; st.flash = 1; st.levelTime = 0; st.theme = Math.floor((st.level - 1) / 3) % STAGES.length;
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
      if (k.kind === 'steel') { k.hit = 0.15; if (PB.sfx) PB.sfx('tap'); return; }
      k.hp--; st.bdirty = true; k.hit = 0.3; st.lastBreak = st.time;
      if (k.hp <= 0 && k.kind === 'ghost' && st.classic && !k.back) st.ghosts.push({ k, t: 7 });
      if (k.hp <= 0 && k.kind === 'tnt') { k.boom = true; st.shake = Math.max(st.shake, 12); st.flash = 0.6; if (PB.sfx) PB.sfx('boom'); burst(k.x + k.w / 2, k.y + k.h / 2, N.orange, 30); pop(k.x + k.w / 2, k.y, 'BOOM!', N.orange, 1);
        st.rings.push({ x: k.x + k.w / 2, y: k.y + k.h / 2, r: 10, life: 0.4, color: N.orange });
        const near = st.bricks.filter(o => o !== k && o.hp > 0 && o.kind !== 'steel' && Math.abs(o.x - k.x) < 62 && Math.abs(o.y - k.y) < 30);
        const S0 = st; setTimeout(() => { if (st !== S0 || st.phase !== 'play') return; for (const o of near) if (o.hp > 0) { o.hp = 1; breakBrick(o); } }, 90); }
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
      if (st.classic) {
        for (const k of st.bricks) if (k.move && k.hp > 0) { k.x = Math.max(4, Math.min(W - k.w - 4, k.x0 + Math.sin(st.time * k.move.sp + k.move.ph) * k.move.amp)); st.bdirty = true; }
        for (const g of st.ghosts) { g.t -= dt; if (g.t <= 0 && st.bricks.some(o => o.hp > 0 && o.kind !== 'steel')) { g.k.hp = 1; g.k.hit = 0.4; g.k.back = true; st.bdirty = true; burst(g.k.x + g.k.w / 2, g.k.y + g.k.h / 2, '#b9a8ff', 10); } }
        st.ghosts = st.ghosts.filter(g => g.t > 0 && g.k.hp <= 0);
      }
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
            // if the ball has gone a while without breaking anything (stuck bouncing around steel), nudge its angle
            const stuck = st.time - (st.lastBreak || 0) > 10 ? (Math.random() - 0.5) * 0.6 : 0;
            const ang = Math.max(-1.1, Math.min(1.1, hit * 1.05 + stuck));
            b.vx = speed * Math.sin(ang); b.vy = -Math.abs(speed * Math.cos(ang)); b.y = p.y - b.r; if (PB.sfx) PB.sfx('tap');
          }
          continue;
        }
        for (const k of st.bricks) {
          if (k.hp <= 0) continue;
          const cx = Math.max(k.x, Math.min(b.x, k.x+k.w)), cy = Math.max(k.y, Math.min(b.y, k.y+k.h));
          const dx = b.x - cx, dy = b.y - cy;
          if (dx*dx + dy*dy <= b.r*b.r) {
            if (fx.fire > 0 && k.kind !== 'steel') { k.hp = 1; breakBrick(k); continue; }
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
        st.lives--; st.lost++; st.shake = 10;
        if (st.lives <= 0) {
          st.phase = 'over'; st.msg = null;
          if (st.classic) { const left = st.bricks.filter(k => k.hp > 0 && k.kind !== 'steel').length; shell.levelDone({ win: false, stars: 0, score: st.score, summary: `${left} brick${left === 1 ? '' : 's'} left. So close!` }); }
          else shell.gameOver(st.score, `You reached level ${st.level}`);
          return;
        }
        clearRound(); updatePaddleW(); st.msg = 'Oops! Tap to try again'; return;
      }
      if (st.bricks.every(k => k.hp <= 0 || k.kind === 'steel')) {
        if (!st.classic) return nextLevel();
        // a won level: stars for the balls you kept
        st.phase = 'over'; st.msg = null; st.flash = 1; if (PB.sfx) PB.sfx('level');
        const stars = st.lost === 0 ? 3 : st.lost === 1 ? 2 : 1; addPoints(200 + st.lives * 100);
        for (let i = 0; i < 4; i++) burst(80 + i * 110, 200, [N.pink, N.cyan, N.yellow, N.lime][i], 24);
        setTimeout(() => shell.levelDone({ win: true, stars, score: st.score, summary: st.lost === 0 ? 'Perfect! You never lost a ball' : `You lost ${st.lost} ball${st.lost === 1 ? '' : 's'}` }), 900);
      }
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
      const si = tile ? 0 : st.theme || 0; A3.tBgs = A3.tBgs || [];
      if (!A3.tBgs[si]) A3.tBgs[si] = E.texture(bgFor(si), { repeat: false });
      E.resize(W, H, tile ? 1 : E.quality(1.5));
      const sx = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0, sy = st.shake > 0 && !reduceMotion && !tile ? (Math.random() - .5) * st.shake : 0;
      E.begin({ ortho: [W, H], pos: [-sx, sy, 1500], target: [-sx, sy, 0] }, {
        noSky: true, sunDir: [0.42, -0.62, -0.66], sunColor: [1.35, 1.25, 1.45], ambSky: [0.3, 0.26, 0.44], ambGround: [0.16, 0.08, 0.2], toon: 0.35,
        shadow: { center: [W / 2, -H / 2, 0], radius: 420 },
        post: { bloom: 0.7, threshold: 0.8, saturation: 1.22, contrast: 1.08, vignette: 0.32 },
      });
      E.backdrop(A3.tBgs[si], W, H, { shadow: 0.45 });
      const bk = PB.meta && PB.meta.look('bricks', 'ball'), rb = h => [0.5 + 0.5 * Math.cos(6.28 * h), 0.5 + 0.5 * Math.cos(6.28 * (h - 0.33)), 0.5 + 0.5 * Math.cos(6.28 * (h - 0.67))];
      const ballCol = fx.fire > 0 ? [1, 0.55, 0.2] : bk === 'ball_pink' ? [1, 0.35, 0.75] : bk === 'ball_gold' ? [1, 0.8, 0.25] : bk === 'ball_rainbow' ? rb(clock * 0.6) : [0.35, 0.95, 1];
      for (const b of st.balls) E.light(P3(b.x, b.y, 34), ballCol.map(v => v * 2.2), 140);
      // bricks
      for (const k of st.bricks) {
        if (k.hp <= 0) continue;
        const c = hex3(k.color), wob = k.hit > 0 ? Math.sin(k.hit * 40) * k.hit * 0.5 : 0, s = 1 + (k.hit > 0 ? k.hit * 0.35 : 0);
        const m = M.trs(P3(k.x + k.w / 2, k.y + k.h / 2, 10), [0, 0, wob], [s, s, s]);
        if (k.kind === 'steel') {
          E.draw(A3.frame, m, { color: [0.5, 0.54, 0.64], spec: 2.4, shine: 150, rim: 0.4 });
          E.draw(A3.core, M.mul(m, M.trs([0, 0, 6])), { color: [0.62, 0.66, 0.76], spec: 2.2, shine: 160 });
          for (const [rx, ry] of [[-21, 6], [21, 6], [-21, -6], [21, -6]]) E.draw(A3.rivet, M.mul(m, M.trs([rx, ry, 7], [0, 0, 0], 2)), { color: [0.9, 0.92, 1], spec: 2, shine: 120, noShadow: true });
        } else if (k.kind === 'tnt') {
          const pu = reduceMotion ? 0.6 : 0.45 + 0.35 * Math.sin(clock * 8 + k.x);
          E.draw(A3.brick, m, { color: [0.75, 0.12, 0.05], emissive: [0.5 * pu, 0.08 * pu, 0], spec: 1.4, shine: 80, rim: 0.5 });
          E.draw(A3.core, M.mul(m, M.trs([0, 0, 7], [0, 0, 0], [0.9, 0.55, 1])), { color: [1, 0.85, 0.3], emissive: [0.6 * pu, 0.4 * pu, 0.05], spec: 0.6, noShadow: true });
        } else if (k.kind === 'ghost') {
          const sh = reduceMotion ? 0.6 : 0.45 + 0.25 * Math.sin(clock * 4 + k.y);
          E.draw(A3.brick, m, { color: [0.55, 0.5, 0.85], emissive: [0.25 * sh, 0.2 * sh, 0.5 * sh], spec: 1.6, shine: 100, rim: 1, alpha: 0.7, blend: true });
        } else if (k.max > 1) {
          E.draw(A3.frame, m, k.kind === 'gold' ? { color: [1, 0.78, 0.25], emissive: [0.15, 0.1, 0], spec: 2, shine: 120, rim: 0.5 } : { color: [0.78, 0.8, 0.88], spec: 1.6, shine: 90, rim: 0.5 });
          E.draw(A3.core, M.mul(m, M.trs([0, 0, 6])), { color: c, emissive: c.map(v => v * (k.hp < k.max ? 0.35 + 0.25 * Math.sin(clock * 14) : 0.6)), spec: 1.2, shine: 60 });
          for (const [rx, ry] of [[-21, 6], [21, 6], [-21, -6], [21, -6]]) E.draw(A3.rivet, M.mul(m, M.trs([rx, ry, 6], [0, 0, 0], 1.8)), { color: [1, 1, 1], spec: 2, shine: 100, noShadow: true });
          if (k.hp < k.max) E.draw(A3.quad, M.mul(m, M.trs([0, 0, 9.2], [0, 0, 0], [52, 20, 1])), { tex: A3.tCrack, blend: true, unlit: true, color: [1, 1, 1], noShadow: true });
        } else {
          // a glass case with a glowing neon core and a bright top highlight; a shimmer ripples across the rows
          const sh = reduceMotion ? 0.8 : 0.72 + 0.28 * Math.sin(clock * 3 - k.x * 0.03 + k.y * 0.05);
          E.draw(A3.brick, m, { color: c.map(v => v * 0.5 + 0.05), emissive: c.map(v => v * 0.06), spec: 1.8, shine: 120, rim: 0.7 });
          E.draw(A3.core, M.mul(m, M.trs([0, -1, 6])), { color: c, emissive: c.map(v => v * sh), spec: 0.6, shine: 40, noShadow: true });
          E.draw(A3.core, M.mul(m, M.trs([0, 6.5, 8.5], [0, 0, 0], [0.86, 0.16, 0.25])), { color: [1, 1, 1], emissive: [0.55, 0.55, 0.6], unlit: true, noShadow: true, alpha: 0.75 });
        }
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
        b.trail.forEach((t, i) => E.sprite(P3(t.x, t.y, 22), b.r * 2.6 * (1 - i / 11), bk === 'ball_rainbow' && !(fx.fire > 0) ? rb(clock * 0.6 + i * 0.09) : ballCol, (1 - i / 9) * 0.45, true));
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
      ctx.drawImage(bgFor(st.theme || 0), 0, 0, W, H);
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
    function brickMarks(){
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const k of st.bricks) {
        if (k.hp > 0 && k.kind === 'tnt') { ctx.font = `900 11px ${DISPLAY}`; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(60,0,0,.8)'; ctx.lineWidth = 3; ctx.strokeText('TNT', k.x + k.w / 2, k.y + k.h / 2 + 1); ctx.fillText('TNT', k.x + k.w / 2, k.y + k.h / 2 + 1); }
        if (k.hp > 0 && k.max >= 3) for (let i = 0; i < k.hp; i++) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(k.x + k.w / 2 + (i - (k.hp - 1) / 2) * 8, k.y + k.h / 2, 2.6, 0, 7); ctx.fill(); }
      }
      for (const g of st.ghosts) { const k = g.k; ctx.globalAlpha = 0.5; ctx.strokeStyle = '#b9a8ff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.roundRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2, 5); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#b9a8ff'; ctx.fillRect(k.x + 4, k.y + k.h - 4, (k.w - 8) * (1 - g.t / 7), 2); }
      ctx.restore();
    }
    function overlay2D(){
      const fx = st.fx; if (st.classic) brickMarks();
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
      id:'bricks', music:'bricks', touchAnywhere: true, title:'BRICK BASH', W, H, statLabel:'Bricks', maxLives: MAX_LIVES, type:'levels', levels: 500, scoreKey:'bb-scores',
      failTitle: 'Out of balls!', dailyText: 'Endless run: 3 lives, how far can you go?',
      reviveText: '+1 ball', reviveIcon: '\u{1F3D0}', reviveTitle: 'Out of balls!',
      revive(){ st.phase = 'play'; st.lives = 1; clearRound(); updatePaddleW(); st.msg = 'Keep going! Tap to launch'; },
      tile:{ order:1, name:'Brick Bash', kind:'Neon brick breaker \u00b7 500 levels', art(g){ if (!bgC) paintBg(); if (assets3D()) { const keep = st; fresh('classic', Math.random, 3, 'menu'); const b = st.balls[0]; b.held = false; b.x = 300; b.y = 330; for (let i=0;i<8;i++) b.trail.push({ x: 300 - i * 7, y: 330 + i * 9 }); draw3D(0, true); g.drawImage(E3.canvas, 0, 50 * E3.canvas.height / H, E3.canvas.width, 360 * E3.canvas.height / H, 0, 0, 240, 180); st = keep; return; } const { rr, dot } = PB; if (!bgC) paintBg(); g.drawImage(bgC, 0, 150, 480, 360, 0, 0, 240, 180); g.shadowBlur = 10; const cols=[N.pink,'#ff9f1c',N.yellow,N.lime]; for(let r=0;r<4;r++)for(let c=0;c<6;c++) rr(g,14+c*36,14+r*17,32,12,4,cols[r]); rr(g,88,156,64,9,5,N.cyan); const hg = g.createRadialGradient(150,120,1,150,120,26); hg.addColorStop(0,'rgba(34,228,255,.7)'); hg.addColorStop(1,'rgba(34,228,255,0)'); g.fillStyle = hg; g.fillRect(120,90,60,60); dot(g,150,120,7,'#fff'); } },
      controls: ['Slide your finger anywhere (the strip at the bottom is easiest) and the paddle follows.', 'Tap to launch the ball.', 'Break every brick to win the level. You have 3 balls: keep them all for 3 stars!', 'TNT bricks blow up their neighbors. Steel bricks never break. Gold bricks take 3 hits. Ghost bricks grow back!', 'Break bricks in a row without touching the paddle to multiply your points.'],
      powers: Object.entries(POWERS).map(([k,p]) => ({ name:p.name, desc:p.desc, icon: (g) => capsule(g, 0, 3, 46, 22, k, false) })),
      init(){ if (!bgC) paintBg(); assets3D(); },
      preview(){ fresh('classic', Math.random, 3, 'menu', 1); },
      start(mode, rand, lives, msg, level){
        const daily = mode === 'daily';
        fresh(mode, rand, daily ? 3 : 3, 'play', daily ? 0 : level);
        if (daily) { st.msg = 'Daily run \u00b7 Tap to launch'; return; }
        const t = st.spec.tier, tag = t === 'super' ? 'SUPER HARD! ' : t === 'hard' ? 'HARD! ' : '';
        const sg = STAGES[stageOf(level)], first = level > 1 && (level - 1) % STAGE_LEN === 0;
        st.msg = NEW_MSG[level] ? NEW_MSG[level] + ' \u00b7 Tap' : first ? `${sg.icon} Welcome to ${sg.name}! \u00b7 Tap` : `${tag}Level ${level} \u00b7 Tap to launch`;
      },
      frame(dt, clock){
        if (st.phase === 'play') { for (let i=0;i<3;i++) { step(dt/3); if (st.phase !== 'play') break; } }
        effects(dt); draw(clock);
      },
      mapSign(n){ const sg = STAGES[stageOf(n)]; return `${sg.icon} ${sg.name}`; },
      hud(){ return st.classic ? { lives: st.lives, stat: st.bricks.filter(k => k.hp > 0 && k.kind !== 'steel').length, score: st.score } : { lives: st.lives, stat: st.level, score: st.score, statLabel: 'Level' }; },
      debug(){ return { st, speed: baseSpeed, step, launch }; },
      metrics(){ return { score: st.score, level: st.level, won: st.classic && st.phase === 'over' && st.bricks.every(k => k.hp <= 0 || k.kind === 'steel') ? 1 : 0 }; },
      dailyGoals: [
        { text:'Beat {n} levels today', m:'won', n:[2, 3] },
        { text:'Score {n} points today', m:'score', n:[3000, 5000, 8000] },
        { text:'Beat a level without losing a ball', m:'perfect', n:[1] },
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
