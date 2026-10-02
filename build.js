// Monta a página: node build.js
// Junta src/tokens.css, src/frame.css e cada componente de src/components/<id>/ num único index.html.
// Os componentes aparecem na ordem de src/meta.json.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const meta = JSON.parse(fs.readFileSync(path.join(SRC, 'meta.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// texto da moldura: palavras com hifen nao quebram no meio (so nos modos Zero Hour, ver frame.css)
const prose = (s) => esc(s).replace(/\b(e-mail|meio-arco|front-end)\b/gi, '<span class="g-nobr">$1</span>');
// numero da secao: o "1" ganha um span para a bandeirinha da Zero Hour (frame.css .g-one).
// Quem usa num()/prose() dentro de um flex embrulha o resultado num span, senao cada pedaco vira um item com gap.
const num = (n) => n.replace(/1/g, '<span class="g-one">1</span>');

const tokens = fs.readFileSync(path.join(SRC, 'tokens.css'), 'utf8').trim();
const frameCss = fs.readFileSync(path.join(SRC, 'frame.css'), 'utf8').trim();

const comps = meta.components.map((c, i) => {
  const dir = path.join(SRC, 'components', c.id);
  const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8').trim();
  return { ...c, n: String(i + 1).padStart(2, '0'), html: read('part.html'), css: read('style.css'), js: read('script.js') };
});

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.lede)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400;500&family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
@font-face { font-family: "Zero Hour"; src: url("assets/ZeroHour.woff2") format("woff2"); font-display: swap; font-weight: 100 900; }
/* Fonte antiga em dois tamanhos (mesmo arquivo, menor): titulos/rotulos/botoes e texto corrido. Ver src/tokens.css.
   font-weight 100 900: a Zero Hour so tem um peso; assim o navegador nao inventa um negrito falso.
   Sem o "~" (U+007E): o til da Zero Hour e um traco reto; ele cai na fonte seguinte da pilha. */
@font-face { font-family: "Zero Hour UI"; src: url("assets/ZeroHour.woff2") format("woff2"); font-display: swap; size-adjust: 86%; font-weight: 100 900; unicode-range: U+0000-007D, U+007F-10FFFF; }
@font-face { font-family: "Zero Hour Texto"; src: url("assets/ZeroHour.woff2") format("woff2"); font-display: swap; size-adjust: 80%; font-weight: 100 900; unicode-range: U+0000-007D, U+007F-10FFFF; }
${tokens}
${frameCss}
</style>
${comps.map(c => `<style>/* ${c.id} */\n${c.css}\n</style>`).join('\n')}
<script>
/* fonte escolhida: "titulos" por padrao; lembrada so neste navegador */
(() => { let f = "titulos"; try { const v = localStorage.getItem("g-font"); if (v === "titulos" || v === "tudo" || v === "nova") f = v; } catch (e) {} if (f !== "nova") document.documentElement.dataset.font = f; })();
</script>
</head>
<body>
<div class="g-progress" aria-hidden="true"></div>
<a class="g-skip" href="#g-lista">Pular para os componentes</a>

<header class="g-head">
  <p class="fx-label g-kicker"><span class="g-square" aria-hidden="true"></span>${esc(meta.kicker)}</p>
  <h1 class="g-title">${esc(meta.title)}</h1>
  <p class="g-lede">${prose(meta.lede)}</p>
  <div class="g-font" role="group" aria-labelledby="g-font-t">
    <span class="fx-label" id="g-font-t">Fonte</span>
    <div class="g-font__opts">
      <button type="button" class="g-font__opt g-font__opt--zh" data-font-set="titulos" aria-pressed="false">Antiga nos títulos</button>
      <button type="button" class="g-font__opt g-font__opt--zh" data-font-set="tudo" aria-pressed="false">Antiga em tudo</button>
      <button type="button" class="g-font__opt g-font__opt--nova" data-font-set="nova" aria-pressed="false">Nova</button>
    </div>
  </div>
  <nav class="g-index" aria-label="Componentes">
    <ol>
${comps.map(c => `      <li><a href="#g-${c.id}"><span class="g-index__n">${num(c.n)}</span><span>${prose(c.name)}</span></a></li>`).join('\n')}
    </ol>
  </nav>
</header>

<main id="g-lista" class="g-main">
${comps.map(c => `  <section class="g-sec" id="g-${c.id}" aria-labelledby="g-${c.id}-t">
    <div class="g-sec__head">
      <p class="fx-label g-sec__n"><span class="g-square" aria-hidden="true"></span><span>${num(c.n)}</span></p>
      <h2 class="g-sec__t" id="g-${c.id}-t">${prose(c.name)}</h2>
      <p class="g-sec__d">${prose(c.desc)}</p>
      <p class="g-sec__old"><span class="fx-label">No site antigo</span> ${prose(c.old)}</p>
    </div>
    <div class="g-demo">
${c.html}
    </div>
  </section>`).join('\n\n')}
</main>

<footer class="g-foot">
  <p>${prose(meta.footer)}</p>
</footer>

<script>
/* troca de fonte da galeria */
(() => {
  const root = document.documentElement;
  const opts = [...document.querySelectorAll(".g-font__opt")];
  const sync = () => { const cur = root.dataset.font || "nova"; opts.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.fontSet === cur))); };
  opts.forEach(b => b.addEventListener("click", () => {
    const f = b.dataset.fontSet;
    if (f === "nova") delete root.dataset.font; else root.dataset.font = f;
    try { localStorage.setItem("g-font", f); } catch (e) {}
    sync();
  }));
  sync();
})();
</script>
${comps.map(c => `<script>/* ${c.id} */\n${c.js}\n</script>`).join('\n')}
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('index.html gerado:', (Buffer.byteLength(html) / 1024).toFixed(0), 'KB,', comps.length, 'componentes');
