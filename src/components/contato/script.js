(() => {
  const root = document.querySelector('[data-fx="contato"]');
  if (!root) return;

  const EMAIL = 'caua.pbritto@gmail.com';
  const btn = root.querySelector('.fx-contato__btn');
  const magnet = root.querySelector('.fx-contato__magnet');
  const face = root.querySelector('.fx-contato__face');
  const emailEl = root.querySelector('.fx-contato__email');
  const hint = root.querySelector('.fx-contato__hint');
  const status = root.querySelector('.fx-contato__status');
  if (!btn || !magnet || !face || !emailEl) return;

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqTouch = matchMedia('(hover: none) and (pointer: coarse)');
  const apple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');

  /* ---------------- Cópia ---------------- */

  let copiedTimer = 0;
  let hintTimer = 0;
  let announceTimer = 0;

  function announce(msg) {
    if (!status) return;
    // Esvazia e preenche de novo para leitores de tela repetirem a mesma frase.
    status.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { status.textContent = msg; }, 60);
  }

  function clipboardAllowed() {
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (!policy || typeof policy.allowsFeature !== 'function') return true;
    try { return policy.allowsFeature('clipboard-write'); } catch (e) { return true; }
  }

  async function writeClipboard(text) {
    // 1) API moderna. Num iframe com sandbox ela pode estar bloqueada e rejeitar.
    //    Se a política do documento já diz que não pode, nem tenta (evita erro no console).
    //    Se a promessa nunca resolver (alguns webviews), desiste depois de 1,5 s para o botão não travar.
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && clipboardAllowed()) {
        let giveUp = 0;
        try {
          await Promise.race([
            navigator.clipboard.writeText(text),
            new Promise((resolve, reject) => { giveUp = setTimeout(reject, 1500); }),
          ]);
        } finally {
          clearTimeout(giveUp);
        }
        return true;
      }
    } catch (e) { /* segue para o plano B */ }

    // 2) Plano B: textarea escondida + execCommand('copy').
    const prev = document.activeElement;
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.setAttribute('aria-hidden', 'true');
      ta.tabIndex = -1;
      ta.className = 'fx-contato__ta';
      root.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
    } catch (e) { ok = false; }
    if (prev && typeof prev.focus === 'function' && document.activeElement !== prev) {
      prev.focus({ preventScroll: true });
    }
    return ok;
  }

  function selectEmail() {
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(emailEl);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* sem seleção possível: a dica ainda aparece */ }
  }

  function showCopied() {
    root.classList.remove('is-hint');
    if (!root.classList.contains('is-copied')) {
      root.classList.remove('is-back');
      root.classList.add('is-copied');
    }
    announce('E-mail copiado.');
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      root.classList.remove('is-copied');
      root.classList.add('is-back');
    }, 2000);
  }

  function showSelected() {
    if (root.classList.contains('is-copied')) {
      clearTimeout(copiedTimer);
      root.classList.remove('is-copied');
      root.classList.add('is-back');
    }
    // Em tela de toque não há atalho de teclado para sugerir.
    const msg = mqTouch.matches
      ? 'Selecionei o e-mail, é só copiar'
      : `Selecionei o e-mail, use ${apple ? 'Cmd+C' : 'Ctrl+C'}`;
    if (hint) hint.textContent = msg;
    root.classList.add('is-hint');
    selectEmail();
    announce(msg + '.');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => root.classList.remove('is-hint'), 5000);
  }

  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const ok = await writeClipboard(EMAIL);
    busy = false;
    if (ok) showCopied();
    else showSelected();
  });

  /* ---------------- Ímã ---------------- */

  const RADIUS = 80;   // alcance, em px, a partir da borda do botão
  const MAX = 8;       // deslocamento máximo do botão
  const DEPTH = 0.5;   // o rótulo anda 50% a mais que o botão

  let enabled = false;
  let inView = false;
  let pageVisible = !document.hidden;
  let listening = false;

  let rect = null;     // centro e meia-largura/altura do invólucro (que não se mexe)
  let dirty = true;
  let px = 0, py = 0, hasPointer = false;
  let x = 0, y = 0, tx = 0, ty = 0;
  let raf = 0, last = 0;

  function measure() {
    const r = magnet.getBoundingClientRect();
    rect = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 };
    dirty = false;
  }

  // Distância do cursor até a borda do botão (0 dentro dele).
  function edgeDistance() {
    const ex = Math.max(0, Math.abs(px - rect.cx) - rect.hw);
    const ey = Math.max(0, Math.abs(py - rect.cy) - rect.hh);
    return Math.hypot(ex, ey);
  }

  function computeTarget() {
    tx = 0; ty = 0;
    if (!hasPointer) return false;
    if (dirty || !rect) measure();
    const d = edgeDistance();
    if (d >= RADIUS) return false;
    const dx = px - rect.cx;
    const dy = py - rect.cy;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return true;
    const u = d / RADIUS;
    const f = 1 - u * u; // forte perto do botão, some suave na borda do alcance
    const pull = MAX * Math.tanh(len / 40) * f;
    tx = (dx / len) * pull;
    ty = (dy / len) * pull;
    return true;
  }

  function write() {
    if (x === 0 && y === 0) {
      btn.style.translate = '';
      face.style.translate = '';
      return;
    }
    btn.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    face.style.translate = `${(x * DEPTH).toFixed(2)}px ${(y * DEPTH).toFixed(2)}px`;
  }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16.667;
    last = now;
    const near = computeTarget();
    // Segue rápido quando o cursor está perto; volta mais devagar quando ele sai.
    const base = near ? 0.2 : 0.11;
    const k = 1 - Math.pow(1 - base, dt / 16.667);
    x += (tx - x) * k;
    y += (ty - y) * k;
    const settled = Math.abs(tx - x) < 0.03 && Math.abs(ty - y) < 0.03;
    if (settled) { x = tx; y = ty; }
    write();
    if (!settled) raf = requestAnimationFrame(frame);
    else last = 0; // dorme até o próximo movimento
  }

  function wake() {
    if (!raf && enabled && inView && pageVisible) raf = requestAnimationFrame(frame);
  }

  function reset() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; last = 0;
    x = y = tx = ty = 0;
    hasPointer = false;
    write();
  }

  function onMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    px = e.clientX;
    py = e.clientY;
    hasPointer = true;
    // Com a posição em cache, longe do botão e já parado: nem acorda o rAF.
    if (!dirty && rect && x === 0 && y === 0 && edgeDistance() >= RADIUS) return;
    wake();
  }
  function onOut(e) {
    if (e.relatedTarget) return; // só quando o cursor sai da janela
    hasPointer = false;
    wake();
  }
  function onScroll() {
    dirty = true;
    if (hasPointer) wake();
  }

  function listen(on) {
    if (on === listening) return;
    listening = on;
    const m = on ? 'addEventListener' : 'removeEventListener';
    document[m]('pointermove', onMove, { passive: true });
    document[m]('pointerout', onOut, { passive: true });
    window[m]('scroll', onScroll, { passive: true });
  }

  function update() {
    enabled = mqFine.matches && !mqReduce.matches;
    const active = enabled && inView && pageVisible;
    listen(active);
    if (!active) reset();
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      dirty = true;
      update();
    }, { rootMargin: '80px 0px' }).observe(root);
  } else {
    inView = true;
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { dirty = true; }).observe(root);
  }
  window.addEventListener('resize', () => { dirty = true; }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    update();
  });

  const onMq = () => update();
  [mqReduce, mqFine].forEach((mq) => {
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  });

  update();
})();
