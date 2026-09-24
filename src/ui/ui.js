// The DOM layer: loader canvas (it becomes the wall texture), page copy with width-morphing headlines,
// the M O F O rail, the heat readout, trailer subtitles and the chart-crosshair cursor.
import gsap from 'gsap';
import { CONFIG } from '../config.js';

const NOISE = '▲▼$%#/<>+×'.split('');
const SUBS = ["every chart looks like the one that's gonna run", 'gaussian channel, 4 poles, 144 bars', 'your thumb is already on buy', "who's actually holding it", '', ''];
const HEAT = ['CALM', 'WARM', 'HOT', 'EXTREME'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export class UI {
  constructor({ pages }) {
    this.pages = pages;
    this.root = document.getElementById('ui');
    this.sections = [...document.querySelectorAll('.page')];
    this.railBtns = [...document.querySelectorAll('.rail button')];
    this.railBar = document.querySelector('.rail-bar');
    this.hudHeat = document.getElementById('hud-heat');
    this.heatSpans = [...document.querySelectorAll('.heatbar span')];
    this.sub = document.getElementById('sub');
    this.cursor = document.getElementById('cursor');
    this.onNav = null;
    this.pace = matchMedia('(pointer: coarse)').matches ? 0.8 : 1; // phones move 25% faster
    this.cur = -1;
    this.heatLevel = -1;
    this.loader = document.getElementById('loader');
    this.lctx = this.loader.getContext('2d');
    this.lp = 0;
    this.lpShown = 0;
    this._splitWords();
    this._links();
    this._nav();
    this._cursor();
    this._doc();
    this._sizeLoader();
    addEventListener('resize', () => this._sizeLoader());
    this._loaderLoop();
  }

  // ---------------------------------------------------------------- loader canvas
  _sizeLoader() {
    const dpr = Math.min(devicePixelRatio, 2);
    this.loader.width = Math.round(innerWidth * dpr);
    this.loader.height = Math.round(innerHeight * dpr);
    this.ldpr = dpr;
    this.drawLoader(this.lpShown);
  }

  loaderProgress(p) {
    this.lp = Math.max(this.lp, p);
  }

  _loaderLoop() {
    const tick = () => {
      if (this.loaderDone) return;
      // the counter eases toward the real progress, never faster than a beat, so it always reads as a count
      this.lpShown += Math.min(0.012, Math.max(0, this.lp - this.lpShown) * 0.12 + 0.002);
      this.lpShown = Math.min(this.lpShown, this.lp);
      this.drawLoader(this.lpShown);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  loaderFinished() {
    return new Promise((res) => {
      const check = () => (this.lpShown >= 0.999 ? res() : requestAnimationFrame(check));
      check();
    });
  }

  drawLoader(p, flash = 0) {
    const c = this.lctx;
    const W = this.loader.width;
    const H = this.loader.height;
    const d = this.ldpr;
    c.fillStyle = '#0B091F';
    c.fillRect(0, 0, W, H);
    // the word
    let size = Math.min(H * 0.34, W * 0.2);
    c.font = `900 ${size}px "Archivo XB"`;
    let tw = c.measureText('MOFO').width;
    const target = Math.min(W * 0.78, H * 1.6);
    size *= target / tw;
    c.font = `900 ${size}px "Archivo XB"`;
    const m = c.measureText('MOFO');
    tw = m.width;
    const asc = m.actualBoundingBoxAscent;
    const x = (W - tw) / 2;
    const y = H * 0.5 + asc / 2;
    c.lineWidth = Math.max(1, 1.5 * d);
    c.strokeStyle = '#EAEDFF';
    c.strokeText('MOFO', x, y);
    c.save();
    c.beginPath();
    const fillTop = y - asc * p;
    c.rect(0, fillTop, W, H);
    c.clip();
    c.fillStyle = '#EAEDFF';
    c.fillText('MOFO', x, y);
    c.restore();
    // hairline progress under the word
    c.fillStyle = '#EAEDFF';
    c.fillRect(x, y + 24 * d, tw * p, Math.max(1, d));
    for (let i = 0; i <= 20; i++) c.fillRect(x + (tw * i) / 20, y + 20 * d, Math.max(1, d), 4 * d);
    // corners
    const pad = Math.max(16, Math.min(44, innerWidth * 0.022)) * d;
    const mono = (s, px, weight = 500) => {
      c.font = `${weight} ${px * d}px "Martian Mono"`;
      return s;
    };
    c.textBaseline = 'top';
    mono('', 10);
    c.fillText('MIND OVER FOMO', pad, pad);
    const tk = '$MOFO';
    c.fillText(tk, W - pad - c.measureText(tk).width, pad);
    c.textBaseline = 'bottom';
    mono('', 10);
    c.fillText('LOADING', pad, H - pad - 34 * d);
    mono('', 28, 700);
    c.fillText(String(Math.round(p * 100)).padStart(3, '0'), pad, H - pad);
    mono('', 10);
    const r = 'A COPILOT FOR FOMO.FAMILY';
    c.fillText(r, W - pad - c.measureText(r).width, H - pad);
    if (flash > 0) {
      c.fillStyle = `rgba(255,255,255,${flash})`;
      c.fillRect(0, 0, W, H);
    }
  }

  hideLoader() {
    this.loaderDone = true;
    this.loader.style.display = 'none';
  }

  // ---------------------------------------------------------------- headline splitting
  _splitWords() {
    for (const h of document.querySelectorAll('.word')) {
      const w = h.dataset.word || h.textContent.trim();
      h.textContent = '';
      h.setAttribute('aria-label', w);
      // each word is an unbreakable group of letter spans; the real space between words is where a narrow screen may break
      w.split(' ').forEach((word, wi) => {
        if (wi) h.appendChild(document.createTextNode(' '));
        const g = document.createElement('span');
        g.className = 'wd';
        for (const ch of word) {
          const s = document.createElement('span');
          s.className = 'ch';
          s.textContent = ch;
          s.dataset.c = ch;
          s.setAttribute('aria-hidden', 'true');
          g.appendChild(s);
        }
        h.appendChild(g);
      });
    }
  }

  _links() {
    for (const a of document.querySelectorAll('[data-link]')) {
      const k = a.dataset.link;
      const url = CONFIG.links[k];
      if (url) {
        a.href = url;
        continue;
      }
      // no link yet: the button stays, says soon, and can't be clicked
      a.removeAttribute('href');
      a.removeAttribute('download');
      a.classList.add('btn-soon');
      a.setAttribute('aria-disabled', 'true');
      const label = a.querySelector('span');
      if (label && k === 'extension') label.textContent = 'extension soon';
    }
    const ca = document.querySelector('[data-copy]');
    if (CONFIG.ca) ca.textContent = CONFIG.ca;
    ca.addEventListener('click', async () => {
      if (!CONFIG.ca) return;
      try {
        await navigator.clipboard.writeText(CONFIG.ca);
        const t = ca.textContent;
        ca.textContent = 'copied';
        setTimeout(() => (ca.textContent = t), 1200);
      } catch (e) {}
    });
  }

  _nav() {
    for (const b of document.querySelectorAll('[data-go]')) {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.onNav) this.onNav(Number(b.dataset.go));
      });
    }
  }

  _cursor() {
    if (!matchMedia('(pointer: fine)').matches) return;
    document.documentElement.classList.add('has-cursor');
    const cx = this.cursor.querySelector('.cx');
    const cy = this.cursor.querySelector('.cy');
    const lab = this.cursor.querySelector('.clab');
    const price = document.getElementById('cprice');
    const time = document.getElementById('ctime');
    let tx = innerWidth / 2;
    let ty = innerHeight / 2;
    let x = tx;
    let y = ty;
    addEventListener('pointermove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      this.cursor.classList.add('on');
      const t = e.target;
      this.cursor.classList.toggle('hover', !!(t && t.closest && t.closest('a,button')));
    });
    document.addEventListener('pointerleave', () => this.cursor.classList.remove('on'));
    const tick = () => {
      x += (tx - x) * 0.35;
      y += (ty - y) * 0.35;
      cx.style.transform = `translate3d(0, ${y}px, 0)`;
      cy.style.transform = `translate3d(${x}px, 0, 0)`;
      const flipX = x > innerWidth - 170;
      const flipY = y > innerHeight - 40;
      lab.style.transform = `translate3d(${flipX ? x - 10 - lab.offsetWidth : x + 10}px, ${flipY ? y - 26 : y + 10}px, 0)`;
      // the crosshair reads the screen like a chart: height is price, width is the session clock
      const p = 0.00042 * Math.exp((0.5 - y / innerHeight) * 3.2);
      price.textContent = '$' + p.toPrecision(4);
      const mins = 570 + Math.round((x / innerWidth) * 390);
      time.textContent = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- the tool page: its own scroll, reveals, chart switch
  _doc() {
    const doc = document.getElementById('doc');
    if (!doc) return;
    this.doc = doc;
    const items = doc.querySelectorAll('.blk-h, .feat-copy, .shot, .spec > div, .pros-grid li, .steps li, .doc-foot > *');
    items.forEach((el) => el.classList.add('reveal'));
    doc.addEventListener('scroll', () => this.root.classList.toggle('docked', this.cur === 5 && doc.scrollTop > innerHeight * 0.6), { passive: true });
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // siblings in the same row come in one after another
          const sib = [...e.target.parentElement.children].filter((c) => c.classList.contains('reveal'));
          e.target.style.transitionDelay = Math.min(6, sib.indexOf(e.target)) * 70 + 'ms';
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { root: doc, threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
    const img = document.getElementById('chartShot');
    const tabs = [...doc.querySelectorAll('.seg button')];
    for (const t of tabs) {
      const pre = new Image();
      pre.src = 'ext/' + t.dataset.shot;
      t.addEventListener('click', () => {
        if (t.getAttribute('aria-selected') === 'true') return;
        tabs.forEach((b) => b.setAttribute('aria-selected', String(b === t)));
        img.classList.add('swap');
        setTimeout(() => {
          img.src = 'ext/' + t.dataset.shot;
          img.alt = t.dataset.shot.includes('calm') ? 'MOFO drawing the plan on a calm chart: buy zone, stop, targets, support and resistance, the gaussian channel' : img.alt;
          img.classList.remove('swap');
        }, 220);
      });
    }
  }

  // ---------------------------------------------------------------- pages
  enter(p, prev) {
    this.cur = p;
    this.root.dataset.page = String(p);
    if (p !== 5) this.root.classList.remove('docked');
    if (p === 5 && this.doc) this.doc.scrollTop = 0;
    this.railBtns.forEach((b, i) => {
      b.classList.toggle('cur', i === p);
      b.classList.toggle('past', i < p);
    });
    this.railBar.style.setProperty('--p', (p / (this.pages - 1)).toFixed(3));
    const out = prev >= 0 ? this.sections[prev] : null;
    if (out) this._leave(out);
    const sec = this.sections[p];
    const delay = (prev >= 0 ? 0.55 : 0.2) * this.pace;
    if (this.revealed) this._show(sec, delay);
    else this.pendingShow = sec;
    this._subtitle(SUBS[p] || '', delay + 0.5);
  }

  _leave(sec) {
    gsap.killTweensOf(sec.querySelectorAll('*'));
    const chars = sec.querySelectorAll('.ch');
    const rest = sec.querySelectorAll('.idx, .body, .tags li, .heatbar, .rules > div, .fine, .card, .full .fw, .final-row, .final-fine, .doc-cta, .doc-down, .blk');
    gsap.to(chars, { opacity: 0, yPercent: -40, '--w': 62, duration: 0.32, stagger: 0.025, ease: 'power3.in' });
    gsap.to(rest, {
      opacity: 0,
      y: -12,
      duration: 0.3,
      stagger: 0.02,
      ease: 'power2.in',
      onComplete: () => {
        if (this.sections[this.cur] !== sec) sec.classList.remove('on');
      },
    });
  }

  _show(sec, delay) {
    sec.classList.add('on');
    gsap.killTweensOf(sec.querySelectorAll('*'));
    const chars = [...sec.querySelectorAll('.ch')];
    const idx = sec.querySelector('.idx');
    const d = reduced ? 0 : delay;
    if (idx) gsap.fromTo(idx, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.6, delay: d, ease: 'power3.out' });
    chars.forEach((ch, i) => {
      const final = ch.dataset.c;
      const st = { k: 0 };
      gsap.fromTo(ch, { opacity: 0, yPercent: 70, '--w': 62 }, { opacity: 1, yPercent: 0, '--w': 125, duration: 1.05, delay: d + 0.05 + i * 0.07, ease: 'expo.out' });
      if (!reduced) {
        gsap.fromTo(st, { k: 0 }, {
          k: 1,
          duration: 0.5,
          delay: d + i * 0.07,
          ease: 'none',
          onUpdate: () => {
            ch.textContent = st.k < 0.92 ? NOISE[(Math.random() * NOISE.length) | 0] : final;
          },
          onComplete: () => (ch.textContent = final),
        });
      }
    });
    const body = sec.querySelectorAll('.body, .fine');
    gsap.fromTo(body, { opacity: 0, y: 18, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', duration: 1.1, delay: d + 0.35, stagger: 0.12, ease: 'expo.out' });
    gsap.set(sec.querySelectorAll('.blk'), { opacity: 1, y: 0 });
    const bits = sec.querySelectorAll('.tags li, .heatbar, .rules > div, .card, .doc-cta .btn, .doc-down');
    gsap.fromTo(bits, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, delay: d + 0.6, stagger: 0.07, ease: 'power3.out' });
    const fw = sec.querySelectorAll('.full .fw');
    if (fw.length) {
      gsap.fromTo(fw, { opacity: 0, yPercent: 60, '--w': 62 }, { opacity: 1, yPercent: 0, duration: 1.1, delay: d + 0.4, stagger: 0.12, ease: 'expo.out' });
      gsap.fromTo(sec.querySelectorAll('.final-row, .final-fine'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, delay: d + 1.3, stagger: 0.12, ease: 'power3.out' });
    }
  }

  _subtitle(text, delay) {
    clearTimeout(this.subT);
    clearInterval(this.subI);
    const el = this.sub;
    el.textContent = '';
    if (!text || reduced) {
      el.textContent = reduced ? text : '';
      return;
    }
    this.subT = setTimeout(() => {
      let i = 0;
      this.subI = setInterval(() => {
        i++;
        const noise = i < text.length ? Array.from({ length: 1 + ((Math.random() * 3) | 0) }, () => NOISE[(Math.random() * NOISE.length) | 0]).join('') : '';
        el.textContent = text.slice(0, i) + noise;
        if (i >= text.length) {
          clearInterval(this.subI);
          this.subT = setTimeout(() => (el.textContent = ''), 4200);
        }
      }, 34);
    }, delay * 1000);
  }

  heat(level) {
    const h = level < 0.18 ? 0 : level < 0.42 ? 1 : level < 0.7 ? 2 : 3;
    if (h === this.heatLevel) return;
    this.heatLevel = h;
    this.hudHeat.textContent = HEAT[h];
    this.hudHeat.className = HEAT[h].toLowerCase();
    this.heatSpans.forEach((s, i) => s.classList.toggle('lit', i === h));
  }

  update() {}

  // the white page: the whole UI swaps ink and paper
  setLight(on) {
    if (on === this.light) return;
    this.light = on;
    this.root.classList.toggle('light', on);
    this.cursor.classList.toggle('light', on);
  }

  ready() {
    this.root.classList.add('on');
    this.revealed = true;
    if (this.pendingShow) {
      this._show(this.pendingShow, 0.1);
      this.pendingShow = null;
    }
  }

  fail(e) {
    console.error(e);
    this.hideLoader();
    document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:grid;place-items:center;color:#EAEDFF;font:500 12px/1.6 monospace;padding:40px;text-align:center;z-index:99">MOFO needs WebGL to run.<br>mind over fomo.</div>');
  }
}
