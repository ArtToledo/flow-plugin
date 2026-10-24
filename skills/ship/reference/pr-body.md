# PR templates

The skill fills in the values between `{{ }}`. Remove sections that don't apply, and never leave a placeholder empty.

Write everything in the run language (`<lang>`). The templates below are in English. For `pt-BR`, use the headings and fixed phrases from the table at the end.

## Single PR (the default: one PR for the whole run)

Title: `{{type}}({{scope}}): {{summary}}`.

```markdown
{{#if blockers or majors remain}}
> [!WARNING]
> **Draft: {{n}} blocker/major finding(s) still open.** See "Pending" below.
{{/if}}

## Goal

{{goal, from the spec}}

## Slices

{{#each slice}}
### {{NN}} - {{title}} {{✅ done | ⏳ in progress | ⏸️ pending}}

{{slice goal}}

- [x] {{criterion met}}
- [ ] {{criterion not met — with the reason}}
{{/each}}

## How to test

1. {{step}}

Quality gate: `{{lint}}` · `{{typecheck}}` · `{{test}}` · `{{build}}`{{ · e2e}}

## Automated review

| Slice | Reviewers | Rounds | Result |
| ----- | --------- | ------ | ------ |
| {{NN}} | {{code, security}} | {{rounds}} | {{blocker}} blocker · {{major}} major · {{minor}} minor · {{nit}} nit |

{{#if browser ran}}Browser: {{one-sentence summary}} (slice {{NN}}).{{/if}}

{{#if pending}}
## Pending

`blocker`/`major` findings that remain, findings disputed or deferred by the builder, and findings the builder reported as fixed that no reviewer re-checked yet, left for a human decision:

- **{{severity}}** `{{id}}` `{{file}}:{{line}}` — {{evidence}} {{(disputed: reason) | (reported fixed in sha, not re-checked)}}
{{/if}}

---
Spec: `.claude/flow-runs/{{slug}}/spec.md` (local)
```

A lite run has one slice: drop the "Slices" heading and put its criteria under "Acceptance criteria" instead.

## Slice PR (stacked mode)

Title: `{{type}}({{scope}}): {{NN}} - {{summary}}`. For a single slice, use `{{type}}({{scope}}): {{summary}}`.

```markdown
{{#if blockers or majors remain}}
> [!WARNING]
> **Draft: {{n}} blocker/major finding(s) still open after {{rounds}} review round(s).** See "Pending" below.
{{/if}}

## Goal

{{slice goal, from the spec}}

{{#if stacked}}
**Depends on:** #{{previous slice PR}} ({{previous branch}}). Merge in order: 01, 02, 03…
{{/if}}

## Acceptance criteria

- [x] {{criterion met}}
- [ ] {{criterion not met — with the reason}}

## How to test

1. {{step}}

Quality gate commands: `{{lint}}` · `{{typecheck}}` · `{{test}}` · `{{build}}`{{ · e2e}}

## Automated review

| Reviewer | Result |
| -------- | ------ |
| {{code}} | {{one-sentence summary}} |

Rounds: {{rounds}} of {{maxReviewRounds}}. Final totals: {{blocker}} blocker · {{major}} major · {{minor}} minor · {{nit}} nit.

{{#if pending}}
## Pending

`blocker`/`major` findings that remain, findings disputed by the builder, and findings the builder reported as fixed that no reviewer re-checked yet, left for a human decision:

- **{{severity}}** `{{id}}` `{{file}}:{{line}}` — {{evidence}} {{(disputed: reason) | (reported fixed in sha, not re-checked)}}
{{/if}}

---
Spec: `.claude/flow-runs/{{slug}}/spec.md` (local)
```

## Final PR (stacked mode: integration → base)

Title: `{{type}}({{scope}}): {{feature summary}}`.

```markdown
## Goal

{{overall goal from the spec}}

## Slices

| # | PR | Summary | State |
| - | -- | ------- | ----- |
| 01 | #{{n}} | {{summary}} | merged |

## Feature acceptance criteria

- [x] {{criterion}}

## Inherited pending items

{{minor/disputed findings still open on the slice PRs, with links — or "None."}}
```

## Back-merge PR (hotfix)

Title: `chore(release): back-merge {{hotfix branch}} into {{dev}}`.

```markdown
Back-merge of hotfix #{{hotfix PR}} (`{{branch}}`), already merged into `{{main}}`, into `{{dev}}`.
```

## pt-BR headings and phrases

| en | pt-BR |
| -- | ----- |
| Goal | Objetivo |
| Depends on | Depende de |
| Merge in order | Faça o merge na ordem |
| Acceptance criteria | Critérios de aceite |
| How to test | Como testar |
| Quality gate commands | Comandos do quality gate |
| Automated review | Review automatizada |
| Reviewer / Result | Revisor / Resultado |
| Rounds … of … Final totals | Rodadas … de … Totais finais |
| Pending | Pendentes |
| disputed | contestado |
| Draft: … blocker/major finding(s) still open after … review round(s) | Draft: … achado(s) blocker/major pendente(s) após … rodada(s) de review |
| Draft: … blocker/major finding(s) still open | Draft: … achado(s) blocker/major pendente(s) |
| reported fixed in …, not re-checked | corrigido em … segundo o builder, sem reverificação |
| done / in progress / pending | pronta / em andamento / pendente |
| Quality gate | Quality gate |
| Slice / Reviewers / Rounds / Result | Fatia / Revisores / Rodadas / Resultado |
| Browser: … (slice …) | Navegador: … (fatia …) |
| disputed or deferred by the builder | contestados ou adiados pelo builder |
| deferred | adiado |
| Slices / Summary / State | Fatias / Resumo / Estado |
| Feature acceptance criteria | Critérios de aceite da feature |
| Inherited pending items / None. | Pendentes herdados / Nenhum. |
| Back-merge of hotfix … already merged into … | Back-merge do hotfix …, já mergeado em … |
