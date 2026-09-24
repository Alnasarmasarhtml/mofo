// Desktop buttons: every .btn gets a live 3D bubble under its label, in the ball's materials. The main buttons are
// lavender vinyl carrying the logo's eyes, the rest are black chrome; on the lavender FEAR page they swap. Each
// bubble tilts toward the cursor, swells on hover and squishes when pressed. One small offscreen renderer draws
// every visible button into its own canvas; the canvases go through the site's navy/lavender grade (#duo).
import * as THREE from 'three';
import { makeStudioEnv } from '../engine/env.js';

const PAD = 18; // px of canvas around each button, room for the tilt and the swell

function pillGeo(w, h) {
  const r = h / 2;
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, w - h), 16, 56);
  g.rotateZ(Math.PI / 2);
  g.scale(1, 1, 0.62);
  return g;
}

function eyeGeo(H) {
  // the logo's eye: a parallelogram leaning right, .52 as wide as tall, top shifted .335 of the height
  const W = H * 0.52;
  const S = H * 0.335;
  const s = new THREE.Shape();
  s.moveTo(-W / 2 - S / 2, -H / 2);
  s.lineTo(W / 2 - S / 2, -H / 2);
  s.lineTo(W / 2 + S / 2, H / 2);
  s.lineTo(-W / 2 + S / 2, H / 2);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: H * 0.12, bevelEnabled: true, bevelThickness: H * 0.03, bevelSize: H * 0.025, bevelSegments: 2 });
}

export function initButtons3D() {
  const fine = matchMedia('(pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches;
  if (!fine || innerWidth < 821) return false;
  let gl;
  try {
    gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false });
  } catch (e) {
    return false; // no WebGL: the jelly keys stay
  }
  document.documentElement.classList.add('b3d');
  gl.setPixelRatio(Math.min(devicePixelRatio, 2));
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.setClearColor(0x000000, 0);
  const env = makeStudioEnv(gl);
  const ui = document.getElementById('ui');
  const vinylMat = () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#EAEDFF'), roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMap: env, envMapIntensity: 1.1, sheen: 0.4 });
  // satin chrome: blurred enough that the studio strips read as soft light, never a line through the label
  const chromeMat = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.24, metalness: 1, envMap: env, envMapIntensity: 0.75, clearcoat: 1, clearcoatRoughness: 0.35 });
  const eyeDark = new THREE.MeshBasicMaterial({ color: 0x0b091f });
  const eyeLight = new THREE.MeshBasicMaterial({ color: 0xeaedff });
  eyeLight.color.multiplyScalar(1.2);

  const items = [...document.querySelectorAll('.btn')].map((el) => {
    const c = document.createElement('canvas');
    c.className = 'b3';
    c.setAttribute('aria-hidden', 'true');
    el.prepend(c);
    const main = el.classList.contains('btn-solid');
    const it = { el, c, ctx: c.getContext('2d'), main, eyesOn: el.hasAttribute('data-eyes'), hover: 0, hoverT: 0, press: 0, pressT: 0, tilt: new THREE.Vector2(), tiltT: new THREE.Vector2(), size: '', drawn: false, blink: 0, nextBlink: 1 + Math.random() * 4 };
    it.scene = new THREE.Scene();
    it.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2, 3, 5);
    it.scene.add(key);
    it.pivot = new THREE.Group();
    it.scene.add(it.pivot);
    it.vinyl = new THREE.Mesh(undefined, vinylMat());
    it.chrome = new THREE.Mesh(undefined, chromeMat());
    it.pivot.add(it.vinyl, it.chrome);
    it.eyes = [];
    it.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    it.cam.position.set(0, 0, 8);
    el.addEventListener('pointerenter', () => (it.hoverT = 1));
    el.addEventListener('pointerleave', () => {
      it.hoverT = 0;
      it.pressT = 0;
    });
    el.addEventListener('pointerdown', () => (it.pressT = 1));
    return it;
  });
  addEventListener('pointerup', () => items.forEach((it) => (it.pressT = 0)));

  function fit(it, r) {
    const key = Math.round(r.width) + 'x' + Math.round(r.height);
    if (key === it.size) return;
    it.size = key;
    const h = 1;
    const w = r.width / r.height;
    const g = pillGeo(w * 0.95, h * 0.9);
    it.vinyl.geometry && it.vinyl.geometry.dispose();
    it.vinyl.geometry = g;
    it.chrome.geometry = g;
    const pw = (r.width + PAD * 2) / r.height / 2;
    const ph = (r.height + PAD * 2) / r.height / 2;
    Object.assign(it.cam, { left: -pw, right: pw, top: ph, bottom: -ph });
    it.cam.updateProjectionMatrix();
    for (const e of it.eyes) it.pivot.remove(e);
    it.eyes = [];
    if (it.eyesOn) {
      const eg = eyeGeo(0.3);
      for (const dx of [-0.105, 0.105]) {
        const e = new THREE.Mesh(eg, eyeDark);
        e.position.set(w * 0.475 - 0.43 + dx, 0.03, 0.27);
        it.pivot.add(e);
        it.eyes.push(e);
      }
    }
  }

  let mx = innerWidth / 2;
  let my = innerHeight / 2;
  addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
  });

  const visible = (el) => {
    if (el.checkVisibility) return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true });
    return !!el.offsetParent;
  };

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const light = ui.classList.contains('light');
    const pr = gl.getPixelRatio();
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      const show = r.width > 0 && r.bottom > -PAD && r.top < innerHeight + PAD && visible(it.el);
      if (!show) {
        if (it.drawn) {
          it.ctx.clearRect(0, 0, it.c.width, it.c.height);
          it.drawn = false;
        }
        continue;
      }
      fit(it, r);
      const cw = Math.round((r.width + PAD * 2) * pr);
      const ch = Math.round((r.height + PAD * 2) * pr);
      if (it.c.width !== cw || it.c.height !== ch) {
        it.c.width = cw;
        it.c.height = ch;
      }
      // the main button is vinyl, the rest chrome; on the lavender page they trade places
      const vinyl = it.main !== light;
      it.vinyl.visible = vinyl;
      it.chrome.visible = !vinyl;
      for (const e of it.eyes) e.material = vinyl ? eyeDark : eyeLight;
      // springs: tilt toward the cursor, swell on hover, squish on press
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      it.tiltT.set(THREE.MathUtils.clamp((my - cy) / 260, -1, 1), THREE.MathUtils.clamp((mx - cx) / 420, -1, 1));
      it.tilt.lerp(it.tiltT, 1 - Math.pow(0.001, dt));
      it.hover += (it.hoverT - it.hover) * (1 - Math.pow(0.0005, dt));
      it.press += (it.pressT - it.press) * (1 - Math.pow(0.00001, dt));
      const s = 1 + it.hover * 0.06 - it.press * 0.05;
      it.pivot.scale.set(s + it.press * 0.04, s - it.press * 0.12, s);
      it.pivot.rotation.set(it.tilt.x * (0.22 + it.hover * 0.2), it.tilt.y * (0.3 + it.hover * 0.25), 0);
      const rot = t / 4000 + it.tilt.y * 0.8;
      it.vinyl.material.envMapRotation.set(0, rot, 0);
      it.chrome.material.envMapRotation.set(0.35, rot * 0.5 + 2.1, 0);
      // on the lavender page the chrome runs darker so the lavender label stays readable on it
      it.chrome.material.envMapIntensity = light ? 0.38 : 0.75;
      it.nextBlink -= dt;
      if (it.nextBlink < 0) {
        it.blink = 1;
        it.nextBlink = 2.5 + Math.random() * 4;
      }
      it.blink = Math.max(0, it.blink - dt * 7);
      const open = 1 - Math.sin(Math.min(1, it.blink) * Math.PI) * 0.85;
      for (const e of it.eyes) {
        e.rotation.y = it.tilt.y * 0.4;
        e.scale.set(1, open * (1 + it.hover * 0.18), 1);
      }
      gl.setSize(r.width + PAD * 2, r.height + PAD * 2, false);
      gl.render(it.scene, it.cam);
      it.ctx.clearRect(0, 0, cw, ch);
      it.ctx.drawImage(gl.domElement, 0, 0, cw, ch);
      it.drawn = true;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return true;
}
