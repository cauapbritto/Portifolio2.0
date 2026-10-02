(() => {
  const root = document.querySelector('[data-fx="ceu"]');
  if (!root) return;
  const canvas = root.querySelector('.fx-ceu__sky');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return;

  const html = document.documentElement;
  const word = root.querySelector('.fx-ceu__word');
  const replayBtn = root.querySelector('.fx-ceu__replay');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqLight = matchMedia('(prefers-color-scheme: light)');
  const mqHover = matchMedia('(hover: hover) and (pointer: fine)');
  let reduced = mqReduce.matches;

  /* ---------- Estrelas: um conjunto fixo (semente), usado conforme a área ---------- */
  const MAX_STARS = 200;
  const MARGIN = 24; // folga para a deriva dar a volta e para o parallax
  const LAYERS = [
    { r0: 0.45, r1: 0.75, a0: 0.26, a1: 0.48, drift: 1.4, par: 3 },
    { r0: 0.7, r1: 1.05, a0: 0.42, a1: 0.68, drift: 2.8, par: 6 },
    { r0: 1.0, r1: 1.55, a0: 0.66, a1: 0.95, drift: 4.6, par: 10 },
  ];
  const seeded = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rnd = seeded(2026);
  const stars = [];
  for (let i = 0; i < MAX_STARS; i++) {
    const q = rnd();
    const layer = q < 0.56 ? 0 : q < 0.87 ? 1 : 2;
    const L = LAYERS[layer];
    stars.push({
      u: rnd(), v: rnd(), layer,
      r: L.r0 + rnd() * (L.r1 - L.r0),
      a: L.a0 + rnd() * (L.a1 - L.a0),
      amp: 0.12 + rnd() * 0.36,
      tw: 0.5 + rnd() * 1.4,
      ph: rnd() * Math.PI * 2,
      seed: rnd(),
      major: layer === 2 && rnd() < 0.24,
    });
  }
  const sx = new Float32Array(MAX_STARS);
  const sy = new Float32Array(MAX_STARS);
  const sk = new Float32Array(MAX_STARS); // influência do foco (0..1), já multiplicada pela força
  const sf = new Float32Array(MAX_STARS); // atenuação perto do texto (horizonte)
  const si = new Float32Array(MAX_STARS); // progresso da entrada por estrela (0..1)

  /* ---------- Estado ---------- */
  let w = 0, h = 0, dpr = 1, count = 0, R = 160, LMAX = 140, KMAX = 12;
  let visible = false, running = false, raf = 0, drawQueued = 0, last = 0;
  let clock = 0; // segundos de céu (só anda com o loop)
  let introStart = -1; // -1: ainda não começou; com movimento reduzido a entrada não existe
  const INTRO_MS = 1100;
  let introDone = false;

  let rect = null, rectDirty = true, focusInside = false;
  const ptr = { cx: 0, cy: 0, inside: false, touch: false, touchHold: 0, has: false };
  const focus = { x: 0, y: 0, s: 0, init: false }; // centro e força da constelação
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  const edges = new Map();
  let frameId = 0;

  /* ---------- Cores lidas dos tokens ---------- */
  let starFill = 'rgb(236,234,228)', glowStroke = 'rgb(255,122,69)', isLight = false, sprite = null;
  const SPRITE_CSS = 44;

  function readColors() {
    const cs = getComputedStyle(html);
    const star = (cs.getPropertyValue('--star') || '236, 234, 228').trim();
    const glow = (cs.getPropertyValue('--glow') || '255, 122, 69').trim();
    starFill = `rgb(${star})`;
    glowStroke = `rgb(${glow})`;
    const parts = star.split(',').map(Number);
    isLight = (parts[0] + parts[1] + parts[2]) / 3 < 128;
    sprite = makeSprite(glow);
  }

  // Brilho pré-renderizado uma vez (gradiente radial num canvas pequeno). No loop vira um drawImage.
  function makeSprite(rgb) {
    const size = Math.ceil(SPRITE_CSS * dpr);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    const k = isLight ? 0.5 : 1;
    grad.addColorStop(0, `rgba(${rgb},${0.5 * k})`);
    grad.addColorStop(0.16, `rgba(${rgb},${0.2 * k})`);
    grad.addColorStop(0.45, `rgba(${rgb},${0.05 * k})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  /* ---------- Tamanho ---------- */
  function resize(width, height) {
    w = Math.max(1, Math.round(width));
    h = Math.max(1, Math.round(height));
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    const dprChanged = nextDpr !== dpr;
    dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    count = Math.max(60, Math.min(MAX_STARS, Math.round((w * h) / 4200)));
    R = Math.min(190, Math.max(110, Math.min(w, h) * 0.3));
    LMAX = R * 0.92;
    KMAX = w < 600 ? 9 : 12;
    if (dprChanged || !sprite) readColors();
    if (!focus.init) { focus.x = w * 0.62; focus.y = h * 0.4; focus.init = true; }
    rectDirty = true;
    requestDraw();
  }

  /* ---------- Quadro ---------- */
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const cand = new Int16Array(MAX_STARS);
  const candD = new Float32Array(MAX_STARS);
  const inTree = new Uint8Array(MAX_STARS);
  const best = new Float32Array(MAX_STARS);
  const parent = new Int16Array(MAX_STARS);

  function wanderTarget(t) {
    return { x: w * (0.5 + 0.34 * Math.sin(t * 0.11 + 1.3)), y: h * (0.4 + 0.24 * Math.sin(t * 0.17)) };
  }

  function update(dt, now) {
    clock += dt;
    if (rectDirty && ptr.has) { rect = root.getBoundingClientRect(); rectDirty = false; }

    // alvo do foco
    let tx = focus.x, ty = focus.y, ts = 0, tau = 0.08;
    // sem mouse (toque) ou com o foco do teclado aqui dentro, a constelação passeia sozinha
    const wander = (!mqHover.matches || focusInside) && !reduced;
    if (ptr.has && rect && (ptr.inside || ptr.touch || now < ptr.touchHold)) {
      tx = ptr.cx - rect.left; ty = ptr.cy - rect.top; ts = 1;
      tau = ptr.touch || now < ptr.touchHold ? 0.12 : 0.07;
    } else if (wander) {
      const p = wanderTarget(clock);
      tx = p.x; ty = p.y; ts = 0.9; tau = 0.7;
    }
    if (reduced) { focus.x = tx; focus.y = ty; focus.s = ts; }
    else {
      const f = 1 - Math.exp(-dt / tau);
      focus.x += (tx - focus.x) * f;
      focus.y += (ty - focus.y) * f;
      focus.s += (ts - focus.s) * (1 - Math.exp(-dt / (ts > focus.s ? 0.18 : 0.32)));
    }

    // parallax só com mouse
    if (!reduced) {
      if (ptr.inside && !ptr.touch && rect) {
        par.tx = ((ptr.cx - rect.left) / w - 0.5) * 2;
        par.ty = ((ptr.cy - rect.top) / h - 0.5) * 2;
      } else { par.tx = 0; par.ty = 0; }
      const f = 1 - Math.exp(-dt / 0.45);
      par.x += (par.tx - par.x) * f;
      par.y += (par.ty - par.y) * f;
    }
  }

  function draw(now) {
    frameId++;
    const intro = reduced || introStart < 0 ? (reduced || introDone ? 1 : 0) : Math.min(1, (now - introStart) / INTRO_MS);
    if (!reduced && introStart >= 0 && intro >= 1) { introStart = -1; introDone = true; }
    const W = w + MARGIN * 2, H = h + MARGIN * 2;
    const cxm = w / 2, cym = h / 2;
    const t = reduced ? 0 : clock;
    const fs = focus.s;
    const fx = focus.x, fy = focus.y;
    const R2 = R * R;
    let m = 0;

    // 1) posições e influência
    for (let i = 0; i < count; i++) {
      const s = stars[i];
      const L = LAYERS[s.layer];
      let x = s.u * W - t * L.drift;
      let y = s.v * H - t * L.drift * 0.22;
      x = ((x % W) + W) % W - MARGIN - par.x * L.par;
      y = ((y % H) + H) % H - MARGIN - par.y * L.par;
      if (intro < 1) {
        const d = s.seed * 0.45;
        const e = ease(Math.max(0, Math.min(1, (intro - d) / (1 - d))));
        const spread = 1 + 0.16 * (1 - e);
        x = cxm + (x - cxm) * spread;
        y = cym + (y - cym) * spread;
        si[i] = e;
      } else si[i] = 1;
      sx[i] = x; sy[i] = y;
      // horizonte: as estrelas ficam mais discretas atrás do nome e da frase
      const q = (y - h * 0.5) / (h * 0.42);
      sf[i] = q <= 0 ? 1 : q >= 1 ? 0.42 : 1 - 0.58 * q * q * (3 - 2 * q);
    }

    // 2) influência e vizinhos do foco
    const active = fs > 0.004;
    for (let i = 0; i < count; i++) {
      sk[i] = 0;
      if (!active) continue;
      const dx = sx[i] - fx, dy = sy[i] - fy;
      const d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        const q = 1 - Math.sqrt(d2) / R;
        sk[i] = q * q * (3 - 2 * q) * fs;
        if (si[i] > 0.5) {
          // inserção ordenada nos KMAX mais próximos
          let j = m < KMAX ? m++ : KMAX;
          if (j === KMAX && d2 >= candD[KMAX - 1]) continue;
          if (j === KMAX) j = KMAX - 1;
          while (j > 0 && candD[j - 1] > d2) { candD[j] = candD[j - 1]; cand[j] = cand[j - 1]; j--; }
          candD[j] = d2; cand[j] = i;
        }
      }
    }

    // 3) árvore geradora mínima (Prim) entre os vizinhos: dá figuras de constelação, não malha
    if (m > 1) {
      for (let j = 0; j < m; j++) { inTree[j] = 0; best[j] = Infinity; parent[j] = -1; }
      inTree[0] = 1;
      let cur = 0;
      for (let step = 1; step < m; step++) {
        let bj = -1, bd = Infinity;
        const ax = sx[cand[cur]], ay = sy[cand[cur]];
        for (let j = 0; j < m; j++) {
          if (inTree[j]) continue;
          const dx = sx[cand[j]] - ax, dy = sy[cand[j]] - ay;
          const d2 = dx * dx + dy * dy;
          if (d2 < best[j]) { best[j] = d2; parent[j] = cur; }
          if (best[j] < bd) { bd = best[j]; bj = j; }
        }
        if (bj < 0) break;
        inTree[bj] = 1; cur = bj;
        if (bd <= LMAX * LMAX) {
          const a = cand[parent[bj]], b = cand[bj];
          const key = a < b ? a * 256 + b : b * 256 + a;
          let e = edges.get(key);
          if (!e) { e = { a: a < b ? a : b, b: a < b ? b : a, v: 0, seen: 0 }; edges.set(key, e); }
          e.seen = frameId;
        }
      }
    }

    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    // 4) linhas
    const lineMax = isLight ? 0.62 : 0.58;
    const edgeRate = reduced ? 1 : 1 - Math.exp(-lastDt / 0.14);
    if (edges.size) {
      c.strokeStyle = glowStroke;
      c.lineWidth = 1;
      edges.forEach((e, key) => {
        const target = e.seen === frameId ? 1 : 0;
        e.v += (target - e.v) * edgeRate;
        if (target === 0 && e.v < 0.01) { edges.delete(key); return; }
        if (e.a >= count || e.b >= count) { edges.delete(key); return; }
        const ka = sk[e.a], kb = sk[e.b];
        const k = Math.pow(ka < kb ? ka : kb, 0.7);
        const dx = sx[e.a] - sx[e.b], dy = sy[e.a] - sy[e.b];
        const len = Math.sqrt(dx * dx + dy * dy);
        const fade = 0.55 + 0.45 * (sf[e.a] < sf[e.b] ? sf[e.a] : sf[e.b]);
        const alpha = e.v * k * lineMax * fade * (1 - 0.4 * Math.min(1, len / LMAX)) * si[e.a] * si[e.b];
        if (alpha < 0.004) return;
        c.globalAlpha = alpha;
        c.beginPath();
        c.moveTo(sx[e.a], sy[e.a]);
        c.lineTo(sx[e.b], sy[e.b]);
        c.stroke();
      });
    }

    // 5) brilho só nas poucas estrelas mais fortes
    if (sprite) {
      const half = SPRITE_CSS / 2;
      let majors = 0, near = 0;
      for (let i = 0; i < count; i++) {
        const s = stars[i];
        const k = sk[i];
        let g = 0;
        if (s.major && majors < 4) { g = (0.24 + 0.76 * k) * sf[i]; majors++; }
        else if (k > 0.6 && s.layer > 0 && near < 3) { g = (k - 0.6) * 1.6; near++; }
        if (g <= 0.02) continue;
        if (!reduced && s.major) g *= 0.75 + 0.25 * Math.sin(t * s.tw + s.ph);
        c.globalAlpha = Math.min(1, g * si[i]);
        c.drawImage(sprite, sx[i] - half, sy[i] - half, SPRITE_CSS, SPRITE_CSS);
      }
    }

    // 6) estrelas
    c.fillStyle = starFill;
    const lightK = isLight ? 0.82 : 1;
    for (let i = 0; i < count; i++) {
      const s = stars[i];
      const k = sk[i];
      const tw = reduced ? 1 : 1 - s.amp * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
      let a = (s.a * tw * lightK * sf[i] + k * 0.6) * si[i];
      if (a > 1) a = 1;
      if (a < 0.01) continue;
      const r = s.r * (1 + 0.75 * k);
      c.globalAlpha = a;
      if (r < 0.85) c.fillRect(sx[i] - r, sy[i] - r, r * 2, r * 2);
      else { c.beginPath(); c.arc(sx[i], sy[i], r, 0, 6.2832); c.fill(); }
    }
    c.globalAlpha = 1;
  }


  /* ---------- Loop: só com o bloco visível e a aba visível ---------- */
  let lastDt = 1 / 60;
  function tick(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now; lastDt = dt;
    update(dt, now);
    draw(now);
    raf = requestAnimationFrame(tick);
  }
  function canRun() { return visible && !document.hidden && !reduced && w > 1; }
  function syncLoop() {
    if (canRun()) {
      if (!running) { running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
    } else if (running) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  // Um quadro avulso (movimento reduzido, tema, tamanho) sem manter loop.
  function requestDraw() {
    if (running || drawQueued || w < 2) return;
    drawQueued = requestAnimationFrame((now) => {
      drawQueued = 0;
      if (running) return;
      lastDt = 1;
      update(0.0001, now);
      draw(now);
    });
  }

  /* ---------- Entrada ---------- */
  const animated = [];
  function splitWord() {
    if (!word) return [];
    const text = word.textContent;
    word.textContent = '';
    return Array.from(text).map((ch) => {
      const s = document.createElement('span');
      s.className = 'fx-ceu__char';
      s.textContent = ch;
      word.appendChild(s);
      return s;
    });
  }
  const chars = splitWord();
  const label = root.querySelector('.fx-ceu__label');
  const hint = root.querySelector('.fx-ceu__hint');
  const tagline = root.querySelector('.fx-ceu__tagline');
  const OUT = 'cubic-bezier(.2,.7,.2,1)';

  function playIntro() {
    if (reduced) { root.classList.remove('fx-ceu--pre'); return; }
    animated.forEach((a) => a.cancel());
    animated.length = 0;
    const add = (el, kf, opts) => { if (el && el.animate) animated.push(el.animate(kf, { fill: 'backwards', easing: OUT, ...opts })); };
    add(label, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 60 });
    add(hint, [{ opacity: 0 }, { opacity: 1 }], { duration: 480, delay: 420 });
    chars.forEach((el, i) => add(el, [
      { opacity: 0, transform: 'translateY(105%)', clipPath: 'inset(-20% -20% 105% -20%)' },
      { opacity: 1, offset: 0.35 },
      { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(-20% -20% -20% -20%)' },
    ], { duration: 700, delay: 120 + i * 42 }));
    add(tagline, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: 440 });
    // o botão focado pelo teclado nunca some
    if (replayBtn && document.activeElement !== replayBtn) add(replayBtn, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 720 });
    root.classList.remove('fx-ceu--pre');
    introStart = performance.now();
    introDone = false;
    edges.clear();
  }

  let introQueued = false;
  function startIntroOnce() {
    if (introQueued) return;
    introQueued = true;
    if (reduced) { playIntro(); return; }
    // espera a fonte do nome (no máximo 450ms) para as letras não trocarem no meio da animação
    const font = document.fonts && document.fonts.load ? document.fonts.load('1em "Zero Hour"').catch(() => {}) : Promise.resolve();
    Promise.race([font, new Promise((r) => setTimeout(r, 450))]).then(playIntro);
  }

  /* ---------- Eventos ---------- */
  function onPointer(e) {
    ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.has = true;
    if (e.pointerType === 'touch') {
      if (e.type === 'pointerdown') ptr.touch = true;
    } else ptr.inside = true;
    if (!rect || rectDirty) { rect = root.getBoundingClientRect(); rectDirty = false; }
    if (!running) requestDraw();
  }
  root.addEventListener('pointerenter', (e) => { rect = root.getBoundingClientRect(); rectDirty = false; onPointer(e); });
  root.addEventListener('pointermove', onPointer, { passive: true });
  root.addEventListener('pointerdown', onPointer, { passive: true });
  const endTouch = (e) => {
    if (e.pointerType === 'touch') {
      if (ptr.touch) ptr.touchHold = performance.now() + (reduced ? 1e9 : 1800);
      ptr.touch = false;
    } else if (e.type === 'pointerleave') {
      ptr.inside = false;
      if (!running) requestDraw();
    }
  };
  root.addEventListener('pointerup', endTouch);
  root.addEventListener('pointercancel', endTouch);
  root.addEventListener('pointerleave', endTouch);
  addEventListener('scroll', () => { rectDirty = true; }, { passive: true, capture: true });
  addEventListener('resize', () => { rectDirty = true; }, { passive: true });

  if (replayBtn) replayBtn.addEventListener('click', () => { playIntro(); syncLoop(); });
  // Só o foco do teclado faz a constelação passear; o foco deixado por um clique no botão, não.
  const keyboardFocus = (el) => { try { return el.matches(':focus-visible'); } catch (err) { return true; } };
  root.addEventListener('focusin', (e) => {
    focusInside = keyboardFocus(e.target);
    animated.forEach((a) => { if (a.effect && a.effect.target === replayBtn) a.finish(); });
  });
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) focusInside = false; });

  document.addEventListener('visibilitychange', syncLoop);

  const io = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1];
    visible = e.isIntersecting;
    if (visible && e.intersectionRatio >= 0.3) startIntroOnce();
    syncLoop();
    if (visible && !running) requestDraw();
  }, { threshold: [0, 0.3] });

  const ro = new ResizeObserver((entries) => {
    const box = entries[0].contentRect;
    resize(box.width, box.height);
    syncLoop();
  });

  const onTheme = () => { readColors(); requestDraw(); };
  new MutationObserver(onTheme).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  const listen = (mq, fn) => (mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn));
  listen(mqLight, onTheme);
  listen(mqReduce, () => {
    reduced = mqReduce.matches;
    if (reduced) {
      par.x = par.y = par.tx = par.ty = 0; // sem parallax congelado no meio
      animated.forEach((a) => a.finish());
      root.classList.remove('fx-ceu--pre');
      introStart = -1; introDone = true;
    }
    syncLoop();
    requestDraw();
  });

  root.classList.add('fx-ceu--js');
  if (!reduced) root.classList.add('fx-ceu--pre');
  else introDone = true;
  readColors();
  ro.observe(root);
  io.observe(root);
})();
