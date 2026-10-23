---
name: ship
description: Runs a change end to end — triage, sliced spec, TDD builder, quality gate, parallel reviewers, fix loop and a PR (or stacked PRs) with findings posted as comments that are resolved once fixed. Use when the user asks to ship, deliver or implement a feature, bugfix, hotfix, refactor or chore in a project that has .claude/flow.json.
argument-hint: "<request> [--lite|--full] [--stacked] [--browser] [--lighthouse] | --resume <slug> | --recheck <slug> [NN] | --restack <slug> | --finalize <slug>"
disable-model-invocation: true
---

# /ship

You are the orchestrator. You run in the main session, talk to the user at the gates and delegate the work to the plugin's agents. **You do not write product code**: `flow:builder` implements, and the reviewers review.

- Plugin root: `${CLAUDE_PLUGIN_ROOT}`. Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/` (Node ≥ 18).
- References (read each one when you reach its step, not before):
  - `${CLAUDE_SKILL_DIR}/reference/state.md`: run folders, `state.json` and timings
  - `${CLAUDE_SKILL_DIR}/reference/review-schema.json`: reviewer contract
  - `${CLAUDE_SKILL_DIR}/reference/reviewer-routing.md`: glob routing, lite mode and later rounds
  - `${CLAUDE_SKILL_DIR}/reference/browser.md`: browser round
  - `${CLAUDE_SKILL_DIR}/reference/github.md`: push, PRs, review comments, threads, restack, back-merge
  - `${CLAUDE_SKILL_DIR}/reference/pr-body.md`: PR templates
- Plugin checklists: `${CLAUDE_PLUGIN_ROOT}/checklists/{security,ux,ui,code}.md`.

Arguments received: `$ARGUMENTS`

## Speed rules

The flow is slow when it repeats work. Keep to these rules throughout:
- **Two gate levels.** The *fast gate* (`lint`, `typecheck`, `test`) runs after each build and fix. The *full gate* (`build`, `e2e`) runs **once per PR stage**, after the last review round (5.7). The builder runs only the tests related to what it changed.
- **Later rounds call only the reviewers that need to re-check something** (5.4). The others are carried forward by script.
- **The browser round runs once per run** (5.4), not on every slice or round.
- **Prefer one slice and one PR.** Slicing and stacked PRs are for changes that really need them.

## Language

`flow.json.language` is `en` (English) or `pt-BR` (Brazilian Portuguese). It is referred to below as `<lang>`, and everything the flow produces for people is written in it:
- your messages and questions to the user;
- the spec;
- commit descriptions;
- PR titles and bodies;
- review findings and PR comments.

Code, identifiers and file names stay as they are in the codebase. Conventional commit types and scopes stay as keywords (`feat(orders): …`); only the description follows `<lang>`.

- Pass `Language: <lang>` in **every** agent prompt.
- Pass `--lang <lang>` to `review.mjs payload` and `threads.mjs sync`.

If `language` is missing from `flow.json` (a config created by an older version), ask once with `AskUserQuestion`: "Language / Idioma", with the options "English" and "Português (Brasil)". Write the answer to `flow.json` and tell the user to commit that change.

## Timings

Record every step with `node "${CLAUDE_PLUGIN_ROOT}/scripts/timings.mjs" start .claude/flow-runs/<slug>/state.json <step> [--slice N] [--round R]` when it **starts**. Each `start` closes the previous step. Run `timings.mjs end <state.json>` when the run ends, stops or waits on the user for more than a gate question. Steps: `spec`, `spec-gate`, `build`, `gate`, `review`, `fix`, `full-gate`, `publish`, `recheck`.

`timings.mjs` writes into `state.json`, so **re-read `state.json` before rewriting it**, or change it with targeted edits.

## 0. Mode

| Arguments | Do |
| --------- | -- |
| `--resume <slug>` | Section 9 |
| `--recheck <slug> [NN]` | Section 10 |
| `--restack <slug>` | Section 8 |
| `--finalize <slug>` | Section 7 |
| Any other text | It is the request. Continue from section 1. Strip the flags `--lite`, `--full`, `--stacked`, `--browser` and `--lighthouse` from it and remember them |
| Empty | Ask what to ship (free text), then continue |

## 1. Pre-checks

Run these and confirm each one. If any fails, explain why and stop:

1. `.claude/flow.json` exists. If it doesn't, suggest `/flow:flow-init` and stop.
2. `git status --porcelain` is empty (clean working tree).
3. `gh auth status` is ok.
4. `node --version` ≥ 18.
5. `git fetch origin` succeeds.

Read the whole `flow.json`, including `language` and `prMode`, and the project's `CLAUDE.md` if there is one.

## 2. Triage

Make a single `AskUserQuestion` call, written in `<lang>`, with these questions:

1. **Change type**: feature, bugfix, hotfix, refactor or chore. Put the most likely one first, marked "(Recommended)".
2. **Mode** (skip it when `--lite` or `--full` was passed):
   - **Lite**: one slice, a short spec without an approval step, only the `code` reviewer (plus `security` when the routing hits it), no browser round. Recommend it for bugfix, hotfix and chore, and for any request that clearly touches a few files.
   - **Full**: sliced spec with an approval step, every routed reviewer, browser round. Recommend it for features and broad refactors.
3. **Builder model**: "Opus 5.5 (Recommended)" → `opus`; "Fable" → `fable`.
4. **Base branch**: `flow.json.branches[type]` as "(Recommended)", plus the other relevant branches. Base the suggestion on the type you suggested; if the user picks a different type, confirm the base again afterwards.

Then set:
- `mode`: `lite` or `full`;
- `prMode`: `stacked` when `--stacked` was passed or `flow.json.prMode` is `"stacked"`, otherwise `single`. A lite run is always `single`;
- `browser`: `true` when `flow.json.browser` exists and the mode is full, or when `--browser` was passed;
- `lighthouse`: `true` only when `--lighthouse` was passed and `flow.json.browser.prod` exists.

Generate the `slug`: kebab-case, up to 40 characters, ASCII only, derived from the request (e.g. `checkout-pix`). If `.claude/flow-runs/<slug>/` already exists, append `-2`, `-3`… Create the folder, write the request verbatim to `request.md`, and create `state.json` with `phase: "triage"`, `language`, `mode`, `prMode`, `browser` and `lighthouse` (format in `reference/state.md`).

## 3. Spec

Run `timings.mjs start … spec`. Call `Agent` with `subagent_type: "flow:spec-writer"`, plus `model: "sonnet"` in lite mode (the full mode uses the agent's default). The prompt includes:
- the request, verbatim;
- `Language: <lang>`;
- `Mode: <mode>`;
- the change type and the base branch;
- the output path `.claude/flow-runs/<slug>/spec.md`;
- the rule that lite mode, bugfix and hotfix get **exactly one** slice;
- the `CLAUDE.md` path, if there is one.

Wait for the completion notification. **Save the agent id** in `state.specWriterAgentId`.

### Spec gate

Run `timings.mjs start … spec-gate`.

**Lite mode:** show the user a short summary (goal and acceptance criteria) and continue **without asking for approval**. Only stop to ask if the spec has open questions; send the answers to the same spec writer with `SendMessage`, then continue.

**Full mode:**
1. Read `spec.md` and show the user a summary: the goal, the slices (title, goal, criteria) and the open questions.
2. If there are open questions, ask them first, with `AskUserQuestion` when they are multiple choice.
3. Ask "Approve the spec?" with the options **Approve (Recommended)**, **Request changes** (the user describes them under "Other") and **Cancel**.
4. For changes, send them to the **same** spec writer with `SendMessage` (`to: <id>`). It updates the file. Go back to step 1.

On approval (or right away in lite mode), set `phase: "spec-approved"` and record the slices in `state.slices` with `status: "pending"`.

## 4. Branches

Read `branchPrefix[type]` (e.g. `feat/`).

- **`single` PR mode, or a single slice** (the default): one branch `<prefix><slug>`, created from `origin/<base>`. Every slice is built on it, one after the other, and the run opens **one PR** targeting the base. There is no integration branch.
- **`stacked` PR mode with more than one slice**:
  1. Create the integration branch `<prefix><slug>` from `origin/<base>` and push it.
  2. Slice 01 branches off the integration branch.
  3. Each later slice branches off the previous one (stacked), named `<prefix><slug>-NN-<kebab-summary>`.

Record for each slice, when you start it: `branch`, `parent`, `parentSha` (`git rev-parse <parent>`) and `startSha` (`git rev-parse HEAD` right before the builder starts). The slice diff is always `<startSha>...HEAD`.

## 5. Per-slice loop

Process the slices **in order**, without waiting for merges. For each slice `NN` (folder `slice-NN/`):

### 5.1 Build

1. Single mode: create the run branch for slice 01 (`git switch -c <branch> origin/<base>`) and stay on it for the later slices. Stacked mode: `git switch -c <branch> <parent>`. Set `status: "building"` and `step: "build"`, and run `timings.mjs start … build --slice N`.
2. Call `Agent` with `subagent_type: "flow:builder"` and **`model: "<state.builderModel>"`**. The prompt includes:
   - `Language: <lang>`;
   - the spec path and the slice number, telling the builder to read **only** its slice and the general context;
   - the current branch and the `startSha`;
   - the fast gate commands (`lint`, `typecheck`, `test` from `flow.json.commands`), with the rule: while working, run only the tests related to the slice; run the fast gate once before finishing; **don't run `build` or `e2e`**;
   - if the slice touches web frontend and `commands.e2e` exists: write Playwright tests in `e2e/` for every acceptance criterion (don't run the whole e2e suite);
   - the rules: TDD, conventional commits, no co-author trailers and no mention of AI.
3. Wait for completion and save `builderAgentId`. From now on, **every** return to the builder goes through `SendMessage` to that id. Never start a new builder for the same slice.

### 5.2 Fast gate

Set `step: "gate"` and run `timings.mjs start … gate --slice N`. Run the fast gate commands that exist, in this order: `lint`, `typecheck`, `test`. Stop at the first failure.

- **All pass**: continue.
- **A command fails**:
  1. Save its output to `slice-NN/gate-<attempt>.log`.
  2. Send the failing command and the last ~80 lines of output to the builder via `SendMessage`. It fixes the problem, re-runs **only that command**, and commits.
  3. Run the gate again from the failing command, up to `flow.json.maxGateAttempts` attempts (default 3).
  4. If the attempts run out, set `status: "stopped"`, show the error to the user and **stop the flow**.

After the gate passes, check that everything is committed (`git status --porcelain` is empty). If not, ask the builder to commit.

### 5.3 Routing

Set `step: "route"` and create `slice-NN/round-<R>/`.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/route.mjs" --base <startSha> > .claude/flow-runs/<slug>/slice-NN/round-<R>/route.json
git diff <startSha>...HEAD > .claude/flow-runs/<slug>/slice-NN/round-<R>/diff.patch
```

In round R ≥ 2, also save the incremental diff: `git diff <roundHeads[R-1]>..HEAD > round-<R>/diff-incremental.patch`.

Pick the reviewers for **round 1** (details in `reference/reviewer-routing.md`):
- **Full mode**: every reviewer in `route.json.reviewers`.
- **Lite mode**: `code`, plus `security` when it is in `route.json.reviewers`. Skip `ux` and `ui`.
- **Browser**: run the `browser-tester` only when `state.browser` is `true` and this is the **last slice whose spec says "Touches web frontend: yes"** (if the spec doesn't say, use `route.json.browser`). Earlier frontend slices get only the code-reading reviewers. In single mode the branch accumulates the slices, so the browser round tests all of them at once.

### 5.4 Parallel review

Set `step: "review"` and run `timings.mjs start … review --slice N --round R`. If the browser runs in this round, prepare the server following steps 1–4 of `reference/browser.md`.

**Round R ≥ 2: call only the reviewers that need to re-check something.**
- Call a reviewer again when its findings in round R−1 included a `blocker` or `major`. The `browser-tester` is called again **only for a `blocker`**.
- Every other reviewer that ran in round R−1 is carried forward, without an agent call:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" carry round-<R-1>/<reviewer>.json --response round-<R-1>/builder-response.md --round <R> --out round-<R>/<reviewer>.json
  ```
  This drops the findings the builder reported as `fixed` and marks the `disputed` ones as contested.

Then, **in a single message**, make one `Agent` call per selected reviewer:

| Reviewer | subagent_type |
| -------- | ------------- |
| `code` | `flow:code-reviewer` |
| `security` | `flow:security-reviewer` |
| `ux` | `flow:ux-reviewer` |
| `ui` | `flow:ui-reviewer` |
| `browser` | `flow:browser-tester` |

Each reviewer prompt includes:
- `Language: <lang>`;
- the round number;
- the spec path and the slice number;
- the path to `diff.patch` and the file list (`route.json.files`), with `matched[<area>]` highlighted for area reviewers;
- the checklist paths: `${CLAUDE_PLUGIN_ROOT}/checklists/<area>.md`, plus the project's `.claude/checklists/<area>.md` if it exists. If the project file starts with `<!-- mode: replace -->` it **replaces** the plugin checklist; otherwise it **extends** it;
- the schema path `${CLAUDE_SKILL_DIR}/reference/review-schema.json`;
- **in round R ≥ 2**: that reviewer's own findings from round R−1 (`round-<R-1>/<reviewer>.json`), `builder-response.md` and `diff-incremental.patch`, with the instruction to re-evaluate **only** those findings and the incremental diff.

The `browser-tester` also gets:
- the URL;
- the viewports;
- the **names** (never the values) of the credential variables;
- the production URL for Lighthouse **only when `state.lighthouse` is `true`**; otherwise tell it to skip Lighthouse;
- in single mode, the acceptance criteria of **every slice built so far**, not only this one;
- the `round-<R>/screens/` folder for screenshots.

When it finishes, stop the servers with `devserver.mjs stop` (step 6 of `reference/browser.md`), **even if something failed**.

### 5.5 Validate and consolidate

Set `step: "consolidate"`. For each reviewer that was called in this round:

1. Save the final reply to `round-<R>/<reviewer>.json`. The file name is the value of `reviewer`: `code`, `security`, `ux`, `ui` or `browser`.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" validate round-<R>/<reviewer>.json --write`.
3. If the reply is invalid, send the validator errors to the **same** reviewer via `SendMessage` and ask for corrected JSON, **once**. If it is still invalid, drop that review, note why in the summary and continue without it.

Then consolidate (carried reviewers are already in the folder):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" consolidate .claude/flow-runs/<slug>/slice-NN/round-<R>
```

This writes `consolidated.json` and reports `needsFix` (there is a blocker or major) and `hasBlocker`. Set `roundHeads[R] = HEAD`.

### 5.6 Fix loop

- **`needsFix` and `R < maxReviewRounds`** (default 2):
  1. Set `step: "fix"` and run `timings.mjs start … fix --slice N --round R`.
  2. Send the builder, via `SendMessage`, the findings from `consolidated.json` with id, file, line, evidence and fix:
     - `blocker` and `major`: must be handled;
     - `minor`: fix them **only when the fix is small and inside the slice scope**; otherwise reply `deferred`. This closes most PR threads before they are even opened.
  3. Ask it to reply per id with `fixed`, `disputed: <reason>` or `deferred: <reason>`. Fixes go in `fix(review): …` commits. It runs only the related tests, not the whole gate.
  4. Save the reply to `round-<R>/builder-response.md`.
  5. Go back to **5.2** (fast gate) with `R = R + 1`.
- **Otherwise**: continue to 5.7. If the last round still has a blocker, the slice ships as a **draft**.

A round without a `blocker` or `major` never goes back to the builder: its `minor` and `nit` findings become PR comments.

### 5.7 Full gate

Run it **once**, before publishing:
- **Single mode**: after the **last** slice only (earlier slices skip it).
- **Stacked mode**: on every slice, since each one is its own PR.

Set `step: "full-gate"` and run `timings.mjs start … full-gate --slice N`. Run `build`, then `e2e`, if they exist in `flow.json.commands`. On failure, handle it like 5.2 (same builder, same attempt limit), then run the fast gate once more. Don't start another review round for these fixes.

### 5.8 Publish

Set `step: "publish"` and run `timings.mjs start … publish --slice N`. Follow `reference/github.md` and `reference/pr-body.md`.

**Single mode** (one PR for the whole run):
1. `git push -u origin <branch>`.
2. After slice 01, create the PR **as a draft** targeting the base, with the "Single PR" template (slices that are not done yet are listed as pending). Save `pr` in the state. After later slices, update the body with `gh pr edit <n> --body-file`.
3. Post **one review** for this slice with `review.mjs payload … --slice NN` (findings only, inline where possible; the reviewer summaries go in the review body). Skip it if the slice ended with no findings.
4. After the **last** slice: run `gh pr ready <n>` unless some slice still has a blocker.

**Stacked mode** (one PR per slice):
1. `git push -u origin <branch>`.
2. `gh pr create` targeting the integration branch (or the base for a single slice), with the "Slice PR" template, conventional title and `--draft` if `hasBlocker`. Save `pr` in the state.
3. Post **one review** with `review.mjs payload … --slice NN`.

Then set `status: "pr-open"` (or `"draft"`), `step: "done"`, `reviewedSha` (HEAD) and `pending` (the ids left over: blockers, majors, disputed and deferred findings).

### 5.9 Next slice

- If the slice ended with a **blocker**: **stop the flow** and build nothing on top of it (in single mode the PR stays a draft). Show the pending findings and explain how to continue: the user resolves them and runs `/flow:ship --resume <slug>`.
- Otherwise, move to the next slice. Stacked mode: its `parent` is this slice's branch. Single mode: it continues on the same branch.

## 6. End of the run

Run `timings.mjs end <state.json>` and then `timings.mjs report <state.json>`. When every slice is done (or the flow stopped), show:
- a table with slice, branch, PR, status and pending findings;
- the timings table from the report, so the user sees where the time went;
- the next steps:
  - **single mode**: review and merge the PR. If someone fixes the open comments by hand, `/flow:ship --recheck <slug>` verifies them and resolves the threads. For a hotfix with back-merge, run `/flow:ship --finalize <slug>` after the merge;
  - **stacked mode**: merge the slices **in order** (01, 02, 03…); after each merge, run `/flow:ship --restack <slug>` if the remaining slices need to be replayed; once every slice is in the integration branch (or, for a hotfix, once it is merged into `main`), run `/flow:ship --finalize <slug>`.

Set `phase: "slices"`, or `stopped` with a `stopReason`.

## 7. `--finalize <slug>`

1. Read `state.json` and run `git fetch origin`. Refresh each PR's state with `gh pr view <n> --json state,mergedAt`.
2. **Stacked, with an integration branch**: every slice must be `MERGED` into it. If any is missing, list it and stop. Otherwise, open the integration → base PR with the "Final PR" template (a summary of every slice plus inherited pending findings), and save `finalPr`.
3. **Hotfix with `flow.json.hotfixBackMerge`**: the hotfix PR must be `MERGED`. Open the back-merge PR as described in `reference/github.md`, and save `backMergePr`.
4. **Single PR, not a hotfix**: there is nothing to finalize beyond confirming the merge. Say so.
5. Set `phase: "finalized"`.

## 8. `--restack <slug>`

Only for stacked mode. In single mode, say there is nothing to restack and stop.

1. Run `git fetch origin`. Find which slices are already merged into the integration branch (`gh pr view`) and mark them `merged`.
2. For each open slice, in order: rebase the first unmerged slice onto `origin/<integration>`, and each later one onto the rewritten previous slice. Use `git rebase --onto` with the recorded `parentSha` (commands in `reference/github.md`).
3. If a conflict is **simple**, resolve it, run the fast gate (5.2) and continue. If it is a **logic conflict**, run `git rebase --abort`, stop, and show the files and both sides.
4. Run `git push --force-with-lease`. Update `parent`, `parentSha` and `headSha`. If the previous slice was merged, edit the PR description to remove "Depends on" when there is no open dependency left.
5. Show the updated table.

## 9. `--resume <slug>`

1. Read `state.json` (including `language`, `mode` and `prMode`, which win over `flow.json` for this run) and check git and GitHub: the current branch, commits and PRs. If the state does not match reality, show the difference and ask how to proceed.
2. Resume from the recorded `phase` and `step`:
   - `spec` not yet approved: go back to the spec gate;
   - `slices`: continue the first slice that is not `pr-open`, `merged` or a resolved `draft`, from its `step`.
3. **Draft slice**: ask whether the user has resolved the pending findings, or wants the builder to fix them.
   - Resolved, or "let the builder fix them": run a recheck round for that slice (section 10, with the builder fixing first in the second case), then continue to the next slice.
   - Neither: stop.
4. **Builder from another session**: try `SendMessage` to `builderAgentId`. If it is refused because the agent does not exist in this session, start a new `flow:builder` with the same `model`, and give it the slice section, `git log <startSha>..HEAD --oneline` and the pending findings. Save the new id.

## 10. `--recheck <slug> [NN]`

Verifies the findings still open on the PR (fixed by hand, by the builder, or in a later commit), replies and **resolves the threads that were fixed**, and comments only what is new. Without `NN`, it covers every slice with an open PR.

For each slice:
1. Run `timings.mjs start … recheck --slice N`. Run `git fetch origin`, switch to the slice branch and fast-forward it (`git merge --ff-only origin/<branch>`). If it doesn't fast-forward, stop and ask.
2. List the open flow threads:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/threads.mjs" list --pr <n> --slice NN > slice-NN/recheck-threads.json
   ```
   The ids to verify are the ones in those threads plus `pending`. If there are none, say so and move on.
3. Ask, with `AskUserQuestion`: **Only verify (Recommended)** or **Let the builder fix them first**. When fixing: send the open findings to the builder (5.6 rules, every severity), save its reply as `round-<R>/builder-response.md` of the new round, push.
4. Run the fast gate (5.2).
5. New round `R = last round + 1`. Save `diff-incremental.patch` as `git diff <reviewedSha>..HEAD`. Call only the reviewers that own an open id (by prefix: `SEC` security, `UX` ux, `UI` ui, `CODE` code, `BRW` browser — the browser needs the server from `reference/browser.md`). Give each one its open findings from the last round and the incremental diff, with the instruction to re-evaluate **only** those findings against the current code. Carry the other reviewers of the last round with `review.mjs carry` (with `--response` only when the builder fixed). Validate and consolidate as in 5.5.
6. Resolve what was fixed:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/threads.mjs" sync --pr <n> --slice NN --current slice-NN/round-<R>/consolidated.json --commit $(git rev-parse HEAD) --lang <lang>
   ```
   It replies "fixed in `<sha>`" on each thread whose findings are gone and resolves it.
7. Build the payload with `--skip-open slice-NN/recheck-threads.json`. Post it only when it reports at least one new finding.
8. If the PR is a draft and no blocker is left anywhere in the run, run `gh pr ready <n>`. Update `pending`, `reviewedSha` and `round`.

Show how many threads were resolved and what is still open, then run `timings.mjs end`.

## General rules

- Write `state.json` at the end of **every** step (re-read it first: `timings.mjs` writes into it).
- Never use `git push --force` without `--force-with-lease`. Never push directly to the base or integration branch, except when creating the integration branch.
- Never commit anything under `.claude/flow-runs/`.
- No AI attribution in commits, PRs or comments.
- When calling agents in parallel, use **one** message with several calls. Wait for every notification before consolidating.
- Keep the user posted with one line per step (e.g. "Slice 02: round 1 — code and security running"), in `<lang>`.
