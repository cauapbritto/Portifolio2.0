// Monta a página: node build.js
// Lê src/pagina.html e troca os marcadores:
//   <!-- @css -->   tokens, base e o style.css de cada parte (na ordem de PARTES)
//   <!-- @nome -->  o part.html da parte src/partes/<nome>/
//   <!-- @js -->    o núcleo e o script.js de cada parte (na ordem de PARTES)
// O resultado é um index.html único, pronto para o GitHub Pages.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

// Ordem dos estilos e scripts. O núcleo (src/base/nucleo.js) sempre vem primeiro.
const PARTES = ['universo', 'som', 'abertura', 'hud', 'cursor', 'inicio', 'sobre', 'projetos', 'contato', 'arco', 'terminal'];

const ler = (...p) => {
  const f = path.join(...p);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '';
};

const partes = PARTES.map((nome) => {
  const dir = path.join(SRC, 'partes', nome);
  if (!fs.existsSync(dir)) throw new Error(`Parte não encontrada: src/partes/${nome}`);
  return { nome, html: ler(dir, 'part.html'), css: ler(dir, 'style.css'), js: ler(dir, 'script.js') };
});

const css = [
  `<style>\n${ler(SRC, 'base', 'tokens.css')}\n${ler(SRC, 'base', 'base.css')}\n</style>`,
  ...partes.filter((p) => p.css).map((p) => `<style>/* ${p.nome} */\n${p.css}\n</style>`),
].join('\n');

const js = [
  `<script>/* núcleo */\n${ler(SRC, 'base', 'nucleo.js')}\n</script>`,
  ...partes.filter((p) => p.js).map((p) => `<script>/* ${p.nome} */\n${p.js}\n</script>`),
  '<script>CZ.pronto();</script>',
].join('\n');

let html = ler(SRC, 'pagina.html');
html = html.replace('<!-- @css -->', () => css).replace('<!-- @js -->', () => js);
const usados = new Set();
html = html.replace(/<!-- @([a-z]+) -->/g, (m, nome) => {
  const p = partes.find((x) => x.nome === nome);
  if (!p) throw new Error(`Marcador sem parte: ${m}`);
  usados.add(nome);
  return p.html;
});
partes.forEach((p) => {
  if (p.html && !usados.has(p.nome)) throw new Error(`A parte ${p.nome} tem part.html mas não tem marcador em src/pagina.html`);
});

fs.writeFileSync(path.join(ROOT, 'index.html'), `${html}\n`);
console.log('index.html gerado:', (Buffer.byteLength(html) / 1024).toFixed(0), 'KB,', partes.length, 'partes');
