(() => {
  const root = document.querySelector('.term');
  if (!root) return;
  const out = root.querySelector('.term__out');
  const form = root.querySelector('.term__form');
  const input = root.querySelector('.term__input');
  const screen = root.querySelector('.term__screen');
  const canvas = root.querySelector('.term__rain');
  const scanEl = root.querySelector('.term__scan');
  const status = root.querySelector('.term__status');
  if (!out || !form || !input || !screen) return;

  const html = document.documentElement;
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqLight = matchMedia('(prefers-color-scheme: light)');
  const reduced = () => CZ.reduzido();
  const MAX_LINES = 160;
  const LINKS = {
    email: 'mailto:caua.pbritto@gmail.com',
    libCode: 'https://github.com/cauapbritto/Vis-oLibras',
    github: 'https://github.com/cauapbritto',
    linkedin: 'https://www.linkedin.com/in/cau%C3%A3-pedrozo-brito-8a685b358',
    ecoSite: 'https://cauapbritto.github.io/lixo-eletronico/',
    ecoCode: 'https://github.com/cauapbritto/lixo-eletronico',
    golpeSite: 'https://cauapbritto.github.io/Golpe-ou-n-o/',
    golpeCode: 'https://github.com/cauapbritto/Golpe-ou-n-o',
    v1Code: 'https://github.com/cauapbritto/portif-lio',
    v2Code: 'https://github.com/cauapbritto/Portifolio2.0',
    cv: 'assets/Curriculo_Caua_Pedrozo_Brito.pdf',
  };

  /* ---------- saída ---------- */

  let batchIndex = 0;

  function node(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function fill(parent, parts) {
    (Array.isArray(parts) ? parts : [parts]).forEach((p) => {
      if (p == null) return;
      parent.appendChild(typeof p === 'string' ? document.createTextNode(p) : p);
    });
    return parent;
  }
  function link(text, href, label) {
    const a = node('a', '', text);
    a.href = href;
    if (!href.startsWith('mailto:')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    if (label) a.setAttribute('aria-label', label);
    return a;
  }
  function trim() {
    while (out.childElementCount > MAX_LINES) out.firstElementChild.remove();
  }
  function scrollEnd() {
    out.scrollTop = out.scrollHeight;
  }
  // Linhas de resposta entram com um atraso curto em cascata; o input nunca espera por elas.
  function print(parts, mods) {
    const row = node('div', 'term__line');
    if (mods) mods.split(' ').forEach((m) => row.classList.add(`term__line--${m}`));
    row.classList.add('term__line--in');
    row.style.setProperty('--d', String(Math.min(batchIndex++, 14)));
    fill(row, parts);
    out.appendChild(row);
    return row;
  }
  function row(key, value, mods) {
    const r = print(null, mods);
    r.classList.add('term__row');
    fill(r, [fill(node('span'), key), ' ', fill(node('span'), value)]);
    return r;
  }
  function echo(text) {
    batchIndex = 0;
    const r = node('div', 'term__line term__line--cmd');
    fill(r, [node('span', 'term__p', '›'), text]);
    r.firstChild.setAttribute('aria-hidden', 'true');
    out.appendChild(r);
  }

  /* ---------- tema ---------- */


  /* ---------- estado dos efeitos ---------- */

  const busy = new Set();
  function setBusy(name, on) {
    if (on) busy.add(name); else busy.delete(name);
    root.classList.toggle('term--busy', busy.size > 0);
    if (status) status.textContent = busy.size ? Array.from(busy).join(' + ') : CZ.t('pronto', 'ready');
  }
  if (status && !busy.size) status.textContent = CZ.t('pronto', 'ready');
  CZ.on('idioma', () => { if (status && !busy.size) status.textContent = CZ.t('pronto', 'ready'); });

  /* ---------- matrix: chuva de glifos num canvas só sobre a tela ---------- */

  const GLYPHS = '01ABCDEFGHJKLMNPRSTUVXYZ0123456789<>/{}[]=+*#$%&'.split('');
  const rain = {
    ctx: null, atlas: null, cw: 0, ch: 0, dpr: 1,
    w: 0, h: 0, cols: [], rows: 0, raf: 0, t0: 0, last: 0,
    running: false, colorsDirty: true, endTimer: 0, stopTimer: 0,
  };
  const FONT_PX = 13;
  const ROW_PX = 18;
  const COL_PX = 18;
  const SPAWN_MS = 2300;
  const END_MS = 3250;

  function readColors() {
    const cs = getComputedStyle(root);
    return { text: cs.getPropertyValue('--text').trim() || 'currentColor', accent: cs.getPropertyValue('--accent').trim() || 'currentColor' };
  }
  // Atlas com cada glifo pré-desenhado nas duas cores; no loop só há drawImage.
  function buildAtlas() {
    const { text, accent } = readColors();
    const dpr = rain.dpr;
    const cw = Math.ceil(COL_PX * dpr);
    const ch = Math.ceil(ROW_PX * dpr);
    const a = rain.atlas || document.createElement('canvas');
    a.width = cw * GLYPHS.length;
    a.height = ch * 2;
    const g = a.getContext('2d');
    g.clearRect(0, 0, a.width, a.height);
    g.font = `500 ${FONT_PX * dpr}px ${getComputedStyle(root).fontFamily}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    [text, accent].forEach((color, r) => {
      g.fillStyle = color;
      GLYPHS.forEach((c, i) => g.fillText(c, i * cw + cw / 2, r * ch + ch / 2));
    });
    rain.atlas = a;
    rain.cw = cw;
    rain.ch = ch;
    rain.colorsDirty = false;
  }
  function sizeCanvas() {
    const r = screen.getBoundingClientRect();
    rain.dpr = Math.min(2, window.devicePixelRatio || 1);
    rain.w = Math.max(1, Math.round(r.width));
    rain.h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(rain.w * rain.dpr);
    canvas.height = Math.round(rain.h * rain.dpr);
    rain.rows = Math.ceil(rain.h / ROW_PX);
    const n = Math.max(1, Math.floor(rain.w / COL_PX));
    const off = (rain.w - n * COL_PX) / 2;
    const prev = rain.cols;
    rain.cols = [];
    for (let i = 0; i < n; i++) {
      const c = prev[i] || spawn({}, true);
      c.x = off + i * COL_PX;
      rain.cols.push(c);
    }
    rain.colorsDirty = true;
  }
  function spawn(c, first) {
    c.len = 5 + Math.floor(Math.random() * 12);
    c.speed = 11 + Math.random() * 13; // linhas por segundo
    c.pos = first ? -Math.random() * 10 : -Math.random() * 6;
    c.delay = first ? Math.random() * 900 : 0;
    c.done = false;
    c.g = c.g && c.g.length >= 64 ? c.g : new Array(64);
    for (let k = 0; k < c.g.length; k++) c.g[k] = (Math.random() * GLYPHS.length) | 0;
    // Algumas colunas ficam de fora para a chuva respirar.
    c.skip = first && Math.random() < 0.3;
    // Brilho por coluna: umas mais perto, outras mais ao fundo.
    c.alpha = 0.45 + Math.random() * 0.55;
    return c;
  }
  function drawRain(t, dt) {
    const { ctx, atlas, cw, ch, dpr } = rain;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (let i = 0; i < rain.cols.length; i++) {
      const c = rain.cols[i];
      if (c.skip || c.done) continue;
      if (t < c.delay) { alive++; continue; }
      c.pos += c.speed * dt;
      const head = Math.floor(c.pos);
      if (head - c.len > rain.rows) {
        if (t < SPAWN_MS) spawn(c, false);
        else { c.done = true; continue; }
      }
      alive++;
      // Uma troca de glifo de vez em quando dá o cintilar sem custo.
      if (Math.random() < 0.35) c.g[(Math.random() * c.g.length) | 0] = (Math.random() * GLYPHS.length) | 0;
      const dx = Math.round(c.x * dpr);
      for (let k = 0; k <= c.len; k++) {
        const r = head - k;
        if (r < 0 || r >= rain.rows) continue;
        const gi = c.g[r % c.g.length];
        const f = 1 - k / (c.len + 1);
        ctx.globalAlpha = k === 0 ? c.alpha : c.alpha * 0.9 * f * f;
        ctx.drawImage(atlas, gi * cw, (k === 0 ? 0 : 1) * ch, cw, ch, dx, Math.round(r * ROW_PX * dpr), cw, ch);
      }
    }
    ctx.globalAlpha = 1;
    return alive;
  }
  function rainFrame(now) {
    rain.raf = 0;
    if (!rain.running) return;
    if (reduced()) { finishRain(); return; }
    if (rain.colorsDirty) buildAtlas();
    const t = now - rain.t0;
    const dt = Math.min(0.05, (now - rain.last) / 1000);
    rain.last = now;
    const alive = drawRain(t, dt);
    if (t >= END_MS || alive === 0) { finishRain(); return; }
    rain.raf = requestAnimationFrame(rainFrame);
  }
  function startRain() {
    if (!canvas || !canvas.getContext) return false;
    stopRain(true);
    clearTimeout(rain.stopTimer);
    rain.ctx = rain.ctx || canvas.getContext('2d');
    if (!rain.ctx) return false;
    rain.cols = [];
    sizeCanvas();
    rain.cols.forEach((c) => spawn(c, true));
    buildAtlas();
    rain.running = true;
    setBusy('matrix', true);
    root.classList.add('term--matrix');
    if (reduced()) {
      // Movimento reduzido: um único quadro parado, que some sozinho.
      for (let i = 0; i < rain.cols.length; i++) {
        const c = rain.cols[i];
        c.delay = 0;
        c.pos = 2 + Math.random() * rain.rows;
      }
      drawRain(1, 0);
      rain.endTimer = setTimeout(finishRain, 1600);
      return true;
    }
    rain.t0 = rain.last = performance.now();
    rain.raf = requestAnimationFrame(rainFrame);
    return true;
  }
  // Para a chuva; o canvas some por opacidade e só depois o buffer é liberado.
  function endRain(announce) {
    if (!rain.running) return;
    rain.running = false;
    if (rain.raf) cancelAnimationFrame(rain.raf);
    rain.raf = 0;
    clearTimeout(rain.endTimer);
    clearTimeout(rain.stopTimer);
    root.classList.remove('term--matrix');
    rain.stopTimer = setTimeout(clearRainBuffer, reduced() ? 200 : 320);
    setBusy('matrix', false);
    if (!announce) return;
    batchIndex = 0;
    print(CZ.t('de volta ao terminal.', 'back to the terminal.'), 'muted');
    trim();
    scrollEnd();
  }
  const finishRain = () => endRain(true);
  const stopRain = (silent) => endRain(!silent);
  function clearRainBuffer() {
    if (rain.running) return;
    if (rain.ctx) rain.ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  }

  /* ---------- scan: uma linha atravessa a tela uma vez ---------- */

  let scanTimer = 0;
  let scanAnims = [];
  function cancelScan() {
    clearTimeout(scanTimer);
    scanAnims.forEach((a) => a.cancel());
    scanAnims = [];
    root.classList.remove('term--scanning');
    setBusy('scan', false);
  }
  function startScan() {
    cancelScan();
    const lines = Array.from(out.children);
    const linkCount = out.querySelectorAll('a').length;
    const report = () => {
      root.classList.remove('term--scanning');
      setBusy('scan', false);
      batchIndex = 0;
      print(CZ.t('varredura concluída', 'scan complete'), 'strong');
      row(CZ.t('linhas', 'lines'), String(lines.length), 'indent');
      row('links', String(linkCount), 'indent');
      row(CZ.t('animação', 'animation'), CZ.t('só transform e opacity', 'transform and opacity only'), 'indent');
      trim();
      scrollEnd();
    };
    setBusy('scan', true);
    if (reduced() || !scanEl || typeof scanEl.animate !== 'function') { report(); return; }

    const H = screen.clientHeight;
    const band = scanEl.offsetHeight;
    const D = 1150;
    root.classList.add('term--scanning');
    scanAnims.push(scanEl.animate([
      { transform: `translateY(${-band}px)`, opacity: 0 },
      { opacity: 1, offset: 0.07 },
      { opacity: 1, offset: 0.9 },
      { transform: `translateY(${H - band}px)`, opacity: 0 },
    ], { duration: D, easing: 'linear' }));
    const top = out.scrollTop;
    const GLOW = 520;
    let end = D;
    lines.forEach((ln) => {
      const y = ln.offsetTop - top + ln.offsetHeight / 2;
      if (y < -4 || y > H + 4) return;
      const delay = Math.max(0, (y / H) * D - 60);
      try {
        scanAnims.push(ln.animate(
          [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }],
          { duration: GLOW, delay, easing: 'ease-out', pseudoElement: '::before' }
        ));
        end = Math.max(end, delay + GLOW);
      } catch (e) { /* sem suporte a pseudoElement: só a linha de varredura */ }
    });
    scanTimer = setTimeout(report, end + 40);
  }

  /* ---------- cauanzera ---------- */

  function nameNode() {
    const wrap = node('span', 'term__name');
    wrap.appendChild(node('span', 'sr', 'Cauanzera'));
    const letters = node('span', 'term__letters');
    letters.setAttribute('aria-hidden', 'true');
    'Cauanzera'.split('').forEach((ch, i) => {
      const s = node('span', '', ch);
      s.style.setProperty('--i', String(i));
      letters.appendChild(s);
    });
    wrap.appendChild(letters);
    const rule = node('span', 'term__rule');
    rule.setAttribute('aria-hidden', 'true');
    wrap.appendChild(rule);
    return wrap;
  }

  /* ---------- comandos ---------- */

  const SECOES = { inicio: 'inicio', home: 'inicio', topo: 'inicio', top: 'inicio', '~': 'inicio', '..': 'inicio', sobre: 'sobre', about: 'sobre', projetos: 'projetos', projects: 'projetos', contato: 'contato', contact: 'contato' };
  // name: o comando em português; en: como ele aparece em inglês (os dois sempre funcionam).
  const COMMANDS = [
    { name: 'help', aliases: ['ajuda', '?', 'comandos'], desc: ['lista os comandos', 'lists the commands'], run: help },
    { name: 'sobre', en: 'about', aliases: ['about', 'whoami'], desc: ['quem sou', 'who I am'], run: sobre },
    { name: 'projetos', en: 'projects', aliases: ['projects', 'ls'], desc: ['o que já construí', 'what I’ve built'], run: projetos },
    { name: 'contato', en: 'contact', aliases: ['contact', 'email', 'e-mail'], desc: ['e-mail e links', 'email and links'], run: contato },
    { name: 'cv', aliases: ['curriculo', 'resume', 'curriculum'], desc: ['baixa o currículo em PDF', 'downloads my résumé (PDF, in Portuguese)'], run: cv },
    { name: 'ir', en: 'go', aliases: ['cd', 'go', 'voar'], desc: ['voa até um capítulo: ir projetos', 'flies to a chapter: go projects'], run: ir },
    { name: 'tema', en: 'theme', aliases: ['theme'], desc: ['alterna claro e escuro', 'toggles light and dark'], run: tema },
    { name: 'som', en: 'sound', aliases: ['sound', 'audio', 'musica'], desc: ['liga ou desliga o som', 'turns the sound on or off'], run: som },
    { name: 'fonte', en: 'font', aliases: ['font', 'fontes'], desc: ['troca a fonte: fonte titulos, tudo ou nova', 'changes the font: font headings, all or new'], run: fonte },
    { name: 'movimento', en: 'motion', aliases: ['motion', 'calmo', 'animacoes'], desc: ['movimento calmo ou normal', 'calm or normal motion'], run: movimentoCmd },
    { name: 'idioma', en: 'lang', aliases: ['lang', 'language', 'lingua'], desc: ['troca o idioma: idioma en ou pt', 'switches the language: lang pt or en'], run: idiomaCmd },
    { name: 'atalhos', en: 'shortcuts', aliases: ['shortcuts', 'teclas'], desc: ['lista os atalhos; atalhos off desliga o /', 'lists the shortcuts; shortcuts off disables /'], run: atalhos },
    { name: 'limpar', en: 'clear', aliases: ['clear', 'cls'], desc: ['limpa a tela', 'clears the screen'], run: limpar },
    { name: 'sair', en: 'exit', aliases: ['exit', 'quit', 'fechar', 'q'], desc: ['fecha o terminal', 'closes the terminal'], run: sair },
  ];
  const nomeDe = (c) => CZ.t(c.name, c.en || c.name);
  const SECRETS = [
    { name: 'matrix', aliases: ['hack'], run: matrix },
    { name: 'scan', aliases: ['scanner'], run: scan },
    { name: 'warp', aliases: ['hiperespaco', 'hyperspace', 'decolar'], run: warp },
    { name: 'cauanzera', aliases: ['caua'], run: cauanzera },
    { name: 'rose', aliases: ['rosa'], hidden: true, run: rose },
  ];
  const ALL = COMMANDS.concat(SECRETS);
  // O que o Tab completa e as sugestões: os nomes do idioma atual (e uns sinônimos comuns).
  const completaveis = () => COMMANDS.map(nomeDe).concat(CZ.t(['ajuda', 'clear'], []), SECRETS.filter((x) => !x.hidden).map((x) => x.name));

  // Botão que leva a um capítulo (fecha o terminal e voa até lá).
  function botaoIr(texto, id) {
    const b = node('button', 'term__ir', texto);
    b.type = 'button';
    b.dataset.ir = id;
    return b;
  }

  function help() {
    print(CZ.t('comandos', 'commands'), 'strong');
    COMMANDS.forEach((c) => row(nomeDe(c), CZ.t(c.desc[0], c.desc[1]), 'indent'));
    print([CZ.t('segredos: ', 'secrets: '), node('span', 'term__k', 'matrix'), ', ', node('span', 'term__k', 'scan'), ', ', node('span', 'term__k', 'warp'), ', ', node('span', 'term__k', 'cauanzera')], 'muted gap');
  }
  const NOVA_ABA = () => CZ.t(' (abre em nova aba)', ' (opens in a new tab)');
  const CODIGO = () => CZ.t('código ↗', 'code ↗');
  function projetos() {
    print('Librahin', 'strong');
    print(CZ.t('Traduz Libras para texto e voz com visão computacional, tudo offline.', 'Translates Brazilian Sign Language (Libras) into text and speech with computer vision, fully offline.'), 'indent');
    print('Python, OpenCV, MediaPipe, scikit-learn', 'muted indent');
    print(fill(node('span', 'term__links'), [
      link(CODIGO(), LINKS.libCode, CZ.t('Librahin: código no GitHub', 'Librahin: code on GitHub') + NOVA_ABA()),
    ]), 'indent');
    print('EcoPontos', 'strong gap');
    print(CZ.t('Encontra pontos de coleta de lixo eletrônico em Cuiabá.', 'Finds e-waste collection points in Cuiabá.'), 'indent');
    print('HTML, CSS, JavaScript', 'muted indent');
    print(fill(node('span', 'term__links'), [
      link('site ↗', LINKS.ecoSite, 'EcoPontos: site' + NOVA_ABA()),
      link(CODIGO(), LINKS.ecoCode, CZ.t('EcoPontos: código no GitHub', 'EcoPontos: code on GitHub') + NOVA_ABA()),
    ]), 'indent');
    print('Golpe ou não?', 'strong gap');
    print(CZ.t('Ensina a reconhecer golpes por WhatsApp, SMS e ligação.', 'Teaches you to spot scams over WhatsApp, SMS and phone calls.'), 'indent');
    print('HTML, CSS, JavaScript', 'muted indent');
    print(fill(node('span', 'term__links'), [
      link('site ↗', LINKS.golpeSite, 'Golpe ou não?: site' + NOVA_ABA()),
      link(CODIGO(), LINKS.golpeCode, CZ.t('Golpe ou não?: código no GitHub', 'Golpe ou não?: code on GitHub') + NOVA_ABA()),
    ]), 'indent');
    print(CZ.t('Portfólio 2.0', 'Portfolio 2.0'), 'strong gap');
    print(CZ.t('Este site: um céu 3D que a rolagem atravessa, sem framework. Evolução do v1.', 'This site: a 3D starfield you travel through as you scroll, with no frameworks. The next step after v1.'), 'indent');
    print('HTML, CSS, JavaScript, Canvas 2D, Web Audio', 'muted indent');
    print(fill(node('span', 'term__links'), [
      link(CODIGO(), LINKS.v2Code, CZ.t('Portfólio 2.0: código no GitHub', 'Portfolio 2.0: code on GitHub') + NOVA_ABA()),
      link(CZ.t('código do v1 ↗', 'v1 code ↗'), LINKS.v1Code, CZ.t('Portfólio v1: código no GitHub', 'Portfolio v1: code on GitHub') + NOVA_ABA()),
    ]), 'indent');
    print([botaoIr(CZ.t('ver os projetos ↘', 'see the projects ↘'), 'projetos')], 'gap');
  }
  function sobre() {
    print('Cauã Pedrozo Brito', 'strong');
    print(CZ.t('Desenvolvedor front-end em formação. Aberto a oportunidades em front-end, em Cuiabá, MT, ou remoto.', 'Front-end developer in training. Open to front-end roles in Cuiabá, Brazil, or remote.'));
    print(CZ.t('Analista de TI na Casa Civil do Governo de Mato Grosso. Estuda Análise e Desenvolvimento de Sistemas na FASIPE.', 'IT Analyst at the Casa Civil (Chief of Staff’s Office) of the Mato Grosso State Government. Systems Analysis and Development student at FASIPE.'), 'muted');
    print([botaoIr(CZ.t('ler o capítulo sobre ↘', 'read the About chapter ↘'), 'sobre')], 'gap');
  }
  function contato() {
    row(CZ.t('e-mail', 'email'), link('caua.pbritto@gmail.com', LINKS.email, CZ.t('Enviar e-mail para caua.pbritto@gmail.com', 'Send an email to caua.pbritto@gmail.com')));
    row('github', link('cauapbritto ↗', LINKS.github, 'GitHub: cauapbritto' + NOVA_ABA()));
    row('linkedin', link('cauã-pedrozo-brito ↗', LINKS.linkedin, CZ.t('LinkedIn de Cauã Pedrozo Brito', 'Cauã Pedrozo Brito on LinkedIn') + NOVA_ABA()));
    row(CZ.t('currículo', 'résumé'), baixar(CZ.t('PDF ↓', 'PDF, in Portuguese ↓'), LINKS.cv, CZ.t('Baixar o currículo em PDF', 'Download résumé (PDF, in Portuguese)')));
  }
  function baixar(text, href, label) {
    const a = node('a', '', text);
    a.href = href;
    a.setAttribute('download', '');
    if (label) a.setAttribute('aria-label', label);
    return a;
  }
  function cv() {
    print([CZ.t('currículo de Cauã Pedrozo Brito: ', 'Cauã Pedrozo Brito’s résumé (in Portuguese): '), baixar(CZ.t('baixar PDF ↓', 'download PDF ↓'), LINKS.cv, CZ.t('Baixar o currículo em PDF', 'Download résumé (PDF, in Portuguese)'))]);
  }
  function ir(args) {
    const alvo = SECOES[normalize(args[0] || '')];
    if (!alvo) {
      const k = (pt, en) => node('span', 'term__k', CZ.t(pt, en));
      print([CZ.t('para onde? ', 'where to? '), k('ir inicio', 'go home'), ', ', k('ir sobre', 'go about'), ', ', k('ir projetos', 'go projects'), CZ.t(' ou ', ' or '), k('ir contato', 'go contact')], 'muted');
      return;
    }
    const DESTINOS = { inicio: ['o início', 'Home'], sobre: ['sobre', 'About'], projetos: ['projetos', 'Projects'], contato: ['contato', 'Contact'] };
    print(CZ.t(`voando até ${DESTINOS[alvo][0]}...`, `flying to ${DESTINOS[alvo][1]}...`), 'muted');
    fecharE(() => CZ.ir(alvo));
  }
  function tema() {
    const next = (CZ.tema() === 'light') ? 'dark' : 'light';
    CZ.definirTema(next);
    print(next === 'light' ? CZ.t('tema claro ativado.', 'light theme on.') : CZ.t('tema escuro ativado.', 'dark theme on.'), 'muted');
  }
  let somLigado = false;
  CZ.on('som:estado', (on) => { somLigado = on; });
  function som() {
    CZ.emit('som:alternar');
    print(somLigado ? CZ.t('som ligado. use fones para a melhor viagem.', 'sound on. put on headphones for the best trip.') : CZ.t('som desligado.', 'sound off.'), 'muted');
  }
  const FONTES = { titulos: 'titulos', titulo: 'titulos', antiga: 'titulos', headings: 'titulos', classic: 'titulos', tudo: 'tudo', all: 'tudo', nova: 'nova', new: 'nova' };
  const NOMES_FONTE = { titulos: ['antiga nos títulos', 'classic in headings'], tudo: ['antiga em tudo', 'classic everywhere'], nova: ['nova', 'new'] };
  const nomeFonte = (f) => CZ.t(NOMES_FONTE[f][0], NOMES_FONTE[f][1]);
  function fonte(args) {
    const pedido = FONTES[normalize(args[0] || '')];
    if (!pedido) {
      const k = (pt, en) => node('span', 'term__k', CZ.t(pt, en));
      print(CZ.t(`fonte atual: ${nomeFonte(CZ.fonte())}.`, `current font: ${nomeFonte(CZ.fonte())}.`), 'muted');
      print([CZ.t('opções: ', 'options: '), k('fonte titulos', 'font headings'), ', ', k('fonte tudo', 'font all'), CZ.t(' ou ', ' or '), k('fonte nova', 'font new')], 'muted');
      return;
    }
    CZ.definirFonte(pedido);
    print(CZ.t(`fonte: ${nomeFonte(pedido)}.`, `font: ${nomeFonte(pedido)}.`), 'muted');
  }
  function movimentoCmd(args, palavra) {
    let pedido = normalize(args[0] || '');
    if (palavra === 'calmo' && !pedido) pedido = 'calmo';
    if (pedido === 'calmo' || pedido === 'calm' || pedido === 'off' || pedido === 'parar') CZ.definirMovimento('calmo');
    else if (pedido === 'normal' || pedido === 'on' || pedido === 'ligar') CZ.definirMovimento('normal');
    else {
      const calmo = CZ.movimento() === 'calmo';
      const k = (pt, en) => node('span', 'term__k', CZ.t(pt, en));
      print(CZ.t(`movimento: ${CZ.movimento()}.`, `motion: ${calmo ? 'calm' : 'normal'}.`), 'muted');
      print([CZ.t('opções: ', 'options: '), k('movimento calmo', 'motion calm'), CZ.t(' ou ', ' or '), k('movimento normal', 'motion normal')], 'muted');
      return;
    }
    if (CZ.sistemaReduz && pedido !== 'calmo' && pedido !== 'calm') print(CZ.t('o sistema pede menos movimento, então o site continua calmo.', 'your system is set to reduce motion, so the site stays calm.'), 'muted');
    else print(CZ.movimento() === 'calmo' ? CZ.t('movimento calmo: nada se mexe sozinho.', 'calm motion: nothing moves on its own.') : CZ.t('céu em movimento de novo.', 'the sky is moving again.'), 'muted');
  }
  const IDIOMAS = { en: 'en', english: 'en', ingles: 'en', pt: 'pt', 'pt-br': 'pt', portugues: 'pt', portuguese: 'pt' };
  function idiomaCmd(args) {
    const pedido = IDIOMAS[normalize(args[0] || '')] || (args[0] ? '' : (CZ.idioma === 'en' ? 'pt' : 'en'));
    if (!pedido) {
      print([CZ.t('opções: ', 'options: '), node('span', 'term__k', CZ.t('idioma pt', 'lang pt')), CZ.t(' ou ', ' or '), node('span', 'term__k', CZ.t('idioma en', 'lang en'))], 'muted');
      return;
    }
    CZ.definirIdioma(pedido);
    print(pedido === 'en' ? 'language: English. the résumé stays in Portuguese.' : 'idioma: português.', 'muted');
  }
  function atalhos(args) {
    const pedido = normalize(args[0] || '');
    if (pedido === 'off' || pedido === 'desligar') { CZ.store.set('cz-atalhos', 'off'); print(CZ.t('atalho / desligado. o terminal continua no botão do topo.', 'shortcut / disabled. the terminal is still available from the button at the top.'), 'muted'); return; }
    if (pedido === 'on' || pedido === 'ligar') { CZ.store.set('cz-atalhos', 'on'); print(CZ.t('atalho / ligado.', 'shortcut / enabled.'), 'muted'); return; }
    const off = CZ.store.get('cz-atalhos') === 'off';
    print(CZ.t('atalhos', 'shortcuts'), 'strong');
    row('/', CZ.t(`abre o terminal${off ? ' (desligado)' : ''}`, `opens the terminal${off ? ' (disabled)' : ''}`), 'indent');
    row('alt+0..3', CZ.t('vai para início, sobre, projetos e contato', 'jumps to Home, About, Projects and Contact'), 'indent');
    row('← →', CZ.t('na trilha de projetos, anterior e próximo', 'previous / next project (on the projects track)'), 'indent');
    row('esc', CZ.t('fecha o terminal e o menu', 'closes the terminal and the menu'), 'indent');
    print([CZ.t('para desligar o /: ', 'to disable /: '), node('span', 'term__k', CZ.t('atalhos off', 'shortcuts off'))], 'muted gap');
  }
  function sair() {
    fechar();
  }
  function warp() {
    if (CZ.reduzido()) { print(CZ.t('o movimento reduzido está ligado; a viagem fica para outra hora.', 'reduced motion is on; the trip will have to wait.'), 'muted'); return; }
    print(CZ.t('segure firme...', 'hold on tight...'), 'muted');
    fecharE(() => CZ.emit('warp'));
  }
  function limpar() {
    stopRain(true);
    cancelScan();
    // Só some o que já estava na tela: um comando digitado logo em seguida não é apagado junto.
    const old = Array.from(out.children);
    const done = () => {
      old.forEach((n) => n.remove());
      if (!out.childElementCount) out.scrollTop = 0;
    };
    if (reduced() || !old.length) { done(); return; }
    old.forEach((n) => n.classList.add('term__line--gone'));
    setTimeout(done, 150);
  }
  function matrix() {
    print(CZ.t('entrando na matrix...', 'entering the matrix...'), 'muted');
    if (!startRain()) print(CZ.t('este navegador não desenha em canvas.', 'this browser can’t draw on canvas.'), 'muted');
  }
  function scan() {
    print(CZ.t('escaneando...', 'scanning...'), 'muted');
    startScan();
  }
  function cauanzera() {
    print(nameNode());
    print(CZ.t('Cauã Pedrozo Brito, front-end em formação.', 'Cauã Pedrozo Brito, front-end developer in training.'), 'muted');
  }
  function rose() {
    print(CZ.t('rose ficou no site antigo. as pétalas pesavam demais.', 'rose stayed on the old site. the petals were too heavy.'), 'muted');
  }

  const normalize = (v) => v.trim().replace(/^\//, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const find = (word) => ALL.find((c) => c.name === word || (c.aliases && c.aliases.includes(word)));

  function distance(a, b) {
    const m = a.length;
    const n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[m][n];
  }
  function suggest(word) {
    let best = null;
    let bestD = 3;
    completaveis().forEach((n) => {
      const dd = distance(word, n);
      if (dd < bestD) { bestD = dd; best = n; }
    });
    return word.length > 1 && bestD <= Math.max(1, Math.floor(word.length / 3)) ? best : null;
  }

  function run(raw) {
    const text = raw.trim();
    echo(text);
    if (!text) { if (rain.running) stopRain(true); trim(); scrollEnd(); return; }
    const parts = text.split(/\s+/);
    const word = normalize(parts[0]);
    const cmd = find(word);
    if (rain.running && !(cmd && cmd.name === 'matrix')) stopRain(true);
    if (cmd) {
      cmd.run(parts.slice(1), word);
    } else {
      const s = suggest(word);
      print(CZ.t(`comando não encontrado: ${text.slice(0, 40)}`, `command not found: ${text.slice(0, 40)}`));
      if (s) print([CZ.t('você quis dizer ', 'did you mean '), node('span', 'term__k', s), '?'], 'muted');
      else print([CZ.t('digite ', 'type '), node('span', 'term__k', 'help'), CZ.t(' para ver a lista.', ' to see the list.')], 'muted');
    }
    trim();
    if (cmd && cmd.name === 'limpar') return;
    scrollEnd();
  }

  /* ---------- entrada ---------- */

  const history = [];
  let hIndex = 0;
  let draft = '';

  function remember(v) {
    const t = v.trim();
    if (t && history[history.length - 1] !== t) history.push(t);
    if (history.length > 50) history.shift();
    hIndex = history.length;
    draft = '';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    remember(v);
    input.value = '';
    run(v);
  });

  function setInput(v) {
    input.value = v;
    const end = v.length;
    input.setSelectionRange(end, end);
  }

  function complete() {
    const v = normalize(input.value);
    if (!v || /\s/.test(v)) return false;
    const matches = completaveis().filter((n) => n.startsWith(v));
    if (!matches.length) return false;
    if (matches.length === 1) {
      if (matches[0] === input.value) return false; // já completo: o Tab segue para o próximo elemento
      setInput(matches[0]);
      return true;
    }
    let p = matches[0];
    matches.forEach((m) => { while (!m.startsWith(p)) p = p.slice(0, -1); });
    if (p.length > v.length) { setInput(p); return true; }
    // Primeiro Tab lista as opções; um segundo Tab sem novidade deixa o foco sair.
    const list = matches.join('   ');
    const lastLine = out.lastElementChild;
    if (lastLine && lastLine.textContent === list) return false;
    batchIndex = 0;
    print(list, 'muted');
    trim();
    scrollEnd();
    return true;
  }

  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowUp') {
      if (!history.length) return;
      e.preventDefault();
      if (hIndex === history.length) draft = input.value;
      hIndex = Math.max(0, hIndex - 1);
      setInput(history[hIndex]);
    } else if (e.key === 'ArrowDown') {
      if (hIndex >= history.length) return;
      e.preventDefault();
      hIndex = Math.min(history.length, hIndex + 1);
      setInput(hIndex === history.length ? draft : history[hIndex]);
    } else if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      // Só segura o Tab quando há o que completar; senão o foco segue normalmente.
      if (complete()) e.preventDefault();
    } else if (e.key === 'Escape') {
      if (!input.value) return;
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      hIndex = history.length;
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd) {
      if (!busy.size && !input.value) return;
      e.preventDefault();
      echo(`${input.value}^C`);
      input.value = '';
      if (busy.has('scan')) { cancelScan(); print(CZ.t('varredura interrompida.', 'scan interrupted.'), 'muted'); }
      if (rain.running) stopRain(false);
      trim();
      scrollEnd();
    }
  });

  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cmd]');
    if (chip && root.contains(chip)) {
      remember(chip.dataset.cmd);
      run(chip.dataset.cmd);
      return;
    }
    const irBtn = e.target.closest('.term__ir');
    if (irBtn && root.contains(irBtn)) {
      e.preventDefault();
      e.stopPropagation();
      const id = irBtn.dataset.ir;
      fecharE(() => CZ.ir(id));
      return;
    }
    if (e.target.closest('[data-term-fechar]')) { fechar(); return; }
    // Clique de mouse na tela leva o foco ao input (sem roubar seleção de texto nem links).
    if (e.target.closest('a, button, input')) return;
    if (!e.target.closest('.term__screen, .term__bar')) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    if (lastPointer === 'mouse') input.focus({ preventScroll: true });
  });
  let lastPointer = 'mouse';
  root.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; }, { passive: true });

  /* ---------- ciclo de vida dos efeitos ---------- */

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { if (rain.running && !reduced()) sizeCanvas(); }).observe(screen);
  }
  new MutationObserver(() => { rain.colorsDirty = true; if (rain.running && reduced()) { buildAtlas(); drawRain(1, 0); } })
    .observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  const onScheme = () => { rain.colorsDirty = true; };
  if (mqLight.addEventListener) mqLight.addEventListener('change', onScheme);

  // Fora da tela ou com a aba escondida, o efeito termina na hora: nada roda em segundo plano.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (!en.isIntersecting && rain.running) stopRain(false); });
    }).observe(root);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && rain.running) stopRain(false);
  });

  /* ---------- abrir e fechar (diálogo modal) ---------- */

  const win = root.querySelector('.term__win');
  let aberto = false;
  let quemAbriu = null;
  let fecharTimer = 0;
  let depois = null;

  function abrir(origem) {
    clearTimeout(fecharTimer);
    if (aberto) { input.focus({ preventScroll: true }); return; }
    aberto = true;
    quemAbriu = origem || document.activeElement;
    root.hidden = false;
    html.classList.add('term-aberto');
    void root.offsetWidth;
    root.classList.add('is-aberto');
    input.focus({ preventScroll: true });
    scrollEnd();
    CZ.emit('som:efeito', 'abrir');
  }
  function fechar() {
    if (!aberto) return;
    aberto = false;
    stopRain(true);
    cancelScan();
    root.classList.remove('is-aberto');
    html.classList.remove('term-aberto');
    const alvo = quemAbriu;
    quemAbriu = null;
    const fim = () => {
      root.hidden = true;
      const fn = depois;
      depois = null;
      if (fn) fn();
      else if (alvo && typeof alvo.focus === 'function' && document.contains(alvo)) alvo.focus({ preventScroll: true });
    };
    if (reduced()) fim();
    else fecharTimer = setTimeout(fim, 240);
    CZ.emit('som:efeito', 'fechar');
  }
  // Fecha e, quando a janela sumir, executa a ação (voar até um capítulo, hiperespaço).
  function fecharE(fn) {
    depois = fn;
    setTimeout(fechar, reduced() ? 0 : 380);
  }

  CZ.on('terminal:abrir', abrir);

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      fechar();
      return;
    }
    if (e.key !== 'Tab') return;
    // Foco preso no diálogo enquanto ele está aberto.
    const foco = Array.from(win.querySelectorAll('a[href], button:not([disabled]), input, [tabindex="0"]')).filter((el) => el.offsetParent !== null || el === input);
    if (!foco.length) return;
    const primeiro = foco[0];
    const ultimo = foco[foco.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  });

  root.classList.add('term--js');
})();
