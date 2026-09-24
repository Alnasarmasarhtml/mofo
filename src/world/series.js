// Synthetic memecoin candles (seeded, so every visit draws the same chart) and the Gaussian Channel [DW] filter,
// the same maths the extension draws on the fomo.family chart.

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// shape: 'chop-pump-dump' for the channel chart, 'pump' for the parabolic runway
export function makeCandles(n, seed, shape = 'chop-pump-dump') {
  const r = rng(seed);
  const out = [];
  let p = 1;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let drift;
    if (shape === 'pump') {
      drift = 0.004 + Math.pow(t, 3.2) * 0.2;
    } else {
      drift = t < 0.35 ? (Math.sin(i * 0.4) * 0.004) : t < 0.62 ? 0.028 + (t - 0.35) * 0.09 : t < 0.7 ? -0.05 : -0.004 + Math.sin(i * 0.3) * 0.006;
    }
    const vol = shape === 'pump' ? 0.03 + t * 0.07 : 0.035;
    const o = p;
    let c = o * (1 + drift + (r() - 0.5) * vol * 2);
    if (shape === 'pump' && i === n - 1) c = o * 0.93; // the top: last candle rejects
    const h = Math.max(o, c) * (1 + r() * vol * (shape === 'pump' && i === n - 1 ? 3.5 : 0.9));
    const l = Math.min(o, c) * (1 - r() * vol * 0.9);
    out.push({ o, h, l, c });
    p = c;
  }
  return out;
}

export function gaussian(bars, { poles = 4, period = 144, mult = 1.414 } = {}) {
  const N = poles;
  const beta = (1 - Math.cos((2 * Math.PI) / period)) / (Math.pow(1.414, 2 / N) - 1);
  const alpha = -beta + Math.sqrt(beta * beta + 2 * beta);
  const x = 1 - alpha;
  const C = (n, k) => {
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  };
  const run = (src) => {
    const f = [];
    for (let i = 0; i < src.length; i++) {
      let v = Math.pow(alpha, N) * src[i];
      for (let k = 1; k <= N; k++) {
        const prev = i - k >= 0 ? f[i - k] : src[0];
        v += (k % 2 ? 1 : -1) * C(N, k) * Math.pow(x, k) * prev;
      }
      f.push(v);
    }
    return f;
  };
  const src = bars.map((b) => (b.h + b.l + b.c) / 3);
  const tr = bars.map((b, i) => (i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c))));
  const filt = run(src);
  const ftr = run(tr);
  return { filt, hband: filt.map((f, i) => f + ftr[i] * mult), lband: filt.map((f, i) => f - ftr[i] * mult) };
}
