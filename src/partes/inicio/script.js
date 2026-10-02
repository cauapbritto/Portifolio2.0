(() => {
  const root = document.querySelector('.inicio');
  if (!root) return;
  const html = document.documentElement;
  const palavra = root.querySelector('.inicio__palavra');

  // Separa o nome em letras para a entrada (o nome inteiro continua no .sr do título).
  const letras = [];
  if (palavra) {
    const texto = palavra.textContent;
    palavra.textContent = '';
    Array.from(texto).forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'inicio__char';
      s.textContent = ch;
      palavra.appendChild(s);
      letras.push(s);
    });
  }

  /* ---------- entrada, junto com a abertura ---------- */
  const OUT = 'cubic-bezier(.2,.7,.2,1)';
  function entrar() {
    if (CZ.reduzido()) return;
    const add = (el, kf, opts) => { if (el && el.animate) el.animate(kf, { fill: 'backwards', easing: OUT, ...opts }); };
    add(root.querySelector('.inicio__planeta'), [{ opacity: 0, transform: 'translate3d(-50%, 12vh, 0)' }, { opacity: 1, transform: 'translate3d(-50%, 0, 0)' }], { duration: 1600, delay: 100 });
    add(root.querySelector('.inicio__rotulo'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 420 });
    letras.forEach((el, i) => add(el, [
      { opacity: 0, transform: 'translateY(60%) scale(.9)' },
      { opacity: 1, offset: 0.4 },
      { opacity: 1, transform: 'none' },
    ], { duration: 900, delay: 360 + i * 55 }));
    add(root.querySelector('.inicio__nome'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 420 });
    add(root.querySelector('.inicio__frase'), [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 520 });
    add(root.querySelector('.inicio__acoes'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 640 });
    add(root.querySelector('.inicio__descer'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 900 });
    add(root.querySelector('.inicio__dica'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 1400 });
  }
  if (html.classList.contains('abrindo')) CZ.on('abertura', entrar);

  /* ---------- decolagem: o conteúdo sobe e o planeta fica para trás ---------- */
  let ultimo = -1;
  CZ.on('rolagem', ({ y }) => {
    if (CZ.reduzido()) return;
    const v = Math.min(1, Math.max(0, y / (innerHeight * 0.9)));
    const r = Math.round(v * 1000) / 1000;
    if (r === ultimo) return;
    ultimo = r;
    root.style.setProperty('--sai', String(r));
  });
})();
