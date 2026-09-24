// Grade: scene -> bloom -> anamorphic streaks + light rays -> output (sRGB) -> SMAA -> final
// (zoom blur on fast travel, vignette, grain, 1-bit dither, invert flash, letterbox). Everything ends monochrome.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const BRIGHT = /* glsl */ `
uniform sampler2D tDiffuse; uniform float uThreshold; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float w = max(0., l - uThreshold) / max(l, 1e-4);
  gl_FragColor = vec4(min(c * w, vec3(3.)), 1.);
}`;

const STREAK = /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 acc = vec3(0.); float wsum = 0.;
  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    float w = exp(-abs(fi) * 0.28);
    acc += texture2D(tDiffuse, vUv + uDir * fi).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.);
}`;

const RAYS = /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 uLight; uniform float uDensity; uniform float uDecay; uniform float uLightR; uniform float uAspect; varying vec2 vUv;
float src(vec2 uv){
  // only the eclipse corona feeds the rays: an annulus around the light, so chrome highlights elsewhere don't streak
  float d = length((uv - uLight) * vec2(uAspect, 1.));
  return smoothstep(uLightR * 1.9, uLightR * 1.02, d) * smoothstep(uLightR * .88, uLightR * .99, d);
}
void main(){
  vec2 d = (vUv - uLight) * uDensity / 56.;
  vec2 uv = vUv; float illum = 1.; vec3 acc = vec3(0.);
  for (int i = 0; i < 56; i++) {
    uv -= d;
    vec2 cuv = clamp(uv, 0.001, 0.999);
    acc += texture2D(tDiffuse, cuv).rgb * src(cuv) * illum;
    illum *= uDecay;
  }
  gl_FragColor = vec4(acc / 56., 1.);
}`;

const COMP = /* glsl */ `
uniform sampler2D tDiffuse; uniform sampler2D tStreak; uniform sampler2D tRays;
uniform float uStreak; uniform float uRays; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  vec3 s = texture2D(tStreak, vUv).rgb;
  vec3 r = texture2D(tRays, vUv).rgb;
  float sl = dot(s, vec3(.333));
  gl_FragColor = vec4(c + vec3(sl) * uStreak + r * uRays, 1.);
}`;

class FlarePass extends Pass {
  constructor(w, h) {
    super();
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtBright = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtRays = new THREE.WebGLRenderTarget(1, 1, opts);
    this.uniforms = {
      threshold: { value: 2.2 },
      streak: { value: 0.35 },
      rays: { value: 0.0 },
      light: { value: new THREE.Vector2(0.5, 0.5) },
      density: { value: 0.9 },
      decay: { value: 0.955 },
      lightR: { value: 0.2 },
      aspect: { value: 1 },
    };
    const mk = (frag, uniforms) => new FullScreenQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }));
    this.qBright = mk(BRIGHT, { tDiffuse: { value: null }, uThreshold: this.uniforms.threshold });
    this.qStreak = mk(STREAK, { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.qRays = mk(RAYS, { tDiffuse: { value: null }, uLight: this.uniforms.light, uDensity: this.uniforms.density, uDecay: this.uniforms.decay, uLightR: this.uniforms.lightR, uAspect: this.uniforms.aspect });
    this.qComp = mk(COMP, { tDiffuse: { value: null }, tStreak: { value: null }, tRays: { value: null }, uStreak: this.uniforms.streak, uRays: this.uniforms.rays });
    this.setSize(w, h);
  }
  setSize(w, h) {
    const bw = Math.max(1, Math.floor(w / 4));
    const bh = Math.max(1, Math.floor(h / 4));
    this.rtBright.setSize(bw, bh);
    this.rtA.setSize(bw, bh);
    this.rtB.setSize(bw, bh);
    this.rtRays.setSize(Math.max(1, Math.floor(w / 3)), Math.max(1, Math.floor(h / 3)));
    this.texel = new THREE.Vector2(1 / bw, 1 / bh);
  }
  render(renderer, writeBuffer, readBuffer) {
    const on = this.uniforms.streak.value > 0.001 || this.uniforms.rays.value > 0.001;
    this.qBright.material.uniforms.tDiffuse.value = readBuffer.texture;
    if (on) {
      renderer.setRenderTarget(this.rtBright);
      this.qBright.render(renderer);
      // three widening horizontal passes: a long thin anamorphic streak
      let src = this.rtBright;
      let dst = this.rtA;
      for (const step of [1.5, 5, 16]) {
        this.qStreak.material.uniforms.tDiffuse.value = src.texture;
        this.qStreak.material.uniforms.uDir.value.set(this.texel.x * step, 0);
        renderer.setRenderTarget(dst);
        this.qStreak.render(renderer);
        src = dst;
        dst = dst === this.rtA ? this.rtB : this.rtA;
      }
      this.streakTex = src.texture;
      if (this.uniforms.rays.value > 0.001) {
        this.qRays.material.uniforms.tDiffuse.value = this.rtBright.texture;
        renderer.setRenderTarget(this.rtRays);
        this.qRays.render(renderer);
      }
    }
    const u = this.qComp.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tStreak.value = on ? this.streakTex : this.rtBright.texture;
    u.tRays.value = this.rtRays.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.qComp.render(renderer);
  }
}

const FINAL = /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime; uniform vec3 uNavy; uniform vec3 uLav;
uniform float uGrain, uVignette, uZoom, uDither, uDitherScale, uInvert, uLetterbox, uMono, uFlash, uScrim, uScrimSide, uScrimInk, uPortrait;
varying vec2 vUv;
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(.5 * a) * .25 + bayer2(a); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 uv = vUv;
  vec3 col = vec3(0.);
  // zoom blur toward the centre while the camera is travelling fast
  if (uZoom > 0.0005) {
    vec2 dir = (uv - .5) * uZoom;
    float wsum = 0.;
    for (int i = 0; i < 10; i++) {
      float t = float(i) / 9.;
      float w = 1. - t * .6;
      col += texture2D(tDiffuse, uv - dir * t).rgb * w;
      wsum += w;
    }
    col /= wsum;
  } else {
    col = texture2D(tDiffuse, uv).rgb;
  }
  // everything below works on brightness only; the last line maps it onto the logo's navy and lavender
  float l = dot(col, vec3(.2126, .7152, .0722));
  // lower-third scrim toward the page colour behind the copy, so type never sits on a highlight
  float sx = uScrimSide < -.5 ? smoothstep(.66, .02, uv.x) : uScrimSide > .5 ? smoothstep(.34, .98, uv.x) : 1. - smoothstep(.1, .6, abs(uv.x - .5));
  sx = mix(sx, 1., uPortrait);
  float sy = mix(smoothstep(.94, .28, uv.y), smoothstep(.62, .2, uv.y), uPortrait);
  l = mix(l, uScrimInk, clamp(uScrim * sx * sy, 0., 1.));
  // vignette
  vec2 q = uv * 2. - 1.;
  q.x *= mix(1., uRes.y / uRes.x, .5);
  l *= mix(1., smoothstep(1.9, .55, length(q)), uVignette);
  // 1-bit ordered dither
  if (uDither > 0.001) {
    float th = bayer8(gl_FragCoord.xy / uDitherScale);
    l = mix(l, step(th, l), uDither);
  }
  // grain
  l += (hash(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7) - .5) * uGrain;
  l = mix(l, 1. - l, uInvert);
  l = mix(l, 1., uFlash);
  // letterbox bars
  float lb = uLetterbox * .5;
  if (uv.y < lb || uv.y > 1. - lb) l = 0.;
  col = mix(uNavy, uLav, clamp(l, 0., 1.));
  gl_FragColor = vec4(col, 1.);
}`;

export function makePost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.4, 0.18, 1.85);
  composer.addPass(bloom);
  const flare = new FlarePass(size.x * pr, size.y * pr);
  composer.addPass(flare);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass(size.x * pr, size.y * pr);
  composer.addPass(smaa);
  const finalUniforms = {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(size.x * pr, size.y * pr) },
    uTime: { value: 0 },
    uGrain: { value: 0.045 },
    uVignette: { value: 0.9 },
    uZoom: { value: 0 },
    uDither: { value: 0 },
    uDitherScale: { value: Math.max(1, pr) },
    uInvert: { value: 0 },
    uLetterbox: { value: 0 },
    uMono: { value: 1 },
    uFlash: { value: 0 },
    uScrim: { value: 0 },
    uScrimSide: { value: -1 },
    uScrimInk: { value: 0 },
    uPortrait: { value: 0 },
    uNavy: { value: new THREE.Vector3(11 / 255, 9 / 255, 31 / 255) }, // #0B091F, fomo's black
    uLav: { value: new THREE.Vector3(234 / 255, 237 / 255, 255 / 255) }, // #EAEDFF, fomo's white
  };
  const finalPass = new (class extends Pass {
    constructor() {
      super();
      this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FINAL, uniforms: finalUniforms, depthTest: false, depthWrite: false }));
    }
    render(r, w, read) {
      finalUniforms.tDiffuse.value = read.texture;
      r.setRenderTarget(this.renderToScreen ? null : w);
      this.quad.render(r);
    }
  })();
  composer.addPass(finalPass);

  return {
    composer,
    bloom,
    flare,
    final: finalUniforms,
    setSize(w, h, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      bloom.setSize(w * pixelRatio, h * pixelRatio);
      flare.setSize(w * pixelRatio, h * pixelRatio);
      finalUniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
      finalUniforms.uDitherScale.value = Math.max(1, pixelRatio);
    },
    render(dt) {
      composer.render(dt);
    },
  };
}
