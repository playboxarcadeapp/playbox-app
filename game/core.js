// Shared helpers every game uses: saved data, dates, random seeds, the game canvas.
(function(){
  const $ = id => document.getElementById(id);
  const N = { cyan:'#22e4ff', pink:'#ff3ddc', lime:'#7dff6a', yellow:'#ffd23f', orange:'#ff8a3d', violet:'#8b6bff', red:'#ff4766', blue:'#3d8bff' };
  const INK = '#2b2140';
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const store = {
    get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
    set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };
  const pad = n => String(n).padStart(2,'0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  const today = () => dayKey(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); return dayKey(d); };

  function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function seedFrom(str){ let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function shuffle(arr, R){ for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  const cv = $('cv'); const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // draw a canvas softly blurred (like a camera's depth of field). Uses the canvas blur filter where the
  // browser has one, otherwise shrinks and re-enlarges the picture, which blurs it nearly the same way.
  function soften(g, src, x, y, w, h, px){
    if (typeof g.filter === 'string') { g.save(); g.filter = `blur(${px}px)`; g.drawImage(src, x, y, w, h); g.restore(); return; }
    const k = Math.max(2, px / 1.2), t = document.createElement('canvas'); t.width = Math.max(1, Math.round(w / k)); t.height = Math.max(1, Math.round(h / k));
    const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, t.width, t.height);
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(t, x, y, w, h); g.restore();
  }
  function layer(W, H){ const c = document.createElement('canvas'); c.width = W*dpr; c.height = H*dpr; const g = c.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); return [c,g]; }

  // Tile-art helpers for the hub
  function neonBg(x){
    const bg = x.createLinearGradient(0,0,0,180); bg.addColorStop(0,'#141c4a'); bg.addColorStop(1,'#080c22');
    x.fillStyle = bg; x.fillRect(0,0,240,180);
    x.strokeStyle = 'rgba(61,139,255,.16)'; x.lineWidth = 1;
    for (let i=0;i<=240;i+=20){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,180); x.stroke(); }
    for (let i=0;i<=180;i+=20){ x.beginPath(); x.moveTo(0,i); x.lineTo(240,i); x.stroke(); }
    x.shadowBlur = 10;
  }
  function rr(g,x,y,w,h,r,fill){ g.fillStyle=fill; g.shadowColor=fill; g.beginPath(); g.roundRect(x,y,w,h,r); g.fill(); }
  function dot(g,x,y,r,fill){ g.fillStyle=fill; g.shadowColor=fill; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
  function shade(hex, amt){
    const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  const factories = [];
  window.PB = { $, N, INK, fmt, reduceMotion, store, today, yesterday, mulberry, seedFrom, shuffle, cv, ctx, dpr, layer, soften, neonBg, rr, dot, shade,
    factories, register(f){ factories.push(f); } };
})();
