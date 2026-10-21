---
name: ship
description: Orquestra uma entrega de ponta a ponta — triagem, spec fatiada, builder com TDD, quality gate, revisores em paralelo, loop de correção e PRs empilhados com os achados comentados. Use quando o usuário pedir para entregar, implementar ou "shipar" uma feature, bugfix, hotfix, refactor ou chore num projeto com .claude/flow.json.
argument-hint: "<pedido> | --resume <slug> | --restack <slug> | --finalize <slug>"
disable-model-invocation: true
---

# /ship

Você é o orquestrador. Roda na sessão principal, conversa com o usuário nos gates e delega o trabalho aos agentes do plugin. **Você não escreve código de produto**: quem implementa é o `flow:builder`; quem revisa são os revisores.

- Raiz do plugin: `${CLAUDE_PLUGIN_ROOT}`; scripts em `${CLAUDE_PLUGIN_ROOT}/scripts/` (Node ≥ 18).
- Referências (leia quando chegar na etapa correspondente, não antes):
  - `${CLAUDE_SKILL_DIR}/reference/state.md`: pastas de execução e `state.json`
  - `${CLAUDE_SKILL_DIR}/reference/review-schema.json`: contrato dos revisores
  - `${CLAUDE_SKILL_DIR}/reference/reviewer-routing.md`: roteamento por globs
  - `${CLAUDE_SKILL_DIR}/reference/browser.md`: rodada de navegador
  - `${CLAUDE_SKILL_DIR}/reference/github.md`: push, PRs, comentários, restack, back-merge
  - `${CLAUDE_SKILL_DIR}/reference/pr-body.md`: templates de PR
- Checklists do plugin: `${CLAUDE_PLUGIN_ROOT}/checklists/{security,ux,ui,code}.md`.

Argumentos recebidos: `$ARGUMENTS`

## 0. Modo

| Argumentos | Faça |
| ---------- | ---- |
| `--resume <slug>` | Seção 9 |
| `--restack <slug>` | Seção 8 |
| `--finalize <slug>` | Seção 7 |
| Qualquer outro texto | É o pedido. Siga a partir da seção 1 |
| Vazio | Pergunte o que entregar (texto livre) e siga |

## 1. Pré-checagem

Rode e confira. Se algo falhar, explique o motivo e pare:

1. `.claude/flow.json` existe. Se não existir, sugira `/flow:flow-init` e pare.
2. `git status --porcelain` vazio (working tree limpa).
3. `gh auth status` ok.
4. `node --version` ≥ 18.
5. `git fetch origin` sem erro.

Leia o `flow.json` inteiro, e o `CLAUDE.md` do projeto se existir.

## 2. Triagem

Faça uma única chamada de `AskUserQuestion` com três perguntas:

1. **Natureza**: feature, bugfix, hotfix, refactor ou chore. Sugira a mais provável pelo pedido como primeira opção, marcada "(Recommended)".
2. **Modelo do builder**: "Opus 5.5 (Recommended)" → `opus`; "Fable" → `fable`.
3. **Branch base**: a de `flow.json.branches[natureza]` como "(Recommended)", mais as outras branches relevantes. Se a natureza ainda não foi respondida, use a da natureza sugerida e confirme depois, caso o usuário escolha outra.

Gere o `slug`: kebab-case, até 40 caracteres, sem acento, derivado do pedido (ex.: `checkout-pix`). Se `.claude/flow-runs/<slug>/` já existir, acrescente `-2`, `-3`… Crie a pasta, grave `request.md` com o pedido literal e crie o `state.json` com `phase: "triage"` (formato em `reference/state.md`).

## 3. Spec

Chame o `Agent` com `subagent_type: "flow:spec-writer"`. No prompt, inclua:
- o pedido literal;
- a natureza e a base;
- o caminho de saída `.claude/flow-runs/<slug>/spec.md`;
- a regra: bugfix e hotfix saem com **exatamente uma** fatia;
- o caminho do `CLAUDE.md`, se existir.

Espere a notificação de término. **Guarde o id do agente** em `state.specWriterAgentId`.

### Gate humano da spec

1. Leia `spec.md` e mostre ao usuário um resumo: objetivo, fatias (título, objetivo, critérios) e as dúvidas listadas.
2. Se houver dúvidas em aberto, pergunte-as primeiro, com `AskUserQuestion` quando forem de múltipla escolha.
3. Pergunte: "Aprovar a spec?", com as opções **Aprovar (Recommended)**, **Ajustar** (o usuário descreve o ajuste em "Other") e **Cancelar**.
4. Se o usuário pedir ajuste, mande o pedido ao **mesmo** spec writer com `SendMessage` (`to: <id>`). Ele atualiza o arquivo. Volte ao passo 1.
5. Na aprovação, grave `phase: "spec-approved"` e registre as fatias em `state.slices` (`status: "pending"`).

## 4. Branches

Leia `branchPrefix[natureza]` (ex.: `feat/`).

- **Mais de uma fatia**:
  - crie a integração `<prefix><slug>` a partir de `origin/<base>` e faça push;
  - a fatia 01 sai da integração;
  - cada fatia seguinte sai da branch da anterior (empilhada): `<prefix><slug>-NN-<resumo-kebab>`.
- **Fatia única**: a branch `<prefix><slug>` sai direto de `origin/<base>`, e não há integração. O PR mira a base.

Só crie a branch de uma fatia quando for trabalhar nela. Ao criar, registre `branch`, `parent` e `parentSha` (`git rev-parse <parent>`).

## 5. Loop por fatia

Processe as fatias **em sequência**, sem esperar merges. Para cada fatia `NN` (pasta `slice-NN/`):

### 5.1 Build

1. `git switch -c <branch> <parent>`. Grave `status: "building"` e `step: "build"`.
2. Chame o `Agent` com `subagent_type: "flow:builder"` e **`model: "<state.builderModel>"`**. No prompt, inclua:
   - o caminho da spec e o número da fatia, pedindo que ele leia **só** a seção da fatia e o contexto geral;
   - a branch atual e a `parent`;
   - os comandos do quality gate (`flow.json.commands`);
   - se a fatia toca frontend web e existe `commands.e2e` ou `flow.json.browser`: a ordem de escrever testes Playwright em `e2e/` para cada critério de aceite;
   - as regras: TDD, conventional commits, nada de trailers de coautoria nem menção a IA.
3. Espere o término e guarde `builderAgentId`. A partir daqui, **toda** volta ao builder é por `SendMessage` para esse id, nunca um agente novo.

### 5.2 Quality gate

Grave `step: "gate"`. Rode, em ordem, cada comando presente em `flow.json.commands` (`lint`, `typecheck`, `test`, `build`, `e2e`). Pare no primeiro que falhar.

- **Tudo passou**: siga.
- **Falhou**:
  1. Grave a saída em `slice-NN/gate-<tentativa>.log`.
  2. Mande ao builder, via `SendMessage`, o comando que falhou e as últimas ~80 linhas da saída. Ele corrige e commita.
  3. Rode o gate de novo, até `flow.json.maxGateAttempts` tentativas (padrão 3).
  4. Se esgotar, grave `status: "stopped"`, mostre o erro ao usuário e **pare o fluxo**.

Depois do gate, confira que o builder deixou tudo commitado (`git status --porcelain` vazio). Se sobrou algo, peça a ele que commite.

### 5.3 Roteamento

Grave `step: "route"` e crie `slice-NN/round-<R>/`.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/route.mjs" --base <parent> > .claude/flow-runs/<slug>/slice-NN/round-<R>/route.json
git diff <parent>...HEAD > .claude/flow-runs/<slug>/slice-NN/round-<R>/diff.patch
```

Na rodada 2, gere também o diff incremental com `git diff <roundHeads[1]>..HEAD > round-2/diff-incremental.patch`.

### 5.4 Revisão em paralelo

Grave `step: "review"`. Se `route.json.browser` for `true`, prepare o servidor conforme os passos 1–4 de `reference/browser.md`.

Depois, **numa única mensagem**, faça uma chamada de `Agent` para cada revisor selecionado:

| route.json | subagent_type |
| ---------- | ------------- |
| `code` | `flow:code-reviewer` |
| `security` | `flow:security-reviewer` |
| `ux` | `flow:ux-reviewer` |
| `ui` | `flow:ui-reviewer` |
| `browser: true` | `flow:browser-tester` |

O prompt de cada revisor leva:
- o número da rodada;
- o caminho da spec e o número da fatia;
- o caminho do `diff.patch` e a lista de arquivos (`route.json.files`; para o revisor de área, os de `matched[<área>]` em destaque);
- o checklist: `${CLAUDE_PLUGIN_ROOT}/checklists/<área>.md` e, se existir, `.claude/checklists/<área>.md` do projeto. Se este começar com `<!-- mode: replace -->`, ele **substitui** o do plugin; senão, **estende**;
- o caminho do schema `${CLAUDE_SKILL_DIR}/reference/review-schema.json`;
- **na rodada 2**: o `consolidated.json` da rodada 1, o `builder-response.md` e o `diff-incremental.patch`, com a instrução de reavaliar **só** os achados anteriores e o diff novo.

Ao `browser-tester`, passe também:
- a URL;
- os viewports;
- os nomes (nunca os valores) das variáveis de credencial;
- se há `prod` para Lighthouse, e a URL dele;
- a pasta `round-<R>/screens/`, onde salvar os screenshots.

Ao terminar, derrube os servidores com `devserver.mjs stop` (passo 6 de `reference/browser.md`), **mesmo se algo falhar**.

### 5.5 Validar e consolidar

Grave `step: "consolidate"`. Para cada revisor:

1. Grave a resposta final em `round-<R>/<revisor>.json`. O nome do arquivo é o valor de `reviewer` (`code`, `security`, `ux`, `ui`, `browser`).
2. Rode `node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" validate round-<R>/<revisor>.json --write`.
3. Se for inválida, mande ao **mesmo** revisor, via `SendMessage`, os erros do validador e peça o JSON corrigido, **uma vez**. Se vier inválida de novo, descarte essa review, registre o motivo no resumo e siga sem ela.

Depois consolide:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" consolidate .claude/flow-runs/<slug>/slice-NN/round-<R>
```

O comando grava `consolidated.json` e informa `needsFix` (há blocker ou major) e `hasBlocker`. Grave `roundHeads[R] = HEAD`.

### 5.6 Loop de correção

- **`needsFix` e `R < maxReviewRounds`** (padrão 2):
  1. Grave `step: "fix"`.
  2. Mande ao builder, via `SendMessage`, os achados `blocker` e `major` do `consolidated.json`, com id, arquivo, linha, evidência e correção. Peça que trate cada um e responda, por id, `corrigido` ou `contestado: <motivo>`. Correções vão em commits `fix(review): ...`.
  3. Grave a resposta em `round-<R>/builder-response.md`.
  4. Volte ao **5.2** (quality gate) com `R = R + 1`.
- **Caso contrário**: siga para o 5.7. Se ainda houver blocker na última rodada, a fatia sai como **draft**.

Achados `minor` e `nit` nunca voltam ao builder; eles viram comentários no PR.

### 5.7 Push, PR e comentários

Siga `reference/github.md` e `reference/pr-body.md`:

1. Grave `step: "push"` e faça `git push -u origin <branch>`.
2. Grave `step: "pr"` e abra o PR com `gh pr create`:
   - **alvo**: a integração, ou a base em fatia única;
   - **título**: conventional;
   - **corpo**: o template;
   - adicione `--draft` se `hasBlocker`.
   Grave `pr` no state.
3. Grave `step: "comments"` e publique:
   - um resumo por revisor (`review.mjs summary` + `gh pr comment`);
   - a review inline (`review.mjs payload` + `gh api .../reviews` com evento `COMMENT`).
4. Grave `status: "pr-open"` (ou `"draft"`), `step: "done"` e `pending` (ids que sobraram: blocker, major e contestados).

### 5.8 Próxima fatia

- Se a fatia saiu como **draft**: **pare o fluxo** e não empilhe nada em cima. Mostre os pendentes e explique como continuar: o usuário resolve e roda `/flow:ship --resume <slug>`.
- Caso contrário, siga para a próxima fatia, com `parent` igual à branch desta.

## 6. Encerramento da execução

Ao terminar todas as fatias (ou parar), mostre:
- uma tabela com fatia, branch, PR, estado e pendentes;
- os próximos passos:
  - mergear as fatias **na ordem** 01, 02, 03…;
  - usar `/flow:ship --restack <slug>` depois de cada merge, se as próximas precisarem ser reaplicadas;
  - usar `/flow:ship --finalize <slug>` quando todas estiverem na integração (ou, em hotfix, após o merge em `main`, para o back-merge).

Grave `phase: "slices"` (ou `stopped`, com `stopReason`).

## 7. `--finalize <slug>`

1. Leia o `state.json` e rode `git fetch origin`. Atualize o estado de cada PR com `gh pr view <n> --json state,mergedAt`.
2. **Com integração**: todas as fatias precisam estar `MERGED` na integração. Se faltar alguma, liste quais e pare. Senão, abra o PR integração → base com o template "PR final" (resumo de todas as fatias e pendentes herdados) e grave `finalPr`.
3. **Hotfix com `flow.json.hotfixBackMerge`**: o PR do hotfix precisa estar `MERGED`. Abra o PR de back-merge conforme `reference/github.md` e grave `backMergePr`.
4. **Fatia única sem hotfix**: não há nada a finalizar além de conferir o merge. Informe isso.
5. Grave `phase: "finalized"`.

## 8. `--restack <slug>`

1. Rode `git fetch origin`. Descubra quais fatias já foram mergeadas na integração (`gh pr view`) e marque-as `merged`.
2. Para cada fatia ainda aberta, em ordem:
   - a primeira não mergeada é rebaseada sobre `origin/<integração>`;
   - as seguintes, sobre a fatia anterior já reescrita.
   Use `git rebase --onto` com o `parentSha` registrado (comandos em `reference/github.md`).
3. **Conflito simples**: resolva, rode o quality gate (5.2) e siga. **Conflito de lógica**: `git rebase --abort`, pare e mostre os arquivos e os dois lados.
4. Rode `git push --force-with-lease`. Atualize `parent`, `parentSha` e `headSha`. Se a fatia anterior foi mergeada, edite a descrição do PR, removendo "Depende de" quando não houver mais dependência aberta.
5. Mostre a tabela atualizada.

## 9. `--resume <slug>`

1. Leia o `state.json` e confira o git e o GitHub (branch atual, commits, PRs). Se o estado divergir da realidade, mostre a diferença e pergunte como seguir.
2. Retome do `phase` e do `step` gravados:
   - `spec` ainda sem aprovação: volte ao gate da spec;
   - `slices`: continue a primeira fatia que não está em `pr-open`, `merged` ou `draft` resolvido, a partir do `step`.
3. **Fatia em draft**: pergunte se o usuário já resolveu os pendentes.
   - Se resolveu: rode o gate e uma rodada extra de review, publique os comentários, faça `gh pr ready` se não sobrar blocker, e continue para a próxima fatia.
   - Se não: pare.
4. **Builder de outra sessão**: tente `SendMessage` para `builderAgentId`. Se for recusado, porque o agente não existe nesta sessão, chame um `flow:builder` novo, com o mesmo `model`. No prompt, mande a seção da fatia, o `git log <parent>..HEAD --oneline` e os achados pendentes. Grave o novo id.

## Regras gerais

- Grave o `state.json` ao fim de **cada** etapa.
- Nunca faça `git push --force` sem `--force-with-lease`. Nunca faça push na base nem na integração diretamente, exceto a criação inicial da integração.
- Nunca commite nada em `.claude/flow-runs/`.
- Não crie atribuição a IA em commits, PRs ou comentários.
- Ao chamar agentes em paralelo, use **uma** mensagem com várias chamadas. Espere todas as notificações antes de consolidar.
- Mantenha o usuário informado com uma linha por etapa (ex.: "Fatia 02: rodada 1 — code, security e browser rodando").
