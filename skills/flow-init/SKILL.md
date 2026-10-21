---
name: flow-init
description: Mapeia o projeto (branches, comandos de qualidade, stack, pastas de frontend/backend/infra, servidor de dev) e gera .claude/flow.json para o /flow:ship. Roda uma vez por projeto, ou de novo para reconfigurar.
disable-model-invocation: true
---

# /flow-init

Gere o `.claude/flow.json` do projeto atual, confirmando com o usuário o que não dá para detectar com segurança.

## 1. Detectar

```bash
git rev-parse --show-toplevel
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect.mjs"
```

O `detect.mjs` só lê e devolve JSON com:
- `branches`: padrão, relevantes no remoto e só locais;
- `node`: gerenciador, scripts, comandos sugeridos, frameworks, servidor de dev e seeds;
- `make`: alvos do Makefile;
- `other`: Python, Go e Rust;
- `dirs`, `monorepoPackages`, `files`;
- `existing`: se já há `flow.json`, `.gitignore` e checklists.

Se não for um repositório git, avise e pare. Se não houver remoto `origin`, avise que o `/ship` precisa de um para abrir PRs, mas siga.

Se `existing.flowJson` for verdadeiro, leia o atual e pergunte: **Reconfigurar do zero** ou **Manter e só revisar** (mostrar e permitir ajustes pontuais).

Se precisar, leia `package.json`, `CLAUDE.md` e a estrutura de `src/` para completar o roteamento. Não leia o repositório inteiro.

## 2. Montar a proposta

**Branches**:
- se existir `dev`, `develop` ou `development`, ela é a base de `feature`, `bugfix`, `refactor` e `chore`, e a branch padrão (`main`/`master`) é a base de `hotfix`;
- se o projeto **só tem** a branch padrão, todas as naturezas apontam para ela e `hotfixBackMerge` é `null`.

**Prefixos**: `feat/`, `fix/`, `hotfix/`, `refactor/`, `chore/`.

**Comandos**:
- use `node.commands`, `make.commands` ou `other.*.commands`, nessa preferência, conforme a stack principal;
- inclua `e2e` só se houver Playwright configurado (`@playwright/test` ou `playwright.config.*`);
- omita o que não existir. Nunca invente script.

**Roteamento**: parta dos padrões de `${CLAUDE_PLUGIN_ROOT}/skills/ship/reference/reviewer-routing.md` e ajuste às pastas reais:
- em monorepo (`apps/*`, `packages/*`), prefixe os globs de UI/UX com os pacotes de frontend detectados;
- em projeto só backend, deixe `ui` e `ux` vazios;
- em React Native ou Expo, mantenha `ui`/`ux` (revisão por código) e **não** configure `browser`, porque o Playwright cobre só web.

**Browser**: só para frontend web com `node.dev` detectado. Use `devCommand` e `url` da detecção, `readyPath` `/` (a menos que exista rota de health conhecida) e `viewports` `[320, 768, 1280]`.

**Limites**: `maxReviewRounds: 2`, `maxGateAttempts: 3`.

## 3. Confirmar com o usuário

Use `AskUserQuestion`, no máximo 4 perguntas por chamada, sempre com a sugestão como primeira opção marcada "(Recommended)":

Chamada 1:
1. **Base de desenvolvimento** (feature, bugfix, refactor e chore): as branches relevantes detectadas.
2. **Base de hotfix**: a branch padrão e as outras relevantes.
3. **Back-merge de hotfix**: "Sim, para `<base de dev>`" ou "Não". Só pergunte se as duas bases forem diferentes.
4. **Prefixos de branch**: "Padrão (feat/, fix/, hotfix/, refactor/, chore/)" ou "Personalizar" (o usuário descreve em "Other").

Chamada 2 (só se houver frontend web):
1. **Teste no navegador**: "Ativar com `<devCommand>` em `<url>`", "Ativar com outro comando ou porta" (em "Other") ou "Desativar".
2. **Dados de teste**: os `seedCandidates` detectados, "Sem seed" ou "Outro comando" (em "Other").
3. **Usuário de teste**: "Variáveis E2E_USER e E2E_PASSWORD", "Criado pelo seed (sem login separado)" ou "Sem login".
4. **Lighthouse**: "Medir no build de produção (`<build>` + `<start>`)" ou "Não medir". Só pergunte se existirem `build` e `start`.

Por fim, mostre os **comandos de qualidade** e o **roteamento** propostos em blocos de código e pergunte: **Confirmar** ou **Ajustar** (descrição em "Other"). Aplique o ajuste e mostre de novo, até confirmar.

## 4. Gravar

1. Crie `.claude/` se não existir e grave `.claude/flow.json`, com 2 espaços de indentação, neste formato:

```json
{
  "branches": { "feature": "dev", "bugfix": "dev", "refactor": "dev", "chore": "dev", "hotfix": "main" },
  "hotfixBackMerge": "dev",
  "branchPrefix": { "feature": "feat/", "bugfix": "fix/", "hotfix": "hotfix/", "refactor": "refactor/", "chore": "chore/" },
  "commands": { "lint": "npm run lint", "typecheck": "npm run typecheck", "test": "npm test", "build": "npm run build" },
  "routing": { "ui": [], "ux": [], "security": [] },
  "browser": {
    "devCommand": "npm run dev",
    "url": "http://localhost:3000",
    "readyPath": "/",
    "seedCommand": "npm run db:seed:test",
    "testUser": { "fromEnv": ["E2E_USER", "E2E_PASSWORD"] },
    "viewports": [320, 768, 1280]
  },
  "maxReviewRounds": 2,
  "maxGateAttempts": 3
}
```

   Omita `browser` quando ele for desativado. Omita `seedCommand`, `testUser` e `prod` quando não se aplicarem.

2. Garanta que o `.gitignore` tenha a linha `.claude/flow-runs/`. Crie o arquivo se não existir e não duplique a linha.
3. Valide o JSON gravado com `node -e "JSON.parse(require('fs').readFileSync('.claude/flow.json','utf8'))"`.
4. **Não commite.** Mostre o resumo final e sugira commitar `.claude/flow.json` e `.gitignore`. Mencione que checklists específicos do projeto podem ir em `.claude/checklists/<security|ux|ui|code>.md`: por padrão eles estendem os do plugin, e substituem se a primeira linha for `<!-- mode: replace -->`.
