// Page sets. Each set pops in with a per-index easeOutBack stagger in its vertex shader when its page is entered
// and folds away when it's left, so a page change reads as the world rebuilding itself, not a CSS fade.
import * as THREE from 'three';
import { ease } from '../engine/animator.js';
import { makeCandles, gaussian, rng } from './series.js';

const WHITE_HDR = 6.0; // pure white after the neutral tone map

// ---------------------------------------------------------------- canvas labels (real fonts, so no garbled text)
export function textPlane(lines, { font = '600 64px "Martian Mono"', fg = '#fff', bg = null, pad = 28, height = 1, border = false, align = 'left', lineGap = 1.25, gain = 1.6 } = {}) {
  const list = Array.isArray(lines) ? lines : [lines];
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const px = parseInt(font.match(/(\d+)px/)[1], 10);
  const w = Math.ceil(Math.max(...list.map((l) => ctx.measureText(l).width)) + pad * 2);
  const h = Math.ceil(px * lineGap * list.length + pad * 2 - px * (lineGap - 1));
  c.width = w;
  c.height = h;
  ctx.font = font;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  if (border) {
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }
  ctx.fillStyle = fg;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  list.forEach((l, i) => ctx.fillText(l, align === 'center' ? w / 2 : pad, pad + i * px * lineGap));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uVis: { value: 0 }, uGain: { value: gain } },
    vertexShader: /* glsl */ `varying vec2 vUv; uniform float uVis; void main(){ vUv = uv; vec3 p = position; p.y *= clamp(uVis * 1.2, 0., 1.); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: /* glsl */ `uniform sampler2D map; uniform float uVis; uniform float uGain; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); if (vUv.x > uVis * 1.4) discard; if (t.a < .02) discard; vec3 lin = pow(t.rgb, vec3(2.2)) * uGain; gl_FragColor = vec4(lin, t.a); }`,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((w / h) * height, height), mat);
  mesh.userData.vis = mat.uniforms.uVis;
  return mesh;
}

// ---------------------------------------------------------------- candles
const CANDLE_V = /* glsl */ `
attribute vec3 aInfo; // x: up, y: order 0..1, z: wick
uniform float uVis; uniform float uTime;
varying vec2 vUv; varying float vUp; varying float vWick; varying vec3 vN;
float outBack(float t){ float c1 = 1.70158; float c3 = c1 + 1.; return 1. + c3 * pow(t - 1., 3.) + c1 * pow(t - 1., 2.); }
void main(){
  vUv = uv; vUp = aInfo.x; vWick = aInfo.z;
  float k = clamp(uVis * 1.8 - aInfo.y * .8, 0., 1.);
  float pop = k <= 0. ? 0. : outBack(k);
  vec3 p = position;
  p.y = (p.y + .5) * pop - .5;
  p.xz *= clamp(k * 3., 0., 1.);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.);
}`;
const CANDLE_F = /* glsl */ `
uniform float uInk; uniform float uGlow;
varying vec2 vUv; varying float vUp; varying float vWick; varying vec3 vN;
void main(){
  vec2 e = min(vUv, 1. - vUv) / max(fwidth(vUv), vec2(1e-5));
  float edge = 1. - smoothstep(1.2, 2.4, min(e.x, e.y));
  vec3 ink = mix(vec3(0.), vec3(uGlow), uInk);
  vec3 paper = mix(vec3(${WHITE_HDR.toFixed(1)}), vec3(0.), uInk);
  float solid = max(1. - vUp, vWick);
  vec3 col = mix(paper, ink, max(solid, edge));
  float f = .82 + .18 * clamp(dot(vN, normalize(vec3(-.4, .7, .6))), 0., 1.);
  col *= mix(1., f, solid * uInk);
  gl_FragColor = vec4(col, 1.);
}`;

class Candles {
  constructor(bars, { width = 0.24, gap = 0.12, height = 12, ink = 1, glow = 1.6 } = {}) {
    const n = bars.length;
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of bars) {
      lo = Math.min(lo, b.l);
      hi = Math.max(hi, b.h);
    }
    this.lo = lo;
    this.hi = hi;
    this.height = height;
    this.step = width + gap;
    this.n = n;
    this.span = (n - 1) * this.step;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const info = new Float32Array(n * 2 * 3);
    this.uniforms = { uVis: { value: 0 }, uTime: { value: 0 }, uInk: { value: ink }, uGlow: { value: glow } };
    const mat = new THREE.ShaderMaterial({ vertexShader: CANDLE_V, fragmentShader: CANDLE_F, uniforms: this.uniforms });
    this.mesh = new THREE.InstancedMesh(geo, mat, n * 2);
    const m = new THREE.Matrix4();
    bars.forEach((b, i) => {
      const x = this.x(i);
      const up = b.c >= b.o ? 1 : 0;
      const top = this.y(Math.max(b.o, b.c));
      const bot = this.y(Math.min(b.o, b.c));
      const bh = Math.max(0.05, top - bot);
      m.makeScale(width, bh, width).setPosition(x, bot + bh / 2, 0);
      this.mesh.setMatrixAt(i * 2, m);
      const wh = Math.max(0.05, this.y(b.h) - this.y(b.l));
      m.makeScale(width * 0.16, wh, width * 0.16).setPosition(x, this.y(b.l) + wh / 2, 0);
      this.mesh.setMatrixAt(i * 2 + 1, m);
      const ord = i / (n - 1);
      info.set([up, ord, 0], i * 6);
      info.set([up, ord, 1], i * 6 + 3);
    });
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 3));
    this.mesh.frustumCulled = false;
  }
  y(v) {
    return ((v - this.lo) / (this.hi - this.lo)) * this.height - this.height / 2;
  }
  x(i) {
    return -this.span / 2 + i * this.step;
  }
}

// ---------------------------------------------------------------- glowing lines (gaussian channel, fomo line)
const LINE_V = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const LINE_F = /* glsl */ `
uniform float uDraw; uniform float uDash; uniform float uGain; uniform float uTime; uniform float uInk; varying vec2 vUv;
void main(){
  if (vUv.x > uDraw) discard;
  if (uDash > 0. && fract(vUv.x * uDash - uTime * .15) > .55) discard;
  float head = smoothstep(uDraw - .03, uDraw, vUv.x) * step(uDraw, .999);
  vec3 c = mix(vec3(0.), vec3(uGain), uInk) + vec3(head * 4. * uInk);
  gl_FragColor = vec4(c, 1.);
}`;
function glowTube(points, radius, { dash = 0, gain = 2.4, ink = 1, draw } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, Math.max(64, points.length * 3), radius, 8, false);
  const uniforms = { uDraw: draw || { value: 0 }, uDash: { value: dash }, uGain: { value: gain }, uTime: { value: 0 }, uInk: { value: ink } };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: LINE_V, fragmentShader: LINE_F, uniforms }));
  mesh.userData.u = uniforms;
  return mesh;
}

// ---------------------------------------------------------------- holder swarm (analytic orbits in the vertex shader)
const SWARM_V = /* glsl */ `
attribute vec4 aOrbit; // radius, angle, height, speed
attribute float aFlag;
uniform float uTime; uniform float uVis; uniform float uScale;
varying float vFlag; varying vec2 vUv;
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main(){
  vFlag = aFlag; vUv = uv;
  float k = clamp(uVis * 1.7 - fract(aOrbit.y * 3.7) * .7, 0., 1.);
  float ang = aOrbit.y + uTime * aOrbit.w;
  float r = aOrbit.x * (0.4 + 0.6 * k);
  vec3 c = vec3(cos(ang) * r, aOrbit.z + sin(ang * 2. + aOrbit.x) * .35, sin(ang) * r);
  c.yz = rot(-.38) * c.yz;
  c.xy = rot(.12) * c.xy;
  float s = uScale * (1. + aFlag * 1.6) * k;
  vec3 p = position * s;
  p.xz = rot(uTime * (1. + aFlag) + aOrbit.y * 10.) * p.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + p, 1.);
}`;
const SWARM_F = /* glsl */ `
uniform float uTime; varying float vFlag; varying vec2 vUv;
void main(){
  vec2 e = min(vUv, 1. - vUv) / max(fwidth(vUv), vec2(1e-5));
  float edge = 1. - smoothstep(1., 2.2, min(e.x, e.y));
  float blink = .55 + .45 * step(.5, fract(uTime * 1.3 + vFlag * 7.));
  if (vFlag > .5 && edge < .05) discard;
  vec3 c = vFlag > .5 ? vec3(2.4) * blink : vec3(0.95);
  gl_FragColor = vec4(c, 1.);
}`;

// ---------------------------------------------------------------- build
export function buildSets({ scene, animator: A, slots }) {
  const [, O, F, S] = slots;
  const sets = [];
  const vis = (name) => A.add('vis_' + name, 0);

  // ===== page 0 · MIND: gyroscope rings that ride on the orb
  const ringsVis = vis('rings');
  const rings = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  ringMat.color.setScalar(1.3);
  const ringList = [1.75, 2.1, 2.55].map((rad, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.005 + i * 0.0015, 6, 200), ringMat);
    m.rotation.set(Math.PI / 2 + i * 0.5, i * 0.8, 0);
    rings.add(m);
    return m;
  });
  scene.add(rings);
  sets.push({
    page: 0,
    group: rings,
    update(dt, t, orb) {
      rings.position.copy(orb.group.position);
      rings.scale.setScalar(orb.group.scale.x * Math.max(0.001, ringsVis.value));
      rings.visible = ringsVis.value > 0.01;
      ringList.forEach((m, i) => {
        m.rotation.x += dt * (0.25 + i * 0.12);
        m.rotation.y += dt * (0.18 - i * 0.07);
      });
    },
    enter: () => A.animate('vis_rings', 1, 1.2, ease.outBack, 0.3),
    leave: () => A.animate('vis_rings', 0, 0.5, ease.inCubic),
  });

  // ===== page 1 · OVER: a chart floating behind the O, the gaussian channel drawing itself over it
  const chartVis = vis('chart');
  const drawU = A.add('chartDraw', 0);
  const chart = new THREE.Group();
  chart.position.copy(O).add(new THREE.Vector3(-3, 0.2, -10));
  const bars = makeCandles(150, 7, 'chop-pump-dump');
  const cs = new Candles(bars, { width: 0.2, gap: 0.08, height: 15, ink: 1, glow: 1.25 });
  chart.add(cs.mesh);
  const g = gaussian(bars, { poles: 4, period: 60, mult: 1.414 });
  const pts = (arr) => arr.map((val, i) => new THREE.Vector3(cs.x(i), cs.y(val), 0.25)).filter((_, i) => i % 2 === 0 || i === arr.length - 1);
  const mid = glowTube(pts(g.filt), 0.075, { gain: 3.2, draw: drawU });
  const hb = glowTube(pts(g.hband), 0.035, { dash: 70, gain: 2.2, draw: drawU });
  const lb = glowTube(pts(g.lband), 0.035, { dash: 70, gain: 2.2, draw: drawU });
  chart.add(mid, hb, lb);
  const iTop = g.hband.indexOf(Math.max(...g.hband));
  const fomoY = cs.y(g.hband[iTop]) - 0.6;
  const fomo = glowTube([new THREE.Vector3(-cs.span / 2 - 1, fomoY, 0.3), new THREE.Vector3(cs.span / 2 + 1, fomoY, 0.3)], 0.022, { dash: 90, gain: 2.6, draw: drawU });
  chart.add(fomo);
  const lblFomo = textPlane('FOMO LINE · HOT ABOVE', { height: 0.62, bg: '#000', fg: '#fff', border: true, pad: 22 });
  lblFomo.position.set(cs.span / 2 - 4.5, fomoY + 0.55, 0.35);
  const lblGauss = textPlane('GAUSS 4 · 144 · ×1.414', { height: 0.62, bg: '#fff', fg: '#000', pad: 22 });
  lblGauss.position.set(cs.x(40), cs.y(g.hband[40]) + 1.5, 0.35);
  const bzI = Math.floor(bars.length * 0.8);
  const bzLo = cs.y(g.filt[bzI]) - 0.9;
  const bzHi = cs.y(g.filt[bzI]) + 0.35;
  const bz = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(cs.span * 0.24, bzHi - bzLo, 0.01)), new THREE.LineBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4) }));
  bz.position.set(cs.x(bzI) + cs.span * 0.08, (bzLo + bzHi) / 2, 0.3);
  const lblBz = textPlane('BUY ZONE · 2.1R', { height: 0.5, bg: '#fff', fg: '#000', pad: 20 });
  lblBz.position.set(bz.position.x - cs.span * 0.12 + 2.1, bzLo - 0.5, 0.35);
  chart.add(lblFomo, lblGauss, bz, lblBz);
  scene.add(chart);
  const chartLabels = [lblFomo, lblGauss, lblBz];
  sets.push({
    page: 1,
    group: chart,
    update(dt, t) {
      cs.uniforms.uVis.value = chartVis.value;
      cs.uniforms.uTime.value = t;
      [mid, hb, lb, fomo].forEach((m) => (m.userData.u.uTime.value = t));
      chartLabels.forEach((l, i) => (l.userData.vis.value = THREE.MathUtils.clamp(drawU.value * 1.6 - 0.35 - i * 0.12, 0, 1)));
      bz.visible = drawU.value > 0.72;
      bz.scale.y = THREE.MathUtils.clamp((drawU.value - 0.72) * 6, 0.001, 1);
      chart.visible = chartVis.value > 0.001;
      chart.rotation.y = Math.sin(t * 0.13) * 0.04;
      chart.position.y = O.y + 0.2 + Math.sin(t * 0.21) * 0.15;
    },
    enter() {
      A.animate('vis_chart', 1, 1.4, ease.outCubic, 0.1);
      A.animate('chartDraw', 1, 2.6, ease.inOutCubic, 0.7);
    },
    leave() {
      A.animate('vis_chart', 0, 0.7, ease.inCubic, 0.5);
      A.animate('chartDraw', 0, 0.6, ease.inCubic, 0.4);
    },
  });

  // ===== page 2 · FEAR: a parabolic pump running up toward the F (white page, black ink)
  const pumpVis = vis('pump');
  const pump = new THREE.Group();
  const pbars = makeCandles(44, 21, 'pump');
  const ps = new Candles(pbars, { width: 0.42, gap: 0.2, height: 12.5, ink: 0 });
  pump.add(ps.mesh);
  pump.position.copy(F).add(new THREE.Vector3(-8.5, 1.25, 5.5));
  pump.rotation.y = 0.32;
  const topI = pbars.length - 2;
  const lblX = textPlane(['EXTREME', '+312% · 15M'], { font: '800 72px "Martian Mono"', height: 1.7, bg: '#000', fg: '#fff', pad: 30 });
  lblX.position.set(ps.x(topI) - 5.4, ps.y(pbars[topI].h) - 1.2, 0.3);
  pump.add(lblX);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.05), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  ground.position.set(0, -ps.height / 2 - 0.02, 0);
  pump.add(ground);
  scene.add(pump);
  sets.push({
    page: 2,
    group: pump,
    update() {
      ps.uniforms.uVis.value = pumpVis.value;
      lblX.userData.vis.value = THREE.MathUtils.clamp(pumpVis.value * 2 - 1, 0, 1);
      pump.visible = pumpVis.value > 0.001;
      ground.scale.x = Math.max(0.001, pumpVis.value);
    },
    enter: () => A.animate('vis_pump', 1, 1.6, ease.outCubic, 0.2),
    leave: () => A.animate('vis_pump', 0, 0.6, ease.inCubic, 0.25),
  });

  // ===== page 3 · OF: who the supply belongs to. Wallets orbit the orb, flagged ones blink.
  const swarmVis = vis('swarm');
  const N = 1400;
  const orbit = new Float32Array(N * 4);
  const flag = new Float32Array(N);
  const r = rng(42);
  for (let i = 0; i < N; i++) {
    const ring = r() < 0.75;
    const rad = ring ? 7.2 + r() * 5.5 : 5.6 + r() * 2.5;
    orbit.set([rad, r() * Math.PI * 2, ring ? (r() - 0.5) * 0.9 : (r() - 0.5) * 7, (0.05 + r() * 0.12) * (r() < 0.12 ? -1 : 1) * (9 / rad)], i * 4);
    flag[i] = r() < 0.028 ? 1 : 0;
  }
  const sg = new THREE.BoxGeometry(1, 1, 1);
  const swarmU = { uTime: { value: 0 }, uVis: swarmVis, uScale: { value: 0.09 } };
  const swarm = new THREE.InstancedMesh(sg, new THREE.ShaderMaterial({ vertexShader: SWARM_V, fragmentShader: SWARM_F, uniforms: swarmU }), N);
  sg.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(orbit, 4));
  sg.setAttribute('aFlag', new THREE.InstancedBufferAttribute(flag, 1));
  const idm = new THREE.Matrix4();
  for (let i = 0; i < N; i++) swarm.setMatrixAt(i, idm);
  swarm.frustumCulled = false;
  swarm.position.copy(S);
  scene.add(swarm);
  sets.push({
    page: 3,
    group: swarm,
    update(dt, t) {
      swarmU.uTime.value = t;
      swarm.visible = swarmVis.value > 0.001;
    },
    enter: () => A.animate('vis_swarm', 1, 2.0, ease.outCubic, 0.35),
    leave: () => A.animate('vis_swarm', 0, 0.8, ease.inCubic),
  });

  return {
    pumpTop: () => {
      pump.updateMatrixWorld(true);
      return pump.localToWorld(new THREE.Vector3(ps.x(pbars.length - 1), ps.y(pbars[pbars.length - 1].h), 0));
    },
    enter(p, prev) {
      for (const s of sets) {
        if (s.page === p) s.enter();
        else if (s.page === prev) s.leave();
      }
    },
    warm() {
      for (const s of sets) s.group.visible = true;
    },
    update(dt, t, value, camera, rig, orb) {
      for (const s of sets) s.update(dt, t, orb);
    },
    resize() {},
  };
}
