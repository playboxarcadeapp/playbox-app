// Playbox Plus: the subscription that unlocks everything. There are no ads either way.
//  - Free: 2 new levels per level game per day (retries and replays are free), 3 runs per endless game per day,
//    and the Daily Challenge. The Swag Shop and the daily gift need Plus.
//  - Plus: everything, unlimited. $2.99 a month or $19.99 a year (prices come from the store, never hard-coded).
//  - Buying goes straight to Apple / Google through the @capgo/native-purchases plugin. No accounts, no servers,
//    nothing sent anywhere by us. Every purchase screen sits behind a grown-ups-only question.
(() => {
  const { store } = PB;
  const FREE = { levels: 2, runs: 3 };
  // Product IDs (the same on both stores). Android also needs the base plan ID of each product.
  const PLANS = {
    yearly:  { id: 'playbox_plus_yearly',  base: 'yearly',  per: 'year' },
    monthly: { id: 'playbox_plus_monthly', base: 'monthly', per: 'month' },
  };
  const IDS = [PLANS.yearly.id, PLANS.monthly.id];
  const LINKS = {
    terms: 'https://playboxarcadeapp.github.io/playbox-app/terms.html',
    privacy: 'https://playboxarcadeapp.github.io/playbox-app/privacy.html',
  };
  const cap = window.Capacitor, NP = cap && cap.Plugins && cap.Plugins.NativePurchases;
  const platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';
  const native = !!NP && (platform === 'ios' || platform === 'android');
  const storeName = platform === 'android' ? 'Google Play' : 'Apple ID';

  // ---------- is Plus on? (remembered so it works offline; re-checked with the store at every launch) ----------
  let state = store.get('pb-plus') || { on: false, exp: null };
  if (!native && store.get('pb-plus-dev')) state = { on: true, exp: null };   // testing in a browser only
  const isOn = () => !!state.on && (!state.exp || Date.parse(state.exp) > Date.now() - 3 * 864e5);
  const listeners = [];
  function setOn(on, exp){
    const was = isOn(); state = { on: !!on, exp: exp || null, checked: Date.now() }; store.set('pb-plus', state);
    if (was !== isOn()) listeners.forEach(f => { try { f(isOn()); } catch (_) {} });
  }
  async function refresh(){
    if (!native) return isOn();
    try {
      const { purchases } = await NP.getPurchases(platform === 'ios' ? { productType: 'subs', onlyCurrentEntitlements: true } : { productType: 'subs' });
      const live = (purchases || []).filter(t => IDS.includes(t.productIdentifier) && !t.revocationDate &&
        (platform === 'ios' ? t.isActive !== false : String(t.purchaseState) === '1'));
      const exp = live.map(t => t.expirationDate).filter(Boolean).sort().pop() || null;
      setOn(live.length > 0, exp);
    } catch (e) { /* offline or store busy: keep what we knew */ }
    return isOn();
  }

  // ---------- free play counter (resets every day) ----------
  function day(){ const d = store.get('pb-free'); return d && d.day === PB.today() ? d : { day: PB.today(), wins: {}, runs: {} }; }
  const left = g => { if (isOn()) return Infinity; const d = day(); return g.type === 'levels' ? Math.max(0, FREE.levels - (d.wins[g.id] || 0)) : Math.max(0, FREE.runs - (d.runs[g.id] || 0)); };
  function bump(kind, id){ const d = day(); d[kind][id] = (d[kind][id] || 0) + 1; store.set('pb-free', d); }

  // ---------- products ----------
  let products = null, loading = null;
  async function loadProducts(){
    if (!native) return null;
    if (products) return products;
    if (loading) return loading;
    loading = (async () => {
      try {
        const { products: list } = await NP.getProducts({ productIdentifiers: IDS, productType: 'subs' });
        const out = {};
        for (const [k, p] of Object.entries(PLANS)) {
          let base, trialOffer = null;
          if (platform === 'android') {
            // one entry per offer: the base plan (offerId null) plus any offer the shopper can get, like the free trial
            const mine = (list || []).filter(x => (x.planIdentifier === p.id || x.identifier === p.id) && (x.identifier === p.base || x.identifier === p.id));
            base = mine.find(x => !x.offerId) || mine[0];
            trialOffer = mine.find(x => x.offerId) || null;
          } else base = (list || []).find(x => x.identifier === p.id);
          if (!base) continue;
          const ip = platform === 'ios' ? base.introductoryPrice : trialOffer && trialOffer.introductoryPrice;
          let trial = null;
          if (platform === 'ios' && ip && ip.price === 0 && base.introEligibility !== 1) trial = trialText(ip);
          else if (platform === 'android' && trialOffer) trial = ip && ip.price === 0 ? trialText(ip) : 'Free trial';
          out[k] = { ...p, price: base.price, priceString: base.priceString, trial, offerToken: trialOffer ? trialOffer.offerToken : base.offerToken, family: !!base.isFamilyShareable };
        }
        products = out.yearly || out.monthly ? out : null;
      } catch (e) { products = null; }
      loading = null; return products;
    })();
    return loading;
  }
  function trialText(ip){
    const sp = ip.subscriptionPeriod || {}, n = (sp.numberOfUnits || 1) * (ip.numberOfPeriods || 1), u = sp.unitString || ['day', 'week', 'month', 'year'][sp.unit] || 'day';
    const days = u === 'week' ? n * 7 : u === 'day' ? n : null;
    return days ? `${days}-day free trial` : `${n}-${u} free trial`;
  }

  async function buy(k){
    const p = PLANS[k], info = products && products[k];
    const opts = { productIdentifier: p.id, productType: 'subs', quantity: 1 };
    if (platform === 'android') { opts.planIdentifier = p.base; if (info && info.offerToken) opts.offerToken = info.offerToken; }
    const t = await NP.purchaseProduct(opts);
    if (platform === 'android' && String(t.purchaseState) === '2') return 'pending';
    setOn(true, t.expirationDate || null); refresh(); return 'ok';
  }
  async function restore(){ if (!native) return false; try { await NP.restorePurchases(); } catch (_) {} return refresh(); }

  if (native) {
    refresh();
    try { NP.addListener('transactionUpdated', () => refresh()); } catch (_) {}
    try { const App = cap.Plugins.App; if (App) App.addListener('resume', () => refresh()); } catch (_) {}
  }

  // ---------- the screens: grown-ups question, then Playbox Plus ----------
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  let root = null, onDone = null;
  function shell(){
    if (!root) { root = el('div', 'plusModal'); root.id = 'plusModal'; root.hidden = true; document.body.appendChild(root);
      root.addEventListener('click', e => { if (e.target === root) close(); }); }
    root.innerHTML = ''; root.hidden = false;
    const card = el('div', 'pcard'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    const x = el('button', 'px', '✕'); x.setAttribute('aria-label', 'Close'); x.onclick = close; card.appendChild(x);
    root.appendChild(card); return card;
  }
  function close(){ if (root) root.hidden = true; const f = onDone; onDone = null; if (f) f(isOn()); }

  // A question a young child can't answer: a times-table sum written in words, typed on a keypad.
  function gate(next){
    const card = shell(), a = 6 + Math.floor(Math.random() * 4), b = 3 + Math.floor(Math.random() * 7), ans = String(a * b);
    card.classList.add('gate');
    card.innerHTML += `<div class="gi">\u{1F46A}</div><h3>Ask a grown-up</h3><p class="psub">Grown-ups: answer to continue.</p>
      <p class="gq">What is ${WORDS[a]} times ${WORDS[b]}?</p><div class="gin" aria-live="polite"></div><div class="gkeys"></div><p class="gerr" hidden>Not quite. Here is a new one.</p>`;
    let v = '';
    const show = () => { card.querySelector('.gin').textContent = v || ' '; };
    const keys = card.querySelector('.gkeys');
    for (const k of ['1','2','3','4','5','6','7','8','9','⌫','0','OK']) {
      const kb = el('button', 'gk' + (k === 'OK' ? ' ok' : ''), k); kb.setAttribute('aria-label', k === '⌫' ? 'Delete' : k);
      kb.onclick = () => {
        if (k === '⌫') v = v.slice(0, -1);
        else if (k === 'OK') { if (v === ans) { next(); return; } gate(next); root.querySelector('.gerr').hidden = false; return; }
        else if (v.length < 3) v += k;
        show();
      };
      keys.appendChild(kb);
    }
    show();
  }

  async function panel(){
    const card = shell(); card.classList.add('plus');
    const on = isOn();
    card.innerHTML += `<div class="pstar">⭐</div><h3>Playbox Plus</h3>
      <p class="psub">${on ? 'You have Playbox Plus. Thank you!' : 'All of Playbox, unlimited. Still no ads, ever.'}</p>
      <ul class="pben">
        <li><b>All 500 levels</b> in Castle Crash, Gem Mine, Potion Sort, Cube Escape and Galaxy Racer</li>
        <li><b>Unlimited play</b> in every game, every day</li>
        <li><b>Swag Shop</b>: outfits, ships, colors and power-ups</li>
        <li><b>Daily gifts</b> and treasure chests</li>
      </ul><div class="pbody"></div>`;
    const body = card.querySelector('.pbody');
    const links = el('div', 'plinks');
    const mk = (txt, fn) => { const b = el('button', 'plink', txt); b.onclick = fn; links.appendChild(b); return b; };
    const open = url => { const a = el('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };

    if (on) {
      const exp = state.exp ? new Date(state.exp) : null;
      body.appendChild(el('p', 'pnote', exp ? `Renews or ends on ${exp.toLocaleDateString()}.` : 'Your subscription is active.'));
      if (native) { const m = el('button', 'pbuy', 'Manage subscription'); m.onclick = () => NP.manageSubscriptions().catch(() => {}); body.appendChild(m); }
      const d = el('button', 'pbuy ghost', 'Let’s play!'); d.onclick = close; body.appendChild(d);
    } else if (!native) {
      body.appendChild(el('p', 'pnote', 'Playbox Plus is available in the Playbox app from the App Store and Google Play.'));
    } else {
      body.appendChild(el('p', 'pnote', 'Loading prices…'));
      const pr = await loadProducts();
      if (root.hidden || !card.isConnected) return;
      body.innerHTML = '';
      if (!pr) {
        body.appendChild(el('p', 'pnote', `Couldn’t reach ${platform === 'android' ? 'Google Play' : 'the App Store'}. Check the internet connection and try again.`));
        const r = el('button', 'pbuy', 'Try again'); r.onclick = () => { products = null; panel(); }; body.appendChild(r);
      } else {
        let pick = pr.yearly ? 'yearly' : 'monthly';
        const save = pr.yearly && pr.monthly && pr.monthly.price > 0 ? Math.round((1 - pr.yearly.price / (pr.monthly.price * 12)) * 100) : 0;
        const plans = el('div', 'pplans');
        for (const k of ['yearly', 'monthly']) { const p = pr[k]; if (!p) continue;
          const c = el('button', 'pplan' + (k === pick ? ' on' : ''));
          c.innerHTML = `${k === 'yearly' && save > 0 ? `<i class="ptag">Save ${save}%</i>` : ''}<b>${k === 'yearly' ? 'Yearly' : 'Monthly'}</b>
            <span class="pp">${esc(p.priceString)} / ${p.per}</span><small>${p.trial ? esc(p.trial) + ', then ' + esc(p.priceString) + ' / ' + p.per : k === 'yearly' && pr.monthly ? 'Best value' : 'Cancel any time'}</small>`;
          c.onclick = () => { pick = k; plans.querySelectorAll('.pplan').forEach(z => z.classList.remove('on')); c.classList.add('on'); paint(); };
          plans.appendChild(c); }
        body.appendChild(plans);
        if ((pr.yearly || pr.monthly).family) body.appendChild(el('p', 'pnote', 'One subscription covers the whole family with Family Sharing.'));
        const go = el('button', 'pbuy'); body.appendChild(go);
        const msg = el('p', 'pmsg'); msg.hidden = true; body.appendChild(msg);
        const fine = el('p', 'pfine'); body.appendChild(fine);
        const paint = () => { const p = pr[pick];
          go.textContent = p.trial ? 'Start free trial' : 'Subscribe';
          fine.textContent = `${p.trial ? `${p.trial}, then ` : ''}${p.priceString} per ${p.per}. Payment is charged to your ${storeName} account ${p.trial ? 'when the free trial ends' : 'when you confirm'}. The subscription renews automatically unless it is canceled at least 24 hours before the end of the current period. Manage or cancel any time in your ${storeName} account settings.`; };
        paint();
        go.onclick = async () => {
          go.disabled = true; msg.hidden = true;
          try {
            const r = await buy(pick);
            if (r === 'pending') { msg.textContent = 'Almost there! Plus turns on as soon as the payment goes through.'; msg.hidden = false; }
            else { celebrate(); return; }
          } catch (e) {
            const t = String((e && (e.message || e.code)) || '');
            if (!/cancel/i.test(t)) { msg.textContent = 'The purchase didn’t go through. Nothing was charged. Please try again.'; msg.hidden = false; }
          }
          go.disabled = false;
        };
      }
    }
    if (native && !on) mk('Restore purchases', async e => { const b = e.currentTarget; b.disabled = true; b.textContent = 'Checking…'; const ok = await restore();
      if (ok) celebrate(); else { b.disabled = false; b.textContent = 'No subscription found'; setTimeout(() => { b.textContent = 'Restore purchases'; }, 2500); } });
    mk('Terms of Use', () => open(LINKS.terms)); mk('Privacy Policy', () => open(LINKS.privacy));
    card.appendChild(links);
  }
  function celebrate(){
    const card = shell(); card.classList.add('plus');
    card.innerHTML += `<div class="pstar big">\u{1F389}</div><h3>Welcome to Playbox Plus!</h3><p class="psub">Every level, every game, unlimited. Have fun!</p>`;
    const b = el('button', 'pbuy', 'Let’s play!'); b.onclick = close; card.appendChild(b);
    if (PB.sfx) PB.sfx('fanfare');
  }

  PB.plus = {
    FREE, PLANS, on: isOn, left, refresh, restore, loadProducts,
    countWin: id => bump('wins', id), useRun: id => bump('runs', id),
    onChange: f => listeners.push(f),
    // open the Plus screen (always behind the grown-ups question); done(on) runs when it closes
    open(done){ onDone = done || null; gate(() => panel()); },
  };
})();
