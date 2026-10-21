# Templates de PR

Os valores entre `{{ }}` são preenchidos pela skill. Remova as seções que não se aplicam, sem deixar placeholders vazios.

## PR de fatia (ou de entrega com fatia única)

Título: `{{tipo}}({{escopo}}): {{NN}} - {{resumo}}`. Com fatia única, o título fica `{{tipo}}({{escopo}}): {{resumo}}`.

```markdown
{{#se há blocker pendente}}
> [!WARNING]
> **Draft: {{n}} achado(s) blocker pendente(s) após {{rodadas}} rodadas de review.** Veja "Pendentes" abaixo.
{{/se}}

## Objetivo

{{objetivo da fatia, da spec}}

{{#se empilhada}}
**Depende de:** #{{PR da fatia anterior}} ({{branch anterior}}). Faça o merge na ordem 01, 02, 03…
{{/se}}

## Critérios de aceite

- [x] {{critério atendido}}
- [ ] {{critério não atendido — com o motivo}}

## Como testar

1. {{passo}}

Comandos do quality gate: `{{lint}}` · `{{typecheck}}` · `{{test}}` · `{{build}}`{{ · e2e}}

## Review automatizada

| Revisor | Resultado |
| ------- | --------- |
| {{code}} | {{resumo de uma frase}} |

Rodadas: {{rodadas}} de {{maxReviewRounds}}. Totais finais: {{blocker}} blocker · {{major}} major · {{minor}} minor · {{nit}} nit.

{{#se há pendentes}}
## Pendentes

Achados `blocker`/`major` que sobraram e achados contestados pelo builder, para decisão humana:

- **{{severidade}}** `{{id}}` `{{arquivo}}:{{linha}}` — {{evidência}} {{(contestado: motivo)}}
{{/se}}

---
Spec: `.claude/flow-runs/{{slug}}/spec.md` (local)
```

## PR final (integração → base)

Título: `{{tipo}}({{escopo}}): {{resumo da feature}}`.

```markdown
## Objetivo

{{objetivo geral da spec}}

## Fatias

| # | PR | Resumo | Estado |
| - | -- | ------ | ------ |
| 01 | #{{n}} | {{resumo}} | merged |

## Critérios de aceite da feature

- [x] {{critério}}

## Pendentes herdados

{{achados minor/contestados que ficaram abertos nos PRs das fatias, com link — ou "Nenhum."}}
```

## PR de back-merge (hotfix)

Título: `chore(release): back-merge {{hotfix branch}} para {{dev}}`.

```markdown
Back-merge do hotfix #{{PR do hotfix}} (`{{branch}}`), já mergeado em `{{main}}`, para `{{dev}}`.
```
