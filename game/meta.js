// Playbox extras that bring players back: Swag Shop, daily gift calendar, daily missions, trophies,
// weekly events and a "continue" card. Everything is stored on the device.
(function(){
  const { store, today, fmt, seedFrom, mulberry } = PB;
  const $ = id => document.getElementById(id);
  const coin = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc21a" stroke="#b77800" stroke-width="2"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#ffe27a" stroke-width="1.5"/></svg>';
  const NAME = { bricks: 'Brick Bash', dash: 'Zoom Dash', sweets: 'Gem Mine', potions: 'Potion Sort', cubes: 'Cube Escape', racer: 'Galaxy Racer', castle: 'Castle Crash', snake: 'Anaconda', dots: 'Dot Friends', tank: 'My Fish Tank' };
  const STK_COL = { bricks: '#ff3ddc', dash: '#ff9f1c', sweets: '#5ce1ff', potions: '#c77dff', cubes: '#3dffb5', racer: '#ff7a2f', castle: '#e0b43c', snake: '#7dd85a', dots: '#ff5fb8', tank: '#5ec8f2' };
  const dayNum = d => Math.floor(new Date(d + 'T12:00:00').getTime() / 86400000);

  // ---------------- Swag Shop ----------------
  // Every item shows up in its game. sw = colors for the little preview swatch.
  const SHOP = [
    { id: 'hat_cap',      game: 'dash',    slot: 'hat',    name: 'Baseball cap',     price: 400, sw: ['#2e6fb7', '#ffffff'] },
    { id: 'hat_party',    game: 'dash',    slot: 'hat',    name: 'Party hat',        price: 500, sw: ['#ff4f8b', '#ffd23f'] },
    { id: 'hat_crown',    game: 'dash',    slot: 'hat',    name: 'Gold crown',       price: 1000, sw: ['#ffd23f', '#e8a20f'] },
    { id: 'scarf_blue',   game: 'dash',    slot: 'scarf',  name: 'Blue scarf',       price: 250, sw: ['#3fa9ff', '#1f5fa8'] },
    { id: 'scarf_rainbow',game: 'dash',    slot: 'scarf',  name: 'Rainbow scarf',    price: 600, sw: ['#ff3d6e', '#ffd23f', '#3fa9ff'] },
    { id: 'ship_red',     game: 'racer',   slot: 'paint',  name: 'Red rocket paint', price: 500, sw: ['#ff3b3b', '#a01818'] },
    { id: 'ship_blue',    game: 'racer',   slot: 'paint',  name: 'Ice blue paint',   price: 500, sw: ['#5ec8ff', '#1f6fa8'] },
    { id: 'ship_gold',    game: 'racer',   slot: 'paint',  name: 'Gold paint',       price: 1250, sw: ['#ffd23f', '#c78a00'] },
    { id: 'sling_candy',  game: 'castle',  slot: 'sling',  name: 'Candy slingshot',  price: 600, sw: ['#ff5fa2', '#ffffff'] },
    { id: 'sling_gold',   game: 'castle',  slot: 'sling',  name: 'Golden slingshot', price: 1000, sw: ['#ffd23f', '#c78a00'] },
    { id: 'brew_pink',    game: 'potions', slot: 'brew',   name: 'Pink potion brew', price: 400, sw: ['#ff8fd0', '#d63a9a'] },
    { id: 'brew_blue',    game: 'potions', slot: 'brew',   name: 'Blue potion brew', price: 400, sw: ['#9ae6ff', '#2f86ff'] },
    { id: 'brew_gold',    game: 'potions', slot: 'brew',   name: 'Gold potion brew', price: 750, sw: ['#fff1a0', '#e8b21f'] },
    { id: 'skin_coral',   game: 'snake',   slot: 'skin',   name: 'Coral snake skin', price: 500, sw: ['#ff6a4a', '#ffd23f', '#1a1a1a'] },
    { id: 'skin_ocean',   game: 'snake',   slot: 'skin',   name: 'Ocean snake skin', price: 600, sw: ['#2f86ff', '#7fe0ff'] },
    { id: 'skin_gold',    game: 'snake',   slot: 'skin',   name: 'Golden snake skin',price: 1000, sw: ['#ffd23f', '#c78a00'] },
    { id: 'frame_candy',  game: 'sweets',  slot: 'frame',  name: 'Candy board frame',price: 500, sw: ['#ff8fc4', '#ffffff'] },
    { id: 'frame_ice',    game: 'sweets',  slot: 'frame',  name: 'Ice board frame',  price: 500, sw: ['#bfefff', '#5ec8ff'] },
    { id: 'paddle_lava',  game: 'bricks',  slot: 'paddle', name: 'Lava paddle',      price: 400, sw: ['#ff7a2a', '#ff3b3b'] },
    { id: 'paddle_neon',  game: 'bricks',  slot: 'paddle', name: 'Neon green paddle',price: 400, sw: ['#7dff6a', '#22e4ff'] },
    { id: 'box_gold',     game: 'cubes',   slot: 'box',    name: 'Gold puzzle box',  price: 500, sw: ['#ffd23f', '#8a5a10'] },
    { id: 'box_pink',     game: 'cubes',   slot: 'box',    name: 'Pink puzzle box',  price: 500, sw: ['#ff8fd0', '#7a2a6a'] },
    // big-ticket items: whole new ships, costumes and effects
    { id: 'model_saucer', game: 'racer',   slot: 'ship',   name: 'Flying saucer',    price: 1500, ic: '\u{1F6F8}', sw: ['#9fb4c8', '#5ec8ff'] },
    { id: 'model_rocket', game: 'racer',   slot: 'ship',   name: 'Retro rocket',     price: 1750, ic: '\u{1F680}', sw: ['#ffffff', '#ff3b3b'] },
    { id: 'model_shark',  game: 'racer',   slot: 'ship',   name: 'Space shark',      price: 2000, ic: '\u{1F988}', sw: ['#5f7fa8', '#d8e4f0'] },
    { id: 'fur_fox',      game: 'dash',    slot: 'fur',    name: 'Fox costume',      price: 1250, ic: '\u{1F98A}', sw: ['#ffa24a', '#ff6a1a'] },
    { id: 'fur_snow',     game: 'dash',    slot: 'fur',    name: 'Snow raccoon',     price: 1250, ic: '\u2744\uFE0F', sw: ['#eaf4ff', '#4a6aa8'] },
    { id: 'fur_gold',     game: 'dash',    slot: 'fur',    name: 'Golden raccoon',   price: 2250, ic: '\u2728', sw: ['#ffd23f', '#8a5a10'] },
    { id: 'trail_stars',  game: 'castle',  slot: 'trail',  name: 'Star trail',       price: 750, ic: '\u2B50', sw: ['#fff1a0', '#ffb81f'] },
    { id: 'trail_hearts', game: 'castle',  slot: 'trail',  name: 'Heart trail',      price: 750, ic: '\u{1F496}', sw: ['#ff8fc4', '#ff3d6e'] },
    { id: 'trail_rainbow',game: 'castle',  slot: 'trail',  name: 'Rainbow trail',    price: 1250, ic: '\u{1F308}', sw: ['#ff3d6e', '#ffd23f', '#7dff6a', '#3fa9ff'] },
    { id: 'magic_glow',   game: 'potions', slot: 'magic',  name: 'Potion sparkles',  price: 600, ic: '\u2728', sw: ['#d4ff9a', '#4fbf3a'] },
    { id: 'magic_stars',  game: 'potions', slot: 'magic',  name: 'Wizard stars',     price: 900, ic: '\u2B50', sw: ['#fff1a0', '#6a3ac0'] },
    { id: 'magic_rainbow',game: 'potions', slot: 'magic',  name: 'Rainbow magic',    price: 1250, ic: '\u{1F308}', sw: ['#ff3d6e', '#ffd23f', '#7dff6a', '#3fa9ff'] },
    { id: 'skin_candy',   game: 'snake',   slot: 'skin',   name: 'Candy snake skin', price: 900, sw: ['#ff9ccf', '#ffffff', '#7fe0ff'] },
    { id: 'skin_galaxy',  game: 'snake',   slot: 'skin',   name: 'Galaxy snake skin',price: 1250, ic: '\u{1F30C}', sw: ['#4a2a9a', '#ff8ff0'] },
    { id: 'shine_sparkle',game: 'sweets',  slot: 'shine',  name: 'Twinkle gems',     price: 750, ic: '\u2728', sw: ['#ffffff', '#ff5fa2'] },
    { id: 'shine_glow',   game: 'sweets',  slot: 'shine',  name: 'Glowing gems',     price: 1000, ic: '\u{1F48E}', sw: ['#9ae6ff', '#c76bff'] },
    { id: 'ball_pink',    game: 'bricks',  slot: 'ball',   name: 'Hot pink ball',    price: 400, sw: ['#ff5fbf', '#a0206a'] },
    { id: 'ball_gold',    game: 'bricks',  slot: 'ball',   name: 'Gold ball',        price: 750, sw: ['#ffd23f', '#c78a00'] },
    { id: 'ball_rainbow', game: 'bricks',  slot: 'ball',   name: 'Rainbow ball',     price: 1250, ic: '\u{1F308}', sw: ['#ff3d6e', '#ffd23f', '#7dff6a', '#3fa9ff'] },
    { id: 'cols_candy',   game: 'cubes',   slot: 'colors', name: 'Neon cubes',       price: 750, sw: ['#ff1f1f', '#00b4ff', '#3ce000', '#ffe600'] },
    { id: 'cols_jewel',   game: 'cubes',   slot: 'colors', name: 'Jewel cubes',      price: 1000, ic: '\u{1F48E}', sw: ['#00d0b0', '#ff2a72', '#ffc400', '#9a5aff'] },
  ];
  const owned = () => store.get('pb-owned') || [];
  // Gem Mine power-ups: these get used up, so you buy them in packs and they also come in gift boxes
  // Power-ups get used up, so you buy them in packs; they also come in gift boxes and level-map chests
  const BOOSTS = [
    { id: 'pickaxe',   game: 'sweets',  name: 'Pickaxe',        desc: 'Tap any gem to smash it',               ic: '\u26CF\uFE0F', price: 240, pack: 3, sw: ['#ffd23f', '#8a5a10'] },
    { id: 'moves5',    game: 'sweets',  name: '+5 Moves',       desc: 'Five extra moves, right now',           ic: '\u2795',       price: 300, pack: 3, sw: ['#7dff6a', '#1f9a3a'] },
    { id: 'dynamite',  game: 'sweets',  name: 'Dynamite Drop',  desc: 'Turns 3 gems into dynamite gems',       ic: '\u{1F9E8}',    price: 360, pack: 3, sw: ['#ff5a3a', '#a01818'] },
    { id: 'lightning', game: 'sweets',  name: 'Lightning Bolt', desc: 'Tap a gem to clear its row and column', ic: '\u26A1',       price: 400, pack: 3, sw: ['#9ae6ff', '#2f6fff'] },
    { id: 'flask',     game: 'potions', name: 'Extra Flask',    desc: 'An empty flask appears on the shelf',   ic: '\u{1F9EA}',    price: 300, pack: 3, sw: ['#d0f4ff', '#5a8ad8'] },
    { id: 'reveal',    game: 'potions', name: 'Magic Eye',      desc: 'Shows every hidden ? layer',            ic: '\u{1F441}\uFE0F', price: 240, pack: 3, sw: ['#e8c8ff', '#7a3ac0'] },
    { id: 'hammer',    game: 'cubes',   name: 'Hammer',         desc: 'Tap a cube to bonk it out',             ic: '\u{1F528}',    price: 300, pack: 3, sw: ['#ffd23f', '#a0602a'] },
    { id: 'time20',    game: 'cubes',   name: '+20 Seconds',    desc: 'Twenty more seconds on the clock',      ic: '\u23F1\uFE0F', price: 240, pack: 3, sw: ['#9fe8ff', '#2f86ff'] },
    { id: 'firepot',   game: 'castle',  name: 'Fire Pot',       desc: 'An extra exploding fire pot',           ic: '\u{1F525}',    price: 300, pack: 3, sw: ['#ffb347', '#d8401c'] },
    { id: 'boulder',   game: 'castle',  name: 'Iron Ball',      desc: 'An extra heavy iron ball for stone walls', ic: '\u26AB',    price: 300, pack: 3, sw: ['#9aa0ac', '#2e3138'] },
    { id: 'r_turbo',   game: 'racer',   name: 'Turbo',          desc: 'Blast ahead and smash through rocks',   ic: '\u{1F525}',    price: 300, pack: 3, sw: ['#ffb347', '#d8401c'] },
    { id: 'r_shield',  game: 'racer',   name: 'Force Field',    desc: 'Bounces you off one crash',             ic: '\u{1F6E1}\uFE0F', price: 300, pack: 3, sw: ['#9ae6ff', '#2f6fff'] },
    { id: 'r_blaster', game: 'racer',   name: 'Blasters',       desc: 'Lasers that break asteroids',           ic: '\u{1F4A5}',    price: 360, pack: 3, sw: ['#ff8fa0', '#c0203a'] },
    { id: 'r_heart',   game: 'racer',   name: 'Extra Heart',    desc: 'One more heart, right now',             ic: '\u2764\uFE0F', price: 240, pack: 3, sw: ['#ff8fc4', '#d01f5a'] },
  ];
  const boostAll = () => store.get('pb-boosts') || {};
  const boostCount = id => boostAll()[id] || 0;
  function addBoost(id, n){ const b = boostAll(); b[id] = (b[id] || 0) + n; store.set('pb-boosts', b); }
  function useBoost(id){ const b = boostAll(); if (!(b[id] > 0)) return false; b[id]--; store.set('pb-boosts', b); return true; }
  function randomBoost(game){ const L = game ? BOOSTS.filter(b => b.game === game) : BOOSTS; const P = L.length ? L : BOOSTS; return P[Math.floor(Math.random() * P.length)]; }
  const boostsFor = game => BOOSTS.filter(b => b.game === game);
  function buyBoost(it){
    if (!PB.wallet.spend(it.price)) { banner('Not enough coins yet. Keep playing!', false); return false; }
    addBoost(it.id, it.pack); if (PB.sfx) PB.sfx('power'); banner(`${it.ic} +${it.pack} ${it.name}!`, true); return true;
  }
  const equippedAll = () => store.get('pb-equip') || {};
  // what a game should draw: the equipped item id for a slot, or null for the normal look
  function look(game, slot){ const e = equippedAll()[game + '.' + slot]; return e && owned().includes(e) ? e : null; }
  function buy(it){
    if (owned().includes(it.id)) return equip(it);
    if (!PB.wallet.spend(it.price)) { banner('Not enough coins yet. Keep playing!', false); return false; }
    store.set('pb-owned', [...owned(), it.id]); equip(it);
    if (PB.sfx) PB.sfx('win'); banner(`${it.name} is yours!`, true); checkTrophies(); return true;
  }
  function equip(it){ const e = equippedAll(), k = it.game + '.' + it.slot; e[k] = e[k] === it.id ? null : it.id; store.set('pb-equip', e); if (PB.sfx) PB.sfx('pick'); render(); return true; }

  // ---------------- weekly events ----------------
  const EVENTS = [
    { id: 'double',  name: 'Double Coin Week',   icon: '\u{1FA99}', desc: 'Every game pays double coins this week!', mult: () => 2 },
    { id: 'speed',   name: 'Need for Speed Week', icon: '\u{1F680}', desc: 'Triple coins in Zoom Dash and Galaxy Racer.', mult: g => (g === 'dash' || g === 'racer') ? 3 : 1 },
    { id: 'puzzle',  name: 'Puzzle Power Week',   icon: '\u{1F9E9}', desc: 'Triple coins in Potion Sort, Gem Mine and Cube Escape.', mult: g => ['potions', 'sweets', 'cubes'].includes(g) ? 3 : 1 },
    { id: 'siege',   name: 'Siege Week',          icon: '\u{1F3F0}', desc: 'Triple coins in Castle Crash, Brick Bash and Anaconda.', mult: g => ['castle', 'bricks', 'snake'].includes(g) ? 3 : 1 },
    { id: 'mission', name: 'Mission Mania',       icon: '\u{1F3AF}', desc: 'Daily missions pay double coins this week.', mult: () => 1, missions: 2 },
  ];
  const SPOOKY = { id: 'spooky', name: 'Spooky Week', icon: '\u{1F383}', desc: 'Double coins everywhere, and Potion Sort is full of witches and black cats!', mult: () => 2 };
  const WINTER = { id: 'winter', name: 'Snow Days', icon: '❄️', desc: 'Double coins in every game for the holidays!', mult: () => 2 };
  function event(){
    const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    if ((m === 10 && day >= 18) || (m === 11 && day <= 2)) return SPOOKY;
    if (m === 12 && day >= 18 || m === 1 && day <= 2) return WINTER;
    const wk = Math.floor((dayNum(today()) + 3) / 7);
    return EVENTS[wk % EVENTS.length];
  }
  const coinMult = game => event().mult(game) || 1;

  // ---------------- stats (for trophies) ----------------
  const stats = () => store.get('pb-stats') || { plays: {}, goblins: 0, wins: {}, best: {}, missionDays: 0, chests: 0 };
  const saveStats = s => store.set('pb-stats', s);

  // ---------------- daily missions ----------------
  const MISSIONS = [
    { id: 'plays',   game: null,      text: 'Play {n} different games',            n: [3],             add: (i, m) => { m.seen = m.seen || []; if (!m.seen.includes(i.g)) m.seen.push(i.g); return m.seen.length - m.prog; } },
    { id: 'stars',   game: null,      text: 'Earn {n} level stars',                n: [3, 5, 6],       add: i => i.win ? i.stars || 0 : 0 },
    { id: 'dashm',   game: 'dash',    text: 'Run {n} m in Zoom Dash',              n: [500, 800, 1200], add: i => i.m.dist || 0 },
    { id: 'dashc',   game: 'dash',    text: 'Grab {n} coins in Zoom Dash',         n: [60, 100, 150],  add: i => i.m.coins || 0 },
    { id: 'gob',     game: 'castle',  text: 'Bonk {n} goblins in Castle Crash',    n: [3, 5, 8],       add: i => i.m.goblins || 0 },
    { id: 'potw',    game: 'potions', text: 'Brew {n} Potion Sort levels',         n: [1, 2, 3],       add: i => i.win ? 1 : 0 },
    { id: 'race',    game: 'racer',   text: 'Win {n} Galaxy Racer races',          n: [1, 2],          add: i => i.win ? 1 : 0 },
    { id: 'gemw',    game: 'sweets',  text: 'Clear {n} Gem Mine levels',           n: [1, 2, 3],       add: i => i.win ? 1 : 0 },
    { id: 'gems',    game: 'sweets',  text: 'Mine {n} gems in Gem Mine',           n: [80, 150],       add: i => i.m.gems || 0 },
    { id: 'cube',    game: 'cubes',   text: 'Beat {n} Cube Escape levels',         n: [1, 2, 3],       add: i => i.win ? 1 : 0 },
    { id: 'fruit',   game: 'snake',   text: 'Eat {n} fruit in Anaconda',           n: [20, 35, 50],    add: i => i.m.eaten || 0 },
    { id: 'dotw',    game: 'dots',    text: 'Solve {n} Dot Friends puzzles',       n: [1, 2, 3],       add: i => i.win ? 1 : 0 },
    { id: 'brick',   game: 'bricks',  text: 'Beat {n} Brick Bash levels',          n: [1, 2, 3],       add: i => i.win ? 1 : 0 },
  ];
  const MISSION_COINS = 15, MISSION_BONUS = 30;
  function missions(){
    let M = store.get('pb-missions');
    if (!M || M.date !== today()) {
      const R = mulberry(seedFrom('missions-' + today())), pool = MISSIONS.slice(), list = [];
      while (list.length < 3 && pool.length) { const t = pool.splice(Math.floor(R() * pool.length), 1)[0]; if (list.some(x => (x.game && x.game === t.game) || (!x.game && !t.game))) continue; list.push({ id: t.id, goal: t.n[Math.floor(R() * t.n.length)], prog: 0, done: false }); }
      M = { date: today(), list, bonus: false }; store.set('pb-missions', M);
    }
    return M;
  }
  const missionTpl = id => MISSIONS.find(t => t.id === id);
  const missionText = m => missionTpl(m.id).text.replace('{n}', fmt(m.goal));
  function updateMissions(info){
    const M = missions(), mult = event().missions || 1; let changed = false;
    for (const m of M.list) {
      if (m.done) continue; const t = missionTpl(m.id); if (t.game && t.game !== info.g) continue;
      const before = m.prog;
      if (t.max) m.prog = Math.max(m.prog, t.max(info)); else m.prog += Math.max(0, t.add(info, m));
      m.prog = Math.min(m.goal, m.prog);
      if (m.prog !== before) changed = true;
      if (m.prog >= m.goal) { m.done = true; PB.wallet.add(MISSION_COINS * mult); later(`Mission done! +${MISSION_COINS * mult} coins`); }
    }
    if (!M.bonus && M.list.every(m => m.done)) { M.bonus = true; PB.wallet.add(MISSION_BONUS * mult); const s = stats(); s.missionDays = (s.missionDays || 0) + 1; saveStats(s); later(`All missions done! Bonus +${MISSION_BONUS * mult} coins`); }
    if (changed) store.set('pb-missions', M);
  }

  // ---------------- daily gift calendar ----------------
  const GIFTS = [10, 15, 20, 25, 30, 40, 'chest'];
  function giftState(){
    const g = store.get('pb-gift') || { day: 0, last: null };
    const t = dayNum(today()), l = g.last ? dayNum(g.last) : null;
    const claimed = l === t;
    // missing a day starts the week over (no punishment beyond that)
    const next = claimed ? g.day : (l != null && t - l === 1 ? g.day % 7 + 1 : 1);
    return { day: claimed ? g.day : next, claimed };
  }
  function claimGift(){
    const s = giftState(); if (s.claimed) return;
    const r = GIFTS[s.day - 1]; let msg;
    if (r === 'chest') {
      const coins = 40; PB.wallet.add(coins);
      const cheap = SHOP.filter(it => !owned().includes(it.id) && it.price <= 650);
      if (cheap.length) { const it = cheap[Math.floor(Math.random() * cheap.length)]; store.set('pb-owned', [...owned(), it.id]); msg = `Treasure chest! +${coins} coins and a free ${it.name}!`; }
      else msg = `Treasure chest! +${coins} coins`;
      const st = stats(); st.chests = (st.chests || 0) + 1; saveStats(st);
    } else { PB.wallet.add(r); msg = `Daily gift: +${r} coins!`; }
    const gifts = r === 'chest' ? 2 : (s.day === 3 || s.day === 5) ? 1 : 0;
    for (let i=0;i<gifts;i++) { const bz = randomBoost(); addBoost(bz.id, 1); msg += ` ${bz.ic} Free ${NAME[bz.game]} ${bz.name}!`; }
    store.set('pb-gift', { day: s.day, last: today() });
    if (PB.sfx) PB.sfx('life'); banner(msg, true); checkTrophies(); render(); openModal('gift');
  }

  // ---------------- trophies ----------------
  const prog = id => store.get(id + '-progress') || {};
  const levelWins = id => Math.max(0, (prog(id).unlocked || 1) - 1);
  const starsAll = () => ['castle', 'potions', 'racer', 'sweets', 'cubes'].reduce((a, id) => a + Object.values(prog(id).stars || {}).reduce((x, y) => x + y, 0), 0);
  const bestOf = id => (PB.bestOf && PB.bestOf(id)) || 0;
  const streak = () => { const s = store.get('pb-streak') || {}; return Math.max(s.best || 0, s.count || 0); };
  const TROPHIES = [
    { id: 'first',    icon: '\u{1F3AE}', name: 'Let’s play!',      desc: 'Play your first game',                test: s => Object.keys(s.plays).length >= 1 },
    { id: 'explorer', icon: '\u{1F308}', name: 'Game explorer',          desc: 'Play every game',                      test: s => Object.keys(s.plays).length >= Object.keys(PB.games || {}).length },
    { id: 'streak3',  icon: '\u{1F525}', name: 'On fire',                desc: 'Play 3 days in a row',                 test: () => streak() >= 3 },
    { id: 'streak7',  icon: '\u{1F4C5}', name: 'Week warrior',           desc: 'Play 7 days in a row',                 test: () => streak() >= 7 },
    { id: 'streak30', icon: '\u{1F3C5}', name: 'Superfan',               desc: 'Play 30 days in a row',                test: () => streak() >= 30 },
    { id: 'coins1k',  icon: '\u{1FA99}', name: 'Coin collector',         desc: 'Earn 1,000 coins',                     test: () => (store.get('pb-coins-earned') || 0) >= 1000 },
    { id: 'coins5k',  icon: '\u{1F4B0}', name: 'Treasure hoard',         desc: 'Earn 5,000 coins',                     test: () => (store.get('pb-coins-earned') || 0) >= 5000 },
    { id: 'shop1',    icon: '\u{1F6CD}️', name: 'First buy',        desc: 'Get something from the Swag Shop',     test: () => owned().length >= 1 },
    { id: 'shop5',    icon: '\u{1F451}', name: 'Show-off',               desc: 'Own 5 Swag Shop items',                test: () => owned().length >= 5 },
    { id: 'mission1', icon: '✅',    name: 'Mission complete',       desc: 'Finish all 3 daily missions in a day', test: s => (s.missionDays || 0) >= 1 },
    { id: 'mission5', icon: '\u{1F3AF}', name: 'Mission master',         desc: 'Finish all daily missions on 5 days',  test: s => (s.missionDays || 0) >= 5 },
    { id: 'chest',    icon: '\u{1F381}', name: 'Treasure hunter',        desc: 'Open a treasure chest',          test: s => (s.chests || 0) >= 1 },
    { id: 'dash1k',   icon: '\u{1F99D}', name: 'Long runner',            desc: 'Run 1,000 m in Zoom Dash',             test: () => bestOf('dash') >= 1000 },
    { id: 'dashcity', icon: '\u{1F3D9}️', name: 'Big City',         desc: 'Run all the way to the Big City',      test: s => (s.best.dashDist || 0) >= 1350 },
    { id: 'castle10', icon: '\u{1F3F0}', name: 'Siege master',           desc: 'Beat Castle Crash level 10',           test: () => levelWins('castle') >= 10 },
    { id: 'gob50',    icon: '\u{1FA96}', name: 'Goblin bonker',          desc: 'Bonk 50 goblins',                      test: s => (s.goblins || 0) >= 50 },
    { id: 'pot10',    icon: '\u{1F9EA}', name: 'Apprentice',             desc: 'Beat Potion Sort level 10',            test: () => levelWins('potions') >= 10 },
    { id: 'pot30',    icon: '\u{1F9D9}', name: 'Grand wizard',           desc: 'Beat Potion Sort level 30',            test: () => levelWins('potions') >= 30 },
    { id: 'gem10',    icon: '\u{1F48E}', name: 'Gem hunter',             desc: 'Beat Gem Mine level 10',               test: () => levelWins('sweets') >= 10 },
    { id: 'race10',   icon: '\u{1F680}', name: 'Star pilot',             desc: 'Win 10 Galaxy Racer races',            test: () => levelWins('racer') >= 10 },
    { id: 'cube8',    icon: '\u{1F9CA}', name: 'Puzzle box pro',         desc: 'Beat Cube Escape level 8',             test: s => levelWins('cubes') >= 8 || (s.best.cubeLevel || 0) >= 8 },
    { id: 'snake50',  icon: '\u{1F40D}', name: 'Mega anaconda',          desc: 'Grow Anaconda to 50 long',             test: s => (s.best.snakeLen || 0) >= 50 },
    { id: 'brick10k', icon: '\u{1F9F1}', name: 'Brick smasher',          desc: 'Beat Brick Bash level 20',             test: () => levelWins('bricks') >= 20 || bestOf('bricks') >= 10000 },
    { id: 'stars50',  icon: '⭐',    name: 'Star collector',         desc: 'Collect 50 level stars',               test: () => starsAll() >= 50 },
  ];
  const TROPHY_COINS = 20;
  const earned = () => store.get('pb-trophies') || [];
  function checkTrophies(){
    const s = stats(), have = earned(), add = [];
    for (const t of TROPHIES) if (!have.includes(t.id)) { try { if (t.test(s)) add.push(t); } catch (e) {} }
    if (!add.length) return;
    store.set('pb-trophies', [...have, ...add.map(t => t.id)]);
    for (const t of add) { PB.wallet.add(TROPHY_COINS); later(`${t.icon} Trophy: ${t.name}! +${TROPHY_COINS} coins`); }
    if (PB.sfx) PB.sfx('fanfare');
    render();
  }

  // ---------------- sticker album: 3 stickers to collect in every game ----------------
  const len = () => stats().best.snakeLen || 0, dist = () => stats().best.dashDist || 0;
  const STICKERS = [
    { id: 'st_brick1', game: 'bricks',  e: '\u{1F9F1}', name: 'Brick Buster',   desc: 'Beat Brick Bash level 5',       test: () => levelWins('bricks') >= 5 || bestOf('bricks') >= 2000 },
    { id: 'st_brick2', game: 'bricks',  e: '\u{1F3D3}', name: 'Paddle Pro',     desc: 'Beat Brick Bash level 25',      test: () => levelWins('bricks') >= 25 || bestOf('bricks') >= 6000 },
    { id: 'st_brick3', game: 'bricks',  e: '\u{1F308}', name: 'Rainbow Smash',  desc: 'Beat Brick Bash level 60',      test: () => levelWins('bricks') >= 60 || bestOf('bricks') >= 15000 },
    { id: 'st_dots1',  game: 'dots',    e: '\u{1F534}', name: 'Dot Dabber',     desc: 'Solve Dot Friends level 5',     test: () => levelWins('dots') >= 5 },
    { id: 'st_dots2',  game: 'dots',    e: '\u{1F58D}\uFE0F', name: 'Line Artist', desc: 'Solve Dot Friends level 25', test: () => levelWins('dots') >= 25 },
    { id: 'st_dots3',  game: 'dots',    e: '\u{1F308}', name: 'Rainbow Master', desc: 'Solve Dot Friends level 75',    test: () => levelWins('dots') >= 75 },
    { id: 'st_tank1',  game: 'tank',    e: '\u{1F41F}', name: 'Fish Friend',    desc: 'Reach tank level 3',            test: () => PB.tank && PB.tank.level() >= 3 },
    { id: 'st_tank2',  game: 'tank',    e: '\u{1F420}', name: 'Reef Keeper',    desc: 'Reach tank level 10',           test: () => PB.tank && PB.tank.level() >= 10 },
    { id: 'st_tank3',  game: 'tank',    e: '\u{1F433}', name: 'Ocean Master',   desc: 'Reach tank level 25',           test: () => PB.tank && PB.tank.level() >= 25 },
    { id: 'st_dash1',  game: 'dash',    e: '\u{1F99D}', name: 'Little Runner',  desc: 'Run 300 m in Zoom Dash',        test: () => dist() >= 300 },
    { id: 'st_dash2',  game: 'dash',    e: '\u{1F68C}', name: 'Bus Hopper',     desc: 'Run 800 m in Zoom Dash',        test: () => dist() >= 800 },
    { id: 'st_dash3',  game: 'dash',    e: '\u{1F306}', name: 'City Lights',    desc: 'Reach the Big City in Zoom Dash', test: () => dist() >= 1350 },
    { id: 'st_gem1',   game: 'sweets',  e: '\u{1F48E}', name: 'Shiny Start',    desc: 'Beat Gem Mine level 5',         test: () => levelWins('sweets') >= 5 },
    { id: 'st_gem2',   game: 'sweets',  e: '\u{1F451}', name: 'Gem Royalty',    desc: 'Beat Gem Mine level 25',        test: () => levelWins('sweets') >= 25 },
    { id: 'st_gem3',   game: 'sweets',  e: '\u{1F31F}', name: 'Superstar Miner',desc: 'Beat Gem Mine level 60',        test: () => levelWins('sweets') >= 60 },
    { id: 'st_pot1',   game: 'potions', e: '\u{1F9EA}', name: 'First Brew',     desc: 'Beat Potion Sort level 5',      test: () => levelWins('potions') >= 5 },
    { id: 'st_pot2',   game: 'potions', e: '\u{1F9D9}', name: 'Wizard Pal',     desc: 'Beat Potion Sort level 25',     test: () => levelWins('potions') >= 25 },
    { id: 'st_pot3',   game: 'potions', e: '\u{1F52E}', name: 'Crystal Ball',   desc: 'Beat Potion Sort level 60',     test: () => levelWins('potions') >= 60 },
    { id: 'st_cube1',  game: 'cubes',   e: '\u{1F9CA}', name: 'Jelly Friend',   desc: 'Beat Cube Escape level 5',      test: () => levelWins('cubes') >= 5 },
    { id: 'st_cube2',  game: 'cubes',   e: '\u{1F3B2}', name: 'Puzzle Whiz',    desc: 'Beat Cube Escape level 25',     test: () => levelWins('cubes') >= 25 },
    { id: 'st_cube3',  game: 'cubes',   e: '\u{1FA84}', name: 'Escape Artist',  desc: 'Beat Cube Escape level 60',     test: () => levelWins('cubes') >= 60 },
    { id: 'st_race1',  game: 'racer',   e: '\u{1F680}', name: 'Blast Off',      desc: 'Win 3 Galaxy Racer races',      test: () => levelWins('racer') >= 3 },
    { id: 'st_race2',  game: 'racer',   e: '\u{1FA90}', name: 'Ringed Planet',  desc: 'Win 15 Galaxy Racer races',     test: () => levelWins('racer') >= 15 },
    { id: 'st_race3',  game: 'racer',   e: '\u{1F30C}', name: 'Galaxy Champ',   desc: 'Win 40 Galaxy Racer races',     test: () => levelWins('racer') >= 40 },
    { id: 'st_cas1',   game: 'castle',  e: '\u{1F3F0}', name: 'Castle Crasher', desc: 'Beat Castle Crash level 5',     test: () => levelWins('castle') >= 5 },
    { id: 'st_cas2',   game: 'castle',  e: '\u{1F47A}', name: 'Goblin Bonker',  desc: 'Bonk 100 goblins',              test: s => (s.goblins || 0) >= 100 },
    { id: 'st_cas3',   game: 'castle',  e: '\u{1F409}', name: 'Dragon Knight',  desc: 'Beat Castle Crash level 40',    test: () => levelWins('castle') >= 40 },
    { id: 'st_snk1',   game: 'snake',   e: '\u{1F40D}', name: 'Wiggly',         desc: 'Grow Anaconda to 15 long',      test: () => len() >= 15 },
    { id: 'st_snk2',   game: 'snake',   e: '\u{1F34E}', name: 'Fruit Feast',    desc: 'Grow Anaconda to 30 long',      test: () => len() >= 30 },
    { id: 'st_snk3',   game: 'snake',   e: '\u{1F995}', name: 'Dino Snake',     desc: 'Grow Anaconda to 60 long',      test: () => len() >= 60 },
  ];
  const stickers = () => store.get('pb-stickers') || [];
  function checkStickers(){
    const s = stats(), have = stickers(), add = [];
    for (const t of STICKERS) if (!have.includes(t.id)) { try { if (t.test(s)) add.push(t); } catch (e) {} }
    if (!add.length) return;
    store.set('pb-stickers', [...have, ...add.map(t => t.id)]);
    store.set('pb-stickers-new', [...(store.get('pb-stickers-new') || []), ...add.map(t => t.id)]);
    for (const t of add) later(`${t.e} New sticker: ${t.name}! Check your album`);
    render();
  }

  // ---------------- level map chests ----------------
  function openChest(game){
    const coins = 30, bz = randomBoost(game); PB.wallet.add(coins); addBoost(bz.id, 1);
    const st = stats(); st.chests = (st.chests || 0) + 1; saveStats(st);
    if (PB.sfx) PB.sfx('fanfare'); banner(`\u{1F381} Treasure chest! +${coins} coins and a free ${bz.name} ${bz.ic}`, true); checkTrophies(); render();
  }

  // ---------------- run tracking (called by the shell) ----------------
  function onPlay(g, mode, level){
    store.set('pb-last-play', { g, mode: mode === 'daily' ? 'classic' : mode, level: typeof level === 'number' ? level : null, at: today() });
    const s = stats(); s.plays[g] = (s.plays[g] || 0) + 1; saveStats(s);
    checkTrophies();
  }
  function onRun(info){
    info.m = info.m || {};
    const s = stats();
    if (info.g === 'castle') s.goblins = (s.goblins || 0) + (info.m.goblins || 0);
    if (info.g === 'dash') s.best.dashDist = Math.max(s.best.dashDist || 0, info.m.dist || 0);
    if (info.g === 'cubes') s.best.cubeLevel = Math.max(s.best.cubeLevel || 0, info.m.level || 0);
    if (info.g === 'snake') s.best.snakeLen = Math.max(s.best.snakeLen || 0, info.m.length || 0);
    saveStats(s);
    updateMissions(info);
    checkTrophies(); checkStickers();
  }

  // ---------------- messages ----------------
  let queue = [], qT = null;
  function later(text){ queue.push(text); if (!qT) flush(); }
  function flush(){ if (!queue.length) { qT = null; return; } banner(queue.shift(), true); qT = setTimeout(flush, 2300); }
  function banner(text, good){
    let b = $('metaBanner'); if (!b) { b = document.createElement('div'); b.id = 'metaBanner'; document.body.appendChild(b); }
    b.className = good ? 'good' : 'meh'; b.innerHTML = (good ? coin : '') + '<span></span>'; b.querySelector('span').textContent = text;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 2200);
  }

  // ---------------- hub UI ----------------
  function render(){
    const top = $('metaTop'); if (!top) return;
    // continue card
    const lp = store.get('pb-last-play'), cont = $('metaCont');
    if (lp && PB.games && PB.games[lp.g]) {
      const g = PB.games[lp.g], lv = g.type === 'levels' ? Math.min(prog(lp.g).unlocked || 1, g.levels) : null;
      cont.hidden = false; cont.innerHTML = `<span class="ci">▶</span><span class="ct"><small>CONTINUE</small><b></b><span></span></span><span class="cgo">GO</span>`;
      cont.querySelector('b').textContent = NAME[lp.g] || g.tile.name;
      cont.querySelector('.ct span').textContent = lv ? `Level ${lv}` : (bestOf(lp.g) ? `Best ${fmt(bestOf(lp.g))}${g.scoreUnit || ''}` : 'Play again');
      cont.onclick = () => PB.openAndStart(lp.g, lv);
    } else cont.hidden = true;
    // weekly event
    const ev = event(); $('metaEvent').innerHTML = `<span class="ei">${ev.icon}</span><span class="et"><small>THIS WEEK</small><b></b><span></span></span>`;
    $('metaEvent').querySelector('b').textContent = ev.name; $('metaEvent').querySelector('.et span').textContent = ev.desc;
    // buttons with little badges
    const gs = giftState(), plus = hasPlus();
    $('btnGift').querySelector('.dot').hidden = gs.claimed || !plus;
    $('btnGift').classList.toggle('locked', !plus); $('btnShop').classList.toggle('locked', !plus);
    $('btnTrophy').querySelector('.n').textContent = `${earned().length}/${TROPHIES.length}`;
    $('btnShop').querySelector('.n').textContent = `${owned().length}/${SHOP.length}`;
    if ($('btnStickers')) { $('btnStickers').querySelector('.n').textContent = `${stickers().length}/${STICKERS.length}`; $('btnStickers').querySelector('.dot').hidden = !(store.get('pb-stickers-new') || []).length; }
    // missions
    const M = missions(), list = $('misList'); list.innerHTML = '';
    const mult = ev.missions || 1;
    for (const m of M.list) {
      const t = missionTpl(m.id), b = document.createElement('button'); b.className = 'chal mis' + (m.done ? ' done' : '');
      b.innerHTML = `<span class="ck" aria-hidden="true">${m.done ? '✓' : ''}</span><span class="tx"><b></b><span></span><i class="bar"><i style="width:${Math.round(m.prog / m.goal * 100)}%"></i></i></span><span class="rw">${m.done ? 'Done' : coin + '+' + MISSION_COINS * mult}</span>`;
      b.querySelector('b').textContent = t.game ? NAME[t.game] : 'Any game'; b.querySelector('.tx span').textContent = `${missionText(m)} (${fmt(m.prog)}/${fmt(m.goal)})`;
      if (t.game) b.addEventListener('click', () => PB.openAndStart(t.game)); else b.disabled = true;
      list.appendChild(b);
    }
    $('misCount').textContent = M.bonus ? 'All done! ✓' : `Finish all 3 for +${MISSION_BONUS * mult} bonus`;
  }
  // the Swag Shop and the daily gift are part of Playbox Plus
  const hasPlus = () => !PB.plus || PB.plus.on();
  function openModal(kind){
    const m = $('metaModal'), body = $('mmBody'); m.hidden = false; body.innerHTML = '';
    const h = document.createElement('h3'); body.appendChild(h);
    if (kind === 'hangar') { hangarSection(body, h); return; }
    if ((kind === 'gift' || kind === 'shop') && !hasPlus()) {
      h.textContent = kind === 'gift' ? 'Daily gift' : 'Swag Shop';
      const box = document.createElement('div'); box.className = 'mmlock';
      box.innerHTML = `<span class="ml">${kind === 'gift' ? '\u{1F381}' : '\u{1F6CD}\uFE0F'}</span><p class="mmsub"></p>`;
      box.querySelector('p').textContent = kind === 'gift'
        ? 'Playbox Plus members get a present every day: coins, free power-ups and a treasure chest on day 7!'
        : `Spend your ${fmt(PB.wallet.get())} coins on fun outfits, ships, colors and power-ups. The Swag Shop is part of Playbox Plus.`;
      const b = document.createElement('button'); b.className = 'mmbtn'; b.textContent = '\u2605 See Playbox Plus';
      b.onclick = () => { closeModal(); if (PB.openPlus) PB.openPlus(); };
      box.appendChild(b); body.appendChild(box);
      return;
    }
    if (kind === 'gift') {
      const gs = giftState(); h.textContent = 'Daily gift';
      const p = document.createElement('p'); p.className = 'mmsub'; p.textContent = gs.claimed ? 'Come back tomorrow for the next gift!' : 'A present every day you play. Days 3 and 5 add a free power-up, and day 7 is a treasure chest!'; body.appendChild(p);
      const row = document.createElement('div'); row.className = 'gifts';
      GIFTS.forEach((r, i) => { const d = i + 1, got = d < gs.day || (d === gs.day && gs.claimed), now = d === gs.day && !gs.claimed;
        const c = document.createElement('div'); c.className = 'gift' + (got ? ' got' : '') + (now ? ' now' : '') + (r === 'chest' ? ' chest' : '');
        c.innerHTML = `<small>Day ${d}</small><span class="gi">${r === 'chest' ? '\u{1F381}' : coin}</span><b>${r === 'chest' ? 'Chest' : '+' + r}${d === 3 || d === 5 ? ' \u26A1' : ''}</b>${got ? '<i>✓</i>' : ''}`; row.appendChild(c); });
      body.appendChild(row);
      if (!gs.claimed) { const b = document.createElement('button'); b.className = 'mmbtn'; b.textContent = 'Open today’s gift'; b.onclick = claimGift; body.appendChild(b); }
    } else if (kind === 'shop') {
      h.innerHTML = `Swag Shop <span class="mmcoins">${coin}<b>${fmt(PB.wallet.get())}</b></span>`;
      const p = document.createElement('p'); p.className = 'mmsub'; p.textContent = 'Spend your coins on fun looks for your games. Tap something you own to wear it (tap again to take it off).'; body.appendChild(p);
      for (const gid of ['dash', 'castle', 'racer', 'potions', 'snake', 'sweets', 'bricks', 'cubes']) {
        const items = SHOP.filter(it => it.game === gid); if (!items.length) continue;
        const sec = document.createElement('div'); sec.className = 'shopsec'; sec.innerHTML = `<h4></h4><div class="shopgrid"></div>`; sec.querySelector('h4').textContent = NAME[gid];
        for (const it of items) { const have = owned().includes(it.id), on = look(it.game, it.slot) === it.id;
          const c = document.createElement('button'); c.className = 'item' + (have ? ' have' : '') + (on ? ' on' : '');
          c.innerHTML = `<span class="sw" style="background:${it.sw.length > 2 ? `conic-gradient(${it.sw.join(',')},${it.sw[0]})` : `linear-gradient(135deg,${it.sw[0]},${it.sw[1]})`}">${it.ic || ''}</span><b></b><span class="pr">${on ? 'Wearing' : have ? 'Wear it' : coin + fmt(it.price)}</span>`;
          c.querySelector('b').textContent = it.name;
          c.onclick = () => { buy(it); openModal('shop'); };
          sec.querySelector('.shopgrid').appendChild(c); }
        body.appendChild(sec);
        if (boostsFor(gid).length) {
          const bs = document.createElement('div'); bs.className = 'shopsec'; bs.innerHTML = `<h4>${NAME[gid]} power-ups</h4><div class="shopgrid"></div>`;
          for (const it of boostsFor(gid)) { const c = document.createElement('button'); c.className = 'item boost';
            c.innerHTML = `<span class="sw" style="background:linear-gradient(135deg,${it.sw[0]},${it.sw[1]})">${it.ic}${boostCount(it.id) ? `<i class="bn">${boostCount(it.id)}</i>` : ''}</span><b></b><small class="bd"></small><span class="pr">${coin}${fmt(it.price)} for ${it.pack}</span>`;
            c.querySelector('b').textContent = it.name; c.querySelector('.bd').textContent = it.desc;
            c.onclick = () => { buyBoost(it); openModal('shop'); };
            bs.querySelector('.shopgrid').appendChild(c); }
          body.appendChild(bs);
        }
      }
    } else if (kind === 'stickers') {
      const have = stickers(), fresh = store.get('pb-stickers-new') || [];
      h.textContent = `Sticker album ${have.length}/${STICKERS.length}`;
      const p = document.createElement('p'); p.className = 'mmsub'; p.textContent = 'Every game has 3 stickers to find. Play to fill your album!'; body.appendChild(p);
      for (const gid of ['dash', 'castle', 'racer', 'potions', 'snake', 'sweets', 'bricks', 'cubes', 'dots', 'tank']) {
        const sec = document.createElement('div'); sec.className = 'stkpage'; sec.innerHTML = '<h4></h4><div class="stkrow"></div>'; sec.querySelector('h4').textContent = NAME[gid];
        for (const t of STICKERS.filter(x => x.game === gid)) { const got = have.includes(t.id), c = document.createElement('div');
          c.className = 'stk' + (got ? ' got' : '') + (fresh.includes(t.id) ? ' new' : ''); c.style.setProperty('--sc', STK_COL[gid]);
          c.innerHTML = `<span class="se">${t.e}</span><b></b><small></small>`; c.querySelector('b').textContent = got ? t.name : '???'; c.querySelector('small').textContent = t.desc;
          sec.querySelector('.stkrow').appendChild(c); }
        body.appendChild(sec);
      }
      store.set('pb-stickers-new', []);
    } else {
      h.textContent = `Trophies ${earned().length}/${TROPHIES.length}`;
      const p = document.createElement('p'); p.className = 'mmsub'; p.textContent = `Every trophy gives you ${TROPHY_COINS} coins.`; body.appendChild(p);
      const grid = document.createElement('div'); grid.className = 'trophies';
      for (const t of TROPHIES) { const got = earned().includes(t.id), c = document.createElement('div'); c.className = 'trophy' + (got ? ' got' : '');
        c.innerHTML = `<span class="ti">${got ? t.icon : '\u{1F512}'}</span><b></b><small></small>`; c.querySelector('b').textContent = t.name; c.querySelector('small').textContent = t.desc; grid.appendChild(c); }
      body.appendChild(grid);
    }
  }
  // Galaxy Racer Hangar: ship upgrades (Engine, Boosters, Thrusters, Shields)
  // Galaxy Racer Hangar (opened from the Galaxy Racer menu; Playbox Plus): buy upgrade levels, and choose
  // which level to fly with (turn the Engine down if the ship feels too fast). Gates count the levels you own.
  function hangarSection(body, h){
    const G = PB.games && PB.games.racer, H = G && G.hangar; if (!H) return;
    h.innerHTML = `\u{1F680} Hangar <span class="mmcoins">${coin}<b>${fmt(PB.wallet.get())}</b></span>`;
    const sec = document.createElement('div'); sec.className = 'hangar'; sec.id = 'hangar';
    sec.innerHTML = `<h4>Ship Power <span>${H.power()} / ${H.max}</span></h4><p class="hsub">Buy upgrades to reach tougher races. Use \u2212 and + to choose how strong each one is while you fly.</p><div class="hgrid"></div>`;
    for (const u of H.list()) {
      const c = document.createElement('div'); c.className = 'hup' + (u.cost == null ? ' max' : '');
      c.innerHTML = `<span class="hn"><span class="hi">${u.ic}</span><b></b></span>
        <span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < u.use ? 'on' : i < u.lv ? 'own' : ''}"></i>`).join('')}</span>
        <small class="hnow"></small>
        <span class="huse"><button class="hb" data-d="-1" aria-label="Turn ${u.name} down">\u2212</button><em>Using ${u.use}/${u.lv}</em><button class="hb" data-d="1" aria-label="Turn ${u.name} up">+</button></span>
        <button class="hbuy"${u.cost == null ? ' disabled' : ''}>${u.cost == null ? 'Maxed out!' : `Upgrade ${coin}${fmt(u.cost)}`}</button>`;
      c.querySelector('b').textContent = `${u.name} ${u.lv}/${u.max}`;
      c.querySelector('.hnow').textContent = u.now + (u.next ? ` \u00b7 next: ${u.next}` : '');
      const [dn, up] = c.querySelectorAll('.hb'); dn.disabled = u.use <= 0; up.disabled = u.use >= u.lv;
      for (const b of [dn, up]) b.onclick = () => { H.setUse(u.id, u.use + +b.dataset.d); if (PB.sfx) PB.sfx('pick'); openModal('hangar'); };
      c.querySelector('.hbuy').onclick = () => {
        const r = H.buy(u.id);
        if (r === 'coins') { banner('Not enough coins yet. Keep playing to earn more!', false); if (PB.sfx) PB.sfx('nope'); return; }
        if (r === 'ok') { if (PB.sfx) PB.sfx('power'); banner(`${u.ic} ${u.name} upgraded to level ${u.lv + 1}!`, true); }
        openModal('hangar');
      };
      sec.querySelector('.hgrid').appendChild(c);
    }
    body.appendChild(sec);
  }
  function openHangar(done){ openModal('hangar'); afterClose = done || null; }
  // ---------- the Pet Shop for My Fish Tank ----------
  let petTab = 'fish', byeAsk = null;
  function thumb(draw){ const c = document.createElement('canvas'), d = window.devicePixelRatio || 1; c.width = 72 * d; c.height = 54 * d; c.className = 'pthumb'; const g = c.getContext('2d'); g.scale(d, d); draw(g); return c; }
  function openPetShop(tab){
    const T = PB.tank; if (!T) return;
    if (tab) petTab = tab;
    const m = $('metaModal'), body = $('mmBody'); m.hidden = false; body.innerHTML = '';
    const S = T.load(), L = T.levelOf(S.xp), tank = T.tankOf(S), plus = hasPlus();
    const h = document.createElement('h3'); h.innerHTML = `\u{1F420} Pet Shop <span class="mmcoins">${coin}<b>${fmt(PB.wallet.get())}</b></span>`; body.appendChild(h);
    const sub = document.createElement('p'); sub.className = 'mmsub'; sub.textContent = `Tank level ${L} \u00b7 ${S.fish.length}/${tank.fish} fish \u00b7 ${S.decor.length}/${tank.decor} decorations. Care for your tank every day to level up and unlock more!`; body.appendChild(sub);
    const tabs = document.createElement('div'); tabs.className = 'ptabs';
    for (const [id, label] of [['fish', '\u{1F41F} Fish'], ['decor', '\u{1F3F0} Decor'], ['tank', '\u{1FAE7} Tanks'], ['water', '\u{1F30A} Water'], ['mine', '\u2B50 My Tank']]) {
      const b = document.createElement('button'); b.className = 'ptab' + (petTab === id ? ' on' : ''); b.textContent = label; b.onclick = () => { petTab = id; byeAsk = null; openPetShop(); }; tabs.appendChild(b); }
    body.appendChild(tabs);
    if (!plus && petTab !== 'mine') {
      const box = document.createElement('div'); box.className = 'mmlock'; box.innerHTML = '<span class="ml">\u{1F6CD}\uFE0F</span><p class="mmsub">The Pet Shop is part of Playbox Plus. Ask a grown-up! You can still feed, clean and play with your fish every day.</p>';
      const b = document.createElement('button'); b.className = 'mmbtn'; b.textContent = 'See Playbox Plus'; b.onclick = () => { closeModal(); if (PB.openPlus) PB.openPlus(); }; box.appendChild(b); body.appendChild(box);
    }
    const grid = document.createElement('div'); grid.className = 'shopgrid pgrid'; body.appendChild(grid);
    const card = (pic, name, line, btn, cls, onClick, disabled) => { const c = document.createElement('div'); c.className = 'item pitem ' + (cls || ''); c.appendChild(pic); const b = document.createElement('b'); b.textContent = name; c.appendChild(b);
      const p = document.createElement('span'); p.className = 'pr'; p.innerHTML = line; c.appendChild(p);
      if (btn) { const bt = document.createElement('button'); bt.className = 'pbtn'; bt.innerHTML = btn; bt.disabled = !!disabled; bt.onclick = onClick; c.appendChild(bt); } grid.appendChild(c); };
    const result = (r, okText) => {
      if (r === 'ok' || r === 'worn' || r === 'stored') { if (PB.sfx) PB.sfx(r === 'worn' ? 'pick' : 'power'); if (r !== 'worn') banner(r === 'stored' ? `${okText}! It's in storage until you have room.` : okText + '!', true); }
      else if (r === 'coins') { banner('Not enough coins yet. Play games to earn more!', false); if (PB.sfx) PB.sfx('nope'); }
      else if (r === 'full') { banner('Your tank is full! Get a bigger tank, or make room in My Tank.', false); if (PB.sfx) PB.sfx('nope'); }
      else if (r === 'level') { banner('Keep caring for your tank to reach that level!', false); if (PB.sfx) PB.sfx('nope'); }
      openPetShop();
    };
    const lock = lv => `\u{1F512} Tank level ${lv}`, price = n => n ? `${coin}${fmt(n)}` : 'Free';
    if (petTab === 'fish') for (const f of T.FISH) {
      const have = S.fish.filter(x => x.sp === f.id).length, locked = L < f.lv;
      card(thumb(g => T.drawFish(g, f.id, 36, 27, Math.min(15, 15 * 22 / f.s))),
        f.name, locked ? lock(f.lv) : `${price(f.price)}${have ? ` \u00b7 you have ${have}` : ''}`, locked ? null : 'Buy', locked ? 'locked' : have ? 'have' : '', () => result(T.buy('fish', f.id), `Welcome, new ${f.name}`), !plus);
    }
    if (petTab === 'decor') for (const d of T.DECOR) {
      const own = S.owned.includes(d.id), inTank = S.decor.includes(d.id), locked = L < d.lv;
      card(thumb(g => { const sc = Math.min(0.5, 60 / Math.max(40, d.w + 20)); if (d.id === 'lights') { g.font = '26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u2728', 36, 27); } else T.drawDecor(g, d.id, 36, 50, sc); }),
        d.name, locked ? lock(d.lv) : own ? (inTank ? 'In your tank' : 'In storage') : price(d.price),
        locked ? null : own ? (inTank ? 'Take out' : 'Put in tank') : 'Buy', locked ? 'locked' : own ? 'have' : '',
        () => own ? result(T.toggleDecor(d.id), inTank ? 'Taken out' : 'Put in your tank') : result(T.buy('decor', d.id), `${d.name} added`), !plus && !own);
    }
    if (petTab === 'tank') T.TANKS.forEach((t, i) => {
      const own = i <= S.tank, cur = i === S.tank, locked = L < t.lv;
      card(thumb(g => { g.fillStyle = '#5ec8f2'; const w = 20 + i * 8, hh = 16 + i * 5; if (t.round) { g.beginPath(); g.arc(36, 30, 18, 0, 7); g.fill(); } else g.fillRect(36 - w / 2, 46 - hh, w, hh); g.strokeStyle = '#2a3a5a'; g.lineWidth = 2; if (t.round) { g.beginPath(); g.arc(36, 30, 18, 0, 7); g.stroke(); } else g.strokeRect(36 - w / 2, 46 - hh, w, hh); }),
        t.name, locked ? lock(t.lv) : `${t.fish} fish \u00b7 ${t.decor} decorations${own ? '' : ' \u00b7 ' + price(t.price)}`, locked || own ? null : 'Upgrade', cur ? 'have on' : own ? 'have' : locked ? 'locked' : '',
        () => result(T.buy('tank', t.id), `Your fish moved into the ${t.name}`), !plus || i !== S.tank + 1);
    });
    if (petTab === 'water') for (const w of T.WATERS) {
      const own = S.waters.includes(w.id), on = S.water === w.id, locked = L < w.lv;
      card(thumb(g => { const q = g.createLinearGradient(0, 6, 0, 50); q.addColorStop(0, w.top); q.addColorStop(1, w.bot); g.fillStyle = q; g.fillRect(10, 6, 52, 44); g.fillStyle = w.sand; g.fillRect(10, 42, 52, 8); }),
        w.name, locked ? lock(w.lv) : on ? 'Using now' : own ? 'Yours' : price(w.price), locked || on ? null : own ? 'Use' : 'Buy', on ? 'have on' : own ? 'have' : locked ? 'locked' : '',
        () => result(T.buy('water', w.id), `${w.name} water`), !plus && !own);
    }
    if (petTab === 'mine') {
      S.fish.forEach((f, i) => { const sp = T.FISH.find(x => x.id === f.sp);
        card(thumb(g => T.drawFish(g, f.sp, 36, 27, Math.min(15, 15 * 22 / sp.s))), f.name, sp.name, S.fish.length > 1 ? (byeAsk === i ? 'Tap again to say goodbye' : 'Let it swim to the ocean') : null, 'have',
          () => { if (byeAsk === i) { byeAsk = null; T.release(i); banner(`${f.name} swam off to the big ocean. Bye bye!`, true); openPetShop(); } else { byeAsk = i; openPetShop(); } }); });
      const tip = document.createElement('p'); tip.className = 'mmsub'; tip.textContent = 'Tip: in the Decor tab you can put decorations in your tank or take them out.'; body.appendChild(tip);
    }
  }
  let afterClose = null;
  function openShop(game, done){ openModal('shop'); afterClose = done || null; }
  function closeModal(){ $('metaModal').hidden = true; render(); const f = afterClose; afterClose = null; if (f) f(); }
  function initUI(){
    $('btnGift').onclick = () => openModal('gift'); if ($('btnStickers')) $('btnStickers').onclick = () => openModal('stickers'); $('btnShop').onclick = () => openModal('shop'); $('btnTrophy').onclick = () => openModal('trophies');
    $('mmClose').onclick = closeModal; $('metaModal').addEventListener('click', e => { if (e.target.id === 'metaModal') closeModal(); });
    render(); checkTrophies(); checkStickers();
    // the gift pops up by itself once a day
    if (!giftState().claimed && hasPlus()) setTimeout(() => { if (!document.getElementById('hub').hidden) openModal('gift'); }, 900);
  }

  PB.meta = { openShop, openHangar, openPetShop, STICKERS, openChest, checkStickers, BOOSTS, boostsFor, boostCount, addBoost, useBoost, randomBoost, look, coinMult, event, onPlay, onRun, render, initUI, banner, checkTrophies, SHOP, TROPHIES };
})();
