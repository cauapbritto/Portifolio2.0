(() => {
  const el = document.querySelector('.abertura');
  const html = document.documentElement;
  if (!el) { CZ.emit('abertura'); return; }
  if (CZ.reduzido()) { el.remove(); CZ.emit('abertura'); return; }

  const num = el.querySelector('.abertura__num');
  const barra = el.querySelector('.abertura__barra');
  const fase = el.querySelector('.abertura__fase');
  const FASES = [[0, 'ligando o céu'], [0.45, 'abrindo caminho']];

  // Quem voltou em até 7 dias vê a abertura curta.
  const SEMANA = 7 * 24 * 3600 * 1000;
  let visto = false;
  try { visto = Date.now() - Number(localStorage.getItem('cz-visto') || 0) < SEMANA; } catch (e) { /* sem armazenamento: abertura completa */ }
  const DUR = visto ? 420 : 900;

  // Espera só a fonte do nome (pré-carregada, 10 KB), no máximo 0,8 s, para as letras não trocarem no meio.
  let fontesOk = !(document.fonts && document.fonts.load);
  if (!fontesOk) {
    Promise.race([document.fonts.load('1em "Zero Hour"').catch(() => {}), new Promise((r) => setTimeout(r, 800))]).then(() => { fontesOk = true; });
  }

  html.classList.add('abrindo');
  const t0 = performance.now();
  let raf = 0, done = false, faseAtual = -1;
  const ease = (t) => 1 - Math.pow(1 - t, 2.2);

  function frame(now) {
    raf = 0;
    const t = Math.min(1, (now - t0) / DUR);
    let p = ease(t);
    if (!fontesOk) p = Math.min(p, 0.94);
    num.textContent = String(Math.round(p * 100)).padStart(3, '0');
    barra.style.transform = `scaleX(${p.toFixed(4)})`;
    let f = 0;
    FASES.forEach(([lim], i) => { if (p >= lim) f = i; });
    if (f !== faseAtual) { faseAtual = f; fase.textContent = FASES[f][1]; }
    if (t >= 1 && fontesOk) { sair(); return; }
    raf = requestAnimationFrame(frame);
  }

  function sair() {
    if (done) return;
    done = true;
    if (raf) cancelAnimationFrame(raf);
    num.textContent = '100';
    barra.style.transform = 'scaleX(1)';
    el.classList.add('is-saindo');
    try { localStorage.setItem('cz-visto', String(Date.now())); } catch (e) { /* tudo bem */ }
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) => removeEventListener(t, pular, true));
    // As estrelas chegam quando as metades começam a se abrir.
    setTimeout(() => {
      html.classList.remove('abrindo');
      CZ.emit('abertura');
    }, 260);
    setTimeout(() => el.remove(), 1500);
  }

  const pular = () => sair();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) => addEventListener(t, pular, { capture: true, passive: true }));
  raf = requestAnimationFrame(frame);
})();
