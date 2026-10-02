(() => {
  const root = document.querySelector('.sobre');
  if (!root) return;
  const manifesto = root.querySelector('.sobre__manifesto');
  if (!manifesto) return;
  const mqAlta = matchMedia('(min-height: 600px)');

  // Separa o texto em palavras (o texto inteiro fica num .sr para leitores de tela).
  const original = manifesto.textContent.replace(/\s+/g, ' ').trim();
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  let n = 0;
  manifesto.childNodes.forEach((no) => {
    const destaque = no.nodeType === 1 && no.tagName === 'EM';
    no.textContent.split(/(\s+)/).forEach((parte) => {
      if (!parte) return;
      if (/^\s+$/.test(parte)) { visual.appendChild(document.createTextNode(' ')); return; }
      const w = document.createElement(destaque ? 'em' : 'span');
      w.className = 'sobre__w';
      w.style.setProperty('--i', String(n++));
      w.textContent = parte;
      visual.appendChild(w);
    });
  });
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = original;
  manifesto.textContent = '';
  manifesto.append(sr, visual);
  const total = n;

  let cena = false;
  let topo = 0, altura = 1;
  function medir() {
    const r = root.getBoundingClientRect();
    topo = r.top + scrollY;
    altura = Math.max(1, r.height - innerHeight);
  }
  const miolo = root.querySelector('.sobre__miolo');
  // A cena prende o texto na tela: só vale se ele couber inteiro (com folga para o HUD).
  const cabe = () => !miolo || miolo.offsetHeight + 230 <= innerHeight;
  function avaliar() {
    const quer = !CZ.reduzido() && mqAlta.matches && cabe();
    if (quer !== cena) {
      cena = quer;
      root.classList.toggle('sobre--cena', cena);
      if (!cena) { manifesto.style.removeProperty('--k'); root.style.removeProperty('--p'); root.classList.remove('is-fatos'); }
    }
    medir();
    atualizar(scrollY);
  }

  let ultimoK = -1;
  function atualizar(y) {
    if (!cena) return;
    const p = Math.min(1, Math.max(0, (y - topo) / altura));
    // O texto acende até 70% da cena; o resto é para ler com calma e ver os fatos.
    const k = Math.round(((p / 0.7) * (total + 1)) * 100) / 100;
    if (k !== ultimoK) { ultimoK = k; manifesto.style.setProperty('--k', String(k)); }
    root.style.setProperty('--p', p.toFixed(3));
    root.classList.toggle('is-fatos', p > 0.66);
  }

  CZ.on('rolagem', ({ y }) => atualizar(y));
  CZ.on('movimento', avaliar);
  CZ.on('fonte', avaliar);
  CZ.on('fonte:pronta', avaliar);
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', avaliar);
  CZ.ouvir(mqAlta, () => { avaliar(); CZ.medir(); });
  addEventListener('resize', avaliar, { passive: true });
  CZ.on('pronto', () => { medir(); atualizar(scrollY); });
  avaliar();
})();
