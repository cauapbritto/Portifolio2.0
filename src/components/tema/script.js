(() => {
  const root = document.querySelector('[data-fx="tema"]');
  if (!root) return;
  const btn = root.querySelector('.fx-tema__btn');
  const label = root.querySelector('.fx-tema__label');
  const hexes = Array.from(root.querySelectorAll('.fx-tema__hex'));
  if (!btn) return;

  const html = document.documentElement;
  const mqLight = matchMedia('(prefers-color-scheme: light)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');

  // Tema efetivo: data-theme manda; sem ele, vale o sistema.
  const effective = () => {
    const t = html.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return mqLight.matches ? 'light' : 'dark';
  };

  let shown = '';
  function render() {
    const t = effective();
    const cs = getComputedStyle(html);
    hexes.forEach((el) => {
      const v = cs.getPropertyValue(el.dataset.token).trim().toUpperCase();
      if (el.textContent !== v) el.textContent = v;
    });
    if (t === shown) return;
    shown = t;
    root.dataset.state = t;
    btn.setAttribute('aria-label', t === 'light' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro');
    if (label) label.textContent = t === 'light' ? 'Tema claro' : 'Tema escuro';
  }

  // Só a troca feita por este botão usa a classe; ela protege as regras globais de ::view-transition.
  let seq = 0;
  // Tema pedido e ainda não aplicado: o callback da View Transition só roda no quadro seguinte,
  // então um segundo clique/Enter nesse intervalo precisa partir do pedido, não do atributo antigo.
  let pending = '';
  // Durante a View Transition o Chrome entrega os cliques ao <html> (os pseudo-elementos cobrem a página).
  // Só nesse intervalo, e só para a troca feita por este botão, um clique em cima do botão ainda vale.
  let vtRect = null;
  function onVtClick(e) {
    if (!vtRect || e.target !== html) return;
    if (e.clientX >= vtRect.left && e.clientX <= vtRect.right && e.clientY >= vtRect.top && e.clientY <= vtRect.bottom) btn.click();
  }
  function setTheme(next) {
    const mine = ++seq;
    pending = next;
    const apply = () => {
      html.setAttribute('data-theme', next);
      if (mine === seq) pending = '';
      render();
    };
    if (typeof document.startViewTransition !== 'function' || mqReduce.matches) { apply(); return; }

    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const vw = html.clientWidth || innerWidth;
    const vh = innerHeight;
    const end = Math.ceil(Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)));
    html.classList.add('fx-tema-vt');
    let vt;
    try {
      vt = document.startViewTransition(apply);
    } catch (err) {
      html.classList.remove('fx-tema-vt');
      apply();
      return;
    }
    vtRect = r;
    html.addEventListener('click', onVtClick);
    vt.ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 520, easing: 'cubic-bezier(.45, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
    vt.finished.catch(() => {}).then(() => {
      if (mine !== seq) return;
      html.classList.remove('fx-tema-vt');
      html.removeEventListener('click', onVtClick);
      vtRect = null;
    });
  }

  btn.addEventListener('click', () => setTheme((pending || effective()) === 'light' ? 'dark' : 'light'));

  // Outros componentes (terminal, menu em arco) também trocam o tema: o botão acompanha.
  new MutationObserver(render).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  const onSystem = () => render();
  if (mqLight.addEventListener) mqLight.addEventListener('change', onSystem);
  else mqLight.addListener(onSystem);

  // Primeiro estado sem animar o ícone; depois disso as mudanças são anunciadas.
  root.classList.add('fx-tema--init');
  render();
  void root.offsetWidth; // fixa o estado inicial antes de religar as transições
  root.classList.remove('fx-tema--init');
  if (label) label.setAttribute('aria-live', 'polite');
})();
