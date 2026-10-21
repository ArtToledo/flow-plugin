# Phase 1: format verification

Checked on 2026-10-21 against Claude Code 2.1.306 and the documentation at code.claude.com/docs (plugins-reference, plugin-marketplaces, skills, sub-agents, mcp).

## Test results

| Check | How | Result |
| ----- | --- | ------ |
| Repo is both plugin and marketplace with `"source": "./"` | `claude plugin validate .` | ✅ passes; the only warning is the missing icon, which matters only for the official directory |
| Namespaced plugin skills | `claude -p --plugin-dir . "/flow:vartest foo --bar"` | ✅ `/flow:<skill>` |
| `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}` and `$ARGUMENTS` in the `SKILL.md` body | same test skill | ✅ substituted (`C:/lm/flow-plugin`, `…/skills/vartest`, `foo --bar`) |
| Plugin agent available as `flow:<name>` | `Agent(subagent_type: "flow:smoke")` | ✅ |
| Frontmatter `model` | `smoke` with `model: haiku`, called without `model` | ✅ `claude-haiku-5-5` |
| Call `model` overrides the frontmatter | same call with `model: "sonnet"` | ✅ `claude-sonnet-5-5` |
| `SendMessage` resumes with context | token passed in the first call, then asked for via `SendMessage` | ✅ the agent returned the token |
| Playwright MCP package | `npm view @playwright/mcp` | ✅ `@playwright/mcp@0.0.83`, bin `playwright-mcp`, Node ≥ 18 |
| Installed plugin loads agents and MCP | `claude plugin marketplace add` + `install`, then a probe session | ✅ the 7 `flow:*` agents and the `browser_*` tools load |

The `vartest` skill and the `smoke` agent were temporary and were removed after the tests.

## Confirmed formats

**`plugin.json`**
- It lives in `.claude-plugin/`, and `name` is its only required field. A missing `version`, `description` or `author` only produces a warning.
- Components live at the plugin root: `skills/`, `agents/`, `hooks/hooks.json` and `.mcp.json`.

**`marketplace.json`**
- It also lives in `.claude-plugin/`. It requires `name`, `owner.name` and `plugins[]`, and each entry requires `name` and `source`.
- Relative sources start with `./`, resolve from the folder that contains `.claude-plugin/`, and may not contain `..`.
- The version lives only in `plugin.json`. If both files declare one, `plugin.json` wins and the validator warns.

**Skills**
- They live in `skills/<name>/SKILL.md`, namespaced as `/flow:<name>`.
- We use `name`, `description`, `argument-hint` and `disable-model-invocation: true`, so the flow runs only when the user asks for it. That flag also hides the skills from the model's skill list, which is expected.
- Keep `SKILL.md` under 500 lines; details go in `reference/`.

**Agents**
- They live in `agents/<name>.md`. `name` and `description` are required; `tools`, `disallowedTools`, `model` and `color` are optional.
- Plugin agents **ignore the `hooks`, `mcpServers` and `permissionMode` fields**. That has two consequences:
  - The spec-writer's "planning mode" is enforced by its tool list (no Edit or Bash) and its instructions, not by `permissionMode`.
  - Playwright MCP is declared in the plugin's `.mcp.json` rather than in the `browser-tester` frontmatter. The agent leaves out `tools`, so it inherits the MCP tools, and uses `disallowedTools` to block editing.

**MCP**
- `.mcp.json` at the plugin root is loaded whenever the plugin is enabled.

## Language

Language support came after phase 1. `flow.json.language` (`en` or `pt-BR`) is chosen in `/flow:flow-init` and passed to every agent as `Language: <lang>`. The text that the scripts generate for PRs comes from `scripts/lib/i18n.mjs`.

## Open points

- `.mcp.json` starts the Playwright MCP server (`npx`) in every session where the plugin is enabled. If that gets heavy, it can move to a separate `flow-browser` plugin.
- Playwright MCP's relative `--output-dir` assumes the server inherits the project folder as its `cwd`. To avoid depending on that, the `browser-tester` moves its screenshots into the round folder using the path the tool returns.
- Resuming a builder with `SendMessage` works within the same session. When `--resume` runs in another session, `/ship` tries anyway and falls back to a new builder that gets the slice context.
