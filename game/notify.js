// Friendly reminders, scheduled on the device itself (Capacitor Local Notifications).
// Nothing is sent to a server, so Playbox still collects no data.
//  - Asked politely after a child has played on 2 different days (never on first launch), then the system asks.
//  - A "Reminders" switch in the hub turns them on or off at any time.
//  - At most one reminder a day, in the late afternoon: tomorrow (streak, daily gift or free levels back),
//    and a "we miss you" in 3 days and 7 days. Every time the app opens or closes they are rescheduled,
//    so a child who keeps playing never gets the "miss you" ones.
(() => {
  const { $, store, today } = PB;
  const cap = window.Capacitor, LN = cap && cap.Plugins && cap.Plugins.LocalNotifications;
  const platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';
  const native = !!LN && (platform === 'ios' || platform === 'android');
  const IDS = [9101, 9103, 9107], HOUR = 16, MIN = 30;   // 4:30 pm local time
  const pref = () => store.get('pb-notify') || { on: false, asked: false, days: 0, lastDay: null };
  const save = p => store.set('pb-notify', p);

  // count the days Playbox was opened (to know when to ask)
  { const p = pref(); if (p.lastDay !== today()) { p.days = (p.days || 0) + 1; p.lastDay = today(); save(p); } }

  const at = (days) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(HOUR, MIN, 0, 0); return d; };
  const pick = list => list[Math.floor(Math.random() * list.length)];
  function messages(){
    const s = store.get('pb-streak') || { last: null, count: 0 }, playedToday = s.last === today(), plus = PB.plus && PB.plus.on();
    let tomorrow;
    if (s.count >= 2 && playedToday) tomorrow = { title: `\u{1F525} ${s.count}-day streak!`, body: `Play today to reach day ${s.count + 1}. Don't let it slip!` };
    else if (plus) tomorrow = { title: '\u{1F381} Your daily gift is ready!', body: 'Open it to see what you got today.' };
    else tomorrow = { title: '\u{1F3AE} Your free levels are back!', body: '2 new levels in every game are waiting for you.' };
    const miss = pick([
      { title: '\u{1F99D} The raccoon misses you!', body: 'Zoom Dash has a beach, a jungle and a volcano to explore.' },
      { title: '\u{1F680} Your starfighter is waiting', body: 'Can you win the next race in Galaxy Racer?' },
      { title: '\u{1F3F0} The goblins are laughing at you!', body: 'Come back and bonk them in Castle Crash.' },
      { title: '\u{1F48E} New gems to mine', body: 'Gem Mine has a fresh level ready for you.' },
    ]);
    const week = { title: '✨ A new week in Playbox!', body: 'Come see what’s new this week.' };
    return [tomorrow, miss, week];
  }
  async function permission(){ try { return (await LN.checkPermissions()).display; } catch (_) { return 'denied'; } }
  async function reschedule(){
    if (!native) return;
    try { await LN.cancel({ notifications: IDS.map(id => ({ id })) }); } catch (_) {}
    if (!pref().on || await permission() !== 'granted') return;
    const m = messages(), when = [at(1), at(3), at(7)];
    try { await LN.schedule({ notifications: IDS.map((id, i) => ({ id, title: m[i].title, body: m[i].body, schedule: { at: when[i], allowWhileIdle: false } })) }); } catch (_) {}
  }
  async function turnOn(){
    const p = pref(); p.asked = true;
    let perm = await permission();
    if (perm !== 'granted') { try { perm = (await LN.requestPermissions()).display; } catch (_) {} }
    p.on = perm === 'granted'; save(p); paint(); reschedule();
    if (!p.on && PB.meta && PB.meta.banner) PB.meta.banner('Notifications are off for Playbox. A grown-up can turn them on in the phone’s Settings.', false);
    return p.on;
  }
  function turnOff(){ const p = pref(); p.on = false; p.asked = true; save(p); paint(); reschedule(); }

  // ---- hub switch ----
  function paint(){
    const b = $('tglRemind'); if (!b) return;
    b.hidden = !native; const on = pref().on;
    b.textContent = on ? '\u{1F514} Reminders' : 'Reminders off'; b.setAttribute('aria-pressed', String(on));
  }
  // ---- the polite question (before the system's own one) ----
  function softAsk(){
    const box = document.createElement('div'); box.id = 'remindAsk'; box.className = 'plusModalLike';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<div class="pcard"><div class="pstar">\u{1F514}</div><h3>Want a reminder?</h3><p class="psub">We can let you know when your daily gift is ready or your streak needs you. Just one a day, at most.</p><button class="pbuy">Yes, please!</button><button class="pbuy ghost">No thanks</button></div>`;
    const [yes, no] = box.querySelectorAll('button');
    const done = () => box.remove();
    yes.onclick = async () => { done(); await turnOn(); };
    no.onclick = () => { const p = pref(); p.asked = true; save(p); done(); paint(); };
    document.body.appendChild(box);
  }
  function maybeAsk(){
    const p = pref();
    if (!native || p.asked || p.on || (p.days || 0) < 2) return;
    if (document.getElementById('hub').hidden || !document.getElementById('metaModal').hidden || (document.getElementById('plusModal') && !document.getElementById('plusModal').hidden)) return;
    softAsk();
  }

  if (native) {
    const b = $('tglRemind');
    if (b) b.addEventListener('click', () => { if (pref().on) turnOff(); else turnOn(); });
    paint(); reschedule();
    try { const App = cap.Plugins.App; if (App) { App.addListener('pause', () => reschedule()); App.addListener('resume', () => paint()); } } catch (_) {}
    // ask once the hub is free (not behind the daily gift or another popup); try a few times
    let tries = 0; const t = setInterval(() => { maybeAsk(); if (++tries >= 8 || pref().asked) clearInterval(t); }, 4000);
  } else { const b = $('tglRemind'); if (b) b.hidden = true; }

  PB.notify = { reschedule, turnOn, turnOff, native, messages, pref };
})();
