// One store of named animated values. Each value is a { value } object that can be dropped straight into a
// shader's uniforms, so animate('orbSpike', 1, 0.8) changes the picture with no other plumbing.
import * as THREE from 'three';

export const ease = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
};

function lerpValue(a, b, t) {
  if (typeof a === 'number') return a + (b - a) * t;
  if (a.isVector3) return a.clone().lerp(b, t);
  if (a.isColor) return a.clone().lerp(b, t);
  return t < 1 ? a : b;
}

export class Animator {
  constructor() {
    this.vars = new Map();
    this.tweens = new Map();
  }

  add(name, init, easing = ease.inOutCubic) {
    if (this.vars.has(name)) return this.vars.get(name).u;
    const u = { value: init };
    this.vars.set(name, { u, easing });
    return u;
  }

  u(name) {
    const v = this.vars.get(name);
    if (!v) throw new Error('animator: no value ' + name);
    return v.u;
  }

  get(name) {
    return this.u(name).value;
  }

  set(name, value) {
    this.tweens.delete(name);
    const u = this.u(name);
    if (u.value && u.value.copy && value.copy) u.value.copy(value);
    else u.value = value;
  }

  animate(name, to, duration = 1, easing, delay = 0) {
    const v = this.vars.get(name);
    if (!v) return Promise.resolve();
    const prev = this.tweens.get(name);
    if (prev) prev.resolve();
    return new Promise((resolve) => {
      const from = v.u.value && v.u.value.clone ? v.u.value.clone() : v.u.value;
      this.tweens.set(name, { from, to, t: -delay, duration: Math.max(1e-4, duration), easing: easing || v.easing, resolve, u: v.u });
    });
  }

  update(dt) {
    for (const [name, tw] of this.tweens) {
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(1, tw.t / tw.duration);
      const e = tw.easing(k);
      const val = lerpValue(tw.from, tw.to, e);
      if (tw.u.value && tw.u.value.copy && val && val.copy) tw.u.value.copy(val);
      else tw.u.value = val;
      if (k >= 1) {
        this.tweens.delete(name);
        tw.resolve();
      }
    }
  }
}

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
