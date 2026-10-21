# Checklist de UX

A base são as 10 heurísticas de Nielsen e o comportamento exigido pela WCAG 2.2 AA. Em `checklistRef`, cite como `ux.md#<ID>` (ex.: `ux.md#UX-05`).

## UX-01 — Status visível

- Toda tela ou componente novo com dados tem estados de carregamento, sucesso, erro e vazio.
- Ações demoradas dão feedback imediato (botão desabilitado com indicador, progresso).

## UX-02 — Prevenção e recuperação de erro

- Ação destrutiva pede confirmação ou permite desfazer.
- Validação inline, no momento certo (ao sair do campo ou ao enviar, não a cada tecla).
- A mensagem de erro diz o que aconteceu e **como resolver**, perto do campo (3.3.1, 3.3.3).

## UX-03 — Controle do usuário

- Voltar, cancelar e desfazer disponíveis. Modais fecham com Esc e com botão.
- Nada de ação irreversível disparada sem intenção clara.

## UX-04 — Consistência

- Mesmos padrões de componente, texto e fluxo já usados no produto.
- Mesma ação com o mesmo nome em todo lugar.

## UX-05 — Teclado e foco

- Tudo operável por teclado (2.1.1), sem armadilha de foco (2.1.2).
- Ordem de foco lógica (2.4.3).
- Foco visível (2.4.7) e não encoberto por header fixo ou toast (2.4.11).
- Foco movido corretamente ao abrir ou fechar modais e após navegação.

## UX-06 — Alvos e gestos

- Alvos de toque com pelo menos 24x24 px CSS ou espaçamento equivalente (2.5.8).
- Arrastar sempre com alternativa de clique ou toque simples (2.5.7).

## UX-07 — Formulários

- Rótulos reais (`<label>` associado ou `aria-labelledby`), não só placeholder (3.3.2).
- Sem pedir de novo o que já foi informado no mesmo processo (3.3.7).
- Login sem teste cognitivo, permitindo colar e usar gerenciador de senha (3.3.8).
- `autocomplete` adequado nos campos de dados pessoais (1.3.5).

## UX-08 — Linguagem

- Textos em português claro, sem jargão técnico para o usuário final.
- Botões com verbos que dizem o que acontece ("Salvar pedido", não "OK").
