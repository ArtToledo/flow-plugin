---
name: ship
description: Runs a change end to end — triage, sliced spec, TDD builder, quality gate, parallel reviewers, fix loop and stacked PRs with findings posted as comments. Use when the user asks to ship, deliver or implement a feature, bugfix, hotfix, refactor or chore in a project that has .claude/flow.json.
argument-hint: "<request> | --resume <slug> | --restack <slug> | --finalize <slug>"
disable-model-invocation: true
---

# /ship

You are the orchestrator. You run in the main session, talk to the user at the gates and delegate the work to the plugin's agents. **You do not write product code**: `flow:builder` implements, and the reviewers review.

- Plugin root: `${CLAUDE_PLUGIN_ROOT}`. Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/` (Node ≥ 18).
- References (read each one when you reach its step, not before):
  - `${CLAUDE_SKILL_DIR}/reference/state.md`: run folders and `state.json`
  - `${CLAUDE_SKILL_DIR}/reference/review-schema.json`: reviewer contract
  - `${CLAUDE_SKILL_DIR}/reference/reviewer-routing.md`: glob routing
  - `${CLAUDE_SKILL_DIR}/reference/browser.md`: browser round
  - `${CLAUDE_SKILL_DIR}/reference/github.md`: push, PRs, comments, restack, back-merge
  - `${CLAUDE_SKILL_DIR}/reference/pr-body.md`: PR templates
- Plugin checklists: `${CLAUDE_PLUGIN_ROOT}/checklists/{security,ux,ui,code}.md`.

Arguments received: `$ARGUMENTS`

## Language

`flow.json.language` is `en` (English) or `pt-BR` (Brazilian Portuguese). It is referred to below as `<lang>`, and everything the flow produces for people is written in it:
- your messages and questions to the user;
- the spec;
- commit descriptions;
- PR titles and bodies;
- review findings and PR comments.

Code, identifiers and file names stay as they are in the codebase. Conventional commit types and scopes stay as keywords (`feat(orders): …`); only the description follows `<lang>`.

- Pass `Language: <lang>` in **every** agent prompt.
- Pass `--lang <lang>` to `review.mjs payload` and `review.mjs summary`.

If `language` is missing from `flow.json` (a config created by an older version), ask once with `AskUserQuestion`: "Language / Idioma", with the options "English" and "Português (Brasil)". Write the answer to `flow.json` and tell the user to commit that change.

## 0. Mode

| Arguments | Do |
| --------- | -- |
| `--resume <slug>` | Section 9 |
| `--restack <slug>` | Section 8 |
| `--finalize <slug>` | Section 7 |
| Any other text | It is the request. Continue from section 1 |
| Empty | Ask what to ship (free text), then continue |

## 1. Pre-checks

Run these and confirm each one. If any fails, explain why and stop:

1. `.claude/flow.json` exists. If it doesn't, suggest `/flow:flow-init` and stop.
2. `git status --porcelain` is empty (clean working tree).
3. `gh auth status` is ok.
4. `node --version` ≥ 18.
5. `git fetch origin` succeeds.

Read the whole `flow.json`, including `language`, and the project's `CLAUDE.md` if there is one.

## 2. Triage

Make a single `AskUserQuestion` call with three questions, written in `<lang>`:

1. **Change type**: feature, bugfix, hotfix, refactor or chore. Put the most likely one first, marked "(Recommended)".
2. **Builder model**: "Opus 5.5 (Recommended)" → `opus`; "Fable" → `fable`.
3. **Base branch**: `flow.json.branches[type]` as "(Recommended)", plus the other relevant branches. Base the suggestion on the type you suggested; if the user picks a different type, confirm the base again afterwards.

Generate the `slug`: kebab-case, up to 40 characters, ASCII only, derived from the request (e.g. `checkout-pix`). If `.claude/flow-runs/<slug>/` already exists, append `-2`, `-3`… Create the folder, write the request verbatim to `request.md`, and create `state.json` with `phase: "triage"` and `language: "<lang>"` (format in `reference/state.md`).

## 3. Spec

Call `Agent` with `subagent_type: "flow:spec-writer"`. The prompt includes:
- the request, verbatim;
- `Language: <lang>`;
- the change type and the base branch;
- the output path `.claude/flow-runs/<slug>/spec.md`;
- the rule that bugfix and hotfix get **exactly one** slice;
- the `CLAUDE.md` path, if there is one.

Wait for the completion notification. **Save the agent id** in `state.specWriterAgentId`.

### Human gate on the spec

1. Read `spec.md` and show the user a summary: the goal, the slices (title, goal, criteria) and the open questions.
2. If there are open questions, ask them first, with `AskUserQuestion` when they are multiple choice.
3. Ask "Approve the spec?" with the options **Approve (Recommended)**, **Request changes** (the user describes them under "Other") and **Cancel**.
4. For changes, send them to the **same** spec writer with `SendMessage` (`to: <id>`). It updates the file. Go back to step 1.
5. On approval, set `phase: "spec-approved"` and record the slices in `state.slices` with `status: "pending"`.

## 4. Branches

Read `branchPrefix[type]` (e.g. `feat/`).

- **More than one slice**:
  1. Create the integration branch `<prefix><slug>` from `origin/<base>` and push it.
  2. Slice 01 branches off the integration branch.
  3. Each later slice branches off the previous one (stacked), named `<prefix><slug>-NN-<kebab-summary>`.
- **Single slice**: the branch `<prefix><slug>` comes straight from `origin/<base>`. There is no integration branch, and the PR targets the base.

Create a slice's branch only when you start working on it. Record `branch`, `parent` and `parentSha` (`git rev-parse <parent>`) at that point.

## 5. Per-slice loop

Process the slices **in order**, without waiting for merges. For each slice `NN` (folder `slice-NN/`):

### 5.1 Build

1. Run `git switch -c <branch> <parent>`. Set `status: "building"` and `step: "build"`.
2. Call `Agent` with `subagent_type: "flow:builder"` and **`model: "<state.builderModel>"`**. The prompt includes:
   - `Language: <lang>`;
   - the spec path and the slice number, telling the builder to read **only** its slice and the general context;
   - the current branch and the `parent`;
   - the quality gate commands (`flow.json.commands`);
   - if the slice touches web frontend and `commands.e2e` or `flow.json.browser` exists: write Playwright tests in `e2e/` for every acceptance criterion;
   - the rules: TDD, conventional commits, no co-author trailers and no mention of AI.
3. Wait for completion and save `builderAgentId`. From now on, **every** return to the builder goes through `SendMessage` to that id. Never start a new builder for the same slice.

### 5.2 Quality gate

Set `step: "gate"`. Run each command in `flow.json.commands`, in this order: `lint`, `typecheck`, `test`, `build`, `e2e`. Stop at the first failure.

- **All pass**: continue.
- **A command fails**:
  1. Save its output to `slice-NN/gate-<attempt>.log`.
  2. Send the failing command and the last ~80 lines of output to the builder via `SendMessage`. It fixes the problem and commits.
  3. Run the gate again, up to `flow.json.maxGateAttempts` attempts (default 3).
  4. If the attempts run out, set `status: "stopped"`, show the error to the user and **stop the flow**.

After the gate passes, check that everything is committed (`git status --porcelain` is empty). If not, ask the builder to commit.

### 5.3 Routing

Set `step: "route"` and create `slice-NN/round-<R>/`.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/route.mjs" --base <parent> > .claude/flow-runs/<slug>/slice-NN/round-<R>/route.json
git diff <parent>...HEAD > .claude/flow-runs/<slug>/slice-NN/round-<R>/diff.patch
```

In round 2, also save the incremental diff: `git diff <roundHeads[1]>..HEAD > round-2/diff-incremental.patch`.

### 5.4 Parallel review

Set `step: "review"`. If `route.json.browser` is `true`, prepare the server following steps 1–4 of `reference/browser.md`.

Then, **in a single message**, make one `Agent` call per selected reviewer:

| route.json | subagent_type |
| ---------- | ------------- |
| `code` | `flow:code-reviewer` |
| `security` | `flow:security-reviewer` |
| `ux` | `flow:ux-reviewer` |
| `ui` | `flow:ui-reviewer` |
| `browser: true` | `flow:browser-tester` |

Each reviewer prompt includes:
- `Language: <lang>`;
- the round number;
- the spec path and the slice number;
- the path to `diff.patch` and the file list (`route.json.files`), with `matched[<area>]` highlighted for area reviewers;
- the checklist paths: `${CLAUDE_PLUGIN_ROOT}/checklists/<area>.md`, plus the project's `.claude/checklists/<area>.md` if it exists. If the project file starts with `<!-- mode: replace -->` it **replaces** the plugin checklist; otherwise it **extends** it;
- the schema path `${CLAUDE_SKILL_DIR}/reference/review-schema.json`;
- **in round 2**: round 1's `consolidated.json`, `builder-response.md` and `diff-incremental.patch`, with the instruction to re-evaluate **only** the previous findings and the new diff.

The `browser-tester` also gets:
- the URL;
- the viewports;
- the **names** (never the values) of the credential variables;
- whether `prod` is configured for Lighthouse, and its URL;
- the `round-<R>/screens/` folder for screenshots.

When it finishes, stop the servers with `devserver.mjs stop` (step 6 of `reference/browser.md`), **even if something failed**.

### 5.5 Validate and consolidate

Set `step: "consolidate"`. For each reviewer:

1. Save the final reply to `round-<R>/<reviewer>.json`. The file name is the value of `reviewer`: `code`, `security`, `ux`, `ui` or `browser`.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" validate round-<R>/<reviewer>.json --write`.
3. If the reply is invalid, send the validator errors to the **same** reviewer via `SendMessage` and ask for corrected JSON, **once**. If it is still invalid, drop that review, note why in the summary and continue without it.

Then consolidate:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review.mjs" consolidate .claude/flow-runs/<slug>/slice-NN/round-<R>
```

This writes `consolidated.json` and reports `needsFix` (there is a blocker or major) and `hasBlocker`. Set `roundHeads[R] = HEAD`.

### 5.6 Fix loop

- **`needsFix` and `R < maxReviewRounds`** (default 2):
  1. Set `step: "fix"`.
  2. Send the builder, via `SendMessage`, the `blocker` and `major` findings from `consolidated.json`, with id, file, line, evidence and fix.
  3. Ask it to handle each one and reply per id with `fixed` or `disputed: <reason>`. Fixes go in `fix(review): …` commits.
  4. Save the reply to `round-<R>/builder-response.md`.
  5. Go back to **5.2** (quality gate) with `R = R + 1`.
- **Otherwise**: continue to 5.7. If the last round still has a blocker, the slice ships as a **draft**.

`minor` and `nit` findings never go back to the builder. They become PR comments.

### 5.7 Push, PR and comments

Follow `reference/github.md` and `reference/pr-body.md`:

1. Set `step: "push"` and run `git push -u origin <branch>`.
2. Set `step: "pr"` and run `gh pr create`:
   - target: the integration branch, or the base for a single slice;
   - title: conventional;
   - body: from the template, in `<lang>`;
   - add `--draft` if `hasBlocker`.
   Save `pr` in the state.
3. Set `step: "comments"` and publish:
   - one summary per reviewer (`review.mjs summary --lang <lang>` + `gh pr comment`);
   - the inline review (`review.mjs payload --lang <lang>` + `gh api …/reviews` with the `COMMENT` event).
4. Set `status: "pr-open"` (or `"draft"`), `step: "done"` and `pending` (the ids left over: blockers, majors and disputed findings).

### 5.8 Next slice

- If the slice shipped as a **draft**: **stop the flow** and stack nothing on top of it. Show the pending findings and explain how to continue: the user resolves them and runs `/flow:ship --resume <slug>`.
- Otherwise, move to the next slice, with `parent` set to this slice's branch.

## 6. End of the run

When every slice is done (or the flow stopped), show:
- a table with slice, branch, PR, status and pending findings;
- the next steps:
  - merge the slices **in order**: 01, 02, 03…;
  - after each merge, run `/flow:ship --restack <slug>` if the remaining slices need to be replayed;
  - once every slice is in the integration branch (or, for a hotfix, once it is merged into `main`, for the back-merge), run `/flow:ship --finalize <slug>`.

Set `phase: "slices"`, or `stopped` with a `stopReason`.

## 7. `--finalize <slug>`

1. Read `state.json` and run `git fetch origin`. Refresh each PR's state with `gh pr view <n> --json state,mergedAt`.
2. **With an integration branch**: every slice must be `MERGED` into it. If any is missing, list it and stop. Otherwise, open the integration → base PR with the "Final PR" template (a summary of every slice plus inherited pending findings), and save `finalPr`.
3. **Hotfix with `flow.json.hotfixBackMerge`**: the hotfix PR must be `MERGED`. Open the back-merge PR as described in `reference/github.md`, and save `backMergePr`.
4. **Single slice, not a hotfix**: there is nothing to finalize beyond confirming the merge. Say so.
5. Set `phase: "finalized"`.

## 8. `--restack <slug>`

1. Run `git fetch origin`. Find which slices are already merged into the integration branch (`gh pr view`) and mark them `merged`.
2. For each open slice, in order: rebase the first unmerged slice onto `origin/<integration>`, and each later one onto the rewritten previous slice. Use `git rebase --onto` with the recorded `parentSha` (commands in `reference/github.md`).
3. If a conflict is **simple**, resolve it, run the quality gate (5.2) and continue. If it is a **logic conflict**, run `git rebase --abort`, stop, and show the files and both sides.
4. Run `git push --force-with-lease`. Update `parent`, `parentSha` and `headSha`. If the previous slice was merged, edit the PR description to remove "Depends on" when there is no open dependency left.
5. Show the updated table.

## 9. `--resume <slug>`

1. Read `state.json` (including `language`, which wins over `flow.json` for this run) and check git and GitHub: the current branch, commits and PRs. If the state does not match reality, show the difference and ask how to proceed.
2. Resume from the recorded `phase` and `step`:
   - `spec` not yet approved: go back to the spec gate;
   - `slices`: continue the first slice that is not `pr-open`, `merged` or a resolved `draft`, from its `step`.
3. **Draft slice**: ask whether the user has resolved the pending findings.
   - If yes: run the gate and one extra review round, publish the comments, run `gh pr ready` if no blocker is left, and continue to the next slice.
   - If not: stop.
4. **Builder from another session**: try `SendMessage` to `builderAgentId`. If it is refused because the agent does not exist in this session, start a new `flow:builder` with the same `model`, and give it the slice section, `git log <parent>..HEAD --oneline` and the pending findings. Save the new id.

## General rules

- Write `state.json` at the end of **every** step.
- Never use `git push --force` without `--force-with-lease`. Never push directly to the base or integration branch, except when creating the integration branch.
- Never commit anything under `.claude/flow-runs/`.
- No AI attribution in commits, PRs or comments.
- When calling agents in parallel, use **one** message with several calls. Wait for every notification before consolidating.
- Keep the user posted with one line per step (e.g. "Slice 02: round 1 — code, security and browser running"), in `<lang>`.
