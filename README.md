# Portfólio 2.0

Nova versão do portfólio de Cauã Pedrozo Brito (Cauanzera). A versão anterior continua no repositório [portif-lio](https://github.com/cauapbritto/portif-lio).

Por enquanto este repositório tem a galeria de componentes do visual novo: os efeitos do site antigo refeitos com um visual mais limpo e mais leve. Ela é a base para montar a página do portfólio.

## Como abrir

Abra o `index.html` no navegador. Para testar como num servidor:

```sh
python3 -m http.server
```

Depois acesse http://localhost:8000.

## Como editar

- Cada componente fica em `src/components/<id>/`:
  - `part.html` tem a marcação;
  - `style.css` tem os estilos, sempre prefixados com `.fx-<id>`;
  - `script.js` tem o comportamento, isolado numa função.
- Cores, fontes e tempos de animação ficam em `src/tokens.css`, com tema escuro e claro.
- Os títulos e textos de cada seção da galeria ficam em `src/meta.json`.
- O cabeçalho, as seções e o rodapé da galeria ficam em `src/frame.css`.

Depois de editar, gere a página de novo com Node.js:

```sh
node build.js
```

Esse comando reescreve o `index.html`.

## Componentes

| Pasta | Componente | O que faz |
| --- | --- | --- |
| `ceu` | Céu do hero | Estrelas em canvas que se ligam em constelação perto do cursor, com a entrada do nome Cauanzera. |
| `tema` | Troca de tema | A lua vira sol e o tema novo cresce num círculo a partir do botão. |
| `card` | Card de projeto | Uma luz segue o cursor, o card inclina de leve e o print desliza dentro da moldura. |
| `flip` | Card que vira | O card gira em 3D e mostra no verso o que foi feito, as tecnologias e os links. |
| `entrada` | Entrada no scroll | Título, fios e textos entram em sequência quando a seção aparece. |
| `terminal` | Terminal | Comandos `help`, `projetos`, `sobre`, `contato` e `tema`, e os segredos `matrix`, `scan` e `cauanzera`. |
| `arco` | Menu em meio-arco | Cinco fatias que abrem em leque, com navegação pelo teclado. |
| `contato` | Contato | Botão que é puxado pelo cursor e copia o e-mail. |

## Desempenho e acessibilidade

- As animações usam só `transform` e `opacity`.
- Os loops de animação param quando o componente sai da tela ou a aba fica escondida.
- Quem ativa "reduzir movimento" no sistema vê tudo parado e completo.
- Tudo funciona pelo teclado, com foco visível.

## Créditos

- Fonte Zero Hour, de Raymond Larabie, em domínio público (CC0).
- Schibsted Grotesk e Martian Mono, do Google Fonts (SIL Open Font License).  
