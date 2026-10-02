(() => {
  const root = document.querySelector('[data-fx="flip"]');
  if (!root) return;

  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  const DUR = 650;      // igual a transicao do CSS
  const EDGE = 0.2;     // fracao do tempo em que a mola passa de 90 graus (card de perfil)

  const cards = Array.from(root.querySelectorAll('.fx-flip__card'), (card) => {
    const front = card.querySelector('.fx-flip__front');
    const back = card.querySelector('.fx-flip__back');
    return {
      card, front, back,
      open: front.querySelector('[data-flip="open"]'),
      close: back.querySelector('[data-flip="close"]'),
      flipped: false,
      at: -1e9,
      anims: [],
    };
  });

  // Face escondida: fora da ordem de Tab e da arvore de acessibilidade.
  const setHidden = (face, hidden) => {
    face.inert = hidden;
    if (hidden) face.setAttribute('aria-hidden', 'true');
    else face.removeAttribute('aria-hidden');
  };

  cards.forEach((c) => setHidden(c.back, true));
  root.classList.add('is-ready');

  // Luz e sombra acompanhando o giro (Web Animations, so opacity e transform, sem rAF).
  const play = (c, toBack) => {
    c.anims.forEach((a) => a.cancel());
    c.anims = [];
    if (reduceQ.matches || typeof c.front.animate !== 'function') return;
    const leaving = toBack ? c.front : c.back;
    const coming = toBack ? c.back : c.front;
    const part = (face, cls) => face.querySelector(cls);
    const opts = { duration: DUR, easing: 'linear' };
    c.anims.push(
      // A face que sai escurece ate ficar de perfil...
      part(leaving, '.fx-flip__shade').animate([
        { opacity: 0 },
        { opacity: 0.6, offset: EDGE },
        { opacity: 0.6 },
      ], opts),
      // ...e a que chega comeca escura e clareia.
      part(coming, '.fx-flip__shade').animate([
        { opacity: 0.6 },
        { opacity: 0.6, offset: EDGE },
        { opacity: 0, offset: 0.5 },
        { opacity: 0 },
      ], opts),
      // Um reflexo atravessa as duas faces, como se o card passasse por uma luz.
      part(leaving, '.fx-flip__sheen').animate([
        { opacity: 0, transform: 'translateX(-90%)' },
        { opacity: 1, transform: 'translateX(-20%)', offset: EDGE },
        { opacity: 1, transform: 'translateX(-20%)' },
      ], opts),
      part(coming, '.fx-flip__sheen').animate([
        { opacity: 1, transform: 'translateX(-20%)' },
        { opacity: 1, transform: 'translateX(-20%)', offset: EDGE },
        { opacity: 0, transform: 'translateX(90%)', offset: 0.62 },
        { opacity: 0, transform: 'translateX(90%)' },
      ], opts),
    );
  };

  const flip = (c, toBack) => {
    if (c.flipped === toBack) return;
    c.flipped = toBack;
    c.at = performance.now();
    const show = toBack ? c.back : c.front;
    const hide = toBack ? c.front : c.back;
    c.card.classList.toggle('is-flipped', toBack);
    c.open.setAttribute('aria-expanded', String(toBack));
    // Libera a face nova, move o foco e so entao tranca a antiga (o foco nunca cai no body).
    setHidden(show, false);
    (toBack ? c.close : c.open).focus({ preventScroll: true });
    setHidden(hide, true);
    play(c, toBack);
  };

  // Duplo clique: o segundo clique cai no meio do giro (no Voltar que acabou de aparecer, ou em
  // nada clicavel) e desviraria o card ou tiraria o foco do botao. Durante o giro ele e ignorado.
  const echo = (c, e) => e.detail > 1 && performance.now() - c.at < DUR;

  cards.forEach((c) => {
    c.open.addEventListener('click', (e) => { if (!echo(c, e)) flip(c, true); });
    c.close.addEventListener('click', (e) => { if (!echo(c, e)) flip(c, false); });
    c.card.addEventListener('mousedown', (e) => { if (echo(c, e)) e.preventDefault(); });
  });

  // Esc no verso desvira (o listener e do componente, entao so reage com foco dentro dele).
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const c = cards.find((x) => x.flipped && x.back.contains(e.target));
    if (!c) return;
    e.preventDefault();
    flip(c, false);
  });
})();
