(() => {
  const setor = document.querySelector('.hud-base__setor');
  const tempo = document.querySelector('.hud-base__tempo');
  const hora = document.querySelector('.hud-base__hora');
  const pct = document.querySelector('.hud-base__pct');
  const itens = Array.from(document.querySelectorAll('.trilho__item'));
  const cheio = document.querySelector('.trilho__cheio');
  const btnTerminal = document.querySelector('[data-terminal]');

  /* ---------- relógio e tempo de viagem ---------- */
  const t0 = Date.now();
  const dois = (n) => String(n).padStart(2, '0');
  function relogio() {
    const d = new Date();
    if (hora) hora.textContent = `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
    if (tempo) {
      const s = Math.floor((Date.now() - t0) / 1000);
      tempo.textContent = `T+${dois(Math.floor(s / 60))}:${dois(s % 60)}`;
    }
  }
  let timer = 0;
  const ligar = () => { clearInterval(timer); if (!document.hidden) { relogio(); timer = setInterval(relogio, 1000); } };
  document.addEventListener('visibilitychange', ligar);
  ligar();

  /* ---------- setor atual (com um embaralhado curto na troca) ---------- */
  const GLIFOS = '!<>-_\\/[]{}=+*^?#01';
  let embaralhando = 0;
  function escrever(texto) {
    if (!setor) return;
    cancelAnimationFrame(embaralhando);
    if (CZ.reduzido()) { setor.textContent = texto; return; }
    const ini = performance.now();
    const DUR = 420;
    const passo = (agora) => {
      const t = Math.min(1, (agora - ini) / DUR);
      const fixos = Math.floor(texto.length * t);
      let s = texto.slice(0, fixos);
      for (let i = fixos; i < texto.length; i++) s += texto[i] === ' ' ? ' ' : GLIFOS[(Math.random() * GLIFOS.length) | 0];
      setor.textContent = s;
      if (t < 1) embaralhando = requestAnimationFrame(passo);
    };
    embaralhando = requestAnimationFrame(passo);
  }

  CZ.on('capitulo', (c) => {
    escrever(`${c.n} · ${c.nome}`);
    itens.forEach((a) => {
      if (a.dataset.ir === c.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  });

  let ultimo = -1;
  CZ.on('rolagem', ({ p }) => {
    const v = Math.round(p * 100);
    if (v === ultimo) return;
    ultimo = v;
    if (pct) pct.textContent = `${String(v).padStart(3, '0')}%`;
    if (cheio) cheio.style.setProperty('--p', p.toFixed(3));
  });

  /* ---------- terminal e atalhos ---------- */
  if (btnTerminal) btnTerminal.addEventListener('click', () => CZ.emit('terminal:abrir', btnTerminal));

  const digitando = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || digitando(e.target)) return;
    if (document.documentElement.classList.contains('term-aberto')) return;
    if (e.key === '/' || e.key === '`') {
      e.preventDefault();
      CZ.emit('terminal:abrir', btnTerminal);
      return;
    }
    const n = Number(e.key);
    if (e.key.length === 1 && n >= 0 && n < CZ.capitulos.length) CZ.ir(CZ.capitulos[n].id);
  });
})();
