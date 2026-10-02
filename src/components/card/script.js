(() => {
  const root = document.querySelector('[data-fx="card"]');
  if (!root) return;

  // Efeito so com mouse/caneta de verdade e sem pedido de movimento reduzido.
  // Fora disso o CSS faz um destaque parado (hover/foco) e o JS nao roda nada.
  const fineQ = matchMedia('(hover: hover) and (pointer: fine)');
  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => fineQ.matches && !reduceQ.matches;

  const TILT_DEG = 4;   // por eixo
  const TILT = 0.11;    // fracao do caminho por quadro (60 Hz): inclinacao
  const SPOT = 0.3;     // a luz segue mais colada no cursor
  const FADE = 0.16;    // acender/apagar
  const clamp = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);

  const cards = Array.from(root.querySelectorAll('.fx-card__item'), (host) => ({
    host,
    el: host.querySelector('.fx-card__card'),
    bg: host.querySelector('.fx-card__bg'),
    img: host.querySelector('.fx-card__img'),
    left: 0, top: 0, w: 1, h: 1, stale: true,
    over: false, focus: false, live: false,
    nx: 0, ny: 0, tnx: 0, tny: 0,   // inclinacao normalizada (-1..1)
    x: 0, y: 0, tx: 0, ty: 0,       // luz, em px dentro do card
    a: 0, ta: 0,                    // intensidade da luz
    out: '',
  }));

  const moving = new Set();
  let raf = 0;
  let last = 0;
  let onScreen = true;

  // Unica leitura de layout: no pointerenter e depois de scroll/resize.
  const measure = (c) => {
    const r = c.host.getBoundingClientRect();
    c.left = r.left; c.top = r.top; c.w = r.width || 1; c.h = r.height || 1;
    c.stale = false;
  };

  const aim = (c, cx, cy) => {
    if (c.stale) measure(c);
    const px = cx - c.left;
    const py = cy - c.top;
    c.tnx = clamp((px / c.w) * 2 - 1);
    c.tny = clamp((py / c.h) * 2 - 1);
    c.tx = px;
    c.ty = py;
  };

  const schedule = () => {
    if (!raf && moving.size && onScreen && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  };

  const wake = (c) => {
    moving.add(c);
    schedule();
  };

  const setLive = (c, on) => {
    if (c.live === on) return;
    c.live = on;
    c.el.classList.toggle('is-live', on);
  };

  // Escrita so dentro do rAF e so nos elementos que mudam:
  // transform direto no card (nao herdado, nao recalcula os filhos), variaveis nas folhas.
  const write = (c) => {
    const v = `${c.nx.toFixed(4)}|${c.ny.toFixed(4)}|${c.x.toFixed(1)}|${c.y.toFixed(1)}|${c.a.toFixed(3)}`;
    if (v === c.out) return;
    c.out = v;
    const tilting = c.nx !== 0 || c.ny !== 0;
    c.el.style.transform = tilting
      ? `perspective(1100px) rotateX(${(c.ny * TILT_DEG).toFixed(3)}deg) rotateY(${(-c.nx * TILT_DEG).toFixed(3)}deg)`
      : '';
    c.img.style.setProperty('--nx', c.nx.toFixed(4));
    c.img.style.setProperty('--ny', c.ny.toFixed(4));
    const b = c.bg.style;
    b.setProperty('--x', `${c.x.toFixed(1)}px`);
    b.setProperty('--y', `${c.y.toFixed(1)}px`);
    b.setProperty('--a', c.a.toFixed(3));
  };

  function tick(t) {
    raf = 0;
    const dt = last ? Math.min(t - last, 64) : 16.7;
    last = t;
    const k = (f) => 1 - Math.pow(1 - f, dt / 16.7);
    const kt = k(TILT);
    const ks = k(SPOT);
    const kf = k(FADE);
    for (const c of moving) {
      c.nx += (c.tnx - c.nx) * kt;
      c.ny += (c.tny - c.ny) * kt;
      c.x += (c.tx - c.x) * ks;
      c.y += (c.ty - c.y) * ks;
      c.a += (c.ta - c.a) * kf;
      const settled =
        Math.abs(c.tnx - c.nx) < 0.002 && Math.abs(c.tny - c.ny) < 0.002 &&
        Math.abs(c.tx - c.x) < 0.3 && Math.abs(c.ty - c.y) < 0.3 &&
        Math.abs(c.ta - c.a) < 0.004;
      if (settled) {
        c.nx = c.tnx; c.ny = c.tny; c.x = c.tx; c.y = c.ty; c.a = c.ta;
      }
      write(c);
      if (settled) {
        moving.delete(c);
        // Em repouso, sem transformacao e sem camadas proprias.
        if (!c.over) setLive(c, false);
      }
    }
    if (moving.size) raf = requestAnimationFrame(tick);
  }

  const clearInline = (c) => {
    c.out = '';
    c.el.style.transform = '';
    ['--nx', '--ny'].forEach((p) => c.img.style.removeProperty(p));
    ['--x', '--y', '--a'].forEach((p) => c.bg.style.removeProperty(p));
  };

  // O rect guardado so fica velho se a pagina rolar ou mudar de tamanho com o cursor em cima;
  // por isso scroll/resize so sao ouvidos enquanto algum card esta sob o cursor.
  const markStale = () => { for (const c of cards) c.stale = true; };
  let watching = false;
  const watch = () => {
    const need = cards.some((c) => c.over);
    if (need === watching) return;
    watching = need;
    if (need) {
      addEventListener('scroll', markStale, { passive: true });
      addEventListener('resize', markStale, { passive: true });
    } else {
      removeEventListener('scroll', markStale);
      removeEventListener('resize', markStale);
    }
  };

  // Volta tudo ao repouso sem animar (saiu da tela ou mudou a preferencia).
  const restAll = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    moving.clear();
    for (const c of cards) {
      c.over = false; c.focus = false;
      c.nx = c.tnx = c.ny = c.tny = 0;
      c.a = c.ta = 0;
      setLive(c, false);
      c.el.classList.remove('is-hot');
      clearInline(c);
    }
    watch();
  };

  cards.forEach((c) => {
    const { host, el } = c;

    const enter = (e) => {
      if (e.pointerType === 'touch' || !enabled()) return;
      measure(c);
      c.over = true;
      watch();
      aim(c, e.clientX, e.clientY);
      // Luz apagada: nasce embaixo do cursor em vez de deslizar de longe.
      if (c.a < 0.05) { c.x = c.tx; c.y = c.ty; }
      c.ta = 1;
      setLive(c, true);
      el.classList.add('is-hot');
      wake(c);
    };

    host.addEventListener('pointerenter', enter);

    host.addEventListener('pointermove', (e) => {
      // Cursor que ja estava em cima quando o efeito voltou (preferencia de movimento mudou,
      // card saiu e voltou para a tela): entra agora, sem precisar sair e voltar.
      if (!c.over) { enter(e); return; }
      aim(c, e.clientX, e.clientY);
      wake(c);
    });

    host.addEventListener('pointerleave', () => {
      if (!c.over) return;
      c.over = false;
      watch();
      c.tnx = 0; c.tny = 0;
      el.classList.remove('is-hot');
      // Com foco de teclado dentro, a luz desliza para o centro; senao apaga onde esta.
      if (c.focus) { c.tx = c.w / 2; c.ty = c.h / 2; }
      else c.ta = 0;
      wake(c);
    });

    host.addEventListener('focusin', (e) => {
      if (!enabled()) return;
      let kb = true;
      try { kb = e.target.matches(':focus-visible'); } catch (_) { /* navegador antigo: trata como teclado */ }
      if (!kb) return;
      c.focus = true;
      if (c.over) return;
      if (c.stale) measure(c);
      c.x = c.tx = c.w / 2;
      c.y = c.ty = c.h / 2;
      c.ta = 1;
      wake(c);
    });

    host.addEventListener('focusout', (e) => {
      if (host.contains(e.relatedTarget)) return;
      c.focus = false;
      if (!c.over && c.ta) { c.ta = 0; wake(c); }
    });

    // Clique com mouse num link: o foco fica no link, mas nao e foco de teclado.
    el.addEventListener('pointerdown', () => { c.focus = false; });
  });


  const onPrefChange = () => { if (!enabled()) restAll(); };
  reduceQ.addEventListener('change', onPrefChange);
  fineQ.addEventListener('change', onPrefChange);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else schedule();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      const was = onScreen;
      onScreen = entries[entries.length - 1].isIntersecting;
      if (!onScreen && was) restAll();
      else if (onScreen) schedule();
    }).observe(root);
  }
})();
