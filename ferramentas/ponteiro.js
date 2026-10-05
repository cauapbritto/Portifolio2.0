// Gera o ponteiro do site (assets/cursor/*.png): node ferramentas/ponteiro.js
// Desenho "Delta": um dardo só com arestas a 0, 45 e 90 graus, como as letras da Zero Hour.
// Cada pixel é decidido pela geometria (sem suavização), em 1x (32 px) e 2x (64 px).
// Ponto de clique: 2 2 (a ponta), igual nos dois estados.
//   seta: casco escuro, borda clara e borda da cauda em laranja.
//   mao (sobre links e botões): o mesmo dardo todo em laranja, "aceso".
// Os dois têm um contorno escuro por fora: some no fundo escuro e desenha a forma no tema claro e sobre o laranja.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const COR = {
  casco: [0x1B, 0x1D, 0x21, 255],   // --surface-2
  claro: [0xF4, 0xF2, 0xEC, 255],   // borda da seta
  laranja: [0xFF, 0x7A, 0x45, 255], // --accent
  halo: { seta: [0x08, 0x09, 0x0B, 128], mao: [0x0D, 0x0E, 0x10, 200] }, // contorno de fora (50% e 78%)
};

// Geometria em unidades de 1x; s = escala (1 ou 2). Centro do pixel: (x + .5, y + .5).
// Silhueta: x >= 2, abaixo da diagonal y = x e acima da cauda (y = 15 à direita, y = 22 - x no entalhe).
// Casco: 1 px para dentro nas arestas retas e um pouco mais na diagonal, para a borda diagonal
// ser uma escada de pixels que se tocam pelo lado (sem parecer pontilhada).
function desenhar(s, estado) {
  const n = 32 * s;
  const px = new Uint8Array(n * n * 4);
  const dentro = (x, y, a) => {
    const X = (x + 0.5) / s, Y = (y + 0.5) / s;
    return X >= 2 + a.esq && Y >= X + a.diag && Y <= Math.max(15 - a.base, 22 - a.entalhe - X);
  };
  const silhueta = { esq: 0, diag: 0, base: 0, entalhe: 0 };
  const casco = { esq: 1, diag: s === 1 ? 2 : 1.5, base: 1, entalhe: s === 1 ? 2 : 1.5 };
  const pinta = (x, y, c) => px.set(c, (y * n + x) * 4);
  const naSilhueta = (x, y) => x >= 0 && y >= 0 && x < n && y < n && dentro(x, y, silhueta);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (naSilhueta(x, y)) {
        const noCasco = dentro(x, y, casco);
        const X = (x + 0.5) / s, Y = (y + 0.5) / s;
        const bordaEsq = X < 3;                  // coluna da esquerda, com a ponta
        const bordaDiag = !bordaEsq && Y < X + casco.diag;
        const bordaCauda = !noCasco && !bordaEsq && !bordaDiag;
        if (estado === 'seta') pinta(x, y, noCasco ? COR.casco : bordaCauda ? COR.laranja : COR.claro);
        else pinta(x, y, COR.laranja);
      } else {
        // contorno de fora: pixels vizinhos (pelos lados) da silhueta, com 1 px de largura em 1x
        const r = s;
        let perto = false;
        for (let d = 1; d <= r && !perto; d++) {
          perto = naSilhueta(x - d, y) || naSilhueta(x + d, y) || naSilhueta(x, y - d) || naSilhueta(x, y + d) ||
            (d > 1 && (naSilhueta(x - 1, y - 1) || naSilhueta(x + 1, y - 1) || naSilhueta(x - 1, y + 1) || naSilhueta(x + 1, y + 1)));
        }
        if (perto) pinta(x, y, COR.halo[estado]);
      }
    }
  }
  return { n, px };
}

// PNG mínimo (RGBA, 8 bits), sem dependências.
const TABELA = Array.from({ length: 256 }, (_, i) => { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = TABELA[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function bloco(tipo, dados) {
  const t = Buffer.from(tipo, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
}
function png({ n, px }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  const linhas = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) Buffer.from(px.buffer, y * n * 4, n * 4).copy(linhas, y * (n * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(linhas, { level: 9 })), bloco('IEND', Buffer.alloc(0))]);
}

const DESTINO = path.join(__dirname, '..', 'assets', 'cursor');
fs.mkdirSync(DESTINO, { recursive: true });
for (const estado of ['seta', 'mao']) {
  fs.writeFileSync(path.join(DESTINO, `${estado}.png`), png(desenhar(1, estado)));
  fs.writeFileSync(path.join(DESTINO, `${estado}@2x.png`), png(desenhar(2, estado)));
}
console.log('assets/cursor: seta.png, seta@2x.png, mao.png, mao@2x.png');
