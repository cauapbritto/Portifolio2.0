(() => {
  const root = document.querySelector('[data-fx="entrada"]');
  if (!root) return;

  const btn = root.querySelector('.fx-entrada__replay');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let io = null;

  // Tira .is-in (volta ao escondido sem transição), força um reflow e põe de novo: a entrada recomeça.
  function play() {
    root.classList.remove('is-in');
    void root.offsetWidth;
    root.classList.add('is-in');
  }

  function stopWatching() {
    if (io) { io.disconnect(); io = null; }
  }

  function inViewNow() {
    const r = root.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh && r.bottom > 0;
  }

  // Sem IntersectionObserver ou com movimento reduzido, o conteúdo fica como está: visível.
  if ('IntersectionObserver' in window && !mqReduce.matches) {
    root.classList.add('is-armed');
    if (inViewNow()) {
      // Já está na tela ao carregar: só toca a animação.
      play();
    } else {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.25) {
            stopWatching();
            root.classList.add('is-in');
            break;
          }
        }
      }, { threshold: [0.25] });
      io.observe(root);
    }
  }

  // Se a pessoa liga "reduzir movimento" antes de chegar aqui, mostra tudo já (com o fade curto).
  const onReduce = () => {
    if (mqReduce.matches && io) { stopWatching(); root.classList.add('is-in'); }
  };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce);
  else if (mqReduce.addListener) mqReduce.addListener(onReduce);

  if (btn) {
    root.classList.add('is-live');
    btn.addEventListener('click', () => {
      stopWatching();
      root.classList.add('is-armed', 'is-replay');
      play();
    });
  }
})();
