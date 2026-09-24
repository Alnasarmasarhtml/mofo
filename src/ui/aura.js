// Nen aura on the M, O and FO of the closing MIND OVER FOMO, the way Gon's looks: soft white vapor that clings to
// the letters and drifts slowly upward, thinning out as it rises. Puffs are born on the glyph outline (so the haze
// hugs the letter shapes), rise, spread, sway a little and fade. A soft glow on the letters themselves is CSS.
const LAV = '234, 237, 255';

function edgePoints(text, font, w, h, x0, baseline, spacing) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.font = font;
  if ('letterSpacing' in x) x.letterSpacing = spacing;
  x.fillStyle = '#fff';
  x.textBaseline = 'alphabetic';
  x.fillText(text, x0, baseline);
  const a = x.getImageData(0, 0, w, h).data;
  const inside = (i, j) => i >= 0 && j >= 0 && i < w && j < h && a[(j * w + i) * 4 + 3] > 127;
  const pts = [];
  for (let j = 1; j < h - 1; j += 2) {
    for (let i = 1; i < w - 1; i += 2) {
      if (!inside(i, j)) continue;
      if (!inside(i - 2, j) || !inside(i + 2, j) || !inside(i, j - 2) || !inside(i, j + 2)) pts.push([i, j]);
    }
  }
  return pts;
}

// one soft round puff, drawn once and stamped everywhere
function puffSprite(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${LAV}, 1)`);
  g.addColorStop(0.35, `rgba(${LAV}, .55)`);
  g.addColorStop(1, `rgba(${LAV}, 0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}

class Aura {
  constructor(span, sprite) {
    this.span = span;
    this.sprite = sprite;
    this.text = span.textContent;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'aura-vapor';
    this.canvas.setAttribute('aria-hidden', 'true');
    span.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.puffs = [];
    this.t = Math.random() * 100;
    this.measure();
  }

  measure() {
    const cs = getComputedStyle(this.span);
    const fs = parseFloat(cs.fontSize);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.span.getBoundingClientRect();
    // room for the haze: a lot above (it rises), less at the sides and below
    this.padX = fs * 0.4;
    this.padTop = fs * 1.05;
    this.padBottom = fs * 0.25;
    const w = Math.ceil((r.width + this.padX * 2) * dpr);
    const h = Math.ceil((r.height + this.padTop + this.padBottom) * dpr);
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = w / dpr + 'px';
    this.canvas.style.height = h / dpr + 'px';
    this.canvas.style.left = -this.padX + 'px';
    this.canvas.style.top = -this.padTop + 'px';
    this.dpr = dpr;
    this.fs = fs * dpr;
    const font = `900 ${this.fs}px "Archivo XB", "Archivo", sans-serif`;
    this.ctx.font = font;
    const m = this.ctx.measureText(this.text);
    const baseline = this.padTop * dpr + (r.height * dpr + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    const spacing = cs.letterSpacing && cs.letterSpacing !== 'normal' ? parseFloat(cs.letterSpacing) * dpr + 'px' : '0px';
    this.pts = edgePoints(this.text, font, w, h, this.padX * dpr, baseline, spacing);
    this.mask = { font, x0: this.padX * dpr, baseline, spacing };
    // favour the upper outline a little: the aura pours off the top of the body
    this.top = this.pts.filter((p) => p[1] < baseline - this.fs * 0.35);
  }

  spawn() {
    const src = this.top.length && Math.random() < 0.3 ? this.top : this.pts;
    if (!src.length) return;
    const p = src[(Math.random() * src.length) | 0];
    const s = this.fs;
    this.puffs.push({
      x: p[0] + (Math.random() - 0.5) * s * 0.04,
      y: p[1],
      vy: -(0.04 + Math.random() * 0.08) * s, // slow: a fraction of the letter height per second
      vx: (Math.random() - 0.5) * 0.03 * s,
      r0: s * (0.1 + Math.random() * 0.1),
      grow: s * (0.14 + Math.random() * 0.16),
      stretch: 1.4 + Math.random() * 0.9, // taller than wide: wisps streaming up
      life: 0,
      span: 3.5 + Math.random() * 3, // seconds on screen
      a: 0.04 + Math.random() * 0.045,
      ph: Math.random() * 6.28,
    });
  }

  frame(dt) {
    this.t += dt;
    // steady emission, breathing in slow waves like the aura swelling
    const wave = 0.75 + 0.25 * Math.sin(this.t * 0.9);
    this.acc = (this.acc || 0) + dt * 95 * wave;
    while (this.acc > 1) {
      this.acc -= 1;
      this.spawn();
    }
    const x = this.ctx;
    x.clearRect(0, 0, this.canvas.width, this.canvas.height);
    x.globalCompositeOperation = 'lighter';
    for (const p of this.puffs) {
      p.life += dt;
      const k = p.life / p.span;
      // rise, slow down a little, drift sideways in a lazy sine
      p.y += p.vy * dt * (1 - k * 0.35);
      p.x += (p.vx + Math.sin(this.t * 0.7 + p.ph) * this.fs * 0.012) * dt;
      const r = p.r0 + p.grow * k;
      const fade = Math.sin(Math.min(1, k) * Math.PI) * (1 - k * 0.4);
      x.globalAlpha = Math.max(0, p.a * fade);
      const ry = r * p.stretch;
      x.drawImage(this.sprite, p.x - r, p.y - ry * 0.75, r * 2, ry * 2);
    }
    x.globalAlpha = 1;
    // cut the haze out of the letters and a hair around them: the letters stay crisp, the aura wraps their outline
    const M = this.mask;
    x.globalCompositeOperation = 'destination-out';
    x.font = M.font;
    if ('letterSpacing' in x) x.letterSpacing = M.spacing;
    x.textBaseline = 'alphabetic';
    x.lineJoin = 'round';
    x.lineWidth = this.fs * 0.07;
    x.strokeStyle = '#000';
    x.fillStyle = '#000';
    x.fillText(this.text, M.x0, M.baseline);
    x.strokeText(this.text, M.x0, M.baseline);
    x.globalCompositeOperation = 'source-over';
    this.puffs = this.puffs.filter((p) => p.life < p.span);
  }
}

export function initAura(root) {
  const spans = [...root.querySelectorAll('.aura')];
  if (!spans.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // the CSS glow stays, the vapor doesn't run
  const sprite = puffSprite(128);
  let auras = [];
  let on = false;
  let last = 0;
  const loop = (t) => {
    if (!on) return;
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    for (const a of auras) a.frame(dt);
    requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver((es) => {
    const vis = es.some((e) => e.isIntersecting);
    if (vis && !on) {
      document.fonts.ready.then(() => {
        if (!auras.length) {
          auras = spans.map((s) => new Aura(s, sprite));
          // start already surrounded, not from nothing
          for (const a of auras) for (let i = 0; i < 300; i++) a.frame(1 / 60);
        }
        on = true;
        last = 0;
        requestAnimationFrame(loop);
      });
    } else if (!vis) on = false;
  });
  spans.forEach((s) => io.observe(s));
  addEventListener('resize', () => auras.forEach((a) => a.measure()));
}
