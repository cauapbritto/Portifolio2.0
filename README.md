# Portfólio 2.0

Nova versão do portfólio de Cauã Pedrozo Brito (Cauanzera). A versão anterior continua no repositório [portif-lio](https://github.com/cauapbritto/portif-lio).

O site é uma viagem só, em tela cheia: um céu de estrelas em 3D fica atrás da página inteira e a rolagem leva a câmera adiante. Rolar rápido estica as estrelas em rastros, o cursor liga as estrelas em constelações e a interface fica por cima, como o visor de uma nave.

## O percurso

| Capítulo | O que acontece |
| --- | --- |
| Abertura | Um contador curto liga o sistema; a tela se abre ao meio e as estrelas chegam como quem sai do hiperespaço. |
| 00 · Início | O nome Cauanzera no meio do céu e a borda de um planeta embaixo. Ao rolar, a câmera decola e o planeta fica para trás. |
| 01 · Sobre | O texto fica preso na tela e acende palavra por palavra conforme a rolagem; no fim entram curso, foco, ferramentas e o que está em andamento. |
| 02 · Projetos | Em tela larga, a rolagem vertical atravessa uma trilha horizontal: Librahin (com a mão em constelação, como o programa enxerga), EcoPontos e o Portfólio v1. O print acompanha o cursor com luz e inclinação. |
| 03 · Contato | E-mail com botão magnético que copia o endereço, GitHub, LinkedIn e o caminho de volta ao início. |

Sempre na tela:

- **Menu em meio-arco** (embaixo, no centro): Sobre, Projetos, Contato, Som e Tema.
- **Trilho de capítulos** (à direita): mostra onde você está e leva a qualquer capítulo.
- **Terminal** (botão no topo ou tecla `/`): `help`, `sobre`, `projetos`, `contato`, `ir <capítulo>`, `tema`, `som`, `limpar` e `sair`, e os segredos `matrix`, `scan`, `warp` e `cauanzera`.
- **Som** (desligado no começo): um ambiente grave gerado na hora com Web Audio, um vento que cresce com a velocidade da rolagem e cliques curtos na interface.
- **Fonte** (botão "Aa" no topo ou comando `fonte` no terminal): antiga nos títulos, antiga em tudo ou nova. Veja [Fontes](#fontes).
- **Atalhos**: `/` abre o terminal, `0` a `3` levam aos capítulos, `Esc` fecha o terminal e o menu.

## Como abrir

Abra o `index.html` no navegador. Para testar como num servidor:

```sh
python3 -m http.server
```

Depois acesse http://localhost:8000.

## Como editar

- `src/pagina.html` é o esqueleto da página. Cada `<!-- @nome -->` vira a parte `src/partes/<nome>/`.
- Cada parte fica em `src/partes/<nome>/`, com até três arquivos:
  - `part.html` tem a marcação;
  - `style.css` tem os estilos, prefixados com o nome da parte;
  - `script.js` tem o comportamento, isolado numa função.
- `src/base/tokens.css` tem cores, fontes e tempos de animação, com tema escuro e claro.
- `src/base/base.css` tem o reset e as utilidades (título de capítulo, entrada ao aparecer na tela).
- `src/base/nucleo.js` liga as partes: eventos, troca de tema, viagem entre capítulos e acompanhamento da rolagem.

| Parte | O que faz |
| --- | --- |
| `universo` | O céu fixo: estrelas em 3D, rastros com a velocidade, constelação no cursor e hiperespaço. |
| `abertura` | Contador e tela que se abre ao meio. |
| `hud` | Marca, botão do terminal, trilho de capítulos, setor atual, tempo de viagem e hora. |
| `cursor` | Ponto e anel que seguem o mouse e mostram o que um clique faz. |
| `inicio`, `sobre`, `projetos`, `contato` | Os capítulos. |
| `arco` | Menu em meio-arco. |
| `terminal` | Terminal em janela, com comandos e segredos. |
| `som` | Som ambiente e efeitos (Web Audio). |

Depois de editar, gere a página de novo com Node.js:

```sh
node build.js
```

Esse comando reescreve o `index.html`, que junta tudo num arquivo só, pronto para o GitHub Pages.

## Fontes

O botão "Aa" no topo (ou `fonte titulos`, `fonte tudo` e `fonte nova` no terminal) troca a fonte:

- **Antiga nos títulos** (padrão): Zero Hour, a fonte do site antigo, nos títulos, nomes de projeto, botões e rótulos, e Schibsted Grotesk no texto corrido.
- **Antiga em tudo**: Zero Hour também no texto corrido, como no site antigo.
- **Nova**: Schibsted Grotesk e Martian Mono.

A escolha fica salva no navegador. As partes usam fontes por papel, definidas em `src/base/tokens.css`:

| Papel | Uso |
| --- | --- |
| `--font-head` | títulos, nomes de projeto, botões |
| `--font-text` | texto corrido e o e-mail |
| `--font-label` | rótulos pequenos, tags, chips e o trilho de capítulos |
| `--font-code` | o terminal e os números que mudam (relógio, contadores), que precisam de largura fixa |
| `--font-display` | o nome Cauanzera (sempre Zero Hour) |

Na Zero Hour o "1" é o mesmo traço do "I": nos rótulos, o número ganha `<span class="um">1</span>`, que desenha uma bandeirinha no topo. Palavras com hífen ficam em `<span class="nobr">` para não quebrar no meio.

## Desempenho e acessibilidade

- O céu é um único canvas 2D e para quando a aba fica escondida. As outras animações usam só `transform` e `opacity`.
- Quem ativa "reduzir movimento" no sistema vê o céu parado, sem abertura nem rastros, e os capítulos empilhados.
- Sem JavaScript, todo o conteúdo aparece em ordem e o trilho de capítulos continua funcionando.
- Tudo funciona pelo teclado, com foco visível. O terminal é um diálogo que segura o foco e devolve ao fechar.
- O tema, a fonte e o som escolhidos ficam salvos no navegador.

## Créditos

- Fonte Zero Hour, de Raymond Larabie, em domínio público (CC0).
- Schibsted Grotesk e Martian Mono, do Google Fonts (SIL Open Font License).
