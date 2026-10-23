// A compact WebGL2 3D renderer shared by the 3D games.
// Sun light with soft shadow maps, sky/ground ambient, point lights, fog, ACES tone mapping,
// procedural textures, a gradient or textured sky, and additive/alpha particle sprites.
(function(){
  // ---------------- math ----------------
  const M = {
    ident(){ const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    mul(a, b, o = new Float32Array(16)){
      for (let c=0;c<4;c++) for (let r=0;r<4;r++) {
        o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
      }
      return o;
    },
    persp(fovy, asp, n, f){ const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; },
    ortho(l, r, b, t, n, f){ const m = M.ident(); m[0] = 2/(r-l); m[5] = 2/(t-b); m[10] = -2/(f-n); m[12] = -(r+l)/(r-l); m[13] = -(t+b)/(t-b); m[14] = -(f+n)/(f-n); return m; },
    lookAt(e, c, u){
      let zx = e[0]-c[0], zy = e[1]-c[1], zz = e[2]-c[2]; let l = Math.hypot(zx, zy, zz); zx/=l; zy/=l; zz/=l;
      let xx = u[1]*zz - u[2]*zy, xy = u[2]*zx - u[0]*zz, xz = u[0]*zy - u[1]*zx; l = Math.hypot(xx, xy, xz); xx/=l; xy/=l; xz/=l;
      const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
      const m = new Float32Array(16);
      m[0]=xx; m[4]=xy; m[8]=xz; m[1]=yx; m[5]=yy; m[9]=yz; m[2]=zx; m[6]=zy; m[10]=zz;
      m[12] = -(xx*e[0]+xy*e[1]+xz*e[2]); m[13] = -(yx*e[0]+yy*e[1]+yz*e[2]); m[14] = -(zx*e[0]+zy*e[1]+zz*e[2]); m[15] = 1;
      return m;
    },
    // translate * rotY * rotX * rotZ * scale
    trs(t = [0,0,0], r = [0,0,0], s = [1,1,1], o = new Float32Array(16)){
      const [rx, ry, rz] = r, cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
      // R = Ry * Rx * Rz
      const m00 = cy*cz + sy*sx*sz, m01 = -cy*sz + sy*sx*cz, m02 = sy*cx;
      const m10 = cx*sz,            m11 = cx*cz,             m12 = -sx;
      const m20 = -sy*cz + cy*sx*sz, m21 = sy*sz + cy*sx*cz, m22 = cy*cx;
      const S = typeof s === 'number' ? [s, s, s] : s;
      o[0]=m00*S[0]; o[1]=m10*S[0]; o[2]=m20*S[0]; o[3]=0;
      o[4]=m01*S[1]; o[5]=m11*S[1]; o[6]=m21*S[1]; o[7]=0;
      o[8]=m02*S[2]; o[9]=m12*S[2]; o[10]=m22*S[2]; o[11]=0;
      o[12]=t[0]; o[13]=t[1]; o[14]=t[2]; o[15]=1;
      return o;
    },
    invert(a){
      const o = new Float32Array(16);
      const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
      let d = b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06; if (!d) return M.ident(); d = 1/d;
      o[0]=(a11*b11-a12*b10+a13*b09)*d; o[1]=(a02*b10-a01*b11-a03*b09)*d; o[2]=(a31*b05-a32*b04+a33*b03)*d; o[3]=(a22*b04-a21*b05-a23*b03)*d;
      o[4]=(a12*b08-a10*b11-a13*b07)*d; o[5]=(a00*b11-a02*b08+a03*b07)*d; o[6]=(a32*b02-a30*b05-a33*b01)*d; o[7]=(a20*b05-a22*b02+a23*b01)*d;
      o[8]=(a10*b10-a11*b08+a13*b06)*d; o[9]=(a01*b08-a00*b10-a03*b06)*d; o[10]=(a30*b04-a31*b02+a33*b00)*d; o[11]=(a21*b02-a20*b04-a23*b00)*d;
      o[12]=(a11*b07-a10*b09-a12*b06)*d; o[13]=(a00*b09-a01*b07+a02*b06)*d; o[14]=(a31*b01-a30*b03-a32*b00)*d; o[15]=(a20*b03-a21*b01+a22*b00)*d;
      return o;
    },
    normalMat(m){ const i = M.invert(m); return new Float32Array([i[0], i[4], i[8], i[1], i[5], i[9], i[2], i[6], i[10]]); },
    xform(m, p){ const x = p[0], y = p[1], z = p[2], w = m[3]*x + m[7]*y + m[11]*z + m[15]; return [(m[0]*x + m[4]*y + m[8]*z + m[12]) / w, (m[1]*x + m[5]*y + m[9]*z + m[13]) / w, (m[2]*x + m[6]*y + m[10]*z + m[14]) / w]; },
  };

  // ---------------- noise ----------------
  const perm = new Uint8Array(512); { const p = []; const R = PB.mulberry(1337); for (let i=0;i<256;i++) p.push(i); for (let i=255;i>0;i--) { const j = Math.floor(R()*(i+1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i=0;i<512;i++) perm[i] = p[i & 255]; }
  const fade = t => t*t*t*(t*(t*6-15)+10), lerp = (a, b, t) => a + (b - a) * t;
  function grad(h, x, y, z){ const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  function noise3(x, y, z){
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X]+Y, AA = perm[A]+Z, AB = perm[A+1]+Z, B = perm[X+1]+Y, BA = perm[B]+Z, BB = perm[B+1]+Z;
    return lerp(lerp(lerp(grad(perm[AA]&15,x,y,z), grad(perm[BA]&15,x-1,y,z), u), lerp(grad(perm[AB]&15,x,y-1,z), grad(perm[BB]&15,x-1,y-1,z), u), v),
                lerp(lerp(grad(perm[AA+1]&15,x,y,z-1), grad(perm[BA+1]&15,x-1,y,z-1), u), lerp(grad(perm[AB+1]&15,x,y-1,z-1), grad(perm[BB+1]&15,x-1,y-1,z-1), u), v), w);
  }
  function fbm(x, y, z, oct = 5){ let s = 0, a = 0.5, f = 1; for (let i=0;i<oct;i++) { s += a * noise3(x*f, y*f, z*f); f *= 2.02; a *= 0.5; } return s; }

  // ---------------- geometry ----------------
  const G = {
    box(w, h, d, worldUV = false){
      const x = w/2, y = h/2, z = d/2, P = [], N = [], U = [], I = [];
      const face = (n, a, b, c, dd, uw, vh) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...dd); for (let i=0;i<4;i++) N.push(...n); const su = worldUV ? uw : 1, sv = worldUV ? vh : 1; U.push(0, sv, su, sv, su, 0, 0, 0); I.push(o, o+1, o+2, o, o+2, o+3); };
      face([0,0,1], [-x,-y,z], [x,-y,z], [x,y,z], [-x,y,z], w, h);
      face([0,0,-1], [x,-y,-z], [-x,-y,-z], [-x,y,-z], [x,y,-z], w, h);
      face([1,0,0], [x,-y,z], [x,-y,-z], [x,y,-z], [x,y,z], d, h);
      face([-1,0,0], [-x,-y,-z], [-x,-y,z], [-x,y,z], [-x,y,-z], d, h);
      face([0,1,0], [-x,y,z], [x,y,z], [x,y,-z], [-x,y,-z], w, d);
      face([0,-1,0], [-x,-y,-z], [x,-y,-z], [x,-y,z], [-x,-y,z], w, d);
      return { p: P, n: N, uv: U, idx: I };
    },
    // a box with softly rounded edges and corners (radius r), each face mapped 0..1
    roundBox(w, h, d, r, seg = 6){
      const P = [], N = [], U = [], I = [], hx = w/2, hy = h/2, hz = d/2;
      r = Math.min(r, hx * 0.9, hy * 0.9, hz * 0.9);
      const faces = [[[1,0,0],[0,0,-1],[0,1,0]], [[-1,0,0],[0,0,1],[0,1,0]], [[0,1,0],[1,0,0],[0,0,-1]], [[0,-1,0],[1,0,0],[0,0,1]], [[0,0,1],[1,0,0],[0,1,0]], [[0,0,-1],[-1,0,0],[0,1,0]]];
      const S = [hx, hy, hz];
      for (const [n, u, v] of faces) {
        const o = P.length / 3;
        for (let j=0;j<=seg;j++) for (let i=0;i<=seg;i++) {
          const a = i / seg * 2 - 1, b = j / seg * 2 - 1;
          const q = [0, 1, 2].map(k => (n[k] + u[k] * a + v[k] * b) * S[k]);
          const inner = q.map((x, k) => Math.max(-(S[k] - r), Math.min(S[k] - r, x)));
          let dx = q[0] - inner[0], dy = q[1] - inner[1], dz = q[2] - inner[2]; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
          P.push(inner[0] + dx * r, inner[1] + dy * r, inner[2] + dz * r); N.push(dx, dy, dz); U.push(i / seg, 1 - j / seg);
        }
        for (let j=0;j<seg;j++) for (let i=0;i<seg;i++) { const k = o + j * (seg + 1) + i; I.push(k, k + 1, k + seg + 2, k, k + seg + 2, k + seg + 1); }
      }
      return { p: P, n: N, uv: U, idx: I };
    },
    plane(w, d, su = 1, sv = 1){ const x = w/2, z = d/2; return { p: [-x,0,z, x,0,z, x,0,-z, -x,0,-z], n: [0,1,0, 0,1,0, 0,1,0, 0,1,0], uv: [0,sv, su,sv, su,0, 0,0], idx: [0,1,2,0,2,3] }; },
    quad(w, h){ const x = w/2, y = h/2; return { p: [-x,-y,0, x,-y,0, x,y,0, -x,y,0], n: [0,0,1, 0,0,1, 0,0,1, 0,0,1], uv: [0,1, 1,1, 1,0, 0,0], idx: [0,1,2,0,2,3] }; },
    cylinder(rt, rb, h, seg = 20, caps = true, vRep = 1){
      const P = [], N = [], U = [], I = [], y0 = -h/2, y1 = h/2, slope = (rb - rt) / h;
      for (let i=0;i<=seg;i++) { const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), nl = Math.hypot(1, slope);
        P.push(c*rb, y0, s*rb, c*rt, y1, s*rt); N.push(c/nl, slope/nl, s/nl, c/nl, slope/nl, s/nl); U.push(i/seg, vRep, i/seg, 0); }
      for (let i=0;i<seg;i++) { const a = i*2; I.push(a, a+1, a+3, a, a+3, a+2); }
      if (caps) for (const [r, y, ny] of [[rt, y1, 1], [rb, y0, -1]]) { if (r <= 0) continue; const c0 = P.length / 3; P.push(0, y, 0); N.push(0, ny, 0); U.push(0.5, 0.5);
        for (let i=0;i<=seg;i++) { const a = i / seg * Math.PI * 2; P.push(Math.cos(a)*r, y, Math.sin(a)*r); N.push(0, ny, 0); U.push(0.5 + Math.cos(a)*0.5, 0.5 + Math.sin(a)*0.5); }
        for (let i=0;i<seg;i++) ny > 0 ? I.push(c0, c0+2+i, c0+1+i) : I.push(c0, c0+1+i, c0+2+i); }
      return { p: P, n: N, uv: U, idx: I };
    },
    sphere(r, ws = 24, hs = 16){
      const P = [], N = [], U = [], I = [];
      for (let y=0;y<=hs;y++) { const v = y / hs, th = v * Math.PI; for (let x=0;x<=ws;x++) { const u = x / ws, ph = u * Math.PI * 2; const nx = -Math.cos(ph) * Math.sin(th), ny = Math.cos(th), nz = Math.sin(ph) * Math.sin(th); P.push(nx*r, ny*r, nz*r); N.push(nx, ny, nz); U.push(u, v); } }
      for (let y=0;y<hs;y++) for (let x=0;x<ws;x++) { const a = y*(ws+1)+x, b = a + ws + 1; if (y) I.push(a, b, a+1); if (y < hs-1) I.push(a+1, b, b+1); }
      return { p: P, n: N, uv: U, idx: I };
    },
    torus(R, r, seg = 32, tube = 12){
      const P = [], N = [], U = [], I = [];
      for (let i=0;i<=seg;i++) { const u = i / seg * Math.PI * 2; for (let j=0;j<=tube;j++) { const v = j / tube * Math.PI * 2; const cx = Math.cos(u), sx = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
        P.push((R + r*cv)*cx, r*sv, (R + r*cv)*sx); N.push(cv*cx, sv, cv*sx); U.push(i/seg, j/tube); } }
      for (let i=0;i<seg;i++) for (let j=0;j<tube;j++) { const a = i*(tube+1)+j, b = a + tube + 1; I.push(a, b, a+1, a+1, b, b+1); }
      return { p: P, n: N, uv: U, idx: I };
    },
    // a closed shape extruded along z (for stars, wedges, slices)
    extrude(shape, depth){
      const P = [], N = [], U = [], I = [], n = shape.length, z = depth / 2;
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity; for (const [x, y] of shape) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
      for (const [sz, nz] of [[z, 1], [-z, -1]]) { const o = P.length / 3; for (const [x, y] of shape) { P.push(x, y, sz); N.push(0, 0, nz); U.push((x - minx) / (maxx - minx || 1), 1 - (y - miny) / (maxy - miny || 1)); }
        for (let i=1;i<n-1;i++) nz > 0 ? I.push(o, o+i, o+i+1) : I.push(o, o+i+1, o+i); }
      for (let i=0;i<n;i++) { const [x0, y0] = shape[i], [x1, y1] = shape[(i+1) % n]; let nx = y1 - y0, ny = -(x1 - x0); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const o = P.length / 3; P.push(x0, y0, z, x1, y1, z, x1, y1, -z, x0, y0, -z); for (let k=0;k<4;k++) N.push(nx, ny, 0); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(o, o+2, o+1, o, o+3, o+2); }
      return { p: P, n: N, uv: U, idx: I };
    },
    transform(g, m){
      const nm = M.normalMat(m), P = [], N = [];
      for (let i=0;i<g.p.length;i+=3) { const x = g.p[i], y = g.p[i+1], z = g.p[i+2]; P.push(m[0]*x + m[4]*y + m[8]*z + m[12], m[1]*x + m[5]*y + m[9]*z + m[13], m[2]*x + m[6]*y + m[10]*z + m[14]);
        const a = g.n[i], b = g.n[i+1], c = g.n[i+2]; let nx = nm[0]*a + nm[3]*b + nm[6]*c, ny = nm[1]*a + nm[4]*b + nm[7]*c, nz = nm[2]*a + nm[5]*b + nm[8]*c; const l = Math.hypot(nx, ny, nz) || 1; N.push(nx/l, ny/l, nz/l); }
      return { p: P, n: N, uv: g.uv.slice(), idx: g.idx.slice() };
    },
    merge(list){ const out = { p: [], n: [], uv: [], idx: [] }; for (const g of list) { const o = out.p.length / 3; out.p.push(...g.p); out.n.push(...g.n); out.uv.push(...g.uv); for (const i of g.idx) out.idx.push(i + o); } return out; },
    // push vertices along their normals by fn(x,y,z), then rebuild smooth normals
    displace(g, fn){
      // weld coincident vertices so displacement stays watertight
      const key = (i) => `${g.p[i].toFixed(4)},${g.p[i+1].toFixed(4)},${g.p[i+2].toFixed(4)}`;
      const cache = new Map();
      for (let i=0;i<g.p.length;i+=3) { const k = key(i); if (!cache.has(k)) cache.set(k, fn(g.p[i], g.p[i+1], g.p[i+2])); const d = cache.get(k); g.p[i] += g.n[i]*d; g.p[i+1] += g.n[i+1]*d; g.p[i+2] += g.n[i+2]*d; }
      G.recomputeNormals(g); return g;
    },
    recomputeNormals(g){
      const acc = new Map(), key = (i) => `${g.p[i*3].toFixed(3)},${g.p[i*3+1].toFixed(3)},${g.p[i*3+2].toFixed(3)}`;
      const n = new Array(g.p.length).fill(0);
      for (let t=0;t<g.idx.length;t+=3) { const a = g.idx[t], b = g.idx[t+1], c = g.idx[t+2];
        const ax = g.p[a*3], ay = g.p[a*3+1], az = g.p[a*3+2], ux = g.p[b*3]-ax, uy = g.p[b*3+1]-ay, uz = g.p[b*3+2]-az, vx = g.p[c*3]-ax, vy = g.p[c*3+1]-ay, vz = g.p[c*3+2]-az;
        const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
        for (const v of [a, b, c]) { const k = key(v); const s = acc.get(k) || [0,0,0]; s[0] += nx; s[1] += ny; s[2] += nz; acc.set(k, s); } }
      for (let v=0; v<g.p.length/3; v++) { const s = acc.get(key(v)) || [0,1,0]; const l = Math.hypot(...s) || 1; g.n[v*3] = s[0]/l; g.n[v*3+1] = s[1]/l; g.n[v*3+2] = s[2]/l; }
      // ensure outward
      return g;
    },
  };

  // ---------------- shaders ----------------
  const VS = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec2 aUV;
  uniform mat4 uModel, uVP, uLightVP; uniform mat3 uNM; uniform float uOutline;
  out vec3 vW; out vec3 vN; out vec2 vUV; out vec4 vL;
  void main(){ vec4 w = uModel * vec4(aPos, 1.0); vN = normalize(uNM * aNor); w.xyz += vN * uOutline; vW = w.xyz; vUV = aUV; vL = uLightVP * w; gl_Position = uVP * w; }`;
  const FS = `#version 300 es
  precision highp float; precision highp sampler2DShadow;
  in vec3 vW; in vec3 vN; in vec2 vUV; in vec4 vL; out vec4 o;
  uniform vec3 uColor, uEmis, uCam, uSunDir, uSunCol, uSky, uGround, uFog; uniform float uFogD, uSpec, uShine, uAlpha, uUnlit, uHasTex, uShadowOn, uRim, uFogStart, uToon;
  uniform vec2 uUVs, uUVo; uniform sampler2D uTex; uniform sampler2DShadow uShadow;
  uniform vec3 uPL[6]; uniform vec3 uPC[6]; uniform float uPR[6]; uniform int uPN;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
  float shadow(){
    vec3 p = vL.xyz / vL.w * 0.5 + 0.5; if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
    float s = 0.0; vec2 ts = vec2(1.0 / 2048.0);
    for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++) s += texture(uShadow, vec3(p.xy + vec2(x,y)*ts*1.5, p.z - 0.0015));
    return s / 9.0;
  }
  void main(){
    vec4 base = vec4(uColor, uAlpha);
    if (uHasTex > 0.5) { vec4 t = texture(uTex, vUV * uUVs + uUVo); base.rgb *= pow(t.rgb, vec3(2.2)); base.a *= t.a; }
    if (base.a < 0.02) discard;
    vec3 col;
    vec3 V = normalize(uCam - vW);
    if (uUnlit > 0.5) col = base.rgb + uEmis;
    else {
      vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
      vec3 L = normalize(-uSunDir);
      float sh = uShadowOn > 0.5 ? shadow() : 1.0;
      float ndl = max(dot(N, L), 0.0); float dif = ndl * sh;
      dif = mix(dif, smoothstep(0.0, 0.32, ndl) * (0.28 + 0.72 * sh), uToon);
      vec3 amb = mix(uGround, uSky, N.y * 0.5 + 0.5);
      vec3 H = normalize(L + V);
      float sp = pow(max(dot(N, H), 0.0), uShine) * uSpec * sh;
      col = base.rgb * (amb + uSunCol * dif) + uSunCol * sp;
      for (int i=0;i<6;i++) { if (i >= uPN) break; vec3 d = uPL[i] - vW; float dist = length(d); float att = clamp(1.0 - dist / uPR[i], 0.0, 1.0); att *= att; vec3 l = d / dist; col += base.rgb * uPC[i] * max(dot(N, l), 0.0) * att + uPC[i] * pow(max(dot(N, normalize(l + V)), 0.0), uShine) * uSpec * att; }
      col += uRim * pow(1.0 - max(dot(N, V), 0.0), 3.0) * uSky;
      col += uToon * 0.22 * pow(1.0 - max(dot(N, V), 0.0), 2.5) * uSunCol * base.rgb * (0.4 + ndl);
      col += uEmis;
    }
    float d = max(length(vW - uCam) - uFogStart, 0.0);
    float f = 1.0 - exp(-pow(d * uFogD, 2.0));
    col = mix(col, uFog, clamp(f, 0.0, 1.0));
    if (uToon > 0.0) { float l = dot(col, vec3(0.3, 0.59, 0.11)); col = max(mix(vec3(l), col, 1.0 + 0.18 * uToon), 0.0); }
    col = aces(col);
    o = vec4(pow(col, vec3(1.0/2.2)), base.a);
  }`;
  const SVS = `#version 300 es
  layout(location=0) in vec3 aPos; uniform mat4 uModel, uLightVP; void main(){ gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;
  const SFS = `#version 300 es
  precision mediump float; out vec4 o; void main(){ o = vec4(1.0); }`;
  const SKYVS = `#version 300 es
  layout(location=0) in vec2 aP; uniform mat4 uInvVP; out vec3 vDir;
  void main(){ vec4 a = uInvVP * vec4(aP, -1.0, 1.0); vec4 b = uInvVP * vec4(aP, 1.0, 1.0); vDir = b.xyz / b.w - a.xyz / a.w; gl_Position = vec4(aP, 0.9999, 1.0); }`;
  const SKYFS = `#version 300 es
  precision highp float; in vec3 vDir; out vec4 o;
  uniform vec3 uZen, uHor, uGnd, uSunDir, uSunCol; uniform float uSunSize, uHasTex, uTexBright; uniform sampler2D uTex;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
  void main(){
    vec3 d = normalize(vDir); vec3 col;
    if (uHasTex > 0.5) { float u = atan(d.z, d.x) / 6.2831853 + 0.5; float v = acos(clamp(d.y, -1.0, 1.0)) / 3.14159265; col = pow(texture(uTex, vec2(u, v)).rgb, vec3(2.2)) * uTexBright; }
    else { float h = d.y; col = h > 0.0 ? mix(uHor, uZen, pow(h, 0.55)) : mix(uHor, uGnd, pow(-h, 0.4)); }
    float s = max(dot(d, normalize(-uSunDir)), 0.0);
    col += uSunCol * (pow(s, 900.0 / uSunSize) * 6.0 + pow(s, 12.0) * 0.18 + pow(s, 3.0) * 0.05);
    col = aces(col); o = vec4(pow(col, vec3(1.0/2.2)), 1.0);
  }`;
  const SPVS = `#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aC; uniform mat4 uVP; out vec2 vUV; out vec4 vC;
  void main(){ vUV = aUV; vC = aC; gl_Position = uVP * vec4(aP, 1.0); }`;
  const SPFS = `#version 300 es
  precision mediump float; in vec2 vUV; in vec4 vC; out vec4 o; uniform sampler2D uTex;
  void main(){ vec4 t = texture(uTex, vUV); o = vec4(vC.rgb * t.rgb, vC.a * t.a); }`;

  // ---- post-processing: glow (bloom) + color grading + vignette ----
  const PVS = `#version 300 es
  layout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
  const BRIGHT = `#version 300 es
  precision mediump float; in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThr;
  void main(){
    vec3 c = (texture(uTex, vUV + uTexel * vec2(-1.0, -1.0)).rgb + texture(uTex, vUV + uTexel * vec2(1.0, -1.0)).rgb + texture(uTex, vUV + uTexel * vec2(-1.0, 1.0)).rgb + texture(uTex, vUV + uTexel * vec2(1.0, 1.0)).rgb) * 0.25;
    float l = max(c.r, max(c.g, c.b));
    o = vec4(c * smoothstep(uThr, uThr + 0.22, l), 1.0);
  }`;
  const BLUR = `#version 300 es
  precision mediump float; in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir;
  void main(){
    vec3 c = texture(uTex, vUV).rgb * 0.227;
    c += (texture(uTex, vUV + uDir * 1.385).rgb + texture(uTex, vUV - uDir * 1.385).rgb) * 0.316;
    c += (texture(uTex, vUV + uDir * 3.231).rgb + texture(uTex, vUV - uDir * 3.231).rgb) * 0.070;
    o = vec4(c, 1.0);
  }`;
  const COMP = `#version 300 es
  precision mediump float; in vec2 vUV; out vec4 o; uniform sampler2D uScene, uBloom, uBloom2;
  uniform float uBloomK, uSat, uCon, uVig; uniform vec3 uTint, uLift;
  void main(){
    vec3 c = texture(uScene, vUV).rgb;
    vec3 b = texture(uBloom, vUV).rgb * 0.6 + texture(uBloom2, vUV).rgb * 0.8;
    c += b * uBloomK;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, uSat);
    c = (c - 0.5) * uCon + 0.5;
    c = c * uTint + uLift;
    vec2 d = vUV - 0.5; c *= 1.0 - uVig * smoothstep(0.35, 0.95, length(d * vec2(1.0, 0.85)) * 1.25);
    o = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;
  function create(){
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const compile = (vs, fs) => {
      const p = gl.createProgram();
      for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); gl.attachShader(p, s); }
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i=0;i<n;i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    };
    const prog = compile(VS, FS), sprog = compile(SVS, SFS), sky = compile(SKYVS, SKYFS), spr = compile(SPVS, SPFS);
    const pBright = compile(PVS, BRIGHT), pBlur = compile(PVS, BLUR), pComp = compile(PVS, COMP);
    // render targets for the glow pass (created / resized on demand)
    let post = null;
    const mkTex = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
    function ensurePost(w, h){
      if (post && post.w === w && post.h === h) return post;
      if (post) { for (const k of ['scene', 'a', 'b', 'c', 'd']) { gl.deleteTexture(post[k].t); gl.deleteFramebuffer(post[k].f); } gl.deleteRenderbuffer(post.rbC); gl.deleteRenderbuffer(post.rbD); gl.deleteFramebuffer(post.msFB); }
      const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
      const msFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, msFB);
      const rbC = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rbC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbC);
      const rbD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rbD); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbD);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      const q = (d) => [Math.max(1, Math.round(w / d)), Math.max(1, Math.round(h / d))];
      post = { w, h, msFB, rbC, rbD, ok, scene: mkTex(w, h), a: mkTex(...q(4)), b: mkTex(...q(4)), c: mkTex(...q(10)), d: mkTex(...q(10)) };
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return post;
    }
    const quad = (p) => { gl.useProgram(p.p); gl.bindVertexArray(skyVao); gl.drawArrays(gl.TRIANGLES, 0, 6); };
    function runPost(P, opt){
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      // resolve the anti-aliased scene into a texture
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, P.msFB); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, P.scene.f);
      gl.blitFramebuffer(0, 0, P.w, P.h, 0, 0, P.w, P.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      const pass = (prog, src, dst, set) => { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h); gl.useProgram(prog.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(prog.u.uTex, 0); set && set(); quad(prog); };
      pass(pBright, P.scene, P.a, () => { gl.uniform2f(pBright.u.uTexel, 1 / P.w, 1 / P.h); gl.uniform1f(pBright.u.uThr, opt.threshold ?? 0.72); });
      pass(pBlur, P.a, P.b, () => gl.uniform2f(pBlur.u.uDir, 1 / P.a.w, 0));
      pass(pBlur, P.b, P.a, () => gl.uniform2f(pBlur.u.uDir, 0, 1 / P.a.h));
      pass(pBlur, P.a, P.c, () => gl.uniform2f(pBlur.u.uDir, 1.5 / P.a.w, 0));
      pass(pBlur, P.c, P.d, () => gl.uniform2f(pBlur.u.uDir, 0, 1.5 / P.c.h));
      pass(pBlur, P.d, P.c, () => gl.uniform2f(pBlur.u.uDir, 1 / P.c.w, 0));
      pass(pBlur, P.c, P.d, () => gl.uniform2f(pBlur.u.uDir, 0, 1 / P.c.h));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(pComp.p); const u = pComp.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.scene.t); gl.uniform1i(u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, P.a.t); gl.uniform1i(u.uBloom, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, P.d.t); gl.uniform1i(u.uBloom2, 2);
      gl.uniform1f(u.uBloomK, opt.bloom ?? 0.6); gl.uniform1f(u.uSat, opt.saturation ?? 1.15); gl.uniform1f(u.uCon, opt.contrast ?? 1.06); gl.uniform1f(u.uVig, opt.vignette ?? 0.3);
      gl.uniform3fv(u.uTint, opt.tint || [1, 1, 1]); gl.uniform3fv(u.uLift, opt.lift || [0, 0, 0]);
      quad(pComp);
      gl.activeTexture(gl.TEXTURE0);
    }
    // shadow map
    const SM = 2048;
    const shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SM, SM);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const shadowFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // white texture + sprite blob texture
    const tex = (src, opts = {}) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const rep = opts.repeat !== false ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rep); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.clampV ? gl.CLAMP_TO_EDGE : rep);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      return t;
    };
    const whiteC = document.createElement('canvas'); whiteC.width = whiteC.height = 4; const wg = whiteC.getContext('2d'); wg.fillStyle = '#fff'; wg.fillRect(0, 0, 4, 4);
    const white = tex(whiteC);
    const blobC = document.createElement('canvas'); blobC.width = blobC.height = 64; const bg = blobC.getContext('2d'); const gr = bg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); bg.fillStyle = gr; bg.fillRect(0, 0, 64, 64);
    const blob = tex(blobC, { repeat: false });
    // sky quad
    const skyVao = gl.createVertexArray(); gl.bindVertexArray(skyVao); const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // sprite batch
    const spVao = gl.createVertexArray(); gl.bindVertexArray(spVao); const spBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
    gl.bindVertexArray(null);

    const E = { gl, canvas, M, G, noise3, fbm, white, blob };
    E.texture = (c, o) => tex(c, o);
    E.mesh = (g) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const usage = g.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
      const put = (data, loc, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); return b; };
      const bp = put(g.p, 0, 3), bn = put(g.n, 1, 3); put(g.uv, 2, 2);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      const big = g.p.length / 3 > 65535;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(g.idx) : new Uint16Array(g.idx), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return { vao, count: g.idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, bp, bn };
    };
    // replace vertex positions/normals of a mesh made with { dynamic: true } (same vertex count)
    E.updateMesh = (m, p, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, m.bp); gl.bufferSubData(gl.ARRAY_BUFFER, 0, p); gl.bindBuffer(gl.ARRAY_BUFFER, m.bn); gl.bufferSubData(gl.ARRAY_BUFFER, 0, n); };
    // Show the 3D picture directly on screen, underneath the 2D game canvas (much faster on phones than copying it every frame)
    canvas.className = 'gl3d-layer';
    E.present = (ctx2d, w, h) => {
      const host = ctx2d.canvas;
      if (canvas.parentNode !== host.parentNode) host.parentNode.insertBefore(canvas, host);
      if (canvas.style.display !== 'block') canvas.style.display = 'block';
      ctx2d.clearRect(0, 0, w, h);
    };
    E.hide = () => { canvas.style.display = 'none'; };
    let W = 1, H = 1, dpr = 1;
    E.resize = (w, h, d) => { W = w; H = h; dpr = d; const cw = Math.round(w * d), ch = Math.round(h * d); if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; } };
    const queue = [], sprites = [], lights = [];
    let cam = null, env = null;
    E.begin = (camera, environment) => { cam = camera; env = environment; queue.length = 0; sprites.length = 0; lights.length = 0; };
    E.draw = (mesh, model, mat) => { queue.push({ mesh, model, mat }); };
    E.light = (pos, color, range) => { if (lights.length < 6) lights.push({ pos, color, range }); };
    E.sprite = (pos, size, color, alpha = 1, additive = true, rot = 0, texture = null, stretch = null) => { sprites.push({ pos, size, color, alpha, additive, rot, texture, stretch }); };
    E.project = (p) => { const v = M.xform(E.vp, p); return [(v[0] * 0.5 + 0.5) * W, (1 - (v[1] * 0.5 + 0.5)) * H, v[2]]; };
    E.unproject = (sx, sy, depth) => { const inv = M.invert(E.vp); const x = sx / W * 2 - 1, y = 1 - sy / H * 2; return M.xform(inv, [x, y, depth]); };
    E.end = () => {
      const asp = W / H;
      const P = M.persp(cam.fov || 0.9, asp, cam.near || 0.1, cam.far || 500);
      const V = M.lookAt(cam.pos, cam.target, cam.up || [0, 1, 0]);
      const VP = M.mul(P, V); E.vp = VP;
      const sd = env.sunDir; const sl = Math.hypot(...sd); const L = [sd[0]/sl, sd[1]/sl, sd[2]/sl];
      // shadow pass
      let LVP = M.ident();
      const shadowOn = !!env.shadow;
      if (shadowOn) {
        const c = env.shadow.center, r = env.shadow.radius;
        const eye = [c[0] - L[0]*r*2, c[1] - L[1]*r*2, c[2] - L[2]*r*2];
        const up = Math.abs(L[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
        LVP = M.mul(M.ortho(-r, r, -r, r, 0.1, r * 4), M.lookAt(eye, c, up));
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.viewport(0, 0, SM, SM);
        gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.colorMask(false, false, false, false);
        gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
        gl.useProgram(sprog.p); gl.uniformMatrix4fv(sprog.u.uLightVP, false, LVP);
        const scx = c[0], scz = c[2], sr2 = (r * 1.6) * (r * 1.6);
        for (const q of queue) { if (q.mat.noShadow || q.mat.unlit || (q.mat.alpha != null && q.mat.alpha < 1)) continue; const dx = q.model[12] - scx, dz = q.model[14] - scz; if (dx * dx + dz * dz > sr2) continue; gl.uniformMatrix4fv(sprog.u.uModel, false, q.model); gl.bindVertexArray(q.mesh.vao); gl.drawElements(gl.TRIANGLES, q.mesh.count, q.mesh.type, 0); }
        gl.disable(gl.POLYGON_OFFSET_FILL); gl.cullFace(gl.BACK); gl.colorMask(true, true, true, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      // with post-processing on, the scene is drawn into an offscreen (anti-aliased) target first
      let PP = null;
      if (env.post && E.postOn !== false) { PP = ensurePost(canvas.width, canvas.height); if (!PP.ok) PP = null; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, PP ? PP.msFB : null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // sky
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.useProgram(sky.p); gl.uniformMatrix4fv(sky.u.uInvVP, false, M.invert(VP));
      const s = env.sky || {};
      gl.uniform3fv(sky.u.uZen, lin(s.zenith || [0.2, 0.4, 0.8])); gl.uniform3fv(sky.u.uHor, lin(s.horizon || [0.8, 0.85, 0.9])); gl.uniform3fv(sky.u.uGnd, lin(s.ground || [0.3, 0.3, 0.3]));
      gl.uniform3fv(sky.u.uSunDir, L); gl.uniform3fv(sky.u.uSunCol, s.sunColor || [1, 0.9, 0.7]); gl.uniform1f(sky.u.uSunSize, s.sunSize || 1);
      gl.uniform1f(sky.u.uHasTex, s.tex ? 1 : 0); gl.uniform1f(sky.u.uTexBright, s.texBright || 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex || white); gl.uniform1i(sky.u.uTex, 0);
      gl.bindVertexArray(skyVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
      // meshes
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.useProgram(prog.p); const u = prog.u;
      gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uLightVP, false, LVP);
      gl.uniform3fv(u.uCam, cam.pos); gl.uniform3fv(u.uSunDir, L); gl.uniform3fv(u.uSunCol, env.sunColor || [3, 2.8, 2.5]);
      gl.uniform3fv(u.uSky, lin(env.ambSky || [0.4, 0.5, 0.7])); gl.uniform3fv(u.uGround, lin(env.ambGround || [0.25, 0.22, 0.2]));
      gl.uniform3fv(u.uFog, lin(env.fogColor || [0.7, 0.75, 0.8])); gl.uniform1f(u.uFogD, env.fogDensity || 0); gl.uniform1f(u.uFogStart, env.fogStart || 0);
      gl.uniform1f(u.uShadowOn, shadowOn ? 1 : 0); gl.uniform1f(u.uToon, env.toon || 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.uniform1i(u.uShadow, 1);
      gl.uniform1i(u.uPN, lights.length);
      if (lights.length) { gl.uniform3fv(u.uPL, lights.flatMap(l => l.pos)); gl.uniform3fv(u.uPC, lights.flatMap(l => l.color)); gl.uniform1fv(u.uPR, lights.map(l => l.range)); }
      gl.uniform1i(u.uTex, 0);
      const opaque = queue.filter(q => !(q.mat.alpha < 1) && !q.mat.blend), trans = queue.filter(q => q.mat.alpha < 1 || q.mat.blend);
      const dist = q => { const m = q.model; return Math.hypot(m[12] - cam.pos[0], m[13] - cam.pos[1], m[14] - cam.pos[2]); };
      trans.sort((a, b) => dist(b) - dist(a));
      const drawList = (list) => {
        for (const q of list) {
          const m = q.mat;
          gl.uniformMatrix4fv(u.uModel, false, q.model); gl.uniformMatrix3fv(u.uNM, false, M.normalMat(q.model));
          gl.uniform3fv(u.uColor, lin(m.color || [1, 1, 1])); gl.uniform3fv(u.uEmis, m.emissive || [0, 0, 0]);
          gl.uniform1f(u.uSpec, m.spec ?? 0.25); gl.uniform1f(u.uShine, m.shine ?? 32); gl.uniform1f(u.uAlpha, m.alpha ?? 1);
          gl.uniform1f(u.uUnlit, m.unlit ? 1 : 0); gl.uniform1f(u.uRim, m.rim || 0);
          gl.uniform1f(u.uHasTex, m.tex ? 1 : 0); gl.uniform2fv(u.uUVs, m.uvScale || [1, 1]); gl.uniform2fv(u.uUVo, m.uvOffset || [0, 0]);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.tex || white);
          gl.uniform1f(u.uOutline, m.outline || 0);
          if (m.outline) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); } else { gl.cullFace(gl.BACK); if (m.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE); }
          if (m.fogless) gl.uniform1f(u.uFogD, 0);
          gl.bindVertexArray(q.mesh.vao); gl.drawElements(gl.TRIANGLES, q.mesh.count, q.mesh.type, 0);
          if (m.fogless) gl.uniform1f(u.uFogD, env.fogDensity || 0);
        }
      };
      drawList(opaque);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      for (const q of trans) { if (q.mat.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); drawList([q]); }
      // sprites (billboards)
      if (sprites.length) {
        const right = [V[0], V[4], V[8]], up = [V[1], V[5], V[9]];
        gl.useProgram(spr.p); gl.uniformMatrix4fv(spr.u.uVP, false, VP); gl.uniform1i(spr.u.uTex, 0); gl.disable(gl.CULL_FACE);
        const groups = new Map();
        for (const sp of sprites) { const k = (sp.additive ? 'a' : 'n') + (sp.texture ? sp.texture.__id || (sp.texture.__id = Math.random()) : 0); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(sp); }
        for (const [k, list] of groups) {
          if (k[0] === 'n') list.sort((a, b) => Math.hypot(b.pos[0]-cam.pos[0], b.pos[1]-cam.pos[1], b.pos[2]-cam.pos[2]) - Math.hypot(a.pos[0]-cam.pos[0], a.pos[1]-cam.pos[1], a.pos[2]-cam.pos[2]));
          const data = new Float32Array(list.length * 6 * 9); let o = 0;
          for (const sp of list) {
            const c = Math.cos(sp.rot), s2 = Math.sin(sp.rot), h = sp.size / 2;
            let rx = (right[0]*c + up[0]*s2) * h, ry = (right[1]*c + up[1]*s2) * h, rz = (right[2]*c + up[2]*s2) * h;
            let ux = (-right[0]*s2 + up[0]*c) * h, uy = (-right[1]*s2 + up[1]*c) * h, uz = (-right[2]*s2 + up[2]*c) * h;
            if (sp.stretch) { ux = sp.stretch[0]; uy = sp.stretch[1]; uz = sp.stretch[2]; }
            const p = sp.pos, col = sp.color;
            const v = (sx, sy, tu, tv) => { data[o++] = p[0] + rx*sx + ux*sy; data[o++] = p[1] + ry*sx + uy*sy; data[o++] = p[2] + rz*sx + uz*sy; data[o++] = tu; data[o++] = tv; data[o++] = col[0]; data[o++] = col[1]; data[o++] = col[2]; data[o++] = sp.alpha; };
            v(-1,-1,0,1); v(1,-1,1,1); v(1,1,1,0); v(-1,-1,0,1); v(1,1,1,0); v(-1,1,0,0);
          }
          gl.bindVertexArray(spVao); gl.bindBuffer(gl.ARRAY_BUFFER, spBuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
          gl.blendFunc(gl.SRC_ALPHA, k[0] === 'a' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, list[0].texture || blob);
          gl.drawArrays(gl.TRIANGLES, 0, list.length * 6);
        }
      }
      gl.depthMask(true); gl.disable(gl.BLEND);
      if (PP) runPost(PP, env.post);
      gl.bindVertexArray(null);
    };
    function lin(c){ return [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)]; }
    E.hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    return E;
  }
  let shared = null;
  PB.gl3d = { M, G, noise3, fbm, hide(){ if (shared) shared.hide(); }, get(){ if (shared === null) { try { shared = create(); } catch (e) { console.error(e); shared = false; } } return shared || null; } };
})();
