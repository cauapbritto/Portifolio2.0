// Monta a página: node build.js
// Junta src/tokens.css, src/frame.css e cada componente de src/components/<id>/ num único index.html.
// Os componentes aparecem na ordem de src/meta.json.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const meta = JSON.parse(fs.readFileSync(path.join(SRC, 'meta.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
@font-face { font-family: "Zero Hour"; src: url("assets/ZeroHour.woff2") format("woff2"); font-display: swap; }
${tokens}
${frameCss}
</style>
${comps.map(c => `<style>/* ${c.id} */\n${c.css}\n</style>`).join('\n')}
</head>
<body>
<div class="g-progress" aria-hidden="true"></div>
<a class="g-skip" href="#g-lista">Pular para os componentes</a>

<header class="g-head">
  <p class="fx-label g-kicker"><span class="g-square" aria-hidden="true"></span>${esc(meta.kicker)}</p>
  <h1 class="g-title">${esc(meta.title)}</h1>
  <p class="g-lede">${esc(meta.lede)}</p>
  <nav class="g-index" aria-label="Componentes">
    <ol>
${comps.map(c => `      <li><a href="#g-${c.id}"><span class="g-index__n">${c.n}</span>${esc(c.name)}</a></li>`).join('\n')}
    </ol>
  </nav>
</header>

<main id="g-lista" class="g-main">
${comps.map(c => `  <section class="g-sec" id="g-${c.id}" aria-labelledby="g-${c.id}-t">
    <div class="g-sec__head">
      <p class="fx-label g-sec__n"><span class="g-square" aria-hidden="true"></span>${c.n}</p>
      <h2 class="g-sec__t" id="g-${c.id}-t">${esc(c.name)}</h2>
      <p class="g-sec__d">${esc(c.desc)}</p>
      <p class="g-sec__old"><span class="fx-label">No site antigo</span> ${esc(c.old)}</p>
    </div>
    <div class="g-demo">
${c.html}
    </div>
  </section>`).join('\n\n')}
</main>

<footer class="g-foot">
  <p>${esc(meta.footer)}</p>
</footer>

${comps.map(c => `<script>/* ${c.id} */\n${c.js}\n</script>`).join('\n')}
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('index.html gerado:', (Buffer.byteLength(html) / 1024).toFixed(0), 'KB,', comps.length, 'componentes');
