(() => {
  const root = document.querySelector('.projetos');
  if (!root) return;
  const trilha = root.querySelector('.projetos__trilha');
  const slides = Array.from(root.querySelectorAll('.projeto'));
  const atualEl = root.querySelector('.projetos__atual');
  const progresso = root.querySelector('.projetos__progresso');
  const nProjetos = slides.filter((s) => !s.classList.contains('projeto--fim')).length;
  const totalEl = root.querySelector('.projetos__total');
  if (totalEl) totalEl.textContent = ` / ${String(nProjetos).padStart(2, '0')}`;
  // Trilha só com mouse/trackpad em tela larga e alta; no toque e em tela baixa, os projetos ficam empilhados.
  const mqLarga = matchMedia('(min-width: 900px) and (min-height: 600px) and (pointer: fine)');
  const palco = root.querySelector('.projetos__palco');
  const setas = Array.from(root.querySelectorAll('.projetos__seta'));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pecas = slides.map((s) => ({
    el: s,
    card: s.querySelector('.projeto__card, .projeto__fim'),
    midia: s.querySelector('.projeto__midia'),
  }));

  /* ---------- trilha horizontal ---------- */
  let modo = false, topo = 0, dist = 1, largura = 1, centros = [], indice = 0;
  const alvoDe = (i) => topo + clamp((centros[i] - largura / 2) / dist, 0, 1) * dist;

  function limpar() {
    root.style.height = '';
    trilha.style.transform = '';
    pecas.forEach((p) => {
      if (p.card) { p.card.style.transform = ''; p.card.style.opacity = ''; }
      if (p.midia) p.midia.style.translate = '';
    });
  }

  function layout() {
    const quer = !CZ.reduzido() && mqLarga.matches;
    if (quer !== modo) {
      modo = quer;
      root.classList.toggle('projetos--trilha', modo);
      if (!modo) limpar();
    }
    if (!modo) return;
    // A trilha prende a tela: só vale se o texto de cada projeto couber inteiro (com folga para o HUD).
    const alto = Math.max(...pecas.map((pc) => (pc.card ? pc.card.offsetHeight : 0)));
    if (alto + 220 > innerHeight) {
      modo = false;
      root.classList.remove('projetos--trilha');
      limpar();
      return;
    }
    trilha.style.transform = 'translate3d(0, 0, 0)';
    largura = document.documentElement.clientWidth;
    dist = Math.max(1, trilha.scrollWidth - largura);
    root.style.height = `${Math.round(innerHeight + dist)}px`;
    topo = root.getBoundingClientRect().top + scrollY;
    centros = slides.map((s) => s.offsetLeft + s.offsetWidth / 2);
    atualizar(scrollY);
  }

  let ultimoAtual = '';
  function atualizar(y) {
    if (!modo) return;
    const p = clamp((y - topo) / dist, 0, 1);
    const x = -p * dist;
    trilha.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    if (progresso) progresso.style.setProperty('--p', p.toFixed(3));
    // melhor: o projeto mais perto do centro (o contador); perto: qualquer slide, inclusive o do GitHub (as setas).
    let melhor = 0, bd = Infinity, perto = 0, bp = Infinity;
    pecas.forEach((pc, i) => {
      const d = clamp((centros[i] + x - largura / 2) / largura, -1, 1);
      const ad = Math.abs(d);
      if (pc.card) {
        pc.card.style.transform = ad < 0.001 ? '' : `perspective(1400px) rotateY(${(d * -12).toFixed(2)}deg) scale(${(1 - ad * 0.12).toFixed(4)})`;
        pc.card.style.opacity = (1 - ad * 0.7).toFixed(3);
      }
      if (pc.midia) pc.midia.style.translate = `${(d * -40).toFixed(1)}px 0`;
      if (i < nProjetos && ad < bd) { bd = ad; melhor = i; }
      if (ad < bp) { bp = ad; perto = i; }
    });
    indice = perto;
    // aria-disabled (e não disabled): o botão focado não perde o foco quando chega na ponta.
    setas.forEach((b) => b.setAttribute('aria-disabled', String((b.dataset.dir === '-1' && p < 0.015) || (b.dataset.dir === '1' && p > 0.985))));
    const atual = String(melhor + 1).padStart(2, '0');
    if (atual !== ultimoAtual && atualEl) { ultimoAtual = atual; atualEl.textContent = atual; }
  }

  // Foco do teclado num projeto fora da tela: a página rola até ele ficar no centro.
  root.addEventListener('focusin', (e) => {
    if (!modo) return;
    if (palco) palco.scrollLeft = 0;
    const i = slides.findIndex((s) => s.contains(e.target));
    if (i < 0) return;
    const alvo = alvoDe(i);
    if (Math.abs(alvo - scrollY) > 4) CZ.rolarAte(alvo);
  });
  // Segurança: o navegador nunca rola o palco na horizontal (só a trilha anda, pelo transform).
  if (palco) palco.addEventListener('scroll', () => { if (palco.scrollLeft) palco.scrollLeft = 0; }, { passive: true });

  // Anterior / próximo: botões, setas do teclado e gesto lateral do trackpad.
  function irPara(i) {
    if (!modo) return;
    const n = clamp(i, 0, slides.length - 1);
    CZ.rolarAte(alvoDe(n));
  }
  setas.forEach((b) => b.addEventListener('click', () => {
    if (b.getAttribute('aria-disabled') === 'true') return;
    irPara(indice + Number(b.dataset.dir));
  }));
  const naTrilha = () => modo && scrollY >= topo - 2 && scrollY <= topo + dist + 2;
  addEventListener('keydown', (e) => {
    if (!naTrilha() || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.documentElement.classList.contains('term-aberto')) return;
    if (t && t.closest && t.closest('.arco, .fonte')) return;
    e.preventDefault();
    irPara(indice + (e.key === 'ArrowRight' ? 1 : -1));
  });
  // Deslizar dois dedos para o lado no trackpad move a trilha (sem disparar o "voltar" do navegador).
  root.addEventListener('wheel', (e) => {
    if (!modo || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    scrollBy(0, e.deltaX);
  }, { passive: false });

  CZ.on('rolagem', ({ y }) => atualizar(y));
  CZ.on('movimento', layout);
  CZ.ouvir(mqLarga, layout);
  CZ.on('fonte', layout);
  CZ.on('idioma', layout);
  CZ.on('fonte:pronta', layout);
  addEventListener('resize', layout, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', layout);
  layout();

  /* ---------- luz e inclinação no print, seguindo o cursor ---------- */
  const TILT = 5;
  const tilts = Array.from(root.querySelectorAll('[data-tilt]'), (el) => ({
    el,
    luz: el.querySelector('.projeto__luz'),
    img: el.querySelector('.projeto__img, .projeto__quadro svg'),
    w: 1, h: 1, over: false,
    nx: 0, ny: 0, tnx: 0, tny: 0, x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0,
  }));
  const vivos = new Set();
  let rafT = 0, lastT = 0;
  const pode = () => CZ.mouse() && !CZ.reduzido();

  function mirar(t, e) {
    const r = t.el.getBoundingClientRect();
    t.w = r.width || 1; t.h = r.height || 1;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    t.tx = x; t.ty = y;
    t.tnx = clamp((x / t.w) * 2 - 1, -1, 1);
    t.tny = clamp((y / t.h) * 2 - 1, -1, 1);
  }
  function tickT(now) {
    rafT = 0;
    const dt = lastT ? Math.min(64, now - lastT) : 16.7;
    lastT = now;
    const k = (f) => 1 - Math.pow(1 - f, dt / 16.7);
    vivos.forEach((t) => {
      t.nx += (t.tnx - t.nx) * k(0.11);
      t.ny += (t.tny - t.ny) * k(0.11);
      t.x += (t.tx - t.x) * k(0.3);
      t.y += (t.ty - t.y) * k(0.3);
      t.a += (t.ta - t.a) * k(0.16);
      const parado = Math.abs(t.tnx - t.nx) < 0.002 && Math.abs(t.tny - t.ny) < 0.002 && Math.abs(t.ta - t.a) < 0.004;
      if (parado) { t.nx = t.tnx; t.ny = t.tny; t.a = t.ta; }
      const inclinado = t.nx !== 0 || t.ny !== 0;
      t.el.style.transform = inclinado ? `perspective(1100px) rotateX(${(t.ny * TILT).toFixed(3)}deg) rotateY(${(-t.nx * TILT).toFixed(3)}deg)` : '';
      if (t.img) t.img.style.translate = inclinado ? `${(t.nx * -6).toFixed(2)}px ${(t.ny * -6).toFixed(2)}px` : '';
      if (t.luz) {
        t.luz.style.setProperty('--x', `${t.x.toFixed(1)}px`);
        t.luz.style.setProperty('--y', `${t.y.toFixed(1)}px`);
        t.luz.style.setProperty('--a', t.a.toFixed(3));
      }
      if (parado && !t.over) vivos.delete(t);
    });
    if (vivos.size) rafT = requestAnimationFrame(tickT);
    else lastT = 0;
  }
  const acordar = (t) => { vivos.add(t); if (!rafT) rafT = requestAnimationFrame(tickT); };

  tilts.forEach((t) => {
    t.el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !pode()) return;
      t.over = true;
      mirar(t, e);
      if (t.a < 0.05) { t.x = t.tx; t.y = t.ty; }
      t.ta = 1;
      acordar(t);
    });
    t.el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !pode()) return;
      if (!t.over) { t.over = true; t.ta = 1; }
      mirar(t, e);
      acordar(t);
    });
    t.el.addEventListener('pointerleave', () => {
      if (!t.over) return;
      t.over = false;
      t.tnx = 0; t.tny = 0; t.ta = 0;
      acordar(t);
    });
  });

  /* ---------- Librahin: a mão troca de pose e a frase se monta ---------- */
  const lib = root.querySelector('.lib');
  if (!lib || CZ.reduzido()) return;
  lib.classList.add('lib--js');
  const S = 1.72, OX = 40, OY = 14;
  const POSES = [
    [[50,92],[37,84],[28,75],[22,66],[17,58],[40,58],[37,44],[35,35],[33,26],[50,56],[50,40],[50,30],[50,20],[59,58],[62,43],[64,34],[65,26],[67,63],[72,52],[75,45],[78,38]],
    [[50,92],[39,85],[34,76],[39,70],[46,68],[41,60],[40,46],[39,37],[39,28],[50,59],[52,50],[51,56],[49,61],[58,61],[60,53],[59,58],[57,62],[65,64],[67,57],[66,61],[64,64]],
    [[50,92],[38,84],[29,77],[21,71],[14,66],[42,61],[44,52],[44,58],[43,63],[50,60],[52,51],[52,57],[50,63],[57,61],[60,52],[60,58],[58,63],[64,64],[70,55],[75,48],[80,41]],
    [[50,92],[37,84],[28,78],[20,74],[13,71],[41,60],[40,46],[39,37],[39,28],[50,59],[52,50],[51,56],[49,61],[58,61],[60,53],[59,58],[57,62],[65,64],[67,57],[66,61],[64,64]],
  ];
  const CON = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
  const pontos = Array.from(lib.querySelectorAll('.lib__mao circle'));
  const ossos = Array.from(lib.querySelectorAll('.lib__mao line'));
  const sinais = Array.from(lib.querySelectorAll('.lib__sinal'));
  const nivel = lib.querySelector('.lib__nivel');
  if (pontos.length !== 21 || ossos.length !== CON.length) return;
  if (nivel) nivel.setAttribute('width', '92');

  // Roteiro: cada passo troca a pose e acende um sinal; no fim a frase aparece.
  const PASSOS = [
    { pose: 0, sinal: 0, c: 0.93 },
    { pose: 1, sinal: 1, c: 0.88 },
    { pose: 2, sinal: 2, c: 0.91 },
    { pose: 3, frase: true, c: 0.95 },
    { pose: 0, espera: true, c: 0.9 },
    { pose: 1, limpa: true, c: 0.84 },
  ];
  const PASSO_MS = 1500, MORPH_MS = 720;
  let de = POSES[0], para = POSES[0], t0 = 0, passo = -1, proximo = 0;
  const cur = POSES[0].map((p) => p.slice());
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  function aplicarPasso(now) {
    passo = (passo + 1) % PASSOS.length;
    const ps = PASSOS[passo];
    de = cur.map((p) => p.slice());
    para = POSES[ps.pose];
    t0 = now;
    proximo = now + PASSO_MS;
    sinais.forEach((s) => s.classList.remove('is-novo'));
    if (ps.sinal != null && sinais[ps.sinal]) sinais[ps.sinal].classList.add('is-on', 'is-novo');
    if (ps.frase) lib.classList.add('is-frase');
    if (ps.limpa) { sinais.forEach((s) => s.classList.remove('is-on')); lib.classList.remove('is-frase'); }
    if (nivel) nivel.style.setProperty('--c', String(ps.c));
  }

  function desenhar(now) {
    const m = ease(Math.min(1, (now - t0) / MORPH_MS));
    const s = now / 1000;
    for (let i = 0; i < 21; i++) {
      // um balanço leve, como a mão de verdade parada na frente da câmera
      const bx = Math.sin(s * 1.3 + i * 0.4) * 0.35;
      const by = Math.cos(s * 1.1 + i * 0.3) * 0.35;
      cur[i][0] = de[i][0] + (para[i][0] - de[i][0]) * m;
      cur[i][1] = de[i][1] + (para[i][1] - de[i][1]) * m;
      const x = OX + (cur[i][0] + bx) * S, y = OY + (cur[i][1] + by) * S;
      pontos[i].setAttribute('cx', x.toFixed(2));
      pontos[i].setAttribute('cy', y.toFixed(2));
    }
    CON.forEach(([a, b], k) => {
      const l = ossos[k];
      l.setAttribute('x1', pontos[a].getAttribute('cx'));
      l.setAttribute('y1', pontos[a].getAttribute('cy'));
      l.setAttribute('x2', pontos[b].getAttribute('cx'));
      l.setAttribute('y2', pontos[b].getAttribute('cy'));
    });
  }

  let rafL = 0, visivel = false;
  function loop(now) {
    rafL = 0;
    if (CZ.reduzido()) return;
    if (now >= proximo) aplicarPasso(now);
    desenhar(now);
    if (visivel && !document.hidden) rafL = requestAnimationFrame(loop);
  }
  const sync = () => {
    if (visivel && !document.hidden && !rafL) {
      const now = performance.now();
      if (proximo && now > proximo + PASSO_MS) proximo = now; // voltou depois de muito tempo: segue do passo seguinte
      rafL = requestAnimationFrame(loop);
    }
  };
  new IntersectionObserver((en) => { visivel = en[en.length - 1].isIntersecting; sync(); }).observe(lib);
  // Modo calmo ligado depois: a mão para.
  CZ.on('movimento', (r) => { if (r && rafL) { cancelAnimationFrame(rafL); rafL = 0; } else if (!r) sync(); });
  document.addEventListener('visibilitychange', sync);
})();
