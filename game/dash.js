(function(){
  const { fmt, reduceMotion, ctx, layer, dpr } = PB;
  // ===============================================================
  //  ZOOM DASH (3D city streets, rendered with PB.gl3d)
  // ===============================================================
  function createDash(shell){
    const W = 480, H = 860, LANE = 2.2, MAX_LIVES = 5, VIEW = 135;
    const TOON = '"Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    const POWERS = {
      magnet: { name:'Coin magnet',   color:'#16c2b4', time:10, weight:18, desc:'Pulls in coins from every lane' },
      shield: { name:'Skateboard',    color:'#3fa9ff', time:25, weight:16, desc:'Hop on a skateboard and cruise! It saves you from one crash' },
      balloon:{ name:'Balloon bunch', color:'#ff5fa2', time:6,  weight:12, desc:'Float up high and grab the coins in the sky' },
      double: { name:'Double coins',  color:'#ffb800', time:12, weight:16, desc:'Every coin counts twice' },
      zoom:   { name:'Zoom boots',    color:'#ff7a2f', time:5,  weight:11, desc:'Super speed! Smash through anything' },
      spring: { name:'Spring shoes',  color:'#4cc96a', time:10, weight:14, desc:'Mega high jumps' },
      slow:   { name:'Slow-mo',       color:'#9a6bff', time:8,  weight:12, desc:'Everything slows down' },
      gift:   { name:'Mystery box',   color:'#c77dff', time:0,  weight:13, desc:'A surprise inside: coins, a heart or a power-up!' },
      gold:   { name:'Gold rush',     color:'#ffc21a', time:10, weight:12, desc:'Extra coin trails pop up in every open lane' },
      giant:  { name:'Giant raccoon', color:'#ff5a4a', time:6,  weight:9,  desc:'Grow huge and stomp right through everything' },
      life:   { name:'Extra life',    color:'#ff3d6e', time:0,  weight:8,  desc:'Adds one heart (up to 5)' },
    };
    const FOODS = ['donut','cookie','chips','donut','cookie','chips','burger'];
    const DEPTH = { cone:0.8, can:0.9, bar:0.5, truck:4.6 };
    const BUS_H = 2.5, RAMP = 4.2, BUS_LEN = 11.5;
    
    let st = null, E = null, A = null; // A = assets (meshes, textures)

    // ---------- suburban "kids movie" look ----------
    const HOUSE_COLS = ['#ffcf5c','#6fd0f0','#ff9e8a','#9be07a','#fff3e0','#c7a6ff','#ffd84a','#7fb4ff'];
    const ROOF_COLS = ['#a8473a','#4a5f86','#6b4a3a','#3f6b5a','#8a3d5a','#5a5a66'];
    const DOOR_COLS = ['#c0392b','#2e6fb7','#2f8f5b','#f2b134','#7d3c98','#1f3a5f'];
    const VANS = ['#ff8a65','#4fc3f7','#ffd54f','#81c784','#ba68c8','#f06292'];
    // Every painted texture is drawn at double resolution (sc = 2) so the street stays crisp up close.
    const TEX_SCALE = 2;
    function canvas(w, h, fn, sc = TEX_SCALE){ const c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc); const g = c.getContext('2d'); g.scale(sc, sc); fn(g, w, h); return c; }
    function speckle(g, w, h, n, light, dark, rmax){ for (let i=0;i<n;i++) { g.fillStyle = Math.random() < 0.5 ? light : dark; const r = Math.random() * rmax; g.fillRect(Math.random() * w, Math.random() * h, r, r); } }
    function asphaltTex(){
      return canvas(512, 2048, (g, w, h) => {
        const R = PB.mulberry(77);
        g.fillStyle = '#474c58'; g.fillRect(0, 0, w, h);
        // soft tonal blotches so the road never looks flat
        for (let i=0;i<70;i++) { const x = R() * w, y = R() * h, r = 30 + R() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, r); const dk = R() < 0.5; gr.addColorStop(0, dk ? 'rgba(30,32,45,.18)' : 'rgba(150,140,130,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
        speckle(g, w, h, 40000, 'rgba(255,250,240,.07)', 'rgba(0,0,20,.10)', 2);
        const px = m => (m + 3.4) / 6.8 * w;
        // tire wear: slightly darker, smoother bands in each lane
        for (const lane of [-LANE, 0, LANE]) for (const o of [-0.55, 0.55]) { const gr = g.createLinearGradient(px(lane + o - 0.35), 0, px(lane + o + 0.35), 0); gr.addColorStop(0, 'rgba(20,20,30,0)'); gr.addColorStop(0.5, 'rgba(20,20,30,.12)'); gr.addColorStop(1, 'rgba(20,20,30,0)'); g.fillStyle = gr; g.fillRect(px(lane + o - 0.35), 0, px(0.7) - px(0), h); }
        // patched squares and tar-sealed cracks
        for (let i=0;i<0;i++) { const x = R() * (w - 120), y = R() * (h - 120), ww = 50 + R() * 90, hh = 60 + R() * 140; g.fillStyle = 'rgba(40,42,52,.35)'; g.fillRect(x, y, ww, hh); g.strokeStyle = 'rgba(20,20,26,.35)'; g.lineWidth = 2; g.strokeRect(x, y, ww, hh); }
        g.strokeStyle = 'rgba(22,22,28,.28)'; g.lineCap = 'round';
        for (let i=0;i<7;i++) { let x = R() * w, y = R() * h; g.lineWidth = 1.5 + R() * 1.5; g.beginPath(); g.moveTo(x, y); for (let k=0;k<6;k++) { x += (R() - .5) * 40; y += 10 + R() * 30; g.lineTo(x, y); } g.stroke(); }
        // dashed lane lines with a little wear
        for (const lx of [-LANE / 2, LANE / 2]) for (let y0 = 0; y0 < h; y0 += h / 4) { g.fillStyle = 'rgba(250,248,240,.92)'; g.beginPath(); g.roundRect(px(lx) - 5, y0 + 60, 10, 2.6 * 75, 5); g.fill(); g.fillStyle = 'rgba(84,90,102,.5)'; for (let k=0;k<20;k++) g.fillRect(px(lx) - 5 + R() * 10, y0 + 60 + R() * 195, 2, 2); }
        // double yellow edge lines
        for (const ex of [-3.2, 3.2]) { g.fillStyle = 'rgba(255,205,60,.95)'; g.fillRect(px(ex) - 7, 0, 5, h); g.fillRect(px(ex) + 2, 0, 5, h); }
        // gutter shadow by the curb
        for (const [a, b] of [[0, 26], [w, w - 26]]) { const gr = g.createLinearGradient(a, 0, b, 0); gr.addColorStop(0, 'rgba(20,20,30,.45)'); gr.addColorStop(1, 'rgba(20,20,30,0)'); g.fillStyle = gr; g.fillRect(Math.min(a, b), 0, 26, h); }
        // fine aggregate: tiny pebbles that catch the light
        speckle(g, w, h, 26000, 'rgba(255,255,255,.10)', 'rgba(10,10,20,.14)', 1.1);
      }, 1.5);
    }
    function manholeTex(){
      return canvas(128, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = '#3a3c44'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
        g.strokeStyle = '#5c5f6a'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
        g.lineWidth = 3; for (let r = 14; r < 50; r += 12) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); }
        for (let a=0;a<8;a++) { g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a * Math.PI / 4) * 50, 64 + Math.sin(a * Math.PI / 4) * 50); g.stroke(); }
      });
    }
    function crossTex(){
      return canvas(256, 64, (g, w, h) => { g.clearRect(0, 0, w, h); for (let x=8;x<w;x+=32) { g.fillStyle = 'rgba(250,248,240,.9)'; g.fillRect(x, 0, 18, h); g.fillStyle = 'rgba(84,90,102,.35)'; for (let k=0;k<12;k++) g.fillRect(x + Math.random() * 18, Math.random() * h, 2, 2); } });
    }
    // the side of a school bus: a row of windows, black trim and kid doodles
    function busSideTex(){
      return canvas(1024, 160, (g, w, h) => {
        g.fillStyle = '#ffcc33'; g.fillRect(0, 0, w, h);
        for (let x = 30; x < w - 60; x += 82) { g.fillStyle = '#2b2140'; g.fillRect(x - 4, 10, 74, 58); const gl = g.createLinearGradient(x, 14, x + 66, 64); gl.addColorStop(0, '#bfe6ff'); gl.addColorStop(1, '#4f86b8'); g.fillStyle = gl; g.fillRect(x, 14, 66, 50); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(x + 6, 58); g.lineTo(x + 30, 18); g.lineTo(x + 40, 18); g.lineTo(x + 16, 58); g.fill(); }
        g.fillStyle = '#1e1a22'; g.fillRect(0, 78, w, 8); g.fillRect(0, 96, w, 8);
        const doodle = [['#ff3d6e', 'heart'], ['#3fa9ff', 'star'], ['#7dff6a', 'smile'], ['#ff7a2f', 'star'], ['#c77dff', 'heart']];
        for (let k=0;k<7;k++) { const [c, t] = doodle[k % doodle.length], cx = 90 + k * 135, cy = 132; g.fillStyle = c; g.strokeStyle = '#2b2140'; g.lineWidth = 4;
          g.beginPath();
          if (t === 'star') for (let i=0;i<10;i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 20; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
          else if (t === 'heart') { g.moveTo(cx, cy + 16); g.bezierCurveTo(cx - 28, cy - 4, cx - 12, cy - 22, cx, cy - 8); g.bezierCurveTo(cx + 12, cy - 22, cx + 28, cy - 4, cx, cy + 16); }
          else g.arc(cx, cy, 17, 0, 7);
          g.closePath(); g.stroke(); g.fill();
          if (t === 'smile') { g.fillStyle = '#2b2140'; g.beginPath(); g.arc(cx - 6, cy - 4, 3, 0, 7); g.arc(cx + 6, cy - 4, 3, 0, 7); g.fill(); g.beginPath(); g.arc(cx, cy + 2, 9, 0.2, Math.PI - 0.2); g.stroke(); } }
      });
    }
    function walkTex(){
      return canvas(256, 256, (g, w, h) => {
        g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, w, h);
        for (let i=0;i<10;i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < .5 ? 'rgba(120,100,70,.10)' : 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
        speckle(g, w, h, 6000, 'rgba(255,255,255,.14)', 'rgba(110,90,60,.08)', 2);
        g.fillStyle = 'rgba(130,110,80,.45)'; for (let y=0;y<=h;y+=128) g.fillRect(0, y, w, 3);
        g.fillStyle = 'rgba(255,255,255,.35)'; for (let y=3;y<=h;y+=128) g.fillRect(0, y, w, 2);
      });
    }
    function grassTex(){
      return canvas(256, 256, (g, w, h) => {
        g.fillStyle = '#5fb043'; g.fillRect(0, 0, w / 2, h); g.fillStyle = '#6fc04e'; g.fillRect(w / 2, 0, w / 2, h);
        for (let i=0;i<40;i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,250,170' : '25,80,20'},.07)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 0, 7); g.fill(); }
        for (let i=0;i<7000;i++) { const x = Math.random() * w, y = Math.random() * h, lite = x > w / 2; g.strokeStyle = (lite ? ['#78c95a','#8ad86a','#62b148'] : ['#4f9c36','#5aab3e','#468f30'])[i % 3]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 3, y - 3 - Math.random() * 4); g.stroke(); }
        for (let i=0;i<26;i++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = ['#fff','#ffe66d','#ffd1e8'][i % 3]; for (let k=0;k<5;k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 2.2, y + Math.sin(k * 1.26) * 2.2, 1.6, 0, 7); g.fill(); } g.fillStyle = '#ffcf33'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); }
      });
    }
    function hedgeTex(){
      return canvas(256, 256, (g, w, h) => {
        g.fillStyle = '#2f7d2c'; g.fillRect(0, 0, w, h);
        for (let i=0;i<3200;i++) { g.fillStyle = ['#2a6e27','#3f9a38','#4fb043','#62c254','#25601f'][i % 5]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 3, 2 + Math.random() * 2, Math.random() * 3, 0, 7); g.fill(); }
        for (let i=0;i<300;i++) { g.fillStyle = 'rgba(200,255,150,.35)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1.5, 0, 7); g.fill(); }
      });
    }
    function leafTex(){ return canvas(256, 256, (g, w, h) => { g.fillStyle = '#3a8a32'; g.fillRect(0, 0, w, h); for (let i=0;i<4200;i++) { g.fillStyle = ['#2f7a2a','#4a9e3a','#5bb345','#3d8f33','#76c95a','#2a6b25'][i % 6]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 4 + Math.random() * 5, 2 + Math.random() * 2.5, Math.random() * 3, 0, 7); g.fill(); } for (let i=0;i<500;i++) { g.fillStyle = 'rgba(230,255,170,.35)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3, 1.5, Math.random() * 3, 0, 7); g.fill(); } }); }
    function blossomTex(){ return canvas(256, 256, (g, w, h) => { g.fillStyle = '#e98fb0'; g.fillRect(0, 0, w, h); for (let i=0;i<4200;i++) { g.fillStyle = ['#f7b6cc','#ffd3e2','#e47aa2','#fbe4ec','#d9668f'][i % 5]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 3.5, 0, 7); g.fill(); } }); }
    function barkTex(){ return canvas(64, 128, (g, w, h) => { g.fillStyle = '#7a5236'; g.fillRect(0, 0, w, h); for (let i=0;i<30;i++) { g.strokeStyle = 'rgba(60,30,10,.35)'; g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 4, 40, x - 4, 80, x + 2, h); g.stroke(); } }); }
    function furTex(){ return canvas(128, 128, (g, w, h) => { g.fillStyle = '#a9a3a0'; g.fillRect(0, 0, w, h); for (let i=0;i<2500;i++) { const x = Math.random() * w, y = Math.random() * h; g.strokeStyle = Math.random() < .5 ? 'rgba(255,255,255,.12)' : 'rgba(60,40,30,.10)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y + 3, x + (Math.random() - .5) * 3, y + 6); g.stroke(); } }); }
    function sidingTex(col){ return canvas(128, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let y=0;y<h;y+=16) { g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(0, y + 13, w, 3); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y, w, 2); } }); }
    function roofTex(col){ return canvas(256, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let y=0, r=0;y<h;y+=16, r++) for (let x=-(r % 2) * 16;x<w;x+=32) { g.fillStyle = PB.shade(col, (Math.random() - .5) * 0.18); g.beginPath(); g.roundRect(x + 1, y + 1, 30, 15, [0, 0, 6, 6]); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 1, y + 14, 30, 2); } }); }
    // the street-facing front of a house: 10 m wide x 6 m tall
    function houseFront(sty){
      return canvas(640, 384, (g, w, h) => {
        const m = w / 10;
        g.fillStyle = sty.col; g.fillRect(0, 0, w, h);
        for (let y=0;y<h;y+=14) { g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(0, y + 11, w, 3); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, y, w, 2); }
        g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); g.fillRect(0, h - 22, w, 22);
        const win = (x, y, ww, hh) => {
          g.fillStyle = PB.shade(sty.shut, -0.1); g.fillRect(x - 26, y, 22, hh); g.fillRect(x + ww + 4, y, 22, hh);
          g.fillStyle = 'rgba(0,0,0,.12)'; for (let k=8;k<hh;k+=8) { g.fillRect(x - 24, y + k, 18, 2); g.fillRect(x + ww + 6, y + k, 18, 2); }
          g.fillStyle = '#fbfaf5'; g.fillRect(x - 6, y - 6, ww + 12, hh + 12);
          const gl = g.createLinearGradient(x, y, x + ww, y + hh); gl.addColorStop(0, '#bfe6ff'); gl.addColorStop(0.5, '#6fa8d8'); gl.addColorStop(1, '#3f6f9e'); g.fillStyle = gl; g.fillRect(x, y, ww, hh);
          g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(x + 4, y + hh - 6); g.lineTo(x + ww * 0.45, y + 4); g.lineTo(x + ww * 0.6, y + 4); g.lineTo(x + 14, y + hh - 6); g.fill();
          g.fillStyle = '#fbfaf5'; g.fillRect(x + ww / 2 - 2, y, 4, hh); g.fillRect(x, y + hh / 2 - 2, ww, 4);
          g.fillStyle = '#fff3e0'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + ww / 2, y + 14, x + ww, y); g.lineTo(x + ww, y + 10); g.quadraticCurveTo(x + ww / 2, y + 22, x, y + 10); g.fill();
        };
        const box = (x, y, ww) => { g.fillStyle = '#8a5a3a'; g.fillRect(x - 6, y, ww + 12, 14); for (let k=0;k<ww / 9;k++) { g.fillStyle = ['#ff6b8a','#ffd166','#ef476f','#ffffff','#c77dff'][k % 5]; g.beginPath(); g.arc(x + k * 9 + 4, y - 2, 5, 0, 7); g.fill(); } g.fillStyle = '#4f9c34'; g.fillRect(x - 4, y + 2, ww + 8, 3); };
        const y2 = 40, y1 = 0.55 * h;
        if (sty.stories > 1) for (const x of [1.4 * m, 4.4 * m, 7.4 * m]) { win(x, y2, 1.2 * m, 1.3 * m); box(x, y2 + 1.3 * m + 8, 1.2 * m); }
        if (sty.garage) {
          const gx = 5.6 * m, gw = 3.6 * m, gy = y1 - 6;
          g.fillStyle = '#fbfaf5'; g.fillRect(gx - 8, gy - 8, gw + 16, h - gy);
          g.fillStyle = '#f4f1ea'; g.fillRect(gx, gy, gw, h - gy - 22);
          for (let k=0;k<4;k++) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(gx, gy + k * (h - gy - 22) / 4, gw, 3); for (let j=0;j<4;j++) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(gx + 8 + j * gw / 4, gy + 10 + k * (h - gy - 22) / 4, gw / 4 - 16, (h - gy - 22) / 4 - 18); } }
          win(1.6 * m, y1, 1.6 * m, 1.3 * m);
        } else { win(1.2 * m, y1, 1.6 * m, 1.3 * m); win(6.8 * m, y1, 1.6 * m, 1.3 * m); }
        // front door with a little porch light
        const dx = sty.garage ? 3.9 * m : 4.45 * m, dw = 1.1 * m, dy = h - 22 - 2.1 * m;
        g.fillStyle = '#fbfaf5'; g.fillRect(dx - 8, dy - 8, dw + 16, 2.1 * m + 8);
        const dg = g.createLinearGradient(dx, 0, dx + dw, 0); dg.addColorStop(0, PB.shade(sty.door, 0.15)); dg.addColorStop(1, PB.shade(sty.door, -0.2)); g.fillStyle = dg; g.fillRect(dx, dy, dw, 2.1 * m);
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 3; g.strokeRect(dx + 10, dy + 12, dw - 20, 0.8 * m); g.strokeRect(dx + 10, dy + 1.1 * m, dw - 20, 0.8 * m);
        g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(dx + dw - 12, dy + 1.1 * m, 4, 0, 7); g.fill();
        g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(dx - 18, dy + 22, 7, 0, 7); g.fill();
        // bushes along the base
        for (let k=0;k<14;k++) { const bx = 20 + k * 46 + (k % 3) * 6; if (bx > dx - 30 && bx < dx + dw + 20) continue; if (sty.garage && bx > 5.5 * m && bx < 9.3 * m) continue; g.fillStyle = k % 2 ? '#3f9a38' : '#4fb043'; g.beginPath(); g.arc(bx, h - 24, 22, Math.PI, 0); g.fill(); for (let q=0;q<14;q++) { g.fillStyle = q % 3 ? 'rgba(30,90,30,.35)' : 'rgba(170,230,120,.45)'; g.beginPath(); g.arc(bx + (Math.random() - .5) * 36, h - 26 - Math.random() * 18, 2 + Math.random() * 2.5, 0, 7); g.fill(); } g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(bx - 6, h - 34, 6, 0, 7); g.fill(); }
        // weathering: soft grime toward the ground and light from the top
        const wg = g.createLinearGradient(0, 0, 0, h); wg.addColorStop(0, 'rgba(255,250,235,.10)'); wg.addColorStop(0.75, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(60,40,30,.16)'); g.fillStyle = wg; g.fillRect(0, 0, w, h);
      }, 1.6);
    }
    function hillsTex(){
      return canvas(2048, 320, (g, w, h) => {
        const R = PB.mulberry(9);
        const ridge = (base, amp, f, ph, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x=0;x<=w;x+=8) g.lineTo(x, base - Math.sin(x * f + ph) * amp - Math.sin(x * f * 2.3 + ph) * amp * 0.4); g.lineTo(w, h); g.closePath(); g.fill(); };
        ridge(170, 40, 0.004, 1, '#9fcbe0');
        ridge(205, 34, 0.007, 2, '#86c06a');
        for (let i=0;i<70;i++) { const x = R() * w, y = 200 + R() * 40; g.fillStyle = ['#5ea548','#4f9a3c','#6db554'][i % 3]; g.beginPath(); g.arc(x, y, 10 + R() * 14, 0, 7); g.fill(); }
        for (let i=0;i<46;i++) { const x = R() * w, y = 232 + R() * 30, s = 0.6 + R() * 0.5; g.fillStyle = HOUSE_COLS[i % HOUSE_COLS.length]; g.fillRect(x, y - 16 * s, 26 * s, 16 * s); g.fillStyle = ROOF_COLS[i % ROOF_COLS.length]; g.beginPath(); g.moveTo(x - 3 * s, y - 16 * s); g.lineTo(x + 13 * s, y - 28 * s); g.lineTo(x + 29 * s, y - 16 * s); g.fill(); }
        g.fillStyle = '#b8d7e8'; g.fillRect(1400, 120, 8, 90); g.fillRect(1450, 120, 8, 90); g.beginPath(); g.ellipse(1429, 112, 46, 30, 0, 0, 7); g.fill(); g.fillStyle = '#a5c8db'; g.beginPath(); g.ellipse(1429, 92, 40, 12, 0, 0, 7); g.fill();
        ridge(268, 16, 0.011, 4, '#6cb850');
        g.fillStyle = '#6cb850'; g.fillRect(0, 270, w, 50);
      }, 1.5);
    }
    function cloudTex(){ return canvas(512, 256, (g, w, h) => { const R = PB.mulberry(4);
      const puffs = []; for (let i=0;i<26;i++) { const t = i / 25; puffs.push([90 + t * 330 + (R() - .5) * 40, 150 - Math.sin(t * Math.PI) * (40 + R() * 40), 26 + Math.sin(t * Math.PI) * 34 + R() * 14]); }
      g.save(); g.beginPath(); g.rect(0, 0, w, 178); g.clip();
      for (const [x, y, r] of puffs) { g.fillStyle = 'rgba(190,175,200,1)'; g.beginPath(); g.arc(x, y + 8, r, 0, 7); g.fill(); }
      for (const [x, y, r] of puffs) { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.45, r * 0.1, x, y, r); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.6, '#fbeee6'); gr.addColorStop(1, 'rgba(235,215,220,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.restore();
      const fade = g.createLinearGradient(0, 150, 0, 180); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 150, w, 106); g.globalCompositeOperation = 'source-over'; }); }
    // painted movie-style sky: deep blue overhead fading to a warm glow, with soft storybook clouds
    function skyTex(){ return canvas(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f78d6'); gr.addColorStop(0.45, '#6fb0ea'); gr.addColorStop(0.8, '#bfe0f6'); gr.addColorStop(1, '#fbe6c8'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const sun = g.createRadialGradient(w * 0.82, h * 0.78, 0, w * 0.82, h * 0.78, h * 0.7); sun.addColorStop(0, 'rgba(255,240,200,.85)'); sun.addColorStop(0.3, 'rgba(255,225,170,.35)'); sun.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = sun; g.fillRect(0, 0, w, h);
      const R = PB.mulberry(12);
      const cloud = (cx, cy, sc) => { const pts = []; for (let i=0;i<14;i++) { const t = i / 13; pts.push([cx + (t - 0.5) * 220 * sc + (R() - .5) * 20 * sc, cy - Math.sin(t * Math.PI) * (26 + R() * 26) * sc, (16 + Math.sin(t * Math.PI) * 26 + R() * 10) * sc]); }
        for (const [x, y, r] of pts) { g.fillStyle = 'rgba(160,170,210,.55)'; g.beginPath(); g.arc(x, y + 6 * sc, r, 0, 7); g.fill(); }
        for (const [x, y, r] of pts) { const c = g.createRadialGradient(x - r * .3, y - r * .5, r * .1, x, y, r); c.addColorStop(0, '#ffffff'); c.addColorStop(0.7, '#f4f2fa'); c.addColorStop(1, 'rgba(225,225,245,.0)'); g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } };
      cloud(170, 170, 1.0); cloud(560, 120, 1.25); cloud(860, 200, 0.9); cloud(380, 300, 0.7); cloud(700, 330, 0.6);
    }); }
    function shirtTex(c1, c2){ return canvas(64, 64, (g, w, h) => { g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2; for (let y=0;y<h;y+=16) g.fillRect(0, y, w, 7); }); }
    // ================= the journey: farm -> suburbs -> old town -> big city =================
    const ZONES = [
      { id:'farm',   name:'Sunny Farms',  sub:'Country roads',     from:0 },
      { id:'houses', name:'Maple Street', sub:'The suburbs',       from:380 },
      { id:'town',   name:'Old Town',     sub:'Main Street shops', from:850 },
      { id:'city',   name:'Big City',     sub:'Downtown',          from:1350 },
    ];
    const zoneIdx = at => { let k = 0; for (let i=0;i<ZONES.length;i++) if (at >= ZONES[i].from) k = i; return k; };
    const zoneAt = at => ZONES[zoneIdx(at)].id;
    const nextZoneFrom = at => { for (const z of ZONES) if (z.from > at + 1e-6) return z.from; return Infinity; };
    const SHOPS = [
      { name:'BAKERY',    wall:'#e9b48a', trim:'#fff6e6', sign:'#8a3d2a', awn:['#ff7a8a','#ffffff'], goods:['#f6d28a','#e89a5a','#ffffff','#ff9fb5'] },
      { name:'TOYS',      wall:'#7fb4ff', trim:'#ffffff', sign:'#ff4f6d', awn:['#ffd23f','#ff4f6d'], goods:['#ff4f6d','#3fa9ff','#7dff6a','#ffd23f'] },
      { name:'ICE CREAM', wall:'#ffc4dc', trim:'#ffffff', sign:'#3fb6c8', awn:['#7fe0e8','#ffffff'], goods:['#ffb3d1','#fff1c4','#9b6a4a','#b8f0c8'] },
      { name:'BOOKS',     wall:'#2f6b5a', trim:'#f2e6c8', sign:'#1d3d34', awn:['#2f6b5a','#f2e6c8'], goods:['#c0392b','#2e6fb7','#f2b134','#7d3c98'] },
      { name:'PIZZA',     wall:'#c8553d', trim:'#fff1d6', sign:'#2f8f5b', awn:['#2f8f5b','#ffffff'], goods:['#f2b134','#c0392b','#fff1d6','#6fa84a'] },
      { name:'PET SHOP',  wall:'#ffd479', trim:'#ffffff', sign:'#6a4cc2', awn:['#9b7bff','#ffffff'], goods:['#c48a5a','#f4f4f4','#3a3a3a','#ffb36b'] },
      { name:'CANDY',     wall:'#c7a6ff', trim:'#ffffff', sign:'#ff3d8b', awn:['#ff6fb5','#ffffff'], goods:['#ff3d8b','#5ee0ff','#ffe04a','#7dff6a'] },
      { name:'COMICS',    wall:'#4a5f86', trim:'#ffe04a', sign:'#ff5a2a', awn:['#ff5a2a','#ffe04a'], goods:['#ff5a2a','#3fa9ff','#ffe04a','#ffffff'] },
    ];
    const TOWERS = [
      { glass:['#1d4f8f','#5fa8e8'], mull:'#d9e6f2', crown:'antenna' },
      { glass:['#11635f','#56d0c4'], mull:'#e6f4f2', crown:'step' },
      { brick:'#a5523a', win:'#2a3346', crown:'tank' },
      { brick:'#e6dcc6', win:'#3a4a66', crown:'step' },
      { glass:['#1a2140','#4a5ea8'], mull:'#e8c45a', crown:'spire' },
    ];
    const TOWER_H = [24, 34, 48];
    function gravelTex(){ return canvas(256, 256, (g, w, h) => { g.fillStyle = '#c9ad7e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, 'rgba(255,245,220,.35)', 'rgba(90,70,40,.3)', 3); for (let i=0;i<90;i++) { g.fillStyle = ['#a88d62','#e2cfa6','#8f7856'][i % 3]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1.5 + Math.random() * 2, Math.random() * 3, 0, 7); g.fill(); } }); }
    function farmGrassTex(){ return canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#5fa336'; g.fillRect(0, 0, w, h);
      for (let i=0;i<50;i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,235,140' : '60,110,20'},.10)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 12 + Math.random() * 30, 0, 7); g.fill(); }
      for (let i=0;i<6500;i++) { const x = Math.random() * w, y = Math.random() * h; g.strokeStyle = ['#7fbf48','#5a9a30','#94c858','#4e8a2a'][i % 4]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 3, y - 3 - Math.random() * 5); g.stroke(); }
      for (let i=0;i<30;i++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = ['#ffe14a','#ffffff','#ff9ec4'][i % 3]; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    }); }
    function paverTex(){ return canvas(256, 256, (g, w, h) => { g.fillStyle = '#9a5a44'; g.fillRect(0, 0, w, h); for (let y=0, r=0;y<h;y+=16, r++) for (let x=-(r % 2) * 16;x<w;x+=32) { g.fillStyle = PB.shade('#c4775a', (Math.random() - .5) * 0.22); g.fillRect(x + 1.5, y + 1.5, 29, 13); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 1.5, y + 1.5, 29, 2); } speckle(g, w, h, 2500, 'rgba(255,255,255,.08)', 'rgba(0,0,0,.1)', 1.5); }); }
    function plazaTex(c1, c2){ return canvas(256, 256, (g, w, h) => { g.fillStyle = c2; g.fillRect(0, 0, w, h); for (let y=0;y<h;y+=64) for (let x=0;x<w;x+=64) { g.fillStyle = PB.shade(c1, (Math.random() - .5) * 0.08); g.fillRect(x + 1.5, y + 1.5, 61, 61); } speckle(g, w, h, 5000, 'rgba(255,255,255,.10)', 'rgba(0,0,0,.08)', 1.6); }); }
    function plankTex(col){ return canvas(128, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let x=0;x<w;x+=16) { g.fillStyle = PB.shade(col, (Math.random() - .5) * 0.18); g.fillRect(x, 0, 15, h); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + 15, 0, 1.5, h); } for (let i=0;i<300;i++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 6); } }); }
    function brickTex(col){ return canvas(128, 128, (g, w, h) => { g.fillStyle = PB.shade(col, -0.35); g.fillRect(0, 0, w, h); for (let y=0, r=0;y<h;y+=8, r++) for (let x=-(r % 2) * 8;x<w;x+=16) { g.fillStyle = PB.shade(col, (Math.random() - .5) * 0.16); g.fillRect(x + 1, y + 1, 14, 6); } }); }
    // the street side of a red barn: 11 m wide, 4.5 m of wall
    function barnFrontTex(){ return canvas(704, 288, (g, w, h) => {
      g.fillStyle = '#c4362c'; g.fillRect(0, 0, w, h);
      for (let x=0;x<w;x+=22) { g.fillStyle = PB.shade('#c4362c', (Math.random() - .5) * 0.14); g.fillRect(x, 0, 21, h); g.fillStyle = 'rgba(60,0,0,.35)'; g.fillRect(x + 21, 0, 1.5, h); }
      g.fillStyle = '#fbf6ec'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); g.fillRect(0, 0, w, 10);
      const door = (x, y, ww, hh) => { g.fillStyle = '#9e2a22'; g.fillRect(x, y, ww, hh); g.strokeStyle = '#fbf6ec'; g.lineWidth = 9; g.strokeRect(x, y, ww, hh); g.beginPath(); g.moveTo(x, y); g.lineTo(x + ww, y + hh); g.moveTo(x + ww, y); g.lineTo(x, y + hh); g.stroke(); };
      door(w / 2 - 150, h - 230, 150, 230); door(w / 2, h - 230, 150, 230);
      for (const x of [70, w - 170]) { g.fillStyle = '#fbf6ec'; g.fillRect(x - 8, 70, 116, 86); const gl = g.createLinearGradient(x, 78, x + 100, 148); gl.addColorStop(0, '#bfe6ff'); gl.addColorStop(1, '#4f7fae'); g.fillStyle = gl; g.fillRect(x, 78, 100, 70); g.fillStyle = '#fbf6ec'; g.fillRect(x + 47, 78, 6, 70); g.fillRect(x, 110, 100, 6); }
      const wg = g.createLinearGradient(0, 0, 0, h); wg.addColorStop(0, 'rgba(255,240,220,.08)'); wg.addColorStop(1, 'rgba(50,20,10,.25)'); g.fillStyle = wg; g.fillRect(0, 0, w, h);
    }, 1); }
    function cropTex(){ return canvas(256, 256, (g, w, h) => { g.fillStyle = '#8a5a34'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 'rgba(255,220,170,.15)', 'rgba(40,20,0,.2)', 2); for (let x=8;x<w;x+=32) for (let y=4;y<h;y+=10) { g.fillStyle = ['#5cb33e','#74c84a','#4a9c34'][(x + y) % 3]; g.beginPath(); g.ellipse(x + 8 + (Math.random() - .5) * 2, y, 8, 5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(220,255,160,.35)'; g.beginPath(); g.arc(x + 6, y - 2, 2, 0, 7); g.fill(); } }); }
    // a shop on Main Street: 12 m wide, 10 m tall (a storefront and two floors of flats above)
    function shopFrontTex(S){ return canvas(576, 480, (g, w, h) => {
      const m = 48;
      g.fillStyle = S.wall; g.fillRect(0, 0, w, h);
      for (let y=0;y<h;y+=8) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y + 6, w, 2); }
      g.fillStyle = S.trim; g.fillRect(0, 0, w, 16); g.fillRect(0, 0, 12, h); g.fillRect(w - 12, 0, 12, h);
      // upper floors
      for (const [row, fy] of [[0, 0.9 * m], [1, 3.5 * m]]) for (const fx of [1.6 * m, 5.3 * m, 9.0 * m]) {
        const ww = 1.4 * m, hh = 1.8 * m;
        g.fillStyle = S.trim; g.fillRect(fx - 7, fy - 7, ww + 14, hh + 14);
        if (row === 0) { g.beginPath(); g.ellipse(fx + ww / 2, fy - 4, ww / 2 + 7, 18, 0, Math.PI, 0); g.fill(); }
        const gl = g.createLinearGradient(fx, fy, fx + ww, fy + hh); const lit = Math.random() < 0.35; gl.addColorStop(0, lit ? '#fff1b8' : '#bfe0ff'); gl.addColorStop(1, lit ? '#f2a84a' : '#3f6f9e'); g.fillStyle = gl; g.fillRect(fx, fy, ww, hh);
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(fx + 4, fy + hh - 6); g.lineTo(fx + ww * 0.5, fy + 4); g.lineTo(fx + ww * 0.65, fy + 4); g.lineTo(fx + 14, fy + hh - 6); g.fill();
        g.fillStyle = S.trim; g.fillRect(fx + ww / 2 - 2, fy, 4, hh); g.fillRect(fx - 10, fy + hh + 6, ww + 20, 7);
        if (row === 1) { g.fillStyle = '#7a4a2a'; g.fillRect(fx - 4, fy + hh + 12, ww + 8, 10); for (let k=0;k<7;k++) { g.fillStyle = ['#ff6b8a','#ffd166','#ffffff','#c77dff'][k % 4]; g.beginPath(); g.arc(fx + 4 + k * ww / 6.5, fy + hh + 10, 6, 0, 7); g.fill(); } }
      }
      // cornice band between shop and flats
      g.fillStyle = S.trim; g.fillRect(0, h - 4.25 * m, w, 10);
      // sign
      const sy = h - 4.1 * m, sh = 0.85 * m;
      g.fillStyle = S.sign; g.beginPath(); g.roundRect(0.8 * m, sy, w - 1.6 * m, sh, 8); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.beginPath(); g.roundRect(0.8 * m + 5, sy + 5, w - 1.6 * m - 10, sh - 10, 6); g.stroke();
      g.font = `${Math.round(sh * 0.62)}px ${TOON}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(S.name, w / 2, sy + sh / 2 + 2); g.fillStyle = '#fff8e0'; g.fillText(S.name, w / 2, sy + sh / 2 + 2);
      // the storefront window full of goods, and a glass door
      const wy = h - 3.05 * m, wh = 2.55 * m, wx = 0.9 * m, ww = 7.4 * m;
      g.fillStyle = '#3a2a2a'; g.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
      const ig = g.createLinearGradient(0, wy, 0, wy + wh); ig.addColorStop(0, '#fff3cf'); ig.addColorStop(1, '#f2b866'); g.fillStyle = ig; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(120,70,30,.5)'; for (const sh2 of [0.45, 0.8]) g.fillRect(wx, wy + wh * sh2, ww, 5);
      for (let i=0;i<22;i++) { const gx = wx + 14 + (i % 11) * (ww - 28) / 10, gy = wy + wh * (i < 11 ? 0.38 : 0.73); g.fillStyle = S.goods[i % S.goods.length]; g.beginPath(); if (i % 3 === 0) g.arc(gx, gy, 11, 0, 7); else g.roundRect(gx - 9, gy - 18 + (i % 2) * 4, 18, 18 + (i % 2) * -4 + 4, 4); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(gx - 3, gy - 6, 3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(wx + 20, wy + wh); g.lineTo(wx + 120, wy); g.lineTo(wx + 170, wy); g.lineTo(wx + 70, wy + wh); g.fill();
      g.fillStyle = S.trim; g.fillRect(wx + ww / 2 - 3, wy, 6, wh);
      const dx = 8.9 * m, dw = 1.5 * m, dh = 2.75 * m;
      g.fillStyle = S.sign; g.fillRect(dx - 6, h - dh - 0.3 * m - 6, dw + 12, dh + 6);
      const dg = g.createLinearGradient(dx, 0, dx + dw, 0); dg.addColorStop(0, '#ffe9b8'); dg.addColorStop(1, '#e8a85a'); g.fillStyle = dg; g.fillRect(dx + 8, h - dh - 0.3 * m + 8, dw - 16, dh - 30);
      g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(dx + dw - 16, h - dh / 2 - 0.3 * m, 5, 0, 7); g.fill();
      g.fillStyle = '#5a4a48'; g.fillRect(0, h - 0.3 * m, w, 0.3 * m);
      const wg = g.createLinearGradient(0, 0, 0, h); wg.addColorStop(0, 'rgba(255,250,235,.1)'); wg.addColorStop(1, 'rgba(40,20,20,.15)'); g.fillStyle = wg; g.fillRect(0, 0, w, h);
    }, 1); }
    function stripeTex(a, b){ return canvas(64, 32, (g, w, h) => { for (let x=0;x<w;x+=16) { g.fillStyle = a; g.fillRect(x, 0, 8, h); g.fillStyle = b; g.fillRect(x + 8, 0, 8, h); } g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h - 4, w, 4); }); }
    // one 4 m x 4 m tile of a skyscraper wall
    function facadeTex(T){ return canvas(256, 256, (g, w, h) => {
      if (T.glass) {
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, T.glass[1]); gr.addColorStop(0.55, T.glass[0]); gr.addColorStop(1, PB.shade(T.glass[0], -0.25)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w * 0.55, 0); g.lineTo(w * 0.8, 0); g.lineTo(0, h * 1.1); g.fill();
        for (let i=0;i<4;i++) if (Math.random() < 0.3) { g.fillStyle = 'rgba(255,230,160,.35)'; g.fillRect((i % 2) * w / 2 + 4, Math.floor(i / 2) * h / 2 + 4, w / 2 - 8, h / 2 - 8); }
        g.fillStyle = T.mull; for (const x of [0, w / 2]) g.fillRect(x, 0, 5, h); g.fillRect(0, 0, w, 10); g.fillRect(0, h / 2, w, 4);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 10, w, 4);
      } else {
        g.fillStyle = T.brick; g.fillRect(0, 0, w, h);
        for (let y=0;y<h;y+=8) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, y + 6, w, 2); }
        for (const x of [36, 148]) for (const y of [30, 158]) { g.fillStyle = PB.shade(T.brick, 0.25); g.fillRect(x - 8, y - 8, 88, 96); const lit = Math.random() < 0.3; const gl = g.createLinearGradient(x, y, x + 72, y + 80); gl.addColorStop(0, lit ? '#fff1b8' : '#8fb6dc'); gl.addColorStop(1, lit ? '#f2a84a' : T.win); g.fillStyle = gl; g.fillRect(x, y, 72, 80); g.fillStyle = PB.shade(T.brick, 0.25); g.fillRect(x + 34, y, 4, 80); g.fillRect(x - 10, y + 82, 92, 8); }
      }
    }); }
    function lobbyTex(){ return canvas(624, 230, (g, w, h) => {
      g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, w, h);
      const ig = g.createLinearGradient(0, 0, 0, h); ig.addColorStop(0, '#ffe7b0'); ig.addColorStop(1, '#d99a4a'); g.fillStyle = ig; g.fillRect(20, 30, w - 40, h - 40);
      for (let i=0;i<10;i++) { g.fillStyle = 'rgba(90,60,30,.35)'; g.beginPath(); g.arc(60 + i * 56, h - 70, 14, 0, 7); g.fill(); }
      g.fillStyle = '#c9ced8'; for (let x=20;x<w;x+=78) g.fillRect(x - 4, 30, 8, h - 40);
      g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(80, h); g.lineTo(200, 30); g.lineTo(250, 30); g.lineTo(130, h); g.fill();
      g.fillStyle = '#c9ced8'; g.fillRect(0, 0, w, 30);
    }, 1); }
    function skylineTex(){ return canvas(2048, 320, (g, w, h) => {
      const R = PB.mulberry(31);
      const layer = (base, hmin, hmax, col, lit) => { let x = -20; while (x < w) { const bw = 40 + R() * 90, bh = hmin + R() * (hmax - hmin); g.fillStyle = col; g.fillRect(x, base - bh, bw, bh + 80); if (R() < 0.3) { g.fillRect(x + bw * 0.3, base - bh - 30, bw * 0.4, 30); g.fillRect(x + bw * 0.48, base - bh - 60, 3, 30); }
        if (lit) for (let yy = base - bh + 10; yy < base - 6; yy += 12) for (let xx = x + 6; xx < x + bw - 6; xx += 10) if (R() < 0.22) { g.fillStyle = 'rgba(255,236,170,.75)'; g.fillRect(xx, yy, 4, 5); }
        x += bw + 4 + R() * 10; } };
      layer(250, 60, 170, '#9fb2d6', false);
      layer(272, 40, 140, '#7d8fbd', true);
      layer(292, 30, 110, '#5f6f9e', true);
      g.fillStyle = '#5f6f9e'; g.fillRect(0, 290, w, 30);
    }, 1.5); }
    let HOUSES = [];
    const HOUSE_N = 10, FARM_H = 10;
    function loadAssets(){
      if (A) return A;
      E = PB.gl3d.get(); if (!E) return null;
      const G = E.G, M = E.M, T = (c, o) => E.texture(c, o), Tr = (g, t, r, s) => G.transform(g, M.trs(t, r || [0,0,0], s || [1,1,1]));
      const R = PB.mulberry(21);
      HOUSES = [];
      for (let i=0;i<HOUSE_N;i++) { const sty = { col: HOUSE_COLS[i % HOUSE_COLS.length], shut: ['#2e5e8c','#3f7a4a','#8c2f39','#3a3a48','#5a7fa8'][i % 5], door: DOOR_COLS[i % DOOR_COLS.length], stories: i % 3 === 2 ? 1 : 2, garage: i % 2 === 0, roof: ROOF_COLS[(i * 3) % ROOF_COLS.length] }; HOUSES.push(sty); }
      HOUSES.push({ col: '#fbf6ec', shut: '#3f7a4a', door: '#c0392b', stories: 2, garage: false, roof: '#a8473a' });
      A = {
        road: E.mesh(G.plane(6.8, VIEW + 20, 1, (VIEW + 20) / 27.2)), roadU: E.mesh(G.plane(6.8, 1, 1, 1)), walkU: E.mesh(G.plane(1.7, 1, 1, 1)), lawnU: E.mesh(G.plane(40, 1, 1, 1)), curbU: E.mesh(G.box(0.25, 0.18, 1)),
        arrow: E.mesh(G.extrude([[-0.7, 0.16], [0.15, 0.16], [0.15, 0.42], [0.7, 0], [0.15, -0.42], [0.15, -0.16], [-0.7, -0.16]], 0.05)),
        walk: E.mesh(G.plane(1.7, VIEW + 20, 1, (VIEW + 20) / 1.7)),
        lawn: E.mesh(G.plane(40, VIEW + 20, 40 / 4, (VIEW + 20) / 4)),
        curb: E.mesh(G.box(0.25, 0.18, VIEW + 20)),
        tAsph: T(asphaltTex()), tBusSide: T(busSideTex(), { repeat: false }), tStripe: T(canvas(64, 16, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff5a2a'; for (let x=-16;x<w;x+=16) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 8, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, h); g.fill(); } })), tManhole: T(manholeTex(), { repeat: false }), tCross: T(crossTex(), { repeat: false }), tBlossom: T(blossomTex()), tWalk: T(walkTex()), tGrass: T(grassTex()), tHedge: T(hedgeTex()), tLeaf: T(leafTex()), tBark: T(barkTex()), tFur: T(furTex()),
        tHills: T(hillsTex(), { repeat: true, clampV: true }), tSky: T(skyTex(), { repeat: false }), tCloud: T(cloudTex(), { repeat: false }),
        fronts: HOUSES.map(s => T(houseFront(s), { repeat: false })), sides: HOUSES.map(s => T(sidingTex(s.col))), roofs: ROOF_COLS.map(c => T(roofTex(c))),
        shirts: [['#ff6b6b','#ffffff'], ['#4fc3f7','#ffffff'], ['#ffd54f','#ff8a65'], ['#81c784','#2e7d32']].map(([a, b]) => T(shirtTex(a, b))),
        quad: E.mesh(G.quad(1, 1)),
        tail: E.mesh(tailGeo()), tTail: T(tailTex()),
        box: E.mesh(G.box(1, 1, 1)),
        hedge: E.mesh(G.merge([Tr(G.box(1, 0.8, 1), [0, 0.4, 0]), Tr(G.cylinder(0.5, 0.5, 1, 16), [0, 0.8, 0], [Math.PI / 2, 0, 0], [1, 1, 1])])),
        roof: E.mesh(G.extrude([[-1, 0], [1, 0], [0, 1]], 1)),
        cyl: E.mesh(G.cylinder(0.5, 0.5, 1, 32)),
        cone: E.mesh(G.cylinder(0.02, 0.5, 1, 32, true)),
        sphere: E.mesh(G.sphere(0.5, 32, 22)),
        sphereLo: E.mesh(G.sphere(0.5, 16, 12)),
        bump: E.mesh(G.displace(G.sphere(0.5, 22, 16), (x, y, z) => PB.gl3d.fbm(x * 2.2, y * 2.2, z * 2.2, 3) * 0.12)),
        torus: E.mesh(G.torus(0.22, 0.1, 48, 18)),
        wheel: E.mesh(G.transform(G.cylinder(0.42, 0.42, 0.3, 32), M.trs([0,0,0], [0, 0, Math.PI / 2]))),
        shirt: E.mesh(G.extrude([[-0.3, 0], [0.3, 0], [0.3, -0.18], [0.18, -0.18], [0.18, -0.62], [-0.18, -0.62], [-0.18, -0.18], [-0.3, -0.18]], 0.03)),
        heart: E.mesh(G.extrude(heartShape(), 0.12)),
        bolt: E.mesh(G.extrude([[0.05, 0.35], [-0.2, 0], [-0.01, 0], [-0.08, -0.35], [0.2, 0.05], [0.01, 0.05]], 0.1)),
        star: E.mesh(G.extrude(starShape(0.32, 0.14), 0.1)),
        coin: E.mesh(G.cylinder(0.5, 0.5, 0.12, 40)), coinStar: E.mesh(G.extrude(starShape(0.32, 0.14), 0.1)),
      };
      // a real skateboard: a deck with rounded kicktails, grip tape, metal trucks and chunky wheels
      { const tail = sgn => Tr(G.merge([Tr(G.box(0.42, 0.04, 0.16), [0, 0, sgn * 0.08]), Tr(G.cylinder(0.21, 0.21, 0.04, 28), [0, 0, sgn * 0.16])]), [0, 0.03, sgn * 0.46], [sgn * -0.38, 0, 0]);
        A.deck = E.mesh(G.merge([G.box(0.42, 0.04, 0.94), tail(1), tail(-1)]));
        A.grip = E.mesh(G.merge([Tr(G.box(0.38, 0.006, 0.9), [0, 0.023, 0]), Tr(tailGrip(1), [0, 0, 0]), Tr(tailGrip(-1), [0, 0, 0])]));
        function tailGrip(sgn){ return Tr(G.merge([Tr(G.box(0.38, 0.006, 0.15), [0, 0.023, sgn * 0.08]), Tr(G.cylinder(0.19, 0.19, 0.006, 28), [0, 0.023, sgn * 0.16])]), [0, 0.03, sgn * 0.46], [sgn * -0.38, 0, 0]); }
        A.truck = E.mesh(G.merge([Tr(G.box(0.34, 0.035, 0.07), [0, -0.075, 0]), Tr(G.box(0.1, 0.06, 0.1), [0, -0.035, 0]), Tr(G.cylinder(0.012, 0.012, 0.42, 10), [0, -0.075, 0], [0, 0, Math.PI / 2])]));
        A.tBoard = T(canvas(128, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3fa9ff'); gr.addColorStop(0.5, '#7b5cff'); gr.addColorStop(1, '#ff4fa3'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23f'; for (let i=0;i<5;i++) { const cy = 80 + i * 90; g.beginPath(); for (let k=0;k<10;k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 12 : 28; g.lineTo(64 + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); } g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h); }));
        A.tGrip = T(canvas(64, 256, (g, w, h) => { g.fillStyle = '#26232b'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 'rgba(255,255,255,.12)', 'rgba(0,0,0,.3)', 1.2); g.fillStyle = 'rgba(255,210,63,.85)'; g.fillRect(w / 2 - 3, 20, 6, h - 40); }));
      }
      A.gambrel = E.mesh(G.extrude([[-1, 0], [1, 0], [0.78, 0.6], [0, 0.95], [-0.78, 0.6]], 1));
      A.cone4 = E.mesh(G.cylinder(0.02, 0.5, 1, 4, true)); A.cone8 = E.mesh(G.cylinder(0.04, 0.5, 1, 7, true));
      A.tBarnSide = T(plankTex('#c4362c')); A.tBarnFront = T(barnFrontTex(), { repeat: false }); A.tPlankV = T(plankTex('#a8784a'));
      A.tHay = T(canvas(128, 128, (g, w, h) => { g.fillStyle = '#e2b94e'; g.fillRect(0, 0, w, h); for (let i=0;i<900;i++) { g.strokeStyle = ['#f2d27a','#c9982e','#ffe7a0'][i % 3]; g.lineWidth = 1.2; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + (Math.random() - .5) * 3); g.stroke(); } }));
      A.tCrop = T(cropTex()); A.tGravel = T(gravelTex()); A.tFarmGrass = T(farmGrassTex()); A.tPaver = T(paverTex());
      A.tPlaza = T(plazaTex('#d9cfbf', '#b8ab98')); A.tConcrete = T(plazaTex('#c4c8cf', '#9aa0a8'));
      A.bricks = SHOPS.map(S => T(brickTex(S.wall))); A.shopFronts = SHOPS.map(S => T(shopFrontTex(S), { repeat: false })); A.awnings = SHOPS.map(S => T(stripeTex(S.awn[0], S.awn[1])));
      A.facades = TOWERS.map(Tw => T(facadeTex(Tw))); A.tLobby = T(lobbyTex(), { repeat: false }); A.tChecker = T(canvas(256, 16, (g, w, h) => { for (let x=0;x<w;x+=8) for (let y=0;y<h;y+=8) { g.fillStyle = ((x + y) / 8) % 2 ? '#111' : '#fff'; g.fillRect(x, y, 8, 8); } })); A.tSkyline = T(skylineTex(), { repeat: true, clampV: true });
      buildPrefabs();
      return A;
    }
    function heartShape(){ const pts = []; for (let i=0;i<40;i++) { const t = i / 40 * Math.PI * 2; pts.push([0.016 * 16 * Math.pow(Math.sin(t), 3), 0.016 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t))]); } return pts.reverse(); }
    function starShape(ro, ri){ const pts = []; for (let i=0;i<10;i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return pts; }

    // ---------- world state ----------
    // The street is made of straight segments joined at intersections. At the end of each segment the
    // raccoon must turn left or right (an arrow sign shows the open way). Every object belongs to a
    // segment and is placed by 'at' (distance along the route) and x (sideways), exactly like a straight road;
    // only the drawing turns those into real positions.
    function fresh(mode, rand, lives, phase){
      st = {
        mode, phase, rand, lives, score:0, food:0, dist:0, t:0, time:0, speed:12, mile: 0, bestDist: (PB.bestOf && PB.bestOf('dash')) || 0, recordShown: false, streak: 0, tally: null,
        player:{ lane:1, x:0, h:0, vy:0, slide:0, queueSlide:false, inv:0, run:0, turnQ:null },
        objs:[], powIn:6, fx:{ magnet:0, shield:0, double:0, zoom:0, spring:0, slow:0, balloon:0, gold:0, giant:0 }, mult: 1,
        pops:[], parts:[], shake:0, msg:null,
        segs:[], segN:0, cur:0, prev:-1, camTh:0, turns:0,
        dog:{ d: phase === 'menu' ? 99 : 3.2, chase: phase === 'menu' ? 0 : 3.5, bark:0 },
      };
      const s0 = newSeg(0, [0, 0], 0, null, 'open');
      s0.rowAt = 28;
      if (phase !== 'menu') planJunction(s0, 150 + Math.random() * 50);
      fillScenery();
      if (phase === 'menu') for (let i=0;i<5;i++) st.objs.push({ kind:'coin', seg: 0, lane:1, x: 0, at: 12 + i * 1.6, h:0.45 });
    }
    function newSeg(start, origin, th, parent, kind, near){
      const s = { id: st.segN++, start, origin, th, parent, kind, near: near || 0, J: Infinity, jtype: null, arms: null, theme: parent == null ? 'houses' : (Math.random() < 0.4 ? 'park' : 'houses'),
        sceneAt: { '-1': parent == null ? start - 10 : (near === -1 ? start + 27 : start), '1': parent == null ? start - 10 : (near === 1 ? start + 27 : start) },
        decoAt: parent == null ? start - 10 : start + 9, rowAt: start + 26, crossDone: false };
      st.segs[s.id] = s; return s;
    }
    // streets get shorter (corners come faster) the longer you run
    const segLen = () => (140 + Math.random() * 90) * (1 - 0.35 * diff());
    const diff = () => Math.min(1, (st.t || 0) / 150);
    function planJunction(s, len){
      s.J = s.start + len;
      const r = Math.random();
      s.jtype = r < 0.4 ? 'T' : r < 0.7 ? 'L' : 'R';
    }
    function makeArms(s){
      const o = segPt(s, s.J, 0);
      const L = newSeg(s.J, o, s.th - Math.PI / 2, s.id, s.jtype === 'R' ? 'closed' : 'open', -1);
      const Rr = newSeg(s.J, o, s.th + Math.PI / 2, s.id, s.jtype === 'L' ? 'closed' : 'open', 1);
      for (const a of [L, Rr]) if (a.kind === 'open') planJunction(a, segLen());
      s.arms = { left: L, right: Rr };
      // big arrow sign across the street, and a crosswalk before the corner
      st.objs.push({ kind:'sign', seg: s.id, at: s.J + 8.2, x: 0, dirs: s.jtype });
      st.objs.push({ kind:'decal', type:'cross', seg: s.id, x: 0, at: s.J - 9 });
      for (const sd of [-1, 1]) st.objs.push({ kind:'tree', seg: s.id, side: sd, x: sd * 10.5, at: s.J - 14, s: 1.05, rot: Math.random() * 6, tint: 1, bloom: Math.random() < 0.3 });
      for (const a of [L, Rr]) if (a.kind === 'closed') st.objs.push({ kind:'barrier', seg: a.id, at: a.start + 7.5, x: 0 });
    }
    const segPt = (s, at, x) => { const d = at - s.start, f = [Math.sin(s.th), -Math.cos(s.th)], r = [Math.cos(s.th), Math.sin(s.th)]; return [s.origin[0] + f[0] * d + r[0] * x, s.origin[1] + f[1] * d + r[1] * x]; };
    const curSeg = () => st.segs[st.cur];
    // lots, trees and street furniture for one segment up to 'upto' along the route
    function genSeg(s, upto){
      const R = Math.random, lim = s.kind === 'closed' ? s.start + 60 : s.J - 26;
      for (const side of [-1, 1]) {
        while (st.segs[s.id].sceneAt[side] < upto && s.sceneAt[side] + 15 < lim) {
          const zn = zoneAt(s.sceneAt[side]);
          if (zn === 'farm') { const v = R(); st.objs.push({ kind:'bld', z: zn, seg: s.id, side, at: s.sceneAt[side], len: 24, v: v < 0.3 ? 'barn' : v < 0.5 ? 'corn' : v < 0.7 ? 'pasture' : v < 0.85 ? 'field' : 'farmhouse', r: R() * 6, tree: R() < 0.5, treeS: 0.9 + R() * 0.4, rot: R() * 6 }); s.sceneAt[side] += 24; continue; }
          if (zn === 'town') { st.objs.push({ kind:'bld', z: zn, seg: s.id, side, at: s.sceneAt[side], len: 12, v: Math.floor(R() * SHOPS.length) }); s.sceneAt[side] += 12; continue; }
          if (zn === 'city') { st.objs.push({ kind:'bld', z: zn, seg: s.id, side, at: s.sceneAt[side], len: 15, v: Math.floor(R() * TOWERS.length), hi: Math.floor(R() * TOWER_H.length) }); s.sceneAt[side] += 15; continue; }
          const len = LOT_LENS[Math.floor(R() * LOT_LENS.length)];
          if (s.theme === 'park') { const v = R(); st.objs.push({ kind:'park', seg: s.id, side, at: s.sceneAt[side], len: 14, v: v < 0.22 ? 'pond' : v < 0.42 ? 'play' : v < 0.58 ? 'fountain' : 'trees', r: R() * 1000 }); s.sceneAt[side] += 14; continue; }
          st.objs.push({ kind:'bld', seg: s.id, side, at: s.sceneAt[side], len, h: Math.floor(R() * HOUSE_N), front: R() < 0.6 ? 'hedge' : 'fence', tree: R() < 0.55, treeS: 0.9 + R() * 0.4, setback: 16, rot: R() * 6 });
          s.sceneAt[side] += len;
        }
      }
      const dlim = s.kind === 'closed' ? s.start + 60 : s.J - 10;
      while (s.decoAt < upto && s.decoAt < dlim) {
        const zd = zoneAt(s.decoAt);
        for (const side of [-1, 1]) {
          const r = R(), tree = () => st.objs.push({ kind:'tree', seg: s.id, side, at: s.decoAt + R() * 2, s: 0.7 + R() * 0.3, rot: R() * 6, tint: 0.85 + Math.floor(R() * 3) * 0.15, bloom: R() < 0.18 });
          if (zd === 'farm') { if (r < 0.3) tree(); else if (r < 0.5) st.objs.push({ kind:'deco', type:'bale', seg: s.id, side, at: s.decoAt + 2, rot: R() * 6 }); else if (r < 0.7) st.objs.push({ kind:'deco', type:'sunflower', seg: s.id, side, at: s.decoAt + 1, rot: R() * 6 }); else if (r < 0.8) st.objs.push({ kind:'deco', type:'mailbox', seg: s.id, side, at: s.decoAt + 4, rot: 0 }); }
          else if (zd === 'town') { if (r < 0.3) tree(); else if (r < 0.6) st.objs.push({ kind:'lamp', seg: s.id, side, at: s.decoAt + 3 }); else if (r < 0.75) st.objs.push({ kind:'deco', type:'bench', seg: s.id, side, at: s.decoAt + 5, rot: 0 }); else if (r < 0.9) st.objs.push({ kind:'hydrant', seg: s.id, side, at: s.decoAt + 1 }); }
          else if (zd === 'city') { if (r < 0.15) tree(); else if (r < 0.55) st.objs.push({ kind:'lamp', seg: s.id, side, at: s.decoAt + 3 }); else if (r < 0.75) st.objs.push({ kind:'hydrant', seg: s.id, side, at: s.decoAt + 1 }); else if (r < 0.85) st.objs.push({ kind:'deco', type:'bench', seg: s.id, side, at: s.decoAt + 5, rot: 0 }); }
          else if (r < 0.28) tree();
          else if (r < 0.7) st.objs.push({ kind:'hydrant', seg: s.id, side, at: s.decoAt + 1 });
          else if (r < 0.85) st.objs.push({ kind:'lamp', seg: s.id, side, at: s.decoAt + 3 });
        }
        if (s.kind === 'open' && R() < 0.12 && s.decoAt > s.start + 20 && (zd === 'houses' || zd === 'town')) st.objs.push({ kind:'bunting', seg: s.id, at: s.decoAt + 4, x: 0, c: Math.floor(R() * 4) });
        if (st.bestDist > 60 && !st.bestFlag && st.bestDist >= s.decoAt && st.bestDist < s.decoAt + 9 && st.bestDist < dlim - 6) { st.bestFlag = true; st.objs.push({ kind:'bestflag', seg: s.id, at: st.bestDist, x: 0 }); }
        if (s.kind === 'open' && zd !== 'farm' && R() < 0.35) st.objs.push({ kind:'decal', type:'manhole', seg: s.id, x: (Math.floor(R() * 3) - 1) * LANE + (R() - .5) * 0.8, at: s.decoAt + R() * 9 });
        s.decoAt += 9;
      }
    }
    function fillScenery(){
      const s = curSeg(), horizon = st.dist + VIEW + 10;
      if (st.phase === 'play' && s.J === Infinity) planJunction(s, segLen());
      genSeg(s, horizon);
      if (s.J < horizon + 30 && !s.arms) makeArms(s);
      if (s.arms) for (const a of [s.arms.left, s.arms.right]) genSeg(a, Math.max(horizon, s.J + 70));
      // butterflies over the lawns of the street you're on
      const R = Math.random;
      if (!st.bugs) st.bugs = Array.from({ length: 7 }, (_, i) => ({ side: i % 2 ? 1 : -1, x: 4.5 + R() * 4, y: 0.8 + R() * 1.6, at: st.dist + R() * 60, ph: R() * 6, seg: st.cur, col: [[1, 0.85, 0.2], [0.55, 0.8, 1], [1, 0.55, 0.8], [1, 1, 1]][i % 4] }));
      for (const b of st.bugs) if (b.at < st.dist - 5 || b.seg !== st.cur && st.dist > (st.segs[b.seg].J || 0) + 10) { b.seg = st.cur; b.at = st.dist + 30 + R() * 40; b.x = 4.5 + R() * 4; if (b.at > s.J - 10) b.at = st.dist + 6; }
    }
    function pickPower(){
      const room = curSeg().J - st.dist;
      const entries = Object.entries(POWERS).filter(([k]) => !(k === 'life' && st.lives >= MAX_LIVES) && !(k === 'balloon' && room < 150));
      let roll = st.rand() * entries.reduce((s,[,p]) => s + p.weight, 0);
      for (const [k,p] of entries) { roll -= p.weight; if (roll <= 0) return k; }
      return 'magnet';
    }
    const laneX = l => (l - 1) * LANE;
    // a row of things to dodge, plus something to collect. Returns how much extra room the row needs.
    function trail(kind, lane, at0, n, step, hFn, extra){
      for (let i=0;i<n;i++) { const at = at0 + i * step, o = { kind, seg: st.cur, lane, x: laneX(lane), at, h: hFn ? hFn(i, at) : 0.45, ...(extra || {}) }; if (kind === 'food') o.type = extra && extra.type || FOODS[Math.floor(st.rand() * FOODS.length)]; st.objs.push(o); }
    }
    function spawnRow(at){
      const R = st.rand, sg = curSeg();
      const r = R(), early = st.t < 10;
      // school buses parked in the lanes: run up a ramp and along the roofs
      const df = diff();
      if (!early && r < 0.2 + 0.12 * df && at + 34 < sg.J - 32) {
        const lanes = [0, 1, 2].sort(() => R() - .5), n = R() < 0.55 ? 1 : 2, buses = lanes.slice(0, n);
        let longest = 0;
        buses.forEach((l, i) => {
          const count = R() < 0.4 ? 2 : 1, ramp = i === 0 ? R() < 0.8 : R() < 0.35;
          for (let k=0;k<count;k++) st.objs.push({ kind:'obs', seg: st.cur, type:'bus', lane: l, at: at + k * (BUS_LEN + 0.6), len: BUS_LEN, ramp: ramp && k === 0, color: k % 2 ? '#ffc21a' : '#ffcc33' });
          const total = count * (BUS_LEN + 0.6);
          longest = Math.max(longest, total);
          if (ramp) trail('coin', l, at - 3, Math.floor(total / 1.6) + 2, 1.6, (i2, a2) => a2 < at ? 0.45 + BUS_H * Math.max(0, 1 + (a2 - at) / RAMP) : BUS_H + 0.45);
        });
        const free = lanes.slice(n);
        if (free.length) trail('coin', free[0], at - 2, 8, 2, null);
        return longest + 6;
      }
      // a construction trench across the street: jump it!
      if (!early && r < 0.32 + 0.2 * df && at + 10 < sg.J - 32) {
        st.objs.push({ kind:'obs', seg: st.cur, type:'gap', lane: -1, at, len: 2.6 });
        const arcL = Math.floor(R() * 3);
        trail('coin', arcL, at - 2.4, 6, 1.05, (i) => 0.45 + 1.4 * Math.sin(Math.PI * i / 5));
        return 4;
      }
      const lanes = [0,1,2].sort(() => R() - .5);
      const pick = () => { const q = R(); return q < .36 ? 'cone' : q < .68 ? 'can' : 'truck'; };
      const pat = R(), used = [];
      if (pat < 0.38 - 0.22 * df) used.push(lanes[0]); else if (pat < 0.8 + 0.15 * df) used.push(lanes[0], lanes[1]);
      const city = zoneAt(at) === 'city', row = used.map(l => { const o = { kind:'obs', seg: st.cur, type: pick(), lane:l, at, color: city && R() < 0.7 ? '#ffc61a' : VANS[Math.floor(R()*VANS.length)] }; if (city && o.color === '#ffc61a') o.taxi = true; if (o.type === 'truck' && df > 0.25 && R() < 0.25 + 0.5 * df) { o.moving = 5 + 5 * df; o.at += o.moving * 3; } return o; });
      st.objs.push(...row);
      const free = [0,1,2].filter(l => !used.includes(l));
      const ft = FOODS[Math.floor(R()*FOODS.length)];
      if (free.length && R() < (st.t < 30 ? 0.5 : 0.6)) { const fl = free[Math.floor(R()*free.length)]; trail('coin', fl, at - 6, R() < 0.5 ? 9 : 6, 1.5, null); }
      if (st.fx.gold > 0) for (const fl of free) trail('coin', fl, at - 8, 6, 1.4, null);
      const low = row.find(o => o.type === 'cone' || o.type === 'can');
      if (low && R() < 0.3) trail('coin', low.lane, at - 2.4, 5, 1.2, (i) => 0.45 + 1.5 * Math.sin(Math.PI * i / 4));
      if (st.powIn <= 0 && free.length) { const pl = free[free.length-1]; st.objs.push({ kind:'pow', seg: st.cur, type: pickPower(), lane: pl, x: laneX(pl), at: at + 9, h: 0.9 }); st.powIn = 5.5 + R() * 4; }
      return 0;
    }

    function act(dir){
      if (st.phase === 'ready') { st.phase = 'play'; st.msg = null; }
      if (st.phase === 'tally') { skipTally(); return; }
      if (st.phase !== 'play') return;
      const p = st.player, s = curSeg();
      if ((dir === 'left' || dir === 'right') && s.arms && st.dist > s.J - 18) { p.turnQ = dir; p.lane = 1; if (PB.sfx) PB.sfx('pick'); return; }
      if (dir === 'left' && p.lane > 0) { p.prevLane = p.lane; p.lane--; }
      else if (dir === 'right' && p.lane < 2) { p.prevLane = p.lane; p.lane++; }
      else if (dir === 'up') { if (!p.air) { if (PB.sfx) { PB.sfx('jump'); PB.sfx(['woohoo', 'yippee', 'wahoo'][Math.floor(Math.random() * 3)]); } p.slide = 0; p.vy = st.fx.spring > 0 ? 13.4 : 9.85; if (st.rig) { st.rig.jk = 0; st.rig.jturns = st.fx.spring > 0 ? 2 : 1; } } }
      else if (dir === 'down') { if (PB.sfx) { PB.sfx('whoosh'); PB.sfx('wheee'); } if (p.air) { p.vy = -16; p.queueSlide = true; } else p.slide = 0.62; }
    }
    function pop(wp, text, color, life){ st.pops.push({ wp, text, color, life: life || 1, rise: 0 }); }
    function sparkle(pos, color, n = 10){
      if (reduceMotion) return;
      for (let i=0;i<n;i++) { const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3; st.parts.push({ p: [pos[0], pos[1], pos[2]], v: [Math.cos(a) * s, 2 + Math.random() * 3, Math.sin(a) * s], life: 0.6, color, size: 0.18 }); }
    }
    const playerPos = () => [st.player.x, st.player.h + 0.7, 0];
    // small things (gnomes, trash cans) only trip you up, but the bulldog catches up. Trip twice while he's close and he gets you.
    function stumble(o){
      o.hit = true;
      const p = st.player; if (p.inv > 0) return;
      if (st.fx.zoom > 0 || st.fx.shield > 0 || st.fx.giant > 0) { crash(o); return; }
      o.fly = { vy: 6, y: 0, rot: 0, vr: (Math.random() < .5 ? -1 : 1) * 5, vx: (Math.random() - .5) * 4 };
      if (st.dog.chase > 0 && st.dog.d < 6) { st.dog.d = 0.6; st.dog.chase = 0; st.dog.caught = 0.8; crash(o, 'Caught!'); return; }
      st.dog.chase = 7 + 3 * diff(); st.dog.d = Math.min(st.dog.d, 3.6); st.dog.bark = 0.01; p.inv = 0.5; st.shake = 6; st.lookT = 0.9;
      if (PB.sfx) { PB.sfx('oof'); PB.sfx('bark'); }
      pop(playerPos(), 'Whoa!', '#ffb800');
      if (st.rig) st.rig.trip = 0.45;
    }
    function crash(o, label){
      o.hit = true; if (PB.sfx) { PB.sfx('oof'); PB.sfx('crash'); }
      const p = st.player;
      if (p.inv > 0) return;
      if (st.fx.zoom > 0 || st.fx.giant > 0) { if (st.fx.giant > 0 && PB.sfx) PB.sfx('boom'); o.fly = { vy: 9, y: 0, rot: 0, vr: (Math.random() < .5 ? -1 : 1) * 6, vx: (Math.random() - .5) * 6 }; addCoins(1); pop(playerPos(), 'SMASH!', '#ff7a2f'); st.shake = 6; return; }
      if (st.fx.shield > 0) { st.fx.shield = 0; if (!o.type || o.type !== 'bus') o.fly = { vy: 7, y: 0, rot: 0, vr: 5, vx: 3 }; p.inv = 1; st.boardFly = { t: 0, x: p.x, h: p.h }; pop(playerPos(), 'Board saved you!', '#3fa9ff'); if (PB.sfx) PB.sfx('crash'); return; }
      st.lives--; p.inv = 1.6; st.shake = 14; st.lookT = 1.0; st.streak = 0; st.turnCrashed = true; st.dog.chase = Math.max(st.dog.chase, 4); st.dog.d = Math.min(st.dog.d, 4);
      pop(playerPos(), label || 'Ouch!', '#ff3d6e');
      if (st.lives <= 0) startTally(label === 'Caught!' ? 'Caught!' : 'Run over!');
    }
    function openGift(){
      const p = st.player, r = Math.random();
      sparkle([p.x, p.h + 1, -0.3], [0.8, 0.5, 1], 24);
      if (r < 0.45) { const n = 15 + Math.floor(Math.random() * 3) * 10; st.coins = (st.coins || 0) + n; pop(playerPos(), `+${n} coins!`, '#ffd23f', 1.4); if (PB.sfx) PB.sfx('win'); }
      else if (r < 0.6 && st.lives < MAX_LIVES) { st.lives++; pop(playerPos(), 'Extra heart!', '#ff3d6e', 1.4); if (PB.sfx) PB.sfx('life'); }
      else { const pick = ['magnet', 'shield', 'double', 'spring', 'gold', 'giant'][Math.floor(Math.random() * 6)]; st.fx[pick] = POWERS[pick].time; pop(playerPos(), POWERS[pick].name + '!', POWERS[pick].color, 1.4); if (PB.sfx) PB.sfx('power'); }
    }
    function collect(o){ if (PB.sfx) PB.sfx(o.kind === 'pow' ? 'power' : 'coin');
      o.gone = true;
      if (o.kind === 'food') {
        st.food++; if (PB.sfx && st.food % 3 === 0) PB.sfx('nom'); if (st.food % 5 === 0) addCoins(1);
        if (st.fx.gold > 0) addCoins(1);
        sparkle([st.player.x, st.player.h + 1.2, -0.3], [1, 0.85, 0.3], 5);
        if (st.rig) st.rig.fly.push({ type: o.type, p: [o.x, o.h, wz(o.at)], t: 0 });
        if (st.food % 25 === 0) pop(playerPos(), st.food + ' snacks!', '#ffb800');
      } else {
        const Pw = POWERS[o.type];
        if (o.type === 'gift') { openGift(); return; }
        if (o.type === 'life') st.lives = Math.min(MAX_LIVES, st.lives + 1); else st.fx[o.type] = Pw.time;
        if (o.type === 'giant' && PB.sfx) PB.sfx('boom');
        if (o.type === 'balloon') {
          const span = Math.min(Pw.time * st.speed, curSeg().J - st.dist - 25);
          st.fx.balloon = Math.max(1.5, span / st.speed);
          for (let a = 8, i = 0; a < span - 4; a += 2.2, i++) { const l = Math.floor(i / 6) % 3; st.objs.push({ kind:'coin', seg: st.cur, lane: l, x: laneX(l), at: st.dist + a, h: 6.9 }); }
          if (PB.sfx) PB.sfx('yay');
        }
        sparkle([st.player.x, st.player.h + 0.8, -0.3], E.hex(Pw.color), 18);
        pop(playerPos(), Pw.name + '!', Pw.color, 1.3); st.lookT = 0.9;
      }
    }
    function update(dt){
      const p = st.player, fx = st.fx;
      st.t += dt;
      for (const k in fx) if (fx[k] > 0) fx[k] = Math.max(0, fx[k] - dt);
      st.powIn -= dt;
      st.speed = st.t < 82 ? 12 + st.t * 0.17 : Math.min(31, 26 + (st.t - 82) * 0.04);
      const sp = st.speed * (fx.zoom > 0 ? 1.8 : 1) * (fx.slow > 0 ? 0.6 : 1);
      const dz = sp * dt;
      st.dist += dz;
      st.score = Math.floor(st.dist);
      // distance milestones
      { const mk = Math.floor(st.dist / 250); if (mk > (st.mile || 0)) { st.mile = mk; pop(playerPos(), `${fmt(mk * 250)} m!`, '#5ee0ff', 1.2); if (PB.sfx) PB.sfx('level'); }
        if (!st.recordShown && st.bestDist > 50 && st.dist > st.bestDist) { st.recordShown = true; pop(playerPos(), 'New distance record!', '#7dff6a', 1.6); if (PB.sfx) PB.sfx('win'); } }
      { const zi = zoneIdx(st.dist); if (zi !== st.zoneI) { st.zoneI = zi; st.zoneBanner = { i: zi, t: 0 }; if (zi > 0 && PB.sfx) PB.sfx('fanfare'); } }
      const sg = curSeg();
      while (st.dist + 75 > sg.rowAt && sg.rowAt < sg.J - 32) { const extra = spawnRow(sg.rowAt); sg.rowAt += Math.max(10.5, 19 - st.t * 0.08 - 2 * diff()) + extra; }
      fillScenery();
      // the corner
      if (sg.arms && st.dist >= sg.J) {
        const want = p.turnQ, arm = want ? sg.arms[want] : null;
        if (arm && arm.kind === 'open') doTurn(arm);
        else if (arm || st.dist >= sg.J + 1.2) {
          crash({}, arm ? 'Road closed!' : 'Missed the turn!');
          if (st.phase !== 'play') return;
          doTurn(sg.arms.left.kind === 'open' ? sg.arms.left : sg.arms.right);
        }
      }
      // the bulldog
      const dg = st.dog;
      if (dg.chase > 0) { dg.chase -= dt; dg.d += (2.6 - dg.d) * Math.min(1, dt * 2); }
      else dg.d += dt * 4;
      if (dg.bark > 0) { dg.bark -= dt; } else if (dg.chase > 0 && dg.d < 5 && Math.random() < dt * 0.9) { dg.bark = 0.5; if (PB.sfx) PB.sfx('bark'); }
      if (dg.caught) dg.caught = Math.max(0, dg.caught - dt);
      p.x += (laneX(p.lane) - p.x) * Math.min(1, dt * 14);
      // the ground can be the street, a ramp, or the roof of a school bus
      const gl = groundAt(p.x, st.dist);
      if (fx.balloon > 0) { p.h += (6.4 + Math.sin(st.time * 3) * 0.15 - p.h) * Math.min(1, dt * 2.5); p.vy = 0; p.slide = 0; }
      else if (p.vy > 0 || p.h > gl + 0.03) { p.vy -= 30.3 * dt; p.h += p.vy * dt; if (p.h <= gl) { p.h = gl; p.vy = 0; if (p.queueSlide) { p.slide = 0.55; p.queueSlide = false; } } }
      else { p.h = gl; p.vy = 0; }
      p.air = p.h > gl + 0.03; p.ground = gl;
      if (p.slide > 0) p.slide = Math.max(0, p.slide - dt);
      if (p.inv > 0) p.inv = Math.max(0, p.inv - dt);
      p.run += dt * sp * 0.9;
      st.lookT = (st.lookT || 0) - dt;
      for (const o of st.objs) {
        if (o.gone) continue;
        const rel = o.at - st.dist;
        if (o.seg !== st.cur) continue;
        if (o.moving && !o.hit) { o.at -= o.moving * dt; }
        if (o.kind === 'obs' && o.type === 'bus') {
          const inLane = Math.abs(laneX(o.lane) - p.x) < 1.15;
          if (!o.hit && inLane && rel < 0.35 && rel > -o.len && p.h < BUS_H - 0.4 && fx.giant > 0) { o.hit = true; o.squash = 1; addCoins(1); pop(playerPos(), 'STOMP!', '#ff5a4a'); st.shake = 10; if (PB.sfx) PB.sfx('boom'); }
          if (!o.hit && inLane && rel < 0.35 && rel > -o.len && p.h < BUS_H - 0.4) {
            if (rel > -0.7) { crash(o, 'Bonk! A bus!'); if (st.phase !== 'play') return; bounceLane(o); }
            else { stumble({}); if (st.phase !== 'play') return; bounceLane(o); }
          }
          continue;
        }
        if (o.kind === 'obs' && o.type === 'gap') {
          if (!o.hit && rel < 0 && rel > -o.len + 0.3 && p.h < 0.12 && !(fx.giant > 0)) { crash(o, 'Into the hole!'); p.vy = 11; if (st.phase !== 'play') return; }
          continue;
        }
        if (o.kind === 'coin') {
          if (fx.magnet > 0 && rel < 22 && rel > -0.5) o.mag = true;
          if (o.mag) { o.x += (p.x - o.x) * Math.min(1, dt * 9); o.h += (p.h + 0.5 - o.h) * Math.min(1, dt * 9); o.at -= 20 * dt; }
          if ((Math.abs(rel) < 0.9 && Math.abs(o.x - p.x) < 1.2 && Math.abs(o.h - (p.h + (p.slide > 0 ? 0.3 : 0.6))) < 1.0) || (o.mag && rel < 0.2)) collectCoin(o);
          continue;
        }
        if (o.kind === 'obs' && !o.hit) {
          if (rel < DEPTH[o.type] && rel > -0.6 && Math.abs(laneX(o.lane) - p.x) < 1.25) {
            const blocked = o.type === 'cone' ? p.h < 0.8 : o.type === 'can' ? p.h < 1.05 : true;
            if (blocked) { if (o.type === 'cone' || o.type === 'can') stumble(o); else crash(o); }
            if (st.phase !== 'play') return;
          }
        } else if (o.kind === 'food' || o.kind === 'pow') {
          if (o.kind === 'food' && fx.magnet > 0 && rel < 22 && rel > -0.5) o.mag = true;
          if (o.mag) { o.x += (p.x - o.x) * Math.min(1, dt * 9); o.h += (p.h + 0.5 - o.h) * Math.min(1, dt * 9); o.at -= 20 * dt; }
          const near = Math.abs(o.at - st.dist) < 0.9 && Math.abs(o.x - p.x) < 1.2 && Math.abs(o.h - (p.h + (p.slide > 0 ? 0.3 : 0.6))) < 1.0;
          if (near || (o.mag && o.at - st.dist < 0.2)) collect(o);
        }
        if (o.fly) { o.fly.vy -= 22 * dt; o.fly.y += o.fly.vy * dt; o.fly.rot += o.fly.vr * dt; o.fly.x = (o.fly.x || 0) + o.fly.vx * dt; }
      }
      st.objs = st.objs.filter(keepObj);
    }
    // keep what's on this street (and the streets around the next corner), forget streets we've left behind
    function keepObj(o){
      if (o.gone) return false;
      const s = curSeg();
      if (o.seg === st.cur) return o.kind === 'sign' || (o.at + (o.len || 0) - st.dist) > -12;
      if (s.arms && (o.seg === s.arms.left.id || o.seg === s.arms.right.id)) return true;
      if (o.seg === st.prev) return st.dist - s.start < 45;
      return false;
    }
    function groundAt(x, d){
      let g = 0;
      for (const o of st.objs) {
        if (o.type !== 'bus' || o.squash || o.seg !== st.cur || Math.abs(laneX(o.lane) - x) > 1.0) continue;
        const r = d - o.at;
        if (r >= 0 && r <= o.len) g = Math.max(g, BUS_H);
        else if (o.ramp && r < 0 && r > -RAMP) g = Math.max(g, BUS_H * (1 + r / RAMP));
      }
      return g;
    }
    // bumped into a bus: hop back to a lane that's clear
    function bounceLane(o){
      const p = st.player, clear = l => !st.objs.some(b => b.type === 'bus' && b.seg === st.cur && b.lane === l && st.dist >= b.at - 1 && st.dist <= b.at + b.len);
      const order = [p.prevLane, 1, 0, 2].filter(l => l != null && l !== o.lane);
      for (const l of order) if (clear(l)) { p.lane = l; break; }
      if (p.lane === o.lane) { p.vy = 14; }
    }
    function collectCoin(o){
      o.gone = true; addCoins(1);
      if (PB.sfx) PB.sfx('gem', Math.min(1, ((st.coinStreak = (st.time - (st.lastCoinT || 0) < 0.35 ? (st.coinStreak || 0) + 1 : 0)) % 8) / 8)); st.lastCoinT = st.time;
      sparkle([st.player.x, st.player.h + 1.1, -0.3], [1, 0.85, 0.2], 3);
    }
    // coins are the only bonus: at the end of a run every coin adds COIN_M meters to the distance
    const COIN_M = 1;
    function addCoins(n){ st.coins = (st.coins || 0) + n * (st.fx && st.fx.double > 0 ? 2 : 1); }
    function startTally(label){
      st.phase = 'tally'; st.speed = 0;
      st.tally = { t: 0, base: Math.floor(st.dist), coins: st.coins || 0, left: st.coins || 0, bonus: 0, done: 0, tick: 0, label: label || 'Run over!', best: st.bestDist || 0, fly: [], pops: [], conf: [], bump: 0, spawn: 0 };
      if (PB.wallet && st.coins) PB.wallet.add(st.coins * (PB.meta ? PB.meta.coinMult('dash') : 1));
      if (PB.sfx) PB.sfx('lose');
    }
    // Results card timeline: banner + card (0-1 s), "Coin bonus!" strip (1-1.9 s), coins pour into the distance, then the total
    const T_COUNT = 1.9;
    function updateTally(dt){
      const T = st.tally; T.t += dt;
      if (T.t < T_COUNT) return;
      if (T.left > 0) {
        const rate = Math.max(14, T.coins / 2.4); T.acc = (T.acc || 0) + rate * dt;
        while (T.acc >= 1 && T.left > 0) { T.acc -= 1; T.left--; T.bonus += COIN_M; T.bump = 1; if (PB.sfx && (T.tick++ % 2 === 0)) PB.sfx('tick', 1 - T.left / Math.max(1, T.coins)); }
        T.spawn -= dt; if (T.spawn <= 0 && T.left > 0) { T.spawn = 0.055; T.fly.push({ k: 0, sx: (Math.random() - .5) * 20 }); }
        if (T.left === 0) finishCount(T);
        return;
      }
      if (!T.done) finishCount(T);
      if (T.t - T.done > (T.record ? 2.4 : 1.6) && !T.sent) sendOver(T);
    }
    function finishCount(T){
      if (T.done) return;
      T.done = T.t; T.bump = 1.4;
      const total = T.base + T.bonus; T.record = T.best > 0 && total > T.best;
      if (PB.sfx) PB.sfx(T.record ? 'fanfare' : 'win');
      const n = T.record ? 90 : 36; for (let i=0;i<n;i++) T.conf.push({ x: W / 2 + (Math.random() - .5) * 120, y: 300, vx: (Math.random() - .5) * 520, vy: -250 - Math.random() * 420, r: Math.random() * 6, vr: (Math.random() - .5) * 14, c: ['#ffd23f','#ff4f8b','#5ee0ff','#7dff6a','#c77dff','#ff9f1c'][i % 6], s: 5 + Math.random() * 5, life: 2.6 });
      if (st.rig) { st.player.vy = 0; }
    }
    function sendOver(T){ T.sent = true; st.phase = 'over'; const total = T.base + T.bonus; st.score = total; shell.gameOver(total, `${fmt(T.base)} m run + ${fmt(T.bonus)} m from ${fmt(T.coins)} coin${T.coins === 1 ? '' : 's'}`); }
    // tapping during the results skips straight to the total
    function skipTally(){
      const T = st.tally; if (!T || T.sent) return;
      if (T.t < T_COUNT || T.left > 0) { T.t = Math.max(T.t, T_COUNT); T.bonus += T.left * COIN_M; T.left = 0; finishCount(T); }
      else if (T.t - T.done > 0.5) sendOver(T);
    }
    function tallyFx(dt){
      const T = st.tally;
      T.bump = Math.max(0, T.bump - dt * 5);
      for (const f of T.fly) { const was = f.k; f.k += dt / 0.42; if (was < 1 && f.k >= 1) { T.pops.push({ t: 0, x: W / 2 + (Math.random() - .5) * 90 }); for (let i=0;i<5;i++) T.conf.push({ x: W / 2 + (Math.random() - .5) * 60, y: TY.total, vx: (Math.random() - .5) * 260, vy: -120 - Math.random() * 160, r: 0, vr: 0, c: '#ffe066', s: 3 + Math.random() * 3, life: 0.5, star: true }); } }
      T.fly = T.fly.filter(f => f.k < 1);
      for (const q of T.pops) q.t += dt; T.pops = T.pops.filter(q => q.t < 0.7);
      for (const c of T.conf) { c.vy += 620 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.99; c.r += c.vr * dt; c.life -= dt; }
      T.conf = T.conf.filter(c => c.life > 0 && c.y < H + 20);
    }
    function doTurn(arm){
      const p = st.player;
      st.prev = st.cur; st.cur = arm.id; st.turns++;
      arm.rowAt = arm.start + 34;
      p.turnQ = null; p.lane = 1; p.x = 0;
      if (!st.turnCrashed) { st.streak = Math.min(5, (st.streak || 0) + 1); addCoins(st.streak); pop(playerPos(), `Nice turn! +${st.streak} coin${st.streak > 1 ? 's' : ''}`, '#7dff6a', 1.0); if (st.streak > 1 && PB.sfx) PB.sfx('level'); }
      st.turnCrashed = false;
      if (PB.sfx) PB.sfx('whoosh');
      // drop the street we didn't take
      const old = st.segs[st.prev], other = old.arms.left === arm ? old.arms.right : old.arms.left;
      st.objs = st.objs.filter(o => o.seg !== other.id);
    }
    function scrollMenu(dt){ st.dist += 5 * dt; st.player.run += dt * 5; fillScenery(); st.objs = st.objs.filter(keepObj); }
    function effects(dt){
      st.time += dt;
      for (const q of st.parts) { q.p[0] += q.v[0]*dt; q.p[1] += q.v[1]*dt; q.p[2] += q.v[2]*dt; q.v[1] -= 9*dt; q.life -= dt; }
      st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.rise += 40 * dt; q.life -= dt; }
      st.pops = st.pops.filter(q => q.life > 0);
      st.shake = Math.max(0, st.shake - dt * 40);
      if (st.zoneBanner) { st.zoneBanner.t += dt; if (st.zoneBanner.t > 3) st.zoneBanner = null; }
      if (st.tally) tallyFx(dt);
    }

    // ---------- 3D scene ----------
    const C = h => E.hex(h);
    function wz(at){ return -(at - st.dist); }
    function render(w, h){
      const M = E.M, p = st.player;
      const shake = st.shake > 0 && !reduceMotion ? [(Math.random() - .5) * st.shake * 0.01, (Math.random() - .5) * st.shake * 0.01] : [0, 0];
      const Rg = st.rig || { camX: p.x * 0.55, camY: 0, fov: 1, bank: 0 };
      const camX = Rg.camX + shake[0], cbob = st.phase === 'play' && !p.air ? Math.abs(Math.sin(p.run * 2.2)) * 0.03 : 0;
      // late-afternoon "golden hour": low warm sun from the right, long shadows across the street, cool sky fill
      const aspK = (h / w) / 1.5, fovBase = 2 * Math.atan(Math.tan(0.5) * Math.max(1, aspK));
      E.begin({ pos: [camX, 3.6 + Rg.camY + cbob + shake[1] + ((st.giantK || 1) - 1) * 2, 6.3 + ((st.giantK || 1) - 1) * 3.5], target: [Rg.camX * 0.64, 0.95 + Rg.camY, -12], up: [Math.sin(-Rg.bank * 0.06), 1, 0], fov: fovBase * Rg.fov, near: 0.2, far: 400 }, {
        sunDir: [-0.62 * Math.cos(st.camTh) + 0.42 * Math.sin(st.camTh), -0.5, 0.62 * Math.sin(st.camTh) + 0.42 * Math.cos(st.camTh)], sunColor: [3.9, 3.0, 2.1], ambSky: [0.34, 0.44, 0.78], ambGround: [0.34, 0.36, 0.2], toon: 1.0,
        fogColor: [0.86, 0.88, 0.92], fogDensity: 0.007, fogStart: 40,
        shadow: { center: [0, 2, -16], radius: 30 },
        post: { bloom: 0.4, threshold: 0.86, saturation: 1.18, contrast: 1.12, vignette: 0.28, tint: [1.02, 0.99, 0.96] },
        sky: { zenith: [0.12, 0.4, 0.95], horizon: [0.78, 0.88, 0.98], ground: [0.55, 0.55, 0.38], sunColor: [1.4, 1.0, 0.55], sunSize: 3 },
      });
      // painted sky and far hills stay with the camera
      FR = null;
      D(A.quad, M.trs([0, 62, -262], [0, 0, 0], [760, 150, 1]), { tex: A.tSky, unlit: true, color: [1, 1, 1], fogless: true, noShadow: true });
      { const zi = zoneIdx(st.dist + 60), tgt = [0, 0, 0.55, 1][zi]; st.skyK = st.skyK == null ? tgt : st.skyK + (tgt - st.skyK) * 0.02; }
      if (st.skyK < 0.99) D(A.quad, M.trs([0, 22, -230], [0, 0, 0], [560, 88, 1]), { tex: A.tHills, unlit: true, color: [0.95, 0.98, 0.95], uvScale: [1.4, 1], fogless: true, blend: true, noShadow: true, alpha: 1 - st.skyK * 0.85 });
      if (st.skyK > 0.01) D(A.quad, M.trs([0, 30, -232], [0, 0, 0], [600, 94, 1]), { tex: A.tSkyline, unlit: true, color: [1, 1, 1], uvScale: [1.6, 1], fogless: true, blend: true, noShadow: true, alpha: st.skyK });
      // streets: the one we're on, the one we just left, and the two around the next corner
      const cs = curSeg(), list = [cs];
      if (st.prev >= 0 && st.dist - cs.start < 45) list.push(st.segs[st.prev]);
      if (cs.arms) list.push(cs.arms.left, cs.arms.right);
      const frames = {};
      for (const sg of list) { frames[sg.id] = segFrame(sg); FR = frames[sg.id]; drawGround(sg, cs); }
      for (const o of st.objs) {
        const F = frames[o.seg]; if (!F) continue;
        FR = F;
        const z = wz(o.at);
        const big = o.kind === 'bld' || o.kind === 'park', cx = big ? o.side * (o.z === 'town' || o.z === 'city' ? 12 : 16) : (o.x != null ? o.x : (o.side || 0) * 4), cz = big ? z - o.len / 2 : z;
        const pz = F[2] * cx + F[10] * cz + F[14], px = F[0] * cx + F[8] * cz + F[12];
        if (pz > (big ? 26 : 9) || pz < -VIEW - 30 || Math.abs(px) > 95) continue;
        if (o.kind === 'decal') { if (o.type === 'manhole') D(A.quad, M.trs([o.x, 0.015, z], [-Math.PI / 2, 0, 0], [1.1, 1.1, 1]), { tex: A.tManhole, spec: 0.5, shine: 30, blend: true, noShadow: true }); else { D(A.quad, M.trs([0, 0.012, z], [-Math.PI / 2, 0, 0], [6.4, 2.6, 1]), { tex: A.tCross, spec: 0.2, blend: true, noShadow: true }); D(A.box, M.trs([0, 0.012, z - 2.2], [0, 0, 0], [6.4, 0.01, 0.3]), { color: [0.97, 0.96, 0.92], noShadow: true }); } continue; }
        if (o.kind === 'bld') { if (o.z && o.z !== 'houses') drawZoneLot(o, z); else drawLot(o, z); }
        else if (o.kind === 'deco') { const dx = o.type === 'bench' ? o.side * 5.9 : o.type === 'mailbox' ? o.side * 4.4 : o.side * 5.2; DB(ZPF[o.type], E.M.trs([dx, 0, z], [0, o.type === 'bench' ? (o.side < 0 ? Math.PI : 0) : o.type === 'mailbox' ? (o.side < 0 ? 0 : Math.PI) : o.rot, 0])); }
        else if (o.kind === 'park') drawPark(o, z);
        else if (o.kind === 'tree') drawTree(o, z);
        else if (o.kind === 'lamp') drawLamp(o, z);
        else if (o.kind === 'hydrant') drawHydrant(o, z);
        else if (o.kind === 'obs') drawObstacle(o, z);
        else if (o.kind === 'food') drawFood(o, z);
        else if (o.kind === 'pow') drawPow(o, z);
        else if (o.kind === 'coin') drawCoin(o, z);
        else if (o.kind === 'sign') drawSign(o, z);
        else if (o.kind === 'bunting') drawBunting(o, z);
        else if (o.kind === 'barrier') drawBarrier(o, z);
        else if (o.kind === 'bestflag') drawBestFlag(o, z);
      }
      FR = frames[cs.id];
      for (const b of st.bugs || []) { if (!frames[b.seg]) continue; FR = frames[b.seg]; const z = wz(b.at); if (z > 6 || z < -60) continue; const t = st.time * 2 + b.ph, flap = Math.abs(Math.sin(st.time * 22 + b.ph)); const pos = [b.side * (b.x + Math.sin(t * 0.7) * 0.8), b.y + Math.sin(t * 1.3) * 0.35, z + Math.cos(t * 0.5) * 0.8]; for (const sx of [-1, 1]) SP([pos[0] + sx * 0.09 * flap, pos[1], pos[2]], 0.16, b.col, 0.95, false); }
      FR = frames[cs.id];
      drawDog();
      drawRaccoon();
      for (const q of st.parts) SP(q.p, q.size * (0.6 + q.life), q.color, Math.min(1, q.life * 2), true);
      FR = null;
      E.end();
    }
    // segment-to-screen frame: puts a street's straight-road coordinates where that street really is, seen from the turning camera
    let FR = null;
    const INK = [0.12, 0.07, 0.12];
    const D = (mesh, model, mat) => { const m = FR ? E.M.mul(FR, model) : model; E.draw(mesh, m, mat); if (mat.ol && (mat.alpha == null || mat.alpha >= 1)) E.draw(mesh, m, { color: INK, unlit: true, outline: mat.ol, noShadow: true }); };
    const DB = (prefab, model) => E.drawBaked(prefab, FR ? E.M.mul(FR, model) : model);
    const SP = (pos, ...rest) => E.sprite(FR ? E.M.xform(FR, pos) : pos, ...rest);
    function segFrame(sg){
      const cs = curSeg(), Pc = segPt(cs, st.dist, 0), O = segPt(sg, st.dist, 0);
      const B = [O[0] - Pc[0], O[1] - Pc[1]], th = st.camTh, rc = [Math.cos(th), Math.sin(th)], fc = [Math.sin(th), -Math.cos(th)];
      return E.M.trs([B[0] * rc[0] + B[1] * rc[1], 0, -(B[0] * fc[0] + B[1] * fc[1])], [0, th - sg.th, 0]);
    }
    // road, curbs, sidewalks and lawns for one street, trimmed so corners meet neatly
    function drawGround(sg, cs){
      const M = E.M, isArm = sg.parent != null && sg.parent === cs.id, cur = sg === cs;
      const back = st.dist - 25, ahead = st.dist + VIEW + 25;
      const lo = sg.parent == null ? back : sg.start, endJ = sg.kind === 'closed' ? sg.start + 62 : sg.J;
      const strip = (mesh, a0, a1, x, y, mat, P, us) => {
        a0 = Math.max(a0, cur ? back : -1e9); a1 = Math.min(a1, ahead);
        if (a1 <= a0 + 0.05) return;
        const len = a1 - a0;
        D(mesh, M.trs([x, y, wz((a0 + a1) / 2)], [0, 0, 0], [1, 1, len]), { ...mat, uvScale: [us || 1, len / P], uvOffset: [0, -(((a1 / P) % 1) + 1) % 1] });
      };
      // road: the right-hand street of a corner covers the crossing square
      let r0 = lo, r1 = endJ + 3.4;
      if (isArm) r0 = sg === cs.arms.right ? sg.start - 3.4 : sg.start + 3.4;
      if (sg.kind === 'closed') r1 = sg.start + 62;
      strip(A.roadU, r0, r1, 0, 0, { tex: A.tAsph, spec: 0.18, shine: 26 }, 27.2);
      const yl = 0.14 + 0.004 * (sg.id % 3);
      for (const sd of [-1, 1]) {
        let s0 = lo, s1 = endJ - 6.4;
        if (sg.parent != null) s0 = sd === sg.near ? sg.start + 6.4 : sg.start;
        if (sg.kind === 'closed') s1 = sg.start + 62;
        // the look of the roadside changes as you travel from the farm into the city
        for (let a = s0; a < s1 - 0.01;) {
          const zi = ZONES[zoneIdx(a + 0.01)].id, b = Math.min(s1, nextZoneFrom(a + 0.01));
          if (zi === 'farm') { strip(A.lawnU, a, b, sd * 23.6, yl, { tex: A.tFarmGrass, spec: 0.04 }, 4, 10); strip(A.walkU, a, b, sd * 4.7, 0.05, { tex: A.tGravel, spec: 0.03 }, 1.7); }
          else if (zi === 'houses') { strip(A.curbU, a, b, sd * 3.52, 0.09, { color: [0.95, 0.93, 0.88], spec: 0.05 }, 1); strip(A.lawnU, a, b, sd * 23.6, yl, { tex: A.tGrass, spec: 0.04 }, 4, 10); strip(A.walkU, a, b, sd * 5.35, 0.16, { tex: A.tWalk, spec: 0.05 }, 1.7); }
          else { const town = zi === 'town'; strip(A.curbU, a, b, sd * 3.52, 0.09, { color: town ? [0.9, 0.86, 0.8] : [0.82, 0.84, 0.88], spec: 0.05 }, 1); strip(A.lawnU, a, b, sd * 23.6, yl, { tex: town ? A.tPlaza : A.tConcrete, spec: 0.08 }, 4, 10); strip(A.walkU, a, b, sd * 5.35, 0.16, { tex: town ? A.tPaver : A.tConcrete, spec: 0.08 }, 1.7); }
          a = b;
        }
      }
    }
    function drawCoin(o, z){
      const M = E.M, spin = st.time * 4 + o.at * 0.7, pos = [o.x, o.h + Math.sin(st.time * 4 + o.at) * 0.05, z];
      D(A.coin, M.trs(pos, [Math.PI / 2, spin, 0], [0.58, 0.58, 0.58]), { color: [1, 0.78, 0.15], emissive: [0.35, 0.22, 0.0], spec: 1.4, shine: 70 });
      D(A.coinStar, M.trs(pos, [0, spin, 0], [0.5, 0.5, 1.6]), { color: [1, 0.93, 0.5], emissive: [0.4, 0.3, 0.05], spec: 1, shine: 60 });
    }
    // a big yellow school bus (with an optional wooden ramp to run up)
    function drawBus(o, z){
      const M = E.M, x = laneX(o.lane), L = o.len, zc = z - L / 2;
      if (o.squash) { D(A.box, M.trs([x, 0.25, zc], [0, 0, 0], [2.3, 0.5, L]), { color: C('#ffcc33'), spec: 0.6, ol: 0.04 }); return; }
      const paint = { color: C(o.color || '#ffcc33'), spec: 0.8, shine: 50, ol: 0.05 }, side = { tex: A.tBusSide, color: [1, 1, 1], spec: 0.6, shine: 40 }, black = { color: [0.12, 0.12, 0.14], spec: 0.3 }, glass = { color: [0.25, 0.38, 0.55], spec: 1.4, shine: 90 };
      D(A.box, M.trs([x, 1.35, zc], [0, 0, 0], [2.05, 1.9, L]), paint);
      for (const sd of [-1, 1]) D(A.quad, M.trs([x + sd * 1.032, 1.3, zc], [0, sd * Math.PI / 2, 0], [L - 0.3, 1.5, 1]), side);
      D(A.box, M.trs([x, BUS_H - 0.08, zc], [0, 0, 0], [1.95, 0.16, L - 0.1]), { color: C('#f0f0ea'), spec: 0.3 });
      D(A.sphere, M.trs([x, BUS_H - 0.12, zc], [0, 0, 0], [2.0, 0.2, L]), paint);
      for (const sd of [-1, 1]) {
        for (const wz of [z - 2.0, z - L + 2.0]) D(A.wheel, M.trs([x + sd * 0.92, 0.42, wz]), { color: [0.12, 0.12, 0.14], spec: 0.15 });
      }
      D(A.box, M.trs([x, 1.85, z + 0.01], [0, 0, 0], [1.8, 0.6, 0.04]), glass);
      D(A.box, M.trs([x, 0.85, z + 0.02], [0, 0, 0], [1.2, 0.5, 0.04]), black);
      D(A.box, M.trs([x, 0.42, z + 0.05], [0, 0, 0], [2.1, 0.22, 0.12]), { color: [0.2, 0.2, 0.22], spec: 0.6 });
      for (const sd of [-1, 1]) D(A.sphere, M.trs([x + sd * 0.78, 0.95, z + 0.04], [0, 0, 0], [0.24, 0.24, 0.08]), { color: [1, 0.95, 0.7], emissive: [0.9, 0.85, 0.5], noShadow: true });
      D(A.cyl, M.trs([x - 1.15, 1.5, z - 0.6], [0, 0, Math.PI / 2], [0.42, 0.04, 0.42]), { color: C('#e8463a'), spec: 0.5 });
      if (o.ramp) {
        const wood = { tex: A.tBark, color: [1.2, 1.05, 0.85], spec: 0.15, uvScale: [1, 2] };
        const ang = Math.atan2(BUS_H, RAMP), slope = Math.hypot(BUS_H, RAMP);
        D(A.box, M.trs([x, BUS_H / 2 - 0.05, z + RAMP / 2], [ang, 0, 0], [1.9, 0.12, slope]), wood);
        for (const sd of [-1, 1]) D(A.box, M.trs([x + sd * 0.92, BUS_H / 4, z + RAMP * 0.4], [0, 0, 0], [0.1, BUS_H / 2, RAMP * 0.8]), wood);
      }
    }
    function drawGap(o, z){
      const M = E.M, L = o.len, zc = z - L / 2;
      D(A.box, M.trs([0, 0.005, zc], [0, 0, 0], [6.8, 0.02, L]), { color: [0.06, 0.05, 0.05], spec: 0, noShadow: true });
      for (const zz of [z + 0.15, z - L - 0.15]) D(A.box, M.trs([0, 0.07, zz], [0, 0, 0], [6.8, 0.14, 0.3]), { tex: A.tStripe, uvScale: [8, 1], spec: 0.3 });
      for (const sd of [-1, 1]) {
        D(A.cone, M.trs([sd * 3.0, 0.42, z + 0.5], [0, 0, 0], [0.5, 0.84, 0.5]), { color: C('#ff7a2f'), spec: 0.4 });
        D(A.bump, M.trs([sd * 4.4, 0.25, zc], [0, 0, 0], [1.6, 0.7, L * 1.2]), { color: C('#8a6a48'), spec: 0.05 });
      }
    }
    // party flags strung across the street between two poles
    function drawBunting(o, z){
      if (!PF.lamp) buildPrefabs();
      DB(PF.bunting[o.c], E.M.trs([0, 0, z])); return;
      const M = E.M, sets = [['#ff3d6e','#ffd23f','#3fa9ff','#7dff6a'], ['#ff9f1c','#c77dff','#5ee0ff','#ffffff'], ['#ff5a4a','#ffffff','#3f7fd6','#ffd23f'], ['#ff6fb5','#7dd85a','#ffe04a','#5ab8e8']][o.c];
      for (const sx of [-6.6, 6.6]) D(A.cyl, M.trs([sx, 2.4, z], [0, 0, 0], [0.1, 4.8, 0.1]), { color: [0.95, 0.95, 0.95], spec: 0.4, ol: 0.02 });
      const n = 16;
      for (let i=0;i<n;i++) { const t = (i + 0.5) / n, x = -6.6 + 13.2 * t, y = 4.6 - Math.sin(Math.PI * t) * 0.9, sw = Math.sin(st.time * 3 + i) * 0.15;
        D(A.cone, M.trs([x, y - 0.28, z], [Math.PI + sw, 0, 0], [0.42, 0.55, 0.06]), { color: C(sets[i % 4]), spec: 0.3, doubleSided: true, noShadow: true }); }
      D(A.box, M.trs([0, 4.25, z], [0, 0, 0], [13.2, 0.02, 0.02]), { color: [0.3, 0.3, 0.3], noShadow: true });
    }
    function drawSign(o, z){
      const M = E.M, wood = { color: [0.98, 0.98, 0.95], spec: 0.2 }, y = 2.4;
      for (const sx of [-1.6, 1.6]) D(A.cyl, M.trs([sx, 1.2, z], [0, 0, 0], [0.14, 2.4, 0.14]), { color: [0.3, 0.3, 0.34], spec: 0.5 });
      D(A.box, M.trs([0, y, z], [0, 0, 0], [5.2, 1.8, 0.12]), { color: C('#ffd23f'), emissive: [0.25, 0.2, 0.02], spec: 0.4, shine: 30 });
      D(A.box, M.trs([0, y, z - 0.02], [0, 0, 0], [5.45, 2.05, 0.08]), { color: [0.17, 0.13, 0.25] });
      const arrow = (dir) => { const sx = dir === 'left' ? -1 : 1; D(A.arrow, M.trs([sx * (o.dirs === 'T' ? 1.25 : 0), y, z + 0.08], [0, 0, dir === 'left' ? 0 : Math.PI], [1.15, 1.15, 1]), { color: [0.17, 0.13, 0.25], spec: 0.2 }); };
      if (o.dirs !== 'R') arrow('left'); if (o.dirs !== 'L') arrow('right');
      D(A.box, M.trs([0, 0.6, z + 1.6], [0, 0, 0], [7, 1.2, 1.1]), { tex: A.tHedge, uvScale: [3, 1], spec: 0.08 });
    }
    function drawBestFlag(o, z){
      const M = E.M;
      if (!A.tBest) A.tBest = E.texture(canvas(512, 96, (g, w, h) => { for (let x=0;x<w;x+=24) for (let y=0;y<h;y+=24) { g.fillStyle = ((x + y) / 24) % 2 ? '#1e1a22' : '#ffffff'; g.fillRect(x, y, 24, 24); } g.fillStyle = '#ffd23f'; g.beginPath(); g.roundRect(60, 10, w - 120, h - 20, 18); g.fill(); g.strokeStyle = '#2b2140'; g.lineWidth = 6; g.stroke(); g.font = `52px ${TOON}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2b2140'; g.fillText('YOUR BEST!', w / 2, h / 2 + 3); }, 1), { repeat: false });
      for (const sx of [-3.7, 3.7]) D(A.cyl, M.trs([sx, 2.0, z], [0, 0, 0], [0.18, 4.0, 0.18]), { color: [0.95, 0.95, 0.95], spec: 0.5, ol: 0.02 });
      const sway = Math.sin(st.time * 2) * 0.03;
      D(A.box, M.trs([0, 3.75, z], [sway, 0, 0], [7.6, 1.4, 0.12]), { tex: A.tBest, color: [1, 1, 1], emissive: [0.2, 0.18, 0.1], spec: 0.3 });
    }
    function drawBarrier(o, z){
      const M = E.M;
      for (const k of [-1, 0, 1]) {
        const x = k * 2.2;
        for (const sx of [-0.8, 0.8]) D(A.box, M.trs([x + sx, 0.5, z], [0, 0, 0], [0.12, 1.0, 0.12]), { color: [0.95, 0.95, 0.95] });
        D(A.box, M.trs([x, 0.85, z], [0, 0, 0], [2.0, 0.34, 0.1]), { tex: A.tStripe, spec: 0.3 });
        D(A.cone, M.trs([x, 0.42, z + 0.7], [0, 0, 0], [0.5, 0.84, 0.5]), { color: C('#ff7a2f'), spec: 0.4 });
      }
      D(A.box, M.trs([0, 0.7, z - 1.2], [0, 0, 0], [8, 1.4, 1.2]), { tex: A.tHedge, uvScale: [4, 1], spec: 0.08 });
    }
    // the grumpy bulldog that chases you after a stumble
    function drawDog(){
      const dg = st.dog, p = st.player; if (!dg || dg.d > 8) return;
      const M = E.M, t = st.time * 18, z = 0.7 + dg.d * 0.38, x = p.x * 0.85 - 0.85 + Math.sin(st.time * 3) * 0.15, k = 0.62;
      const brown = { color: C('#b8733a'), spec: 0.35, shine: 20, rim: 0.5, ol: 0.035 }, cream = { color: C('#f6e6cc'), spec: 0.2, ol: 0.025 }, dark = { color: [0.15, 0.1, 0.08], spec: 0.6, shine: 50 };
      const bob = Math.abs(Math.sin(t)) * 0.08;
      const Bm = M.trs([x, (0.42 + bob) * k, z], [0.08 * Math.sin(t), 0.55, 0], [k, k, k]);
      const part = (mesh, l, r, sc, mat) => D(mesh, M.mul(Bm, M.trs(l, r || [0, 0, 0], sc)), mat);
      part(A.sphere, [0, 0, 0], null, [0.62, 0.48, 0.82], brown);
      part(A.sphere, [0, -0.06, -0.12], null, [0.44, 0.34, 0.5], cream);
      for (const [sx, sz, ph] of [[-0.2, -0.25, 0], [0.2, -0.25, Math.PI], [-0.2, 0.25, Math.PI], [0.2, 0.25, 0]]) part(A.sphere, [sx, -0.3 + Math.max(0, Math.sin(t + ph)) * 0.08, sz + Math.sin(t + ph) * 0.1], null, [0.16, 0.26, 0.18], brown);
      const H = [0, 0.26, -0.48];
      part(A.sphere, H, null, [0.56, 0.46, 0.46], brown);
      part(A.sphere, [0, 0.16, -0.66], null, [0.42, 0.24, 0.24], cream);
      part(A.sphere, [0, 0.24, -0.78], null, [0.13, 0.09, 0.08], dark);
      for (const sx of [-1, 1]) {
        part(A.sphere, [sx * 0.24, 0.48, -0.42], [0, 0, sx * 0.6], [0.16, 0.12, 0.08], { color: C('#8a5a32'), spec: 0.2 });
        part(A.sphere, [sx * 0.12, 0.36, -0.68], null, [0.09, 0.09, 0.05], { color: [1, 1, 1], spec: 0.8 });
        part(A.sphere, [sx * 0.12, 0.35, -0.71], null, [0.05, 0.05, 0.03], dark);
        part(A.box, [sx * 0.12, 0.43, -0.7], [0, 0, sx * 0.4], [0.14, 0.03, 0.03], dark);
        part(A.cone, [sx * 0.1, 0.05, -0.72], [Math.PI, 0, 0], [0.05, 0.08, 0.05], { color: [1, 1, 1] });
      }
      part(A.torus, [0, 0.08, -0.3], [Math.PI / 2 - 0.3, 0, 0], [1.25, 1.25, 0.8], { color: C('#e8463a'), spec: 0.5 });
      for (let q=0;q<6;q++) { const a = q / 6 * Math.PI * 2; part(A.cone, [Math.cos(a) * 0.3, 0.08 + Math.sin(a) * 0.26, -0.3], [Math.PI / 2 - 0.3 + Math.sin(a) * 0.9, 0, -Math.cos(a) * 1.2], [0.06, 0.12, 0.06], { color: [0.85, 0.85, 0.9], spec: 1 }); }
      part(A.sphere, [0, 0.22, 0.42], [0.6 + Math.sin(t * 1.3) * 0.3, 0, 0], [0.12, 0.24, 0.12], brown);
      if (dg.bark > 0.25) for (let q=0;q<3;q++) SP([x + (q - 1) * 0.2, 1.0 + q * 0.08, z - 0.5], 0.14, [1, 1, 1], 0.8, false);
    }

    // ---- pre-built scenery: every house, frontage, tree and lamp is merged into a few meshes once ----
    const LOT_LENS = [12, 13.5, 15];
    const PF = { house: {}, front: {}, tree: {}, hydrant: null, lamp: null, bunting: [] };
    function buildPrefabs(){
      const M = E.M, bake = (fn) => E.bake(fn, { loose: true }), keepFR = FR; FR = null;
      for (let h = 0; h < HOUSES.length; h++) for (const sd of [-1, 1]) PF.house[h + '|' + sd] = bake(() => houseParts(h, sd));
      for (const front of ['hedge', 'fence']) for (const len of LOT_LENS) for (const sd of [-1, 1]) PF.front[front + '|' + len + '|' + sd] = bake(() => frontParts(front, len, sd));
      for (const bloom of [0, 1]) for (let t = 0; t < 3; t++) PF.tree[bloom + '|' + t] = bake(() => treeParts(!!bloom, 0.85 + t * 0.15));
      PF.hydrant = bake(() => { const red = E.hex('#e8463a'); D(A.cyl, M.trs([0, 0.5, 0], [0, 0, 0], [0.36, 0.7, 0.36]), { color: red, spec: 0.6, shine: 40 }); D(A.sphereLo, M.trs([0, 0.88, 0], [0, 0, 0], [0.4, 0.34, 0.4]), { color: red, spec: 0.6, shine: 40 }); D(A.cyl, M.trs([0, 0.6, 0], [0, 0, Math.PI / 2], [0.16, 0.6, 0.16]), { color: E.hex('#f6c344'), spec: 0.6 }); for (const k of [0.25, 0.75]) D(A.cyl, M.trs([0, k, 0], [0, 0, 0], [0.42, 0.06, 0.42]), { color: E.hex('#c9352a'), spec: 0.5 }); });
      PF.lamp = bake(() => { const g = [0.22, 0.3, 0.26]; D(A.cyl, M.trs([0, 2.0, 0], [0, 0, 0], [0.12, 4.0, 0.12]), { color: g, spec: 0.5, shine: 40 }); D(A.cyl, M.trs([0, 0.15, 0], [0, 0, 0], [0.3, 0.3, 0.3]), { color: g, spec: 0.5 }); D(A.cyl, M.trs([0, 4.1, 0], [0, 0, 0], [0.4, 0.5, 0.4]), { color: [1, 0.96, 0.82], emissive: [0.5, 0.45, 0.3], noShadow: true }); D(A.cone, M.trs([0, 4.55, 0], [0, 0, 0], [0.62, 0.4, 0.62]), { color: g, spec: 0.5 }); });
      const SETS = [['#ff3d6e','#ffd23f','#3fa9ff','#7dff6a'], ['#ff9f1c','#c77dff','#5ee0ff','#ffffff'], ['#ff5a4a','#ffffff','#3f7fd6','#ffd23f'], ['#ff6fb5','#7dd85a','#ffe04a','#5ab8e8']];
      PF.bunting = SETS.map(set => bake(() => {
        for (const sx of [-6.6, 6.6]) D(A.cyl, M.trs([sx, 2.4, 0], [0, 0, 0], [0.1, 4.8, 0.1]), { color: [0.95, 0.95, 0.95], spec: 0.4, ol: 0.02 });
        const n = 16; for (let i=0;i<n;i++) { const t = (i + 0.5) / n, x = -6.6 + 13.2 * t, y = 4.6 - Math.sin(Math.PI * t) * 0.9; D(A.cone, M.trs([x, y - 0.28, 0], [Math.PI + (i % 2 ? 0.1 : -0.1), 0, 0], [0.42, 0.55, 0.06]), { color: E.hex(set[i % 4]), spec: 0.3, doubleSided: true, noShadow: true }); }
        D(A.box, M.trs([0, 4.25, 0], [0, 0, 0], [13.2, 0.02, 0.02]), { color: [0.3, 0.3, 0.3], noShadow: true });
      }));
      buildZonePrefabs();
      FR = keepFR;
    }
    // ---- zone scenery prefabs (baked once into a few meshes each) ----
    const ZPF = { barn: {}, corn: {}, pasture: {}, field: {}, rail: {}, shop: {}, tower: {}, mill: null, wheel: null, bale: null, sunflower: null, mailbox: null, bench: null };
    function buildZonePrefabs(){
      const M = E.M, bake = (fn) => E.bake(fn, { loose: true });
      const red = C('#c4362c'), white = [0.98, 0.96, 0.92], wood = C('#9a6b43');
      for (const sd of [-1, 1]) {
        ZPF.rail[sd] = bake(() => { for (let k = 0; k <= 24; k += 2.4) D(A.box, M.trs([sd * 6.9, 0.55, -k], [0, 0, 0], [0.2, 1.1, 0.2]), { color: wood, spec: 0.05 }); for (const y of [0.45, 0.88]) D(A.box, M.trs([sd * 6.9, y, -12], [0, 0, 0], [0.1, 0.16, 24]), { color: C('#b07f52'), spec: 0.05 }); });
        // red barn with a gambrel roof, a silver silo and round hay bales
        ZPF.barn[sd] = bake(() => {
          const fx = sd * 14, bx = sd * 19, hb = 4.5;
          D(A.box, M.trs([bx, hb / 2, 0], [0, 0, 0], [10, hb, 11]), { tex: A.tBarnSide, uvScale: [5, 2], spec: 0.08 });
          D(A.quad, M.trs([fx - sd * 0.02, hb / 2, 0], [0, sd < 0 ? Math.PI / 2 : -Math.PI / 2, 0], [11, hb, 1]), { tex: A.tBarnFront, spec: 0.12 });
          D(A.gambrel, M.trs([bx, hb, 0], [0, Math.PI / 2, 0], [5.5, 3.6, 10]), { color: red, spec: 0.1 });
          const P = [[-5.75, -0.1], [-4.45, 2.25], [0, 3.62], [4.45, 2.25], [5.75, -0.1]];
          for (let i=0;i<4;i++) { const [z0, y0] = P[i], [z1, y1] = P[i + 1], L = Math.hypot(z1 - z0, y1 - y0); D(A.box, M.trs([bx, hb + (y0 + y1) / 2, (z0 + z1) / 2], [Math.atan2(-(y1 - y0), z1 - z0), 0, 0], [10.7, 0.22, L + 0.15]), { tex: A.roofs[5], uvScale: [4, 2], spec: 0.15 }); }
          D(A.box, M.trs([fx - sd * 0.06, hb + 1.4, 0], [0, 0, 0], [0.1, 1.5, 1.8]), { color: white, spec: 0.1 });
          D(A.box, M.trs([fx - sd * 0.09, hb + 1.4, 0], [0, 0, 0], [0.1, 1.2, 1.5]), { color: C('#7a2019'), spec: 0.05 });
          for (const [z0, y0, z1, y1] of [[-5.5, 0, -4.3, 2.16], [-4.3, 2.16, 0, 3.42], [0, 3.42, 4.3, 2.16], [4.3, 2.16, 5.5, 0]]) { const L = Math.hypot(z1 - z0, y1 - y0); D(A.box, M.trs([fx - sd * 0.05, hb + (y0 + y1) / 2, (z0 + z1) / 2], [Math.atan2(-(y1 - y0), z1 - z0), 0, 0], [0.12, 0.2, L]), { color: white, spec: 0.1 }); }
          D(A.box, M.trs([bx, hb + 3.9, 0], [0, 0, 0], [1.4, 1.0, 1.4]), { color: white, spec: 0.1 });
          D(A.cone4, M.trs([bx, hb + 4.75, 0], [0, Math.PI / 4, 0], [2.3, 0.9, 2.3]), { color: C('#4a4f5c'), spec: 0.3 });
          const sx = sd * 22.5, sz = 7.6;
          D(A.cyl, M.trs([sx, 5, sz], [0, 0, 0], [3.6, 10, 3.6]), { color: C('#cfd8e0'), spec: 1.0, shine: 50 });
          for (const y of [1.5, 4, 6.5, 9]) D(A.cyl, M.trs([sx, y, sz], [0, 0, 0], [3.72, 0.16, 3.72]), { color: C('#98a6b3'), spec: 1 });
          D(A.sphere, M.trs([sx, 10, sz], [0, 0, 0], [3.6, 2.8, 3.6]), { color: C('#e9eef2'), spec: 1.3, shine: 70 });
          for (const [bz, by, bxo] of [[-8, 0.65, 0], [-6.6, 0.65, 0.2], [-7.3, 1.85, 0.1]]) D(A.cyl, M.trs([sd * (10.5 + bxo), by, bz], [0, 0, Math.PI / 2], [1.3, 1.15, 1.3]), { tex: A.tHay, spec: 0.1 });
        });
        // rows of tall corn and a friendly scarecrow
        ZPF.corn[sd] = bake(() => {
          D(A.quad, M.trs([sd * 17, 0.17, 0], [-Math.PI / 2, 0, 0], [19, 22, 1]), { color: C('#8a5a34'), spec: 0.02, noShadow: true });
          for (let r = 0; r < 8; r++) for (let k = 0; k < 14; k++) { const x = sd * (9 + r * 2.2), z = -10 + k * 1.55 + (r % 2) * 0.6, hgt = 1.9 + ((r * 7 + k * 3) % 5) * 0.12;
            D(A.cone8, M.trs([x, hgt / 2, z], [0, k, 0], [0.55, hgt, 0.55]), { color: C(['#4f9c34','#5cae3e','#68b845'][(r + k) % 3]), spec: 0.1 });
            D(A.cone8, M.trs([x, hgt + 0.15, z], [0, 0, 0], [0.18, 0.5, 0.18]), { color: C('#e8cf6a'), spec: 0.2 }); }
          const cx = sd * 8.2, cz = 2;
          D(A.box, M.trs([cx, 1.2, cz], [0, 0, 0], [0.12, 2.4, 0.12]), { color: wood });
          D(A.box, M.trs([cx, 1.9, cz], [0, 0, 0], [0.1, 0.1, 1.8]), { color: wood });
          D(A.box, M.trs([cx, 1.65, cz], [0, 0, 0], [0.45, 0.8, 0.9]), { color: C('#3f7fd6'), spec: 0.1 });
          D(A.box, M.trs([cx, 1.95, cz], [0, 0, 0], [0.32, 0.25, 1.9]), { color: C('#e63b2e'), spec: 0.1 });
          D(A.sphere, M.trs([cx, 2.45, cz], [0, 0, 0], [0.5, 0.5, 0.5]), { color: C('#e2c48a'), spec: 0.1 });
          D(A.cyl, M.trs([cx, 2.68, cz], [0, 0, 0], [0.95, 0.05, 0.95]), { color: C('#d6a84a'), spec: 0.1 });
          D(A.cone, M.trs([cx, 2.95, cz], [0, 0, 0], [0.5, 0.55, 0.5]), { color: C('#d6a84a'), spec: 0.1 });
          for (const s2 of [-1, 1]) D(A.sphere, M.trs([cx - sd * 0.24, 2.5, cz + s2 * 0.11], [0, 0, 0], [0.07, 0.07, 0.07]), { color: [0.1, 0.1, 0.1] });
        });
        // cows in a meadow with a little red shed
        ZPF.pasture[sd] = bake(() => {
          const cow = (x, z, yaw) => { const B = M.trs([x, 0, z], [0, yaw, 0]); const P = (mesh, t, r, s, mat) => D(mesh, M.mul(B, M.trs(t, r || [0, 0, 0], s)), mat);
            const wht = { color: [0.97, 0.96, 0.94], spec: 0.25 }, blk = { color: [0.12, 0.11, 0.13], spec: 0.3 };
            P(A.sphere, [0, 1.05, 0], null, [1.0, 0.95, 1.8], wht);
            P(A.sphere, [0.32, 1.25, 0.3], null, [0.45, 0.5, 0.6], blk); P(A.sphere, [-0.3, 1.0, -0.4], null, [0.5, 0.55, 0.55], blk);
            for (const [lx, lz] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) P(A.cyl, [lx, 0.35, lz], null, [0.22, 0.7, 0.22], wht);
            P(A.sphere, [0, 1.35, -1.0], null, [0.6, 0.58, 0.7], wht); P(A.sphere, [0, 1.22, -1.32], null, [0.46, 0.34, 0.3], { color: C('#ffb3c1'), spec: 0.3 });
            for (const s2 of [-1, 1]) { P(A.sphere, [s2 * 0.32, 1.6, -0.95], null, [0.28, 0.14, 0.18], wht); P(A.cone8, [s2 * 0.18, 1.72, -0.92], [0, 0, -s2 * 0.4], [0.1, 0.26, 0.1], { color: C('#f2e6c8') }); P(A.sphere, [s2 * 0.17, 1.45, -1.3], null, [0.1, 0.12, 0.06], blk); }
            P(A.box, [0, 0.95, 0.95], [0.3, 0, 0], [0.06, 0.8, 0.06], wht); };
          cow(sd * 11, -5, 0.6); cow(sd * 15, 3, -2.2); cow(sd * 19.5, -2, 1.9);
          const hx = sd * 22, hz = 7;
          D(A.box, M.trs([hx, 1.3, hz], [0, 0, 0], [3.5, 2.6, 4]), { tex: A.tBarnSide, uvScale: [2, 1], spec: 0.05 });
          D(A.roof, M.trs([hx, 2.6, hz], [0, 0, 0], [2.1, 1.3, 4.4]), { tex: A.roofs[5], uvScale: [2, 1], spec: 0.1 });
          D(A.box, M.trs([hx - sd * 1.76, 1.0, hz], [0, 0, 0], [0.05, 2, 1.4]), { color: white });
          D(A.cyl, M.trs([sd * 9.5, 0.3, 6], [0, 0, 0], [1.8, 0.5, 1.8]), { color: C('#8a9aa8'), spec: 1 });
          D(A.cyl, M.trs([sd * 9.5, 0.5, 6], [0, 0, 0], [1.6, 0.05, 1.6]), { color: C('#4aa8d8'), spec: 1.6, shine: 90 });
        });
        // a planted field with a little red tractor and stacked hay
        ZPF.field[sd] = bake(() => {
          D(A.quad, M.trs([sd * 17, 0.17, 0], [-Math.PI / 2, 0, 0], [19, 22, 1]), { tex: A.tCrop, uvScale: [3, 4], spec: 0.03, noShadow: true });
          const tx = sd * 12, tz = -3, T = M.trs([tx, 0, tz], [0, 0.4 * sd, 0]); const P = (mesh, t, r, s, mat) => D(mesh, M.mul(T, M.trs(t, r || [0, 0, 0], s)), mat);
          const rd = { color: C('#e8342a'), spec: 0.9, shine: 50 };
          P(A.box, [0, 1.0, 0.3], null, [1.1, 0.8, 2.2], rd); P(A.box, [0, 1.75, 0.8], null, [1.2, 1.1, 1.0], { color: C('#2a3346'), spec: 1.2, shine: 80 });
          P(A.box, [0, 2.35, 0.8], null, [1.4, 0.1, 1.2], rd); P(A.cyl, [0.3, 1.8, -0.5], null, [0.14, 1.0, 0.14], { color: [0.2, 0.2, 0.22] });
          for (const s2 of [-1, 1]) { P(A.wheel, [s2 * 0.75, 0.75, 1.0], null, [1.8, 1.8, 1.8], { color: [0.12, 0.12, 0.14] }); P(A.wheel, [s2 * 0.65, 0.42, -0.6], null, [1.0, 1.0, 1.0], { color: [0.12, 0.12, 0.14] }); P(A.wheel, [s2 * 0.76, 0.75, 1.0], null, [1.0, 1.0, 1.0], { color: C('#ffd23f') }); }
          for (const [bz, by, bxo] of [[6, 0.65, 0], [7.4, 0.65, 0], [6.7, 1.85, 0], [6, 0.65, 1.4]]) D(A.cyl, M.trs([sd * (10 + bxo), by, bz], [0, 0, Math.PI / 2], [1.3, 1.15, 1.3]), { tex: A.tHay, spec: 0.1 });
        });
        // Main Street shops
        SHOPS.forEach((S, v) => { ZPF.shop[v + '|' + sd] = bake(() => {
          const fx = sd * 7.4, bx = sd * 12.4, hh = 10;
          D(A.box, M.trs([bx, hh / 2, 0], [0, 0, 0], [10, hh, 11.9]), { tex: A.bricks[v % A.bricks.length], uvScale: [5, 5], spec: 0.05 });
          D(A.quad, M.trs([fx - sd * 0.02, hh / 2, 0], [0, sd < 0 ? Math.PI / 2 : -Math.PI / 2, 0], [11.9, hh, 1]), { tex: A.shopFronts[v], spec: 0.2, shine: 30 });
          D(A.box, M.trs([fx - sd * 0.25, hh + 0.05, 0], [0, 0, 0], [0.7, 0.55, 12.1]), { color: C(S.trim), spec: 0.2 });
          D(A.box, M.trs([bx, hh + 0.4, 0], [0, 0, 0], [10, 0.3, 11.9]), { color: C(S.trim), spec: 0.1 });
          D(A.box, M.trs([fx - sd * 0.9, 3.45, -0.9], [0, 0, sd * 0.38], [1.9, 0.08, 8.2]), { tex: A.awnings[v], uvScale: [1, 5], spec: 0.2 });
          D(A.box, M.trs([fx - sd * 1.75, 3.05, -0.9], [0, 0, 0], [0.04, 0.35, 8.2]), { tex: A.awnings[v], uvScale: [5, 1], spec: 0.2 });
          D(A.box, M.trs([bx + sd * 1.5, hh + 0.9, 2.5], [0, 0, 0], [2, 1.0, 1.6]), { color: [0.75, 0.77, 0.8], spec: 0.8 });
          if (v % 3 === 1) { const tx = bx + sd * 2, tz = -2.5; D(A.cyl, M.trs([tx, hh + 3.0, tz], [0, 0, 0], [2.4, 2.2, 2.4]), { tex: A.tPlankV, uvScale: [4, 1], spec: 0.1 }); D(A.cone, M.trs([tx, hh + 4.5, tz], [0, 0, 0], [2.6, 0.9, 2.6]), { color: C('#5a5a66'), spec: 0.3 }); for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) D(A.box, M.trs([tx + lx, hh + 1.0, tz + lz], [0, 0, 0], [0.12, 1.9, 0.12]), { color: [0.25, 0.25, 0.28] }); }
        }); });
        // downtown skyscrapers
        TOWERS.forEach((T, v) => TOWER_H.forEach((H, hi) => { ZPF.tower[v + '|' + hi + '|' + sd] = bake(() => {
          const fx = sd * 8, bx = sd * 15, W2 = 13, Dp = 14;
          D(A.box, M.trs([bx, H / 2, 0], [0, 0, 0], [Dp, H, W2]), { tex: A.facades[v], color: T.glass ? [0.78, 0.8, 0.86] : [0.8, 0.78, 0.76], uvScale: [W2 / 4, H / 4], spec: T.glass ? 0.7 : 0.1, shine: T.glass ? 80 : 20 });
          D(A.box, M.trs([bx, H + 0.25, 0], [0, 0, 0], [Dp + 0.4, 0.5, W2 + 0.4]), { color: T.glass ? C(T.mull) : C(PB.shade(T.brick, 0.3)), spec: 0.3 });
          D(A.quad, M.trs([fx - sd * 0.03, 2.4, 0], [0, sd < 0 ? Math.PI / 2 : -Math.PI / 2, 0], [12.4, 4.6, 1]), { tex: A.tLobby, emissive: [0.25, 0.18, 0.08], spec: 0.6 });
          D(A.box, M.trs([fx - sd * 0.8, 4.75, 0], [0, 0, 0], [1.6, 0.25, 7]), { color: [0.18, 0.2, 0.25], spec: 0.8 });
          if (T.crown === 'step' || T.crown === 'spire') D(A.box, M.trs([bx, H + 3, 0], [0, 0, 0], [9, 5, 8.5]), { tex: A.facades[v], color: [0.78, 0.8, 0.86], uvScale: [2, 1.25], spec: 0.7, shine: 70 });
          if (T.crown === 'antenna') { D(A.box, M.trs([bx, H + 1.2, 0], [0, 0, 0], [4, 2, 4]), { color: [0.7, 0.72, 0.78], spec: 0.6 }); D(A.cyl, M.trs([bx, H + 6, 0], [0, 0, 0], [0.25, 8, 0.25]), { color: [0.85, 0.86, 0.9], spec: 1 }); D(A.sphere, M.trs([bx, H + 10.1, 0], [0, 0, 0], [0.5, 0.5, 0.5]), { color: [1, 0.2, 0.15], emissive: [1.2, 0.1, 0.05], noShadow: true }); }
          if (T.crown === 'spire') D(A.cone4, M.trs([bx, H + 9, 0], [0, Math.PI / 4, 0], [5, 7, 5]), { color: C(T.mull), spec: 1.2, shine: 80 });
          if (T.crown === 'tank') { const tx = bx + sd * 2, tz = 2; D(A.cyl, M.trs([tx, H + 3.4, tz], [0, 0, 0], [3, 2.6, 3]), { tex: A.tPlankV, uvScale: [5, 1], spec: 0.1 }); D(A.cone, M.trs([tx, H + 5.2, tz], [0, 0, 0], [3.3, 1.1, 3.3]), { color: C('#4a4f5c'), spec: 0.3 }); for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) D(A.box, M.trs([tx + lx, H + 1.1, tz + lz], [0, 0, 0], [0.15, 2.2, 0.15]), { color: [0.2, 0.2, 0.22] }); }
        }); }));
      }
      // farm windmill (the wheel spins, so it is its own prefab)
      ZPF.mill = bake(() => { D(A.cone4, M.trs([0, 4.3, 0], [0, Math.PI / 4, 0], [2.2, 8.6, 2.2]), { color: [0.72, 0.74, 0.78], spec: 0.8 }); D(A.box, M.trs([0, 8.6, 0], [0, 0, 0], [0.5, 0.5, 0.5]), { color: [0.5, 0.52, 0.56], spec: 0.8 }); });
      ZPF.wheel = bake(() => { for (let k=0;k<16;k++) { const a = k / 16 * Math.PI * 2; D(A.box, M.trs([0, Math.cos(a) * 1.15, Math.sin(a) * 1.15], [a, 0, 0], [0.04, 1.5, 0.32]), { color: k % 2 ? [0.98, 0.98, 0.96] : C('#e8463a'), spec: 0.4, doubleSided: true }); } D(A.torus, M.trs([0, 0, 0], [0, 0, Math.PI / 2], [8.2, 8.2, 1]), { color: [0.6, 0.62, 0.66], spec: 0.8 }); D(A.box, M.trs([0, 0, 0], [0, 0, 0], [0.4, 0.4, 0.4]), { color: [0.4, 0.42, 0.46] }); });
      ZPF.bale = bake(() => { D(A.cyl, M.trs([0, 0.65, 0], [0, 0, Math.PI / 2], [1.3, 1.15, 1.3]), { tex: A.tHay, spec: 0.1 }); D(A.cyl, M.trs([0.35, 0.65, 1.3], [0, 0.4, Math.PI / 2], [1.3, 1.15, 1.3]), { tex: A.tHay, spec: 0.1 }); });
      ZPF.sunflower = bake(() => { for (let k=0;k<5;k++) { const x = (k % 3 - 1) * 0.45, z = Math.floor(k / 3) * 0.5 - 0.2, h = 1.5 + (k % 3) * 0.25; D(A.cyl, M.trs([x, h / 2, z], [0, 0, 0], [0.08, h, 0.08]), { color: C('#4f9c34') }); D(A.cyl, M.trs([x, h, z], [0, 0, Math.PI / 2 - 0.3], [0.62, 0.06, 0.62]), { color: C('#ffcf1a'), spec: 0.3 }); D(A.cyl, M.trs([x - 0.03, h, z], [0, 0, Math.PI / 2 - 0.3], [0.3, 0.09, 0.3]), { color: C('#6a3e22'), spec: 0.2 }); D(A.sphere, M.trs([x, h * 0.55, z + 0.15], [0, 0, 0], [0.32, 0.08, 0.18]), { color: C('#5cae3e') }); } });
      ZPF.mailbox = bake(() => { D(A.box, M.trs([0, 0.6, 0], [0, 0, 0], [0.12, 1.2, 0.12]), { color: wood }); D(A.box, M.trs([0, 1.25, 0], [0, 0, 0], [0.36, 0.3, 0.6]), { color: [0.85, 0.86, 0.9], spec: 1 }); D(A.cyl, M.trs([0, 1.4, 0], [Math.PI / 2, 0, 0], [0.36, 0.6, 0.18]), { color: [0.85, 0.86, 0.9], spec: 1 }); D(A.box, M.trs([0.2, 1.48, 0.1], [0, 0, 0], [0.03, 0.26, 0.1]), { color: C('#e8463a') }); });
      ZPF.bench = bake(() => { const g = [0.2, 0.32, 0.26]; D(A.box, M.trs([0, 0.5, 0], [0, 0, 0], [0.55, 0.08, 1.9]), { color: C('#b07a4a'), spec: 0.2 }); D(A.box, M.trs([0.28, 0.85, 0], [0, 0, 0.1], [0.06, 0.5, 1.9]), { color: C('#b07a4a'), spec: 0.2 }); for (const dz of [-0.8, 0.8]) D(A.box, M.trs([0.05, 0.3, dz], [0, 0, 0], [0.6, 0.6, 0.07]), { color: g, spec: 0.6 }); });
    }
    function drawZoneLot(o, zNear){
      const M = E.M, sd = o.side, zc = zNear - o.len / 2;
      if (o.z === 'farm') {
        DB(ZPF.rail[sd], M.trs([0, 0, zNear]));
        if (o.v === 'farmhouse') { DB(PF.house[FARM_H + '|' + sd], M.trs([0, 0, zc + 4])); const mx = sd * 11, mz = zc - 7; DB(ZPF.mill, M.trs([mx, 0, mz])); DB(ZPF.wheel, M.trs([mx - sd * 0.5, 8.6, mz], [st.time * 1.6 + o.r, 0, 0])); D(A.box, M.trs([mx + sd * 1.5, 8.6, mz], [0, 0, 0], [2.4, 0.9, 0.05]), { color: [0.95, 0.95, 0.95], spec: 0.3 }); }
        else DB(ZPF[o.v][sd], M.trs([0, 0, zc]));
        if (o.tree) drawTree({ side: sd, s: o.treeS, rot: o.rot, x: sd * 9.5 }, zNear - 2);
      } else if (o.z === 'town') DB(ZPF.shop[o.v + '|' + sd], M.trs([0, 0, zc]));
      else DB(ZPF.tower[o.v + '|' + o.hi + '|' + sd], M.trs([0, 0, zc]));
    }
    // a house, its porch path and mailbox, in the house's own space (centre of the lot at z = 0)
    function houseParts(h, sd){
      const M = E.M, S = HOUSES[h], depth = 8, setback = 16, hx = sd * (setback + depth / 2), hh = 6, wid = 10;
      D(A.box, M.trs([hx, hh / 2, 0], [0, 0, 0], [depth, hh, wid]), { tex: A.sides[h], uvScale: [depth / 1.2, hh / 1.2], spec: 0.08 });
      D(A.quad, M.trs([sd * (setback - 0.02), hh / 2, 0], [0, sd < 0 ? Math.PI / 2 : -Math.PI / 2, 0], [wid, hh, 1]), { tex: A.fronts[h], spec: 0.15, shine: 30 });
      const ri = ROOF_COLS.indexOf(S.roof);
      D(A.roof, M.trs([hx, hh, 0], [0, 0, 0], [depth / 2 + 0.7, 3.0, wid + 0.8]), { tex: A.roofs[ri], uvScale: [3, 2], spec: 0.1 });
      D(A.box, M.trs([hx + sd * 1.8, hh + 2.6, -2.8], [0, 0, 0], [0.9, 2.2, 0.9]), { color: [0.72, 0.36, 0.28], spec: 0.1 });
      D(A.box, M.trs([hx + sd * 1.8, hh + 3.75, -2.8], [0, 0, 0], [1.05, 0.14, 1.05]), { color: [0.55, 0.28, 0.22], spec: 0.1 });
      D(A.box, M.trs([sd * (setback - 0.01), hh + 0.02, 0], [0, 0, 0], [0.3, 0.12, wid + 0.8]), { color: [0.98, 0.97, 0.94] });
      // porch step and a little awning over the door
      D(A.box, M.trs([sd * (setback - 0.6), 0.2, S.garage ? -1.0 : 0.15], [0, 0, 0], [1.2, 0.3, 2.2]), { color: [0.88, 0.84, 0.78], spec: 0.05 });
      D(A.box, M.trs([sd * (setback - 0.45), 3.15, S.garage ? -1.0 : 0.15], [0, 0, sd * 0.25], [1.0, 0.1, 2.2]), { color: E.hex(S.roof), spec: 0.2 });
      // walkway to the door and the mailbox by the street
      D(A.box, M.trs([sd * 10.8, 0.15, -5.4], [0, 0, 0], [8.4, 0.03, 1.2]), { color: [0.93, 0.88, 0.8], spec: 0.05, noShadow: true });
      const mx = sd * 6.4, mz = -4.0;
      D(A.box, M.trs([mx, 0.55, mz], [0, 0, 0], [0.1, 1.1, 0.1]), { color: [0.95, 0.95, 0.95] });
      D(A.box, M.trs([mx, 1.18, mz], [0, 0, 0], [0.32, 0.3, 0.5]), { color: E.hex(S.door), spec: 0.5, shine: 40 });
      D(A.cyl, M.trs([mx, 1.33, mz], [Math.PI / 2, 0, 0], [0.32, 0.5, 0.15]), { color: E.hex(S.door), spec: 0.5, shine: 40 });
      D(A.box, M.trs([mx + 0.18, 1.42, mz + 0.1], [0, 0, 0], [0.03, 0.22, 0.1]), { color: E.hex('#e8463a') });
    }
    // hedge, or a white picket fence with a flower bed, along the front of a lot of length len (near end at z = 0)
    function frontParts(front, len, sd){
      const M = E.M, runLen = len - 2.4, runZ = -runLen / 2;
      if (front === 'hedge') { D(A.hedge, M.trs([sd * 6.75, 0.12, runZ], [0, 0, 0], [1.0, 1.25, runLen]), { tex: A.tHedge, uvScale: [runLen / 2, 1], spec: 0.08 }); return; }
      D(A.box, M.trs([sd * 6.5, 0.55, runZ], [0, 0, 0], [0.05, 0.08, runLen]), { color: [1, 1, 1], spec: 0.2 });
      D(A.box, M.trs([sd * 6.5, 0.3, runZ], [0, 0, 0], [0.05, 0.08, runLen]), { color: [1, 1, 1], spec: 0.2 });
      for (let k = 0.15; k < runLen; k += 0.32) { D(A.box, M.trs([sd * 6.52, 0.42, -k], [0, 0, 0], [0.04, 0.72, 0.12]), { color: [1, 1, 1], spec: 0.2 }); D(A.box, M.trs([sd * 6.52, 0.8, -k], [Math.PI / 4, 0, 0], [0.04, 0.085, 0.085]), { color: [1, 1, 1], spec: 0.2 }); }
      for (let k = 0.5; k < runLen; k += 0.55) { D(A.sphereLo, M.trs([sd * (7.0 + (k * 7 % 1) * 0.4), 0.22, -k], [0, 0, 0], [0.42, 0.32, 0.42]), { color: E.hex(['#ff6b8a','#ffd166','#c77dff','#ff9f43','#ffffff'][Math.floor(k * 1.7) % 5]), spec: 0.3 }); D(A.sphereLo, M.trs([sd * 7.2, 0.1, -k - 0.25], [0, 0, 0], [0.5, 0.22, 0.5]), { color: [0.3, 0.55, 0.25], spec: 0.05 }); }
    }
    function treeParts(bloom, tn){
      const M = E.M;
      D(A.cyl, M.trs([0, 1.2, 0], [0, 0, 0.03], [0.26, 2.4, 0.26]), { tex: A.tBark, color: [1, 1, 1], spec: 0.05 });
      for (const [bx, by, bz, a] of [[0.35, 2.3, 0, 0.7], [-0.3, 2.45, 0.1, -0.8]]) D(A.cyl, M.trs([bx, by, bz], [0, 0, a], [0.1, 0.9, 0.1]), { tex: A.tBark, color: [1, 1, 1], spec: 0.05 });
      const blobs = [[0, 3.3, 0, 1.55], [-0.75, 2.85, 0.3, 1.1], [0.8, 2.95, -0.2, 1.15], [0.15, 3.95, 0.2, 1.1], [-0.2, 3.1, -0.7, 0.95]];
      const col = bloom ? [1, 1, 1] : [0.95 * tn, 1, 0.85 * (2 - tn)];
      for (const [bx, by, bz, r] of blobs) D(A.bump, M.trs([bx, by, bz], [0, bx * 3, 0], [r * 2, r * 1.85, r * 2]), { tex: bloom ? A.tBlossom : A.tLeaf, color: col, spec: 0.1, shine: 12, uvScale: [2, 2], rim: 0.35 });
    }
    function drawLot(o, zNear){
      const M = E.M, sd = o.side, len = o.len;
      if (!PF.lamp) buildPrefabs();
      DB(PF.front[o.front + '|' + len + '|' + sd] || PF.front[o.front + '|12|' + sd], M.trs([0, 0, zNear]));
      DB(PF.house[o.h + '|' + sd], M.trs([0, 0, zNear - len / 2]));
      if (o.tree) drawTree({ side: sd, s: o.treeS, rot: o.rot, x: sd * 10.6 }, zNear - 3);
    }
    // a park instead of houses: ponds with ducks, a playground, a fountain, or a little wood
    function drawPark(o, z){
      const M = E.M, sd = o.side, zc = z - o.len / 2, R = PB.mulberry(Math.floor(o.r));
      // low hedge along the sidewalk with a gap for the path
      E.M && D(A.hedge, M.trs([sd * 6.75, 0.08, z - o.len * 0.3], [0, 0, 0], [0.8, 0.8, o.len * 0.55]), { tex: A.tHedge, uvScale: [o.len / 3, 1], spec: 0.08 });
      D(A.box, M.trs([sd * 10, 0.15, z - o.len * 0.8], [0, 0, 0], [7, 0.03, 1.6]), { color: [0.9, 0.82, 0.66], spec: 0.05, noShadow: true });
      if (o.v === 'pond') {
        D(A.sphere, M.trs([sd * 15, 0.12, zc], [0, 0, 0], [9, 0.1, 11]), { color: C('#4aa8d8'), spec: 1.6, shine: 90, noShadow: true });
        D(A.sphere, M.trs([sd * 15, 0.1, zc], [0, 0, 0], [10, 0.08, 12]), { color: C('#c9b98a'), spec: 0.05, noShadow: true });
        for (let k=0;k<3;k++) { const dx = sd * (13 + R() * 4) + Math.sin(st.time * 0.6 + k) * 0.6, dz = zc + (R() - .5) * 6 + Math.cos(st.time * 0.5 + k) * 0.6;
          D(A.sphere, M.trs([dx, 0.3, dz], [0, 0, 0], [0.55, 0.38, 0.75]), { color: C('#ffe04a'), spec: 0.4 });
          D(A.sphere, M.trs([dx, 0.62, dz - 0.25], [0, 0, 0], [0.32, 0.32, 0.32]), { color: C('#ffe04a'), spec: 0.4 });
          D(A.cone, M.trs([dx, 0.6, dz - 0.46], [-Math.PI / 2, 0, 0], [0.12, 0.18, 0.12]), { color: C('#ff8a3d') }); }
        for (let k=0;k<5;k++) D(A.cyl, M.trs([sd * (10.5 + R() * 1.5), 0.6, zc + (R() - .5) * 9], [0.1, 0, 0.1], [0.06, 1.2, 0.06]), { color: C('#5a8a3a') });
      } else if (o.v === 'play') {
        const x = sd * 13;
        // slide
        D(A.box, M.trs([x, 1.2, zc + 2], [0, 0, 0], [1.4, 0.15, 1.4]), { color: C('#5ee0ff'), spec: 0.5 });
        for (const [dx, dz] of [[-0.6, 1.4], [0.6, 1.4], [-0.6, 2.6], [0.6, 2.6]]) D(A.cyl, M.trs([x + dx, 0.6, zc + dz], [0, 0, 0], [0.12, 1.2, 0.12]), { color: C('#ffd23f'), spec: 0.5 });
        D(A.box, M.trs([x, 0.7, zc - 0.2], [Math.atan2(1.2, 3), 0, 0], [1.0, 0.1, 3.2]), { color: C('#ff5a4a'), spec: 0.8, shine: 50 });
        // swings
        const sx = sd * 17;
        for (const dz of [-3.8, -0.8]) D(A.cyl, M.trs([sx, 1.3, zc + dz], [0, 0, 0], [0.14, 2.6, 0.14]), { color: C('#7d4cff'), spec: 0.5 });
        D(A.cyl, M.trs([sx, 2.6, zc - 2.3], [Math.PI / 2, 0, 0], [0.14, 3.2, 0.14]), { color: C('#7d4cff'), spec: 0.5 });
        for (const [dz, ph] of [[-3.0, 0], [-1.6, 1.7]]) { const sw = Math.sin(st.time * 2.2 + ph) * 0.45; D(A.box, M.mul(M.trs([sx, 2.6, zc + dz], [0, 0, sw]), M.trs([0, -1.7, 0], [0, 0, 0], [0.7, 0.08, 0.35])), { color: C('#ff5fa2'), spec: 0.4 }); for (const e of [-0.3, 0.3]) D(A.box, M.mul(M.trs([sx, 2.6, zc + dz], [0, 0, sw]), M.trs([e, -0.85, 0], [0, 0, 0], [0.02, 1.7, 0.02])), { color: [0.3, 0.3, 0.3], noShadow: true }); }
        D(A.box, M.trs([x - sd * 0.5, 0.1, zc - 4.5], [0, 0, 0], [3, 0.2, 2.5]), { color: C('#f2d48a'), spec: 0.05 });
      } else if (o.v === 'fountain') {
        const x = sd * 14;
        D(A.cyl, M.trs([x, 0.3, zc], [0, 0, 0], [5, 0.6, 5]), { color: C('#d8d2c6'), spec: 0.3 });
        D(A.cyl, M.trs([x, 0.58, zc], [0, 0, 0], [4.4, 0.06, 4.4]), { color: C('#5ab8e8'), spec: 1.6, shine: 90, noShadow: true });
        D(A.cyl, M.trs([x, 1.1, zc], [0, 0, 0], [0.5, 1.4, 0.5]), { color: C('#d8d2c6'), spec: 0.3 });
        D(A.cyl, M.trs([x, 1.8, zc], [0, 0, 0], [1.8, 0.2, 1.8]), { color: C('#d8d2c6'), spec: 0.3 });
        for (let k=0;k<8;k++) { const t = (st.time * 1.2 + k / 8) % 1, a = k * 0.8; SP([x + Math.cos(a) * t * 1.4, 2.0 + t * 1.6 - t * t * 2.4, zc + Math.sin(a) * t * 1.4], 0.35, [0.8, 0.92, 1], 0.6 * (1 - t), false); }
        for (let k=0;k<6;k++) { const a = k / 6 * Math.PI * 2; D(A.sphere, M.trs([x + Math.cos(a) * 3.3, 0.35, zc + Math.sin(a) * 3.3], [0, 0, 0], [0.7, 0.5, 0.7]), { color: C(['#ff6b8a','#ffd166','#c77dff'][k % 3]), spec: 0.3 }); }
      } else {
        for (let k=0;k<3;k++) drawTree({ side: sd, s: 0.9 + R() * 0.5, rot: R() * 6, x: sd * (9 + R() * 12), tint: 0.8 + R() * 0.35, bloom: R() < 0.25 }, zc + (R() - .5) * 10);
      }
      // a park bench by the path
      const bx = sd * 8.2, bz = z - o.len * 0.2;
      D(A.box, M.trs([bx, 0.5, bz], [0, 0, 0], [0.5, 0.08, 1.8]), { color: C('#a86a3a'), spec: 0.2 });
      D(A.box, M.trs([bx + sd * 0.25, 0.8, bz], [0, 0, 0], [0.06, 0.45, 1.8]), { color: C('#a86a3a'), spec: 0.2 });
      for (const dz of [-0.75, 0.75]) D(A.box, M.trs([bx, 0.25, bz + dz], [0, 0, 0], [0.45, 0.5, 0.06]), { color: [0.2, 0.2, 0.22] });
    }
    function drawTree(o, z){
      if (!PF.lamp) buildPrefabs();
      const x = o.x != null ? o.x : o.side * 4.1, s = o.s, t = Math.max(0, Math.min(2, Math.round(((o.tint || 1) - 0.85) / 0.15)));
      DB(PF.tree[(o.bloom ? 1 : 0) + '|' + t], E.M.trs([x, 0, z], [0, o.rot || 0, 0], s));
    }
    function drawLamp(o, z){ if (!PF.lamp) buildPrefabs(); DB(PF.lamp, E.M.trs([o.side * 4.0, 0, z])); }
    function drawHydrant(o, z){ if (!PF.lamp) buildPrefabs(); DB(PF.hydrant, E.M.trs([o.side * 4.2, 0, z])); }
    function drawObstacle(o, z){
      if (o.type === 'bus') { drawBus(o, z); return; }
      if (o.type === 'gap') { drawGap(o, z); return; }
      const M = E.M; let x = laneX(o.lane), y = 0, rot = 0;
      if (o.fly) { y = Math.max(-2, o.fly.y); rot = o.fly.rot; x += o.fly.x || 0; }
      const mv = o.moving && o.type === 'truck', at = (dx, dy, dz) => [x + dx, y + dy, z + (mv ? -4.6 - dz : dz)], R3 = [rot, 0, rot * 0.5];
      if (o.type === 'cone') {
        // a grumpy garden gnome
        D(A.cyl, M.trs(at(0, 0.06, 0), R3, [0.6, 0.12, 0.6]), { color: [0.55, 0.42, 0.3], spec: 0.1 });
        D(A.cone, M.trs(at(0, 0.32, 0), R3, [0.62, 0.5, 0.62]), { color: E.hex('#3f7fd6'), spec: 0.3, ol: 0.03 });
        D(A.sphere, M.trs(at(0, 0.6, 0.05), R3, [0.34, 0.32, 0.32]), { color: E.hex('#ffd2b0'), spec: 0.2 });
        D(A.cone, M.trs(at(0, 0.5, 0.12), [rot + 3.14, 0, 0], [0.34, 0.3, 0.2]), { color: [0.98, 0.98, 0.98], spec: 0.2 });
        D(A.cone, M.trs(at(0, 0.92, 0), [rot - 0.2, 0, 0], [0.4, 0.55, 0.4]), { color: E.hex('#e63b2e'), spec: 0.4, ol: 0.03 });
        D(A.sphere, M.trs(at(0, 0.62, 0.21), R3, [0.1, 0.09, 0.09]), { color: E.hex('#ff8a7a'), spec: 0.3 });
      } else if (o.type === 'can') {
        // shiny cartoon trash can with a wobbly lid
        const metal = { color: [0.78, 0.82, 0.86], spec: 1.0, shine: 50, ol: 0.035 };
        D(A.cyl, M.trs(at(0, 0.5, 0), [rot, 0, rot], [0.72, 1.0, 0.72]), metal);
        for (const ry of [0.25, 0.55, 0.85]) D(A.cyl, M.trs(at(0, ry, 0), [rot, 0, rot], [0.76, 0.05, 0.76]), { color: [0.66, 0.7, 0.75], spec: 1 });
        const wob = Math.sin(st.time * 6 + o.at) * 0.06;
        D(A.sphere, M.trs(at(0, 1.05, 0), [rot + wob, 0, rot], [0.82, 0.22, 0.82]), metal);
        D(A.box, M.trs(at(0, 1.18, 0), [rot + wob, 0, rot], [0.26, 0.06, 0.06]), { color: [0.5, 0.52, 0.56], spec: 1 });
        D(A.sphere, M.trs(at(0.2, 1.0, 0.3), [0.4, 0.5, 0.2], [0.12, 0.05, 0.4]), { color: E.hex('#ffd54f'), spec: 0.4 });
      } else if (o.type === 'bar') {
        // a washing line full of laundry: slide underneath
        for (const sx of [-1.15, 1.15]) {
          D(A.cyl, M.trs(at(sx, 1.1, 0), [0, 0, 0], [0.1, 2.2, 0.1]), { color: [0.92, 0.9, 0.86], spec: 0.2 });
          D(A.box, M.trs(at(sx, 2.15, 0), [0, 0, 0], [0.5, 0.08, 0.08]), { color: [0.92, 0.9, 0.86] });
        }
        D(A.box, M.trs(at(0, 2.1, 0), [0, 0, 0], [2.3, 0.02, 0.02]), { color: [0.95, 0.95, 0.95], noShadow: true });
        const sway = Math.sin(st.time * 3 + o.at) * 0.12;
        [-0.7, 0, 0.7].forEach((sx, i) => D(A.shirt, M.trs(at(sx, 2.1, 0), [sway * (i % 2 ? -1 : 1), 0, 0], [1.05, 1.05, 1]), { tex: A.shirts[(i + Math.floor(o.at)) % 4], spec: 0.1, doubleSided: true }));
      } else {
        // rounded family minivan blocking the lane
        const col = E.hex(o.color), paint = { color: col, spec: 0.9, shine: 60, ol: 0.045 }, glass = { color: [0.25, 0.4, 0.6], spec: 1.4, shine: 90 };
        D(A.box, M.trs(at(0, 0.95, -2.3), [rot * 0.3, 0, rot * 0.2], [2.2, 1.1, 4.6]), paint);
        D(A.sphere, M.trs(at(0, 1.5, -2.4), [0, 0, 0], [2.18, 1.4, 4.7]), paint);
        D(A.box, M.trs(at(0, 1.75, 0.0), [0.35, 0, 0], [1.8, 0.75, 0.05]), glass);
        for (const sx of [-1, 1]) D(A.box, M.trs(at(sx * 1.09, 1.72, -2.4), [0, 0, 0], [0.04, 0.6, 3.4]), glass);
        D(A.box, M.trs(at(0, 0.5, 0.04), [0, 0, 0], [2.3, 0.3, 0.2]), { color: [0.85, 0.85, 0.88], spec: 0.8 });
        for (const sx of [-1, 1]) {
          D(A.sphere, M.trs(at(sx * 0.95, 1.05, 0.05), [0, 0, 0], [0.3, 0.3, 0.1]), mv ? { color: [1, 1, 0.85], emissive: [1.6, 1.5, 1.1], noShadow: true } : { color: [1, 0.2, 0.15], emissive: [1.2, 0.1, 0.05], noShadow: true });
          if (mv) SP(at(sx * 0.95, 1.05, 0.3), 1.2, [1, 0.95, 0.7], 0.5, true);
          for (const wz2 of [-0.9, -3.7]) D(A.wheel, M.trs(at(sx * 0.98, 0.42, wz2)), { color: [0.12, 0.12, 0.14], spec: 0.15 });
        }
        if (o.taxi) { D(A.box, M.trs(at(0, 2.3, -2.2), [0, 0, 0], [0.9, 0.32, 0.45]), { color: [1, 1, 0.92], emissive: [0.4, 0.38, 0.2], ol: 0.02 }); for (const sx of [-1, 1]) D(A.box, M.trs(at(sx * 1.1, 1.05, -2.4), [0, 0, 0], [0.04, 0.18, 4.0]), { tex: A.tChecker, uvScale: [1, 1], spec: 0.3 }); }
        else D(A.box, M.trs(at(0, 2.25, -2.4), [0, 0, 0], [1.6, 0.06, 2.6]), { color: [0.3, 0.3, 0.32], spec: 0.5 });
      }
    }
    function drawFood(o, z){
      const M = E.M, bob = Math.sin(st.time * 4 + o.at) * 0.08, spin = st.time * 2 + o.at;
      const pos = [o.x, o.h + bob, z];
      SP([pos[0], pos[1], pos[2]], 1.1, [1, 0.9, 0.5], 0.3, true);
      if (o.type === 'donut') {
        D(A.torus, M.trs(pos, [1.1, spin, 0], 1.15), { color: E.hex('#e0a25c'), spec: 0.2 });
        D(A.torus, M.trs([pos[0], pos[1] + 0.03, pos[2]], [1.1, spin, 0], [1.17, 0.9, 1.17]), { color: E.hex('#ff7eb6'), spec: 0.9, shine: 60 });
      } else if (o.type === 'cookie') {
        D(A.cyl, M.trs(pos, [1.2, spin, 0], [0.62, 0.1, 0.62]), { color: E.hex('#d9a25e'), spec: 0.2 });
        for (let k=0;k<5;k++) { const a = spin + k * 1.26, r = 0.18; D(A.sphere, M.trs([pos[0] + Math.cos(a) * r, pos[1] + Math.sin(k) * 0.15, pos[2] + 0.05 + Math.sin(a) * 0.04], [0, 0, 0], [0.1, 0.1, 0.06]), { color: E.hex('#5a3418'), spec: 0.4 }); }
      } else if (o.type === 'chips') {
        D(A.sphere, M.trs(pos, [0, spin * 0.6, 0], [0.62, 0.78, 0.26]), { color: E.hex('#ff5a3c'), spec: 1.0, shine: 60 });
        D(A.sphere, M.trs([pos[0], pos[1] - 0.02, pos[2]], [0, spin * 0.6, 0], [0.5, 0.26, 0.28]), { color: E.hex('#ffd54f'), spec: 0.8 });
      } else {
        D(A.sphere, M.trs([pos[0], pos[1] + 0.12, pos[2]], [0, spin, 0], [0.55, 0.3, 0.55]), { color: E.hex('#e8a25a'), spec: 0.4 });
        D(A.cyl, M.trs(pos, [0, spin, 0], [0.52, 0.12, 0.52]), { color: E.hex('#6a3e22'), spec: 0.3 });
        D(A.cyl, M.trs([pos[0], pos[1] + 0.07, pos[2]], [0, spin, 0], [0.58, 0.04, 0.58]), { color: E.hex('#6fd35a') });
        D(A.cyl, M.trs([pos[0], pos[1] - 0.1, pos[2]], [0, spin, 0], [0.52, 0.1, 0.52]), { color: E.hex('#e8a25a'), spec: 0.3 });
      }
    }
    function drawPow(o, z){
      const M = E.M, c = C(POWERS[o.type].color), bob = Math.sin(st.time * 3) * 0.12, spin = st.time * 2.2;
      const pos = [o.x, o.h + bob, z];
      SP(pos, 2.2, c, 0.55, true);
      const icon = { life: A.heart, zoom: A.bolt, double: A.star }[o.type] || null;
      if (icon) D(icon, M.trs(pos, [0, spin, 0], 1.2), { color: c, emissive: c.map(v => v * 0.6), spec: 0.9, shine: 60 });
      else if (o.type === 'gift') { D(A.box, M.trs(pos, [0, spin, 0], [0.8, 0.8, 0.8]), { color: c, emissive: c.map(v => v * 0.3), spec: 0.8, ol: 0.03 }); D(A.box, M.trs(pos, [0, spin, 0], [0.84, 0.84, 0.18]), { color: C('#ffd23f'), spec: 0.8 }); D(A.box, M.trs(pos, [0, spin, 0], [0.18, 0.84, 0.84]), { color: C('#ffd23f'), spec: 0.8 }); D(A.torus, M.trs([pos[0], pos[1] + 0.48, pos[2]], [0, spin, 0], [0.9, 0.9, 0.9]), { color: C('#ffd23f'), spec: 0.8 }); }
      else if (o.type === 'gold') { D(A.sphere, M.trs(pos, [0, spin, 0], [0.6, 0.48, 0.5]), { color: c, emissive: c.map(v => v * 0.4), spec: 1.4, shine: 70, ol: 0.03 }); for (let q=0;q<4;q++) D(A.sphere, M.trs([pos[0] + (q - 1.5) * 0.2 * Math.cos(spin), pos[1] + 0.38 - Math.abs(q - 1.5) * 0.06, pos[2] + (q - 1.5) * 0.2 * Math.sin(spin)], [0, 0, 0], [0.18, 0.18, 0.18]), { color: c, emissive: c.map(v => v * 0.4), spec: 1.4 }); }
      else if (o.type === 'giant') { D(A.arrow, M.trs(pos, [0, spin, Math.PI / 2], [1.1, 1.1, 2]), { color: c, emissive: c.map(v => v * 0.4), spec: 0.9, ol: 0.03 }); }
      else if (o.type === 'shield') { D(A.box, M.trs(pos, [0.4, spin, 0.3], [0.5, 0.08, 1.2]), { color: c, emissive: c.map(v => v * 0.4), spec: 0.9 }); for (const wz of [-0.4, 0.4]) D(A.wheel, M.trs([pos[0], pos[1] - 0.12, pos[2] + wz * Math.cos(spin)], [0, spin, 0], [0.3, 0.2, 0.2]), { color: C('#7dff6a') }); }
      else if (o.type === 'magnet') D(A.torus, M.trs(pos, [0, spin, Math.PI / 2], 1.4), { color: c, emissive: c.map(v => v * 0.5), spec: 0.9 });
      else if (o.type === 'spring') for (let k=0;k<3;k++) D(A.torus, M.trs([pos[0], pos[1] - 0.2 + k * 0.2, pos[2]], [0, spin, 0], 1.1), { color: c, emissive: c.map(v => v * 0.5), spec: 0.9 });
      else D(A.sphere, M.trs(pos, [0, spin, 0], 0.55), { color: c, emissive: c.map(v => v * 0.6), spec: 0.9 });
      D(A.sphere, M.trs(pos, [0, 0, 0], 1.25), { color: [0.85, 0.95, 1], alpha: 0.18, spec: 1, shine: 80, noShadow: true });
    }
    // ================= character rig: run cycle, squash & stretch, follow-through =================
    const FOODCOL = { donut: '#ff7eb6', cookie: '#d9a25e', chips: '#ff5a3c', burger: '#e8a25a' };
    const TAIL_K = 7, TAIL_S = 36, TAIL_R = 20;
    const TAIL_REST = [[0.02, 0.46, 0.3], [0.14, 0.5, 0.5], [0.36, 0.6, 0.64], [0.58, 0.78, 0.66], [0.72, 0.98, 0.56], [0.76, 1.16, 0.42], [0.7, 1.28, 0.28], [0.6, 1.34, 0.16]];
    const FLUFF = Array.from({ length: (TAIL_S + 1) * TAIL_R }, (_, i) => { const r = Math.sin(i * 12.9898) * 43758.5453; return r - Math.floor(r); });
    function tailTex(){
      return canvas(128, 512, (g, w, h) => {
        const cream = '#e9e3da', dark = '#3b353a';
        g.fillStyle = cream; g.fillRect(0, 0, w, h);
        for (const [a, b] of [[0.24, 0.32], [0.46, 0.54], [0.67, 0.75], [0.87, 1.01]]) {
          const gr = g.createLinearGradient(0, a * h - 10, 0, b * h + 10); gr.addColorStop(0, 'rgba(44,40,45,0)'); gr.addColorStop(10 / ((b - a) * h + 20), dark); gr.addColorStop(1 - 10 / ((b - a) * h + 20), dark); gr.addColorStop(1, 'rgba(44,40,45,0)');
          g.fillStyle = gr; g.fillRect(0, a * h - 10, w, (b - a) * h + 20);
        }
        // fur strands running along the tail
        for (let i=0;i<2200;i++) { const x = Math.random() * w, y = Math.random() * h, l = 6 + Math.random() * 10; g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y + l / 2, x + (Math.random() - .5) * 3, y + l); g.stroke(); }
      });
    }
    function tailGeo(){
      const n = (TAIL_S + 1) * TAIL_R + 1, p = new Float32Array(n * 3), nn = new Float32Array(n * 3), uv = [], idx = [];
      for (let i=0;i<=TAIL_S;i++) for (let j=0;j<TAIL_R;j++) uv.push(j / TAIL_R, i / TAIL_S);
      uv.push(0.5, 1);
      for (let i=0;i<TAIL_S;i++) for (let j=0;j<TAIL_R;j++) { const a = i * TAIL_R + j, b = i * TAIL_R + (j + 1) % TAIL_R, c = a + TAIL_R, d = b + TAIL_R; idx.push(a, c, b, b, c, d); }
      const tip = n - 1; for (let j=0;j<TAIL_R;j++) idx.push(TAIL_S * TAIL_R + j, tip, TAIL_S * TAIL_R + (j + 1) % TAIL_R);
      return { p: Array.from(p), n: Array.from(nn), uv, idx, dynamic: true };
    }
    const TP = new Float32Array(((TAIL_S + 1) * TAIL_R + 1) * 3), TN = new Float32Array(TP.length);
    function cr(a, b, c, d, t){ const t2 = t * t, t3 = t2 * t; return [0, 1, 2].map(k => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3)); }
    function buildTail(Q){
      const pts = [], K = Q.length - 1;
      for (let i=0;i<=TAIL_S;i++) { const u = i / TAIL_S * K, s = Math.min(K - 1, Math.floor(u)), f = u - s; pts.push(cr(Q[Math.max(0, s - 1)], Q[s], Q[s + 1], Q[Math.min(K, s + 2)], f)); }
      let o = 0;
      for (let i=0;i<=TAIL_S;i++) {
        const t = i / TAIL_S, a = pts[Math.max(0, i - 1)], b = pts[Math.min(TAIL_S, i + 1)];
        let T = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = Math.hypot(...T) || 1; T = T.map(v => v / tl);
        let Nv = [0, T[2], -T[1]]; const nl = Math.hypot(...Nv) || 1; Nv = Nv.map(v => v / nl);
        const B = [T[1] * Nv[2] - T[2] * Nv[1], T[2] * Nv[0] - T[0] * Nv[2], T[0] * Nv[1] - T[1] * Nv[0]];
        let r = 0.075 + 0.15 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.08)), 0.8);
        if (t > 0.82) r *= Math.sqrt(Math.max(0, 1 - (t - 0.82) / 0.18) * 0.92 + 0.08);
        for (let j=0;j<TAIL_R;j++) {
          const an = j / TAIL_R * Math.PI * 2, c = Math.cos(an), s = Math.sin(an);
          const dir = [Nv[0] * c + B[0] * s, Nv[1] * c + B[1] * s, Nv[2] * c + B[2] * s];
          const rr = r * (1 + 0.16 * (FLUFF[i * TAIL_R + j] - 0.5) * Math.min(1, t * 3));
          TP[o] = pts[i][0] + dir[0] * rr; TP[o + 1] = pts[i][1] + dir[1] * rr; TP[o + 2] = pts[i][2] + dir[2] * rr;
          TN[o] = dir[0]; TN[o + 1] = dir[1]; TN[o + 2] = dir[2]; o += 3;
        }
      }
      const e = pts[TAIL_S], pe = pts[TAIL_S - 1], d = [e[0] - pe[0], e[1] - pe[1], e[2] - pe[2]], dl = Math.hypot(...d) || 1;
      TP[o] = e[0] + d[0] / dl * 0.05; TP[o + 1] = e[1] + d[1] / dl * 0.05; TP[o + 2] = e[2] + d[2] / dl * 0.05; TN[o] = d[0] / dl; TN[o + 1] = d[1] / dl; TN[o + 2] = d[2] / dl;
      E.updateMesh(A.tail, TP, TN);
    }
    // body frame: the whole character squashes, stretches, leans and banks as one
    const BOARD_Y = 0.16; // top of the deck above the street
    const riding = () => !!(st.fx && st.fx.shield > 0 && st.phase !== 'menu');
    function bodyFrame(){
      const p = st.player, R = st.rig, run = p.run * 2.2, sliding = p.slide > 0, air = !!p.air, ride = riding();
      let sy = 1, bob = 0, pitch = -0.18, roll = R.bank, yaw = R.yaw + R.spin * Math.PI * 4;
      // happy spin on every jump (two spins with spring shoes)
      if (R.jk != null) { const k = Math.min(1, R.jk), e = 1 - Math.pow(1 - k, 3); yaw += e * Math.PI * 2 * (R.jturns || 1); }
      if (ride) {
        // skater stance: turned a little sideways, knees bent, swaying to keep balance
        const push = R.push > 0 ? Math.sin((1 - R.push / 0.6) * Math.PI) : 0;
        yaw += 0.75; pitch = -0.06 - push * 0.12; roll = R.bank * 1.5 + Math.sin(st.time * 1.8) * 0.05;
        if (sliding) { sy = 0.78; bob = -0.04; pitch = -0.32; }
        else if (air) { sy = 0.9 + Math.max(-0.08, Math.min(0.12, p.vy * 0.012)); }
        else { sy = 0.92 - push * 0.05; bob = Math.sin(st.time * 3.1) * 0.015; }
        if (R.land > 0) { const k = R.land / 0.24; sy *= 1 - 0.18 * Math.sin(k * Math.PI); }
        const sx = 1 / Math.sqrt(Math.max(0.5, sy)), gk = st.giantK || 1;
        return { m: E.M.trs([p.x, p.h + BOARD_Y * gk + bob, 0], [pitch, yaw, roll], [sx * gk, sy * gk, sx * gk]), run, sliding, air, sy, ride: true, push };
      }
      if (sliding) { pitch = -1.05; sy = 0.95; bob = -0.12; }
      else if (air) { sy = 1 + Math.max(-0.14, Math.min(0.2, p.vy * 0.022)); pitch = -0.1 - Math.max(0, -p.vy) * 0.015; }
      else { bob = Math.abs(Math.sin(run)) * 0.13; sy = 1 + 0.07 * (Math.abs(Math.sin(run)) - 0.55); roll += Math.sin(run) * 0.05; }
      if (R.land > 0) { const k = R.land / 0.24; sy *= 1 - 0.28 * Math.sin(k * Math.PI); }
      if (st.phase === 'menu') { pitch = -0.05; }
      const sx = 1 / Math.sqrt(Math.max(0.5, sy));
      const gk = st.giantK || 1;
      return { m: E.M.trs([p.x, p.h + bob, 0], [pitch, yaw, roll], [sx * gk, sy * gk, sx * gk]), run, sliding, air, sy };
    }
    function rigUpdate(dt){
      const p = st.player;
      if (!st.rig) st.rig = { bank: 0, yaw: 0, land: 0, spin: 0, prevX: p.x, prevH: p.h, step: 0, tail: null, dust: [], fly: [], camX: 0, camY: 0, fov: 1, lastInv: 0, push: 0, pushIn: 0.6, roll: 0 };
      const R = st.rig; dt = Math.min(dt, 0.05);
      if (riding()) {
        const sp = st.speed * (st.fx.zoom > 0 ? 1.8 : 1) * (st.fx.slow > 0 ? 0.6 : 1);
        R.roll = (R.roll || 0) + sp * dt / 0.06;
        R.push = Math.max(0, (R.push || 0) - dt);
        if (!p.air && p.slide <= 0) { R.pushIn = (R.pushIn ?? 1) - dt; if (R.pushIn <= 0) { R.push = 0.6; R.pushIn = 2.4 + Math.random(); } }
        if (R.push > 0.25 && R.push < 0.3 && !p.air) for (let i=0;i<3;i++) R.dust.push({ p: [p.x + 0.25, p.h + 0.05, 0.35], v: [(Math.random() - .5) * 0.6, 0.3 + Math.random() * 0.3, 1.5 + Math.random()], life: 0.45, max: 0.45, size: 0.2 });
        if (!p.air && Math.random() < 0.25) R.dust.push({ p: [p.x + (Math.random() < .5 ? -0.17 : 0.17), p.h + 0.03, 0.4], v: [(Math.random() - .5) * 0.3, 0.15, 2], life: 0.3, max: 0.3, size: 0.12 });
      }
      st.giantK = (st.giantK || 1) + (((st.fx && st.fx.giant > 0.3) ? 1.9 : 1) - (st.giantK || 1)) * Math.min(1, dt * 5);
      { const target = curSeg().th; st.camTh += (target - st.camTh) * Math.min(1, dt * 6.5); if (Math.abs(target - st.camTh) < 1e-4) st.camTh = target; }
      const vx = (p.x - R.prevX) / Math.max(dt, 1e-3);
      R.bank += (Math.max(-0.42, Math.min(0.42, -vx * 0.045)) - R.bank) * Math.min(1, dt * 12);
      R.yaw += (Math.max(-0.35, Math.min(0.35, -vx * 0.03)) - R.yaw) * Math.min(1, dt * 10);
      if (R.prevAir && !p.air) { R.land = 0.24; if (PB.sfx && st.phase === 'play') PB.sfx('land'); for (let i=0;i<10;i++) { const a = i / 10 * Math.PI * 2; R.dust.push({ p: [p.x + Math.cos(a) * 0.3, p.h + 0.1, Math.sin(a) * 0.3], v: [Math.cos(a) * 1.6, 0.5 + Math.random() * 0.5, Math.sin(a) * 1.2], life: 0.6, max: 0.6, size: 0.35 }); } }
      R.land = Math.max(0, R.land - dt);
      if (R.jk != null) { R.jk += dt / (0.5 + 0.18 * ((R.jturns || 1) - 1)); if (!reduceMotion && R.jk < 0.85 && Math.random() < 0.7) st.parts.push({ p: [p.x + (Math.random() - .5) * 0.8, p.h + 0.4 + Math.random() * 0.9, (Math.random() - .5) * 0.6], v: [(Math.random() - .5) * 1.5, 0.6 + Math.random(), 1.5], life: 0.5, color: [[1, 0.9, 0.3], [0.6, 0.9, 1], [1, 0.6, 0.85]][Math.floor(Math.random() * 3)], size: 0.16 }); if (R.jk >= 1) R.jk = null; }
      if (p.inv > R.lastInv + 0.5) R.spin = 1; R.lastInv = p.inv;
      R.spin = Math.max(0, R.spin - dt * 1.6);
      // footfall dust
      const run = p.run * 2.2, step = Math.floor(run / Math.PI);
      if (step !== R.step && !p.air && p.slide <= 0 && st.phase === 'play' && !riding()) { if (PB.sfx) PB.sfx('step'); const sx = step % 2 ? 0.2 : -0.2; for (let i=0;i<2;i++) R.dust.push({ p: [p.x + sx, p.h + 0.06, 0.1], v: [(Math.random() - .5) * 0.8, 0.4 + Math.random() * 0.4, 1 + Math.random()], life: 0.5, max: 0.5, size: 0.22 }); }
      R.step = step;
      if (p.slide > 0 && Math.random() < 0.7) R.dust.push({ p: [p.x + (Math.random() - .5) * 0.6, 0.08, 0.4], v: [(Math.random() - .5), 0.5, 2.5], life: 0.5, max: 0.5, size: 0.3 });
      const scroll = st.phase === 'play' ? st.speed * (st.fx.zoom > 0 ? 1.8 : 1) * (st.fx.slow > 0 ? 0.6 : 1) : 5;
      for (const d of R.dust) { d.p[0] += d.v[0] * dt; d.p[1] += d.v[1] * dt; d.p[2] += (d.v[2] + scroll * 0.9) * dt; d.v[1] -= 1.2 * dt; d.life -= dt; d.size += dt * 0.6; }
      R.dust = R.dust.filter(d => d.life > 0);
      for (const f of R.fly) f.t += dt; R.fly = R.fly.filter(f => f.t < 0.22);
      R.prevX = p.x; R.prevH = p.h; R.prevAir = !!p.air;
      // tail: a springy chain that lags behind the body and swishes as he runs
      const B = bodyFrame(), M = E && E.M; if (!M) return;
      const wag = Math.sin(run * 0.5) * 0.22 - R.bank * 0.8;
      const targets = TAIL_REST.map(([x, y, z], i) => { const t = i / (TAIL_REST.length - 1); return M.xform(B.m, [x + wag * Math.pow(t, 1.4), y, z]); });
      if (!R.tail) R.tail = { q: targets.map(v => v.slice()), pv: targets.map(v => v.slice()) };
      const T = R.tail, steps = 2, h = dt / steps;
      const L = TAIL_REST.map((v, i) => i ? Math.hypot(v[0] - TAIL_REST[i - 1][0], v[1] - TAIL_REST[i - 1][1], v[2] - TAIL_REST[i - 1][2]) : 0);
      for (let s=0;s<steps;s++) {
        T.q[0] = targets[0].slice(); T.pv[0] = targets[0].slice();
        for (let i=1;i<T.q.length;i++) {
          const q = T.q[i], pv = T.pv[i], t = i / (T.q.length - 1);
          const v = [(q[0] - pv[0]) * 0.9, (q[1] - pv[1]) * 0.9, (q[2] - pv[2]) * 0.9];
          T.pv[i] = q.slice();
          q[0] += v[0]; q[1] += v[1] - 3 * h * h; q[2] += v[2];
          const k = (0.42 - 0.2 * t) * (h * 60);
          for (let c=0;c<3;c++) q[c] += (targets[i][c] - q[c]) * Math.min(1, k);
        }
        for (let it=0;it<2;it++) for (let i=1;i<T.q.length;i++) {
          const a = T.q[i - 1], b = T.q[i], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dl = Math.hypot(...d) || 1, want = L[i] * (B.m[5] ? 1 : 1);
          const f = (dl - want) / dl; b[0] -= d[0] * f; b[1] -= d[1] * f; b[2] -= d[2] * f;
        }
      }
      // smooth, springy camera
      const camT = p.x * 0.55; R.camX += (camT - R.camX) * Math.min(1, dt * 5);
      R.camY += (p.h * (st.fx.balloon > 0 ? 0.8 : 0.3) - R.camY) * Math.min(1, dt * 3);
      const fovT = 1.0 + (st.phase === 'play' ? Math.max(0, st.speed - 12) / 14 * 0.07 : 0) + (st.fx.zoom > 0 ? 0.14 : 0);
      R.fov += (fovT - R.fov) * Math.min(1, dt * 3);
    }
    function drawRaccoon(){
      const M = E.M, p = st.player, fx = st.fx, R = st.rig;
      if (!R) return;
      const B = bodyFrame(), Bm = B.m, run = B.run;
      const flick = p.inv > 0 && Math.floor(p.inv * 10) % 2;
      const FURS = { fur_fox: [[1.3, 0.62, 0.24], [0.24, 0.11, 0.06], [1, 0.62, 0.32]], fur_snow: [[1.32, 1.4, 1.55], [0.3, 0.42, 0.66], [0.95, 1, 1.12]], fur_gold: [[1.55, 1.18, 0.45], [0.42, 0.24, 0.06], [1.15, 0.9, 0.45]] }, fur = FURS[PB.meta && PB.meta.look('dash', 'fur')] || [[0.62, 0.58, 0.6], [0.16, 0.15, 0.2], [1, 1, 1]];
      const grey = { tex: A.tFur, uvScale: [2, 2], color: fur[0], spec: fur === FURS.fur_gold ? 1.1 : 0.35, shine: 24, rim: 0.7, ol: 0.035, alpha: flick ? 0.45 : 1 }, dark = { color: fur[1], spec: 0.5, shine: 30, ol: 0.03, alpha: flick ? 0.45 : 1 }, cream = { color: [1, 0.95, 0.88], spec: 0.25, ol: 0.025, alpha: flick ? 0.45 : 1 }, pink = { color: [1, 0.6, 0.68], spec: 0.2 };
      const part = (mesh, local, rot, sc, mat, parent) => D(mesh, M.mul(parent || Bm, M.trs(local, rot || [0, 0, 0], sc)), mat);
      // legs: thigh swings from the hip, foot lifts off the ground
      for (const [sx, ph] of [[-0.2, 0], [0.2, Math.PI]]) {
        let a = Math.sin(run + ph) * 0.95, lift = Math.max(0, Math.sin(run + ph + Math.PI / 2)) * 0.14;
        if (B.air) { a = -1.0 + ph * 0.2; lift = 0.1; } if (B.sliding) { a = 1.4; lift = 0; }
        if (B.ride) {
          // feet planted wide on the deck; the back foot kicks the street now and then
          a = sx < 0 ? -0.32 : 0.32; lift = 0;
          if (B.sliding) a = sx < 0 ? -0.75 : 0.75;
          if (sx > 0 && B.push > 0 && !B.air) { a = 0.32 + B.push * 0.8; lift = -0.14 * B.push; }
          if (B.air) { a = sx < 0 ? -0.22 : 0.22; lift = 0.02; }
        }
        // on the board the legs stand along the deck (front foot, back foot), under a body turned side-on
        const hip = B.ride
          ? M.mul(M.trs([Bm[12], Bm[13], Bm[14]], [0, (st.rig.yaw || 0) * 0.4, (st.rig.bank || 0) * 0.9], [st.giantK || 1, (st.giantK || 1) * B.sy, st.giantK || 1]), M.trs([sx > 0 && B.push > 0 ? 0.16 * B.push : 0, 0.42, sx < 0 ? -0.2 : 0.2], [-a, 0, 0]))
          : M.mul(Bm, M.trs([sx, 0.42, 0], [-a, 0, 0]));
        D(A.sphere, M.mul(hip, M.trs([0, -0.16, 0], [0, 0, 0], [0.21, 0.34, 0.24])), dark);
        D(A.sphere, M.mul(hip, M.trs([0, -0.34 + lift, B.ride ? 0 : -0.07], [0.2, B.ride ? 1.35 : 0, 0], [0.2, 0.12, 0.32])), dark);
      }
      // round torso and cream tummy
      part(A.sphere, [0, 0.66, 0], null, [0.7, 0.78, 0.64], grey);
      part(A.sphere, [0, 0.6, -0.17], null, [0.5, 0.56, 0.36], cream);
      // arms pump opposite to the legs
      for (const [sx, ph] of [[-1, Math.PI], [1, 0]]) {
        let b = Math.sin(run + ph) * 1.0, spread = 0.25;
        if (B.air) { b = -2.4; spread = 0.9; } if (B.sliding) { b = -2.9; spread = 0.2; }
        if (B.ride) { b = -0.35 + Math.sin(st.time * 2.2 + ph) * 0.18; spread = 1.15 + Math.sin(st.time * 1.8 + ph) * 0.1; if (B.air) { b = -1.2; spread = 1.4; } if (B.sliding) { b = -0.6; spread = 0.9; } }
        if (st.phase === 'menu') { b = sx > 0 ? -2.6 + Math.sin(st.time * 6) * 0.4 : 0.2; spread = 0.5; }
        const sh = M.mul(Bm, M.trs([sx * 0.33, 0.86, -0.04], [-b, 0, sx * spread]));
        D(A.sphere, M.mul(sh, M.trs([0, -0.16, 0], [0, 0, 0], [0.14, 0.32, 0.14])), dark);
        D(A.sphere, M.mul(sh, M.trs([0, -0.32, 0], [0, 0, 0], [0.13, 0.13, 0.13])), dark);
      }
      // little adventurer's backpack (bounces a beat behind the body)
      const pb = B.air ? -0.04 : Math.sin(run * 2 - 0.8) * 0.025;
      const packM = { color: C('#ff9f1c'), spec: 0.4, shine: 30, ol: 0.03, alpha: flick ? 0.45 : 1 }, packD = { color: C('#c2602a'), spec: 0.3, ol: 0.02, alpha: flick ? 0.45 : 1 };
      part(A.sphere, [0, 0.74 + pb, 0.3], [0.12, 0, 0], [0.56, 0.6, 0.34], packM);
      part(A.sphere, [0, 0.6 + pb, 0.45], [0.1, 0, 0], [0.34, 0.24, 0.14], packD);
      part(A.box, [0, 0.98 + pb, 0.4], [0.2, 0, 0], [0.4, 0.06, 0.12], packD);
      for (const sx of [-0.2, 0.2]) part(A.box, [sx, 0.9, 0.05], [0.3, 0, 0], [0.07, 0.42, 0.62], packD);
      // scarf with fluttering ends
      const scarf = PB.meta && PB.meta.look('dash', 'scarf'), sc1 = scarf === 'scarf_blue' ? '#3fa9ff' : scarf === 'scarf_rainbow' ? ['#ff3d6e', '#ffd23f', '#3fa9ff'][Math.floor(st.time * 3) % 3] : '#ff3b3b', sc2 = scarf === 'scarf_blue' ? '#1f6fc0' : scarf === 'scarf_rainbow' ? '#7dff6a' : '#e8463a';
      part(A.torus, [0, 0.98, -0.03], [0.12, 0, 0], [1.08, 0.95, 1.02], { color: C(sc1), spec: 0.5, ol: 0.025 });
      for (const [sx, ph] of [[0.12, 0], [-0.02, 1.4]]) { const fl = Math.sin(st.time * 16 + ph) * 0.35 + (st.phase === 'play' ? 0.9 : 0.2); part(A.box, [sx, 0.92, 0.3 + fl * 0.08], [0.6 + fl * 0.5, 0.25 * Math.sign(sx - 0.05), 0.15], [0.13, 0.34, 0.04], { color: C(sc2), spec: 0.3 }); }
      // the head: counter-bobs, tilts into turns and looks back at the camera
      st.look = st.look || 0;
      const lookT = st.phase === 'menu' ? Math.PI : (st.lookT > 0 ? 2.3 : 0);
      st.look += (lookT - st.look) * 0.12;
      const hp = B.air ? 0.15 : B.sliding ? 0.9 : 0.08 * Math.sin(run * 2 + 1);
      const Hm = M.mul(Bm, M.trs([0, 1.36, -0.06], [B.ride ? 0.05 : hp, st.look - (B.ride ? 0.68 : 0), -R.bank * 0.5 + (B.ride ? 0 : Math.sin(run) * 0.04)]));
      const at = (x, y, z, rot, sc, mat) => D(A.sphere, M.mul(Hm, M.trs([x, y, z], rot || [0, 0, 0], sc)), mat);
      at(0, 0, 0, null, [0.92, 0.8, 0.82], grey);
      const flop = Math.sin(run * 2 - 1.3) * 0.16 + R.bank * 0.6 + (B.air ? -0.3 : 0);
      for (const sx of [-1, 1]) {
        at(sx * 0.34, 0.36, 0.02, [0, 0, sx * -0.45 + flop * sx * 0.6], [0.3, 0.4, 0.14], grey);
        at(sx * 0.34, 0.35, -0.04, [0, 0, sx * -0.45 + flop * sx * 0.6], [0.18, 0.26, 0.06], pink);
        at(sx * 0.32, -0.12, -0.18, null, [0.34, 0.28, 0.3], cream);
      }
      at(0, 0.06, -0.24, null, [0.86, 0.32, 0.42], dark);
      at(0, 0.24, -0.33, null, [0.22, 0.1, 0.1], cream);
      const blink = (st.time % 3.6) < 0.12 ? 0.15 : 1;
      for (const sx of [-1, 1]) {
        at(sx * 0.17, 0.06, -0.39, null, [0.21, 0.27 * blink, 0.08], { color: [1, 1, 1], spec: 0.8, shine: 60 });
        at(sx * 0.15, 0.04, -0.43, null, [0.13, 0.16 * blink, 0.05], { color: [0.1, 0.07, 0.05], spec: 1.2, shine: 80 });
        if (blink === 1) at(sx * 0.13, 0.1, -0.46, null, [0.045, 0.05, 0.02], { color: [1, 1, 1], unlit: true });
      }
      at(0, -0.14, -0.33, null, [0.38, 0.26, 0.3], cream);
      at(0, -0.08, -0.48, null, [0.13, 0.09, 0.09], { color: [0.08, 0.06, 0.06], spec: 1.4, shine: 90 });
      at(0, -0.24, -0.45, null, [0.13, p.inv > 0 ? 0.08 : 0.04, 0.04], { color: [0.35, 0.12, 0.12] });
      // Swag Shop hats
      const hat = PB.meta && PB.meta.look('dash', 'hat'), HP = (mesh, l, r, sc, mat) => { const m = M.mul(Hm, M.trs(l, r || [0, 0, 0], sc)); D(mesh, m, mat); };
      if (hat === 'hat_cap') { HP(A.sphere, [0, 0.3, 0.02], null, [0.62, 0.36, 0.6], { color: C('#2e6fb7'), spec: 0.4, ol: 0.02 }); HP(A.box, [0, 0.3, -0.36], [-0.15, 0, 0], [0.5, 0.04, 0.34], { color: C('#2e6fb7'), spec: 0.3 }); HP(A.sphere, [0, 0.64, 0.02], null, [0.07, 0.05, 0.07], { color: [1, 1, 1] }); }
      else if (hat === 'hat_party') { HP(A.cone, [0.06, 0.66, 0.04], [0, 0, -0.18], [0.42, 0.6, 0.42], { color: C('#ff4f8b'), spec: 0.5, ol: 0.02 }); for (let k=0;k<3;k++) HP(A.torus, [0.06 - 0.03 * k, 0.48 + k * 0.16, 0.04], [Math.PI / 2, 0, -0.18], [0.9 - k * 0.27, 0.9 - k * 0.27, 0.6], { color: C('#ffd23f'), spec: 0.5 }); HP(A.sphere, [0.17, 0.98, 0.04], null, [0.11, 0.11, 0.11], { color: C('#7dff6a'), spec: 0.5 }); }
      else if (hat === 'hat_crown') { const gold = { color: C('#ffd23f'), emissive: [0.25, 0.18, 0.02], spec: 1.6, shine: 90, ol: 0.015 }; HP(A.cyl, [0, 0.46, 0.02], null, [0.5, 0.16, 0.5], gold); for (let k=0;k<5;k++) { const a = k / 5 * Math.PI * 2; HP(A.cone, [Math.cos(a) * 0.21, 0.6, 0.02 + Math.sin(a) * 0.21], null, [0.1, 0.16, 0.1], gold); HP(A.sphere, [Math.cos(a) * 0.21, 0.69, 0.02 + Math.sin(a) * 0.21], null, [0.035, 0.035, 0.035], { color: C(['#ff3d6e', '#3fa9ff', '#7dff6a'][k % 3]), spec: 1.4 }); } }
      // dizzy stars after a bump
      if (R.spin > 0 || p.inv > 0.6) { const hc = M.xform(Hm, [0, 0.5, 0]); for (let k=0;k<4;k++) { const a = st.time * 7 + k * Math.PI / 2; SP([hc[0] + Math.cos(a) * 0.45, hc[1] + Math.sin(a * 2) * 0.05, hc[2] + Math.sin(a) * 0.45], 0.28, [1, 0.9, 0.3], 1, true); } }
      // the tail: one smooth, bendy, furry tube
      if (R.tail) { buildTail(R.tail.q); D(A.tail, M.trs([0, 0, 0]), { tex: A.tTail, color: fur[2], spec: 0.2, shine: 14, alpha: flick ? 0.45 : 1 }); }
      // dust puffs and snacks being gobbled up
      for (const d of R.dust) SP(d.p, d.size * 0.8, [0.9, 0.84, 0.74], (d.life / d.max) * 0.3, false);
      const mouth = M.xform(Hm, [0, -0.1, -0.4]);
      for (const f of R.fly) { const k = f.t / 0.22, e = k * k; const pos = [f.p[0] + (mouth[0] - f.p[0]) * e, f.p[1] + (mouth[1] - f.p[1]) * e, f.p[2] + (mouth[2] - f.p[2]) * e]; SP(pos, 0.7 * (1 - k) + 0.1, E.hex(FOODCOL[f.type] || '#ffd23f'), 1, false); SP(pos, 0.5 * (1 - k), [1, 1, 0.8], 0.8, true); }
      const base = [p.x, p.h, 0], sy = B.sy;
      if (fx.spring > 0) for (const sx of [-0.2, 0.2]) for (let k=0;k<3;k++) D(A.torus, M.trs([base[0] + sx, base[1] - 0.05 + k * 0.08, 0], [0, 0, 0], [0.5, 0.5, 0.5]), { color: [0.8, 0.82, 0.85], spec: 1, shine: 80 });
      if (fx.zoom > 0) { for (const sx of [-0.2, 0.2]) SP([base[0] + sx, base[1] + 0.05, 0.3], 0.7 + Math.random() * 0.3, [1, 0.6, 0.15], 0.9, true); }
      if (fx.shield > 0) {
        const gk = st.giantK || 1, ollie = p.air ? Math.max(-0.35, Math.min(0.35, p.vy * 0.035)) : B.sliding ? 0 : Math.sin(st.time * 3.1) * 0.01;
        const bm = M.trs([base[0], base[1] + (BOARD_Y - 0.02) * gk, 0.02], [ollie, R.yaw * 0.4, R.bank * 0.9], [1.4 * gk, 1.4 * gk, 1.4 * gk]);
        D(A.deck, bm, { tex: A.tBoard, color: [1, 1, 1], spec: 0.6, shine: 50, ol: 0.012 });
        D(A.grip, bm, { tex: A.tGrip, color: [1, 1, 1], spec: 0.1, uvScale: [1, 1] });
        for (const tz of [-0.32, 0.32]) {
          D(A.truck, M.mul(bm, M.trs([0, 0, tz])), { color: [0.78, 0.8, 0.85], spec: 1.4, shine: 90 });
          for (const wx of [-0.19, 0.19]) D(A.wheel, M.mul(bm, M.trs([wx, -0.075, tz], [-(R.roll || 0), 0, 0], [0.14, 0.14, 0.14])), { color: C('#ffe066'), spec: 0.7, shine: 50, ol: 0.008 });
        }
      }
      if (st.boardFly) { const bf = st.boardFly; bf.t += 1 / 60; const k = bf.t; if (k > 1.2) st.boardFly = null; else { const fm = M.trs([bf.x + k * 3, bf.h + 0.3 + k * 6 - k * k * 9, k * 4], [k * 9, k * 4, 0], [1.25, 1.25, 1.25]); D(A.deck, fm, { tex: A.tBoard, color: [1, 1, 1], spec: 0.6 }); D(A.grip, fm, { tex: A.tGrip, color: [1, 1, 1] }); for (const tz of [-0.32, 0.32]) D(A.truck, M.mul(fm, M.trs([0, 0, tz])), { color: [0.78, 0.8, 0.85], spec: 1.2 }); } }
      if (fx.balloon > 0) {
        const top = [base[0], base[1] + 2.9, 0.15];
        [['#ff5fa2', -0.45, 0.1], ['#ffd23f', 0.42, 0.05], ['#5ee0ff', 0, -0.2], ['#7dff6a', -0.1, 0.35]].forEach(([c, dx, dz], i) => {
          const bx = top[0] + dx + Math.sin(st.time * 2 + i) * 0.08, by = top[1] + (i === 2 ? 0.45 : 0) + Math.sin(st.time * 2.4 + i * 2) * 0.06, bz = top[2] + dz;
          D(A.sphere, M.trs([bx, by, bz], [0, 0, 0], [0.75, 0.9, 0.75]), { color: C(c), spec: 1.2, shine: 70, rim: 0.4 });
          D(A.box, M.trs([(bx + base[0]) / 2, (by - 0.45 + base[1] + 1.0) / 2, (bz) / 2], [0, 0, Math.atan2(bx - base[0], by - base[1] - 1.4)], [0.015, by - 0.45 - base[1] - 1.0, 0.015]), { color: [0.95, 0.95, 0.95], noShadow: true });
        });
      }
      if (fx.magnet > 0) SP([base[0], base[1] + 2.0, 0], 0.9, E.hex(POWERS.magnet.color), 0.9, true);
    }

    // ---------- 2D HUD (power-up icons, pops, messages) ----------
    const shade = PB.shade;
    function heart(g, cx, cy, r){
      g.beginPath(); g.moveTo(cx, cy + r*0.9);
      g.bezierCurveTo(cx - r*1.4, cy - r*0.1, cx - r*0.7, cy - r*1.2, cx, cy - r*0.45);
      g.bezierCurveTo(cx + r*0.7, cy - r*1.2, cx + r*1.4, cy - r*0.1, cx, cy + r*0.9); g.closePath();
    }
    function powIcon(g, type, cx, cy, r){
      g.save(); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
      if (type === 'magnet') {
        g.lineWidth = r*0.4; g.beginPath(); g.arc(cx, cy + r*0.05, r*0.5, Math.PI, 0, true); g.stroke();
        g.strokeStyle = '#2b2140'; g.lineCap = 'butt'; g.beginPath(); g.moveTo(cx - r*0.5, cy + r*0.02); g.lineTo(cx - r*0.5, cy - r*0.5); g.moveTo(cx + r*0.5, cy + r*0.02); g.lineTo(cx + r*0.5, cy - r*0.5); g.stroke();
      } else if (type === 'shield') {
        g.beginPath(); g.roundRect(cx - r*0.75, cy - r*0.2, r*1.5, r*0.3, r*0.15); g.fill();
        g.beginPath(); g.arc(cx - r*0.45, cy + r*0.3, r*0.16, 0, 7); g.arc(cx + r*0.45, cy + r*0.3, r*0.16, 0, 7); g.fill();
      } else if (type === 'gift') {
        g.fillRect(cx - r*0.5, cy - r*0.2, r, r*0.75); g.fillRect(cx - r*0.6, cy - r*0.42, r*1.2, r*0.26);
        g.strokeStyle = '#2b2140'; g.lineWidth = r*0.12; g.beginPath(); g.moveTo(cx, cy - r*0.42); g.lineTo(cx, cy + r*0.55); g.stroke();
      } else if (type === 'gold') {
        g.beginPath(); g.ellipse(cx, cy + r*0.2, r*0.32, r*0.26, 0, 0, 7); g.fill();
        for (const [dx, dy] of [[-0.38, -0.2], [-0.13, -0.42], [0.13, -0.42], [0.38, -0.2]]) { g.beginPath(); g.arc(cx + dx*r, cy + dy*r, r*0.13, 0, 7); g.fill(); }
      } else if (type === 'giant') {
        g.beginPath(); g.moveTo(cx, cy - r*0.7); g.lineTo(cx + r*0.55, cy - r*0.05); g.lineTo(cx + r*0.2, cy - r*0.05); g.lineTo(cx + r*0.2, cy + r*0.65); g.lineTo(cx - r*0.2, cy + r*0.65); g.lineTo(cx - r*0.2, cy - r*0.05); g.lineTo(cx - r*0.55, cy - r*0.05); g.closePath(); g.fill();
      } else if (type === 'balloon') {
        g.beginPath(); g.ellipse(cx, cy - r*0.2, r*0.42, r*0.5, 0, 0, 7); g.fill();
        g.lineWidth = r*0.08; g.beginPath(); g.moveTo(cx, cy + r*0.3); g.quadraticCurveTo(cx + r*0.2, cy + r*0.55, cx, cy + r*0.8); g.stroke();
      } else if (type === 'double') {
        g.font = `${Math.round(r*1.05)}px ${TOON}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2\u00d7', cx, cy + r*0.06);
      } else if (type === 'zoom') {
        g.beginPath(); g.moveTo(cx + r*0.15, cy - r*0.8); g.lineTo(cx - r*0.5, cy + r*0.1); g.lineTo(cx - r*0.02, cy + r*0.1); g.lineTo(cx - r*0.2, cy + r*0.8); g.lineTo(cx + r*0.5, cy - r*0.15); g.lineTo(cx + r*0.02, cy - r*0.15); g.closePath(); g.fill();
      } else if (type === 'spring') {
        g.lineWidth = r*0.2; g.beginPath(); g.moveTo(cx - r*0.5, cy + r*0.6);
        for (let i=0;i<5;i++) g.lineTo(cx + (i%2 ? -0.5 : 0.5)*r, cy + r*0.6 - (i+1)*r*0.28);
        g.stroke();
      } else if (type === 'slow') {
        g.lineWidth = r*0.16; g.beginPath(); g.arc(cx, cy, r*0.62, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - r*0.4); g.moveTo(cx, cy); g.lineTo(cx + r*0.3, cy + r*0.12); g.stroke();
      } else if (type === 'life') {
        heart(g, cx, cy + r*0.05, r*0.62); g.fill();
      }
      g.restore();
    }
    function bubble(g, type, cx, cy, r, s){
      const c = POWERS[type].color;
      g.save(); g.shadowColor = c; g.shadowBlur = 12 * s;
      const grd = g.createRadialGradient(cx - r*0.3, cy - r*0.35, r*0.1, cx, cy, r);
      grd.addColorStop(0, shade(c, 0.55)); grd.addColorStop(0.6, c); grd.addColorStop(1, shade(c, -0.3));
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.restore();
      g.lineWidth = Math.max(1, 2*s); g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      powIcon(g, type, cx, cy, r);
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(cx - r*0.45, cy - r*0.5, r*0.2, r*0.1, -0.6, 0, 7); g.fill();
    }

    // distance meter: how far the raccoon has run, the next milestone and the best run so far
    function drawMeter(){
      const d = Math.floor(st.dist), best = st.bestDist || 0, cx = W / 2, cy = 84, rec = best > 50 && st.dist > best;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `26px ${TOON}`;
      const label = fmt(d) + ' m', tw = Math.max(118, ctx.measureText(label).width + 66);
      ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(cx - tw / 2, cy - 21, tw, 42, 21); ctx.fill(); ctx.stroke();
      // little running-shoe icon
      const ix = cx - tw / 2 + 24, iy = cy + 1;
      ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.moveTo(ix - 12, iy + 6); ctx.lineTo(ix - 11, iy - 4); ctx.quadraticCurveTo(ix - 6, iy - 9, ix - 2, iy - 4); ctx.quadraticCurveTo(ix + 6, iy - 1, ix + 12, iy + 2); ctx.lineTo(ix + 12, iy + 6); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(ix - 12, iy + 4, 24, 3);
      ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 1.5; for (const sx of [-6, -1, 4]) { ctx.beginPath(); ctx.moveTo(ix + sx, iy - 3); ctx.lineTo(ix + sx + 3, iy - 1); ctx.stroke(); }
      ctx.fillStyle = '#2b2140'; ctx.fillText(label, cx + 12, cy + 2);
      // progress to the next 250 m milestone
      const k = (st.dist % 250) / 250, bw = tw - 30;
      ctx.fillStyle = 'rgba(43,33,64,.25)'; ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy + 26, bw, 6, 3); ctx.fill();
      ctx.fillStyle = '#5ee0ff'; ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy + 26, Math.max(6, bw * k), 6, 3); ctx.fill();
      if (best > 0) {
        ctx.font = `14px ${TOON}`; ctx.lineWidth = 4; ctx.strokeStyle = '#2b2140'; ctx.lineJoin = 'round';
        const t = rec ? 'NEW RECORD!' : `BEST ${fmt(best)} m`; ctx.strokeText(t, cx, cy + 46); ctx.fillStyle = rec ? '#7dff6a' : '#fff'; ctx.fillText(t, cx, cy + 46);
      }
      ctx.restore();
    }
    // ---- the Results card: big bouncy title, an orange card, coins pouring into the distance ----
    const TY = { card: 268, total: 470 };
    function outlined(text, x, y, size, fill, line, lw){ ctx.font = `${size}px ${TOON}`; ctx.lineJoin = 'round'; ctx.lineWidth = lw || size * 0.2; ctx.strokeStyle = line || '#2b1a12'; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); }
    function coinIcon(x, y, r, spin){ const sx = spin == null ? 1 : Math.max(0.15, Math.abs(Math.cos(spin))); ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1); const cg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); cg.addColorStop(0, '#fff6b0'); cg.addColorStop(0.55, '#ffc21a'); cg.addColorStop(1, '#c98a00'); ctx.fillStyle = cg; ctx.strokeStyle = '#6a4200'; ctx.lineWidth = Math.max(2, r * 0.18); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(160,100,0,.6)'; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.beginPath(); ctx.roundRect(-r * 0.18, -r * 0.5, r * 0.36, r, r * 0.18); ctx.stroke(); ctx.restore(); }
    function star(x, y, r, c){ ctx.fillStyle = c; ctx.beginPath(); for (let i=0;i<10;i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
    function drawTally(){
      const T = st.tally; if (!T) return;
      const cx = W / 2, total = T.base + T.bonus, ease = k => { k = Math.max(0, Math.min(1, k)); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // dim the street and add a soft spotlight
      const vg = ctx.createRadialGradient(cx, H * 0.45, 60, cx, H * 0.45, H * 0.75); vg.addColorStop(0, 'rgba(30,16,60,.25)'); vg.addColorStop(1, 'rgba(20,8,40,.72)'); ctx.globalAlpha = Math.min(1, T.t * 3); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      // sun rays behind the card
      ctx.save(); ctx.translate(cx, TY.card + 150); ctx.rotate(st.time * 0.25); ctx.globalAlpha = Math.min(0.22, T.t * 0.3); ctx.fillStyle = '#fff2b0';
      for (let i=0;i<14;i++) { ctx.rotate(Math.PI * 2 / 14); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -520); ctx.lineTo(40, -520); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      // title
      { const k = ease(T.t / 0.55), y = 170; ctx.save(); ctx.translate(cx, y); ctx.scale(k, k); ctx.rotate(Math.sin(st.time * 2) * 0.02);
        ctx.font = `60px ${TOON}`; const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, '#fff27a'); g.addColorStop(0.5, '#ffb21a'); g.addColorStop(1, '#ff5a2a');
        ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = '#3a1608'; ctx.strokeText(T.label, 0, 0); ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff'; ctx.strokeText(T.label, 0, 0); ctx.fillStyle = g; ctx.fillText(T.label, 0, 0); ctx.restore(); }
      // the card
      const ck = ease((T.t - 0.25) / 0.5); if (ck <= 0) { ctx.restore(); return; }
      const pw = 360, ph = 330, x0 = cx - pw / 2, y0 = TY.card;
      ctx.save(); ctx.translate(cx, y0 + ph / 2); ctx.scale(ck, ck); ctx.translate(-cx, -(y0 + ph / 2));
      ctx.fillStyle = 'rgba(40,10,0,.45)'; ctx.beginPath(); ctx.roundRect(x0 + 4, y0 + 10, pw, ph, 26); ctx.fill();
      const cg = ctx.createLinearGradient(0, y0, 0, y0 + ph); cg.addColorStop(0, '#ffcf3a'); cg.addColorStop(0.5, '#ffa21a'); cg.addColorStop(1, '#f07a12');
      ctx.fillStyle = cg; ctx.strokeStyle = '#7a3a06'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(x0, y0, pw, ph, 26); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x0 + 8, y0 + 8, pw - 16, ph - 16, 20); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; for (const [sx, sy] of [[22, 30], [pw - 26, 36], [30, ph - 30], [pw - 30, ph - 34]]) { ctx.beginPath(); ctx.arc(x0 + sx, y0 + sy, 4, 0, 7); ctx.fill(); }
      outlined('Results', cx, y0 + 40, 40, '#fff8e0', '#7a2a06', 9);
      // rows
      const row = (y, label, val) => { ctx.fillStyle = 'rgba(120,40,0,.22)'; ctx.beginPath(); ctx.roundRect(x0 + 22, y - 22, pw - 44, 44, 14); ctx.fill(); ctx.textAlign = 'left'; outlined(label, x0 + 38, y + 1, 20, '#fff', '#7a2a06', 5); ctx.textAlign = 'right'; outlined(val, x0 + pw - 36, y + 1, 26, '#fff8e0', '#7a2a06', 6); ctx.textAlign = 'center'; };
      row(y0 + 100, 'Distance run', fmt(T.base) + ' m');
      { const y = y0 + 154; ctx.fillStyle = 'rgba(120,40,0,.22)'; ctx.beginPath(); ctx.roundRect(x0 + 22, y - 22, pw - 44, 44, 14); ctx.fill();
        coinIcon(x0 + 54, y, 15, st.time * 3); ctx.textAlign = 'left'; outlined('× ' + fmt(T.left), x0 + 78, y + 1, 26, '#fff8e0', '#7a2a06', 6);
        ctx.textAlign = 'right'; outlined(`+${COIN_M} m each`, x0 + pw - 36, y + 1, 18, '#fff', '#7a2a06', 5); ctx.textAlign = 'center'; }
      // the big total
      { const b = 1 + T.bump * 0.12 + (T.done ? Math.sin(T.t * 7) * 0.04 : 0); ctx.save(); ctx.translate(cx, y0 + 232); ctx.scale(b, b);
        ctx.font = `64px ${TOON}`; const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#fff2a0'); g.addColorStop(1, '#ffd23f');
        ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = '#5a1e04'; const tx = fmt(total) + ' m'; ctx.strokeText(tx, 0, 0); ctx.fillStyle = g; ctx.fillText(tx, 0, 0); ctx.restore(); }
      { const y = y0 + 292; if (T.done && T.record) { const p = 1 + Math.sin(T.t * 9) * 0.07; ctx.save(); ctx.translate(cx, y); ctx.scale(p, p); ctx.fillStyle = '#ff3d8b'; ctx.beginPath(); ctx.roundRect(-110, -19, 220, 38, 19); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); outlined('NEW BEST!', 0, 1, 26, '#fff', '#7a0a3a', 6); ctx.restore(); }
        else if (T.best > 0) outlined(`Best ${fmt(Math.max(T.best, T.done ? total : 0))} m`, cx, y, 20, '#fff', '#7a2a06', 5); }
      ctx.restore();
      TY.total = y0 + 232;
      // "Coin bonus!" strip slides across before the coins pour in
      if (T.t > 1.0 && T.t < T_COUNT + 0.5 && T.coins > 0) { const k = Math.min(1, (T.t - 1.0) / 0.25), out = Math.max(0, (T.t - T_COUNT - 0.2) / 0.3), a = k * (1 - out);
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(30,14,50,.86)'; const sy = y0 + 154; ctx.fillRect(0, sy - 36, W, 72); ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, sy - 36, W, 3); ctx.fillRect(0, sy + 33, W, 3);
        ctx.translate((1 - k) * -W, 0); outlined('Coin bonus!', cx, sy - 10, 30, '#ffd23f', '#3a1608', 7); ctx.font = `20px ${TOON}`; ctx.fillStyle = '#fff'; ctx.fillText(`${fmt(T.coins)} coins → +${fmt(T.coins * COIN_M)} m`, cx, sy + 18); ctx.restore(); }
      // coins flying from the coin row into the total
      for (const f of T.fly) { const k = f.k, e = k * k * (3 - 2 * k), sx = x0 + 54, sy = y0 + 154, ex = cx + f.sx, ey = y0 + 222; const x = sx + (ex - sx) * e, y = sy + (ey - sy) * e - Math.sin(k * Math.PI) * 70; coinIcon(x, y, 13 - k * 4, k * 12); }
      for (const q of T.pops) { ctx.globalAlpha = 1 - q.t / 0.7; outlined(`+${COIN_M}`, q.x + 80, y0 + 200 - q.t * 60, 22, '#7dff6a', '#123a10', 5); ctx.globalAlpha = 1; }
      for (const c of T.conf) { ctx.globalAlpha = Math.min(1, c.life * 2); if (c.star) star(c.x, c.y, c.s, c.c); else { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.s / 2, -c.s * 0.3, c.s, c.s * 0.6); ctx.restore(); } ctx.globalAlpha = 1; }
      if (T.done && T.t - T.done > 0.6 && !T.sent) { ctx.globalAlpha = 0.6 + Math.sin(st.time * 5) * 0.3; outlined('Tap to continue', cx, H - 120, 20, '#fff', '#2b1a12', 5); ctx.globalAlpha = 1; }
      ctx.restore();
    }
    // the name of each part of town pops up as you arrive, and stays small in the corner
    function drawZone(){
      const zb = st.zoneBanner;
      if (zb && st.phase === 'play') { const Z = ZONES[zb.i], t = zb.t, inK = Math.min(1, t / 0.35), outK = t > 2.4 ? Math.min(1, (t - 2.4) / 0.5) : 0, k = inK < 1 ? 1 + 1.7 * Math.pow(inK - 1, 3) + 2.7 * Math.pow(inK - 1, 3) * 0 + (1 - inK) * -0.0 : 1;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 1 - outK; ctx.translate(W / 2, 252); const sc = Math.max(0.01, inK < 1 ? inK * (1.25 - 0.25 * inK) : 1 + Math.sin(t * 4) * 0.02); ctx.scale(sc, sc);
        outlined(`Zone ${zb.i + 1}`, 0, -36, 22, '#fff', '#2b1a12', 6);
        ctx.font = `56px ${TOON}`; const g = ctx.createLinearGradient(0, -28, 0, 28); g.addColorStop(0, '#fff27a'); g.addColorStop(0.5, '#ffb21a'); g.addColorStop(1, '#ff5a2a');
        ctx.lineJoin = 'round'; ctx.lineWidth = 13; ctx.strokeStyle = '#3a1608'; ctx.strokeText(Z.name, 0, 8); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(Z.name, 0, 8); ctx.fillStyle = g; ctx.fillText(Z.name, 0, 8);
        outlined(Z.sub, 0, 46, 18, '#fff', '#2b1a12', 5);
        ctx.restore(); void k; }
      if (st.phase === 'play' || st.phase === 'ready') { const Z = ZONES[zoneIdx(st.dist)]; ctx.save(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.92; outlined(`Zone ${zoneIdx(st.dist) + 1}`, W - 16, H - 46, 15, '#fff', '#1e1a1c', 4); outlined(Z.name, W - 16, H - 26, 18, '#fff', '#1e1a1c', 5); ctx.restore(); }
    }
    function drawHUD(){
      if (st.phase === 'play' || st.phase === 'ready') {
        // gold coins (they go to your Swag Shop wallet) and the score multiplier
        const cx = W - 34, cy = 32;
        ctx.save();
        const cg = ctx.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, 17); cg.addColorStop(0, '#fff3a0'); cg.addColorStop(0.6, '#ffc21a'); cg.addColorStop(1, '#c98a00');
        ctx.fillStyle = cg; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill(); ctx.stroke();
        ctx.font = `26px ${TOON}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
        const t = String(st.coins || 0); ctx.strokeText(t, cx - 24, cy + 2); ctx.fillStyle = '#ffd23f'; ctx.fillText(t, cx - 24, cy + 2);
        ctx.restore();
      }
      if (st.phase === 'play' || st.phase === 'ready') { drawMeter(); drawZone(); }
      if (st.phase === 'tally' || (st.phase === 'over' && st.tally)) drawTally();
      let tx = 30;
      for (const k of ['magnet','shield','double','zoom','spring','slow','balloon','gold','giant']) {
        if (st.fx[k] <= 0) continue;
        bubble(ctx, k, tx, 32, 19, 0.8);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tx, 32, 24, -Math.PI/2, -Math.PI/2 + Math.PI*2 * st.fx[k]/POWERS[k].time); ctx.stroke();
        tx += 56;
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) {
        const sp = E.project(q.wp);
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 1.8);
        ctx.font = `30px ${TOON}`; ctx.lineWidth = 6; ctx.strokeStyle = '#1e1a1c'; ctx.lineJoin = 'round';
        const y = sp[1] - 90 - q.rise;
        ctx.strokeText(q.text, sp[0], y); ctx.fillStyle = q.color; ctx.fillText(q.text, sp[0], y); ctx.restore();
      }
      // corner coming up: show which way to swipe
      const cs = curSeg();
      if (st.phase === 'play' && cs.arms && st.dist > cs.J - 42 && st.dist < cs.J + 1) {
        const q = st.player.turnQ, pulse = 1 + Math.sin(st.time * 10) * 0.06, y = 150;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const arrow = (dir, cx) => {
          const on = q === dir, sx = dir === 'left' ? -1 : 1;
          ctx.save(); ctx.translate(cx, y); ctx.scale(sx * pulse, pulse);
          ctx.beginPath(); ctx.moveTo(-34, -12); ctx.lineTo(6, -12); ctx.lineTo(6, -30); ctx.lineTo(38, 0); ctx.lineTo(6, 30); ctx.lineTo(6, 12); ctx.lineTo(-34, 12); ctx.closePath();
          ctx.fillStyle = on ? '#7dff6a' : '#ffd23f'; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill(); ctx.restore();
        };
        if (cs.jtype !== 'R') arrow('left', cs.jtype === 'T' ? W / 2 - 70 : W / 2);
        if (cs.jtype !== 'L') arrow('right', cs.jtype === 'T' ? W / 2 + 70 : W / 2);
        if (!q) { ctx.font = `22px ${TOON}`; ctx.lineWidth = 5; ctx.strokeStyle = '#2b2140'; const tx = cs.jtype === 'T' ? 'Swipe to turn!' : cs.jtype === 'L' ? 'Swipe left!' : 'Swipe right!'; ctx.strokeText(tx, W / 2, y + 52); ctx.fillStyle = '#fff'; ctx.fillText(tx, W / 2, y + 52); }
        ctx.restore();
      }
      if (st.msg && st.phase === 'ready') {
        ctx.font = `24px ${TOON}`;
        const tw = Math.min(ctx.measureText(st.msg).width + 44, W - 30), y = H * 0.42;
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(W/2 - tw/2, y - 28, tw, 56, 28); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2b2140'; ctx.fillText(st.msg, W/2, y + 2, W - 60);
      }
    }
    function draw(){
      if (!loadAssets()) { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '700 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('This game needs a device with 3D graphics.', W/2, H/2); return; }
      // Render at twice the base resolution for crisp, smooth edges. If a device can't keep up,
      // quietly step the resolution down so the running stays smooth (and back up when it can).
      E.resize(W, H, E.quality(1.5));
      render(W, H);
      E.present(ctx, W, H);
      if (!sunC) { sunC = layer(W, H); const g = sunC[1]; const sg = g.createRadialGradient(W * 0.85, -20, 10, W * 0.85, -20, H * 0.75); sg.addColorStop(0, 'rgba(255,236,170,.3)'); sg.addColorStop(0.4, 'rgba(255,220,150,.12)'); sg.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, H); const vg = g.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.55, H * 0.8); vg.addColorStop(0, 'rgba(40,20,60,0)'); vg.addColorStop(1, 'rgba(40,20,60,.08)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
      ctx.drawImage(sunC[0], 0, 0, W, H);
      drawHUD();
    }
    function artDash(g){
      if (!loadAssets()) { g.fillStyle = '#4f7fae'; g.fillRect(0, 0, 240, 180); return; }
      const keep = st; fresh('classic', Math.random, 3, 'menu'); st.dist = 30; fillScenery(); for (let i=0;i<20;i++) rigUpdate(0.03);
      E.resize(240, 180, 2); render(240, 180);
      g.drawImage(E.canvas, 0, 0, 240, 180);
      st = keep;
    }

    let down = null, sunC = null;
    function swipe(dx, dy){ if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right'); else act(dy < 0 ? 'up' : 'down'); }
    return {
      id:'dash', sfxScore:false, music:'dash', title:'ZOOM DASH', W, H, statLabel:'Coins', maxLives: MAX_LIVES, type:'endless', scoreKey:'zd-distance',
      noDaily: true, scoreUnit: ' m', scoreLabel: 'Distance', overTitle: 'Run over',
      tile:{ order:2, name:'Zoom Dash', kind:'Run, turn, ride the buses', art: artDash },
      controls: ['Swipe left or right to switch lanes. At a corner, swipe the way the arrow points to turn!', 'Swipe up to jump over gnomes, trash cans and holes in the road.', 'Swipe down in the air to drop back down fast.', 'Run up a wooden ramp to race along the roofs of the school buses. Don\u2019t run into the front of one!', 'Tripping on something lets the bulldog catch up. Trip again while he\u2019s close and he gets you!', 'Only distance counts! Every coin you grab adds 1 m to your distance at the end of the run.', 'Turn corners without crashing for bonus coins.', 'Run from the farm, through the suburbs and Old Town, all the way to the Big City!', 'Beat your best distance for today, this week and all time.'],
      powers: Object.entries(POWERS).map(([k,p]) => ({ name:p.name, desc:p.desc, icon: (g) => bubble(g, k, 23, 14, 12.5, 0.6) })),
      init(){ loadAssets(); },
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg){ fresh(mode, rand, lives, 'ready'); st.msg = msg ? msg + ' Swipe to run' : 'Swipe or tap to run!'; },
      frame(dt){
        if (st.phase === 'play') update(dt);
        else if (st.phase === 'menu') scrollMenu(dt);
        else if (st.phase === 'tally') updateTally(dt);
        effects(dt); if (E) rigUpdate(dt); draw();
      },
      hud(){ return { lives: st.lives, stat: st.coins || 0, score: st.tally ? st.tally.base + st.tally.bonus : Math.floor(st.dist) }; },
      debug(){ return { st, curSeg, zones: ZONES, startTally, skipTally }; },
      metrics(){ return { score: st.score, food: st.food, dist: Math.floor(st.dist), turns: st.turns || 0, coins: st.coins || 0 }; },
      pointerDown(x, y){ down = { x, y, used:false }; },
      pointerMove(x, y){ if (!down || down.used) return; const dx = x - down.x, dy = y - down.y; if (Math.hypot(dx, dy) > 34) { down.used = true; swipe(dx, dy); } },
      pointerUp(x, y){
        if (!down) return;
        if (!down.used) { const dx = x - down.x, dy = y - down.y; if (Math.hypot(dx, dy) > 34) swipe(dx, dy); else act(x < W/3 ? 'left' : x > W*2/3 ? 'right' : 'up'); }
        down = null;
      },
      key(e){ const map = { ArrowLeft:'left', a:'left', ArrowRight:'right', d:'right', ArrowUp:'up', w:'up', ' ':'up', ArrowDown:'down', s:'down' }; if (map[e.key]) { e.preventDefault(); act(map[e.key]); } },
    };
  }
  PB.register(createDash);
})();
