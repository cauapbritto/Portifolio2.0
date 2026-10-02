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

  /* ---------- troca de fonte ---------- */
  const fonteBox = document.querySelector('.fonte');
  const fonteBtn = fonteBox && fonteBox.querySelector('.fonte__btn');
  const painel = fonteBox && fonteBox.querySelector('.fonte__painel');
  const opcoes = painel ? Array.from(painel.querySelectorAll('[data-fonte]')) : [];
  const syncFonte = () => {
    const f = CZ.fonte();
    opcoes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fonte === f)));
  };
  function painelAberto(on, focar) {
    if (!painel) return;
    painel.hidden = !on;
    fonteBtn.setAttribute('aria-expanded', String(on));
    if (on) {
      document.addEventListener('pointerdown', fora, true);
      if (focar) (opcoes.find((b) => b.getAttribute('aria-pressed') === 'true') || opcoes[0]).focus({ preventScroll: true });
    } else {
      document.removeEventListener('pointerdown', fora, true);
    }
  }
  const fora = (e) => { if (!(e.target instanceof Element && fonteBox.contains(e.target))) painelAberto(false); };
  if (fonteBox) {
    fonteBtn.addEventListener('click', (e) => painelAberto(painel.hidden, e.detail === 0));
    opcoes.forEach((b) => b.addEventListener('click', () => CZ.definirFonte(b.dataset.fonte)));
    fonteBox.addEventListener('keydown', (e) => {
      if (painel.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        painelAberto(false);
        fonteBtn.focus({ preventScroll: true });
        return;
      }
      const i = opcoes.indexOf(document.activeElement);
      if (i < 0 || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      opcoes[(i + (e.key === 'ArrowDown' ? 1 : opcoes.length - 1)) % opcoes.length].focus();
    });
    // Foco saiu do seletor (Tab adiante): fecha.
    fonteBox.addEventListener('focusout', (e) => {
      if (!painel.hidden && e.relatedTarget && !fonteBox.contains(e.relatedTarget)) painelAberto(false);
    });
    CZ.on('fonte', syncFonte);
    syncFonte();
  }

  /* ---------- terminal e atalhos ---------- */
  if (btnTerminal) btnTerminal.addEventListener('click', () => CZ.emit('terminal:abrir', btnTerminal));

  const digitando = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  // Atalhos: "/" abre o terminal (dá para desligar com "atalhos off" no terminal, por quem usa voz);
  // Alt+0 a Alt+3 levam aos capítulos (com modificador, nunca disparam sem querer).
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || digitando(e.target)) return;
    if (document.documentElement.classList.contains('term-aberto')) return;
    if (e.altKey) {
      const m = /^Digit([0-9])$/.exec(e.code || '');
      const n = m ? Number(m[1]) : -1;
      if (n >= 0 && n < CZ.capitulos.length) { e.preventDefault(); CZ.ir(CZ.capitulos[n].id); }
      return;
    }
    if ((e.key === '/' || e.key === '`') && CZ.store.get('cz-atalhos') !== 'off') {
      e.preventDefault();
      CZ.emit('terminal:abrir', btnTerminal);
    }
  });
})();
