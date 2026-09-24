// The wall. When loading hits 100 the loader canvas becomes the front face of a wall of tiles standing exactly
// where the screen is, the orb punches through it toward the camera, and the tiles blow out and fall away.
import * as THREE from 'three';
import { ease } from '../engine/animator.js';

const TILE_V = /* glsl */ `
attribute vec4 aUv;
varying vec2 vUv; varying float vFront; varying vec3 vN;
void main(){
  vFront = step(.5, normal.z);
  vUv = aUv.xy + uv * aUv.zw;
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.);
}`;
const TILE_F = /* glsl */ `
uniform sampler2D map; uniform float uSide;
varying vec2 vUv; varying float vFront; varying vec3 vN;
void main(){
  vec3 t = texture2D(map, vUv).rgb;
  // the loader is navy and white; its brightness is what matters, the grade maps it back to fomo's navy
  float lum = dot(t, vec3(.2126, .7152, .0722));
  vec3 front = vec3(pow(smoothstep(.06, 1., lum), 2.2) * 6.);
  float lit = .35 + .65 * clamp(dot(vN, normalize(vec3(.3, .8, .5))), 0., 1.);
  vec3 side = vec3(uSide * lit);
  gl_FragColor = vec4(mix(side, front, vFront), 1.);
}`;

export class Intro {
  constructor({ scene, camera, animator, ui, reduced, getOrbTarget }) {
    this.scene = scene;
    this.camera = camera;
    this.A = animator;
    this.ui = ui;
    this.reduced = reduced;
    this.getOrbTarget = getOrbTarget;
    this.orbWeight = 0;
    this.orbPos = new THREE.Vector3();
    this.tiles = null;
    this.t = -1;
  }

  _buildWall() {
    const cam = this.camera;
    const dist = 3;
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const w = h * cam.aspect;
    const rows = Math.max(6, Math.round(h / 0.22));
    const cols = Math.max(6, Math.round(w / (h / rows)));
    const tw = w / cols;
    const th = h / rows;
    const n = rows * cols;
    const tex = new THREE.CanvasTexture(this.ui.loader);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const geo = new THREE.BoxGeometry(tw * 0.995, th * 0.995, Math.min(tw, th) * 0.9);
    const uv = new Float32Array(n * 4);
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.ShaderMaterial({ vertexShader: TILE_V, fragmentShader: TILE_F, uniforms: { map: { value: tex }, uSide: { value: 2.2 } } }),
      n
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    const items = [];
    const m = new THREE.Matrix4();
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + tw * (c + 0.5);
        const y = h / 2 - th * (r + 0.5);
        uv.set([c / cols, 1 - (r + 1) / rows, 1 / cols, 1 / rows], k * 4);
        const it = { base: new THREE.Vector3(x, y, -dist), pos: new THREE.Vector3(x, y, -dist), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, delay: 0, live: false };
        items.push(it);
        m.makeTranslation(x, y, -dist);
        mesh.setMatrixAt(k, m);
        k++;
      }
    }
    geo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uv, 4));
    // the wall lives in camera space so it lines up with the screen exactly
    const holder = new THREE.Group();
    holder.position.copy(cam.position);
    holder.quaternion.copy(cam.quaternion);
    holder.add(mesh);
    this.scene.add(holder);
    this.tiles = { mesh, items, holder, w, h, dist };
  }

  async play() {
    await this.ui.loaderFinished();
    await new Promise((r) => setTimeout(r, 280));
    if (this.reduced) {
      this.ui.hideLoader();
      return;
    }
    this._buildWall();
    this.ui.hideLoader();
    const T = this.tiles;
    // impact point: where the orb sits on screen at rest
    const target = this.getOrbTarget();
    const local = T.holder.worldToLocal(target.clone());
    const ndc = new THREE.Vector3(local.x / -local.z, local.y / -local.z, 1).multiplyScalar(T.dist);
    const impact = new THREE.Vector3(ndc.x, ndc.y, -T.dist);
    this.impact = impact;
    // the orb starts behind the wall on the impact ray
    this.orbFrom = T.holder.localToWorld(impact.clone().multiplyScalar(2.4));
    this.orbHit = T.holder.localToWorld(impact.clone().multiplyScalar(0.55));
    this.t = 0;
    this.phase = 'charge';
    this.orbWeight = 1;
    this.orbPos.copy(this.orbFrom);
    await new Promise((r) => (this.done = r));
  }

  _explode() {
    const T = this.tiles;
    for (const it of T.items) {
      const d = it.base.clone().sub(this.impact);
      const len = d.length();
      it.delay = len * 0.09;
      const dir = new THREE.Vector3(d.x, d.y, 0).normalize();
      const power = 1.9 / (0.35 + len);
      it.vel.set(dir.x * (0.8 + power * 2.2), dir.y * (0.8 + power * 2.2) + 0.4, 1.2 + power * 3.2 + Math.random() * 0.8);
      it.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 5).multiplyScalar(0.4 + power);
      it.live = true;
    }
    this.A.animate('flash', 0.85, 0.06, ease.outCubic).then(() => this.A.animate('flash', 0, 0.7, ease.outExpo));
  }

  update(dt) {
    if (this.t < 0 || !this.tiles) return;
    this.t += dt;
    const T = this.tiles;
    const t = this.t;
    const target = this.getOrbTarget();
    if (this.phase === 'charge') {
      // a beat of stillness, then the orb comes through
      const k = Math.min(1, Math.max(0, (t - 0.25) / 0.22));
      this.orbPos.lerpVectors(this.orbFrom, this.orbHit, ease.inCubic(k));
      if (k > 0.55 && !this.exploded) {
        this.exploded = true;
        this._explode();
        this.onImpact && this.onImpact();
      }
      if (k >= 1) {
        this.phase = 'settle';
        this.settleT = 0;
        this.settleFrom = this.orbPos.clone();
      }
    } else if (this.phase === 'settle') {
      this.settleT += dt;
      const k = Math.min(1, this.settleT / 1.5);
      this.orbPos.lerpVectors(this.settleFrom, target, ease.inOutCubic(k));
      this.orbWeight = 1 - ease.inCubic(Math.max(0, (k - 0.7) / 0.3));
      if (k >= 1) this.phase = 'free';
    }
    if (this.exploded) {
      const m = new THREE.Matrix4();
      const tE = t - 0.36;
      let alive = 0;
      T.items.forEach((it, i) => {
        const lt = tE - it.delay;
        if (lt > 0) {
          it.vel.y -= 5.5 * dt;
          it.pos.addScaledVector(it.vel, dt);
          it.rot.x += it.spin.x * dt;
          it.rot.y += it.spin.y * dt;
          it.rot.z += it.spin.z * dt;
          it.s = Math.max(0, 1 - Math.max(0, lt - 1.1) / 0.9);
        }
        if (it.s > 0) alive++;
        it.q.setFromEuler(it.rot);
        m.compose(it.pos, it.q, new THREE.Vector3(it.s, it.s, it.s));
        T.mesh.setMatrixAt(i, m);
      });
      T.mesh.instanceMatrix.needsUpdate = true;
      if (!alive && this.phase === 'free') {
        this.scene.remove(T.holder);
        T.mesh.geometry.dispose();
        T.mesh.material.uniforms.map.value.dispose();
        T.mesh.material.dispose();
        this.tiles = null;
        this.t = -1;
        this.orbWeight = 0;
        this.done && this.done();
      }
    }
  }
}
