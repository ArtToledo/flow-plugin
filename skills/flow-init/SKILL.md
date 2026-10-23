---
name: flow-init
description: Maps the project (language, branches, quality commands, stack, frontend/backend/infra folders, dev server) and writes .claude/flow.json for /flow:ship. Run once per project, or again to reconfigure.
disable-model-invocation: true
---

# /flow-init

Write the current project's `.claude/flow.json`, and confirm with the user whatever cannot be detected reliably.

## 1. Language

Before anything else, make one `AskUserQuestion` call with a single question, written in both languages:

- Question: "Which language should flow use? / Em qual idioma o flow deve trabalhar?"
- Header: "Language"
- Options:
  - "English" → `en`
  - "Português (Brasil)" → `pt-BR`

Put first, marked "(Recommended)", the language the user has been writing in. If there is no conversation yet, recommend English.

From here on, write every message and question in the chosen language (`<lang>`). The value goes into `flow.json.language`. `/flow:ship` uses it for the spec, commits, PRs and review comments.

If `flow.json` already exists and has `language`, recommend that value.

## 2. Detect

```bash
git rev-parse --show-toplevel
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect.mjs"
```

`detect.mjs` is read-only. It returns JSON with:
- `branches`: the default branch, the relevant remote branches and the local-only ones;
- `node`: package manager, scripts, suggested commands, frameworks, dev server and seed scripts;
- `make`: Makefile targets;
- `other`: Python, Go and Rust;
- `dirs`, `monorepoPackages` and `files`;
- `existing`: whether `flow.json`, `.gitignore` and project checklists already exist.

If this is not a git repository, say so and stop. If there is no `origin` remote, warn that `/ship` needs one to open PRs, but continue.

If `existing.flowJson` is true, read the current file and ask: **Reconfigure from scratch** or **Keep it and review** (show it and allow targeted changes).

Read `package.json`, `CLAUDE.md` and the `src/` layout if you need them to fill in the routing. Do not read the whole repository.

## 3. Build the proposal

**Branches**:
- If `dev`, `develop` or `development` exists, it is the base for `feature`, `bugfix`, `refactor` and `chore`, and the default branch (`main` or `master`) is the base for `hotfix`.
- If the project **only has** the default branch, every type points to it, and `hotfixBackMerge` is `null`.

**Prefixes**: `feat/`, `fix/`, `hotfix/`, `refactor/`, `chore/`.

**Commands**:
- Use `node.commands`, `make.commands` or `other.*.commands`, in that order of preference, depending on the main stack.
- Include `e2e` only when Playwright is set up (`@playwright/test` or `playwright.config.*`).
- Leave out anything that doesn't exist. Never invent a script.

**Routing**: start from the defaults in `${CLAUDE_PLUGIN_ROOT}/skills/ship/reference/reviewer-routing.md` and adapt them to the real folders.
- **Monorepo** (`apps/*`, `packages/*`): prefix the UI/UX globs with the frontend packages you detected.
- **Backend-only project**: leave `ui` and `ux` empty.
- **React Native or Expo**: keep `ui` and `ux` (they review by reading code), but do **not** configure `browser`, because Playwright only covers the web.

**Browser**: only for a web frontend with a detected `node.dev`. Use the detected `devCommand` and `url`, `readyPath` `/` (unless there is a known health route) and `viewports` `[320, 768, 1280]`.

**PR mode**: `prMode: "single"` (one PR per `/ship` run). `"stacked"` (one PR per slice on an integration branch) is for teams that review very large changes in pieces; don't ask, just mention it in the summary.

**Limits**: `maxReviewRounds: 2` and `maxGateAttempts: 3`.

## 4. Confirm with the user

Use `AskUserQuestion` in `<lang>`, with at most 4 questions per call, and put the suggestion first, marked "(Recommended)".

**Call 1:**
1. **Development base** (feature, bugfix, refactor, chore): the relevant branches you detected.
2. **Hotfix base**: the default branch and the other relevant branches.
3. **Hotfix back-merge**: "Yes, into `<development base>`" or "No". Only ask when the two bases differ.
4. **Branch prefixes**: "Default (feat/, fix/, hotfix/, refactor/, chore/)" or "Customize" (described under "Other").

**Call 2** (only when there is a web frontend):
1. **Browser testing**: "Enable with `<devCommand>` on `<url>`", "Enable with another command/port" (under "Other") or "Disable".
2. **Test data**: the detected `seedCandidates`, "No seed" or "Another command" (under "Other").
3. **Test user**: "E2E_USER and E2E_PASSWORD variables", "Created by the seed (no separate login)" or "No login".
4. **Lighthouse**: "Configure the production build (`<build>` + `<start>`)" or "Don't configure". Explain that it only runs when `/ship` gets `--lighthouse`, because a production build is slow. Only ask when both `build` and `start` exist.

Finally, show the proposed **quality commands** and **routing** in code blocks and ask **Confirm** or **Adjust** (described under "Other"). Apply each adjustment and show the result again until the user confirms.

## 5. Write

1. Create `.claude/` if needed and write `.claude/flow.json` with 2-space indentation, in this shape:

```json
{
  "language": "en",
  "prMode": "single",
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

   Leave out `browser` when it is disabled, and leave out `seedCommand`, `testUser` and `prod` when they don't apply.

2. Make sure `.gitignore` contains the line `.claude/flow-runs/`. Create the file if needed, and don't add the line twice.
3. Validate the written JSON with `node -e "JSON.parse(require('fs').readFileSync('.claude/flow.json','utf8'))"`.
4. **Don't commit.** Show the final summary and suggest committing `.claude/flow.json` and `.gitignore`.
   - Mention that project-specific checklists can go in `.claude/checklists/<security|ux|ui|code>.md`. By default they extend the plugin's checklists; they replace them when the first line is `<!-- mode: replace -->`.
   - Mention that the language can be changed later by editing `language` in `flow.json`.
   - Mention that `prMode` can be set to `"stacked"` for one PR per slice, and that `/ship --lite` is the fast path for small changes.
