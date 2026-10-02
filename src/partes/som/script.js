(() => {
  /* Som gerado na hora com Web Audio: um zumbido grave de nave, um vento que cresce com a velocidade
     da rolagem e cliques curtos na interface. Começa desligado; liga pelo menu (Som) ou pelo terminal. */
  const AC = window.AudioContext || window.webkitAudioContext;
  let querLigado = CZ.store.get('cz-som') === '1';
  const estado = () => CZ.emit('som:estado', querLigado && !!AC);
  CZ.on('pronto', estado);
  if (!AC) {
    CZ.on('som:alternar', () => CZ.emit('som:estado', false));
    return;
  }

  let ctx = null, mestre = null, efeitos = null, vento = null, ventoFiltro = null;
  let tocando = false;

  function ruidoRosa(seg) {
    const n = Math.floor(ctx.sampleRate * seg);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  function montar() {
    ctx = new AC();
    mestre = ctx.createGain();
    mestre.gain.value = 0;
    mestre.connect(ctx.destination);
    efeitos = ctx.createGain();
    efeitos.gain.value = 0;
    efeitos.connect(ctx.destination);

    // Zumbido: lá grave, quinta e oitava, cada um respirando num ritmo próprio.
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 380;
    filtro.Q.value = 0.8;
    filtro.connect(mestre);
    [[55, 'sine', 0.3], [82.41, 'triangle', 0.08], [110.4, 'sine', 0.12], [164.6, 'sine', 0.04]].forEach(([f, tipo, g], i) => {
      const o = ctx.createOscillator();
      o.type = tipo;
      o.frequency.value = f;
      const ganho = ctx.createGain();
      ganho.gain.value = g;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + i * 0.023;
      const prof = ctx.createGain();
      prof.gain.value = g * 0.45;
      lfo.connect(prof);
      prof.connect(ganho.gain);
      o.connect(ganho);
      ganho.connect(filtro);
      o.start();
      lfo.start();
    });
    const varre = ctx.createOscillator();
    varre.frequency.value = 0.025;
    const varreProf = ctx.createGain();
    varreProf.gain.value = 140;
    varre.connect(varreProf);
    varreProf.connect(filtro.frequency);
    varre.start();

    // Vento: ruído rosa num filtro de banda; a velocidade abre o filtro e aumenta o volume.
    const src = ctx.createBufferSource();
    src.buffer = ruidoRosa(3);
    src.loop = true;
    ventoFiltro = ctx.createBiquadFilter();
    ventoFiltro.type = 'bandpass';
    ventoFiltro.frequency.value = 520;
    ventoFiltro.Q.value = 0.7;
    vento = ctx.createGain();
    vento.gain.value = 0.02;
    src.connect(ventoFiltro);
    ventoFiltro.connect(vento);
    vento.connect(mestre);
    src.start();
  }

  function ligar() {
    if (!ctx) montar();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    mestre.gain.cancelScheduledValues(t);
    mestre.gain.setTargetAtTime(0.42, t, 0.9);
    efeitos.gain.cancelScheduledValues(t);
    efeitos.gain.setTargetAtTime(1, t, 0.05);
    tocando = true;
  }
  let suspender = 0;
  function silenciar() {
    if (!ctx) return;
    const t = ctx.currentTime;
    mestre.gain.cancelScheduledValues(t);
    mestre.gain.setTargetAtTime(0, t, 0.2);
    efeitos.gain.cancelScheduledValues(t);
    efeitos.gain.setTargetAtTime(0, t, 0.05);
    tocando = false;
    clearTimeout(suspender);
    suspender = setTimeout(() => { if (!tocando && ctx.state === 'running') ctx.suspend(); }, 1400);
  }

  CZ.on('som:alternar', () => {
    querLigado = !querLigado;
    CZ.store.set('cz-som', querLigado ? '1' : '0');
    if (querLigado) ligar(); else silenciar();
    estado();
  });

  // Ligado numa visita anterior: o navegador só deixa tocar depois do primeiro gesto.
  if (querLigado) {
    const primeiro = () => {
      ['pointerdown', 'keydown'].forEach((t) => removeEventListener(t, primeiro, true));
      if (querLigado && !tocando) ligar();
    };
    ['pointerdown', 'keydown'].forEach((t) => addEventListener(t, primeiro, { capture: true }));
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { if (ctx.state === 'running') ctx.suspend(); }
    else if (tocando) ctx.resume();
  });

  /* ---------- velocidade → vento ---------- */
  let ultimaV = 0;
  CZ.on('velocidade', (v) => {
    if (!tocando) return;
    const a = Math.min(1, Math.abs(v) / 2600);
    if (Math.abs(a - ultimaV) < 0.01) return;
    ultimaV = a;
    const t = ctx.currentTime;
    vento.gain.setTargetAtTime(0.02 + a * 0.16, t, 0.12);
    ventoFiltro.frequency.setTargetAtTime(520 + a * 1600, t, 0.15);
  });

  /* ---------- efeitos curtos ---------- */
  function tom(f0, f1, dur, tipo, vol) {
    if (!tocando) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(efeitos);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const EFEITOS = {
    passar: () => tom(1500, 1100, 0.045, 'sine', 0.02),
    clique: () => tom(620, 300, 0.09, 'triangle', 0.05),
    abrir: () => tom(180, 760, 0.22, 'sawtooth', 0.025),
    fechar: () => tom(700, 160, 0.2, 'sawtooth', 0.02),
    warp: () => tom(90, 900, 1.2, 'sawtooth', 0.03),
  };
  CZ.on('som:efeito', (nome) => { if (EFEITOS[nome]) EFEITOS[nome](); });
  CZ.on('warp', () => EFEITOS.warp());

  const ALVOS = 'a, button, [role="button"]';
  let ultimoPassar = 0;
  let ultimoAlvo = null;
  document.addEventListener('pointerover', (e) => {
    if (!tocando || e.pointerType !== 'mouse') return;
    const alvo = e.target instanceof Element ? e.target.closest(ALVOS) : null;
    if (!alvo || alvo === ultimoAlvo) return;
    ultimoAlvo = alvo;
    const agora = performance.now();
    if (agora - ultimoPassar < 70) return;
    ultimoPassar = agora;
    EFEITOS.passar();
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    if (ultimoAlvo && !(e.relatedTarget instanceof Element && ultimoAlvo.contains(e.relatedTarget))) ultimoAlvo = null;
  }, { passive: true });
  document.addEventListener('click', (e) => {
    if (!tocando) return;
    if (e.target instanceof Element && e.target.closest(ALVOS)) EFEITOS.clique();
  });
})();
