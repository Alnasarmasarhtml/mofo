// Camera rig: the path gives the base shot, then damped cursor parallax, a two-frequency shake,
// a fov kick and a slow handheld drift are layered on top so the frame is never dead still.
import * as THREE from 'three';
import { newSample } from './path.js';

export class CameraRig {
  constructor(camera, path, pathPortrait) {
    this.camera = camera;
    this.path = path;
    this.pathP = pathPortrait || path;
    this.s = newSample();
    this.sP = newSample();
    this.pointer = new THREE.Vector2();
    this.follow = new THREE.Vector2();
    this.followVel = new THREE.Vector2();
    this.parallax = 0.6;
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.fovOffset = 0;
    this.drift = 1;
    this.portrait = 0;
    this.prevPos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    });
  }

  shake(amp = 1) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  update(value, dt, time) {
    const s = this.path.sample(value, this.s);
    if (this.portrait > 0) {
      const p = this.pathP.sample(value, this.sP);
      const k = this.portrait;
      s.pos.lerp(p.pos, k);
      s.target.lerp(p.target, k);
      s.fov += (p.fov - s.fov) * k;
      s.roll += (p.roll - s.roll) * k;
    }
    const cam = this.camera;
    // damped follower of the pointer (spring), so parallax lags a little behind the hand
    const diff = this.pointer.clone().sub(this.follow);
    this.followVel.addScaledVector(diff, 6 * dt);
    this.followVel.multiplyScalar(Math.pow(0.02, dt));
    this.follow.addScaledVector(this.followVel, Math.min(2, dt * 60));

    cam.position.copy(s.pos);
    cam.lookAt(s.target);
    this._right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const dist = s.pos.distanceTo(s.target);
    const px = this.follow.x * this.parallax * Math.min(1, dist / 12);
    const py = this.follow.y * this.parallax * 0.6 * Math.min(1, dist / 12);
    // handheld drift: two slow sines
    const dx = (Math.sin(time * 0.31) * 0.12 + Math.sin(time * 0.17 + 1.3) * 0.08) * this.drift;
    const dy = (Math.cos(time * 0.23) * 0.09 + Math.sin(time * 0.41 + 0.4) * 0.04) * this.drift;
    cam.position.addScaledVector(this._right, px + dx).addScaledVector(this._up, py + dy);
    cam.lookAt(s.target);

    // roll from the path, shake on top
    this.shakeTime += dt * 24;
    this.shakeAmp *= Math.pow(0.04, dt);
    const a = this.shakeAmp;
    const t = this.shakeTime;
    this._e.set(
      (Math.sin(t * 1.1) * 0.6 + Math.sin(t * 2.3 + 1) * 0.4) * 0.012 * a,
      (Math.cos(t * 0.9) * 0.6 + Math.sin(t * 1.7 + 2) * 0.4) * 0.012 * a,
      s.roll + Math.sin(t * 1.3) * 0.006 * a
    );
    this._q.setFromEuler(this._e);
    cam.quaternion.multiply(this._q);

    this.fovOffset *= Math.pow(0.12, dt);
    const fov = s.fov + this.fovOffset;
    if (Math.abs(cam.fov - fov) > 1e-3) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.velocity.subVectors(cam.position, this.prevPos).divideScalar(Math.max(dt, 1e-3));
    this.prevPos.copy(cam.position);
  }
}
