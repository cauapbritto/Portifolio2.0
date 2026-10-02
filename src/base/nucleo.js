/* Núcleo: o que as partes da página compartilham (eventos, tema, navegação entre capítulos, rolagem). */
window.CZ = (() => {
  const html = document.documentElement;
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqLight = matchMedia('(prefers-color-scheme: light)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const ouvir = (mq, fn) => (mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn));

  /* ---------- eventos ---------- */

  const handlers = new Map();
  function on(nome, fn) {
    if (!handlers.has(nome)) handlers.set(nome, new Set());
    handlers.get(nome).add(fn);
    return () => handlers.get(nome).delete(fn);
  }
  function emit(nome, dado) {
    const set = handlers.get(nome);
    if (!set) return;
    set.forEach((fn) => {
      try { fn(dado); } catch (e) { console.error(e); }
    });
  }

  /* ---------- preferências ---------- */

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: só não lembra */ } },
  };
  // Movimento: o sistema pode pedir menos movimento, e o visitante pode escolher "calmo" em Ajustes.
  let calmo = store.get('cz-movimento') === 'calmo';
  const reduzido = () => mqReduce.matches || calmo;
  const movimento = () => (reduzido() ? 'calmo' : 'normal');
  const mouse = () => mqFine.matches;
  const marcarCalmo = () => html.classList.toggle('calmo', reduzido());
  function definirMovimento(m) {
    calmo = m === 'calmo';
    store.set('cz-movimento', calmo ? 'calmo' : 'normal');
    marcarCalmo();
    emit('movimento', reduzido());
  }
  marcarCalmo();
  ouvir(mqReduce, () => { marcarCalmo(); emit('movimento', reduzido()); });

  /* ---------- tema ---------- */

  const tema = () => {
    const t = html.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return mqLight.matches ? 'light' : 'dark';
  };
  const metaCor = document.querySelector('meta[name="theme-color"]');
  function corDoNavegador() {
    if (metaCor) metaCor.setAttribute('content', getComputedStyle(html).getPropertyValue('--bg').trim() || '#0D0E10');
  }

  let temaPedido = '';
  let temaSeq = 0;
  // O tema novo cresce num círculo a partir de (x, y), com View Transitions quando o navegador tem.
  function definirTema(proximo, x, y) {
    const meu = ++temaSeq;
    temaPedido = proximo;
    const aplicar = () => {
      html.setAttribute('data-theme', proximo);
      store.set('cz-tema', proximo);
      if (meu === temaSeq) temaPedido = '';
      corDoNavegador();
      emit('tema', proximo);
    };
    if (typeof document.startViewTransition !== 'function' || reduzido()) { aplicar(); return; }
    const vw = html.clientWidth || innerWidth;
    const vh = innerHeight;
    if (x == null || y == null) { x = vw / 2; y = vh / 2; }
    const fim = Math.ceil(Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)));
    html.classList.add('cz-vt');
    let vt;
    try {
      vt = document.startViewTransition(aplicar);
    } catch (e) {
      html.classList.remove('cz-vt');
      aplicar();
      return;
    }
    vt.ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${fim}px at ${x}px ${y}px)`] },
        { duration: 640, easing: 'cubic-bezier(.45, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
    vt.finished.catch(() => {}).then(() => { if (meu === temaSeq) html.classList.remove('cz-vt'); });
  }
  const alternarTema = (x, y) => definirTema((temaPedido || tema()) === 'light' ? 'dark' : 'light', x, y);
  ouvir(mqLight, () => { corDoNavegador(); emit('tema', tema()); });

  /* ---------- fonte ---------- */

  // "titulos": Zero Hour nos títulos e rótulos; "tudo": Zero Hour também no texto; "nova": Schibsted e Martian Mono.
  const FONTES = ['titulos', 'tudo', 'nova'];
  const fonte = () => html.getAttribute('data-font') || 'nova';
  function definirFonte(f) {
    if (!FONTES.includes(f)) return;
    if (f === 'nova') html.removeAttribute('data-font');
    else html.setAttribute('data-font', f);
    store.set('cz-fonte', f);
    emit('fonte', f);
    // As medidas mudam com a fonte: mede agora e de novo quando ela terminar de carregar.
    medir();
    agendar();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { medir(); agendar(); emit('fonte:pronta', f); });
  }

  /* ---------- capítulos e rolagem ---------- */

  const capitulos = Array.from(document.querySelectorAll('[data-capitulo]'), (el) => ({
    el,
    id: el.id,
    n: el.dataset.capitulo,
    nome: el.dataset.nome,
    topo: 0,
    fim: 0,
  }));
  let atual = null;
  let maxY = 1;

  function medir() {
    const y = scrollY;
    capitulos.forEach((c) => {
      const r = c.el.getBoundingClientRect();
      c.topo = r.top + y;
      c.fim = c.topo + r.height;
    });
    maxY = Math.max(1, html.scrollHeight - innerHeight);
  }

  let rolagemPendente = 0;
  function atualizar() {
    rolagemPendente = 0;
    const meio = scrollY + innerHeight * 0.5;
    let c = capitulos[0] || null;
    for (const k of capitulos) if (meio >= k.topo) c = k;
    if (c && c !== atual) {
      atual = c;
      emit('capitulo', c);
    }
    emit('rolagem', { y: scrollY, max: maxY, p: Math.min(1, Math.max(0, scrollY / maxY)) });
  }
  const agendar = () => { if (!rolagemPendente) rolagemPendente = requestAnimationFrame(atualizar); };
  addEventListener('scroll', agendar, { passive: true });
  addEventListener('resize', () => { medir(); agendar(); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => { medir(); agendar(); }).observe(document.body);

  /* ---------- viagem até um capítulo ---------- */

  let voo = 0;
  const easeVoo = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function pararVoo() {
    if (!voo) return;
    cancelAnimationFrame(voo);
    voo = 0;
    emit('voo', false);
  }
  ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, (e) => {
    if (t === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
    pararVoo();
  }, { passive: true }));

  function rolarAte(destino) {
    pararVoo();
    const de = scrollY;
    const dist = destino - de;
    if (Math.abs(dist) < 2) return;
    if (reduzido()) { scrollTo(0, destino); return; }
    const dur = Math.min(1700, 700 + Math.abs(dist) * 0.18);
    const t0 = performance.now();
    emit('voo', true);
    const passo = (agora) => {
      const t = Math.min(1, (agora - t0) / dur);
      scrollTo(0, de + dist * easeVoo(t));
      if (t < 1) voo = requestAnimationFrame(passo);
      else { voo = 0; emit('voo', false); }
    };
    voo = requestAnimationFrame(passo);
  }

  // Vai até o capítulo e leva o foco para o título dele (sem pular a tela de novo).
  function ir(id) {
    const c = capitulos.find((k) => k.id === id);
    const el = c ? c.el : document.getElementById(id);
    if (!el) return;
    medir();
    const destino = id === capitulos[0]?.id ? 0 : Math.min(maxY, (c ? c.topo : el.getBoundingClientRect().top + scrollY));
    emit('ir', id);
    rolarAte(destino);
    const alvo = el.querySelector('[data-foco]') || el;
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
    alvo.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, '', id === capitulos[0]?.id ? location.pathname + location.search : `#${id}`);
  }

  // Qualquer link com data-ir viaja em vez de pular.
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('[data-ir]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    ir(a.dataset.ir);
  });

  /* ---------- revelar ao entrar na tela ---------- */

  function revelar(raiz) {
    const els = Array.from((raiz || document).querySelectorAll('[data-revelar]:not(.is-in)'));
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || reduzido()) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- início ---------- */

  let iniciado = false;
  function pronto() {
    if (iniciado) return;
    iniciado = true;
    corDoNavegador();
    medir();
    revelar();
    // Chegou com #capitulo no endereço: vai direto, sem voo.
    const alvo = location.hash.slice(1);
    if (alvo && capitulos.some((c) => c.id === alvo)) {
      const c = capitulos.find((k) => k.id === alvo);
      scrollTo(0, c.topo);
    }
    atualizar();
    emit('pronto');
  }

  return {
    on, emit, store, reduzido, mouse, ouvir,
    tema, definirTema, alternarTema,
    fonte, definirFonte, movimento, definirMovimento,
    get sistemaReduz() { return mqReduce.matches; },
    capitulos, ir, rolarAte, medir, revelar, pronto,
    get atual() { return atual; },
  };
})();
