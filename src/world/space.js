// Space: a black sky with faint nebula, a star shell that twinkles, warp dust that stretches with the camera's
// speed, and one eclipse far behind the word. uWhite flips the sky to white through a 1-bit dither, no grey fade.
import * as THREE from 'three';

const SKY_V = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`;
const SKY_F = /* glsl */ `
uniform float uTime; uniform float uWhite; uniform vec2 uRes; uniform float uPR; varying vec3 vDir;
float hash(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.03; a *= .5; } return s; }
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(.5 * a) * .25 + bayer2(a); }
void main(){
  vec3 d = normalize(vDir);
  float n = fbm(d * 2.2 + vec3(0., 0., uTime * .004));
  float n2 = fbm(d * 5.5 - vec3(uTime * .003));
  float neb = smoothstep(.52, .95, n) * .09 + smoothstep(.6, 1., n2) * .035;
  // a band of galaxy dust across the sky
  float band = exp(-pow(d.y * 3.2 + sin(d.x * 2.) * .3, 2.)) * .05 * n2;
  vec3 col = vec3(neb + band);
  // dithered flip to white, sweeping diagonally so it reads as a wipe
  vec2 fc = gl_FragCoord.xy / uPR;
  vec2 suv = gl_FragCoord.xy / uRes;
  float sweep = (suv.x * .6 + (1. - suv.y) * .4 - .5) * .9 * (1. - abs(uWhite * 2. - 1.));
  float th = bayer8(fc / 2.);
  float w = step(th + .0001, clamp(uWhite + sweep, 0., 1.)) * step(.0001, uWhite);
  col = mix(col, vec3(6.), w);
  gl_FragColor = vec4(col, 1.);
}`;

const STAR_V = /* glsl */ `
attribute float aSize; attribute float aSeed; uniform float uTime; uniform float uPR; uniform float uFade; varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float tw = .65 + .35 * sin(uTime * (1. + aSeed * 3.) + aSeed * 40.);
  vA = tw * uFade;
  gl_PointSize = aSize * uPR * (1. + step(.985, aSeed) * 1.6);
}`;
const STAR_F = /* glsl */ `varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); float a = smoothstep(.5, .0, d); a = pow(a, 1.6); gl_FragColor = vec4(vec3(1.), a * vA); }`;

const DUST_V = /* glsl */ `
attribute float aSide; attribute float aSeed; uniform vec3 uVel; uniform float uStretch; uniform vec3 uCam; uniform float uBox; uniform float uFade; varying float vA;
void main(){
  // dust lives in a box that wraps around the camera, so it is infinite
  vec3 p = position;
  vec3 rel = mod(p - uCam + uBox * .5, uBox) - uBox * .5;
  vec3 wp = uCam + rel;
  wp -= uVel * uStretch * aSide * (.6 + aSeed * .8);
  vec4 mv = viewMatrix * vec4(wp, 1.);
  gl_Position = projectionMatrix * mv;
  float dist = length(rel);
  vA = smoothstep(uBox * .5, uBox * .15, dist) * smoothstep(.5, 3., dist) * (.35 + aSeed * .65) * uFade;
}`;
const DUST_F = /* glsl */ `varying float vA; void main(){ gl_FragColor = vec4(vec3(1.), vA); }`;

const ECL_V = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const ECL_F = /* glsl */ `
uniform float uTime; uniform float uPower; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  float r = length(vUv);
  float R = .42;
  float a = atan(vUv.y, vUv.x);
  // corona: tight bright ring, a wider halo, and flame-like streamers
  float ring = exp(-abs(r - R) * 110.) * 1.6;
  float halo = exp(-max(r - R, 0.) * 9.) * .22 * step(R, r);
  float fl = noise(vec2(a * 6. + uTime * .05, r * 8. - uTime * .2)) * noise(vec2(a * 17. - uTime * .03, r * 3.));
  float stream = exp(-max(r - R, 0.) * 4.5) * fl * .35 * step(R, r);
  float c = (ring + halo + stream) * uPower * smoothstep(1., .72, r);
  float disk = step(r, R - .002);
  // the disk itself is pure black and opaque; everything else is additive light
  float alpha = max(disk, clamp(c, 0., 1.));
  gl_FragColor = vec4(vec3(c) * (1. - disk), alpha);
  if (r > 1.) discard;
}`;

export class Space {
  constructor({ count = 6000, dust = 2200 } = {}) {
    this.group = new THREE.Group();
    this.uniforms = {
      uTime: { value: 0 },
      uWhite: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPR: { value: 1 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 48, 32),
      new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false })
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.sky = sky;
    this.group.add(sky);

    // stars on a far shell
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = 380 + Math.random() * 480;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(t) * s * r, u * r * 0.8, Math.sin(t) * s * r], i * 3);
      size[i] = 0.8 + Math.pow(Math.random(), 6) * 3.2;
      seed[i] = Math.random();
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.starU = { uTime: this.uniforms.uTime, uPR: this.uniforms.uPR, uFade: { value: 1 } };
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({ vertexShader: STAR_V, fragmentShader: STAR_F, uniforms: this.starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.group.add(this.stars);

    // warp dust: each particle is a 2-vertex line; vertex 1 is dragged back along the camera velocity
    const box = 70;
    const dpos = new Float32Array(dust * 2 * 3);
    const side = new Float32Array(dust * 2);
    const dseed = new Float32Array(dust * 2);
    for (let i = 0; i < dust; i++) {
      const p = [(Math.random() - 0.5) * box, (Math.random() - 0.5) * box, (Math.random() - 0.5) * box];
      const sd = Math.random();
      dpos.set(p, i * 6);
      dpos.set(p, i * 6 + 3);
      side[i * 2] = 0;
      side[i * 2 + 1] = 1;
      dseed[i * 2] = sd;
      dseed[i * 2 + 1] = sd;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    dg.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(dseed, 1));
    this.dustU = { uVel: { value: new THREE.Vector3() }, uStretch: { value: 0.05 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uFade: { value: 1 } };
    this.dust = new THREE.LineSegments(dg, new THREE.ShaderMaterial({ vertexShader: DUST_V, fragmentShader: DUST_F, uniforms: this.dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dust.frustumCulled = false;
    this.group.add(this.dust);

    // eclipse far behind the word
    this.eclU = { uTime: this.uniforms.uTime, uPower: { value: 1 } };
    this.eclipse = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({ vertexShader: ECL_V, fragmentShader: ECL_F, uniforms: this.eclU, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })
    );
    this.eclipse.scale.setScalar(260);
    this.eclipse.position.set(0, 18, -420);
    this.eclipse.renderOrder = -8;
    this.group.add(this.eclipse);
  }

  update(dt, time, camera, camVel) {
    this.uniforms.uTime.value = time;
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position).multiplyScalar(0.92); // near-infinite, tiny parallax
    this.eclipse.lookAt(camera.position);
    this.dustU.uCam.value.copy(camera.position);
    // smooth the velocity so the streaks don't flicker
    this.dustU.uVel.value.lerp(camVel, 1 - Math.pow(0.001, dt));
    const w = this.uniforms.uWhite.value;
    this.eclipse.visible = this.eclU.uPower.value > 0.01;
    this.starU.uFade.value = 1 - Math.min(1, w * 1.6);
    this.dustU.uFade.value = 1 - Math.min(1, w * 1.6);
  }
}
