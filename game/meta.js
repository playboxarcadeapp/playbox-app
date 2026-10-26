// Playbox extras that bring players back: Swag Shop, daily gift calendar, daily missions, trophies,
// weekly events and a "continue" card. Everything is stored on the device.
(function(){
  const { store, today, fmt, seedFrom, mulberry } = PB;
  const $ = id => document.getElementById(id);
  const coin = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc21a" stroke="#b77800" stroke-width="2"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#ffe27a" stroke-width="1.5"/></svg>';
  const NAME = { bricks: 'Brick Bash', dash: 'Zoom Dash', sweets: 'Gem Mine', potions: 'Potion Sort', cubes: 'Cube Escape', racer: 'Galaxy Racer', castle: 'Castle Crash', snake: 'Anaconda' };
  const dayNum = d => Math.floor(new Date(d + 'T12:00:00').getTime() / 86400000);

  // ---------------- Swag Shop ----------------
  // Every item shows up in its game. sw = colors for the little preview swatch.
  const SHOP = [
    { id: 'hat_cap',      game: 'dash',    slot: 'hat',    name: 'Baseball cap',     price: 150, sw: ['#2e6fb7', '#ffffff'] },
    { id: 'hat_party',    game: 'dash',    slot: 'hat',    name: 'Party hat',        price: 200, sw: ['#ff4f8b', '#ffd23f'] },
    { id: 'hat_crown',    game: 'dash',    slot: 'hat',    name: 'Gold crown',       price: 400, sw: ['#ffd23f', '#e8a20f'] },
    { id: 'scarf_blue',   game: 'dash',    slot: 'scarf',  name: 'Blue scarf',       price: 100, sw: ['#3fa9ff', '#1f5fa8'] },
    { id: 'scarf_rainbow',game: 'dash',    slot: 'scarf',  name: 'Rainbow scarf',    price: 250, sw: ['#ff3d6e', '#ffd23f', '#3fa9ff'] },
    { id: 'ship_red',     game: 'racer',   slot: 'paint',  name: 'Red rocket paint', price: 200, sw: ['#ff3b3b', '#a01818'] },
    { id: 'ship_blue',    game: 'racer',   slot: 'paint',  name: 'Ice blue paint',   price: 200, sw: ['#5ec8ff', '#1f6fa8'] },
    { id: 'ship_gold',    game: 'racer',   slot: 'paint',  name: 'Gold paint',       price: 500, sw: ['#ffd23f', '#c78a00'] },
    { id: 'sling_candy',  game: 'castle',  slot: 'sling',  name: 'Candy slingshot',  price: 250, sw: ['#ff5fa2', '#ffffff'] },
    { id: 'sling_gold',   game: 'castle',  slot: 'sling',  name: 'Golden slingshot', price: 400, sw: ['#ffd23f', '#c78a00'] },
    { id: 'brew_pink',    game: 'potions', slot: 'brew',   name: 'Pink potion brew', price: 150, sw: ['#ff8fd0', '#d63a9a'] },
    { id: 'brew_blue',    game: 'potions', slot: 'brew',   name: 'Blue potion brew', price: 150, sw: ['#9ae6ff', '#2f86ff'] },
    { id: 'brew_gold',    game: 'potions', slot: 'brew',   name: 'Gold potion brew', price: 300, sw: ['#fff1a0', '#e8b21f'] },
    { id: 'skin_coral',   game: 'snake',   slot: 'skin',   name: 'Coral snake skin', price: 200, sw: ['#ff6a4a', '#ffd23f', '#1a1a1a'] },
    { id: 'skin_ocean',   game: 'snake',   slot: 'skin',   name: 'Ocean snake skin', price: 250, sw: ['#2f86ff', '#7fe0ff'] },
    { id: 'skin_gold',    game: 'snake',   slot: 'skin',   name: 'Golden snake skin',price: 400, sw: ['#ffd23f', '#c78a00'] },
    { id: 'frame_candy',  game: 'sweets',  slot: 'frame',  name: 'Candy board frame',price: 200, sw: ['#ff8fc4', '#ffffff'] },
    { id: 'frame_ice',    game: 'sweets',  slot: 'frame',  name: 'Ice board frame',  price: 200, sw: ['#bfefff', '#5ec8ff'] },
    { id: 'paddle_lava',  game: 'bricks',  slot: 'paddle', name: 'Lava paddle',      price: 150, sw: ['#ff7a2a', '#ff3b3b'] },
    { id: 'paddle_neon',  game: 'bricks',  slot: 'paddle', name: 'Neon green paddle',price: 150, sw: ['#7dff6a', '#22e4ff'] },
    { id: 'box_gold',     game: 'cubes',   slot: 'box',    name: 'Gold puzzle box',  price: 200, sw: ['#ffd23f', '#8a5a10'] },
    { id: 'box_pink',     game: 'cubes',   slot: 'box',    name: 'Pink puzzle box',  price: 200, sw: ['#ff8fd0', '#7a2a6a'] },
    // big-ticket items: whole new ships, costumes and effects
    { id: 'model_saucer', game: 'racer',   slot: 'ship',   name: 'Flying saucer',    price: 600, ic: '\u{1F6F8}', sw: ['#9fb4c8', '#5ec8ff'] },
    { id: 'model_rocket', game: 'racer',   slot: 'ship',   name: 'Retro rocket',     price: 700, ic: '\u{1F680}', sw: ['#ffffff', '#ff3b3b'] },
    { id: 'model_shark',  game: 'racer',   slot: 'ship',   name: 'Space shark',      price: 800, ic: '\u{1F988}', sw: ['#5f7fa8', '#d8e4f0'] },
    { id: 'fur_fox',      game: 'dash',    slot: 'fur',    name: 'Fox costume',      price: 500, ic: '\u{1F98A}', sw: ['#ffa24a', '#ff6a1a'] },
    { id: 'fur_snow',     game: 'dash',    slot: 'fur',    name: 'Snow raccoon',     price: 500, ic: '\u2744\uFE0F', sw: ['#eaf4ff', '#4a6aa8'] },
    { id: 'fur_gold',     game: 'dash',    slot: 'fur',    name: 'Golden raccoon',   price: 900, ic: '\u2728', sw: ['#ffd23f', '#8a5a10'] },
    { id: 'trail_stars',  game: 'castle',  slot: 'trail',  name: 'Star trail',       price: 300, ic: '\u2B50', sw: ['#fff1a0', '#ffb81f'] },
    { id: 'trail_hearts', game: 'castle',  slot: 'trail',  name: 'Heart trail',      price: 300, ic: '\u{1F496}', sw: ['#ff8fc4', '#ff3d6e'] },
    { id: 'trail_rainbow',game: 'castle',  slot: 'trail',  name: 'Rainbow trail',    price: 500, ic: '\u{1F308}', sw: ['#ff3d6e', '#ffd23f', '#7dff6a', '#3fa9ff'] },
    { id: 'magic_glow',   game: 'potions', slot: 'magic',  name: 'Potion sparkles',  price: 250, ic: '\u2728', sw: ['#d4ff9a', '#4fbf3a'] },
    { id: 'magic_stars',  game: 'potions', slot: 'magic',  name: 'Wizard stars',     price: 350, ic: '\u2B50', sw: ['#fff1a0', '#6a3ac0'] },
    { id: 'magic_rainbow',game: 'potions', slot: 'magic',  name: 'Rainbow magic',    price: 500, ic: '\u{1F308}', sw: ['#ff3d6e', '#ffd23f', '#7dff6a', '#3fa9ff'] },
    { id: 'skin_candy',   game: 'snake',   slot: 'skin',   name: 'Candy snake skin', price: 350, sw: ['#ff9ccf', '#ffffff', '#7fe0ff'] },
    { id: 'skin_galaxy',  game: 'snake',   slot: 'skin',   name: 'Galaxy snake skin',price: 500, ic: '\u{1F30C}', sw: ['#4a2a9a', '#ff8ff0'] },
    { id: 'shine_sparkle',game: 'sweets',  slot: 'shine',  name: 'Twinkle gems',     price: 300, ic: '\u2728', sw: ['#ffffff', '#ff5fa2'] },
    { id: 'shine_glow',   game: 'sweets',  slot: 'shine',  name: 'Glowing gems',     price: 400, ic: '\u{1F48E}', sw: ['#9ae6ff', '#c76bff'] },
    { id: 'ball_pink',    game: 'bricks',  slot: 'ball',   name: 'Hot pink ball',    price: 150, sw: ['#ff5fbf', '#a0206a'] },
    { id: 'ball_gold',    game: 'bricks',  slot: 'ball',   name: 'Gold ball',        price: 300, sw: ['#ffd23f', '#c78a00'] },
    { id: 'ball_rainbow', game: 'bricks',  slot: 'ball',   name: 'Rainbow ball',     price: 500, ic: '\u{1F308}', sw: ['#ff3d6e', '#ffd23f', '#7dff6a', '#3fa9ff'] },
    { id: 'cols_candy',   game: 'cubes',   slot: 'colors', name: 'Candy cubes',      price: 300, sw: ['#ff8fc4', '#8fdcff', '#a8ff8a', '#fff07a'] },
    { id: 'cols_jewel',   game: 'cubes',   slot: 'colors', name: 'Jewel cubes',      price: 400, ic: '\u{1F48E}', sw: ['#00d0b0', '#ff2a72', '#ffc400', '#9a5aff'] },
  ];
  const owned = () => store.get('pb-owned') || [];
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
    { id: 'cube',    game: 'cubes',   text: 'Reach level {n} in Cube Escape',      n: [3, 4, 5],       max: i => i.m.level || 0 },
    { id: 'fruit',   game: 'snake',   text: 'Eat {n} fruit in Anaconda',           n: [20, 35, 50],    add: i => i.m.eaten || 0 },
    { id: 'brick',   game: 'bricks',  text: 'Score {n} in one Brick Bash game',    n: [1500, 3000],    max: i => i.score || 0 },
  ];
  const MISSION_COINS = 30, MISSION_BONUS = 50;
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
      const coins = 60; PB.wallet.add(coins);
      const cheap = SHOP.filter(it => !owned().includes(it.id) && it.price <= 250);
      if (cheap.length) { const it = cheap[Math.floor(Math.random() * cheap.length)]; store.set('pb-owned', [...owned(), it.id]); msg = `Treasure chest! +${coins} coins and a free ${it.name}!`; }
      else msg = `Treasure chest! +${coins} coins`;
      const st = stats(); st.chests = (st.chests || 0) + 1; saveStats(st);
    } else { PB.wallet.add(r); msg = `Daily gift: +${r} coins!`; }
    store.set('pb-gift', { day: s.day, last: today() });
    if (PB.sfx) PB.sfx('life'); banner(msg, true); checkTrophies(); render(); openModal('gift');
  }

  // ---------------- trophies ----------------
  const prog = id => store.get(id + '-progress') || {};
  const levelWins = id => Math.max(0, (prog(id).unlocked || 1) - 1);
  const starsAll = () => ['castle', 'potions', 'racer', 'sweets'].reduce((a, id) => a + Object.values(prog(id).stars || {}).reduce((x, y) => x + y, 0), 0);
  const bestOf = id => (PB.bestOf && PB.bestOf(id)) || 0;
  const streak = () => { const s = store.get('pb-streak') || {}; return Math.max(s.best || 0, s.count || 0); };
  const TROPHIES = [
    { id: 'first',    icon: '\u{1F3AE}', name: 'Let’s play!',      desc: 'Play your first game',                test: s => Object.keys(s.plays).length >= 1 },
    { id: 'explorer', icon: '\u{1F308}', name: 'Game explorer',          desc: 'Play all 8 games',                     test: s => Object.keys(s.plays).length >= 8 },
    { id: 'streak3',  icon: '\u{1F525}', name: 'On fire',                desc: 'Play 3 days in a row',                 test: () => streak() >= 3 },
    { id: 'streak7',  icon: '\u{1F4C5}', name: 'Week warrior',           desc: 'Play 7 days in a row',                 test: () => streak() >= 7 },
    { id: 'streak30', icon: '\u{1F3C5}', name: 'Superfan',               desc: 'Play 30 days in a row',                test: () => streak() >= 30 },
    { id: 'coins1k',  icon: '\u{1FA99}', name: 'Coin collector',         desc: 'Earn 1,000 coins',                     test: () => (store.get('pb-coins-earned') || 0) >= 1000 },
    { id: 'coins5k',  icon: '\u{1F4B0}', name: 'Treasure hoard',         desc: 'Earn 5,000 coins',                     test: () => (store.get('pb-coins-earned') || 0) >= 5000 },
    { id: 'shop1',    icon: '\u{1F6CD}️', name: 'First buy',        desc: 'Get something from the Swag Shop',     test: () => owned().length >= 1 },
    { id: 'shop5',    icon: '\u{1F451}', name: 'Show-off',               desc: 'Own 5 Swag Shop items',                test: () => owned().length >= 5 },
    { id: 'mission1', icon: '✅',    name: 'Mission complete',       desc: 'Finish all 3 daily missions in a day', test: s => (s.missionDays || 0) >= 1 },
    { id: 'mission5', icon: '\u{1F3AF}', name: 'Mission master',         desc: 'Finish all daily missions on 5 days',  test: s => (s.missionDays || 0) >= 5 },
    { id: 'chest',    icon: '\u{1F381}', name: 'Treasure hunter',        desc: 'Open a day-7 treasure chest',          test: s => (s.chests || 0) >= 1 },
    { id: 'dash1k',   icon: '\u{1F99D}', name: 'Long runner',            desc: 'Run 1,000 m in Zoom Dash',             test: () => bestOf('dash') >= 1000 },
    { id: 'dashcity', icon: '\u{1F3D9}️', name: 'Big City',         desc: 'Run all the way to the Big City',      test: s => (s.best.dashDist || 0) >= 1350 },
    { id: 'castle10', icon: '\u{1F3F0}', name: 'Siege master',           desc: 'Beat Castle Crash level 10',           test: () => levelWins('castle') >= 10 },
    { id: 'gob50',    icon: '\u{1FA96}', name: 'Goblin bonker',          desc: 'Bonk 50 goblins',                      test: s => (s.goblins || 0) >= 50 },
    { id: 'pot10',    icon: '\u{1F9EA}', name: 'Apprentice',             desc: 'Beat Potion Sort level 10',            test: () => levelWins('potions') >= 10 },
    { id: 'pot30',    icon: '\u{1F9D9}', name: 'Grand wizard',           desc: 'Beat Potion Sort level 30',            test: () => levelWins('potions') >= 30 },
    { id: 'gem10',    icon: '\u{1F48E}', name: 'Gem hunter',             desc: 'Beat Gem Mine level 10',               test: () => levelWins('sweets') >= 10 },
    { id: 'race10',   icon: '\u{1F680}', name: 'Star pilot',             desc: 'Win 10 Galaxy Racer races',            test: () => levelWins('racer') >= 10 },
    { id: 'cube8',    icon: '\u{1F9CA}', name: 'Puzzle box pro',         desc: 'Reach level 8 in Cube Escape',         test: s => (s.best.cubeLevel || 0) >= 8 },
    { id: 'snake50',  icon: '\u{1F40D}', name: 'Mega anaconda',          desc: 'Grow Anaconda to 50 long',             test: s => (s.best.snakeLen || 0) >= 50 },
    { id: 'brick10k', icon: '\u{1F9F1}', name: 'Brick smasher',          desc: 'Score 10,000 in Brick Bash',           test: () => bestOf('bricks') >= 10000 },
    { id: 'stars50',  icon: '⭐',    name: 'Star collector',         desc: 'Collect 50 level stars',               test: () => starsAll() >= 50 },
  ];
  const TROPHY_COINS = 25;
  const earned = () => store.get('pb-trophies') || [];
  function checkTrophies(){
    const s = stats(), have = earned(), add = [];
    for (const t of TROPHIES) if (!have.includes(t.id)) { try { if (t.test(s)) add.push(t); } catch (e) {} }
    if (!add.length) return;
    store.set('pb-trophies', [...have, ...add.map(t => t.id)]);
    for (const t of add) { PB.wallet.add(TROPHY_COINS); later(`${t.icon} Trophy: ${t.name}! +${TROPHY_COINS} coins`); }
    if (PB.sfx) PB.sfx('fanfare');
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
    checkTrophies();
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
    const gs = giftState();
    $('btnGift').querySelector('.dot').hidden = gs.claimed;
    $('btnTrophy').querySelector('.n').textContent = `${earned().length}/${TROPHIES.length}`;
    $('btnShop').querySelector('.n').textContent = `${owned().length}/${SHOP.length}`;
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
  function openModal(kind){
    const m = $('metaModal'), body = $('mmBody'); m.hidden = false; body.innerHTML = '';
    const h = document.createElement('h3'); body.appendChild(h);
    if (kind === 'gift') {
      const gs = giftState(); h.textContent = 'Daily gift';
      const p = document.createElement('p'); p.className = 'mmsub'; p.textContent = gs.claimed ? 'Come back tomorrow for the next gift!' : 'A present every day you play. Day 7 is a treasure chest!'; body.appendChild(p);
      const row = document.createElement('div'); row.className = 'gifts';
      GIFTS.forEach((r, i) => { const d = i + 1, got = d < gs.day || (d === gs.day && gs.claimed), now = d === gs.day && !gs.claimed;
        const c = document.createElement('div'); c.className = 'gift' + (got ? ' got' : '') + (now ? ' now' : '') + (r === 'chest' ? ' chest' : '');
        c.innerHTML = `<small>Day ${d}</small><span class="gi">${r === 'chest' ? '\u{1F381}' : coin}</span><b>${r === 'chest' ? 'Chest' : '+' + r}</b>${got ? '<i>✓</i>' : ''}`; row.appendChild(c); });
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
      }
    } else {
      h.textContent = `Trophies ${earned().length}/${TROPHIES.length}`;
      const p = document.createElement('p'); p.className = 'mmsub'; p.textContent = `Every trophy gives you ${TROPHY_COINS} coins.`; body.appendChild(p);
      const grid = document.createElement('div'); grid.className = 'trophies';
      for (const t of TROPHIES) { const got = earned().includes(t.id), c = document.createElement('div'); c.className = 'trophy' + (got ? ' got' : '');
        c.innerHTML = `<span class="ti">${got ? t.icon : '\u{1F512}'}</span><b></b><small></small>`; c.querySelector('b').textContent = t.name; c.querySelector('small').textContent = t.desc; grid.appendChild(c); }
      body.appendChild(grid);
    }
  }
  function closeModal(){ $('metaModal').hidden = true; render(); }
  function initUI(){
    $('btnGift').onclick = () => openModal('gift'); $('btnShop').onclick = () => openModal('shop'); $('btnTrophy').onclick = () => openModal('trophies');
    $('mmClose').onclick = closeModal; $('metaModal').addEventListener('click', e => { if (e.target.id === 'metaModal') closeModal(); });
    render(); checkTrophies();
    // the gift pops up by itself once a day
    if (!giftState().claimed) setTimeout(() => { if (!document.getElementById('hub').hidden) openModal('gift'); }, 900);
  }

  PB.meta = { look, coinMult, event, onPlay, onRun, render, initUI, banner, checkTrophies, SHOP, TROPHIES };
})();
