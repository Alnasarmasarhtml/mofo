// Camera / hero path authored as keys on the scroll value. Keys at whole numbers are the pages; keys in between
// are waypoints (through the O, over the top of the F). Catmull-Rom through the keys, so a page value always lands
// exactly on its key and the flight between them is one continuous curve.
import * as THREE from 'three';

const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

export class KeyPath {
  // keys: [{ v, pos: Vector3, target: Vector3, fov, roll }]
  constructor(keys) {
    this.keys = keys.slice().sort((a, b) => a.v - b.v);
  }

  _seg(s) {
    const k = this.keys;
    if (s <= k[0].v) return [0, 0];
    if (s >= k[k.length - 1].v) return [k.length - 2, 1];
    for (let i = 0; i < k.length - 1; i++) {
      if (s >= k[i].v && s <= k[i + 1].v) return [i, (s - k[i].v) / (k[i + 1].v - k[i].v)];
    }
    return [k.length - 2, 1];
  }

  sample(s, out) {
    const k = this.keys;
    const [i, t] = this._seg(s);
    const a = k[Math.max(0, i - 1)];
    const b = k[i];
    const c = k[i + 1];
    const d = k[Math.min(k.length - 1, i + 2)];
    const vec = (name, o) => {
      o.set(
        cr(a[name].x, b[name].x, c[name].x, d[name].x, t),
        cr(a[name].y, b[name].y, c[name].y, d[name].y, t),
        cr(a[name].z, b[name].z, c[name].z, d[name].z, t)
      );
      return o;
    };
    vec('pos', out.pos);
    vec('target', out.target);
    const sm = t * t * (3 - 2 * t);
    out.fov = b.fov + (c.fov - b.fov) * sm;
    out.roll = (b.roll || 0) + ((c.roll || 0) - (b.roll || 0)) * sm;
    return out;
  }
}

export const newSample = () => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 35, roll: 0 });
