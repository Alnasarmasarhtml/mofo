// The mind: a chrome droplet with the logo's eyes. Calm = mirror smooth. FOMO = it grows spikes and the eyes go wide.
// FOMO = it grows spikes and the eyes go wide. One mesh, every state is a uniform the animator moves.
import * as THREE from 'three';

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

// Base droplet shape + displacement, shared by the body and its outline hull.
const SHAPE = /* glsl */ `
uniform float uTime; uniform float uSpike; uniform float uWobble; uniform float uLine; uniform float uBreath;
${NOISE}
vec3 baseShape(vec3 p){
  vec3 q = p;
  q.y *= 1.06;
  q.xz *= 1.0 - 0.05 * p.y;
  return q;
}
float spikes(vec3 p){
  // sharp cones on a fibonacci sphere, lengths pulsing on their own clocks
  float acc = 0.0;
  for (int k = 0; k < 46; k++) {
    float fk = float(k) + 0.5;
    float phi = acos(1.0 - 2.0 * fk / 46.0);
    float th = 3.883222 * fk;
    vec3 d = vec3(cos(th) * sin(phi), cos(phi), sin(th) * sin(phi));
    float c = max(dot(p, d), 0.0);
    float len = 0.55 + 0.45 * sin(uTime * (1.7 + mod(fk, 5.0) * 0.37) + fk * 1.9);
    acc = max(acc, pow(c, 90.0) * len);
  }
  return acc;
}
float face(vec3 p){ return smoothstep(0.62, 0.9, dot(p, normalize(vec3(0.0, 0.08, 1.0)))); }
float disp(vec3 p){
  float w = snoise(p * 1.1 + vec3(0.0, uTime * 0.18, uTime * 0.08)) * uWobble * 0.028 * (1.0 - face(p) * 0.8);
  float br = sin(uTime * 1.1) * 0.012 * uBreath;
  float s = uSpike * spikes(p) * 0.85 * (1.0 - face(p) * 0.92);
  float jitter = uSpike * snoise(p * 5.0 + uTime * 2.4) * 0.025;
  return w + br + s + jitter;
}
vec3 displaced(vec3 p){ return baseShape(p) * (1.0 + disp(p)); }
`;

const DISPLACE_FN = /* glsl */ `
void orbDisplace(vec3 position, out vec3 dispPos, out vec3 dispN){
  vec3 sp = normalize(position);
  vec3 tA = normalize(cross(sp, abs(sp.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 tB = normalize(cross(sp, tA));
  float e = 0.004;
  vec3 P0 = displaced(sp);
  vec3 P1 = displaced(normalize(sp + tA * e));
  vec3 P2 = displaced(normalize(sp + tB * e));
  dispN = normalize(cross(P1 - P0, P2 - P0));
  if (dot(dispN, sp) < 0.0) dispN = -dispN;
  dispPos = P0 + dispN * uLine;
}
`;

function patch(material, uniforms, { outline = false } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const head = SHAPE + DISPLACE_FN;
    if (outline) {
      shader.vertexShader = head + shader.vertexShader.replace('#include <begin_vertex>', 'vec3 dispPos; vec3 dispN; orbDisplace(position, dispPos, dispN); vec3 transformed = dispPos;');
    } else {
      shader.vertexShader =
        head +
        shader.vertexShader
          .replace('#include <beginnormal_vertex>', 'vec3 dispPos; vec3 objectNormal; orbDisplace(position, dispPos, objectNormal);')
          .replace('#include <begin_vertex>', 'vec3 transformed = dispPos;');
    }
    if (!outline) {
      shader.fragmentShader = shader.fragmentShader
        .replace('uniform vec3 diffuse;', 'uniform vec3 diffuse; uniform float uRim; uniform float uSil;')
        .replace(
          '#include <opaque_fragment>',
          `
          float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
          outgoingLight = mix(outgoingLight, vec3(0.0), uSil);
          outgoingLight += vec3(fres) * uRim;
          #include <opaque_fragment>`
        );
    }
  };
  material.customProgramCacheKey = () => (outline ? 'orb-outline' : 'orb-body');
}

export class Orb {
  constructor({ envMap, animator, detail = 1 }) {
    const A = animator;
    this.u = {
      uTime: { value: 0 },
      uSpike: A.add('orbSpike', 0),
      uWobble: A.add('orbWobble', 1),
      uBreath: A.add('orbBreath', 1),
      uLine: { value: 0 },
      uRim: A.add('orbRim', 0.15),
      uSil: A.add('orbSil', 0),
    };
    this.outlineWidth = A.add('orbOutline', 0);
    this.eyesOpen = A.add('orbEyesOpen', 1);
    this.metal = A.add('orbMetal', 1);
    this.rough = A.add('orbRough', 0.06);
    this.glass = A.add('orbGlass', 0);
    this.white = A.add('orbWhite', 1);
    this.envI = A.add('orbEnv', 1);
    this.blink = 0;
    this.nextBlink = 2;
    this.lookTarget = new THREE.Vector3(0, 0, 10);
    this.lookCur = new THREE.Vector3(0, 0, 10);

    this.group = new THREE.Group(); // positioned by the world path
    this.body = new THREE.Group(); // rotates to look around
    this.group.add(this.body);

    const seg = Math.round(220 * detail);
    const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.06,
      envMap,
      envMapIntensity: 1,
      transmission: 0,
      thickness: 1.2,
      ior: 1.45,
    });
    patch(this.mat, this.u);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.body.add(this.mesh);

    // inverted hull outline, pushed out along the displaced normal
    this.lineU = Object.assign({}, this.u, { uLine: { value: 0 } });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    patch(lineMat, this.lineU, { outline: true });
    this.outline = new THREE.Mesh(geo, lineMat);
    this.outline.visible = false;
    this.body.add(this.outline);

    // eyes: the logo's eyes, two parallelograms leaning right. Measured off the logo: each is .52 as wide as it is
    // tall, the top edge sits .33 of the height further right than the bottom, the centres are 1.04 heights apart,
    // corners slightly rounded. Light on the dark chrome, the logo inverted. Shut = squashed to a thin slanted bar.
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    eyeMat.color.setScalar(1.25);
    this.eyeMat = eyeMat;
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const H = 0.36;
    const W = H * 0.52;
    const S = H * 0.335;
    const r = H * 0.035;
    const pts = [
      new THREE.Vector2(-W / 2 - S / 2, -H / 2),
      new THREE.Vector2(W / 2 - S / 2, -H / 2),
      new THREE.Vector2(W / 2 + S / 2, H / 2),
      new THREE.Vector2(-W / 2 + S / 2, H / 2),
    ];
    const shape = new THREE.Shape();
    // rounded corners: stop r short of each corner and curve through it
    for (let i = 0; i < 4; i++) {
      const p = pts[i];
      const prev = pts[(i + 3) % 4];
      const next = pts[(i + 1) % 4];
      const a = p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(r));
      const b = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(r));
      if (i === 0) shape.moveTo(a.x, a.y);
      else shape.lineTo(a.x, a.y);
      shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
    }
    shape.closePath();
    const eyeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
    eyeGeo.translate(0, 0, -0.03); // the back sits inside the surface, the face just proud of it
    this.eyes = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      const dir = new THREE.Vector3(side * H * 0.52, 0.24, 1).normalize();
      // sit on the droplet surface (same base shape as the shader)
      const p = dir.clone();
      p.y *= 1.06;
      const k = 1 - 0.05 * dir.y;
      p.x *= k;
      p.z *= k;
      pivot.position.copy(p);
      pivot.lookAt(pivot.position.clone().add(dir));
      const open = new THREE.Mesh(eyeGeo, eyeMat);
      // a dark rim just behind each eye keeps it crisp when a bright reflection slides under it
      const rim = new THREE.Mesh(eyeGeo, rimMat);
      rim.scale.set(1.2, 1.12, 0.8);
      rim.position.z = -0.006;
      open.add(rim);
      pivot.add(open);
      this.body.add(pivot);
      this.eyes.push({ pivot, open });
    }
  }

  setOutline(on) {
    this.outline.visible = on;
  }

  lookAt(v) {
    this.lookTarget.copy(v);
  }

  update(dt, time, cameraPos) {
    this.u.uTime.value = time;
    this.lineU.uTime = this.u.uTime;
    this.lineU.uLine.value = this.outlineWidth.value;
    this.outline.visible = this.outlineWidth.value > 0.001;
    const m = this.mat;
    m.metalness = this.metal.value;
    m.roughness = this.rough.value;
    m.transmission = this.glass.value > 0.002 ? this.glass.value : 0;
    m.envMapIntensity = this.envI.value;
    m.color.setScalar(this.white.value);
    // eyes
    this.nextBlink -= dt;
    if (this.nextBlink < 0) {
      this.blink = 1;
      this.nextBlink = 2.2 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const open = this.eyesOpen.value;
    const wide = 1 + this.u.uSpike.value * 0.55;
    const blinkK = 1 - Math.sin(Math.min(1, this.blink) * Math.PI) * 0.92;
    for (const e of this.eyes) {
      // shut (and mid-blink) the eye flattens to a thin slanted bar instead of disappearing
      e.open.scale.set(wide, Math.max(0.09, open * blinkK) * wide, wide);
    }
    // look: damped toward the target, a little jitter when anxious
    this.lookCur.lerp(this.lookTarget, 1 - Math.pow(0.02, dt));
    const local = this.group.worldToLocal(this.lookCur.clone());
    const yaw = Math.atan2(local.x, local.z);
    const pitch = Math.atan2(-local.y, Math.hypot(local.x, local.z));
    const j = this.u.uSpike.value;
    this.body.rotation.set(
      THREE.MathUtils.clamp(pitch, -0.6, 0.6) + Math.sin(time * 23) * 0.02 * j,
      THREE.MathUtils.clamp(yaw, -0.9, 0.9) + Math.sin(time * 19) * 0.02 * j,
      Math.sin(time * 0.7) * 0.04
    );
  }
}
