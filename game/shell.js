// The app around the games: hub tiles, menus, level maps, high scores, streaks.
(function(){
  const { $, fmt, store, today, yesterday, mulberry, seedFrom, cv, ctx, dpr } = PB;

  // ---------- Scores, streaks, level progress ----------
  const keyFor = g => g.scoreKey || (g.id + '-scores');
  function loadScores(g){
    const s = store.get(keyFor(g)) || {};
    s.classic = Array.isArray(s.classic) ? s.classic : [];
    if (!s.daily || s.daily.date !== today()) s.daily = { date: today(), list: [] };
    if (g.id === 'bricks') { const old = store.get('bb-best'); if (!s.classic.length && old > 0) s.classic.push({ name:'Player', score: old }); }
    return s;
  }
  const listFor = (g, m) => { const s = loadScores(g); return m === 'daily' ? s.daily.list : s.classic; };
  const bestFor = (g, m) => { const l = listFor(g, m); return l.length ? l[0].score : 0; };
  const qualifies = (g, m, score) => { const l = listFor(g, m); return score > 0 && (l.length < 10 || score > l[l.length-1].score); };
  function addScore(g, m, name, score){
    const s = loadScores(g); const l = m === 'daily' ? s.daily.list : s.classic;
    const entry = { name, score: Math.floor(score), id: Date.now() };
    l.push(entry); l.sort((a,b) => b.score - a.score); l.length = Math.min(l.length, 10);
    store.set(keyFor(g), s); return entry.id;
  }
  function streakInfo(){
    const s = store.get('pb-streak') || store.get('bb-streak') || { last:null, count:0, best:0 };
    const alive = s.last === today() || s.last === yesterday();
    return { count: alive ? s.count : 0, best: s.best || 0, playedToday: s.last === today() };
  }
  function markPlayed(){
    const s = streakInfo(); if (s.playedToday) return false;
    store.set('pb-streak', { last: today(), count: s.count + 1, best: Math.max(s.best, s.count + 1) });
    return 10 + Math.min(s.count + 1, 7) * 2;   // a few coins for coming back each day
  }
  const streakBonus = c => c >= 7 ? 2 : c >= 3 ? 1 : 0;

  // ---------- Coins (saved for the Swag Shop) ----------
  const coinSvg = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc21a" stroke="#b77800" stroke-width="2"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#ffe27a" stroke-width="1.5"/><path d="M12 7.6l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#b77800"/></svg>';
  const wallet = {
    get(){ return store.get('pb-coins') || 0; },
    add(n){ n = Math.floor(n); if (n <= 0) return; store.set('pb-coins', wallet.get() + n); const e = store.get('pb-coins-earned') || 0; store.set('pb-coins-earned', e + n); paintCoins(); },
    spend(n){ if (wallet.get() < n) return false; store.set('pb-coins', wallet.get() - n); paintCoins(); return true; },
  };
  PB.wallet = wallet;
  function paintCoins(){ const c = fmt(wallet.get()); $('hubCoins').innerHTML = coinSvg + `<b>${c}</b> coins`; $('hCoins').textContent = c; }
  const coinsForScore = score => Math.max(1, Math.min(60, Math.round(Math.sqrt(Math.max(0, score)) / 2.5)));

  // ---------- Daily challenges: one real goal per game per day ----------
  function challengeFor(g, day = today()){
    if (!g.dailyGoals || !g.dailyGoals.length) return null;
    const R = mulberry(seedFrom('goal-' + g.id + '-' + day));
    const t = g.dailyGoals[Math.floor(R() * g.dailyGoals.length)];
    const goal = t.n[Math.floor(R() * t.n.length)];
    const lim = t.limit ? t.limit[Math.floor(R() * t.limit.length)] : null;
    return { ...t, goal, lim, label: t.text.replace('{n}', fmt(lim != null ? lim : goal)) };
  }
  const dailyLog = () => { const d = store.get('pb-daily-done') || {}; return d.date === today() ? d : { date: today(), games: {} }; };
  const challengeDone = g => !!dailyLog().games[g.id];
  const CHALLENGE_COINS = 50;
  let chal = null;  // the challenge being played right now
  function checkChallenge(){
    if (!chal || chal.done || chal.failed || !G.metrics) return;
    const m = G.metrics(), h = G.hud();
    if (chal.noHit && h.lives != null && h.lives < chal.lives0) return missChallenge('You got bumped! Try again for the goal.');
    if (chal.zero && m[chal.zero] > 0) return missChallenge('Try again without using it!');
    if (chal.max && chal.lim != null && m[chal.max] > chal.lim) return missChallenge('Too many! Try again for the goal.');
    chal.value = m[chal.m] || 0;
    if (chal.value >= chal.goal) {
      chal.done = true;
      const first = !challengeDone(G);
      if (first) { const d = dailyLog(); d.games[G.id] = true; store.set('pb-daily-done', d); wallet.add(CHALLENGE_COINS); }
      toast(first ? `Challenge complete! +${CHALLENGE_COINS} coins` : 'Challenge complete again!', true);
      if (PB.sfx) PB.sfx('life');
    }
  }
  function missChallenge(msg){ chal.failed = true; toast(msg, false); }
  let toastT = null;
  function toast(text, good){
    const t = $('toast'); t.innerHTML = (good ? coinSvg : '') + '<span></span>'; t.querySelector('span').textContent = text;
    t.className = 'toast ' + (good ? 'good' : 'meh'); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function progress(g){
    const p = store.get(g.id + '-progress') || {};
    return { unlocked: p.unlocked || 1, stars: p.stars || {}, best: p.best || {}, last: p.last || 1 };
  }
  const saveProgress = (g, p) => store.set(g.id + '-progress', p);
  const totalStars = p => Object.values(p.stars).reduce((a,b) => a + b, 0);

  // ---------- Games ----------
  const shell = {};
  const GAMES = {};
  PB.factories.map(f => f(shell)).forEach(g => GAMES[g.id] = g);
  PB.games = GAMES;
  const ordered = Object.values(GAMES).sort((a,b) => a.tile.order - b.tile.order);

  let G = null, mode = 'classic', phase = 'menu', level = 1, raf = null, last = 0, clock = 0;
  let cachedBest = 0, lastEntryId = null, lastScore = 0, overTimer = null;
  const play = $('play'), screen = $('screen');
  const views = { menu: $('vMenu'), help: $('vHelp'), over: $('vOver'), scores: $('vScores'), levels: $('vLevels'), level: $('vLevel') };
  function showView(name){ for (const k in views) views[k].hidden = k !== name; }

  // ---------- Hub ----------
  const flameSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff8a3d" d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.3 2.2-3.3C17.6 10.6 19 13 19 15.5 19 19.1 15.9 22 12 22s-7-2.9-7-6.5C5 10.6 9.6 7.6 12 2z"/></svg>';
  function refreshHub(){
    const s = streakInfo();
    $('hubStreak').innerHTML = flameSvg + (s.count ? `<b>${s.count}</b> day streak` : 'Start a streak today');
    paintCoins();
    const list = $('chalList'); list.innerHTML = '';
    let doneN = 0;
    for (const g of ordered) {
      const c = challengeFor(g); if (!c) continue;
      const done = challengeDone(g); if (done) doneN++;
      const b = document.createElement('button'); b.className = 'chal' + (done ? ' done' : '');
      b.innerHTML = `<span class="ck" aria-hidden="true">${done ? '\u2713' : ''}</span><span class="tx"><b></b><span></span></span><span class="rw">${done ? 'Done' : coinSvg + '+' + CHALLENGE_COINS}</span>`;
      b.querySelector('b').textContent = g.tile.name; b.querySelector('.tx span').textContent = c.label;
      b.setAttribute('aria-label', `${g.tile.name}: ${c.label}${done ? ', done' : ''}`);
      b.addEventListener('click', () => { openGame(g.id); startGame('daily'); });
      list.appendChild(b);
    }
    $('chalCount').textContent = `${doneN} of ${list.children.length} done`;
    for (const g of ordered) {
      const el = $('best-' + g.id); if (!el) continue;
      if (g.type === 'levels') { const p = progress(g); el.textContent = `Level ${Math.min(p.unlocked, g.levels)} \u00b7 \u2605 ${totalStars(p)}`; }
      else { const b = bestFor(g, 'classic'); el.textContent = b ? 'Best ' + fmt(b) : ''; }
    }
  }
  const grid = $('grid');
  const ACC = { bricks:'#ff3ddc', dash:'#ff9f1c', sweets:'#5ce1ff', potions:'#c77dff', cubes:'#3dffb5', racer:'#ff7a2f', castle:'#e0b43c', snake:'#7dd85a' };
  ordered.forEach((g, gi) => {
    const b = document.createElement('button');
    b.className = 'tile'; b.id = 'tile-' + g.id;
    b.style.setProperty('--acc', ACC[g.id] || '#22e4ff'); b.style.setProperty('--d', (gi * 0.06) + 's'); b.style.setProperty('--sd', (gi * 0.8) + 's');
    const c = document.createElement('canvas'); c.width = 480; c.height = 360; c.className = 'art';
    const x = c.getContext('2d'); x.scale(2,2); g.tile.art(x); x.shadowBlur = 0;
    b.appendChild(c);
    const tag = g.tile.isNew ? '<span class="badge new">New</span>' : '';
    b.insertAdjacentHTML('beforeend', `${tag}<span class="meta"><span class="name"></span><span class="kind"></span><span class="best" id="best-${g.id}"></span></span>`);
    b.querySelector('.name').textContent = g.tile.name; b.querySelector('.kind').textContent = g.tile.kind;
    b.addEventListener('click', () => openGame(g.id));
    grid.appendChild(b);
  });
  // featured game of the day, big at the top
  function buildHero(){
    const hero = $('hero'), list = ordered, g = list[seedFrom('hero-' + today()) % list.length];
    hero.innerHTML = ''; hero.style.setProperty('--acc', ACC[g.id] || '#ff3ddc');
    const src = $('tile-' + g.id).querySelector('canvas'), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0);
    hero.appendChild(c);
    const ch = challengeFor(g);
    hero.insertAdjacentHTML('beforeend', `<div class="in"><span class="ft">\u2605 FEATURED TODAY</span><span class="hn"></span><span class="hk"></span><div class="row"><span class="goal"></span><button class="playbtn">PLAY</button></div></div>`);
    hero.querySelector('.hn').textContent = g.tile.name; hero.querySelector('.hk').textContent = g.tile.kind;
    hero.querySelector('.goal').textContent = ch ? (challengeDone(g) ? '\u2713 Daily goal done' : '\u2605 ' + ch.label) : '';
    hero.onclick = () => openGame(g.id);
  }
  refreshHub(); buildHero();

  // ---------- Play screen ----------
  function fit(){
    const stage = screen.parentElement;
    const cs = getComputedStyle(stage);
    const w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8, h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 8;
    const s = Math.min(w/G.W, h/G.H);
    screen.style.width = Math.floor(G.W*s)+'px'; screen.style.height = Math.floor(G.H*s)+'px';
  }
  let prevHud = null;
  function soundCues(h){
    if (!PB.sfx || phase !== 'play') { prevHud = null; return; }
    const p = prevHud; prevHud = { lives: h.lives, score: h.score, stat: h.stat };
    if (!p) return;
    if (h.lives != null && p.lives != null) { if (h.lives < p.lives) PB.sfx('hurt'); else if (h.lives > p.lives) PB.sfx('life'); }
    const d = h.score - p.score;
    if (G.sfxScore !== false && d >= 5) PB.sfx('point', Math.log10(d) / 3);
    if (G.type !== 'levels' && G.statLabel === 'Level' && typeof h.stat === 'number' && h.stat > p.stat) PB.sfx('level');
  }
  function updateHud(){
    if (mode === 'daily' && phase === 'play') checkChallenge();
    const h = G.hud(); soundCues(h);
    $('hLives').hidden = h.lives == null;
    if (h.lives != null) $('hLives').textContent = '\u2665'.repeat(Math.max(h.lives, 0)) || '\u2013';
    $('hStatLabel').textContent = h.statLabel || G.statLabel;
    $('hStat').textContent = typeof h.stat === 'number' ? fmt(h.stat) : h.stat;
    $('hScore').textContent = fmt(h.score);
    $('hBest').textContent = fmt(Math.max(cachedBest, h.score));
    const tag = $('hMode');
    if (mode === 'daily' && phase !== 'menu') {
      tag.hidden = false;
      tag.textContent = !chal ? 'DAILY' : chal.done ? '\u2605 GOAL DONE' : chal.failed ? 'GOAL MISSED' : chal.m === 'won' || chal.m === 'timeLeft' || chal.m === 'left' ? '\u2605 GOAL' : `\u2605 ${fmt(Math.min(chal.value || 0, chal.goal))}/${fmt(chal.goal)}`;
    }
    else if (G.type === 'levels' && phase !== 'menu') { tag.hidden = false; tag.textContent = 'LEVEL ' + level; }
    else tag.hidden = true;
  }
  function renderList(el, m, highlightId){
    const l = listFor(G, m);
    el.innerHTML = l.length
      ? l.map((e,i) => `<li class="${e.id && e.id === highlightId ? 'me' : ''}"><span class="r">#${i+1}</span><span class="n"></span><span class="s">${fmt(e.score)}</span></li>`).join('')
      : `<li class="empty">${m === 'daily' ? 'No scores yet today. Be the first!' : 'No scores yet. Play a game!'}</li>`;
    if (l.length) [...el.querySelectorAll('.n')].forEach((n,i) => n.textContent = l[i].name);
  }

  function openMenu(){
    clearTimeout(overTimer);
    phase = 'menu'; mode = 'classic'; G.preview(); cachedBest = 0;
    const s = streakInfo(), shown = s.playedToday ? s.count : s.count + 1, b = streakBonus(shown);
    const lives = G.type !== 'levels';
    $('mTitle').textContent = G.title;
    $('mStreak').textContent = s.count ? `Day ${s.count} streak` : 'Start your streak';
    $('mBonus').textContent = s.playedToday
      ? (b && lives ? `Games start with +${b} bonus life` : 'Come back tomorrow to keep it going')
      : s.count ? `Play today to reach day ${shown}${b && lives ? ` and get +${b} bonus life` : ''}`
      : lives ? 'Play 3 days in a row for a bonus life' : 'Play every day to build your streak';
    if (G.type === 'levels') {
      const p = progress(G), next = Math.min(p.unlocked, G.levels);
      $('btnClassicLabel').textContent = `Play level ${next}`;
      $('mClassicBest').textContent = `\u2605 ${totalStars(p)} of ${G.levels * 3} stars`;
      $('btnLevels').hidden = false;
    } else {
      $('btnClassicLabel').textContent = 'Play';
      $('mClassicBest').textContent = 'Best: ' + fmt(bestFor(G, 'classic'));
      $('btnLevels').hidden = true;
    }
    if (PB.music) PB.music.duck(true);
    const c = challengeFor(G);
    $('mDailyBest').textContent = c ? (challengeDone(G) ? '\u2713 ' + c.label : c.label + ` \u00b7 +${CHALLENGE_COINS} coins`) : (G.dailyText || 'A new challenge every day');
    showView('menu');
  }
  function openHelp(){
    const hc = $('helpControls'); hc.innerHTML = '';
    G.controls.forEach(c => { const d = document.createElement('div'); d.textContent = c; hc.appendChild(d); });
    const ul = $('helpPowers'); ul.innerHTML = '';
    $('helpPowersTitle').textContent = G.powersTitle || 'Power-ups';
    G.powers.forEach(p => {
      const li = document.createElement('li');
      const c = document.createElement('canvas'); c.className = 'ic'; c.width = 92; c.height = 56;
      const g = c.getContext('2d'); g.scale(2,2); p.icon(g);
      li.appendChild(c);
      const t = document.createElement('span'); t.innerHTML = `<b></b><br><span class="d"></span>`;
      t.querySelector('b').textContent = p.name; t.querySelector('.d').textContent = p.desc;
      li.appendChild(t); ul.appendChild(li);
    });
    showView('help');
  }
  function openLevels(){
    const p = progress(G), box = $('levelGrid'); box.innerHTML = '';
    $('levelsStars').textContent = `\u2605 ${totalStars(p)} of ${G.levels * 3} stars`;
    for (let n = 1; n <= G.levels; n++) {
      const b = document.createElement('button');
      b.className = 'lvl'; b.id = 'lvl-' + n;
      const locked = n > p.unlocked, st = p.stars[n] || 0;
      b.disabled = locked;
      if (n === Math.min(p.unlocked, G.levels)) b.classList.add('current');
      b.innerHTML = locked ? `<span class="num">${n}</span><svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h6V8a3 3 0 0 0-6 0v2z"/></svg>` : `<span class="num">${n}</span><span class="stars">${'\u2605'.repeat(st)}<i>${'\u2605'.repeat(3 - st)}</i></span>`;
      b.setAttribute('aria-label', locked ? `Level ${n}, locked` : `Level ${n}, ${st} stars`);
      if (!locked) b.addEventListener('click', () => startGame('classic', n));
      box.appendChild(b);
    }
    showView('levels');
    const cur = box.querySelector('.current'); if (cur) cur.scrollIntoView({ block:'center' });
  }
  function startGame(m, lvl){
    clearTimeout(overTimer);
    const streakCoins = markPlayed();
    if (streakCoins) { wallet.add(streakCoins); setTimeout(() => toast(`Daily streak bonus +${streakCoins} coins`, true), 400); }
    refreshHub();
    mode = m; phase = 'play';
    const bonus = G.type === 'levels' ? 0 : streakBonus(streakInfo().count);
    const rand = m === 'daily' ? mulberry(seedFrom(G.id + '-' + today())) : Math.random;
    if (G.type === 'levels') {
      level = m === 'daily' ? 'daily' : (lvl || Math.min(progress(G).unlocked, G.levels));
      if (m !== 'daily') { const p = progress(G); p.last = level; saveProgress(G, p); cachedBest = p.best[level] || 0; }
      else cachedBest = bestFor(G, 'daily');
      G.start(m, rand, 0, null, level);
    } else {
      G.start(m, rand, Math.min(3 + bonus, G.maxLives), bonus ? `+${bonus} streak life!` : null);
      cachedBest = bestFor(G, m);
    }
    lastEntryId = null; prevHud = null;
    chal = m === 'daily' ? challengeFor(G) : null;
    if (chal) { chal.lives0 = G.hud().lives; chal.value = 0; setTimeout(() => { if (chal && phase === 'play') toast('Goal: ' + chal.label, false); }, 900); }
    if (PB.sfx) PB.sfx('start'); if (PB.music) PB.music.duck(false);
    showView(null);
  }

  // Endless games (and daily challenges) end here
  shell.gameOver = function(score, summary){
    if (mode === 'daily') checkChallenge();
    phase = 'over'; lastScore = Math.floor(score);
    const earned = coinsForScore(lastScore); wallet.add(earned);
    $('oCoins').innerHTML = coinSvg + `<span>+${fmt(earned)} coins</span>`;
    $('oChal').hidden = !chal; if (chal) { $('oChal').textContent = chal.done ? '\u2605 Daily goal complete!' : 'Daily goal: ' + chal.label + (chal.failed ? ' (missed)' : ''); $('oChal').className = 'chalres' + (chal.done ? ' ok' : ''); }
    const prevBest = bestFor(G, mode), q = qualifies(G, mode, lastScore);
    if (PB.sfx) PB.sfx(lastScore > prevBest && lastScore > 0 ? 'win' : 'lose'); if (PB.music) PB.music.duck(true);
    $('oTitle').textContent = mode === 'daily' ? 'Challenge over' : 'Game over';
    $('oScore').textContent = fmt(lastScore);
    $('oSummary').textContent = summary;
    const flag = $('oFlag');
    if (lastScore > prevBest && lastScore > 0) { flag.hidden = false; flag.textContent = 'New high score!'; }
    else if (q) { flag.hidden = false; flag.textContent = 'You made the top 10!'; }
    else flag.hidden = true;
    $('nameForm').hidden = !q;
    $('nameIn').value = store.get('pb-name') || store.get('bb-name') || '';
    renderList($('oList'), mode, null);
    if (q && !listFor(G, mode).length) $('oList').innerHTML = '<li class="empty">Add your name to be first on the board!</li>';
    overTimer = setTimeout(() => { showView('over'); if (q) $('nameIn').focus(); }, 700);
  };
  // Level games end here
  shell.levelDone = function({ win, stars, score, summary }){
    if (mode === 'daily') { shell.gameOver(score, summary); return; }
    phase = 'over'; lastScore = Math.floor(score);
    const firstClear = win && !(progress(G).stars[level] > 0);
    const earned = win ? 5 + stars * 3 + (firstClear ? 10 : 0) : 1; wallet.add(earned);
    $('lCoins').innerHTML = coinSvg + `<span>+${earned} coin${earned === 1 ? '' : 's'}${firstClear ? ' (first clear bonus!)' : ''}</span>`;
    if (PB.sfx) PB.sfx(win ? 'win' : 'lose'); if (PB.music) PB.music.duck(true);
    const p = progress(G);
    let newBest = false;
    if (win) {
      p.stars[level] = Math.max(p.stars[level] || 0, stars);
      if (lastScore > (p.best[level] || 0)) { newBest = !!p.best[level]; p.best[level] = lastScore; }
      if (level >= p.unlocked) p.unlocked = Math.min(level + 1, G.levels + 1);
      saveProgress(G, p); refreshHub();
    }
    $('lTitle').textContent = win ? `Level ${level} complete!` : (G.failTitle || 'Out of moves');
    $('lStars').innerHTML = [1,2,3].map(i => `<span class="${win && i <= stars ? 'on' : ''}">\u2605</span>`).join('');
    $('lStars').setAttribute('aria-label', win ? `${stars} of 3 stars` : 'No stars');
    $('lScore').textContent = fmt(lastScore);
    $('lSummary').textContent = summary;
    $('lFlag').hidden = !newBest; $('lFlag').textContent = 'New best for this level!';
    const next = $('btnNext');
    if (win && level < G.levels) { next.textContent = 'Next level'; next.onclick = () => startGame('classic', level + 1); }
    else if (win) { next.textContent = 'You beat every level!'; next.onclick = openLevels; }
    else { next.textContent = 'Try again'; next.onclick = () => startGame('classic', level); }
    $('btnReplay').hidden = !win;
    $('btnToLevels').style.gridColumn = win ? '' : '1 / -1';
    overTimer = setTimeout(() => showView('level'), win ? 900 : 700);
  };

  $('nameForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = ($('nameIn').value.trim() || 'Player').slice(0, 10);
    store.set('pb-name', name);
    lastEntryId = addScore(G, mode, name, lastScore);
    $('nameForm').hidden = true;
    renderList($('oList'), mode, lastEntryId);
    cachedBest = bestFor(G, mode); refreshHub();
  });
  function setTab(t){
    $('tabClassic').setAttribute('aria-selected', String(t === 'classic'));
    $('tabDaily').setAttribute('aria-selected', String(t === 'daily'));
    renderList($('sList'), t, lastEntryId);
  }
  $('btnClassic').addEventListener('click', () => startGame('classic'));
  $('btnDaily').addEventListener('click', () => startGame('daily'));
  $('btnLevels').addEventListener('click', openLevels);
  $('btnHelp').addEventListener('click', openHelp);
  $('btnHelpBack').addEventListener('click', () => showView('menu'));
  $('btnScores').addEventListener('click', () => {
    const lv = G.type === 'levels';
    $('tabClassic').hidden = lv;
    setTab(lv ? 'daily' : 'classic'); showView('scores');
  });
  $('btnScoresBack').addEventListener('click', () => showView('menu'));
  $('btnLevelsBack').addEventListener('click', openMenu);
  $('btnAgain').addEventListener('click', () => startGame(mode));
  $('btnMenu').addEventListener('click', openMenu);
  $('btnReplay').addEventListener('click', () => startGame('classic', level));
  $('btnToLevels').addEventListener('click', openLevels);
  $('tabClassic').addEventListener('click', () => setTab('classic'));
  $('tabDaily').addEventListener('click', () => setTab('daily'));

  function toGame(e){ const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (G.W / r.width), (e.clientY - r.top) * (G.H / r.height)]; }
  cv.addEventListener('pointerdown', e => { if (!G || phase !== 'play') return; try { cv.setPointerCapture(e.pointerId); } catch(_){} G.pointerDown(...toGame(e)); });
  cv.addEventListener('pointermove', e => { if (!G || phase !== 'play') return; G.pointerMove(...toGame(e)); });
  cv.addEventListener('pointerup', e => { if (!G || phase !== 'play') return; G.pointerUp(...toGame(e)); });
  cv.addEventListener('pointercancel', e => { if (!G || phase !== 'play') return; G.pointerUp(...toGame(e)); });
  window.addEventListener('keydown', e => { if (play.hidden || !G || phase !== 'play') return; G.key(e); });
  // Games like Brick Bash also follow a finger placed below or beside the game box
  const stageEl = screen.parentElement; stageEl.style.touchAction = 'none';
  const outside = e => e.target === stageEl && G && G.touchAnywhere && phase === 'play';
  stageEl.addEventListener('pointerdown', e => { if (!outside(e)) return; try { stageEl.setPointerCapture(e.pointerId); } catch(_){} G.pointerDown(...toGame(e)); });
  stageEl.addEventListener('pointermove', e => { if (G && G.touchAnywhere && phase === 'play' && stageEl.hasPointerCapture && stageEl.hasPointerCapture(e.pointerId)) G.pointerMove(...toGame(e)); });
  stageEl.addEventListener('pointerup', e => { if (G && G.touchAnywhere && phase === 'play' && stageEl.hasPointerCapture && stageEl.hasPointerCapture(e.pointerId)) G.pointerUp(...toGame(e)); });

  // Smooth out uneven frame times so movement doesn't stutter; allow up to 1/20 s per frame so slower phones don't go slow-motion
  let smooth = 1 / 60;
  function loop(t){
    const raw = Math.min(window.__pbMaxDt || 0.05, (t - last)/1000 || 0); last = t;
    smooth += (raw - smooth) * (Math.abs(raw - smooth) > 0.02 ? 1 : 0.2);
    const dt = window.__pbMaxDt ? raw : smooth; clock += dt;
    G.frame(dt, clock); updateHud();
    raf = requestAnimationFrame(loop);
  }
  function openGame(id){
    G = GAMES[id]; G.init();
    if (PB.gl3d) PB.gl3d.hide();
    if (PB.music) PB.music.play(G.music || id);
    play.dataset.game = id;
    cv.width = G.W * dpr; cv.height = G.H * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    $('hub').hidden = true; play.hidden = false;
    fit(); openMenu();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function closeGame(){
    clearTimeout(overTimer);
    cancelAnimationFrame(raf); raf = null; play.hidden = true; $('hub').hidden = false;
    if (PB.music) PB.music.play('hub');
    refreshHub(); $('tile-' + G.id).focus();
  }
  $('backBtn').addEventListener('click', closeGame);
  // ---------- Sound switches ----------
  const ICON = {
    music: on => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 18.5a3 3 0 1 1-2-2.83V5l12-2v12.5a3 3 0 1 1-2-2.83V7.4L9 8.8z"/>${on ? '' : '<path d="M3 3l18 18" stroke="#ff4766" stroke-width="2.6" stroke-linecap="round"/>'}</svg>`,
    sfx: on => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/>${on ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : '<path d="M16 9l5 6M21 9l-5 6" stroke="#ff4766" stroke-width="2.4" stroke-linecap="round"/>'}</svg>`,
  };
  function paintSound(){
    if (!PB.sound) return;
    const m = PB.sound.music, f = PB.sound.sfx;
    $('tglMusic').innerHTML = ICON.music(m) + (m ? 'Music' : 'Music off'); $('tglMusic').setAttribute('aria-pressed', String(m));
    $('tglSfx').innerHTML = ICON.sfx(f) + (f ? 'Sounds' : 'Sounds off'); $('tglSfx').setAttribute('aria-pressed', String(f));
    const any = m || f; $('muteBtn').innerHTML = ICON.sfx(any); $('muteBtn').setAttribute('aria-label', any ? 'Turn sound off' : 'Turn sound on');
  }
  if (PB.sound) {
    $('tglMusic').addEventListener('click', () => { PB.sound.setMusic(!PB.sound.music); if (PB.sound.music) PB.music.play(play.hidden ? 'hub' : (G.music || G.id)); paintSound(); });
    $('tglSfx').addEventListener('click', () => { PB.sound.setSfx(!PB.sound.sfx); paintSound(); });
    $('muteBtn').addEventListener('click', () => { const on = !(PB.sound.music || PB.sound.sfx); PB.sound.setSfx(on); PB.sound.setMusic(on); if (on) PB.music.play(G.music || G.id); paintSound(); });
    paintSound(); PB.music.play('hub');
  } else { $('tglMusic').hidden = true; $('tglSfx').hidden = true; $('muteBtn').hidden = true; }
  // a little click for every button
  document.addEventListener('click', e => { if (PB.sfx && e.target.closest && e.target.closest('button')) PB.sfx('click'); }, true);
  window.addEventListener('resize', () => { if (!play.hidden) fit(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { if (!play.hidden) fit(); }, 250));
  // In the installed phone app, the Android back button returns to the game list (or closes the app from there)
  try {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App) App.addListener('backButton', () => { if (!play.hidden) { if (phase === 'menu' && !views.menu.hidden) closeGame(); else openMenu(); } else App.exitApp(); });
  } catch (_) {}
  PB.shell = shell;
})();
