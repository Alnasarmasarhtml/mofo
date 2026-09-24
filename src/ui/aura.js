// Nen aura on the M, O and FO of the closing MIND OVER FOMO: a soft white glow that breathes (CSS) and
// Killua-style lightning that crackles along the letter edges (canvas). Bolts start and end on the glyph outline,
// so they hug the letters instead of floating around them.
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

function jag(ax, ay, bx, by, depth, rough, out) {
  if (depth === 0) {
    out.push([bx, by]);
    return;
  }
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const len = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / (len || 1);
  const ny = (bx - ax) / (len || 1);
  const off = (Math.random() - 0.5) * len * rough;
  const px = mx + nx * off;
  const py = my + ny * off;
  jag(ax, ay, px, py, depth - 1, rough, out);
  jag(px, py, bx, by, depth - 1, rough, out);
}

class Aura {
  constructor(span) {
    this.span = span;
    this.text = span.textContent;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'aura-bolts';
    this.canvas.setAttribute('aria-hidden', 'true');
    span.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.bolts = [];
    this.measure();
  }

  measure() {
    const cs = getComputedStyle(this.span);
    const fs = parseFloat(cs.fontSize);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.span.getBoundingClientRect();
    this.pad = fs * 0.28;
    const w = Math.ceil((r.width + this.pad * 2) * dpr);
    const h = Math.ceil((r.height + this.pad * 2) * dpr);
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = w / dpr + 'px';
    this.canvas.style.height = h / dpr + 'px';
    this.canvas.style.left = -this.pad + 'px';
    this.canvas.style.top = -this.pad + 'px';
    this.dpr = dpr;
    this.fs = fs * dpr;
    // the glyph mask is drawn in the same static cut the DOM uses (Archivo Expanded Black)
    const font = `900 ${this.fs}px "Archivo XB", "Archivo", sans-serif`;
    const probe = this.ctx;
    probe.font = font;
    const m = probe.measureText(this.text);
    const baseline = this.pad * dpr + (r.height * dpr + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    const spacing = cs.letterSpacing && cs.letterSpacing !== 'normal' ? parseFloat(cs.letterSpacing) * dpr + 'px' : '0px';
    this.pts = edgePoints(this.text, font, w, h, this.pad * dpr, baseline, spacing);
  }

  spawn() {
    const P = this.pts;
    if (!P.length) return;
    const a = P[(Math.random() * P.length) | 0];
    const reach = this.fs * (0.14 + Math.random() * 0.5);
    let b = null;
    // mostly edge to edge across a short distance; sometimes an arc leaps off the letter into the air
    if (Math.random() < 0.55) {
      for (let k = 0; k < 24; k++) {
        const c = P[(Math.random() * P.length) | 0];
        const d = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (d > this.fs * 0.06 && d < reach) {
          b = c;
          break;
        }
      }
    }
    if (!b) {
      // leap off the letter, away from its middle and a little upward, like aura flaring off the body
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      const out = Math.atan2(a[1] - cy, a[0] - cx);
      const ang = out + (Math.random() - 0.5) * 1.4;
      b = [a[0] + Math.cos(ang) * reach * 0.75, a[1] + Math.sin(ang) * reach * 0.75 - reach * 0.2];
    }
    const path = [[a[0], a[1]]];
    jag(a[0], a[1], b[0], b[1], 4, 0.55, path);
    const branch = [];
    if (Math.random() < 0.4) {
      const s = path[(path.length / 2) | 0];
      const ang = Math.random() * Math.PI * 2;
      const l = reach * 0.35;
      branch.push([s[0], s[1]]);
      jag(s[0], s[1], s[0] + Math.cos(ang) * l, s[1] + Math.sin(ang) * l, 3, 0.6, branch);
    }
    this.bolts.push({ path, branch, life: 1, width: (1 + Math.random() * 1.5) * this.dpr });
  }

  frame(dt) {
    const x = this.ctx;
    x.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // crackle in bursts: quiet stretches, then several bolts at once
    this.burst = (this.burst || 0) - dt;
    if (this.burst <= 0 && Math.random() < 0.11) this.burst = 0.08 + Math.random() * 0.22;
    const rate = this.burst > 0 ? 1 : 0.28;
    if (Math.random() < rate) this.spawn();
    if (Math.random() < rate * 0.5) this.spawn();
    x.lineCap = 'round';
    x.lineJoin = 'round';
    for (const b of this.bolts) {
      const draw = (pts, wmul) => {
        if (pts.length < 2) return;
        x.beginPath();
        x.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
        // glow pass, then a hot core
        x.shadowColor = `rgba(${LAV}, ${0.9 * b.life})`;
        x.shadowBlur = 16 * this.dpr;
        x.strokeStyle = `rgba(${LAV}, ${0.7 * b.life})`;
        x.lineWidth = b.width * 2.8 * wmul;
        x.stroke();
        x.shadowBlur = 0;
        x.strokeStyle = `rgba(255, 255, 255, ${b.life})`;
        x.lineWidth = b.width * wmul;
        x.stroke();
      };
      draw(b.path, 1);
      draw(b.branch, 0.6);
      b.life -= dt * (6 + Math.random() * 5);
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }
}

export function initAura(root) {
  const spans = [...root.querySelectorAll('.aura')];
  if (!spans.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; // the CSS glow stays, the lightning doesn't run
  let auras = [];
  let on = false;
  let last = 0;
  const start = () => {
    if (!auras.length) auras = spans.map((s) => new Aura(s));
  };
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
        start();
        on = true;
        last = 0;
        requestAnimationFrame(loop);
      });
    } else if (!vis) on = false;
  });
  spans.forEach((s) => io.observe(s));
  addEventListener('resize', () => auras.forEach((a) => a.measure()));
}
