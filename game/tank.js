// MY FISH TANK: a calm aquarium kids look after and grow over a long time.
// Feed the fish, wipe the glass, tap fish to see tricks and collect pearls from the clam. Caring for the tank
// earns Tank XP (a little each day), which raises the tank level and unlocks more in the Pet Shop, where coins
// from every Playbox game buy new fish, decorations, water and bigger tanks. Nothing can die or be lost.
// Pacing: a kid who visits most days reaches the top level (25) and can afford everything in about two years.
(function(){
  const { ctx, mulberry, seedFrom, reduceMotion, store, today, fmt } = PB;

  // ---------- the catalog ----------
  // shape: how a fish is drawn. c1/c2/c3: colors. pat: pattern. s: size. lv: tank level needed. price: coins.
  const FISH = [
    { id: 'goldfish',  name: 'Goldfish',       shape: 'fish',   c1: '#ff9a1f', c2: '#ffd9a0', pat: 'none',    s: 15, lv: 1,  price: 40 },
    { id: 'guppy',     name: 'Guppy',          shape: 'fish',   c1: '#4fa8ff', c2: '#ff6ec7', pat: 'spots',   s: 11, lv: 1,  price: 60 },
    { id: 'tetra',     name: 'Neon Tetra',     shape: 'fish',   c1: '#22306e', c2: '#28e0ff', c3: '#ff3b5c', pat: 'neon', s: 10, lv: 1, price: 80 },
    { id: 'clown',     name: 'Clownfish',      shape: 'fish',   c1: '#ff7a14', c2: '#ffffff', pat: 'bands',   s: 13, lv: 2,  price: 150 },
    { id: 'tang',      name: 'Blue Tang',      shape: 'fish',   c1: '#1f5dff', c2: '#ffd400', c3: '#0b1f5a', pat: 'tang', s: 15, lv: 2, price: 220 },
    { id: 'puffer',    name: 'Pufferfish',     shape: 'puffer', c1: '#ffd84a', c2: '#c98a1a', pat: 'spots',   s: 14, lv: 3,  price: 320 },
    { id: 'star',      name: 'Starfish',       shape: 'star',   c1: '#ff6f91', c2: '#ffd0dc', pat: 'none',    s: 15, lv: 3,  price: 260 },
    { id: 'angel',     name: 'Angelfish',      shape: 'tall',   c1: '#e8eef8', c2: '#1d2440', pat: 'stripes', s: 16, lv: 4,  price: 420 },
    { id: 'horse',     name: 'Seahorse',       shape: 'horse',  c1: '#ffc83a', c2: '#ff8a1a', pat: 'none',    s: 14, lv: 4,  price: 480 },
    { id: 'crab',      name: 'Hermit Crab',    shape: 'crab',   c1: '#ff4a3a', c2: '#ffd2a8', pat: 'none',    s: 13, lv: 5,  price: 520 },
    { id: 'betta',     name: 'Betta Fish',     shape: 'betta',  c1: '#8a3cff', c2: '#ff4fa8', pat: 'none',    s: 14, lv: 5,  price: 580 },
    { id: 'jelly',     name: 'Jellyfish',      shape: 'jelly',  c1: '#ff8fd0', c2: '#ffd6f0', pat: 'none',    s: 16, lv: 6,  price: 720 },
    { id: 'butterfly', name: 'Butterflyfish',  shape: 'tall',   c1: '#ffe14a', c2: '#1d2440', pat: 'eyespot', s: 14, lv: 7,  price: 680 },
    { id: 'turtle',    name: 'Sea Turtle',     shape: 'turtle', c1: '#3fae5a', c2: '#8a5a2a', pat: 'none',    s: 22, lv: 8,  price: 1250 },
    { id: 'lion',      name: 'Lionfish',       shape: 'lion',   c1: '#ff5a3a', c2: '#fff1e0', pat: 'stripes', s: 17, lv: 9,  price: 950 },
    { id: 'octo',      name: 'Octopus',        shape: 'octo',   c1: '#b04aff', c2: '#e2b4ff', pat: 'none',    s: 18, lv: 10, price: 1600 },
    { id: 'idol',      name: 'Moorish Idol',   shape: 'tall',   c1: '#fff8e0', c2: '#15151f', c3: '#ffd400', pat: 'idol', s: 15, lv: 11, price: 1100 },
    { id: 'shark',     name: 'Baby Shark',     shape: 'shark',  c1: '#7d93ad', c2: '#eef4fa', pat: 'none',    s: 22, lv: 12, price: 2300 },
    { id: 'ray',       name: 'Manta Ray',      shape: 'ray',    c1: '#2c3e7a', c2: '#e6ecf8', pat: 'none',    s: 26, lv: 13, price: 2600 },
    { id: 'rainbow',   name: 'Rainbow Fish',   shape: 'fish',   c1: '#7fd0ff', c2: '#ffffff', pat: 'rainbow', s: 15, lv: 14, price: 2000 },
    { id: 'glow',      name: 'Glow Jelly',     shape: 'jelly',  c1: '#28f0ff', c2: '#c8ffff', pat: 'glow',    s: 16, lv: 16, price: 2800 },
    { id: 'koi',       name: 'Golden Koi',     shape: 'koi',    c1: '#ffcf33', c2: '#ffffff', c3: '#ff5a1a', pat: 'koi', s: 20, lv: 18, price: 3200 },
    { id: 'narwhal',   name: 'Baby Narwhal',   shape: 'whale',  c1: '#8fb4d8', c2: '#e6f0fa', pat: 'horn',    s: 24, lv: 20, price: 4200 },
    { id: 'whale',     name: 'Baby Whale',     shape: 'whale',  c1: '#3f7fe0', c2: '#dfeaff', pat: 'none',    s: 26, lv: 22, price: 5000 },
    { id: 'dragon',    name: 'Dragon Fish',    shape: 'dragon', c1: '#ff3d6e', c2: '#ffd400', pat: 'rainbow', s: 24, lv: 25, price: 7500 },
  ];
  // w: how much floor it takes. back: drawn behind the fish.
  const DECOR = [
    { id: 'plant',    name: 'Green Plant',     lv: 1,  price: 40,   w: 46, back: false },
    { id: 'clam',     name: 'Pearl Clam',      lv: 1,  price: 300,  w: 56, back: false, pearl: 1 },
    { id: 'rocks',    name: 'Pebble Pile',     lv: 1,  price: 80,   w: 60, back: false },
    { id: 'kelp',     name: 'Tall Kelp',       lv: 2,  price: 150,  w: 40, back: true },
    { id: 'bubbler',  name: 'Bubble Stone',    lv: 3,  price: 250,  w: 40, back: false },
    { id: 'arch',     name: 'Stone Arch',      lv: 4,  price: 400,  w: 90, back: true },
    { id: 'chest',    name: 'Treasure Chest',  lv: 5,  price: 450,  w: 62, back: false },
    { id: 'castle',   name: 'Sand Castle',     lv: 6,  price: 700,  w: 96, back: true },
    { id: 'diver',    name: 'Little Diver',    lv: 7,  price: 600,  w: 44, back: false },
    { id: 'coral',    name: 'Coral Garden',    lv: 8,  price: 900,  w: 80, back: true },
    { id: 'shrooms',  name: 'Glow Mushrooms',  lv: 10, price: 1000, w: 60, back: false },
    { id: 'ship',     name: 'Sunken Ship',     lv: 12, price: 1600, w: 130, back: true },
    { id: 'bigclam',  name: 'Giant Clam',      lv: 13, price: 2200, w: 80, back: false, pearl: 2 },
    { id: 'rocket',   name: 'Toy Rocket',      lv: 15, price: 1800, w: 50, back: true },
    { id: 'volcano',  name: 'Bubble Volcano',  lv: 17, price: 2000, w: 100, back: true },
    { id: 'lights',   name: 'Twinkle Lights',  lv: 19, price: 2400, w: 0, back: true },
    { id: 'palace',   name: 'Mermaid Palace',  lv: 23, price: 4000, w: 140, back: true },
  ];
  // bigger tanks hold more fish and more decorations
  const TANKS = [
    { id: 'bowl',   name: 'Fish Bowl',       lv: 1,  price: 0,     fish: 3,  decor: 2,  w: 340, h: 300, round: true },
    { id: 'small',  name: 'Small Tank',      lv: 2,  price: 400,   fish: 6,  decor: 4,  w: 380, h: 300 },
    { id: 'medium', name: 'Medium Tank',     lv: 5,  price: 1500,  fish: 10, decor: 6,  w: 420, h: 360 },
    { id: 'big',    name: 'Big Tank',        lv: 9,  price: 4000,  fish: 15, decor: 8,  w: 450, h: 420 },
    { id: 'reef',   name: 'Reef Tank',       lv: 14, price: 8000,  fish: 20, decor: 11, w: 460, h: 470 },
    { id: 'grand',  name: 'Grand Aquarium',  lv: 20, price: 14000, fish: 30, decor: 16, w: 470, h: 520 },
  ];
  const WATERS = [
    { id: 'ocean',   name: 'Ocean Blue',     lv: 1,  price: 0,    top: '#5ec8f2', bot: '#1462a8', sand: '#e8d29a', sand2: '#c9a86a', ray: 0.08 },
    { id: 'lagoon',  name: 'Sunny Lagoon',   lv: 4,  price: 900,  top: '#7cf0e0', bot: '#1aa2a8', sand: '#fff0c0', sand2: '#e2c98a', ray: 0.12 },
    { id: 'sunset',  name: 'Sunset Sea',     lv: 8,  price: 1800, top: '#ffb38a', bot: '#7a3a8a', sand: '#f2c9a0', sand2: '#c88a6a', ray: 0.1 },
    { id: 'arctic',  name: 'Arctic Ice',     lv: 12, price: 2600, top: '#d8f4ff', bot: '#5a9ad0', sand: '#ffffff', sand2: '#cfe2f2', ray: 0.07, ice: true },
    { id: 'deep',    name: 'Deep Sea Glow',  lv: 16, price: 3500, top: '#123a7a', bot: '#030a26', sand: '#3a3a5a', sand2: '#24243a', ray: 0.03, glow: true },
  ];
  const NAMES = ['Bubbles', 'Finn', 'Nemo', 'Coral', 'Splash', 'Goldie', 'Wiggles', 'Pebble', 'Sunny', 'Ziggy', 'Marina', 'Captain', 'Squiggle', 'Blue', 'Peanut', 'Noodle', 'Twinkle', 'Puddles', 'Sprinkles', 'Mango', 'Pickle', 'Ollie', 'Luna', 'Poppy', 'Waffles', 'Biscuit', 'Jelly', 'Rocket', 'Shelly', 'Tiny', 'Dash', 'Maple', 'Kiwi', 'Bean', 'Sparky', 'Lulu'];

  // ---------- levels: Tank XP comes from caring for the tank, a little each day ----------
  const MAX_LV = 25, TOTAL_XP = 42000;
  const xpFor = L => L <= 1 ? 0 : Math.round(TOTAL_XP * Math.pow((L - 1) / (MAX_LV - 1), 1.8));
  const levelOf = xp => { let L = 1; while (L < MAX_LV && xp >= xpFor(L + 1)) L++; return L; };
  // daily care limits (so the pace stays about the same however long a visit is)
  const CARE = { feedXp: 20, feeds: 3, cleanXp: 30, trickXp: 2, tricks: 10, pearlXp: 5, visitXp: 10 };
  const HOUR = 3600e3, HUNGRY_AFTER = 20 * HOUR, DIRTY_AFTER = 3 * 24 * HOUR, PEARL_EVERY = 6 * HOUR, PEARL_COINS = 5;

  // ---------- saved tank ----------
  const KEY = 'pb-tank';
  function load(){
    let s = store.get(KEY);
    if (!s) {
      const now = Date.now();
      s = { v: 1, tank: 0, fish: [{ sp: 'goldfish', name: 'Goldie' }, { sp: 'goldfish', name: 'Bubbles' }], decor: ['plant', 'clam'], owned: ['plant', 'clam'], water: 'ocean', waters: ['ocean'],
        xp: 0, lastFed: now - 12 * HOUR, lastClean: now - 2.2 * 24 * HOUR, pearl: now - PEARL_EVERY + 20e3, care: null, seen: 0 };
      store.set(KEY, s);
    }
    if (!s.owned) s.owned = s.decor.slice();
    if (!s.care || s.care.day !== today()) s.care = { day: today(), feeds: 0, clean: false, tricks: 0, visit: false };
    return s;
  }
  const save = s => store.set(KEY, s);
  const tankOf = s => TANKS[s.tank] || TANKS[0];
  const waterOf = s => WATERS.find(w => w.id === s.water) || WATERS[0];
  const fishById = id => FISH.find(f => f.id === id);
  const decorById = id => DECOR.find(d => d.id === id);
  function addXp(s, n){
    const before = levelOf(s.xp); s.xp += n; const after = levelOf(s.xp);
    if (after > before) {
      const coins = 25 * after; if (PB.wallet) PB.wallet.add(coins);
      if (PB.sfx) PB.sfx('fanfare');
      if (PB.meta && PB.meta.banner) setTimeout(() => PB.meta.banner(`\u{1F420} Tank level ${after}! +${coins} coins. New things in the Pet Shop!`, true), 300);
      if (game && game.levelUp) game.levelUp(after);
    }
    return after > before;
  }
  // buying from the Pet Shop
  function buy(kind, id){
    const s = load(), L = levelOf(s.xp), wallet = PB.wallet;
    const item = kind === 'fish' ? fishById(id) : kind === 'decor' ? decorById(id) : kind === 'tank' ? TANKS.find(t => t.id === id) : WATERS.find(w => w.id === id);
    if (!item) return 'missing';
    if (L < item.lv) return 'level';
    if (kind === 'fish' && s.fish.length >= tankOf(s).fish) return 'full';
    if (kind === 'decor' && s.owned.includes(id)) return 'owned';
    if (kind === 'tank' && TANKS.indexOf(item) <= s.tank) return 'owned';
    if (kind === 'water' && s.waters.includes(id)) { s.water = id; save(s); if (game) game.reload(); return 'worn'; }
    if (!wallet || wallet.get() < item.price || !wallet.spend(item.price)) return 'coins';
    if (kind === 'fish') { const used = new Set(s.fish.map(f => f.name)), free = NAMES.filter(n => !used.has(n)); s.fish.push({ sp: id, name: free[Math.floor(Math.random() * free.length)] || item.name, isNew: true }); }
    if (kind === 'decor') { s.owned.push(id); if (s.decor.length < tankOf(s).decor) s.decor.push(id); else { save(s); return 'stored'; } }
    if (kind === 'tank') s.tank = TANKS.indexOf(item);
    if (kind === 'water') { s.waters.push(id); s.water = id; }
    save(s); if (game) game.reload(kind, id);
    return 'ok';
  }
  // a fish can swim back to the ocean (to make room); decorations you own can be put in the tank or taken out
  function release(idx){ const s = load(); if (s.fish[idx] && s.fish.length > 1) s.fish.splice(idx, 1); save(s); if (game) game.reload(); }
  function toggleDecor(id){
    const s = load(); if (!s.owned.includes(id)) return 'missing';
    if (s.decor.includes(id)) s.decor = s.decor.filter(d => d !== id);
    else if (s.decor.length >= tankOf(s).decor) return 'full'; else s.decor.push(id);
    save(s); if (game) game.reload(); return 'ok';
  }
  let game = null;
  PB.tank = { FISH, DECOR, TANKS, WATERS, load, save, buy, release, toggleDecor, levelOf, xpFor, MAX_LV, tankOf, waterOf,
    level: () => levelOf(load().xp), drawFish: (g, sp, x, y, size, t) => drawFish(g, fishById(sp), x, y, size, 1, t || 0, 0, 1), drawDecor: (g, id, x, y, sc) => drawDecor(g, id, x, y, sc || 1, 0) };

  // ---------- drawing fish ----------
  const shade = (c, k) => PB.shade(c, k);
  function rainbowGrad(g, x0, x1){ const q = g.createLinearGradient(x0, 0, x1, 0); ['#ff3b5c', '#ff9a1f', '#ffd400', '#3ddc6a', '#28c8ff', '#8a5cff'].forEach((c, i) => q.addColorStop(i / 5, c)); return q; }
  function eye(g, x, y, r, happy){
    if (happy) { g.strokeStyle = '#1b1430'; g.lineWidth = Math.max(1.2, r * 0.5); g.lineCap = 'round'; g.beginPath(); g.arc(x, y + r * 0.2, r * 0.8, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); return; }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#1b1430'; g.beginPath(); g.arc(x + r * 0.2, y, r * 0.55, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + r * 0.35, y - r * 0.3, r * 0.2, 0, 7); g.fill();
  }
  // draws one creature facing right at (x, y). dir -1 flips it. t: time for wiggles. happy: closed happy eyes.
  function drawFish(g, f, x, y, size, dir, t, happy, alpha){
    if (!f) return;
    const s = size / 15;
    g.save(); g.translate(x, y); g.scale(dir * s, s); g.globalAlpha = alpha == null ? 1 : alpha;
    const wag = Math.sin(t * 8) * 0.25, c1 = f.c1, c2 = f.c2, c3 = f.c3 || shade(c1, -0.3);
    const outline = () => { g.strokeStyle = 'rgba(20,20,50,.35)'; g.lineWidth = 1.2; g.stroke(); };
    switch (f.shape) {
      case 'fish': case 'koi': case 'betta': case 'lion': {
        const L = f.shape === 'koi' ? 24 : 18, Hh = f.shape === 'koi' ? 9 : 11;
        // tail
        g.save(); g.translate(-L + 2, 0); g.rotate(wag);
        g.fillStyle = f.pat === 'rainbow' ? rainbowGrad(g, -14, 0) : f.pat === 'tang' ? c2 : f.shape === 'betta' ? c2 : c1;
        g.beginPath(); if (f.shape === 'betta') { g.moveTo(2, 0); g.bezierCurveTo(-10, -22, -26, -14, -24, 0); g.bezierCurveTo(-26, 14, -10, 22, 2, 0); } else { g.moveTo(2, 0); g.lineTo(-12, -10); g.quadraticCurveTo(-7, 0, -12, 10); g.closePath(); }
        g.fill(); outline(); g.restore();
        if (f.shape === 'betta') { g.fillStyle = c2; g.beginPath(); g.moveTo(-8, -8); g.quadraticCurveTo(-2, -24, 8, -9); g.fill(); g.beginPath(); g.moveTo(-8, 8); g.quadraticCurveTo(0, 22, 6, 8); g.fill(); }
        if (f.shape === 'lion') { g.strokeStyle = c1; g.lineWidth = 2; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(-10 + k * 4, -8); g.lineTo(-14 + k * 4 + Math.sin(t * 3 + k) * 2, -22); g.stroke(); } for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(2, sy * 4); g.quadraticCurveTo(-4, sy * 20, -12, sy * 18); g.stroke(); } }
        // dorsal fin
        g.fillStyle = f.pat === 'tang' ? c3 : shade(c1, -0.1); g.beginPath(); g.moveTo(-8, -Hh + 2); g.quadraticCurveTo(-2, -Hh - 7, 6, -Hh + 3); g.fill();
        // body
        g.beginPath(); g.ellipse(0, 0, L, Hh, 0, 0, 7);
        if (f.pat === 'rainbow') g.fillStyle = rainbowGrad(g, -L, L); else { const q = g.createLinearGradient(0, -Hh, 0, Hh); q.addColorStop(0, shade(c1, 0.2)); q.addColorStop(1, shade(c1, -0.15)); g.fillStyle = q; }
        g.fill(); g.save(); g.clip();
        if (f.pat === 'bands') { g.fillStyle = c2; for (const bx of [-10, 2, 13]) { g.fillRect(bx, -Hh, 4, Hh * 2); } g.strokeStyle = '#1b1430'; g.lineWidth = 1; for (const bx of [-10, 2, 13]) { g.strokeRect(bx, -Hh, 4, Hh * 2); } }
        if (f.pat === 'spots') { g.fillStyle = c2; for (const [sx, sy] of [[-8, -3], [-2, 4], [4, -4], [-12, 3], [9, 2]]) { g.beginPath(); g.arc(sx, sy, 1.8, 0, 7); g.fill(); } }
        if (f.pat === 'neon') { g.fillStyle = c2; g.fillRect(-L, -3, L * 2, 3); g.fillStyle = c3; g.fillRect(-L, 0, L * 0.9, Hh); }
        if (f.pat === 'tang') { g.fillStyle = c3; g.beginPath(); g.ellipse(-2, -3, 11, 4, -0.2, 0, 7); g.fill(); }
        if (f.pat === 'stripes') { g.fillStyle = c2; for (let k = -L; k < L; k += 6) g.fillRect(k, -Hh, 2.5, Hh * 2); }
        if (f.pat === 'koi') { g.fillStyle = c3; for (const [sx, sy, r] of [[-8, -3, 5], [6, 2, 4], [-16, 1, 3]]) { g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); } }
        g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(2, -Hh * 0.45, L * 0.6, Hh * 0.25, 0, 0, 7); g.fill();
        g.restore(); g.beginPath(); g.ellipse(0, 0, L, Hh, 0, 0, 7); outline();
        if (f.shape === 'koi') { g.strokeStyle = shade(c1, -0.3); g.lineWidth = 1; for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(L - 3, 2 * sy); g.quadraticCurveTo(L + 4, 4 * sy, L + 6, 9 * sy); g.stroke(); } }
        g.fillStyle = shade(c1, -0.2); g.beginPath(); g.ellipse(-2, 4, 5, 2.5, 0.5 + wag, 0, 7); g.fill();   // side fin
        eye(g, L * 0.55, -2, 3, happy);
        g.strokeStyle = 'rgba(20,10,40,.6)'; g.lineWidth = 1.1; g.beginPath(); g.arc(L - 2, 3, 2, 0.2, 1.8); g.stroke();
        break; }
      case 'tall': {
        g.save(); g.translate(-12, 0); g.rotate(wag); g.fillStyle = f.pat === 'idol' ? c3 : c1; g.beginPath(); g.moveTo(2, 0); g.lineTo(-9, -8); g.lineTo(-9, 8); g.closePath(); g.fill(); g.restore();
        g.beginPath(); g.moveTo(14, 0); g.quadraticCurveTo(4, -22, -12, -4); g.lineTo(-12, 4); g.quadraticCurveTo(4, 22, 14, 0);
        if (f.id === 'angel') { g.moveTo(-4, -14); g.lineTo(-14, -34); g.lineTo(2, -16); g.moveTo(-4, 14); g.lineTo(-14, 34); g.lineTo(2, 16); }
        g.fillStyle = c1; g.fill(); g.save(); g.clip();
        if (f.pat === 'stripes') { g.fillStyle = c2; for (const bx of [-8, 0, 8]) g.fillRect(bx, -40, 3.5, 80); }
        if (f.pat === 'idol') { g.fillStyle = c2; g.fillRect(-10, -40, 7, 80); g.fillRect(4, -40, 6, 80); g.fillStyle = c3; g.fillRect(-3, -40, 7, 80); }
        if (f.pat === 'eyespot') { g.fillStyle = c2; g.beginPath(); g.arc(-6, -2, 3.5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-6, -2, 1.2, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(5, -20, 2.5, 40); }
        g.restore(); outline();
        if (f.pat === 'idol') { g.strokeStyle = c2; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-2, -16); g.quadraticCurveTo(-14, -30, -24, -26); g.stroke(); }
        eye(g, 7, -3, 2.6, happy); break; }
      case 'puffer': {
        const puff = 1 + 0.06 * Math.sin(t * 2);
        g.save(); g.translate(-14, 0); g.rotate(wag); g.fillStyle = c1; g.beginPath(); g.moveTo(2, 0); g.lineTo(-7, -6); g.lineTo(-7, 6); g.closePath(); g.fill(); g.restore();
        g.fillStyle = c2; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28; g.beginPath(); g.moveTo(Math.cos(a) * 13 * puff, Math.sin(a) * 13 * puff); g.lineTo(Math.cos(a + 0.1) * 17 * puff, Math.sin(a + 0.1) * 17 * puff); g.lineTo(Math.cos(a + 0.2) * 13 * puff, Math.sin(a + 0.2) * 13 * puff); g.fill(); }
        const q = g.createRadialGradient(-4, -5, 2, 0, 0, 15); q.addColorStop(0, shade(c1, 0.35)); q.addColorStop(1, c1); g.fillStyle = q; g.beginPath(); g.arc(0, 0, 14 * puff, 0, 7); g.fill(); outline();
        g.fillStyle = c2; for (const [sx, sy] of [[-6, -6], [2, -9], [-9, 3], [-2, 1], [5, -3]]) { g.beginPath(); g.arc(sx, sy, 1.6, 0, 7); g.fill(); }
        g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(2, 7, 9, 5, 0, 0, 7); g.fill();
        eye(g, 7, -3, 3.4, happy); g.strokeStyle = '#7a3a10'; g.lineWidth = 1.2; g.beginPath(); g.arc(12, 3, 1.6, 0, 7); g.stroke(); break; }
      case 'star': {
        g.rotate(Math.sin(t * 0.5) * 0.05); g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 6 : 15; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
        g.fillStyle = c1; g.fill(); outline(); g.fillStyle = c2; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; for (const d of [5, 9]) { g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 1.2, 0, 7); g.fill(); } }
        eye(g, -3, -1, 2, happy); eye(g, 3, -1, 2, happy); g.strokeStyle = '#7a1a3a'; g.lineWidth = 1; g.beginPath(); g.arc(0, 2, 2.5, 0.2, 2.9); g.stroke(); break; }
      case 'horse': {
        g.rotate(Math.sin(t * 1.5) * 0.08); g.fillStyle = c1;
        g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(10, -14, 9, -8); g.quadraticCurveTo(6, 0, 3, 6); g.quadraticCurveTo(0, 14, 5, 18); g.quadraticCurveTo(8, 23, 2, 24); g.quadraticCurveTo(-5, 22, -2, 16); g.quadraticCurveTo(-8, 6, -6, -4); g.quadraticCurveTo(-6, -14, 0, -16); g.fill(); outline();
        g.beginPath(); g.moveTo(7, -12); g.lineTo(16, -11); g.lineTo(16, -8); g.lineTo(8, -8); g.fill();
        g.fillStyle = c2; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(-6 + Math.sin(k) * 1, -10 + k * 5, 2, 0, 7); g.fill(); }
        g.beginPath(); g.moveTo(-6, -2); g.quadraticCurveTo(-14 + Math.sin(t * 9) * 2, 0, -6, 6); g.fill();
        eye(g, 3, -11, 2.4, happy); break; }
      case 'crab': {
        const step = Math.sin(t * 10) * 2;
        g.strokeStyle = shade(c1, -0.2); g.lineWidth = 2.2; g.lineCap = 'round'; for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(sx * 6, 2 + k * 2); g.lineTo(sx * (14 + k * 2), 8 + k * 2 + (k % 2 ? step : -step)); g.stroke(); }
        g.fillStyle = c2; g.beginPath(); g.arc(-2, -6, 11, Math.PI, 0); g.lineTo(9, -6); g.fill();   // the shell house
        g.strokeStyle = shade(c2, -0.3); g.lineWidth = 1.2; g.beginPath(); g.arc(-2, -9, 6, Math.PI * 0.9, Math.PI * 2.4); g.stroke();
        g.fillStyle = c1; g.beginPath(); g.ellipse(0, 3, 11, 6, 0, 0, 7); g.fill(); outline();
        for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 15, -2 - Math.abs(step), 5, 4, sx * 0.4, 0, 7); g.fill(); }
        g.strokeStyle = c1; g.lineWidth = 1.5; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 3, -1); g.lineTo(sx * 4, -6); g.stroke(); }
        eye(g, -4, -7, 2, happy); eye(g, 4, -7, 2, happy); break; }
      case 'jelly': {
        const pul = 1 + 0.12 * Math.sin(t * 2.5);
        if (f.pat === 'glow') { const q = g.createRadialGradient(0, 0, 2, 0, 0, 30); q.addColorStop(0, f.c1 + '88'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(-30, -30, 60, 70); }
        g.strokeStyle = c1 + 'cc'; g.lineWidth = 1.6; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 4, 2); for (let yy = 2; yy < 26; yy += 3) g.lineTo(k * 4 + Math.sin(t * 3 + yy * 0.3 + k) * 2.5, yy); g.stroke(); }
        g.globalAlpha *= 0.9; g.fillStyle = c1; g.beginPath(); g.ellipse(0, 0, 14 * pul, 12 / pul, 0, Math.PI, 0); g.quadraticCurveTo(0, 5, -14 * pul, 0); g.fill();
        g.fillStyle = c2; g.beginPath(); g.ellipse(-3, -6, 6, 3, -0.3, 0, 7); g.fill();
        g.globalAlpha /= 0.9; eye(g, -4, -3, 2, happy); eye(g, 4, -3, 2, happy); break; }
      case 'turtle': {
        const pad = Math.sin(t * 2.5) * 0.4;
        g.fillStyle = shade(c1, 0.15); for (const [fx, fy, a] of [[8, -8, -0.6 - pad], [8, 8, 0.6 + pad], [-10, -7, -2.4 + pad], [-10, 7, 2.4 - pad]]) { g.save(); g.translate(fx, fy); g.rotate(a); g.beginPath(); g.ellipse(5, 0, 7, 3, 0, 0, 7); g.fill(); g.restore(); }
        g.beginPath(); g.ellipse(17, 0, 6, 5, 0, 0, 7); g.fill(); outline();
        g.fillStyle = c2; g.beginPath(); g.ellipse(0, 0, 15, 11, 0, 0, 7); g.fill(); outline();
        g.strokeStyle = shade(c2, 0.3); g.lineWidth = 1.2; for (const [hx, hy] of [[0, 0], [-8, -4], [-8, 4], [8, -4], [8, 4]]) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; g.lineTo(hx + Math.cos(a) * 3.6, hy + Math.sin(a) * 3.6); } g.closePath(); g.stroke(); }
        eye(g, 19, -2, 1.8, happy); break; }
      case 'octo': {
        g.fillStyle = c1; g.strokeStyle = c1; g.lineCap = 'round'; g.lineWidth = 3.5;
        for (let k = 0; k < 6; k++) { const bx = -10 + k * 4; g.beginPath(); g.moveTo(bx, 4); g.quadraticCurveTo(bx + Math.sin(t * 3 + k) * 5, 14, bx - 3 + Math.sin(t * 2 + k) * 4, 20); g.stroke(); }
        const q = g.createRadialGradient(-4, -10, 2, 0, -4, 16); q.addColorStop(0, shade(c1, 0.3)); q.addColorStop(1, c1); g.fillStyle = q; g.beginPath(); g.ellipse(0, -4, 13, 14, 0, 0, 7); g.fill(); outline();
        g.fillStyle = c2; for (const [sx, sy] of [[-5, -12], [4, -10], [-7, -3]]) { g.beginPath(); g.arc(sx, sy, 1.8, 0, 7); g.fill(); }
        eye(g, -4, -2, 2.8, happy); eye(g, 5, -2, 2.8, happy); break; }
      case 'shark': {
        g.save(); g.translate(-24, 0); g.rotate(wag); g.fillStyle = c1; g.beginPath(); g.moveTo(3, 0); g.lineTo(-10, -12); g.lineTo(-6, 0); g.lineTo(-10, 9); g.closePath(); g.fill(); g.restore();
        g.fillStyle = c1; g.beginPath(); g.moveTo(-4, -8); g.lineTo(2, -20); g.lineTo(8, -7); g.fill();
        g.beginPath(); g.moveTo(26, 0); g.quadraticCurveTo(18, -10, -2, -9); g.quadraticCurveTo(-20, -7, -26, 0); g.quadraticCurveTo(-18, 7, 0, 8); g.quadraticCurveTo(18, 8, 26, 0); g.fillStyle = c1; g.fill(); outline();
        g.fillStyle = c2; g.beginPath(); g.moveTo(24, 1); g.quadraticCurveTo(10, 8, -16, 4); g.quadraticCurveTo(4, 2, 24, 1); g.fill();
        g.fillStyle = shade(c1, -0.2); g.beginPath(); g.moveTo(4, 4); g.lineTo(-2, 14); g.lineTo(10, 6); g.fill();
        eye(g, 15, -2, 2.4, happy); g.strokeStyle = '#2a2a3a'; g.lineWidth = 1; g.beginPath(); g.arc(19, 3, 2.5, 0.3, 2.2); g.stroke(); break; }
      case 'ray': {
        const flap = Math.sin(t * 3) * 6;
        g.fillStyle = c1; g.beginPath(); g.moveTo(16, 0); g.quadraticCurveTo(4, -6, -2, -24 - flap); g.quadraticCurveTo(-8, -8, -18, 0); g.quadraticCurveTo(-8, 8, -2, 24 + flap); g.quadraticCurveTo(4, 6, 16, 0); g.fill(); outline();
        g.strokeStyle = c1; g.lineWidth = 2; g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(-28, Math.sin(t * 4) * 4, -36, 0); g.stroke();
        g.fillStyle = c2; g.beginPath(); g.ellipse(4, 0, 6, 3, 0, 0, 7); g.fill();
        eye(g, 12, -4, 1.8, happy); eye(g, 12, 4, 1.8, happy); break; }
      case 'whale': {
        g.save(); g.translate(-22, -2); g.rotate(wag * 0.6 - 0.3); g.fillStyle = c1; g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(-8, -12, -14, -10); g.quadraticCurveTo(-8, -2, -14, 4); g.quadraticCurveTo(-6, 4, 2, 0); g.fill(); g.restore();
        g.beginPath(); g.moveTo(24, 2); g.quadraticCurveTo(24, -16, 4, -15); g.quadraticCurveTo(-18, -13, -24, -2); g.quadraticCurveTo(-14, 12, 6, 12); g.quadraticCurveTo(24, 12, 24, 2); g.fillStyle = c1; g.fill(); outline();
        g.fillStyle = c2; g.beginPath(); g.moveTo(22, 5); g.quadraticCurveTo(8, 13, -12, 6); g.quadraticCurveTo(6, 6, 22, 5); g.fill();
        if (f.pat === 'horn') { g.strokeStyle = '#fff6dc'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(22, -6); g.lineTo(40, -14); g.stroke(); g.strokeStyle = '#c8b890'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(25 + k * 4, -7 - k * 2); g.lineTo(27 + k * 4, -9 - k * 2); g.stroke(); } }
        g.fillStyle = 'rgba(255,140,170,.5)'; g.beginPath(); g.arc(14, 3, 3, 0, 7); g.fill();
        eye(g, 14, -4, 2.6, happy); g.strokeStyle = '#1b1430'; g.lineWidth = 1.2; g.beginPath(); g.arc(19, 4, 3, 0.4, 2.2); g.stroke(); break; }
      case 'dragon': {
        // a long, wavy rainbow fish with whiskers
        const segs = 9; let px = 22, py = 0;
        for (let k = 0; k < segs; k++) { const x2 = 22 - k * 6, y2 = Math.sin(t * 4 - k * 0.7) * 3; g.fillStyle = ['#ff3b5c', '#ff9a1f', '#ffd400', '#3ddc6a', '#28c8ff', '#8a5cff'][k % 6]; g.beginPath(); g.arc(x2, y2, 8 - k * 0.55, 0, 7); g.fill(); px = x2; py = y2; }
        g.fillStyle = '#ff3b5c'; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 12, py - 9); g.lineTo(px - 9, py); g.lineTo(px - 12, py + 9); g.closePath(); g.fill();
        g.fillStyle = '#ffd400'; for (let k = 0; k < 6; k++) { const x2 = 18 - k * 6; g.beginPath(); g.moveTo(x2, -6); g.lineTo(x2 - 2, -13); g.lineTo(x2 - 5, -5); g.fill(); }
        g.strokeStyle = '#ffd400'; g.lineWidth = 1.2; for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(28, sy * 2); g.quadraticCurveTo(36, sy * 6 + Math.sin(t * 5) * 3, 42, sy * 4); g.stroke(); }
        g.fillStyle = '#ff3b5c'; g.beginPath(); g.ellipse(24, 0, 8, 7, 0, 0, 7); g.fill(); eye(g, 26, -2, 2.4, happy); break; }
    }
    g.restore();
  }

  // ---------- decorations ----------
  function drawDecor(g, id, x, y, sc, t){
    g.save(); g.translate(x, y); g.scale(sc, sc);
    const blob = (cx, cy, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); };
    switch (id) {
      case 'plant': for (let k = 0; k < 7; k++) { const a = -1.2 + k * 0.4 + Math.sin(t * 1.3 + k) * 0.06; g.fillStyle = k % 2 ? '#2fae4a' : '#46c95e'; g.save(); g.rotate(a + Math.PI / 2 - Math.PI / 2); g.beginPath(); g.ellipse(Math.sin(a) * 14, -18 - Math.cos(a) * 6, 6, 18, a * 0.6, 0, 7); g.fill(); g.restore(); } break;
      case 'kelp': for (let k = 0; k < 3; k++) { g.strokeStyle = ['#2a8a3a', '#3aa84a', '#1f7a30'][k]; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10 + k * 10, 0); for (let yy = 0; yy < 150; yy += 10) g.lineTo(-10 + k * 10 + Math.sin(t * 1.2 + yy * 0.05 + k) * 7, -yy); g.stroke(); } break;
      case 'rocks': blob(-14, -8, 18, 12, '#8a8f9a'); blob(12, -7, 15, 10, '#a3a8b2'); blob(0, -16, 12, 9, '#b8bcc6'); blob(-4, -19, 4, 2, 'rgba(255,255,255,.4)'); break;
      case 'clam': case 'bigclam': { const big = id === 'bigclam' ? 1.5 : 1, open = 0.35 + 0.1 * Math.sin(t * 0.8); g.scale(big, big);
        g.fillStyle = '#e8b4c8'; g.beginPath(); g.ellipse(0, -6, 22, 10, 0, 0, Math.PI); g.fill();
        g.fillStyle = '#ffd6e4'; g.save(); g.translate(0, -6); g.rotate(-open); g.beginPath(); g.ellipse(0, 0, 22, 14, 0, Math.PI, 0); g.fill(); g.strokeStyle = '#d088a8'; g.lineWidth = 1.2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(k * 8, -12); g.stroke(); } g.restore(); break; }
      case 'bubbler': g.fillStyle = '#6a6f7a'; g.beginPath(); g.ellipse(0, -6, 16, 8, 0, 0, 7); g.fill(); g.fillStyle = '#8a909c'; g.beginPath(); g.ellipse(-3, -9, 7, 3, 0, 0, 7); g.fill(); break;
      case 'arch': g.fillStyle = '#9a8f80'; g.beginPath(); g.moveTo(-45, 0); g.lineTo(-45, -50); g.quadraticCurveTo(-45, -90, 0, -90); g.quadraticCurveTo(45, -90, 45, -50); g.lineTo(45, 0); g.lineTo(25, 0); g.lineTo(25, -50); g.quadraticCurveTo(25, -70, 0, -70); g.quadraticCurveTo(-25, -70, -25, -50); g.lineTo(-25, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(-40, -55, 8, 50); g.fillStyle = '#4caf50'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(-30 + k * 12, -86 + Math.abs(k - 2.5) * 2, 5, 0, 7); g.fill(); } break;
      case 'chest': { const lid = Math.max(0, Math.sin(t * 0.7)) * 0.5; g.fillStyle = '#8a5a2a'; g.fillRect(-28, -26, 56, 26); g.fillStyle = '#ffd23f'; g.fillRect(-28, -16, 56, 4); g.fillRect(-3, -22, 6, 10);
        g.save(); g.translate(-28, -26); g.rotate(-lid); g.fillStyle = '#9a6a3a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(56, 0); g.quadraticCurveTo(56, -16, 28, -18); g.quadraticCurveTo(0, -16, 0, 0); g.fill(); g.restore();
        if (lid > 0.1) { g.fillStyle = '#ffe14a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(-16 + k * 8, -27, 4, 0, 7); g.fill(); } } break; }
      case 'castle': g.fillStyle = '#e2c88a'; g.fillRect(-36, -70, 22, 70); g.fillRect(14, -70, 22, 70); g.fillRect(-18, -50, 36, 50); g.fillRect(-10, -96, 20, 46);
        for (const [cx, w] of [[-25, 22], [25, 22], [0, 20]]) { for (let k = 0; k < 3; k++) g.fillRect(cx - w / 2 + k * (w / 2.5), (cx ? -78 : -104), w / 5, 8); }
        g.fillStyle = '#6a4a2a'; g.beginPath(); g.arc(0, -16, 9, Math.PI, 0); g.fillRect(-9, -16, 18, 16); g.fill(); g.fillStyle = '#5a7ad0'; g.fillRect(-28, -50, 6, 9); g.fillRect(22, -50, 6, 9); g.fillRect(-3, -80, 6, 9);
        g.fillStyle = '#ff4f6e'; g.beginPath(); g.moveTo(0, -96); g.lineTo(0, -116); g.lineTo(14, -110); g.lineTo(0, -104); g.fill(); break;
      case 'diver': { const bob = Math.sin(t * 1.5) * 2; g.translate(0, bob); g.fillStyle = '#ffb02e'; g.fillRect(-10, -34, 20, 26); g.fillStyle = '#3a5a9a'; g.fillRect(-10, -12, 9, 12); g.fillRect(1, -12, 9, 12);
        g.fillStyle = '#c9ced8'; g.beginPath(); g.arc(0, -44, 13, 0, 7); g.fill(); g.fillStyle = '#5ec8f2'; g.beginPath(); g.arc(1, -44, 7, 0, 7); g.fill(); g.strokeStyle = '#8a909c'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#9aa0ac'; g.fillRect(-16, -32, 6, 18); break; }
      case 'coral': for (const [cx, col, h] of [[-26, '#ff6f91', 50], [0, '#ff9a3d', 64], [24, '#c77dff', 46]]) { g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, -h); g.moveTo(cx, -h * 0.4); g.lineTo(cx - 12, -h * 0.75); g.moveTo(cx, -h * 0.55); g.lineTo(cx + 11, -h * 0.85); g.stroke(); g.fillStyle = col; for (const [dx, dy] of [[0, -h], [-12, -h * 0.75], [11, -h * 0.85]]) { g.beginPath(); g.arc(cx + dx, dy, 5, 0, 7); g.fill(); } } break;
      case 'shrooms': for (const [cx, h, col] of [[-18, 26, '#28f0ff'], [4, 38, '#ff5fd8'], [22, 22, '#9cff5a']]) { const gl = 0.5 + 0.3 * Math.sin(t * 2 + cx); g.fillStyle = '#f2ead8'; g.fillRect(cx - 3, -h, 6, h); const q = g.createRadialGradient(cx, -h, 2, cx, -h, 26); q.addColorStop(0, col + 'aa'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = gl; g.fillStyle = q; g.fillRect(cx - 26, -h - 26, 52, 52); g.globalAlpha = 1; g.fillStyle = col; g.beginPath(); g.ellipse(cx, -h, 13, 9, 0, Math.PI, 0); g.fill(); } break;
      case 'ship': g.fillStyle = '#6a4424'; g.save(); g.rotate(-0.12); g.beginPath(); g.moveTo(-64, -40); g.lineTo(60, -50); g.lineTo(46, 0); g.lineTo(-50, 6); g.closePath(); g.fill(); g.fillStyle = '#4a2e14'; for (let k = 0; k < 4; k++) g.fillRect(-50 + k * 26, -34, 14, 10);
        g.fillStyle = '#7a5434'; g.fillRect(-6, -120, 6, 74); g.fillStyle = 'rgba(240,230,210,.8)'; g.beginPath(); g.moveTo(0, -116); g.lineTo(34, -98); g.lineTo(26, -70); g.lineTo(0, -66); g.fill(); g.restore(); g.fillStyle = 'rgba(10,30,60,.3)'; g.fillRect(-20, -26, 16, 18); break;
      case 'rocket': g.save(); g.rotate(0.35); g.fillStyle = '#e8ecf8'; g.beginPath(); g.moveTo(0, -78); g.quadraticCurveTo(16, -60, 14, -10); g.lineTo(-14, -10); g.quadraticCurveTo(-16, -60, 0, -78); g.fill(); g.fillStyle = '#ff3b5c'; g.beginPath(); g.moveTo(-14, -24); g.lineTo(-26, -2); g.lineTo(-12, -10); g.fill(); g.beginPath(); g.moveTo(14, -24); g.lineTo(26, -2); g.lineTo(12, -10); g.fill(); g.fillStyle = '#28c8ff'; g.beginPath(); g.arc(0, -46, 6, 0, 7); g.fill(); g.restore(); break;
      case 'volcano': { g.fillStyle = '#5a4a44'; g.beginPath(); g.moveTo(-50, 0); g.lineTo(-14, -60); g.lineTo(14, -60); g.lineTo(50, 0); g.fill(); const gl = 0.6 + 0.4 * Math.sin(t * 2); g.fillStyle = `rgba(255,${120 + 60 * gl | 0},40,1)`; g.beginPath(); g.ellipse(0, -60, 14, 4, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,120,40,.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-6, -58); g.quadraticCurveTo(-14, -40, -22, -28); g.stroke(); break; }
      case 'palace': { g.fillStyle = '#ffb8d8'; g.fillRect(-60, -70, 120, 70); g.fillRect(-70, -100, 26, 100); g.fillRect(44, -100, 26, 100); g.fillRect(-20, -120, 40, 50);
        g.fillStyle = '#c77dff'; for (const [cx, cy, r] of [[-57, -100, 15], [57, -100, 15], [0, -120, 22]]) { g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.fill(); g.fillRect(cx - 1.5, cy - r - 12, 3, 12); }
        g.fillStyle = '#ffe14a'; for (const [cx, cy] of [[-57, -128], [57, -128], [0, -156]]) { g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill(); }
        g.fillStyle = '#7a4aa8'; g.beginPath(); g.arc(0, -22, 14, Math.PI, 0); g.fillRect(-14, -22, 28, 22); g.fill(); g.fillStyle = '#5ec8f2'; for (const wx of [-42, 30]) g.fillRect(wx, -52, 12, 16); break; }
    }
    g.restore();
  }

  function createTank(shell){
    const W = 480, H = 760, FLOOR_H = 46;
    const FONT = '"Lilita One", "Arial Rounded MT Bold", "Arial Black", sans-serif', BODY = '"Nunito", "Segoe UI", sans-serif';
    let S = null, st = null;

    function box(){ const T = tankOf(S), x = (W - T.w) / 2, y = 146 + (528 - T.h) / 2 + (T.round ? 20 : 0); return { x, y, w: T.w, h: T.h, round: !!T.round, floor: y + T.h - FLOOR_H }; }
    // where things can swim
    function swimArea(){ const b = box(); if (b.round) { const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 10; return { x0: cx - 120, x1: cx + 120, y0: b.y + 70, y1: b.floor - 18 }; } return { x0: b.x + 30, x1: b.x + b.w - 30, y0: b.y + 40, y1: b.floor - 20 }; }
    const floorY = () => box().floor + 12;

    function build(){
      S = load();
      const a = swimArea(), R = Math.random;
      st = st || { parts: [], pops: [], food: [], bubbles: [], t: 0, mode: null, wiped: new Set(), sel: null };
      const old = new Map((st.fish || []).map(f => [f.name + f.sp, f]));
      st.fish = S.fish.map((d, i) => {
        const sp = fishById(d.sp), keep = old.get(d.name + d.sp), bottom = sp.shape === 'crab' || sp.shape === 'star';
        return keep ? Object.assign(keep, { i }) : { i, sp, name: d.name, x: a.x0 + R() * (a.x1 - a.x0), y: bottom ? floorY() - 8 : a.y0 + R() * (a.y1 - a.y0), vx: 0, vy: 0, dir: R() < 0.5 ? 1 : -1, tx: null, ty: null, ph: R() * 6, trick: 0, happy: 0, bottom, isNew: d.isNew, label: d.isNew ? 3 : 0 };
      });
      S.fish.forEach(d => delete d.isNew); save(S);
      layoutDecor();
    }
    function layoutDecor(){
      const b = box(), list = S.decor.map(id => decorById(id)).filter(Boolean), placed = [], span = b.round ? 230 : b.w - 40;
      // the big, tall things go in a row along the back; small ones in a row in front, each row spread across the floor
      for (const row of [list.filter(d => d.back && d.w), list.filter(d => !d.back && d.w)]) {
        const total = row.reduce((s, d) => s + d.w, 0), sc = Math.min(1, span / Math.max(1, total)) * (b.round ? 0.75 : 1), used = total * sc, gap = row.length > 1 ? Math.max(0, (span - used) / row.length) : 0;
        let x = b.x + b.w / 2 - (used + gap * (row.length - 1)) / 2;
        for (const d of row) { placed.push({ d, x: x + d.w * sc / 2, sc }); x += d.w * sc + gap; }
      }
      for (const d of list) if (!d.w) placed.push({ d, x: b.x + b.w / 2, sc: 1 });
      st.decor = placed;
    }
    const care = () => { if (!S.care || S.care.day !== today()) S.care = { day: today(), feeds: 0, clean: false, tricks: 0, visit: false }; return S.care; };
    const hunger = () => Math.max(0, Math.min(1, (Date.now() - S.lastFed) / HUNGRY_AFTER));
    const dirt = () => Math.max(0, Math.min(1, (Date.now() - S.lastClean) / DIRTY_AFTER));
    function pop(x, y, text, color, life){ st.pops.push({ x, y, text, color: color || '#fff', life: life || 1.4, max: life || 1.4 }); }
    function sparkle(x, y, color, n){ if (reduceMotion) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 40 + Math.random() * 120; st.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.9, color }); } }
    function xp(n, x, y, why){
      if (n <= 0) return; const up = addXp(S, n); save(S);
      if (x != null) pop(x, y, `+${n} XP${why ? ' ' + why : ''}`, '#9cff5a', 1.3);
      return up;
    }
    // algae spots on the glass: more the longer it's been since the last clean
    function algae(){
      const n = Math.round(dirt() * 14), R = mulberry(seedFrom('algae-' + S.lastClean)), b = box(), out = [];
      for (let i = 0; i < n; i++) out.push({ i, x: b.x + 20 + R() * (b.w - 40), y: b.y + 30 + R() * (b.h - 90), r: 16 + R() * 22 });
      return out.filter(o => !st.wiped.has(o.i));
    }

    // ---------- actions ----------
    function dropFood(x){
      const a = swimArea(), b = box(); x = Math.max(a.x0, Math.min(a.x1, x));
      for (let k = 0; k < 5; k++) st.food.push({ x: x + (Math.random() - 0.5) * 30, y: b.y + (b.round ? 60 : 14) + Math.random() * 8, vy: 14 + Math.random() * 10, life: 14, ph: Math.random() * 6 });
      if (PB.sfx) PB.sfx('pick');
    }
    function ate(f){
      f.happy = 1.2; st.eaten = (st.eaten || 0) + 1;
      if (st.eaten >= 4 && !st.fedThisTime) {
        st.fedThisTime = true; const c = care(), wasHungry = hunger() >= 0.3;
        S.lastFed = Date.now(); save(S);
        if (wasHungry && c.feeds < CARE.feeds) { c.feeds++; xp(CARE.feedXp, f.x, f.y - 20, 'Yum!'); }
        else pop(f.x, f.y - 20, 'Full and happy!', '#ffe14a');
      }
    }
    function tapFish(f){
      f.trick = 1; f.happy = 1; if (PB.sfx) PB.sfx(['yay', 'pick', 'woohoo'][Math.floor(Math.random() * 3)] || 'pick'); sparkle(f.x, f.y, '#ffffff', 10);
      for (let k = 0; k < 3; k++) st.bubbles.push({ x: f.x + (Math.random() - 0.5) * 10, y: f.y - 6, r: 3 + Math.random() * 3, vy: 40 + Math.random() * 30, heart: true });
      f.label = 2.5;
      const c = care(); if (c.tricks < CARE.tricks) { c.tricks++; xp(CARE.trickXp, f.x, f.y - 26); } else save(S);
    }
    function pearlSpots(){ return st.decor.filter(p => p.d.pearl); }
    const pearlReady = () => Date.now() >= S.pearl;
    function takePearl(p){
      const n = PEARL_COINS * p.d.pearl; if (PB.wallet) PB.wallet.add(n);
      S.pearl = Date.now() + PEARL_EVERY / (pearlSpots().length > 1 ? 1.5 : 1); save(S);
      if (PB.sfx) PB.sfx('coin'); sparkle(p.x, floorY() - 20, '#ffe14a', 16); pop(p.x, floorY() - 40, `+${n} coins!`, '#ffd23f', 1.4);
      xp(CARE.pearlXp);
    }
    function wipeAt(x, y){
      for (const o of algae()) if (Math.hypot(o.x - x, o.y - y) < o.r + 18) { st.wiped.add(o.i); sparkle(o.x, o.y, '#9cf0a0', 6); if (PB.sfx && Math.random() < 0.4) PB.sfx('step'); }
      if (st.wiped.size && !algae().length) {
        const c = care(), d = dirt(); S.lastClean = Date.now(); st.wiped = new Set();
        if (d >= 0.25 && !c.clean) { c.clean = true; xp(CARE.cleanXp, W / 2, box().y + 40, 'Sparkly clean!'); } else { save(S); pop(W / 2, box().y + 40, 'Sparkly clean!', '#9cf0ff'); }
        if (PB.sfx) PB.sfx('win');
      }
    }

    // ---------- the fish swim ----------
    function update(dt){
      st.t += dt; const a = swimArea(), fl = floorY();
      for (const f of st.fish) {
        f.ph += dt; f.trick = Math.max(0, f.trick - dt * 1.2); f.happy = Math.max(0, f.happy - dt * 0.6); f.label = Math.max(0, f.label - dt);
        const slow = hunger() > 0.7 ? 0.6 : 1, sp = f.sp;
        // food first: swim to the nearest flake
        let target = null, best = 1e9; for (const fd of st.food) { const d = Math.hypot(fd.x - f.x, fd.y - f.y); if (d < best && (!f.bottom || fd.y > fl - 30)) { best = d; target = fd; } }
        if (target) { f.tx = target.x; f.ty = f.bottom ? fl - 8 : target.y; if (best < 12) { target.life = 0; ate(f); } }
        else if (f.tx == null || Math.hypot(f.tx - f.x, f.ty - f.y) < 10 || Math.random() < dt * 0.15) { f.tx = a.x0 + Math.random() * (a.x1 - a.x0); f.ty = f.bottom ? fl - 8 : a.y0 + Math.random() * (a.y1 - a.y0); }
        const speed = (sp.shape === 'jelly' ? 14 : sp.shape === 'star' ? 4 : sp.shape === 'crab' ? 26 : sp.shape === 'turtle' || sp.shape === 'whale' || sp.shape === 'ray' ? 30 : 46) * slow * (target ? 1.8 : 1);
        const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy) || 1;
        f.vx += (dx / d * speed - f.vx) * Math.min(1, dt * 2); f.vy += (dy / d * speed * (sp.shape === 'jelly' ? 0.6 : 0.5) - f.vy) * Math.min(1, dt * 2);
        if (sp.shape === 'jelly') f.vy += Math.sin(st.t * 2.5 + f.ph) * 6 * dt * 10;
        f.x += f.vx * dt; f.y += f.vy * dt; f.x = Math.max(a.x0, Math.min(a.x1, f.x)); f.y = f.bottom ? fl - 8 : Math.max(a.y0, Math.min(a.y1, f.y));
        if (Math.abs(f.vx) > 4 && sp.shape !== 'star' && sp.shape !== 'crab' && sp.shape !== 'jelly' && sp.shape !== 'horse') f.dir = f.vx > 0 ? 1 : -1;
      }
      for (const fd of st.food) { fd.y += fd.vy * dt; fd.x += Math.sin(st.t * 2 + fd.ph) * 10 * dt; if (fd.y > fl - 4) { fd.y = fl - 4; fd.vy = 0; } fd.life -= dt; }
      st.food = st.food.filter(fd => fd.life > 0);
      if (!st.food.length) st.fedThisTime = false, st.eaten = 0;
      // bubbles from the bubble stone, the volcano, and now and then from the fish
      for (const p of st.decor) if ((p.d.id === 'bubbler' || p.d.id === 'volcano') && Math.random() < dt * 6) st.bubbles.push({ x: p.x + (Math.random() - 0.5) * 8, y: floorY() - (p.d.id === 'volcano' ? 60 * p.sc : 10), r: 2 + Math.random() * 4, vy: 50 + Math.random() * 40 });
      if (Math.random() < dt * 0.8 && st.fish.length) { const f = st.fish[Math.floor(Math.random() * st.fish.length)]; st.bubbles.push({ x: f.x + f.dir * 10, y: f.y - 4, r: 2 + Math.random() * 2, vy: 40 }); }
      const top = box().y + (box().round ? 50 : 6);
      for (const b of st.bubbles) { b.y -= b.vy * dt; b.x += Math.sin(st.t * 3 + b.y * 0.05) * 12 * dt; }
      st.bubbles = st.bubbles.filter(b => b.y > top);
      for (const q of st.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; q.life -= dt; } st.parts = st.parts.filter(q => q.life > 0);
      for (const q of st.pops) { q.y -= 26 * dt; q.life -= dt; } st.pops = st.pops.filter(q => q.life > 0);
      if (st.mode === 'feed' && (st.modeT -= dt) <= 0) st.mode = null;
    }

    // ---------- drawing ----------
    function room(){
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffe9c8'); g.addColorStop(1, '#f2c89a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 18, H);   // striped wallpaper
      const b = box(); ctx.fillStyle = '#8a5a34'; ctx.fillRect(10, b.y + b.h - 4, W - 20, H - b.y - b.h + 4); ctx.fillStyle = '#a8703f'; ctx.fillRect(10, b.y + b.h - 4, W - 20, 14);   // the stand
      ctx.fillStyle = '#7a4a26'; for (const dx of [W / 4, W * 3 / 4]) { ctx.beginPath(); ctx.arc(dx, b.y + b.h + 40, 5, 0, 7); ctx.fill(); }
    }
    function water(){
      const b = box(), wt = waterOf(S);
      ctx.save();
      // the glass shape
      ctx.beginPath(); if (b.round) { const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 10; ctx.ellipse(cx, cy, b.w / 2, b.h / 2 + 10, 0, -Math.PI / 2 + 0.45, Math.PI * 1.5 - 0.45); } else ctx.roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.save(); ctx.clip();
      const top = b.y + (b.round ? 50 : 6), q = ctx.createLinearGradient(0, top, 0, b.y + b.h); q.addColorStop(0, wt.top); q.addColorStop(1, wt.bot);
      ctx.fillStyle = 'rgba(220,240,255,.35)'; ctx.fillRect(b.x, b.y, b.w, top - b.y); ctx.fillStyle = q; ctx.fillRect(b.x, top, b.w, b.h);
      // light rays
      ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const x = b.x + 30 + k * b.w / 5 + Math.sin(st.t * 0.3 + k) * 10; ctx.fillStyle = `rgba(255,255,255,${wt.ray})`; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 28, top); ctx.lineTo(x + 70, b.floor); ctx.lineTo(x + 30, b.floor); ctx.closePath(); ctx.fill(); }
      if (wt.glow) for (let k = 0; k < 30; k++) { const x = b.x + ((k * 97 + st.t * 6) % b.w), y = top + ((k * 53) % (b.h - 60)); ctx.fillStyle = `rgba(80,255,240,${0.3 + 0.3 * Math.sin(st.t * 2 + k)})`; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = b.x; x <= b.x + b.w; x += 8) ctx.lineTo(x, top + Math.sin(x * 0.05 + st.t * 2) * 2); ctx.stroke();
      if (wt.ice) { ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const [x, w] of [[b.x + 30, 60], [b.x + b.w - 110, 80]]) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, top); ctx.lineTo(x + w * 0.7, top + 22); ctx.lineTo(x + w * 0.3, top + 16); ctx.closePath(); ctx.fill(); } }
      // twinkle lights along the top
      if (S.decor.includes('lights')) for (let x = b.x + 16, k = 0; x < b.x + b.w - 10; x += 24, k++) { const c = ['#ff5f8f', '#ffd400', '#5ee0ff', '#9cff5a'][k % 4], on = 0.5 + 0.5 * Math.sin(st.t * 3 + k); ctx.fillStyle = c; ctx.globalAlpha = 0.5 + 0.5 * on; ctx.beginPath(); ctx.arc(x, top + 12 + Math.sin(k) * 3, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      // back decorations, sand, front decorations, fish
      const fl = floorY();
      for (const p of st.decor) if (p.d.back && p.d.w) drawDecor(ctx, p.d.id, p.x, fl, p.sc, st.t);
      const sq = ctx.createLinearGradient(0, b.floor, 0, b.y + b.h); sq.addColorStop(0, wt.sand); sq.addColorStop(1, wt.sand2); ctx.fillStyle = sq;
      ctx.beginPath(); ctx.moveTo(b.x, b.floor + 8); for (let x = b.x; x <= b.x + b.w; x += 20) ctx.lineTo(x, b.floor + 6 + Math.sin(x * 0.07) * 5); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x, b.y + b.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.08)'; const R = mulberry(5); for (let k = 0; k < 40; k++) { ctx.beginPath(); ctx.arc(b.x + R() * b.w, b.floor + 14 + R() * (FLOOR_H - 14), 1.5 + R() * 2, 0, 7); ctx.fill(); }
      for (const p of st.decor) if (!p.d.back) drawDecor(ctx, p.d.id, p.x, fl, p.sc, st.t);
      // pearl in the clam
      if (pearlReady()) for (const p of pearlSpots()) { const s = p.d.id === 'bigclam' ? 1.5 : 1, x = p.x, y = fl - 10 * s * p.sc, gl = 0.6 + 0.4 * Math.sin(st.t * 3); const gq = ctx.createRadialGradient(x, y, 1, x, y, 20); gq.addColorStop(0, `rgba(255,250,230,${0.8 * gl})`); gq.addColorStop(1, 'rgba(255,250,230,0)'); ctx.fillStyle = gq; ctx.fillRect(x - 20, y - 20, 40, 40); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(x, y, 6 * s * p.sc, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 2, 0, 7); ctx.fill(); }
      // food flakes
      for (const fd of st.food) { ctx.fillStyle = '#c9732a'; ctx.beginPath(); ctx.ellipse(fd.x, fd.y, 3, 2, fd.ph, 0, 7); ctx.fill(); }
      // fish (sorted so the ones lower down are drawn on top)
      const order = st.fish.slice().sort((a, b2) => a.y - b2.y);
      for (const f of order) {
        const tr = f.trick, spin = tr > 0 ? Math.sin((1 - tr) * Math.PI) * 18 : 0, flip = tr > 0 ? Math.cos((1 - tr) * Math.PI * 2) : 1;
        ctx.save(); ctx.translate(f.x, f.y - spin); ctx.scale(flip >= 0 ? 1 : -1, 1);
        drawFish(ctx, f.sp, 0, 0, f.sp.s, f.dir, st.t + f.ph, f.happy > 0.3, 1);
        ctx.restore();
        if (hunger() > 0.6 && !st.food.length && Math.sin(st.t * 0.7 + f.ph) > 0.92) { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('\u{1F364}?', f.x + 16, f.y - 22); }
        if (f.label > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, f.label); ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; const w = ctx.measureText(f.name).width + 16; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(f.x - w / 2, f.y - f.sp.s * 1.6 - 24, w, 22, 11); ctx.fill(); ctx.fillStyle = '#1d3a6a'; ctx.fillText(f.name, f.x, f.y - f.sp.s * 1.6 - 8); ctx.restore(); }
      }
      // bubbles
      for (const bb of st.bubbles) { if (bb.heart) { ctx.font = `${bb.r * 3}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('❤️', bb.x, bb.y); continue; } ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bb.x, bb.y, bb.r, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(bb.x - bb.r * 0.3, bb.y - bb.r * 0.3, bb.r * 0.3, 0, 7); ctx.fill(); }
      // algae on the glass
      for (const o of algae()) { const q2 = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, o.r); q2.addColorStop(0, 'rgba(70,140,40,.7)'); q2.addColorStop(1, 'rgba(70,140,40,0)'); ctx.fillStyle = q2; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); }
      ctx.restore();
      // glass rim and shine
      ctx.lineWidth = b.round ? 6 : 8; ctx.strokeStyle = b.round ? 'rgba(200,235,255,.9)' : '#2a3a5a'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; if (b.round) { ctx.beginPath(); ctx.ellipse(b.x + 60, b.y + b.h / 2, 14, b.h / 3, 0.2, 0, 7); ctx.fill(); } else { ctx.fillRect(b.x + 14, b.y + 14, 10, b.h - 28); ctx.fillStyle = '#2a3a5a'; ctx.fillRect(b.x - 6, b.y - 10, b.w + 12, 12); }
      ctx.restore();
    }
    const BTNS = () => [
      { id: 'feed', x: 20, label: '\u{1F364}', sub: 'Feed', on: st.mode === 'feed' },
      { id: 'clean', x: 136, label: '\u{1F9FD}', sub: 'Clean', dot: dirt() >= 0.25 && !care().clean },
      { id: 'shop', x: 252, label: '\u{1F6D2}', sub: 'Pet Shop' },
      { id: 'info', x: 368, label: '⭐', sub: 'My Tank' },
    ];
    function hud(){
      const L = levelOf(S.xp), a = xpFor(L), b = xpFor(Math.min(MAX_LV, L + 1)), frac = L >= MAX_LV ? 1 : (S.xp - a) / (b - a);
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.shadowColor = 'rgba(120,70,20,.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.beginPath(); ctx.roundRect(14, 12, W - 28, 92, 20); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#1d3a6a'; ctx.font = `24px ${FONT}`; ctx.fillText(tankOf(S).name, 30, 44);
      ctx.font = `800 13px ${BODY}`; ctx.fillStyle = '#4a6a9a'; ctx.fillText(`${S.fish.length} of ${tankOf(S).fish} fish · ${S.decor.length} of ${tankOf(S).decor} decorations`, 30, 64);
      // level badge and XP bar
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(W - 56, 46, 26, 0, 7); ctx.fill(); ctx.strokeStyle = '#c98a00'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#5a3a00'; ctx.textAlign = 'center'; ctx.font = `11px ${FONT}`; ctx.fillText('LEVEL', W - 56, 38); ctx.font = `20px ${FONT}`; ctx.fillText(String(L), W - 56, 59);
      ctx.fillStyle = 'rgba(29,58,106,.15)'; ctx.beginPath(); ctx.roundRect(30, 76, W - 130, 14, 7); ctx.fill(); ctx.fillStyle = '#4cc96a'; ctx.beginPath(); ctx.roundRect(30, 76, Math.max(14, (W - 130) * frac), 14, 7); ctx.fill();
      ctx.fillStyle = '#1d3a6a'; ctx.font = `800 10px ${BODY}`; ctx.fillText(L >= MAX_LV ? 'TOP LEVEL!' : `${fmt(S.xp - a)} / ${fmt(b - a)} XP`, 30 + (W - 130) / 2, 87);
      // today's care checklist
      const c = care(), items = [[`\u{1F364} ${c.feeds}/${CARE.feeds}`, c.feeds >= CARE.feeds], [`\u{1F9FD} ${c.clean ? '✓' : dirt() < 0.25 ? 'clean' : '!'}`, c.clean || dirt() < 0.25], [`⭐ ${c.tricks}/${CARE.tricks}`, c.tricks >= CARE.tricks]];
      ctx.font = `800 12px ${BODY}`; let x = 30; for (const [tx, done] of items) { const w = ctx.measureText(tx).width + 14; ctx.fillStyle = done ? '#d8f8d8' : '#fff3d0'; ctx.beginPath(); ctx.roundRect(x, 110, w, 22, 11); ctx.fill(); ctx.fillStyle = done ? '#1f7a30' : '#8a5a00'; ctx.textAlign = 'left'; ctx.fillText(tx, x + 7, 125); x += w + 6; }
      ctx.restore();
    }
    function toolbar(){
      ctx.save();
      for (const bt of BTNS()) { const y = H - 72; ctx.fillStyle = bt.on ? '#ffd23f' : '#ffffff'; ctx.shadowColor = 'rgba(80,40,10,.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.beginPath(); ctx.roundRect(bt.x, y, 92, 60, 18); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.textAlign = 'center'; ctx.font = '24px sans-serif'; ctx.fillText(bt.label, bt.x + 46, y + 30); ctx.font = `800 12px ${BODY}`; ctx.fillStyle = '#1d3a6a'; ctx.fillText(bt.sub, bt.x + 46, y + 50);
        if (bt.dot) { ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.arc(bt.x + 84, y + 8, 7, 0, 7); ctx.fill(); } }
      ctx.restore();
    }
    function draw(){
      room(); water(); hud(); toolbar();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const q of st.parts) { ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 7); ctx.fill(); } ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const q of st.pops) { ctx.save(); ctx.globalAlpha = Math.min(1, q.life / q.max * 2); ctx.font = `20px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,40,80,.6)'; ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y); ctx.restore(); }
      if (st.tip) { ctx.save(); ctx.globalAlpha = Math.min(1, st.tip.t); ctx.font = `17px ${FONT}`; const w = Math.min(W - 30, ctx.measureText(st.tip.text).width + 30); ctx.fillStyle = 'rgba(29,58,106,.9)'; ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, H - 112, w, 34, 17); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(st.tip.text, W / 2, H - 95, W - 40); ctx.restore(); }
    }
    function tip(text, t){ st.tip = { text, t: t || 3 }; }

    // a short "welcome back" when you arrive
    function arrive(){
      const c = care(), msgs = [];
      if (!c.visit) { c.visit = true; xp(CARE.visitXp); msgs.push('Your fish missed you!'); }
      if (hunger() >= 0.3) msgs.push('The fish are hungry. Tap Feed!'); else if (dirt() >= 0.25 && !c.clean) msgs.push('The glass is dirty. Wipe it with your finger!'); else if (pearlReady()) msgs.push('A pearl is ready in the clam!');
      save(S); if (msgs.length) tip(msgs.join(' '), 4.5);
    }

    game = {
      id: 'tank', toy: true, sfxScore: false, music: 'tank', title: 'MY FISH TANK', W, H, statLabel: 'Tank level', scoreLabel: 'Coins', type: 'endless', maxLives: 0, noDaily: true,
      tile: { order: 10, name: 'My Fish Tank', kind: 'Grow your own aquarium', art: artTile, isNew: true },
      tileNote(){ const s = load(); return `Tank level ${levelOf(s.xp)} · ${s.fish.length} fish`; },
      controls: ['Tap Feed, then tap the water to drop food. Your fish will swim up for a snack!', 'When the glass gets green, wipe it with your finger.', 'Tap a fish to see a trick and learn its name.', 'Tap the shiny pearl in the clam for coins.', 'Caring for your tank every day earns XP. Level up to unlock new fish, decorations and bigger tanks in the Pet Shop!', 'Nothing bad ever happens to your fish, so you can visit whenever you like.'],
      init(){},
      preview(){ build(); },
      start(){ build(); st.mode = null; arrive(); },
      reload(kind, id){ build(); if (kind === 'fish') { const f = st.fish[st.fish.length - 1]; if (f) { f.label = 4; sparkle(f.x, f.y, '#ffe14a', 20); } if (PB.sfx) PB.sfx('yay'); } if (kind === 'tank' && PB.sfx) PB.sfx('fanfare'); },
      levelUp(L){ if (st) { pop(W / 2, box().y + 60, `Level ${L}!`, '#ffd23f', 2.2); for (let k = 0; k < 4; k++) sparkle(80 + k * 110, box().y + 100, ['#ffd23f', '#5ee0ff', '#ff5f8f', '#9cff5a'][k], 20); } },
      frame(dt){ if (st.tip) { st.tip.t -= dt; if (st.tip.t <= 0) st.tip = null; } update(dt); draw(); },
      hud(){ return { lives: null, stat: levelOf(S.xp), score: PB.wallet ? PB.wallet.get() : 0 }; },
      metrics(){ return { score: 0 }; },
      debug(){ return { st, S: () => S, update, box, algae, hunger, dirt, dropFood, wipeAt, tapFish: i => tapFish(st.fish[i]), takePearl, care, pearlSpots }; },
      pointerDown(x, y){
        st.down = { x, y };
        const bt = BTNS().find(b => x >= b.x && x <= b.x + 92 && y >= H - 72 && y <= H - 12);
        if (bt) {
          if (bt.id === 'feed') { st.mode = st.mode === 'feed' ? null : 'feed'; st.modeT = 12; if (st.mode) { tip('Tap the water to drop food!', 2.5); dropFood(swimArea().x0 + Math.random() * (swimArea().x1 - swimArea().x0)); } if (PB.sfx) PB.sfx('tap'); }
          if (bt.id === 'clean') { tip(algae().length ? 'Rub the green spots on the glass with your finger!' : 'The glass is already sparkly clean!', 3); if (PB.sfx) PB.sfx('tap'); }
          if (bt.id === 'shop' && PB.meta && PB.meta.openPetShop) PB.meta.openPetShop();
          if (bt.id === 'info' && PB.meta && PB.meta.openPetShop) PB.meta.openPetShop('mine');
          return;
        }
        const b = box(); if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return;
        // a pearl?
        if (pearlReady()) for (const p of pearlSpots()) if (Math.hypot(p.x - x, floorY() - 12 - y) < 30) { takePearl(p); return; }
        // a fish?
        let hit = null, best = 1e9; for (const f of st.fish) { const d = Math.hypot(f.x - x, f.y - y); if (d < f.sp.s * 1.8 + 12 && d < best) { best = d; hit = f; } }
        if (hit && st.mode !== 'feed') { tapFish(hit); return; }
        if (st.mode === 'feed') { dropFood(x); st.modeT = 12; return; }
        if (hit) { tapFish(hit); return; }
        wipeAt(x, y);
      },
      pointerMove(x, y){ if (st.down && st.mode !== 'feed') wipeAt(x, y); },
      pointerUp(){ st.down = null; },
      key(e){ if (e.key === 'f') dropFood(W / 2); },
    };
    return game;
  }
  function artTile(g){
    const q = g.createLinearGradient(0, 0, 0, 180); q.addColorStop(0, '#ffe9c8'); q.addColorStop(1, '#f2c89a'); g.fillStyle = q; g.fillRect(0, 0, 240, 180);
    g.save(); g.beginPath(); g.roundRect(24, 22, 192, 136, 10); g.clip();
    const w = g.createLinearGradient(0, 22, 0, 158); w.addColorStop(0, '#5ec8f2'); w.addColorStop(1, '#1462a8'); g.fillStyle = w; g.fillRect(24, 22, 192, 136);
    g.fillStyle = '#e8d29a'; g.fillRect(24, 138, 192, 20);
    drawDecor(g, 'castle', 170, 142, 0.55, 0); drawDecor(g, 'plant', 50, 142, 0.8, 0); drawDecor(g, 'clam', 110, 146, 0.6, 0);
    drawFish(g, FISH[0], 80, 70, 15, 1, 0.3, 0, 1); drawFish(g, FISH[3], 150, 95, 13, -1, 1.2, 0, 1); drawFish(g, FISH[4], 70, 112, 13, 1, 2, 0, 1);
    for (const [x, y, r] of [[120, 50, 3], [126, 40, 2], [118, 32, 2.5]]) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
    g.restore(); g.strokeStyle = '#2a3a5a'; g.lineWidth = 5; g.beginPath(); g.roundRect(24, 22, 192, 136, 10); g.stroke();
  }
  PB.register(createTank);
})();
