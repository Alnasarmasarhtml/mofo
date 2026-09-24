// Black studio for chrome: a black room with hard white strip lights, a top softbox and a thin horizon line.
// Everything the chrome letters and the orb reflect comes from here, so the whole world stays black and white.
import * as THREE from 'three';

export function makeStudioEnv(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const lightMat = (k) => {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    m.color.setScalar(k);
    return m;
  };
  const add = (w, h, k, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lightMat(k));
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    scene.add(m);
    return m;
  };
  // top softbox
  add(14, 5, 1.6, [0, 9.5, 0], [Math.PI / 2, 0, 0]);
  // tall strips, left and right, a little behind
  add(0.9, 18, 2.6, [-11, 0, -3], [0, Math.PI / 2.6, 0]);
  add(0.9, 18, 2.6, [11, 0, -3], [0, -Math.PI / 2.6, 0]);
  // thin strips in front, the specular streaks you see sliding over the letters
  add(0.35, 16, 3.2, [-5, 0, 11], [0, Math.PI, 0.18]);
  add(0.35, 16, 3.2, [6, 1, 11], [0, Math.PI, -0.12]);
  // back kicker
  add(10, 1.2, 1.8, [0, 3, -12], [0, 0, 0]);
  // horizon line all the way around: a thin bright ring low in the room
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 0.35, 64, 1, true), lightMat(0.9));
  ring.position.y = -1.2;
  scene.add(ring);
  // a faint floor so the bottom of the chrome isn't a hole
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), lightMat(0.015));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6;
  scene.add(floor);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt.texture;
}
