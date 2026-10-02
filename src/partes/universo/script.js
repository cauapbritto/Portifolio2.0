(() => {
  const root = document.querySelector('.uni');
  const canvas = root && root.querySelector('.uni__ceu');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return;
  const nebulosa = root.querySelector('.uni__nebulosa');
  const html = document.documentElement;

  /* ---------- Campo de estrelas em 3D ----------
     Cada estrela tem (u, v) no plano, de -1 a 1, e uma profundidade z. A câmera avança em z:
     um pouco sozinha (deriva), muito com a rolagem da página e de uma vez no hiperespaço. */
  const MAX = 900;
  const DEPTH = 1800;     // profundidade do campo, em unidades de mundo
  const FOCAL = 360;      // distância focal
  const NEAR = 22;
  const SCROLL_K = 0.42;  // unidades de mundo por pixel rolado
  const DRIFT = 15;       // deriva por segundo

  const seeded = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rnd = seeded(2026);
  const stars = [];
  for (let i = 0; i < MAX; i++) {
    const q = rnd();
    stars.push({
      u: rnd() * 2 - 1,
      v: rnd() * 2 - 1,
      z: rnd() * DEPTH,
      r: 0.55 + q * q * 1.25,
      a: 0.42 + rnd() * 0.58,
      amp: 0.1 + rnd() * 0.4,
      tw: 0.5 + rnd() * 1.6,
      ph: rnd() * Math.PI * 2,
      major: rnd() < 0.04,
    });
  }
  const px = new Float32Array(MAX);  // posição na tela
  const py = new Float32Array(MAX);
  const pr = new Float32Array(MAX);  // raio na tela
  const pa = new Float32Array(MAX);  // opacidade base
  const pz = new Float32Array(MAX);  // profundidade relativa à câmera
  const vis = new Uint8Array(MAX);
  const sk = new Float32Array(MAX);  // influência da constelação (0..1)

  /* ---------- Estado ---------- */
  let w = 0, h = 0, dpr = 1, count = 0, XR = 1, YR = 1;
  let R = 160, LMAX = 140, KMAX = 12;
  let running = false, raf = 0, last = 0, drawQueued = 0, clock = 0, frameId = 0;
  let driftZ = 0, scrollZ = 0, camZ = 0, prevCamZ = 0, vz = 0;
  let boost = 0;                     // velocidade extra (hiperespaço)
  let boostFn = null;                // curva do hiperespaço atual
  let surge = 0;                     // 0..1: entrada das estrelas na abertura
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  const ptr = { x: 0, y: 0, has: false, inside: false, touch: false, hold: 0 };
  const focus = { x: 0, y: 0, s: 0, init: false };
  const edges = new Map();
  let reduced = CZ.reduzido();
  let lastP = -1;

  /* ---------- Cores ---------- */
  let starFill = 'rgb(236,234,228)', glowStroke = 'rgb(255,122,69)', isLight = false, sprite = null;
  const SPRITE = 46;
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
  // Brilho pré-renderizado uma vez; no loop vira um drawImage.
  function makeSprite(rgb) {
    const size = Math.ceil(SPRITE * dpr);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    const k = isLight ? 0.45 : 1;
    grad.addColorStop(0, `rgba(${rgb},${0.55 * k})`);
    grad.addColorStop(0.16, `rgba(${rgb},${0.2 * k})`);
    grad.addColorStop(0.45, `rgba(${rgb},${0.05 * k})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  /* ---------- Tamanho ---------- */
  function resize() {
    w = Math.max(1, html.clientWidth || innerWidth);
    h = Math.max(1, innerHeight);
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    const dprChanged = nextDpr !== dpr;
    dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    count = Math.max(320, Math.min(MAX, Math.round((w * h) / 1450)));
    XR = (w / 2) * DEPTH / FOCAL * 1.04;
    YR = (h / 2) * DEPTH / FOCAL * 1.04;
    R = Math.min(200, Math.max(110, Math.min(w, h) * 0.26));
    LMAX = R * 0.95;
    KMAX = w < 600 ? 9 : 12;
    if (dprChanged || !sprite) readColors();
    if (!focus.init) { focus.x = w * 0.66; focus.y = h * 0.36; focus.init = true; }
    requestDraw();
  }

  /* ---------- Movimento ---------- */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wander = (t) => ({ x: w * (0.5 + 0.32 * Math.sin(t * 0.11 + 1.3)), y: h * (0.42 + 0.22 * Math.sin(t * 0.17)) });

  function update(dt, now) {
    clock += dt;
    if (boostFn) {
      const r = boostFn(now);
      boost = r.v;
      if (r.done) { boostFn = null; boost = 0; }
    }
    const target = scrollY * SCROLL_K;
    if (reduced) {
      // Movimento reduzido: o céu fica parado, só a constelação acompanha o cursor.
      scrollZ = 0; driftZ = 0; boost = 0; surge = 1;
    } else {
      driftZ += (DRIFT + boost) * dt;
      scrollZ += (target - scrollZ) * (1 - Math.exp(-dt / 0.2));
    }
    prevCamZ = camZ;
    camZ = driftZ + scrollZ;
    const inst = (camZ - prevCamZ) / Math.max(dt, 0.001);
    vz += (inst - vz) * (1 - Math.exp(-dt / 0.08));
    if (reduced) vz = 0;

    // foco da constelação: cursor; sem mouse, ela passeia sozinha
    let tx = focus.x, ty = focus.y, ts = 0, tau = 0.08;
    const holding = ptr.touch || now < ptr.hold;
    if (ptr.has && (ptr.inside || holding)) {
      tx = ptr.x; ty = ptr.y; ts = 1; tau = holding ? 0.12 : 0.07;
    } else if (!CZ.mouse() && !reduced) {
      const p = wander(clock);
      tx = p.x; ty = p.y; ts = 0.85; tau = 0.8;
    }
    // em alta velocidade a constelação se desfaz
    ts *= 1 - smooth(140, 520, Math.abs(vz));
    if (reduced) { focus.x = tx; focus.y = ty; focus.s = ts; }
    else {
      const f = 1 - Math.exp(-dt / tau);
      focus.x += (tx - focus.x) * f;
      focus.y += (ty - focus.y) * f;
      focus.s += (ts - focus.s) * (1 - Math.exp(-dt / (ts > focus.s ? 0.2 : 0.3)));
    }

    // parallax com o mouse
    if (!reduced) {
      if (ptr.inside && !ptr.touch) { par.tx = (ptr.x / w - 0.5) * 2; par.ty = (ptr.y / h - 0.5) * 2; }
      else { par.tx = 0; par.ty = 0; }
      const f = 1 - Math.exp(-dt / 0.6);
      par.x += (par.tx - par.x) * f;
      par.y += (par.ty - par.y) * f;
    }

    // nebulosa acompanha o avanço da página
    if (nebulosa && !reduced) {
      const max = Math.max(1, html.scrollHeight - innerHeight);
      const p = Math.round((scrollY / max) * 1000) / 1000;
      if (p !== lastP) { lastP = p; nebulosa.style.setProperty('--uni-p', String(p)); }
    }
    CZ.emit('velocidade', vz);
  }

  /* ---------- Quadro ---------- */
  const cand = new Int16Array(MAX);
  const candD = new Float32Array(MAX);
  const inTree = new Uint8Array(MAX);
  const best = new Float32Array(MAX);
  const parent = new Int16Array(MAX);
  let lastDt = 1 / 60;

  function draw() {
    frameId++;
    const cx = w / 2, cy = h / 2;
    const t = reduced ? 0 : clock;
    const camX = par.x * XR * 0.008;
    const camY = par.y * YR * 0.008;
    // rastro só acima de uma velocidade mínima, para a leitura com rolagem lenta ficar limpa
    const vRastro = Math.sign(vz) * Math.max(0, Math.abs(vz) - 90);
    const streakZ = reduced ? 0 : Math.max(-800, Math.min(800, vRastro * 0.055));
    const streaking = Math.abs(streakZ) > 5;
    const spread = surge >= 1 ? 1 : 1 - Math.pow(1 - surge, 3);

    // 1) projeção
    for (let i = 0; i < count; i++) {
      const s = stars[i];
      let zr = (s.z - camZ) % DEPTH;
      if (zr < 0) zr += DEPTH;
      if (zr < 1) zr += DEPTH;
      const k = FOCAL / zr;
      let x = cx + (s.u * XR - camX) * k;
      let y = cy + (s.v * YR - camY) * k;
      if (spread < 1) { x = cx + (x - cx) * spread; y = cy + (y - cy) * spread; }
      pz[i] = zr;
      px[i] = x; py[i] = y;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) { vis[i] = 0; sk[i] = 0; continue; }
      vis[i] = 1;
      pr[i] = Math.min(2.9, Math.max(0.35, s.r * (FOCAL * 1.6 / zr)));
      pa[i] = s.a * smooth(DEPTH, DEPTH * 0.62, zr) * smooth(NEAR, NEAR * 5, zr);
    }

    // 2) influência e vizinhos do foco (só estrelas visíveis e de tamanho razoável)
    const fs = focus.s;
    const active = fs > 0.004;
    const R2 = R * R;
    let m = 0;
    for (let i = 0; i < count; i++) {
      sk[i] = 0;
      if (!active || !vis[i] || pa[i] < 0.2) continue;
      const dx = px[i] - focus.x, dy = py[i] - focus.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R2) continue;
      const q = 1 - Math.sqrt(d2) / R;
      sk[i] = q * q * (3 - 2 * q) * fs;
      if (pr[i] < 0.55) continue;
      let j = m < KMAX ? m++ : KMAX;
      if (j === KMAX && d2 >= candD[KMAX - 1]) continue;
      if (j === KMAX) j = KMAX - 1;
      while (j > 0 && candD[j - 1] > d2) { candD[j] = candD[j - 1]; cand[j] = cand[j - 1]; j--; }
      candD[j] = d2; cand[j] = i;
    }

    // 3) árvore geradora mínima entre os vizinhos: figuras de constelação, não malha
    if (m > 1) {
      for (let j = 0; j < m; j++) { inTree[j] = 0; best[j] = Infinity; parent[j] = -1; }
      inTree[0] = 1;
      let cur = 0;
      for (let step = 1; step < m; step++) {
        let bj = -1, bd = Infinity;
        const ax = px[cand[cur]], ay = py[cand[cur]];
        for (let j = 0; j < m; j++) {
          if (inTree[j]) continue;
          const dx = px[cand[j]] - ax, dy = py[cand[j]] - ay;
          const d2 = dx * dx + dy * dy;
          if (d2 < best[j]) { best[j] = d2; parent[j] = cur; }
          if (best[j] < bd) { bd = best[j]; bj = j; }
        }
        if (bj < 0) break;
        inTree[bj] = 1; cur = bj;
        if (bd <= LMAX * LMAX) {
          const a = cand[parent[bj]], b = cand[bj];
          const key = a < b ? a * 1024 + b : b * 1024 + a;
          let e = edges.get(key);
          if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), v: 0, seen: 0 }; edges.set(key, e); }
          e.seen = frameId;
        }
      }
    }

    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    // 4) linhas da constelação
    const edgeRate = reduced ? 1 : 1 - Math.exp(-lastDt / 0.14);
    if (edges.size) {
      c.strokeStyle = glowStroke;
      c.lineWidth = 1;
      const lineMax = isLight ? 0.62 : 0.6;
      edges.forEach((e, key) => {
        const target = e.seen === frameId ? 1 : 0;
        e.v += (target - e.v) * edgeRate;
        if ((target === 0 && e.v < 0.01) || e.a >= count || e.b >= count || !vis[e.a] || !vis[e.b]) { edges.delete(key); return; }
        const ka = sk[e.a], kb = sk[e.b];
        const k = Math.pow(ka < kb ? ka : kb, 0.7);
        const dx = px[e.a] - px[e.b], dy = py[e.a] - py[e.b];
        const len = Math.sqrt(dx * dx + dy * dy);
        const alpha = e.v * k * lineMax * (1 - 0.4 * Math.min(1, len / LMAX));
        if (alpha < 0.004) return;
        c.globalAlpha = alpha;
        c.beginPath();
        c.moveTo(px[e.a], py[e.a]);
        c.lineTo(px[e.b], py[e.b]);
        c.stroke();
      });
    }

    // 5) brilho em poucas estrelas
    if (sprite && !streaking) {
      let n = 0;
      for (let i = 0; i < count && n < 7; i++) {
        if (!vis[i]) continue;
        const s = stars[i];
        const k = sk[i];
        let g = 0;
        if (s.major) g = (0.3 + 0.7 * k) * pa[i];
        else if (k > 0.62 && pr[i] > 0.9) g = (k - 0.62) * 1.5;
        if (g <= 0.03) continue;
        if (!reduced) g *= 0.75 + 0.25 * Math.sin(t * s.tw + s.ph);
        const size = SPRITE * Math.min(1.5, Math.max(0.45, FOCAL * 2.2 / pz[i]));
        c.globalAlpha = Math.min(1, g * spread);
        c.drawImage(sprite, px[i] - size / 2, py[i] - size / 2, size, size);
        n++;
      }
    }

    // 6) estrelas (ou rastros, em velocidade)
    c.fillStyle = starFill;
    c.strokeStyle = starFill;
    c.lineCap = 'round';
    const lightK = isLight ? 0.85 : 1;
    const sFade = spread < 1 ? spread : 1;
    for (let i = 0; i < count; i++) {
      if (!vis[i]) continue;
      const s = stars[i];
      const k = sk[i];
      const tw = reduced ? 1 : 1 - s.amp * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
      let a = (pa[i] * tw * lightK + k * 0.6) * sFade;
      if (a > 1) a = 1;
      if (a < 0.01) continue;
      const r = pr[i] * (1 + 0.7 * k);
      if (streaking) {
        // o rastro vai da estrela até onde ela estava um instante antes
        const zt = pz[i] + streakZ;
        if (zt > 1) {
          const kt = FOCAL / zt;
          let tx = cx + (s.u * XR - camX) * kt;
          let ty = cy + (s.v * YR - camY) * kt;
          if (spread < 1) { tx = cx + (tx - cx) * spread; ty = cy + (ty - cy) * spread; }
          const dx = tx - px[i], dy = ty - py[i];
          if (dx * dx + dy * dy > 2.2) {
            c.globalAlpha = a * 0.9;
            c.lineWidth = Math.max(0.7, r * 1.15);
            c.beginPath();
            c.moveTo(px[i], py[i]);
            c.lineTo(tx, ty);
            c.stroke();
            continue;
          }
        }
      }
      c.globalAlpha = a;
      if (r < 0.9) c.fillRect(px[i] - r, py[i] - r, r * 2, r * 2);
      else { c.beginPath(); c.arc(px[i], py[i], r, 0, 6.2832); c.fill(); }
    }
    c.globalAlpha = 1;
  }

  /* ---------- Loop ---------- */
  function tick(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now; lastDt = dt;
    if (surge < 1 && surgeStart >= 0) surge = Math.min(1, (now - surgeStart) / SURGE_MS);
    update(dt, now);
    draw();
    raf = requestAnimationFrame(tick);
  }
  function syncLoop() {
    const can = !document.hidden && !reduced && w > 1;
    if (can && !running) {
      running = true;
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
    } else if (!can && running) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    if (!running) requestDraw();
  }
  // Quadro avulso (movimento reduzido, tema, tamanho), sem manter loop.
  function requestDraw() {
    if (running || drawQueued || w < 2) return;
    drawQueued = requestAnimationFrame((now) => {
      drawQueued = 0;
      if (running) return;
      lastDt = 1;
      update(0.0001, now);
      draw();
    });
  }

  /* ---------- Hiperespaço ---------- */
  // Curva: sobe até `pico` em `subida` ms, segura e desacelera.
  function hyperspace(pico, subida, segura, descida) {
    if (reduced) return;
    const t0 = performance.now();
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    boostFn = (now) => {
      const t = now - t0;
      if (t < subida) return { v: pico * (subida ? ease(t / subida) : 1), done: false };
      if (t < subida + segura) return { v: pico, done: false };
      const d = (t - subida - segura) / descida;
      if (d >= 1) return { v: 0, done: true };
      return { v: pico * Math.pow(1 - d, 2.4), done: false };
    };
  }
  // Abertura: as estrelas chegam do centro, como quem sai do hiperespaço.
  const SURGE_MS = 1500;
  let surgeStart = -1;
  CZ.on('abertura', () => {
    if (reduced) { surge = 1; return; }
    surge = 0;
    surgeStart = performance.now();
    hyperspace(5200, 0, 120, 1700);
  });
  CZ.on('warp', () => hyperspace(4200, 520, 900, 1600));

  // Enquanto a abertura não começa, o céu espera escondido (a abertura cobre a tela).
  if (!html.classList.contains('js') || reduced || !document.querySelector('.abertura')) surge = 1;

  /* ---------- Eventos ---------- */
  function onPointer(e) {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true;
    if (e.pointerType === 'touch') { if (e.type === 'pointerdown') ptr.touch = true; }
    else ptr.inside = true;
    if (!running) requestDraw();
  }
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('pointerdown', onPointer, { passive: true });
  const endTouch = (e) => {
    if (e.pointerType === 'touch') {
      if (ptr.touch) ptr.hold = performance.now() + 1600;
      ptr.touch = false;
    }
  };
  addEventListener('pointerup', endTouch, { passive: true });
  addEventListener('pointercancel', endTouch, { passive: true });
  document.addEventListener('pointerout', (e) => {
    if (e.relatedTarget || e.pointerType === 'touch') return;
    ptr.inside = false;
    if (!running) requestDraw();
  });
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', syncLoop);
  CZ.on('tema', () => { readColors(); requestDraw(); });
  new MutationObserver(() => { readColors(); requestDraw(); }).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  CZ.on('movimento', (r) => {
    reduced = r;
    if (reduced) { par.x = par.y = par.tx = par.ty = 0; boostFn = null; boost = 0; surge = 1; }
    syncLoop();
  });

  CZ.universo = { warp: () => CZ.emit('warp'), get velocidade() { return vz; } };

  readColors();
  resize();
  syncLoop();
})();
