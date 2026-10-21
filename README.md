# flow

Plugin do Claude Code que leva uma entrega do pedido ao PR: triagem, spec fatiada, implementação com TDD, quality gate, revisores especializados em paralelo, loop de correção limitado e PRs empilhados com os achados comentados nas linhas certas.

Este repositório é, ao mesmo tempo, o plugin e o marketplace que o distribui.

## Instalação

```bash
claude plugin marketplace add ArtToledo/flow-plugin
claude plugin install flow@flow-marketplace
```

Para desenvolvimento local, use `claude --plugin-dir /caminho/para/flow-plugin`. Depois de editar arquivos do plugin, rode `/reload-plugins`.

## Requisitos

- Claude Code CLI
- `git` e `gh`, autenticado com `gh auth login`
- Node.js 18 ou superior, usado pelos scripts do plugin e pelo Playwright MCP

## Uso

| Comando | O que faz |
| ------- | --------- |
| `/flow:flow-init` | Mapeia o projeto (branches, comandos de qualidade, stack, servidor de dev) e grava `.claude/flow.json`. Roda uma vez por projeto. |
| `/flow:ship <pedido>` | Executa o fluxo completo para uma entrega. |
| `/flow:ship --resume <slug>` | Retoma uma execução interrompida. |
| `/flow:ship --restack <slug>` | Faz rebase das fatias empilhadas depois que uma delas é mergeada. |
| `/flow:ship --finalize <slug>` | Abre o PR integração → base, ou o back-merge de um hotfix. |

Os artefatos de execução (spec, achados, estado e screenshots) ficam em `.claude/flow-runs/<slug>/`. O `/flow:flow-init` adiciona essa pasta ao `.gitignore`.

## Agentes

| Agente | Modelo | Papel |
| ------ | ------ | ----- |
| `flow:spec-writer` | Opus | Spec fatiada com critérios de aceite testáveis |
| `flow:builder` | Opus (Fable por escolha na triagem) | Único que escreve código; TDD e conventional commits |
| `flow:code-reviewer` | Sonnet | Roda sempre |
| `flow:security-reviewer` | Sonnet | OWASP Top 10:2025 / ASVS 5.0 |
| `flow:ux-reviewer` | Sonnet | Nielsen + WCAG 2.2 AA |
| `flow:ui-reviewer` | Sonnet | Design system, contraste, responsivo, Core Web Vitals |
| `flow:browser-tester` | Sonnet | Navegador real via Playwright MCP |

Os revisores só leem e devolvem JSON no contrato `skills/ship/reference/review-schema.json`. Só `blocker` e `major` voltam ao builder, em no máximo 2 rodadas. Se sobrar blocker, o PR abre como draft.

## Personalização por projeto

- `.claude/flow.json`: branches, prefixos, comandos, roteamento de revisores por glob, servidor de dev e limites.
- `.claude/checklists/<security|ux|ui|code>.md`: estende o checklist do plugin. Para substituí-lo, comece o arquivo com `<!-- mode: replace -->`.

## Desenvolvimento

```bash
node --test scripts/test/*.test.mjs
claude plugin validate .
```

O desenho completo está em [`PLAN.md`](PLAN.md). As verificações de formato feitas na fase 1 estão em [`docs/fase-1-verificacao.md`](docs/fase-1-verificacao.md).
