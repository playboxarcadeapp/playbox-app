// Music and sound effects, all made on the fly with the Web Audio API (no sound files, nothing downloaded).
// PB.sfx(name)            play a short sound effect
// PB.music.play(theme)    start a looping tune for a game (or 'hub'), PB.music.stop()
// PB.sound.music / .sfx   on/off switches, saved on the device
(function(){
  const store = PB.store;
  const saved = store.get('pb-sound') || {};
  const sound = { music: saved.music !== false, sfx: saved.sfx !== false };
  let ac = null, master, musicBus, sfxBus, noiseBuf;
  const save = () => store.set('pb-sound', { music: sound.music, sfx: sound.sfx });

  function boot(){
    if (ac) { if (ac.state === 'suspended' && !document.hidden) ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = sound.music ? 0.32 : 0; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = sound.sfx ? 0.6 : 0; sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  // Browsers only allow sound after the first touch, so we start the audio engine then
  const unlock = () => { if (boot()) { if (ac.state === 'suspended') ac.resume(); if (want && !timer) music.play(want); } };
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- instruments ----------
  function env(g, t, a, peak, dec, sus, rel, len){
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + dec);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + Math.max(a + dec, len));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + dec, len) + rel);
    return t + Math.max(a + dec, len) + rel + 0.05;
  }
  function voice(bus, t, freq, o){
    const g = ac.createGain(); let out = g;
    if (o.cut) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.cut, t); if (o.cutEnd) f.frequency.exponentialRampToValueAtTime(o.cutEnd, t + (o.cutT || 0.3)); g.connect(f); out = f; }
    if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = o.pan; out.connect(p); out = p; }
    out.connect(bus);
    const end = env(g, t, o.a || 0.005, o.vol || 0.2, o.d || 0.2, o.s == null ? 0.3 : o.s, o.r || 0.1, o.len || 0.1);
    const types = Array.isArray(o.type) ? o.type : [o.type || 'triangle'];
    types.forEach((ty, i) => {
      const osc = ac.createOscillator(); osc.type = ty;
      const det = (o.detune || 0) * (i % 2 ? 1 : -1) * (types.length > 1 ? 1 : 0);
      osc.frequency.setValueAtTime(freq * (o.mult ? o.mult[i] || 1 : 1), t); osc.detune.value = det;
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + (o.slideT || 0.15));
      if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib; lg.gain.value = freq * 0.012; l.connect(lg); lg.connect(osc.frequency); l.start(t + 0.12); l.stop(end); }
      osc.connect(g); osc.start(t); osc.stop(end);
    });
  }
  function noise(bus, t, o){
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = o.ft || 'highpass'; f.frequency.setValueAtTime(o.f || 6000, t); f.Q.value = o.q || 0.7;
    if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t + (o.len || 0.1));
    const g = ac.createGain(); src.connect(f); f.connect(g); g.connect(bus);
    g.gain.setValueAtTime(o.vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.len || 0.05));
    src.start(t, Math.random() * 0.5); src.stop(t + (o.len || 0.05) + 0.02);
  }
  const DRUM = {
    k: (b, t, v) => voice(b, t, 140, { type: 'sine', slide: 0.3, slideT: 0.12, vol: 0.55 * v, d: 0.16, s: 0.01, r: 0.05, len: 0.02 }),
    s: (b, t, v) => { noise(b, t, { ft: 'bandpass', f: 1800, q: 0.8, vol: 0.22 * v, len: 0.13 }); voice(b, t, 220, { type: 'triangle', slide: 0.6, vol: 0.12 * v, d: 0.07, s: 0.01, len: 0.01 }); },
    h: (b, t, v) => noise(b, t, { f: 8000, vol: 0.06 * v, len: 0.035 }),
    o: (b, t, v) => noise(b, t, { f: 7000, vol: 0.05 * v, len: 0.16 }),
    c: (b, t, v) => { for (const dt of [0, 0.012, 0.024]) noise(b, t + dt, { ft: 'bandpass', f: 1400, q: 1.2, vol: 0.13 * v, len: 0.06 }); },
    b: (b, t, v) => voice(b, t, 320, { type: 'sine', slide: 0.75, slideT: 0.08, vol: 0.28 * v, d: 0.1, s: 0.01, len: 0.01 }),
    B: (b, t, v) => voice(b, t, 220, { type: 'sine', slide: 0.75, slideT: 0.08, vol: 0.3 * v, d: 0.12, s: 0.01, len: 0.01 }),
    t: (b, t, v) => voice(b, t, 2600, { type: 'sine', vol: 0.05 * v, d: 0.05, s: 0.01, len: 0.01 }),
  };

  // ---------- sound effects ----------
  let lastSfx = {};
  const SFX = {
    click: t => voice(sfxBus, t, 880, { type: 'triangle', vol: 0.18, d: 0.05, s: 0.01, len: 0.01, slide: 1.4, slideT: 0.04 }),
    tap: t => voice(sfxBus, t, 660, { type: 'sine', vol: 0.1, d: 0.04, s: 0.01, len: 0.01 }),
    point: (t, x) => { const f = 700 * Math.pow(2, Math.min(1, (x || 0)) ); voice(sfxBus, t, f, { type: 'square', vol: 0.07, d: 0.06, s: 0.01, len: 0.02, cut: 4000 }); voice(sfxBus, t + 0.045, f * 1.5, { type: 'square', vol: 0.06, d: 0.08, s: 0.01, len: 0.02, cut: 4000 }); },
    coin: t => { voice(sfxBus, t, 988, { type: 'square', vol: 0.08, d: 0.05, s: 0.3, len: 0.05, r: 0.05, cut: 5000 }); voice(sfxBus, t + 0.07, 1319, { type: 'square', vol: 0.08, d: 0.12, s: 0.2, len: 0.08, r: 0.12, cut: 5000 }); },
    power: t => [523, 659, 784, 1047, 1319].forEach((f, i) => voice(sfxBus, t + i * 0.055, f, { type: ['triangle', 'square'], mult: [1, 2], vol: 0.09, d: 0.1, s: 0.2, len: 0.04, r: 0.1, cut: 5000 })),
    life: t => [784, 988, 1175, 1568].forEach((f, i) => voice(sfxBus, t + i * 0.08, f, { type: 'triangle', vol: 0.16, d: 0.15, s: 0.3, len: 0.05, r: 0.15 })),
    hurt: t => { voice(sfxBus, t, 300, { type: 'sawtooth', slide: 0.35, slideT: 0.35, vol: 0.16, d: 0.3, s: 0.1, len: 0.1, cut: 1800 }); noise(sfxBus, t, { ft: 'lowpass', f: 1200, vol: 0.18, len: 0.2 }); },
    crash: t => { noise(sfxBus, t, { ft: 'lowpass', f: 2400, fEnd: 300, vol: 0.28, len: 0.35 }); voice(sfxBus, t, 110, { type: 'sine', slide: 0.5, vol: 0.3, d: 0.2, s: 0.01, len: 0.02 }); },
    bonk: t => { voice(sfxBus, t, 520, { type: 'sine', slide: 0.45, slideT: 0.18, vol: 0.32, d: 0.22, s: 0.01, len: 0.02 }); voice(sfxBus, t + 0.12, 900, { type: 'triangle', slide: 1.6, slideT: 0.2, vol: 0.14, d: 0.25, s: 0.05, len: 0.05 }); },
    jump: t => voice(sfxBus, t, 330, { type: 'square', slide: 2.2, slideT: 0.16, vol: 0.09, d: 0.16, s: 0.05, len: 0.05, cut: 3000 }),
    whoosh: t => noise(sfxBus, t, { ft: 'bandpass', f: 600, fEnd: 2600, q: 1.5, vol: 0.2, len: 0.25 }),
    launch: t => { noise(sfxBus, t, { ft: 'bandpass', f: 400, fEnd: 1800, q: 1, vol: 0.25, len: 0.3 }); voice(sfxBus, t, 160, { type: 'triangle', slide: 0.6, vol: 0.2, d: 0.15, s: 0.01, len: 0.02 }); },
    shoot: t => voice(sfxBus, t, 1400, { type: 'square', slide: 0.3, slideT: 0.12, vol: 0.06, d: 0.12, s: 0.01, len: 0.02, cut: 4000 }),
    boom: t => { noise(sfxBus, t, { ft: 'lowpass', f: 1600, fEnd: 120, vol: 0.4, len: 0.6 }); voice(sfxBus, t, 80, { type: 'sine', slide: 0.4, slideT: 0.4, vol: 0.4, d: 0.4, s: 0.01, len: 0.02 }); },
    swap: t => voice(sfxBus, t, 500, { type: 'sine', slide: 1.5, slideT: 0.1, vol: 0.14, d: 0.1, s: 0.01, len: 0.02 }),
    pour: t => { for (let i = 0; i < 6; i++) voice(sfxBus, t + i * 0.06, 500 + i * 90 + Math.random() * 60, { type: 'sine', slide: 1.4, slideT: 0.05, vol: 0.09, d: 0.06, s: 0.01, len: 0.01 }); },
    gem: (t, x) => { const f = 1200 * Math.pow(2, Math.min(1, x || 0)); voice(sfxBus, t, f, { type: 'sine', vol: 0.12, d: 0.4, s: 0.01, len: 0.01 }); voice(sfxBus, t, f * 2.76, { type: 'sine', vol: 0.05, d: 0.25, s: 0.01, len: 0.01 }); },
    eat: t => { voice(sfxBus, t, 260, { type: 'square', slide: 1.8, slideT: 0.07, vol: 0.08, d: 0.07, s: 0.01, len: 0.02, cut: 2500 }); voice(sfxBus, t + 0.07, 420, { type: 'square', slide: 1.5, slideT: 0.06, vol: 0.07, d: 0.07, s: 0.01, len: 0.02, cut: 2500 }); },
    level: t => [523, 659, 784, 1047].forEach((f, i) => voice(sfxBus, t + i * 0.09, f, { type: ['triangle', 'sine'], mult: [1, 2], vol: 0.14, d: 0.2, s: 0.25, len: 0.06, r: 0.2 })),
    start: t => [392, 523, 659].forEach((f, i) => voice(sfxBus, t + i * 0.07, f, { type: 'triangle', vol: 0.15, d: 0.12, s: 0.2, len: 0.04, r: 0.12 })),
    win: t => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => voice(sfxBus, t + i * 0.1, f, { type: ['triangle', 'square'], mult: [1, 1], vol: i === 6 ? 0.12 : 0.09, d: 0.15, s: 0.3, len: i === 6 ? 0.5 : 0.06, r: 0.25, cut: 4000 })); },
    lose: t => [392, 370, 349, 294].forEach((f, i) => voice(sfxBus, t + i * 0.2, f, { type: 'triangle', vol: 0.16, d: 0.2, s: 0.4, len: i === 3 ? 0.5 : 0.12, r: 0.25, vib: i === 3 ? 6 : 0 })),
  };
  PB.sfx = function(name, x){
    if (!sound.sfx || !ac || ac.state !== 'running' || !SFX[name]) return;
    const now = ac.currentTime;
    if (lastSfx[name] && now - lastSfx[name] < 0.045) return; // don't stack the same sound
    lastSfx[name] = now;
    try { SFX[name](now + 0.005, x); } catch (e) {}
  };

  // ---------- music ----------
  // Each game gets its own little tune: tempo, key, scale, chords, instruments and drum groove.
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], penta: [0, 2, 4, 7, 9], mixo: [0, 2, 4, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11] };
  const LEAD = {
    chip: { type: 'square', vol: 0.07, d: 0.12, s: 0.4, r: 0.06, cut: 3200 },
    bell: { type: ['sine', 'sine'], mult: [1, 3.01], vol: 0.12, d: 0.5, s: 0.05, r: 0.3 },
    marimba: { type: ['sine', 'sine'], mult: [1, 4], vol: 0.16, d: 0.25, s: 0.01, r: 0.1 },
    pluck: { type: 'sawtooth', vol: 0.1, d: 0.25, s: 0.05, r: 0.1, cut: 3000, cutEnd: 500, cutT: 0.25 },
    flute: { type: 'sine', a: 0.04, vol: 0.12, d: 0.1, s: 0.7, r: 0.12, vib: 5 },
    synth: { type: ['sawtooth', 'sawtooth'], detune: 9, vol: 0.06, d: 0.2, s: 0.5, r: 0.1, cut: 2600, q: 3 },
    whistle: { type: 'triangle', a: 0.02, vol: 0.12, d: 0.08, s: 0.6, r: 0.08, vib: 6 },
    celesta: { type: ['triangle', 'sine'], mult: [1, 2], vol: 0.11, d: 0.4, s: 0.05, r: 0.3 },
  };
  const BASS = {
    round: { type: 'triangle', vol: 0.22, d: 0.2, s: 0.4, r: 0.06 },
    synth: { type: 'sawtooth', vol: 0.14, d: 0.15, s: 0.3, r: 0.05, cut: 700, q: 4 },
    pluck: { type: 'triangle', vol: 0.22, d: 0.3, s: 0.05, r: 0.05 },
    sub: { type: 'sine', vol: 0.3, d: 0.3, s: 0.5, r: 0.06 },
  };
  const PAD = {
    soft: { type: ['triangle', 'sine'], mult: [1, 2], a: 0.3, vol: 0.035, d: 0.5, s: 0.7, r: 0.6 },
    glass: { type: ['sine', 'sine'], mult: [1, 2.005], a: 0.2, vol: 0.04, d: 0.6, s: 0.5, r: 0.8 },
    strings: { type: ['sawtooth', 'sawtooth'], detune: 8, a: 0.4, vol: 0.02, d: 0.6, s: 0.8, r: 0.6, cut: 1400 },
  };
  // drums: 16 steps per bar; letters are drum sounds (see DRUM), '.' is silence
  const THEMES = {
    hub:     { bpm: 104, root: 60, scale: 'major', prog: [0, 5, 3, 4], lead: 'celesta', bass: 'round', pad: 'soft', drums: ['k...t...k.k.t...', '..h...h...h...h.'], seed: 3, density: 0.55 },
    bricks:  { bpm: 124, root: 57, scale: 'minor', prog: [0, 5, 2, 6], lead: 'synth', bass: 'synth', pad: 'strings', drums: ['k...k...k...k...', '....s.......s...', '..h...h...h...h.'], seed: 11, density: 0.7, arp: true },
    dash:    { bpm: 140, root: 62, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'whistle', bass: 'pluck', pad: null, drums: ['k.....k.k.......', '....s.......s..s', 'h.h.h.h.h.h.h.h.'], seed: 21, density: 0.75, bounce: true },
    sweets:  { bpm: 108, root: 64, scale: 'penta', prog: [0, 3, 4, 3], lead: 'marimba', bass: 'round', pad: 'glass', drums: ['k.......k..k....', '....c.......c...', '..t...t...t.t...'], seed: 31, density: 0.65, sc: 'major' },
    potions: { bpm: 92, root: 57, scale: 'harm', prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'celesta', bass: 'pluck', pad: 'glass', drums: ['k.....t.....t...', '................'], seed: 41, density: 0.55, waltz: true },
    cubes:   { bpm: 118, root: 55, scale: 'dorian', prog: [0, 6, 3, 4], lead: 'chip', bass: 'synth', pad: 'strings', drums: ['k..k..k.k..k..k.', '....s.......s...', 'hhhhhhhhhhhhhhhh'], seed: 51, density: 0.6, arp: true },
    racer:   { bpm: 132, root: 52, scale: 'minor', prog: [0, 5, 6, 4], lead: 'synth', bass: 'synth', pad: 'strings', drums: ['k...k...k...k...', '....s.......s...', '..o...o...o...o.'], seed: 61, density: 0.6, arp: true, eighthBass: true },
    castle:  { bpm: 112, root: 62, scale: 'dorian', prog: [0, 6, 0, 4, 0, 6, 3, 4], lead: 'flute', bass: 'pluck', pad: null, drums: ['B.....b.B.b.....', '................'], seed: 71, density: 0.6, lute: true },
    snake:   { bpm: 116, root: 60, scale: 'penta', prog: [0, 4, 5, 3], lead: 'marimba', bass: 'round', pad: null, drums: ['k.....k...k.....', 'b..b..B.b..b.B..', '..t...t...t...t.'], seed: 81, density: 0.7, sc: 'major' },
  };
  function rng(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function compose(th){
    const R = rng(th.seed * 7919), sc = SCALES[th.scale], chordSc = SCALES[th.sc || th.scale];
    const deg = (d) => { const n = sc.length; const o = Math.floor(d / n); return sc[((d % n) + n) % n] + 12 * o; };
    const chordTones = c => { const n = chordSc.length; return [0, 2, 4].map(k => { const i = c + k; return chordSc[i % n] + 12 * Math.floor(i / n); }); };
    // a 4-bar phrase A, a varied A', a contrasting B, then A again
    const steps = th.waltz ? 12 : 16;
    const makePhrase = (bars, startBar) => {
      const notes = [];
      let pos = 4 + Math.floor(R() * 3);
      for (let b = 0; b < bars; b++) {
        const ct = chordTones(th.prog[(startBar + b) % th.prog.length]);
        for (let s = 0; s < steps; s += 2) {
          const strong = s % (th.waltz ? 6 : 8) === 0;
          if (!strong && R() > th.density) continue;
          if (strong) { const tones = ct.map(v => v + 12); const target = tones[Math.floor(R() * 3)]; notes.push({ b, s, m: target, len: R() < 0.3 ? 4 : 2 }); }
          else { pos += Math.floor(R() * 5) - 2; pos = Math.max(2, Math.min(sc.length + 5, pos)); notes.push({ b, s, m: deg(pos) + 12, len: 2 }); }
        }
      }
      return notes;
    };
    const A = makePhrase(4, 0), B = makePhrase(4, 4);
    const A2 = A.map(n => ({ ...n })); for (const n of A2) if (n.b === 3 && R() < 0.7) n.m += [2, -1, 3][Math.floor(R() * 3)];
    const song = [];
    [[A, 0], [A2, 4], [B, 8], [A, 12]].forEach(([ph, off]) => ph.forEach(n => song.push({ ...n, b: n.b + off })));
    return { notes: song, bars: 16, steps };
  }
  let timer = null, want = null, cur = null, nextT = 0, step = 0, comp = null;
  function schedule(){
    if (!ac || !cur) return;
    const th = THEMES[cur], spb = 60 / th.bpm / 4, steps = comp.steps;
    while (nextT < ac.currentTime + 0.15) {
      const bar = Math.floor(step / steps) % comp.bars, s = step % steps, t = nextT;
      const swing = th.bounce && s % 2 ? spb * 0.18 : 0;
      const chord = th.prog[bar % th.prog.length];
      const sc = SCALES[th.sc || th.scale];
      const ct = [0, 2, 4].map(k => { const i = chord + k; return sc[i % sc.length] + 12 * Math.floor(i / sc.length); });
      // drums
      th.drums.forEach(row => { const ch = row[(s * row.length / steps) | 0]; if (ch && ch !== '.' && (s * row.length / steps) % 1 === 0 && DRUM[ch]) DRUM[ch](musicBus, t + swing, 1); });
      // bass
      const bassHit = th.eighthBass ? s % 2 === 0 : th.waltz ? s === 0 || s === 6 : (s === 0 || s === 8 || (th.bounce && (s === 6 || s === 14)) || (s === 10 && bar % 2));
      if (bassHit) { const m = th.root - 12 + ct[th.eighthBass ? 0 : (s === 8 || s === 6 ? (th.bounce ? 2 : 0) : 0)] + (s === 14 ? 7 : 0); voice(musicBus, t + swing, mtof(m), { ...BASS[th.bass], len: spb * (th.eighthBass ? 1.4 : 3) }); }
      // pad chord at bar start
      if (s === 0 && th.pad) ct.forEach((v, i) => voice(musicBus, t, mtof(th.root + v), { ...PAD[th.pad], len: spb * steps * 0.9, pan: (i - 1) * 0.4 }));
      // arpeggio / lute strums
      if (th.arp && s % 2 === 0) { const v = ct[(s / 2) % 3] + 12 * (s % 8 === 6 ? 1 : 0); voice(musicBus, t, mtof(th.root + v), { type: 'square', vol: 0.025, d: 0.1, s: 0.1, r: 0.04, len: 0.03, cut: 2200, pan: 0.3 }); }
      if (th.lute && (s === 0 || s === 6 || s === 10)) ct.forEach((v, i) => voice(musicBus, t + i * 0.018, mtof(th.root + v), { ...LEAD.pluck, vol: 0.05, pan: -0.3 }));
      // melody
      for (const n of comp.notes) if (n.b === bar && n.s === s) voice(musicBus, t + swing, mtof(th.root + n.m), { ...LEAD[th.lead], len: spb * n.len * 0.8, pan: 0.15 });
      nextT += spb; step++;
    }
  }
  const music = {
    play(theme){
      if (!THEMES[theme]) theme = 'hub';
      want = theme;
      if (!ac || ac.state !== 'running' || !sound.music) return;
      if (cur === theme && timer) return;
      clearInterval(timer); cur = theme; comp = compose(THEMES[theme]); step = 0; nextT = ac.currentTime + 0.08;
      musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setValueAtTime(0.0001, ac.currentTime); musicBus.gain.linearRampToValueAtTime(0.32, ac.currentTime + 0.6);
      timer = setInterval(schedule, 40); schedule();
    },
    stop(){ clearInterval(timer); timer = null; cur = null; },
    // quieter during menus / end screens
    duck(on){ if (!ac || !sound.music) return; musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(on ? 0.16 : 0.32, ac.currentTime, 0.2); },
  };
  PB.music = music;
  PB.sound = {
    get music(){ return sound.music; }, get sfx(){ return sound.sfx; },
    setMusic(v){ sound.music = !!v; save(); if (!ac) return; if (v) { musicBus.gain.value = 0.32; music.play(want || 'hub'); } else { musicBus.gain.value = 0; music.stop(); } },
    setSfx(v){ sound.sfx = !!v; save(); if (ac) sfxBus.gain.value = v ? 0.6 : 0; },
  };
})();
