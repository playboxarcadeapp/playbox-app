// A small rigid-body physics engine (boxes and circles) in the style of Box2D-Lite:
// SAT box clipping, sequential impulses with warm starting and friction. Screen coordinates (y down).
(function(){
  let nextId = 1;
  function makeBox(x, y, w, h, density, opts = {}){
    const m = density > 0 ? w * h * density / 1000 : 0;
    return { id: nextId++, kind:'box', x, y, a: opts.a || 0, vx: 0, vy: 0, w: 0, hw: w / 2, hh: h / 2, r: 0,
      invM: m > 0 ? 1 / m : 0, invI: m > 0 ? 1 / (m * (w*w + h*h) / 12) : 0, mass: m, fr: opts.friction ?? 0.6, data: opts.data || null, rest: 0 };
  }
  function makeCircle(x, y, r, density, opts = {}){
    const m = Math.PI * r * r * density / 1000;
    return { id: nextId++, kind:'circle', x, y, a: 0, vx: 0, vy: 0, w: 0, hw: r, hh: r, r,
      invM: 1 / m, invI: 1 / (0.5 * m * r * r), mass: m, fr: opts.friction ?? 0.5, data: opts.data || null, rest: 0 };
  }

  // ---------- Narrow phase ----------
  function boxBox(A, B, out){
    const cA = Math.cos(A.a), sA = Math.sin(A.a), cB = Math.cos(B.a), sB = Math.sin(B.a);
    const dpx = B.x - A.x, dpy = B.y - A.y;
    const dAx = cA*dpx + sA*dpy, dAy = -sA*dpx + cA*dpy;
    const dBx = cB*dpx + sB*dpy, dBy = -sB*dpx + cB*dpy;
    const c11 = cA*cB + sA*sB, c12 = -cA*sB + sA*cB, c21 = -sA*cB + cA*sB, c22 = sA*sB + cA*cB;
    const a11 = Math.abs(c11), a12 = Math.abs(c12), a21 = Math.abs(c21), a22 = Math.abs(c22);
    const faAx = Math.abs(dAx) - A.hw - (a11*B.hw + a12*B.hh);
    const faAy = Math.abs(dAy) - A.hh - (a21*B.hw + a22*B.hh);
    if (faAx > 0 || faAy > 0) return 0;
    const fbBx = Math.abs(dBx) - (a11*A.hw + a21*A.hh) - B.hw;
    const fbBy = Math.abs(dBy) - (a12*A.hw + a22*A.hh) - B.hh;
    if (fbBx > 0 || fbBy > 0) return 0;
    const relTol = 0.95, absTol = 0.01;
    let axis = 0, sep = faAx, nx = dAx > 0 ? cA : -cA, ny = dAx > 0 ? sA : -sA;
    if (faAy > relTol*sep + absTol*A.hh) { axis = 1; sep = faAy; nx = dAy > 0 ? -sA : sA; ny = dAy > 0 ? cA : -cA; }
    if (fbBx > relTol*sep + absTol*B.hw) { axis = 2; sep = fbBx; nx = dBx > 0 ? cB : -cB; ny = dBx > 0 ? sB : -sB; }
    if (fbBy > relTol*sep + absTol*B.hh) { axis = 3; sep = fbBy; nx = dBy > 0 ? -sB : sB; ny = dBy > 0 ? cB : -cB; }
    let fnx, fny, front, snx, sny, negSide, posSide, inc;
    if (axis === 0) { fnx = nx; fny = ny; front = A.x*fnx + A.y*fny + A.hw; snx = -sA; sny = cA; const side = A.x*snx + A.y*sny; negSide = -side + A.hh; posSide = side + A.hh; inc = incident(B, cB, sB, fnx, fny); }
    else if (axis === 1) { fnx = nx; fny = ny; front = A.x*fnx + A.y*fny + A.hh; snx = cA; sny = sA; const side = A.x*snx + A.y*sny; negSide = -side + A.hw; posSide = side + A.hw; inc = incident(B, cB, sB, fnx, fny); }
    else if (axis === 2) { fnx = -nx; fny = -ny; front = B.x*fnx + B.y*fny + B.hw; snx = -sB; sny = cB; const side = B.x*snx + B.y*sny; negSide = -side + B.hh; posSide = side + B.hh; inc = incident(A, cA, sA, fnx, fny); }
    else { fnx = -nx; fny = -ny; front = B.x*fnx + B.y*fny + B.hh; snx = cB; sny = sB; const side = B.x*snx + B.y*sny; negSide = -side + B.hw; posSide = side + B.hw; inc = incident(A, cA, sA, fnx, fny); }
    const c1 = clip(inc, -snx, -sny, negSide); if (c1.length < 2) return 0;
    const c2 = clip(c1, snx, sny, posSide); if (c2.length < 2) return 0;
    let n = 0;
    for (const p of c2) {
      const s = fnx*p[0] + fny*p[1] - front;
      if (s <= 0) { out.push({ x: p[0] - s*fnx, y: p[1] - s*fny, nx, ny, sep: s, Pn: 0, Pt: 0 }); n++; }
    }
    return n;
  }
  function incident(b, c, s, nx, ny){
    // n in the incident box's frame, pointing away from the reference face
    const lx = -(c*nx + s*ny), ly = -(-s*nx + c*ny);
    let v0, v1;
    if (Math.abs(lx) > Math.abs(ly)) {
      if (lx > 0) { v0 = [b.hw, -b.hh]; v1 = [b.hw, b.hh]; } else { v0 = [-b.hw, b.hh]; v1 = [-b.hw, -b.hh]; }
    } else {
      if (ly > 0) { v0 = [b.hw, b.hh]; v1 = [-b.hw, b.hh]; } else { v0 = [-b.hw, -b.hh]; v1 = [b.hw, -b.hh]; }
    }
    const tf = v => [b.x + c*v[0] - s*v[1], b.y + s*v[0] + c*v[1]];
    return [tf(v0), tf(v1)];
  }
  function clip(vIn, nx, ny, off){
    const out = [];
    const d0 = nx*vIn[0][0] + ny*vIn[0][1] - off, d1 = nx*vIn[1][0] + ny*vIn[1][1] - off;
    if (d0 <= 0) out.push(vIn[0]);
    if (d1 <= 0) out.push(vIn[1]);
    if (d0 * d1 < 0) { const t = d0 / (d0 - d1); out.push([vIn[0][0] + t*(vIn[1][0] - vIn[0][0]), vIn[0][1] + t*(vIn[1][1] - vIn[0][1])]); }
    return out;
  }
  function boxCircle(A, B, out){
    const c = Math.cos(A.a), s = Math.sin(A.a);
    const dx = B.x - A.x, dy = B.y - A.y;
    const lx = c*dx + s*dy, ly = -s*dx + c*dy;
    let cx = Math.max(-A.hw, Math.min(A.hw, lx)), cy = Math.max(-A.hh, Math.min(A.hh, ly));
    let nlx, nly, sep;
    if (cx === lx && cy === ly) {
      const px = A.hw - Math.abs(lx), py = A.hh - Math.abs(ly);
      if (px < py) { nlx = Math.sign(lx) || 1; nly = 0; cx = nlx * A.hw; sep = -px - B.r; }
      else { nlx = 0; nly = Math.sign(ly) || 1; cy = nly * A.hh; sep = -py - B.r; }
    } else {
      const ex = lx - cx, ey = ly - cy, d = Math.hypot(ex, ey);
      if (d > B.r) return 0;
      nlx = ex / d; nly = ey / d; sep = d - B.r;
    }
    out.push({ x: A.x + c*cx - s*cy, y: A.y + s*cx + c*cy, nx: c*nlx - s*nly, ny: s*nlx + c*nly, sep, Pn: 0, Pt: 0 });
    return 1;
  }
  function circleCircle(A, B, out){
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    if (d > A.r + B.r || d === 0) return 0;
    const nx = dx / d, ny = dy / d;
    out.push({ x: A.x + nx*A.r, y: A.y + ny*A.r, nx, ny, sep: d - A.r - B.r, Pn: 0, Pt: 0 });
    return 1;
  }
  function collide(A, B, out){
    if (A.kind === 'box' && B.kind === 'box') return boxBox(A, B, out);
    if (A.kind === 'box') return boxCircle(A, B, out);
    if (B.kind === 'box') { const n = boxCircle(B, A, out); for (const c of out) { c.nx = -c.nx; c.ny = -c.ny; } return n; }
    return circleCircle(A, B, out);
  }
  const bound = b => b.kind === 'circle' ? b.r : Math.hypot(b.hw, b.hh);

  // ---------- World ----------
  function World(gravity){
    this.g = gravity; this.bodies = []; this.arbs = new Map(); this.iters = 10;
    this.onContact = null;
  }
  World.prototype.add = function(b){ this.bodies.push(b); return b; };
  World.prototype.remove = function(b){ const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1); for (const k of [...this.arbs.keys()]) { const a = this.arbs.get(k); if (a.A === b || a.B === b) this.arbs.delete(k); } };
  World.prototype.step = function(dt){
    const inv = 1 / dt, B = this.bodies;
    // broad phase + narrow phase with warm starting
    const seen = new Set();
    for (let i=0;i<B.length;i++) for (let j=i+1;j<B.length;j++) {
      const a = B[i], b = B[j];
      if (a.invM === 0 && b.invM === 0) continue;
      const rr = bound(a) + bound(b);
      if (Math.abs(a.x - b.x) > rr || Math.abs(a.y - b.y) > rr) continue;
      const A = a.id < b.id ? a : b, Bb = a.id < b.id ? b : a;
      const key = A.id * 100000 + Bb.id;
      const cs = []; collide(A, Bb, cs);
      if (!cs.length) { this.arbs.delete(key); continue; }
      seen.add(key);
      const old = this.arbs.get(key);
      if (old) for (const c of cs) { let best = null, bd = 25; for (const o of old.cs) { const d = (o.x - c.x)**2 + (o.y - c.y)**2; if (d < bd) { bd = d; best = o; } } if (best) { c.Pn = best.Pn; c.Pt = best.Pt; } }
      else if (this.onContact) this.onContact(A, Bb, cs);
      this.arbs.set(key, { A, B: Bb, cs, fr: Math.sqrt(A.fr * Bb.fr) });
    }
    for (const k of [...this.arbs.keys()]) if (!seen.has(k)) this.arbs.delete(k);
    // integrate forces
    for (const b of B) { if (b.invM === 0) continue; b.vy += this.g * dt; b.vx *= 0.9995; b.vy *= 0.9995; b.w *= 0.995; }
    // pre-step
    for (const arb of this.arbs.values()) {
      const { A, B: b2, cs } = arb;
      for (const c of cs) {
        const r1x = c.x - A.x, r1y = c.y - A.y, r2x = c.x - b2.x, r2y = c.y - b2.y;
        const rn1 = r1x*c.nx + r1y*c.ny, rn2 = r2x*c.nx + r2y*c.ny;
        c.mn = 1 / (A.invM + b2.invM + A.invI*(r1x*r1x + r1y*r1y - rn1*rn1) + b2.invI*(r2x*r2x + r2y*r2y - rn2*rn2));
        const tx = c.ny, ty = -c.nx;
        const rt1 = r1x*tx + r1y*ty, rt2 = r2x*tx + r2y*ty;
        c.mt = 1 / (A.invM + b2.invM + A.invI*(r1x*r1x + r1y*r1y - rt1*rt1) + b2.invI*(r2x*r2x + r2y*r2y - rt2*rt2));
        c.bias = -0.2 * inv * Math.min(0, c.sep + 0.6);
        const Px = c.Pn*c.nx + c.Pt*tx, Py = c.Pn*c.ny + c.Pt*ty;
        A.vx -= A.invM*Px; A.vy -= A.invM*Py; A.w -= A.invI*(r1x*Py - r1y*Px);
        b2.vx += b2.invM*Px; b2.vy += b2.invM*Py; b2.w += b2.invI*(r2x*Py - r2y*Px);
        c.r1x = r1x; c.r1y = r1y; c.r2x = r2x; c.r2y = r2y;
      }
    }
    // iterate impulses
    for (let it=0; it<this.iters; it++) for (const arb of this.arbs.values()) {
      const { A, B: b2, cs, fr } = arb;
      for (const c of cs) {
        let dvx = b2.vx - b2.w*c.r2y - A.vx + A.w*c.r1y;
        let dvy = b2.vy + b2.w*c.r2x - A.vy - A.w*c.r1x;
        const vn = dvx*c.nx + dvy*c.ny;
        let dPn = c.mn * (-vn + c.bias);
        const Pn0 = c.Pn; c.Pn = Math.max(Pn0 + dPn, 0); dPn = c.Pn - Pn0;
        let Px = dPn*c.nx, Py = dPn*c.ny;
        A.vx -= A.invM*Px; A.vy -= A.invM*Py; A.w -= A.invI*(c.r1x*Py - c.r1y*Px);
        b2.vx += b2.invM*Px; b2.vy += b2.invM*Py; b2.w += b2.invI*(c.r2x*Py - c.r2y*Px);
        dvx = b2.vx - b2.w*c.r2y - A.vx + A.w*c.r1y;
        dvy = b2.vy + b2.w*c.r2x - A.vy - A.w*c.r1x;
        const tx = c.ny, ty = -c.nx;
        const vt = dvx*tx + dvy*ty;
        let dPt = c.mt * (-vt);
        const maxPt = fr * c.Pn, Pt0 = c.Pt;
        c.Pt = Math.max(-maxPt, Math.min(maxPt, Pt0 + dPt)); dPt = c.Pt - Pt0;
        Px = dPt*tx; Py = dPt*ty;
        A.vx -= A.invM*Px; A.vy -= A.invM*Py; A.w -= A.invI*(c.r1x*Py - c.r1y*Px);
        b2.vx += b2.invM*Px; b2.vy += b2.invM*Py; b2.w += b2.invI*(c.r2x*Py - c.r2y*Px);
      }
    }
    // integrate velocities
    for (const b of B) { if (b.invM === 0) continue; b.x += b.vx*dt; b.y += b.vy*dt; b.a += b.w*dt;
      const slow = Math.abs(b.vx) + Math.abs(b.vy) < 6 && Math.abs(b.w) < 0.08; b.rest = slow ? b.rest + dt : 0; }
  };
  PB.physics = { World, makeBox, makeCircle };
})();
