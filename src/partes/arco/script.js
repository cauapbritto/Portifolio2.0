(() => {
  const root = document.querySelector('.arco');
  if (!root) return;
  const toggle = root.querySelector('.arco__toggle');
  const svg = root.querySelector('.arco__svg');
  const slices = Array.from(root.querySelectorAll('.arco__slice'));
  const status = root.querySelector('.arco__status');
  const statusText = root.querySelector('.arco__status-text');
  if (!toggle || !svg || !slices.length || !status || !statusText) return;

  const NAMES = { sobre: 'Sobre', contato: 'Contato', projetos: 'Projetos' };

  let open = false;
  let current = 0; // fatia com tabindex 0 (roving tabindex)
  let hover = -1;

  /* ---------- tema ---------- */

  const syncMode = () => {
    const m = CZ.tema();
    if (root.dataset.mode !== m) root.dataset.mode = m;
  };

  /* ---------- retorno em texto (aria-live) ---------- */

  let sayTimer = 0;
  let sayHide = 0;
  function say(text) {
    clearTimeout(sayTimer);
    clearTimeout(sayHide);
    // Esvazia antes para que a mesma frase seja anunciada de novo.
    statusText.textContent = '';
    sayTimer = setTimeout(() => {
      statusText.textContent = text;
      status.classList.add('is-on');
      sayHide = setTimeout(() => status.classList.remove('is-on'), 2600);
    }, 40);
  }

  /* ---------- ponteiro ---------- */

  function activeIndex() {
    if (!open) return -1;
    if (hover >= 0) return hover;
    const f = document.activeElement;
    const i = slices.indexOf(f);
    if (i >= 0 && f.matches(':focus-visible')) return i;
    return -1;
  }
  function updatePointer() {
    const i = activeIndex();
    if (i < 0) {
      delete root.dataset.active;
      return;
    }
    root.dataset.active = String(i);
    root.style.setProperty('--arco-a', `${18 + 36 * i}deg`);
  }

  /* ---------- abrir e fechar ---------- */

  function setTabStops() {
    slices.forEach((s, i) => s.setAttribute('tabindex', open && i === current ? '0' : '-1'));
  }
  function onOutside(e) {
    if (!open) return;
    const t = e.target;
    if (t instanceof Element && t.closest('.arco__slice, .arco__toggle') && root.contains(t)) return;
    closeMenu(false);
  }
  function openMenu() {
    if (open) return;
    open = true;
    current = 0;
    root.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    svg.removeAttribute('aria-hidden');
    setTabStops();
    document.addEventListener('pointerdown', onOutside, true);
    slices[0].focus({ preventScroll: true });
    updatePointer();
  }
  function closeMenu(returnFocus) {
    if (!open) return;
    open = false;
    hover = -1;
    clearTimeout(leaveTimer);
    root.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    // O foco sai das fatias antes de elas virarem aria-hidden (e não se perde quando a fatia some).
    if (returnFocus || svg.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    svg.setAttribute('aria-hidden', 'true');
    setTabStops();
    updatePointer();
    document.removeEventListener('pointerdown', onOutside, true);
  }

  toggle.addEventListener('click', () => {
    if (open) closeMenu(false);
    else openMenu();
  });

  /* ---------- ações ---------- */

  function activate(i) {
    const s = slices[i];
    if (!s) return;
    current = i;
    setTabStops();
    const act = s.dataset.act;
    if (NAMES[act]) {
      // O foco vai para o título do capítulo; o menu fecha sem devolver o foco ao botão.
      closeMenu(false);
      CZ.ir(act);
      say(`Indo para ${NAMES[act]}`);
    } else if (act === 'som') {
      CZ.emit('som:alternar');
    } else if (act === 'tema') {
      const r = s.getBoundingClientRect();
      CZ.alternarTema(r.left + r.width / 2, r.top + r.height / 2);
    }
  }

  const somSlice = slices.find((s) => s.dataset.act === 'som');
  let somAnunciado = false;
  CZ.on('som:estado', (on) => {
    if (somSlice) somSlice.setAttribute('aria-pressed', String(on));
    if (somAnunciado) say(on ? 'Som ligado' : 'Som desligado');
    somAnunciado = true;
  });
  CZ.on('tema', (t) => {
    syncMode();
    if (open) say(t === 'light' ? 'Tema claro' : 'Tema escuro');
  });

  svg.addEventListener('click', (e) => {
    const s = e.target instanceof Element ? e.target.closest('.arco__slice') : null;
    if (!s || !open) return;
    activate(slices.indexOf(s));
  });

  function move(to) {
    const n = slices.length;
    current = (to + n) % n;
    setTabStops();
    slices[current].focus({ preventScroll: true });
    hover = -1;
    updatePointer();
  }

  let spaceDown = -1;
  svg.addEventListener('keydown', (e) => {
    const i = slices.indexOf(e.target);
    if (i < 0 || !open) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        move(i + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        move(i - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(slices.length - 1);
        break;
      case 'Enter':
        if (e.repeat) break;
        activate(i);
        break;
      case ' ':
        spaceDown = i; // ativa no keyup, como um botão nativo
        break;
      default:
        return;
    }
    e.preventDefault();
  });
  svg.addEventListener('keyup', (e) => {
    if (e.key !== ' ') return;
    const i = slices.indexOf(e.target);
    if (i >= 0 && i === spaceDown) activate(i);
    spaceDown = -1;
    e.preventDefault();
  });

  // Esc fecha de qualquer ponto do componente e devolve o foco ao botão.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      closeMenu(true);
    }
  });

  // Se o foco sair do componente (Tab adiante), o menu fecha.
  let blurTimer = 0;
  root.addEventListener('focusout', (e) => {
    if (!open) return;
    const to = e.relatedTarget;
    if (to && root.contains(to)) return;
    updatePointer();
    // Espera o foco assentar: se a janela inteira perdeu o foco, o menu continua aberto.
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      if (!open || !document.hasFocus()) return;
      if (root.contains(document.activeElement)) return;
      closeMenu(false);
    }, 0);
  });
  root.addEventListener('focusin', (e) => {
    const i = slices.indexOf(e.target);
    if (i >= 0) {
      current = i;
      setTabStops();
    }
    updatePointer();
  });

  // Ao cruzar a fresta entre duas fatias o ponteiro não pisca: a saída espera um instante.
  let leaveTimer = 0;
  svg.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !open) return;
    const s = e.target instanceof Element ? e.target.closest('.arco__slice') : null;
    const i = s ? slices.indexOf(s) : -1;
    if (i < 0) return;
    clearTimeout(leaveTimer);
    if (i !== hover) {
      hover = i;
      updatePointer();
    }
  });
  svg.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const to = e.relatedTarget;
    if (to instanceof Element && to.closest('.arco__slice') && svg.contains(to)) return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (hover === -1) return;
      hover = -1;
      updatePointer();
    }, 140);
  });

  /* ---------- início ---------- */

  new MutationObserver(syncMode).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Primeiro estado sem animar (o meio-arco já nasce fechado).
  root.classList.add('arco--init');
  syncMode();
  svg.setAttribute('aria-hidden', 'true');
  setTabStops();
  root.classList.add('arco--js');
  void root.offsetWidth;
  root.classList.remove('arco--init');
})();
