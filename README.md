# Portfólio 2.0

Portfólio de Cauã Pedrozo Brito (Cauanzera), desenvolvedor front-end em formação em Cuiabá, MT. No ar em [cauabrito.com.br](https://cauabrito.com.br). A versão anterior continua no repositório [portif-lio](https://github.com/cauapbritto/portif-lio).

O site é uma viagem só, em tela cheia: um céu de estrelas em 3D fica atrás da página inteira e a rolagem leva a câmera adiante. Rolar rápido estica as estrelas em rastros, o cursor liga as estrelas em constelações e a interface fica por cima, como o visor de uma nave. Tem versão em português e em inglês.

## O percurso

| Capítulo | O que acontece |
| --- | --- |
| Abertura | Um contador curto liga o sistema; a tela se abre ao meio e as estrelas chegam como quem sai do hiperespaço. Quem volta em até 7 dias vê uma abertura mais curta, e qualquer clique ou tecla pula. |
| 00 · Início | O nome Cauanzera e o nome real no meio do céu, com a borda de um planeta embaixo. Ao rolar, a câmera decola e o planeta fica para trás. |
| 01 · Sobre | O texto fica preso na tela e acende palavra por palavra conforme a rolagem. |
| 02 · Projetos | Em tela larga, a rolagem vertical atravessa uma trilha horizontal: Librahin, EcoPontos e este portfólio, cada um em poucas linhas. Setas, teclado (← →) e o trackpad também andam pela trilha. |
| 03 · Contato | E-mail (link e botão que copia o endereço), currículo em PDF, GitHub, LinkedIn e o caminho de volta ao início. |

Sempre na tela:

- **Topo**: `EN`/`PT` troca o idioma, Currículo baixa o PDF, Ajustes escolhe a fonte e o movimento, e Terminal abre o terminal.
- **Menu em meio-arco** (embaixo, no centro): Sobre, Projetos, Contato, Som e Tema.
- **Trilho de capítulos** (à direita): mostra onde você está e leva a qualquer capítulo; o nome aparece ao passar o mouse ou no foco.
- **Terminal** (botão no topo ou tecla `/`): `help`, `sobre`, `projetos`, `contato`, `cv`, `ir <capítulo>`, `tema`, `som`, `fonte`, `movimento`, `idioma`, `atalhos`, `limpar` e `sair`, e os segredos `matrix`, `scan`, `warp` e `cauanzera`. Em inglês os mesmos comandos aparecem como `about`, `projects`, `go`, `lang` etc.; os dois nomes sempre funcionam.
- **Som** (desligado no começo): um ambiente grave gerado na hora com Web Audio, um vento que cresce com a velocidade da rolagem e cliques curtos na interface.
- **Atalhos**: `/` abre o terminal (`atalhos off` no terminal desliga), `Alt+0` a `Alt+3` levam aos capítulos, `Esc` fecha o terminal e o menu.

## Como abrir

Abra o `index.html` no navegador. Para testar como num servidor:

```sh
python3 -m http.server
```

Depois acesse http://localhost:8000 (ou http://localhost:8000/en.html para ver em inglês).

## Como editar

- `src/pagina.html` é o esqueleto da página. Cada `<!-- @nome -->` vira a parte `src/partes/<nome>/`.
- Cada parte fica em `src/partes/<nome>/`, com até três arquivos:
  - `part.html` tem a marcação;
  - `style.css` tem os estilos, prefixados com o nome da parte;
  - `script.js` tem o comportamento, isolado numa função.
- `src/base/tokens.css` tem cores, fontes e tempos de animação, com tema escuro e claro.
- `src/base/base.css` tem o reset, as utilidades (título de capítulo, entrada ao aparecer na tela) e o estilo de impressão.
- `src/base/nucleo.js` liga as partes: eventos, tema, fonte, movimento, idioma, viagem entre capítulos e acompanhamento da rolagem.

| Parte | O que faz |
| --- | --- |
| `universo` | O céu fixo: estrelas em 3D, rastros com a velocidade, constelação no cursor e hiperespaço. |
| `abertura` | Contador e tela que se abre ao meio. |
| `hud` | Marca, idioma, currículo, ajustes, terminal, trilho de capítulos, setor atual, tempo de viagem e hora. |
| `cursor` | Anel que acompanha o mouse e diz o que um clique faz (o cursor do sistema continua visível). |
| `inicio`, `sobre`, `projetos`, `contato` | Os capítulos. |
| `arco` | Menu em meio-arco. |
| `terminal` | Terminal em janela, com comandos e segredos. |
| `som` | Som ambiente e efeitos (Web Audio). |

Depois de editar, gere a página de novo com Node.js:

```sh
node build.js
```

Esse comando reescreve o `index.html`, que junta tudo num arquivo só, pronto para o GitHub Pages, e o `en.html`, a versão em inglês (a mesma página, com o `<head>` já em inglês).

## Idiomas

O português é o padrão, em `cauabrito.com.br`. A versão em inglês fica em `cauabrito.com.br/en.html` e também aparece quando a pessoa escolhe `EN` no topo (ou `idioma en` no terminal), ou quando o navegador não tem português entre os idiomas preferidos. A escolha fica salva no navegador e o endereço acompanha a troca, para quem copiar o link ver o mesmo idioma. O currículo em PDF continua em português.

O `en.html` é gerado pelo `build.js`: título, descrição, canonical e as tags de compartilhamento (`og:*`) já vêm em inglês, porque buscadores e prévias de link (LinkedIn, WhatsApp) não rodam JavaScript. O português desses campos fica em `data-pt` e `data-pt-*`, para o botão PT voltar.

O texto em inglês fica no próprio HTML, ao lado do português:

- `data-en="..."` troca o conteúdo do elemento (pode ter marcação, como `<span class="nobr">`; use aspas simples por fora quando houver aspas duplas dentro, e o apóstrofo tipográfico `’` no texto);
- `data-en-aria-label`, `data-en-alt`, `data-en-title`, `data-en-placeholder`, `data-en-content`, `data-en-href`, `data-en-hreflang`, `data-en-lang` e `data-en-data-cmd` trocam o atributo de mesmo nome;
- `data-en-nome` nos capítulos dá o nome usado no HUD;
- textos montados por script usam `CZ.t('português', 'English')`, e quem precisa refazer algo escuta o evento `idioma`.

## Fontes

Ajustes, no topo (ou `fonte titulos`, `fonte tudo` e `fonte nova` no terminal), troca a fonte:

- **Antiga nos títulos** (padrão): Zero Hour, a fonte do site antigo, nos títulos, nomes de projeto, botões e rótulos, e Schibsted Grotesk no texto corrido.
- **Antiga em tudo**: Zero Hour também no texto corrido, como no site antigo.
- **Nova**: Schibsted Grotesk e Martian Mono.

As três ficam em `assets/fontes/`, servidas pelo próprio site: não dependem de outro servidor nem mandam o IP de quem visita para terceiros. O nome real (Cauã Pedrozo Brito) fica sempre em Schibsted Grotesk, legível em qualquer modo. As partes usam fontes por papel, definidas em `src/base/tokens.css`:

| Papel | Uso |
| --- | --- |
| `--font-head` | títulos, nomes de projeto, botões |
| `--font-text` | texto corrido e o e-mail |
| `--font-label` | rótulos pequenos, tags, chips e o trilho de capítulos |
| `--font-code` | o terminal e os números que mudam (relógio, contadores), que precisam de largura fixa |
| `--font-display` | o nome Cauanzera (sempre Zero Hour) |
| `--font-nome` | o nome real, no início (sempre Schibsted Grotesk) |

Na Zero Hour o "1" é o mesmo traço do "I": nos rótulos, o número ganha `<span class="um">1</span>`, que desenha uma bandeirinha no topo. Palavras com hífen ficam em `<span class="nobr">` para não quebrar no meio.

## Desempenho e acessibilidade

- O céu é um único canvas 2D: para quando a aba fica escondida e desacelera para cerca de 20 quadros por segundo quando a página está parada, para economizar bateria. As outras animações usam só `transform` e `opacity`.
- **Movimento calmo**, em Ajustes (ou `movimento calmo` no terminal): céu parado, sem abertura nem rastros, e os capítulos empilhados. É o que acontece também para quem ativa "reduzir movimento" no sistema.
- Sem JavaScript, todo o conteúdo aparece em ordem e o trilho de capítulos continua funcionando.
- Tudo funciona pelo teclado, com foco visível. O terminal é um diálogo que segura o foco e devolve ao fechar.
- Na impressão (ou "Salvar como PDF"), o site vira um documento limpo, em fundo branco, com os endereços dos links escritos.
- O tema, a fonte, o movimento, o idioma e o som escolhidos ficam salvos no navegador.

## Domínio

O arquivo `CNAME` aponta o GitHub Pages para `cauabrito.com.br`. A imagem de compartilhamento (`assets/og.jpg`), o `sitemap.xml` (com as duas versões de idioma) e o `robots.txt` usam esse endereço.

## Créditos

- Fonte Zero Hour, de Raymond Larabie, em domínio público (CC0).
- Schibsted Grotesk e Martian Mono, do Google Fonts (SIL Open Font License).
