import * as THREE from 'three';
import { Animator, ease } from './engine/animator.js';
import { Scroller } from './engine/scroller.js';
import { CameraRig } from './engine/camera.js';
import { makePost } from './engine/post.js';
import { makeStudioEnv } from './engine/env.js';
import { newSample } from './engine/path.js';
import { Space } from './world/space.js';
import { Orb } from './world/orb.js';
import { loadFont, buildLetters } from './world/letters.js';
import { buildPaths } from './world/world.js';
import { buildSets } from './world/sets.js';
import { UI } from './ui/ui.js';
import { Intro } from './world/intro.js';
import { initButtons3D } from './ui/buttons3d.js';
import './style.css';

const PAGES = 6;
const isTouch = matchMedia('(pointer: coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
const quality = { pr: Math.min(devicePixelRatio, isTouch ? 1.5 : 1.6) };
renderer.setPixelRatio(quality.pr);
renderer.setSize(innerWidth, innerHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 2400);
const A = new Animator();
const ui = new UI({ pages: PAGES });

const G = {
  white: A.add('skyWhite', 0),
  bloom: A.add('bloom', 0.45),
  streak: A.add('streak', 0.22),
  rays: A.add('rays', 0.06),
  dither: A.add('dither', 0),
  letterbox: A.add('letterbox', 0),
  invert: A.add('invert', 0),
  flash: A.add('flash', 0),
  eclipse: A.add('eclipse', 0.55),
  letterEnv: A.add('letterEnv', 1),
  envRot: A.add('envRot', 0),
};

async function boot() {
  ui.loaderProgress(0.05);
  const [font] = await Promise.all([loadFont('fonts/ArchivoExpandedBlack.ttf'), document.fonts.ready]);
  ui.loaderProgress(0.35);
  const env = makeStudioEnv(renderer);
  scene.environment = null;

  const space = new Space({ count: isTouch ? 3500 : 6500, dust: isTouch ? 1200 : 2400 });
  scene.add(space.group);

  const L = buildLetters(font, env);
  scene.add(L.group);
  ui.loaderProgress(0.55);

  const orb = new Orb({ envMap: env, animator: A, detail: isTouch ? 0.6 : 1 });
  scene.add(orb.group);

  const sets = buildSets({ scene, animator: A, slots: L.slots, envMap: env, font });
  const paths = buildPaths(L.slots, { pumpTop: sets.pumpTop() });
  const rig = new CameraRig(camera, paths.cam, paths.camP);
  const orbSP = newSample();
  const orbS = newSample();
  ui.loaderProgress(0.75);

  // a key light so the non-chrome set pieces have shape
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-20, 30, 40);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

  const post = makePost(renderer, scene, camera);
  const scroller = new Scroller(PAGES, { start: 0, pace: isTouch ? 1.25 : 1 });

  // ---------------------------------------------------------------- page states
  const PAGE_STATE = [
    { white: 0, bloom: 0.45, streak: 0.14, rays: 0.45, eclipse: 0.45, spike: 0, eyes: 1, rough: 0.06, glass: 0, env: 1, scrim: 0.8, side: -1 },
    { white: 0, bloom: 0.45, streak: 0.14, rays: 0.45, eclipse: 0.5, spike: 0.05, eyes: 1, rough: 0.06, glass: 0, env: 1, scrim: 0.86, side: -1 },
    { white: 1, bloom: 0.0, streak: 0.0, rays: 0.0, eclipse: 0.0, spike: 0.9, eyes: 1, rough: 0.05, glass: 0, env: 1, scrim: 0.6, side: 1 },
    { white: 0, bloom: 0.4, streak: 0.14, rays: 0.55, eclipse: 0.7, spike: 0, eyes: 1, rough: 0.07, glass: 0, env: 0.85, scrim: 0.86, side: -1 },
    { white: 0, bloom: 0.5, streak: 0.18, rays: 0.85, eclipse: 1.0, spike: 0, eyes: 1, rough: 0.06, glass: 0, env: 0.9, scrim: 0.7, side: 0 },
    { white: 0, bloom: 0.45, streak: 0.2, rays: 1.0, eclipse: 1.0, spike: 0, eyes: 1, rough: 0.06, glass: 0, env: 0.9, scrim: 0.62, side: -1 },
  ];
  // The grade follows the camera, not the click: every value is blended between the two pages the camera is
  // travelling between, so the sky turns white exactly when the F comes into view, in both directions.
  const smooth = (a, b, x) => {
    const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const KEYS = ['white', 'bloom', 'streak', 'rays', 'eclipse', 'spike', 'eyes', 'rough', 'env'];
  const gs = { side: -1, ink: 0, scrim: 0 };
  function gradeAt(v) {
    const i = Math.max(0, Math.min(PAGES - 2, Math.floor(v)));
    const t = THREE.MathUtils.clamp(v - i, 0, 1);
    const a = PAGE_STATE[i];
    const b = PAGE_STATE[i + 1];
    for (const key of KEYS) {
      let k = smooth(0.3, 0.8, t);
      if (key === 'white' || key === 'spike') k = b[key] > a[key] ? smooth(0.6, 0.92, t) : b[key] < a[key] ? smooth(0.06, 0.36, t) : k;
      gs[key] = a[key] + (b[key] - a[key]) * k;
    }
    gs.side = t < 0.5 ? a.side : b.side;
    gs.scrim = t < 0.5 ? a.scrim * (1 - smooth(0.02, 0.3, t)) : b.scrim * smooth(0.7, 0.98, t);
    gs.ink = gs.white > 0.5 ? 1 : 0;
    return gs;
  }

  let page = -1;
  function enterPage(p) {
    if (p === page) return;
    const prev = page;
    page = p;
    sets.enter(p, prev);
    ui.enter(p, prev);
    if (prev !== -1) {
      // departure: the frame tightens into letterbox for the flight, opens again on arrival
      A.animate('letterbox', 0.085, 0.45, ease.outCubic).then(() => A.animate('letterbox', 0, 1.1, ease.inOutCubic, 0.35));
    }
  }
  let arrived = 0;
  function arrive(p) {
    rig.fovOffset += 3.5;
    if (p === 2) {
      A.animate('flash', 1, 0.07, ease.outCubic).then(() => A.animate('flash', 0, 0.9, ease.outExpo));
      rig.shake(2.4);
    }
  }
  scroller.on((target) => enterPage(target));
  // the tool page scrolls itself: it keeps the wheel until you're back at its top
  const doc = document.getElementById('doc');
  scroller.consume = (dir) => {
    if (page !== 5 || !doc) return false;
    if (dir > 0) return doc.scrollTop + doc.clientHeight < doc.scrollHeight - 2;
    if (dir < 0) return doc.scrollTop > 2;
    return true;
  };
  scroller.onKeyScroll = (dir) => doc.scrollBy({ top: dir * innerHeight * 0.8, behavior: 'smooth' });
  ui.onNav = (i) => {
    scroller.lockUntil = 0;
    scroller.go(i);
  };

  // ---------------------------------------------------------------- resize
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setPixelRatio(quality.pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h, quality.pr);
    space.uniforms.uRes.value.set(w * quality.pr, h * quality.pr);
    space.uniforms.uPR.value = quality.pr;
    const aspect = w / h;
    rig.portrait = THREE.MathUtils.clamp((16 / 9 - aspect) / (16 / 9 - 0.5), 0, 1);
    sets.resize && sets.resize(rig.portrait);
  }
  addEventListener('resize', resize);
  resize();

  // warm up every shader from every page before the loader drops
  const warm = [0, 1, 2, 3, 4];
  for (const p of warm) {
    rig.update(p, 0.016, 0);
    sets.warm && sets.warm(p);
    renderer.compile(scene, camera);
  }
  post.render(0.016);
  ui.loaderProgress(1);

  // desktop: live 3D bubble buttons; phones keep the CSS jelly keys
  initButtons3D();

  // ---------------------------------------------------------------- intro
  const orbRest = new THREE.Vector3();
  scene.add(camera);
  const intro = new Intro({ scene, camera, animator: A, ui, reduced, getOrbTarget: () => orbRest });
  intro.onImpact = () => {
    rig.shake(3.2);
    rig.fovOffset += 9;
    A.animate('letterbox', 0.1, 0.25, ease.outCubic).then(() => A.animate('letterbox', 0, 1.4, ease.inOutCubic, 0.4));
    setTimeout(() => ui.ready(), 700);
  };
  enterPage(0);
  rig.update(0, 0.016, 0);

  // ---------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  let time = 0;
  let fpsAcc = 0;
  let fpsN = 0;
  const lookTmp = new THREE.Vector3();
  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    time += dt;
    A.update(dt);
    const value = scroller.update(dt);
    rig.update(value, dt, time);

    // orb rides its own path; on the last two pages it sits in the word as the final O
    intro.update(dt, time);
    paths.orb.sample(value, orbS);
    if (rig.portrait > 0) {
      paths.orbP.sample(value, orbSP);
      orbS.pos.lerp(orbSP.pos, rig.portrait);
    }
    orbRest.copy(orbS.pos);
    orbRest.y += Math.sin(time * 1.05) * 0.18 * Math.max(0, 1 - (orbS.fov - 1.4) / 3.6);
    orb.group.position.copy(orbRest);
    if (intro.orbWeight > 0) orb.group.position.lerp(intro.orbPos, intro.orbWeight);
    orb.group.scale.setScalar(orbS.fov);
    // look at the pointer projected in front of the camera
    // eye contact with the viewer, pulled toward the cursor
    lookTmp.set(rig.follow.x * 4.5, rig.follow.y * 3, -2).applyQuaternion(camera.quaternion).add(camera.position);
    orb.lookAt(lookTmp);
    // scroll like you trade: fast travel makes the mind anxious
    const speed = scroller.speed;
    const g = gradeAt(value);
    if (Math.abs(value - scroller.target) < 0.04 && arrived !== scroller.target) {
      arrived = scroller.target;
      arrive(arrived);
    }
    const anxious = Math.min(1, speed * 0.55);
    orb.u.uSpike.value = Math.min(1.1, g.spike + anxious * 0.45);
    orb.eyesOpen.value = g.eyes;
    orb.rough.value = g.rough;
    orb.envI.value = g.env;
    orb.update(dt, time, camera.position);
    ui.heat(Math.max(anxious, g.spike * 0.9), speed);

    // letters: env strength, a slow light sweep through the env rotation
    L.mat.envMapIntensity = G.letterEnv.value;
    const rot = time * 0.05 + value * 0.9;
    L.mat.envMapRotation.set(0, rot, 0);
    // the orb's own offset keeps the front strips off its face, so the eyes stay the brightest thing on it
    orb.mat.envMapRotation.set(0, rot * 0.6 + 1.25, 0);

    space.uniforms.uWhite.value = g.white;
    space.eclU.uPower.value = g.eclipse;
    space.update(dt, time, camera, rig.velocity);
    sets.update(dt, time, value, camera, rig, orb);

    // grade
    post.bloom.strength = g.bloom;
    post.flare.uniforms.streak.value = g.streak;
    post.flare.uniforms.rays.value = g.rays;
    // rays pour out of the eclipse wherever it is on screen
    const ep = space.eclipse.position.clone().project(camera);
    post.flare.uniforms.light.value.set(ep.x * 0.5 + 0.5, ep.y * 0.5 + 0.5);
    const eDist = camera.position.distanceTo(space.eclipse.position);
    post.flare.uniforms.lightR.value = (0.42 * space.eclipse.scale.x) / eDist / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    post.flare.uniforms.aspect.value = camera.aspect;
    // behind the camera: no rays
    if (ep.z > 1) post.flare.uniforms.rays.value = 0;
    post.final.uTime.value = time;
    post.final.uZoom.value = reduced ? 0 : Math.min(0.08, speed * 0.028);
    post.final.uDither.value = G.dither.value;
    post.final.uLetterbox.value = G.letterbox.value;
    post.final.uInvert.value = G.invert.value;
    post.final.uFlash.value = G.flash.value;
    post.final.uVignette.value = 0.9 * (1 - g.white);
    post.final.uScrim.value = g.scrim;
    post.final.uScrimSide.value = g.side;
    post.final.uPortrait.value = rig.portrait;
    ui.setLight(g.white > 0.5);
    post.final.uScrimInk.value = g.ink;
    post.final.uGrain.value = 0.045 - g.white * 0.03;

    ui.update(dt, time, value, camera);
    post.render(dt);

    // adaptive resolution: drop the pixel ratio if frames run long
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc > 2.5) {
      const avg = fpsAcc / fpsN;
      if (avg > 1 / 42 && quality.pr > 0.75) {
        quality.pr = Math.max(0.75, quality.pr - 0.15);
        resize();
      }
      fpsAcc = 0;
      fpsN = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__mofo = { slots: L.slots, scroller, A, rig, orb, sets, intro, ui, go: (i) => scroller.go(i, { instant: true }), camera, quality, resize };
  // debug hook for captures: ?debug skips the intro
  const debug = new URLSearchParams(location.search).has('debug');
  if (debug) {
    ui.hideLoader();
    ui.ready();
  } else {
    await intro.play();
  }
  scroller.enabled = true;
  ui.ready();

}

boot().catch((e) => {
  console.error(e);
  ui.fail(e);
});
