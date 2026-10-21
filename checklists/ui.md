# Checklist de UI

Cobre a parte visual, a responsividade e a velocidade da interface. Em `checklistRef`, cite como `ui.md#<ID>` (ex.: `ui.md#UI-02`).

## UI-01 — Design system

- Usa os tokens do design system: nenhuma cor, espaçamento, raio, sombra ou fonte fixos no código.
- Reutiliza os componentes existentes antes de criar um novo.

## UI-02 — Contraste

- Texto com contraste de pelo menos 4.5:1, e 3:1 para texto grande (1.4.3).
- Componentes de interface, bordas de campo e ícones informativos com 3:1 (1.4.11).
- A informação não depende só de cor (1.4.1).

## UI-03 — Responsividade

- Funciona em 320 px sem rolagem horizontal (1.4.10).
- Breakpoints do projeto respeitados e testados.
- Texto aumentado a 200% sem perda de conteúdo (1.4.4); espaçamento de texto ajustável (1.4.12).
- Tema escuro coberto, quando o projeto suporta.

## UI-04 — Hierarquia e ritmo

- Hierarquia tipográfica clara: um título principal por tela e uma escala consistente.
- Alinhamento e espaçamento consistentes com a grade do projeto.

## UI-05 — Estados de componente

- Hover, foco, ativo, desabilitado, carregamento e erro desenhados para os componentes novos.
- Skeletons ou placeholders com as dimensões do conteúdo final.

## UI-06 — Core Web Vitals (percentil 75)

- LCP até 2,5 s: imagem principal com prioridade, sem lazy loading acima da dobra.
- INP até 200 ms: handlers leves, sem tarefas longas na thread principal, e trabalho pesado adiado ou em worker.
- CLS até 0,1: imagens e mídia com `width`/`height` ou `aspect-ratio`, e espaço reservado para conteúdo assíncrono e banners.

## UI-07 — Peso

- Imagens em formato moderno, dimensionadas e com lazy loading abaixo da dobra.
- Bundle novo justificado. Import dinâmico para o que não é necessário na primeira tela.
- Fontes com `font-display` adequado e sem variações não usadas.
