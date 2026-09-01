# `styles.css` é intocável

Este arquivo é o design system **Organic**, copiado sem uma vírgula de diferença de
`design_handoff_raiz_financas/design/ds/styles.css`.

O handoff é explícito: *"copie esse CSS para o novo projeto e consuma as variáveis e classes
dele — não redefina valores"*.

Então:

- **Nunca** edite `styles.css`. Se um valor parece errado, ele está certo — o errado é o consumo.
- **Nunca** redeclare um token (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`) fora dele.
- **Nunca** escreva um hex, um nome de fonte ou um px que um token já carrega.
- Estados (`:hover`, `:active`, `:focus-visible`, `::selection`, `:disabled`) já vêm prontos.
  Não sobrescreva — em especial o anel de foco de 2px, que é requisito de acessibilidade.

O que **pode** ser escrito em CSS Modules por componente: layout (grid, flex, gap),
posicionamento e dimensões específicas da tela — sempre em cima de `var(--space-*)`.

Cores fora dos tokens: só as 8 cores de dados de `@raiz/core` (`DATA_COLORS`), que o próprio
handoff define como exceção para gráficos e categorias.
