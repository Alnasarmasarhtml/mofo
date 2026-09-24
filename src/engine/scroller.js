// Virtual scroller: the page never scrolls. Wheel, touch and keys move a target page index, a spring carries
// `value` there, so the camera is always travelling continuously but always settles exactly on a page.
// One page per gesture: trackpad inertia tails can't skip pages.

export class Scroller {
  constructor(count, opts = {}) {
    this.count = count;
    this.value = opts.start || 0;
    this.target = this.value;
    this.vel = 0;
    this.stretch = 0; // small rubber-band offset while the wheel is pulling, feels responsive before a step fires
    this.enabled = false;
    this.listeners = new Set();
    this.lastWheelAt = 0;
    this.gestureAcc = 0;
    this.gestureStepped = false;
    this.gestureStart = 0;
    this.lockUntil = 0;
    this.tween = null;
    this.current = Math.round(this.value);
    this._bind();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) fn(this.target, this.current);
  }

  go(index, { instant = false } = {}) {
    const t = Math.max(0, Math.min(this.count - 1, index));
    if (t === this.target && !instant) return;
    this.target = t;
    if (instant) {
      this.value = t;
      this.vel = 0;
    }
    this._emit();
  }

  step(dir) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now < this.lockUntil) return;
    const next = Math.max(0, Math.min(this.count - 1, this.target + dir));
    if (next === this.target) return;
    this.lockUntil = now + 650;
    this.go(next);
  }

  _bind() {
    addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!this.enabled) return;
        const now = performance.now();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 36;
        if (e.deltaMode === 2) dy *= innerHeight;
        // A pause starts a new gesture. Inside one gesture only one page step, unless the push keeps going hard.
        if (now - this.lastWheelAt > 220) {
          this.gestureAcc = 0;
          this.gestureStepped = false;
          this.gestureStart = now;
        }
        this.lastWheelAt = now;
        this.gestureAcc += dy;
        this.stretch = Math.max(-0.18, Math.min(0.18, this.stretch + dy * 0.0009));
        const thresh = 40;
        if (!this.gestureStepped && Math.abs(this.gestureAcc) > thresh) {
          this.gestureStepped = true;
          this.step(Math.sign(this.gestureAcc));
          this.gestureAcc = 0;
        } else if (this.gestureStepped && now - this.gestureStart > 1100 && Math.abs(dy) > 60) {
          // a long, hard, sustained scroll (mouse wheel spun on purpose) may advance again
          this.gestureStart = now;
          this.step(Math.sign(dy));
        }
      },
      { passive: false }
    );

    let ty = null;
    let tStart = 0;
    addEventListener(
      'touchstart',
      (e) => {
        ty = e.touches[0].clientY;
        tStart = ty;
      },
      { passive: true }
    );
    addEventListener(
      'touchmove',
      (e) => {
        if (ty === null || !this.enabled) return;
        const y = e.touches[0].clientY;
        const d = ty - y;
        ty = y;
        this.stretch = Math.max(-0.22, Math.min(0.22, this.stretch + d * 0.0022));
        if (e.cancelable) e.preventDefault();
      },
      { passive: false }
    );
    addEventListener('touchend', (e) => {
      if (ty === null) return;
      const total = tStart - ty;
      ty = null;
      if (Math.abs(total) > 38) this.step(Math.sign(total));
    });

    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['ArrowDown', 'PageDown', ' ', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.lockUntil = 0;
        this.step(1);
      } else if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault();
        this.lockUntil = 0;
        this.step(-1);
      } else if (e.key === 'Home') this.go(0);
      else if (e.key === 'End') this.go(this.count - 1);
    });
  }

  update(dt) {
    dt = Math.min(dt, 1 / 30);
    // critically damped spring toward the target page
    const k = 22;
    const c = 2 * Math.sqrt(k) * 0.92;
    const x = this.value - (this.target + this.stretch);
    this.vel += (-k * x - c * this.vel) * dt;
    this.value += this.vel * dt;
    this.stretch *= Math.pow(0.02, dt);
    this.value = Math.max(-0.25, Math.min(this.count - 0.75, this.value));
    const cur = Math.max(0, Math.min(this.count - 1, Math.round(this.value)));
    if (cur !== this.current) {
      this.current = cur;
    }
    return this.value;
  }

  get speed() {
    return Math.abs(this.vel);
  }
}
