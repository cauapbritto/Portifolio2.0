(() => {
  const el = document.querySelector('.cursor');
  if (!el) return;
  const html = document.documentElement;
  const ponto = el.querySelector('.cursor__ponto');
  const anel = el.querySelector('.cursor__anel');
  const texto = el.querySelector('.cursor__texto');
  const ALVOS = 'a, button, [role="button"], [data-cursor], summary, label';

  let ativo = false;
  let x = -100, y = -100, ax = -100, ay = -100;
  let raf = 0, last = 0;

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16.7;
    last = now;
    const k = 1 - Math.pow(1 - 0.2, dt / 16.7);
    ax += (x - ax) * k;
    ay += (y - ay) * k;
    ponto.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    anel.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0)`;
    if (Math.abs(x - ax) > 0.1 || Math.abs(y - ay) > 0.1) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  const acordar = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function mover(e) {
    if (e.pointerType !== 'mouse') return;
    const primeira = x < -50;
    x = e.clientX; y = e.clientY;
    if (primeira) { ax = x; ay = y; }
    el.classList.remove('is-fora');
    acordar();
  }
  function sobre(e) {
    const t = e.target instanceof Element ? e.target : null;
    const input = t && t.closest('input, textarea, [contenteditable="true"]');
    el.classList.toggle('is-input', !!input);
    const alvo = t && !input ? t.closest(ALVOS) : null;
    const rotulo = alvo && alvo.closest('[data-cursor]');
    const txt = rotulo ? rotulo.dataset.cursor : '';
    if (texto.textContent !== txt) texto.textContent = txt;
    el.classList.toggle('is-rotulo', !!txt);
    el.classList.toggle('is-alvo', !!alvo && !txt);
  }
  const fora = (e) => { if (!e.relatedTarget) el.classList.add('is-fora'); };
  const apertar = () => el.classList.add('is-apertado');
  const soltar = () => el.classList.remove('is-apertado');

  function ligar(on) {
    if (on === ativo) return;
    ativo = on;
    const m = on ? 'addEventListener' : 'removeEventListener';
    document[m]('pointermove', mover, { passive: true });
    document[m]('pointerover', sobre, { passive: true });
    document[m]('pointerout', fora, { passive: true });
    document[m]('pointerdown', apertar, { passive: true });
    document[m]('pointerup', soltar, { passive: true });
    html.classList.toggle('tem-cursor', on);
    if (on) el.classList.add('is-fora');
  }
  const avaliar = () => ligar(CZ.mouse() && !CZ.reduzido());
  CZ.ouvir(matchMedia('(hover: hover) and (pointer: fine)'), avaliar);
  CZ.on('movimento', avaliar);
  avaliar();
})();
