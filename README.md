# flow

**English** · [Português](README.pt-BR.md)

A Claude Code plugin that takes a change from request to pull request. It triages the request, writes a spec split into slices, implements each slice with TDD, runs a quality gate, reviews the code with specialized agents in parallel, sends serious findings back to the builder for a capped number of rounds, and opens stacked PRs with the findings posted as comments on the right lines.

It works in **English or Brazilian Portuguese**, and you choose the language per project.

This repository is both the plugin and the marketplace that distributes it.

## How it works

```
/flow:ship "add PIX checkout"
   │
   ├─ triage ............ change type, builder model, base branch
   ├─ spec-writer ....... spec split into slices (≈400 lines of diff each)
   ├─ human gate ........ you approve the spec or ask for changes
   └─ for each slice
        ├─ builder ...... TDD + conventional commits
        ├─ quality gate . lint, typecheck, tests, build, e2e (from your project)
        ├─ reviewers .... chosen by the files changed, run in parallel
        ├─ fix loop ..... only blocker/major findings, at most 2 rounds
        └─ pull request . inline comments; opens as draft if blockers remain
```

A large feature becomes a series of medium-sized stacked PRs that all target an integration branch. Only the integration branch opens a PR to your base branch. A hotfix goes straight to `main`, and its back-merge PR is opened afterwards.

## Install

```bash
claude plugin marketplace add ArtToledo/flow-plugin
claude plugin install flow@flow-marketplace
```

For local development, run `claude --plugin-dir /path/to/flow-plugin`. After editing plugin files, run `/reload-plugins`.

## Requirements

- Claude Code CLI
- `git` and `gh`, authenticated with `gh auth login`
- Node.js 18 or later (the plugin scripts and the Playwright MCP server need it)

## Usage

| Command | What it does |
| ------- | ------------ |
| `/flow:flow-init` | Asks for the language, maps the project (branches, quality commands, stack, dev server) and writes `.claude/flow.json`. Run it once per project. |
| `/flow:ship <request>` | Runs the full flow for one change. |
| `/flow:ship --resume <slug>` | Resumes an interrupted run. |
| `/flow:ship --restack <slug>` | Rebases the stacked slices after one of them is merged. |
| `/flow:ship --finalize <slug>` | Opens the integration → base PR, or the back-merge PR for a hotfix. |

Run artifacts (spec, findings, state and screenshots) are stored in `.claude/flow-runs/<slug>/`. `/flow:flow-init` adds that folder to `.gitignore`.

## Language

The first thing `/flow:flow-init` asks is which language to use: **English** or **Português (Brasil)**. The answer is saved as `"language": "en"` or `"language": "pt-BR"` in `.claude/flow.json`.

That setting controls everything the flow writes for people:
- the questions it asks you;
- the spec;
- commit descriptions;
- PR titles and bodies;
- review findings and comments.

Code and identifiers keep your codebase's conventions. Conventional commit types and scopes stay as keywords, for example `feat(orders): add ownership check` or `feat(orders): adiciona checagem de dono`.

To switch languages later, edit `language` in `flow.json`. A run already in progress keeps the language it started with.

## Agents

| Agent | Model | Role |
| ----- | ----- | ---- |
| `flow:spec-writer` | Opus | Writes the spec as slices with testable acceptance criteria |
| `flow:builder` | Opus (or Fable, chosen at triage) | The only agent that writes code; uses TDD and conventional commits |
| `flow:code-reviewer` | Sonnet | Runs on every slice: tests, architecture, errors, concurrency, performance |
| `flow:security-reviewer` | Sonnet | OWASP Top 10:2025 and ASVS 5.0 |
| `flow:ux-reviewer` | Sonnet | Nielsen's heuristics and WCAG 2.2 AA behavior |
| `flow:ui-reviewer` | Sonnet | Design tokens, contrast, responsive layout, Core Web Vitals |
| `flow:browser-tester` | Sonnet | Tests the slice in a real browser through Playwright MCP: acceptance criteria, console, network, 3 viewports, keyboard, axe-core, Lighthouse |

The reviewers can't edit code. Each one returns JSON in the format defined in [`skills/ship/reference/review-schema.json`](skills/ship/reference/review-schema.json).

- Only `blocker` and `major` findings go back to the builder, for at most 2 rounds.
- `minor` and `nit` findings become PR comments.
- If a blocker is still open after the last round, the PR opens as a draft, with the open findings listed at the top.

## Design choices

- **The orchestration runs in the main session.** The human gates (triage and spec approval) need to talk to you, and that works reliably there.
- **Deterministic logic lives in scripts, not prompts.** Dependency-free Node scripts in [`scripts/`](scripts/), with unit tests, handle:
  - reviewer routing by glob;
  - review validation and deduplication;
  - inline-comment payloads (only on lines that are in the diff);
  - the dev server lifecycle;
  - the PR text in both languages.
- **The builder keeps its context between rounds.** It is resumed with `SendMessage` instead of being started from scratch, so it remembers why it wrote what it wrote.
- **No AI attribution** is added to commits, PRs or comments.

## Per-project customization

- `.claude/flow.json` holds the language, the base branch for each change type, branch prefixes, quality commands, reviewer routing globs, dev server settings and loop limits.
- `.claude/checklists/<security|ux|ui|code>.md` extends the plugin's checklist. To replace it instead, start the file with `<!-- mode: replace -->`.

## Development

```bash
node --test scripts/test/*.test.mjs
claude plugin validate .
```

The full design is in [`PLAN.md`](PLAN.md) ([Portuguese version](PLAN.pt-BR.md)). The Phase 1 format checks are in [`docs/phase-1-verification.md`](docs/phase-1-verification.md).

## Status

All five phases and the language selection are implemented. The scripts, the plugin installation and the agent loading have been tested. The end-to-end acceptance run on a real feature is still pending.
