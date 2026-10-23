(function(){
  const { fmt, reduceMotion, ctx, layer, dpr } = PB;
  // ===============================================================
  //  ZOOM DASH (3D city streets, rendered with PB.gl3d)
  // ===============================================================
  function createDash(shell){
    const W = 480, H = 860, LANE = 2.2, MAX_LIVES = 5, VIEW = 135;
    const TOON = '"Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    const POWERS = {
      magnet: { name:'Snack magnet',  color:'#16c2b4', time:10, weight:18, desc:'Pulls in snacks from every lane' },
      shield: { name:'Skateboard',    color:'#3fa9ff', time:25, weight:16, desc:'Ride a skateboard! It saves you from one crash' },
      balloon:{ name:'Balloon bunch', color:'#ff5fa2', time:6,  weight:12, desc:'Float up high and grab the coins in the sky' },
      double: { name:'Double points', color:'#ffb800', time:12, weight:16, desc:'Every snack is worth 2\u00d7' },
      zoom:   { name:'Zoom boots',    color:'#ff7a2f', time:5,  weight:11, desc:'Super speed! Smash through anything' },
      spring: { name:'Spring shoes',  color:'#4cc96a', time:10, weight:14, desc:'Mega high jumps' },
      slow:   { name:'Slow-mo',       color:'#9a6bff', time:8,  weight:12, desc:'Everything slows down' },
      life:   { name:'Extra life',    color:'#ff3d6e', time:0,  weight:8,  desc:'Adds one heart (up to 5)' },
    };
    const FOODS = ['donut','cookie','chips','donut','cookie','chips','burger'];
    const DEPTH = { cone:0.8, can:0.9, bar:0.5, truck:4.6 };
    const BUS_H = 2.5, RAMP = 4.2, BUS_LEN = 11.5;
    
    let st = null, E = null, A = null; // A = assets (meshes, textures)

    // ---------- suburban "kids movie" look ----------
    const HOUSE_COLS = ['#f3d9a4','#a9d8e8','#f6b8a8','#c8e3b0','#f2efe6','#d9c7ef','#ffe08a','#b7d3f2'];
    const ROOF_COLS = ['#a8473a','#4a5f86','#6b4a3a','#3f6b5a','#8a3d5a','#5a5a66'];
    const DOOR_COLS = ['#c0392b','#2e6fb7','#2f8f5b','#f2b134','#7d3c98','#1f3a5f'];
    const VANS = ['#ff8a65','#4fc3f7','#ffd54f','#81c784','#ba68c8','#f06292'];
    function canvas(w, h, fn){ const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
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
      });
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
        for (let k=0;k<14;k++) { const bx = 20 + k * 46 + (k % 3) * 6; if (bx > dx - 30 && bx < dx + dw + 20) continue; if (sty.garage && bx > 5.5 * m && bx < 9.3 * m) continue; g.fillStyle = k % 2 ? '#3f9a38' : '#4fb043'; g.beginPath(); g.arc(bx, h - 24, 22, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(bx - 6, h - 34, 6, 0, 7); g.fill(); }
      });
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
      });
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
    let HOUSES = [];
    function loadAssets(){
      if (A) return A;
      E = PB.gl3d.get(); if (!E) return null;
      const G = E.G, M = E.M, T = (c, o) => E.texture(c, o), Tr = (g, t, r, s) => G.transform(g, M.trs(t, r || [0,0,0], s || [1,1,1]));
      const R = PB.mulberry(21);
      HOUSES = [];
      for (let i=0;i<10;i++) { const sty = { col: HOUSE_COLS[i % HOUSE_COLS.length], shut: ['#2e5e8c','#3f7a4a','#8c2f39','#3a3a48','#5a7fa8'][i % 5], door: DOOR_COLS[i % DOOR_COLS.length], stories: i % 3 === 2 ? 1 : 2, garage: i % 2 === 0, roof: ROOF_COLS[(i * 3) % ROOF_COLS.length] }; HOUSES.push(sty); }
      A = {
        road: E.mesh(G.plane(6.8, VIEW + 20, 1, (VIEW + 20) / 27.2)), roadU: E.mesh(G.plane(6.8, 1, 1, 1)), walkU: E.mesh(G.plane(1.7, 1, 1, 1)), lawnU: E.mesh(G.plane(40, 1, 1, 1)), curbU: E.mesh(G.box(0.25, 0.18, 1)),
        arrow: E.mesh(G.extrude([[-0.7, 0.16], [0.15, 0.16], [0.15, 0.42], [0.7, 0], [0.15, -0.42], [0.15, -0.16], [-0.7, -0.16]], 0.05)),
        walk: E.mesh(G.plane(1.7, VIEW + 20, 1, (VIEW + 20) / 1.7)),
        lawn: E.mesh(G.plane(40, VIEW + 20, 40 / 4, (VIEW + 20) / 4)),
        curb: E.mesh(G.box(0.25, 0.18, VIEW + 20)),
        tAsph: T(asphaltTex()), tStripe: T(canvas(64, 16, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff5a2a'; for (let x=-16;x<w;x+=16) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 8, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, h); g.fill(); } })), tManhole: T(manholeTex(), { repeat: false }), tCross: T(crossTex(), { repeat: false }), tBlossom: T(blossomTex()), tWalk: T(walkTex()), tGrass: T(grassTex()), tHedge: T(hedgeTex()), tLeaf: T(leafTex()), tBark: T(barkTex()), tFur: T(furTex()),
        tHills: T(hillsTex(), { repeat: true, clampV: true }), tSky: T(skyTex(), { repeat: false }), tCloud: T(cloudTex(), { repeat: false }),
        fronts: HOUSES.map(s => T(houseFront(s), { repeat: false })), sides: HOUSES.map(s => T(sidingTex(s.col))), roofs: ROOF_COLS.map(c => T(roofTex(c))),
        shirts: [['#ff6b6b','#ffffff'], ['#4fc3f7','#ffffff'], ['#ffd54f','#ff8a65'], ['#81c784','#2e7d32']].map(([a, b]) => T(shirtTex(a, b))),
        quad: E.mesh(G.quad(1, 1)),
        tail: E.mesh(tailGeo()), tTail: T(tailTex()),
        box: E.mesh(G.box(1, 1, 1)),
        hedge: E.mesh(G.merge([Tr(G.box(1, 0.8, 1), [0, 0.4, 0]), Tr(G.cylinder(0.5, 0.5, 1, 16), [0, 0.8, 0], [Math.PI / 2, 0, 0], [1, 1, 1])])),
        roof: E.mesh(G.extrude([[-1, 0], [1, 0], [0, 1]], 1)),
        cyl: E.mesh(G.cylinder(0.5, 0.5, 1, 18)),
        cone: E.mesh(G.cylinder(0.02, 0.5, 1, 20, true)),
        sphere: E.mesh(G.sphere(0.5, 24, 16)),
        bump: E.mesh(G.displace(G.sphere(0.5, 22, 16), (x, y, z) => PB.gl3d.fbm(x * 2.2, y * 2.2, z * 2.2, 3) * 0.12)),
        torus: E.mesh(G.torus(0.22, 0.1, 28, 12)),
        wheel: E.mesh(G.transform(G.cylinder(0.42, 0.42, 0.3, 18), M.trs([0,0,0], [0, 0, Math.PI / 2]))),
        shirt: E.mesh(G.extrude([[-0.3, 0], [0.3, 0], [0.3, -0.18], [0.18, -0.18], [0.18, -0.62], [-0.18, -0.62], [-0.18, -0.18], [-0.3, -0.18]], 0.03)),
        heart: E.mesh(G.extrude(heartShape(), 0.12)),
        bolt: E.mesh(G.extrude([[0.05, 0.35], [-0.2, 0], [-0.01, 0], [-0.08, -0.35], [0.2, 0.05], [0.01, 0.05]], 0.1)),
        star: E.mesh(G.extrude(starShape(0.32, 0.14), 0.1)),
        coin: E.mesh(G.cylinder(0.5, 0.5, 0.12, 24)), coinStar: E.mesh(G.extrude(starShape(0.32, 0.14), 0.1)),
      };
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
        mode, phase, rand, lives, score:0, food:0, dist:0, t:0, time:0, speed:12,
        player:{ lane:1, x:0, h:0, vy:0, slide:0, queueSlide:false, inv:0, run:0, turnQ:null },
        objs:[], powIn:6, fx:{ magnet:0, shield:0, double:0, zoom:0, spring:0, slow:0, balloon:0 }, mult: 1,
        pops:[], parts:[], shake:0, msg:null,
        segs:[], segN:0, cur:0, prev:-1, camTh:0, turns:0,
        dog:{ d: phase === 'menu' ? 99 : 3.2, chase: phase === 'menu' ? 0 : 3.5, bark:0 },
      };
      const s0 = newSeg(0, [0, 0], 0, null, 'open');
      s0.rowAt = 28;
      if (phase !== 'menu') planJunction(s0, 150 + Math.random() * 50);
      fillScenery();
      if (phase === 'menu') for (let i=0;i<3;i++) st.objs.push({ kind:'food', seg: 0, type: FOODS[i % 3], lane:1, x: 0, at: 12 + i * 2.6, h:0.3 });
    }
    function newSeg(start, origin, th, parent, kind, near){
      const s = { id: st.segN++, start, origin, th, parent, kind, near: near || 0, J: Infinity, jtype: null, arms: null, theme: parent == null ? 'houses' : (Math.random() < 0.4 ? 'park' : 'houses'),
        sceneAt: { '-1': parent == null ? start - 10 : (near === -1 ? start + 27 : start), '1': parent == null ? start - 10 : (near === 1 ? start + 27 : start) },
        decoAt: parent == null ? start - 10 : start + 9, rowAt: start + 26, crossDone: false };
      st.segs[s.id] = s; return s;
    }
    function planJunction(s, len){
      s.J = s.start + len;
      const r = Math.random();
      s.jtype = r < 0.4 ? 'T' : r < 0.7 ? 'L' : 'R';
    }
    function makeArms(s){
      const o = segPt(s, s.J, 0);
      const L = newSeg(s.J, o, s.th - Math.PI / 2, s.id, s.jtype === 'R' ? 'closed' : 'open', -1);
      const Rr = newSeg(s.J, o, s.th + Math.PI / 2, s.id, s.jtype === 'L' ? 'closed' : 'open', 1);
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
          const len = 12 + R() * 3;
          if (s.theme === 'park') { const v = R(); st.objs.push({ kind:'park', seg: s.id, side, at: s.sceneAt[side], len: 14, v: v < 0.22 ? 'pond' : v < 0.42 ? 'play' : v < 0.58 ? 'fountain' : 'trees', r: R() * 1000 }); s.sceneAt[side] += 14; continue; }
          st.objs.push({ kind:'bld', seg: s.id, side, at: s.sceneAt[side], len, h: Math.floor(R() * HOUSES.length), front: R() < 0.6 ? 'hedge' : 'fence', tree: R() < 0.55, treeS: 0.9 + R() * 0.4, setback: 15 + R() * 2, rot: R() * 6 });
          s.sceneAt[side] += len;
        }
      }
      const dlim = s.kind === 'closed' ? s.start + 60 : s.J - 10;
      while (s.decoAt < upto && s.decoAt < dlim) {
        for (const side of [-1, 1]) {
          const r = R();
          if (r < 0.28) st.objs.push({ kind:'tree', seg: s.id, side, at: s.decoAt + R() * 2, s: 0.7 + R() * 0.3, rot: R() * 6, tint: 0.85 + R() * 0.3, bloom: R() < 0.18 });
          else if (r < 0.7) st.objs.push({ kind:'hydrant', seg: s.id, side, at: s.decoAt + 1 });
          else if (r < 0.85) st.objs.push({ kind:'lamp', seg: s.id, side, at: s.decoAt + 3 });
        }
        if (s.kind === 'open' && R() < 0.35) st.objs.push({ kind:'decal', type:'manhole', seg: s.id, x: (Math.floor(R() * 3) - 1) * LANE + (R() - .5) * 0.8, at: s.decoAt + R() * 9 });
        s.decoAt += 9;
      }
    }
    function fillScenery(){
      const s = curSeg(), horizon = st.dist + VIEW + 10;
      if (st.phase === 'play' && s.J === Infinity) planJunction(s, 140 + Math.random() * 90);
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
      if (!early && r < 0.2 && at + 34 < sg.J - 32) {
        const lanes = [0, 1, 2].sort(() => R() - .5), n = R() < 0.55 ? 1 : 2, buses = lanes.slice(0, n);
        let longest = 0;
        buses.forEach((l, i) => {
          const count = R() < 0.4 ? 2 : 1, ramp = i === 0 ? R() < 0.8 : R() < 0.35;
          for (let k=0;k<count;k++) st.objs.push({ kind:'obs', seg: st.cur, type:'bus', lane: l, at: at + k * (BUS_LEN + 0.6), len: BUS_LEN, ramp: ramp && k === 0, color: k % 2 ? '#ffc21a' : '#ffcc33' });
          const total = count * (BUS_LEN + 0.6);
          longest = Math.max(longest, total);
          if (ramp) trail(R() < 0.5 ? 'coin' : 'food', l, at - 3, Math.floor(total / 1.6) + 2, 1.6, (i2, a2) => a2 < at ? 0.45 + BUS_H * Math.max(0, 1 + (a2 - at) / RAMP) : BUS_H + 0.45);
        });
        const free = lanes.slice(n);
        if (free.length) trail('coin', free[0], at - 2, 8, 2, null);
        return longest + 6;
      }
      // a construction trench across the street: jump it!
      if (!early && r < 0.32 && at + 10 < sg.J - 32) {
        st.objs.push({ kind:'obs', seg: st.cur, type:'gap', lane: -1, at, len: 2.6 });
        const arcL = Math.floor(R() * 3);
        trail('coin', arcL, at - 2.4, 6, 1.05, (i) => 0.45 + 1.4 * Math.sin(Math.PI * i / 5));
        return 4;
      }
      const lanes = [0,1,2].sort(() => R() - .5);
      const pick = () => { const q = R(); return q < .28 ? 'cone' : q < .52 ? 'can' : q < .76 ? 'bar' : 'truck'; };
      const pat = R(), used = [];
      if (pat < 0.38) used.push(lanes[0]); else if (pat < 0.8) used.push(lanes[0], lanes[1]);
      const row = used.map(l => ({ kind:'obs', seg: st.cur, type: pick(), lane:l, at, color: VANS[Math.floor(R()*VANS.length)] }));
      st.objs.push(...row);
      const free = [0,1,2].filter(l => !used.includes(l));
      const ft = FOODS[Math.floor(R()*FOODS.length)];
      if (free.length && R() < (st.t < 30 ? 0.5 : 0.6)) { const fl = free[Math.floor(R()*free.length)]; const coins = R() < 0.45; trail(coins ? 'coin' : 'food', fl, at - 6, coins ? 9 : (st.t < 30 ? 4 : 5), coins ? 1.5 : 2.2, null, coins ? null : { type: ft }); }
      const low = row.find(o => o.type === 'cone' || o.type === 'can');
      if (low && R() < 0.3) trail(R() < 0.5 ? 'coin' : 'food', low.lane, at - 2.4, 5, 1.2, (i) => 0.45 + 1.5 * Math.sin(Math.PI * i / 4), { type: ft });
      if (st.powIn <= 0 && free.length) { const pl = free[free.length-1]; st.objs.push({ kind:'pow', seg: st.cur, type: pickPower(), lane: pl, x: laneX(pl), at: at + 9, h: 0.9 }); st.powIn = 8 + R()*6; }
      return 0;
    }

    function act(dir){
      if (st.phase === 'ready') { st.phase = 'play'; st.msg = null; }
      if (st.phase !== 'play') return;
      const p = st.player, s = curSeg();
      if ((dir === 'left' || dir === 'right') && s.arms && st.dist > s.J - 18) { p.turnQ = dir; p.lane = 1; if (PB.sfx) PB.sfx('pick'); return; }
      if (dir === 'left' && p.lane > 0) { p.prevLane = p.lane; p.lane--; }
      else if (dir === 'right' && p.lane < 2) { p.prevLane = p.lane; p.lane++; }
      else if (dir === 'up') { if (!p.air) { if (PB.sfx) { PB.sfx('jump'); PB.sfx(st.fx.spring > 0 ? 'yay' : 'hup'); } p.slide = 0; p.vy = st.fx.spring > 0 ? 13.4 : 9.85; } }
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
      if (st.fx.zoom > 0 || st.fx.shield > 0) { crash(o); return; }
      o.fly = { vy: 6, y: 0, rot: 0, vr: (Math.random() < .5 ? -1 : 1) * 5, vx: (Math.random() - .5) * 4 };
      if (st.dog.chase > 0 && st.dog.d < 6) { st.dog.d = 0.6; st.dog.chase = 0; st.dog.caught = 0.8; crash(o, 'Caught!'); return; }
      st.dog.chase = 7; st.dog.d = Math.min(st.dog.d, 3.6); st.dog.bark = 0.01; p.inv = 0.5; st.shake = 6; st.lookT = 0.9;
      if (PB.sfx) { PB.sfx('oof'); PB.sfx('bark'); }
      pop(playerPos(), 'Whoa!', '#ffb800');
      if (st.rig) st.rig.trip = 0.45;
    }
    function crash(o, label){
      o.hit = true; if (PB.sfx) { PB.sfx('oof'); PB.sfx('crash'); }
      const p = st.player;
      if (p.inv > 0) return;
      if (st.fx.zoom > 0) { o.fly = { vy: 9, y: 0, rot: 0, vr: (Math.random() < .5 ? -1 : 1) * 6, vx: (Math.random() - .5) * 6 }; st.score += 25; pop(playerPos(), 'SMASH!', '#ff7a2f'); st.shake = 6; return; }
      if (st.fx.shield > 0) { st.fx.shield = 0; if (!o.type || o.type !== 'bus') o.fly = { vy: 7, y: 0, rot: 0, vr: 5, vx: 3 }; p.inv = 1; st.boardFly = { t: 0, x: p.x, h: p.h }; pop(playerPos(), 'Board saved you!', '#3fa9ff'); if (PB.sfx) PB.sfx('crash'); return; }
      st.lives--; p.inv = 1.6; st.shake = 14; st.lookT = 1.0; if ((st.mult || 1) > 1) { st.mult = 1; } st.turnCrashed = true; st.dog.chase = Math.max(st.dog.chase, 4); st.dog.d = Math.min(st.dog.d, 4);
      pop(playerPos(), label || 'Ouch!', '#ff3d6e');
      if (st.lives <= 0) { st.phase = 'over'; if (PB.wallet && st.coins) PB.wallet.add(st.coins); shell.gameOver(st.score, `You ran ${fmt(st.dist)} m, grabbed ${st.food} snacks and ${st.coins || 0} gold coins`); }
    }
    function collect(o){ if (PB.sfx) PB.sfx(o.kind === 'pow' ? 'power' : 'coin');
      o.gone = true;
      if (o.kind === 'food') {
        st.food++; st.score += 10 * mult(); if (PB.sfx && st.food % 3 === 0) PB.sfx('nom');
        sparkle([st.player.x, st.player.h + 1.2, -0.3], [1, 0.85, 0.3], 5);
        if (st.rig) st.rig.fly.push({ type: o.type, p: [o.x, o.h, wz(o.at)], t: 0 });
        if (st.food % 25 === 0) pop(playerPos(), st.food + ' snacks!', '#ffb800');
      } else {
        const Pw = POWERS[o.type];
        if (o.type === 'life') st.lives = Math.min(MAX_LIVES, st.lives + 1); else st.fx[o.type] = Pw.time;
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
      st.speed = Math.min(26, 12 + st.t * 0.17);
      const sp = st.speed * (fx.zoom > 0 ? 1.8 : 1) * (fx.slow > 0 ? 0.6 : 1);
      const dz = sp * dt;
      st.dist += dz;
      st.score += dz * 1.7 * mult();
      const sg = curSeg();
      while (st.dist + 75 > sg.rowAt && sg.rowAt < sg.J - 32) { const extra = spawnRow(sg.rowAt); sg.rowAt += Math.max(12, 19 - st.t * 0.08) + extra; }
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
      st.lookT = (st.lookT || 0) - dt; if (st.food && st.food % 25 === 0 && st.lastLook !== st.food) { st.lastLook = st.food; st.lookT = 0.9; }
      for (const o of st.objs) {
        if (o.gone) continue;
        const rel = o.at - st.dist;
        if (o.seg !== st.cur) continue;
        if (o.kind === 'obs' && o.type === 'bus') {
          const inLane = Math.abs(laneX(o.lane) - p.x) < 1.15;
          if (!o.hit && inLane && rel < 0.35 && rel > -o.len && p.h < BUS_H - 0.4) {
            if (rel > -0.7) { crash(o, 'Bonk! A bus!'); if (st.phase !== 'play') return; bounceLane(o); }
            else { stumble({}); if (st.phase !== 'play') return; bounceLane(o); }
          }
          continue;
        }
        if (o.kind === 'obs' && o.type === 'gap') {
          if (!o.hit && rel < 0 && rel > -o.len + 0.3 && p.h < 0.12) { crash(o, 'Into the hole!'); p.vy = 11; if (st.phase !== 'play') return; }
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
            const blocked = o.type === 'cone' ? p.h < 0.8 : o.type === 'can' ? p.h < 1.05 : o.type === 'bar' ? p.slide <= 0 : true;
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
        if (o.type !== 'bus' || o.seg !== st.cur || Math.abs(laneX(o.lane) - x) > 1.0) continue;
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
      o.gone = true; st.coins = (st.coins || 0) + 1; st.score += 5 * mult();
      if (PB.sfx) PB.sfx('gem', Math.min(1, ((st.coinStreak = (st.time - (st.lastCoinT || 0) < 0.35 ? (st.coinStreak || 0) + 1 : 0)) % 8) / 8)); st.lastCoinT = st.time;
      sparkle([st.player.x, st.player.h + 1.1, -0.3], [1, 0.85, 0.2], 3);
    }
    const mult = () => (st.fx.double > 0 ? 2 : 1) * (st.mult || 1);
    function doTurn(arm){
      const p = st.player;
      st.prev = st.cur; st.cur = arm.id; st.turns++;
      arm.rowAt = arm.start + 34;
      p.turnQ = null; p.lane = 1; p.x = 0;
      if (!st.turnCrashed) { st.mult = Math.min(5, (st.mult || 1) + 1); pop(playerPos(), st.mult > 1 ? 'Nice turn! \u00d7' + st.mult : 'Nice turn!', '#7dff6a', 1.0); if (st.mult > 1 && PB.sfx) PB.sfx('level'); }
      st.turnCrashed = false; st.score += 50 * mult();
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
      E.begin({ pos: [camX, 4.3 + Rg.camY + cbob + shake[1], 7.6], target: [Rg.camX * 0.64, 0.75 + Rg.camY, -12], up: [Math.sin(-Rg.bank * 0.06), 1, 0], fov: fovBase * Rg.fov, near: 0.2, far: 400 }, {
        sunDir: [-0.62 * Math.cos(st.camTh) + 0.42 * Math.sin(st.camTh), -0.5, 0.62 * Math.sin(st.camTh) + 0.42 * Math.cos(st.camTh)], sunColor: [3.7, 2.85, 1.95], ambSky: [0.36, 0.45, 0.72], ambGround: [0.36, 0.34, 0.22], toon: 0.8,
        fogColor: [0.86, 0.88, 0.92], fogDensity: 0.007, fogStart: 40,
        shadow: { center: [0, 2, -16], radius: 30 },
        sky: { zenith: [0.12, 0.4, 0.95], horizon: [0.78, 0.88, 0.98], ground: [0.55, 0.55, 0.38], sunColor: [1.4, 1.0, 0.55], sunSize: 3 },
      });
      // painted sky and far hills stay with the camera
      FR = null;
      D(A.quad, M.trs([0, 62, -262], [0, 0, 0], [760, 150, 1]), { tex: A.tSky, unlit: true, color: [1, 1, 1], fogless: true, noShadow: true });
      D(A.quad, M.trs([0, 22, -230], [0, 0, 0], [560, 88, 1]), { tex: A.tHills, unlit: true, color: [0.95, 0.98, 0.95], uvScale: [1.4, 1], fogless: true, blend: true, noShadow: true });
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
        const big = o.kind === 'bld' || o.kind === 'park', cx = big ? o.side * 16 : (o.x != null ? o.x : (o.side || 0) * 4), cz = big ? z - o.len / 2 : z;
        const pz = F[2] * cx + F[10] * cz + F[14], px = F[0] * cx + F[8] * cz + F[12];
        if (pz > (big ? 26 : 9) || pz < -VIEW - 30 || Math.abs(px) > 95) continue;
        if (o.kind === 'decal') { if (o.type === 'manhole') D(A.quad, M.trs([o.x, 0.015, z], [-Math.PI / 2, 0, 0], [1.1, 1.1, 1]), { tex: A.tManhole, spec: 0.5, shine: 30, blend: true, noShadow: true }); else { D(A.quad, M.trs([0, 0.012, z], [-Math.PI / 2, 0, 0], [6.4, 2.6, 1]), { tex: A.tCross, spec: 0.2, blend: true, noShadow: true }); D(A.box, M.trs([0, 0.012, z - 2.2], [0, 0, 0], [6.4, 0.01, 0.3]), { color: [0.97, 0.96, 0.92], noShadow: true }); } continue; }
        if (o.kind === 'bld') drawLot(o, z);
        else if (o.kind === 'park') drawPark(o, z);
        else if (o.kind === 'tree') drawTree(o, z);
        else if (o.kind === 'lamp') drawLamp(o, z);
        else if (o.kind === 'hydrant') drawHydrant(o, z);
        else if (o.kind === 'obs') drawObstacle(o, z);
        else if (o.kind === 'food') drawFood(o, z);
        else if (o.kind === 'pow') drawPow(o, z);
        else if (o.kind === 'coin') drawCoin(o, z);
        else if (o.kind === 'sign') drawSign(o, z);
        else if (o.kind === 'barrier') drawBarrier(o, z);
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
    const D = (mesh, model, mat) => E.draw(mesh, FR ? E.M.mul(FR, model) : model, mat);
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
        strip(A.curbU, s0, s1, sd * 3.52, 0.09, { color: [0.95, 0.93, 0.88], spec: 0.05 }, 1);
        strip(A.lawnU, s0, s1, sd * 23.6, yl, { tex: A.tGrass, spec: 0.04 }, 4, 10);
        strip(A.walkU, s0, s1, sd * 5.35, 0.16, { tex: A.tWalk, spec: 0.05 }, 1.7);
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
      const paint = { color: C(o.color || '#ffcc33'), spec: 0.7, shine: 50 }, black = { color: [0.12, 0.12, 0.14], spec: 0.3 }, glass = { color: [0.25, 0.38, 0.55], spec: 1.4, shine: 90 };
      D(A.box, M.trs([x, 1.35, zc], [0, 0, 0], [2.05, 1.9, L]), paint);
      D(A.box, M.trs([x, BUS_H - 0.08, zc], [0, 0, 0], [1.95, 0.16, L - 0.1]), { color: C('#f0f0ea'), spec: 0.3 });
      D(A.sphere, M.trs([x, BUS_H - 0.12, zc], [0, 0, 0], [2.0, 0.2, L]), paint);
      for (const sd of [-1, 1]) {
        D(A.box, M.trs([x + sd * 1.03, 1.85, zc], [0, 0, 0], [0.04, 0.55, L - 1.6]), glass);
        D(A.box, M.trs([x + sd * 1.035, 1.15, zc], [0, 0, 0], [0.04, 0.08, L - 0.2]), black);
        D(A.box, M.trs([x + sd * 1.035, 0.9, zc], [0, 0, 0], [0.04, 0.08, L - 0.2]), black);
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
    function drawSign(o, z){
      const M = E.M, wood = { color: [0.98, 0.98, 0.95], spec: 0.2 }, y = 2.4;
      for (const sx of [-1.6, 1.6]) D(A.cyl, M.trs([sx, 1.2, z], [0, 0, 0], [0.14, 2.4, 0.14]), { color: [0.3, 0.3, 0.34], spec: 0.5 });
      D(A.box, M.trs([0, y, z], [0, 0, 0], [5.2, 1.8, 0.12]), { color: C('#ffd23f'), emissive: [0.25, 0.2, 0.02], spec: 0.4, shine: 30 });
      D(A.box, M.trs([0, y, z - 0.02], [0, 0, 0], [5.45, 2.05, 0.08]), { color: [0.17, 0.13, 0.25] });
      const arrow = (dir) => { const sx = dir === 'left' ? -1 : 1; D(A.arrow, M.trs([sx * (o.dirs === 'T' ? 1.25 : 0), y, z + 0.08], [0, 0, dir === 'left' ? 0 : Math.PI], [1.15, 1.15, 1]), { color: [0.17, 0.13, 0.25], spec: 0.2 }); };
      if (o.dirs !== 'R') arrow('left'); if (o.dirs !== 'L') arrow('right');
      D(A.box, M.trs([0, 0.6, z + 1.6], [0, 0, 0], [7, 1.2, 1.1]), { tex: A.tHedge, uvScale: [3, 1], spec: 0.08 });
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
      const M = E.M, t = st.time * 18, z = 0.9 + dg.d * 0.55, x = p.x * 0.85 - 0.75 + Math.sin(st.time * 3) * 0.15, k = 0.78;
      const brown = { color: C('#a8693a'), spec: 0.3, shine: 20, rim: 0.5 }, cream = { color: C('#f3e2c6'), spec: 0.2 }, dark = { color: [0.15, 0.1, 0.08], spec: 0.6, shine: 50 };
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

    function drawLot(o, zNear){
      const M = E.M, sd = o.side, S = HOUSES[o.h], len = o.len;
      const zMid = zNear - len / 2;
      // hedge or white picket fence along the front, with a gap for the path
      const runLen = len - 2.4, runZ = zNear - runLen / 2;
      if (o.front === 'hedge') {
        D(A.hedge, M.trs([sd * 6.75, 0.12, runZ], [0, 0, 0], [1.0, 1.25, runLen]), { tex: A.tHedge, uvScale: [runLen / 2, 1], spec: 0.08 });
      } else {
        D(A.box, M.trs([sd * 6.5, 0.55, runZ], [0, 0, 0], [0.05, 0.08, runLen]), { color: [1, 1, 1], spec: 0.2 });
        D(A.box, M.trs([sd * 6.5, 0.3, runZ], [0, 0, 0], [0.05, 0.08, runLen]), { color: [1, 1, 1], spec: 0.2 });
        if (zNear > -30 && zNear < 10) for (let k = 0.15; k < runLen; k += 0.32) D(A.box, M.trs([sd * 6.52, 0.42, zNear - k], [0, 0, 0], [0.04, 0.72, 0.12]), { color: [1, 1, 1], spec: 0.2 });
        else D(A.box, M.trs([sd * 6.52, 0.42, runZ], [0, 0, 0], [0.04, 0.72, runLen]), { color: [0.95, 0.95, 0.95] });
        // flower bed behind the fence
        if (zNear > -45) for (let k = 0.5; k < runLen; k += 1.1) D(A.sphere, M.trs([sd * 7.0, 0.25, zNear - k], [0, 0, 0], [0.45, 0.35, 0.45]), { color: E.hex(['#ff6b8a','#ffd166','#c77dff','#ff9f43'][Math.floor(k) % 4]), spec: 0.3 });
      }
      // walkway to the front door
      D(A.box, M.trs([sd * 10.8, 0.15, zNear - len + 1.2], [0, 0, 0], [8.4, 0.03, 1.2]), { color: [0.93, 0.88, 0.8], spec: 0.05, noShadow: true });
      // mailbox by the path
      const mx = sd * 6.4, mz = zNear - len + 2.6;
      D(A.box, M.trs([mx, 0.55, mz], [0, 0, 0], [0.1, 1.1, 0.1]), { color: [0.95, 0.95, 0.95] });
      D(A.box, M.trs([mx, 1.18, mz], [0, 0, 0], [0.32, 0.3, 0.5]), { color: E.hex(S.door), spec: 0.5, shine: 40 });
      D(A.cyl, M.trs([mx, 1.33, mz], [Math.PI / 2, 0, 0], [0.32, 0.5, 0.15]), { color: E.hex(S.door), spec: 0.5, shine: 40 });
      // the house
      const depth = 8, hx = sd * (o.setback + depth / 2), hh = 6, wid = 10;
      const hz = zNear - len / 2;
      D(A.box, M.trs([hx, hh / 2, hz], [0, 0, 0], [depth, hh, wid]), { tex: A.sides[o.h], uvScale: [depth / 1.2, hh / 1.2], spec: 0.08 });
      D(A.quad, M.trs([sd * (o.setback - 0.02), hh / 2, hz], [0, sd < 0 ? Math.PI / 2 : -Math.PI / 2, 0], [wid, hh, 1]), { tex: A.fronts[o.h], spec: 0.15, shine: 30 });
      const ri = ROOF_COLS.indexOf(S.roof);
      D(A.roof, M.trs([hx, hh, hz], [0, 0, 0], [depth / 2 + 0.7, 3.0, wid + 0.8]), { tex: A.roofs[ri], uvScale: [3, 2], spec: 0.1 });
      D(A.box, M.trs([hx + sd * 1.8, hh + 2.6, hz - 2.8], [0, 0, 0], [0.9, 2.2, 0.9]), { color: [0.72, 0.36, 0.28], spec: 0.1 });
      D(A.box, M.trs([sd * (o.setback - 0.01), hh + 0.02, hz], [0, 0, 0], [0.3, 0.12, wid + 0.8]), { color: [0.98, 0.97, 0.94] });
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
      const M = E.M, x = o.x != null ? o.x : o.side * 4.1, s = o.s;
      D(A.cyl, M.trs([x, 1.2 * s, z], [0, 0, 0.03], [0.26 * s, 2.4 * s, 0.26 * s]), { tex: A.tBark, color: [1, 1, 1], spec: 0.05 });
      const blobs = [[0, 3.3, 0, 1.55], [-0.75, 2.85, 0.3, 1.1], [0.8, 2.95, -0.2, 1.15], [0.15, 3.95, 0.2, 1.1]];
      const tn = o.tint || 1, col = o.bloom ? [1, 1, 1] : [0.95 * tn, 1, 0.85 * (2 - tn)];
      for (const [bx, by, bz, r] of blobs) D(A.bump, M.trs([x + bx * s, by * s, z + bz * s], [0, o.rot, 0], [r * 2 * s, r * 1.85 * s, r * 2 * s]), { tex: o.bloom ? A.tBlossom : A.tLeaf, color: col, spec: 0.1, shine: 12, uvScale: [2, 2], rim: 0.35 });
    }
    function drawLamp(o, z){
      const M = E.M, x = o.side * 4.0, g = [0.22, 0.3, 0.26];
      D(A.cyl, M.trs([x, 2.0, z], [0, 0, 0], [0.12, 4.0, 0.12]), { color: g, spec: 0.5, shine: 40 });
      D(A.cyl, M.trs([x, 4.1, z], [0, 0, 0], [0.4, 0.5, 0.4]), { color: [1, 0.96, 0.82], emissive: [0.5, 0.45, 0.3], noShadow: true });
      D(A.cone, M.trs([x, 4.55, z], [0, 0, 0], [0.62, 0.4, 0.62]), { color: g, spec: 0.5 });
    }
    function drawHydrant(o, z){
      const M = E.M, x = o.side * 4.2, red = E.hex('#e8463a');
      D(A.cyl, M.trs([x, 0.5, z], [0, 0, 0], [0.36, 0.7, 0.36]), { color: red, spec: 0.6, shine: 40 });
      D(A.sphere, M.trs([x, 0.88, z], [0, 0, 0], [0.4, 0.34, 0.4]), { color: red, spec: 0.6, shine: 40 });
      D(A.cyl, M.trs([x, 0.6, z], [0, 0, Math.PI / 2], [0.16, 0.6, 0.16]), { color: E.hex('#f6c344'), spec: 0.6 });
    }
    function drawObstacle(o, z){
      if (o.type === 'bus') { drawBus(o, z); return; }
      if (o.type === 'gap') { drawGap(o, z); return; }
      const M = E.M; let x = laneX(o.lane), y = 0, rot = 0;
      if (o.fly) { y = Math.max(-2, o.fly.y); rot = o.fly.rot; x += o.fly.x || 0; }
      const at = (dx, dy, dz) => [x + dx, y + dy, z + dz], R3 = [rot, 0, rot * 0.5];
      if (o.type === 'cone') {
        // a grumpy garden gnome
        D(A.cyl, M.trs(at(0, 0.06, 0), R3, [0.6, 0.12, 0.6]), { color: [0.55, 0.42, 0.3], spec: 0.1 });
        D(A.cone, M.trs(at(0, 0.32, 0), R3, [0.62, 0.5, 0.62]), { color: E.hex('#3f7fd6'), spec: 0.3 });
        D(A.sphere, M.trs(at(0, 0.6, 0.05), R3, [0.34, 0.32, 0.32]), { color: E.hex('#ffd2b0'), spec: 0.2 });
        D(A.cone, M.trs(at(0, 0.5, 0.12), [rot + 3.14, 0, 0], [0.34, 0.3, 0.2]), { color: [0.98, 0.98, 0.98], spec: 0.2 });
        D(A.cone, M.trs(at(0, 0.92, 0), [rot - 0.2, 0, 0], [0.4, 0.55, 0.4]), { color: E.hex('#e63b2e'), spec: 0.4 });
        D(A.sphere, M.trs(at(0, 0.62, 0.21), R3, [0.1, 0.09, 0.09]), { color: E.hex('#ff8a7a'), spec: 0.3 });
      } else if (o.type === 'can') {
        // shiny cartoon trash can with a wobbly lid
        const metal = { color: [0.78, 0.82, 0.86], spec: 1.0, shine: 50 };
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
        const col = E.hex(o.color), paint = { color: col, spec: 0.9, shine: 60 }, glass = { color: [0.25, 0.4, 0.6], spec: 1.4, shine: 90 };
        D(A.box, M.trs(at(0, 0.95, -2.3), [rot * 0.3, 0, rot * 0.2], [2.2, 1.1, 4.6]), paint);
        D(A.sphere, M.trs(at(0, 1.5, -2.4), [0, 0, 0], [2.18, 1.4, 4.7]), paint);
        D(A.box, M.trs(at(0, 1.75, 0.0), [0.35, 0, 0], [1.8, 0.75, 0.05]), glass);
        for (const sx of [-1, 1]) D(A.box, M.trs(at(sx * 1.09, 1.72, -2.4), [0, 0, 0], [0.04, 0.6, 3.4]), glass);
        D(A.box, M.trs(at(0, 0.5, 0.04), [0, 0, 0], [2.3, 0.3, 0.2]), { color: [0.85, 0.85, 0.88], spec: 0.8 });
        for (const sx of [-1, 1]) {
          D(A.sphere, M.trs(at(sx * 0.95, 1.05, 0.05), [0, 0, 0], [0.3, 0.3, 0.1]), { color: [1, 0.2, 0.15], emissive: [1.2, 0.1, 0.05], noShadow: true });
          for (const wz2 of [-0.9, -3.7]) D(A.wheel, M.trs(at(sx * 0.98, 0.42, wz2)), { color: [0.12, 0.12, 0.14], spec: 0.15 });
        }
        D(A.box, M.trs(at(0, 2.25, -2.4), [0, 0, 0], [1.6, 0.06, 2.6]), { color: [0.3, 0.3, 0.32], spec: 0.5 });
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
      else if (o.type === 'shield') { D(A.box, M.trs(pos, [0.4, spin, 0.3], [0.5, 0.08, 1.2]), { color: c, emissive: c.map(v => v * 0.4), spec: 0.9 }); for (const wz of [-0.4, 0.4]) D(A.wheel, M.trs([pos[0], pos[1] - 0.12, pos[2] + wz * Math.cos(spin)], [0, spin, 0], [0.3, 0.2, 0.2]), { color: C('#7dff6a') }); }
      else if (o.type === 'magnet') D(A.torus, M.trs(pos, [0, spin, Math.PI / 2], 1.4), { color: c, emissive: c.map(v => v * 0.5), spec: 0.9 });
      else if (o.type === 'spring') for (let k=0;k<3;k++) D(A.torus, M.trs([pos[0], pos[1] - 0.2 + k * 0.2, pos[2]], [0, spin, 0], 1.1), { color: c, emissive: c.map(v => v * 0.5), spec: 0.9 });
      else D(A.sphere, M.trs(pos, [0, spin, 0], 0.55), { color: c, emissive: c.map(v => v * 0.6), spec: 0.9 });
      D(A.sphere, M.trs(pos, [0, 0, 0], 1.25), { color: [0.85, 0.95, 1], alpha: 0.18, spec: 1, shine: 80, noShadow: true });
    }
    // ================= character rig: run cycle, squash & stretch, follow-through =================
    const FOODCOL = { donut: '#ff7eb6', cookie: '#d9a25e', chips: '#ff5a3c', burger: '#e8a25a' };
    const TAIL_K = 7, TAIL_S = 22, TAIL_R = 14;
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
    function bodyFrame(){
      const p = st.player, R = st.rig, run = p.run * 2.2, sliding = p.slide > 0, air = !!p.air;
      let sy = 1, bob = 0, pitch = -0.18, roll = R.bank, yaw = R.yaw + R.spin * Math.PI * 4;
      if (sliding) { pitch = -1.05; sy = 0.95; bob = -0.12; }
      else if (air) { sy = 1 + Math.max(-0.14, Math.min(0.2, p.vy * 0.022)); pitch = -0.1 - Math.max(0, -p.vy) * 0.015; }
      else { bob = Math.abs(Math.sin(run)) * 0.13; sy = 1 + 0.07 * (Math.abs(Math.sin(run)) - 0.55); roll += Math.sin(run) * 0.05; }
      if (R.land > 0) { const k = R.land / 0.24; sy *= 1 - 0.28 * Math.sin(k * Math.PI); }
      if (st.phase === 'menu') { pitch = -0.05; }
      const sx = 1 / Math.sqrt(Math.max(0.5, sy));
      return { m: E.M.trs([p.x, p.h + bob, 0], [pitch, yaw, roll], [sx, sy, sx]), run, sliding, air, sy };
    }
    function rigUpdate(dt){
      const p = st.player;
      if (!st.rig) st.rig = { bank: 0, yaw: 0, land: 0, spin: 0, prevX: p.x, prevH: p.h, step: 0, tail: null, dust: [], fly: [], camX: 0, camY: 0, fov: 1, lastInv: 0 };
      const R = st.rig; dt = Math.min(dt, 0.05);
      { const target = curSeg().th; st.camTh += (target - st.camTh) * Math.min(1, dt * 6.5); if (Math.abs(target - st.camTh) < 1e-4) st.camTh = target; }
      const vx = (p.x - R.prevX) / Math.max(dt, 1e-3);
      R.bank += (Math.max(-0.42, Math.min(0.42, -vx * 0.045)) - R.bank) * Math.min(1, dt * 12);
      R.yaw += (Math.max(-0.35, Math.min(0.35, -vx * 0.03)) - R.yaw) * Math.min(1, dt * 10);
      if (R.prevAir && !p.air) { R.land = 0.24; if (PB.sfx && st.phase === 'play') PB.sfx('land'); for (let i=0;i<10;i++) { const a = i / 10 * Math.PI * 2; R.dust.push({ p: [p.x + Math.cos(a) * 0.3, p.h + 0.1, Math.sin(a) * 0.3], v: [Math.cos(a) * 1.6, 0.5 + Math.random() * 0.5, Math.sin(a) * 1.2], life: 0.6, max: 0.6, size: 0.35 }); } }
      R.land = Math.max(0, R.land - dt);
      if (p.inv > R.lastInv + 0.5) R.spin = 1; R.lastInv = p.inv;
      R.spin = Math.max(0, R.spin - dt * 1.6);
      // footfall dust
      const run = p.run * 2.2, step = Math.floor(run / Math.PI);
      if (step !== R.step && !p.air && p.slide <= 0 && st.phase === 'play') { if (PB.sfx) PB.sfx('step'); const sx = step % 2 ? 0.2 : -0.2; for (let i=0;i<2;i++) R.dust.push({ p: [p.x + sx, p.h + 0.06, 0.1], v: [(Math.random() - .5) * 0.8, 0.4 + Math.random() * 0.4, 1 + Math.random()], life: 0.5, max: 0.5, size: 0.22 }); }
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
      const grey = { tex: A.tFur, uvScale: [2, 2], color: [0.64, 0.6, 0.6], spec: 0.3, shine: 24, rim: 0.6, alpha: flick ? 0.45 : 1 }, dark = { color: [0.2, 0.19, 0.22], spec: 0.4, shine: 30, alpha: flick ? 0.45 : 1 }, cream = { color: [0.98, 0.94, 0.88], spec: 0.25, alpha: flick ? 0.45 : 1 }, pink = { color: [1, 0.66, 0.7], spec: 0.2 };
      const part = (mesh, local, rot, sc, mat, parent) => D(mesh, M.mul(parent || Bm, M.trs(local, rot || [0, 0, 0], sc)), mat);
      // legs: thigh swings from the hip, foot lifts off the ground
      for (const [sx, ph] of [[-0.2, 0], [0.2, Math.PI]]) {
        let a = Math.sin(run + ph) * 0.95, lift = Math.max(0, Math.sin(run + ph + Math.PI / 2)) * 0.14;
        if (B.air) { a = -1.0 + ph * 0.2; lift = 0.1; } if (B.sliding) { a = 1.4; lift = 0; }
        const hip = M.mul(Bm, M.trs([sx, 0.42, 0], [-a, 0, 0]));
        D(A.sphere, M.mul(hip, M.trs([0, -0.16, 0], [0, 0, 0], [0.21, 0.34, 0.24])), dark);
        D(A.sphere, M.mul(hip, M.trs([0, -0.34 + lift, -0.07], [0.2, 0, 0], [0.2, 0.12, 0.32])), dark);
      }
      // round torso and cream tummy
      part(A.sphere, [0, 0.66, 0], null, [0.7, 0.78, 0.64], grey);
      part(A.sphere, [0, 0.6, -0.17], null, [0.5, 0.56, 0.36], cream);
      // arms pump opposite to the legs
      for (const [sx, ph] of [[-1, Math.PI], [1, 0]]) {
        let b = Math.sin(run + ph) * 1.0, spread = 0.25;
        if (B.air) { b = -2.4; spread = 0.9; } if (B.sliding) { b = -2.9; spread = 0.2; } if (st.phase === 'menu') { b = sx > 0 ? -2.6 + Math.sin(st.time * 6) * 0.4 : 0.2; spread = 0.5; }
        const sh = M.mul(Bm, M.trs([sx * 0.33, 0.86, -0.04], [-b, 0, sx * spread]));
        D(A.sphere, M.mul(sh, M.trs([0, -0.16, 0], [0, 0, 0], [0.14, 0.32, 0.14])), dark);
        D(A.sphere, M.mul(sh, M.trs([0, -0.32, 0], [0, 0, 0], [0.13, 0.13, 0.13])), dark);
      }
      // little adventurer's backpack (bounces a beat behind the body)
      const pb = B.air ? -0.04 : Math.sin(run * 2 - 0.8) * 0.025;
      const packM = { color: C('#f0a43a'), spec: 0.35, shine: 30, alpha: flick ? 0.45 : 1 }, packD = { color: C('#c2702a'), spec: 0.3, alpha: flick ? 0.45 : 1 };
      part(A.sphere, [0, 0.74 + pb, 0.3], [0.12, 0, 0], [0.56, 0.6, 0.34], packM);
      part(A.sphere, [0, 0.6 + pb, 0.45], [0.1, 0, 0], [0.34, 0.24, 0.14], packD);
      part(A.box, [0, 0.98 + pb, 0.4], [0.2, 0, 0], [0.4, 0.06, 0.12], packD);
      for (const sx of [-0.2, 0.2]) part(A.box, [sx, 0.9, 0.05], [0.3, 0, 0], [0.07, 0.42, 0.62], packD);
      // scarf with fluttering ends
      part(A.torus, [0, 0.98, -0.03], [0.12, 0, 0], [1.08, 0.95, 1.02], { color: C('#e8463a'), spec: 0.45 });
      for (const [sx, ph] of [[0.12, 0], [-0.02, 1.4]]) { const fl = Math.sin(st.time * 16 + ph) * 0.35 + (st.phase === 'play' ? 0.9 : 0.2); part(A.box, [sx, 0.92, 0.3 + fl * 0.08], [0.6 + fl * 0.5, 0.25 * Math.sign(sx - 0.05), 0.15], [0.13, 0.34, 0.04], { color: C('#e8463a'), spec: 0.3 }); }
      // the head: counter-bobs, tilts into turns and looks back at the camera
      st.look = st.look || 0;
      const lookT = st.phase === 'menu' ? Math.PI : (st.lookT > 0 ? 2.3 : 0);
      st.look += (lookT - st.look) * 0.12;
      const hp = B.air ? 0.15 : B.sliding ? 0.9 : 0.08 * Math.sin(run * 2 + 1);
      const Hm = M.mul(Bm, M.trs([0, 1.36, -0.06], [hp, st.look, -R.bank * 0.5 + Math.sin(run) * 0.04]));
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
      // dizzy stars after a bump
      if (R.spin > 0 || p.inv > 0.6) { const hc = M.xform(Hm, [0, 0.5, 0]); for (let k=0;k<4;k++) { const a = st.time * 7 + k * Math.PI / 2; SP([hc[0] + Math.cos(a) * 0.45, hc[1] + Math.sin(a * 2) * 0.05, hc[2] + Math.sin(a) * 0.45], 0.28, [1, 0.9, 0.3], 1, true); } }
      // the tail: one smooth, bendy, furry tube
      if (R.tail) { buildTail(R.tail.q); D(A.tail, M.trs([0, 0, 0]), { tex: A.tTail, color: [1, 1, 1], spec: 0.15, shine: 14, alpha: flick ? 0.45 : 1 }); }
      // dust puffs and snacks being gobbled up
      for (const d of R.dust) SP(d.p, d.size * 0.8, [0.9, 0.84, 0.74], (d.life / d.max) * 0.3, false);
      const mouth = M.xform(Hm, [0, -0.1, -0.4]);
      for (const f of R.fly) { const k = f.t / 0.22, e = k * k; const pos = [f.p[0] + (mouth[0] - f.p[0]) * e, f.p[1] + (mouth[1] - f.p[1]) * e, f.p[2] + (mouth[2] - f.p[2]) * e]; SP(pos, 0.7 * (1 - k) + 0.1, E.hex(FOODCOL[f.type] || '#ffd23f'), 1, false); SP(pos, 0.5 * (1 - k), [1, 1, 0.8], 0.8, true); }
      const base = [p.x, p.h, 0], sy = B.sy;
      if (fx.spring > 0) for (const sx of [-0.2, 0.2]) for (let k=0;k<3;k++) D(A.torus, M.trs([base[0] + sx, base[1] - 0.05 + k * 0.08, 0], [0, 0, 0], [0.5, 0.5, 0.5]), { color: [0.8, 0.82, 0.85], spec: 1, shine: 80 });
      if (fx.zoom > 0) { for (const sx of [-0.2, 0.2]) SP([base[0] + sx, base[1] + 0.05, 0.3], 0.7 + Math.random() * 0.3, [1, 0.6, 0.15], 0.9, true); }
      if (fx.shield > 0) {
        const bm = M.mul(M.trs([base[0], base[1] + 0.06, 0.02], [0, R.yaw, R.bank * 0.6]), M.trs([0, 0, 0]));
        D(A.box, M.mul(bm, M.trs([0, 0.06, 0], [0, 0, 0], [0.5, 0.06, 1.25])), { color: C('#3fa9ff'), spec: 0.6, shine: 40 });
        D(A.box, M.mul(bm, M.trs([0, 0.095, 0], [0, 0, 0], [0.4, 0.01, 1.0])), { color: C('#ffd23f'), spec: 0.2 });
        for (const [wx, wz] of [[-0.17, -0.42], [0.17, -0.42], [-0.17, 0.42], [0.17, 0.42]]) D(A.wheel, M.mul(bm, M.trs([wx, 0.0, wz], [0, 0, 0], [0.16, 0.16, 0.16])), { color: C('#7dff6a'), spec: 0.5 });
      }
      if (st.boardFly) { const bf = st.boardFly; bf.t += 1 / 60; const k = bf.t; if (k > 1.2) st.boardFly = null; else D(A.box, M.trs([bf.x + k * 3, bf.h + 0.3 + k * 6 - k * k * 9, k * 4], [k * 9, k * 4, 0], [0.5, 0.06, 1.25]), { color: C('#3fa9ff'), spec: 0.6 }); }
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

    function drawHUD(){
      if (st.phase === 'play' || st.phase === 'ready') {
        // gold coins (they go to your Swag Shop wallet) and the score multiplier
        const cx = W - 34, cy = 32;
        ctx.save();
        const cg = ctx.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, 17); cg.addColorStop(0, '#fff3a0'); cg.addColorStop(0.6, '#ffc21a'); cg.addColorStop(1, '#c98a00');
        ctx.fillStyle = cg; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill(); ctx.stroke();
        ctx.font = `26px ${TOON}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
        const t = String(st.coins || 0); ctx.strokeText(t, cx - 24, cy + 2); ctx.fillStyle = '#ffd23f'; ctx.fillText(t, cx - 24, cy + 2);
        if ((st.mult || 1) > 1) { const m = '\u00d7' + st.mult; ctx.font = `30px ${TOON}`; ctx.strokeText(m, W - 18, cy + 46); ctx.fillStyle = '#7dff6a'; ctx.fillText(m, W - 18, cy + 46); }
        ctx.restore();
      }
      let tx = 30;
      for (const k of ['magnet','shield','double','zoom','spring','slow','balloon']) {
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
      E.resize(W, H, Math.min(dpr, 1.75));
      render(W, H);
      E.present(ctx, W, H);
      if (!sunC) { sunC = layer(W, H); const g = sunC[1]; const sg = g.createRadialGradient(W * 0.85, -20, 10, W * 0.85, -20, H * 0.75); sg.addColorStop(0, 'rgba(255,236,170,.3)'); sg.addColorStop(0.4, 'rgba(255,220,150,.12)'); sg.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, H); const vg = g.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.55, H * 0.8); vg.addColorStop(0, 'rgba(40,20,60,0)'); vg.addColorStop(1, 'rgba(40,20,60,.28)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
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
      id:'dash', sfxScore:false, music:'dash', title:'ZOOM DASH', W, H, statLabel:'Snacks', maxLives: MAX_LIVES, type:'endless', scoreKey:'zd-scores',
      tile:{ order:2, name:'Zoom Dash', kind:'Run, turn, ride the buses', art: artDash },
      controls: ['Swipe left or right to switch lanes. At a corner, swipe the way the arrow points to turn!', 'Swipe up to jump over gnomes, trash cans and holes in the road.', 'Swipe down to slide under washing lines.', 'Run up a wooden ramp to race along the roofs of the school buses. Don\u2019t run into the front of one!', 'Tripping on something lets the bulldog catch up. Trip again while he\u2019s close and he gets you!', 'Every corner you turn without crashing raises your score multiplier (up to \u00d75).', 'Gold coins go into your Swag Shop wallet.'],
      powers: Object.entries(POWERS).map(([k,p]) => ({ name:p.name, desc:p.desc, icon: (g) => bubble(g, k, 23, 14, 12.5, 0.6) })),
      init(){ loadAssets(); },
      preview(){ fresh('classic', Math.random, 3, 'menu'); },
      start(mode, rand, lives, msg){ fresh(mode, rand, lives, 'ready'); st.msg = msg ? msg + ' Swipe to run' : 'Swipe or tap to run!'; },
      frame(dt){
        if (st.phase === 'play') update(dt);
        else if (st.phase === 'menu') scrollMenu(dt);
        effects(dt); if (E) rigUpdate(dt); draw();
      },
      hud(){ return { lives: st.lives, stat: st.food, score: st.score }; },
      debug(){ return { st, curSeg }; },
      metrics(){ return { score: st.score, food: st.food, dist: Math.floor(st.dist), turns: st.turns || 0, coins: st.coins || 0 }; },
      dailyGoals: [
        { text:'Grab {n} snacks', m:'food', n:[30, 45, 60] },
        { text:'Turn {n} corners', m:'turns', n:[4, 6, 8] },
        { text:'Collect {n} gold coins', m:'coins', n:[40, 60, 80] },
        { text:'Grab {n} snacks without crashing', m:'food', n:[15, 20, 25], noHit:true },
      ],
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
