// The monoliths: M, O, F in Archivo Expanded Black, extruded deep, chrome. The fourth slot is empty on purpose,
// the orb takes it. Their row positions are what the final pull-back reveals as the word.
import * as THREE from 'three';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export const CAP = 10; // cap height of every letter in world units

export async function loadFont(url) {
  const json = await new TTFLoader().loadAsync(url);
  return new Font(json);
}

export function letterGeometry(font, ch, { depth = 2.6, bevel = 0.14, curveSegments = 18 } = {}) {
  const probe = new TextGeometry('H', { font, size: 1, depth: 0.01, curveSegments: 2 });
  probe.computeBoundingBox();
  const capAt1 = probe.boundingBox.max.y - probe.boundingBox.min.y;
  probe.dispose();
  const size = CAP / capAt1;
  const g = new TextGeometry(ch, {
    font,
    size,
    depth,
    curveSegments,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 5,
  });
  g.computeBoundingBox();
  const bb = g.boundingBox;
  // centre on x and z, baseline at y = -CAP/2 so the letter is centred on its origin
  g.translate(-(bb.min.x + bb.max.x) / 2, -CAP / 2 - bb.min.y, -(bb.min.z + bb.max.z) / 2);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

export function buildLetters(font, envMap) {
  const chars = ['M', 'O', 'F'];
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.035,
    envMap,
    envMapIntensity: 1,
  });
  const geos = chars.map((c) => letterGeometry(font, c));
  const widths = geos.map((g) => g.boundingBox.max.x - g.boundingBox.min.x);
  const orbW = CAP * 1.02; // the orb slot
  const gap = CAP * 0.2;
  const all = widths.concat([orbW]);
  const total = all.reduce((a, b) => a + b, 0) + gap * (all.length - 1);
  let x = -total / 2;
  const centers = all.map((w) => {
    const c = x + w / 2;
    x += w + gap;
    return c;
  });
  const group = new THREE.Group();
  const letters = chars.map((c, i) => {
    const m = new THREE.Mesh(geos[i], mat);
    m.position.set(centers[i], 0, 0);
    m.userData.char = c;
    group.add(m);
    return m;
  });
  return { group, letters, mat, slots: centers.map((cx) => new THREE.Vector3(cx, 0, 0)), total, widths: all };
}
