# Run state

Everything `/ship` produces lives in `.claude/flow-runs/<slug>/`, which is in `.gitignore`.

```
.claude/flow-runs/<slug>/
  state.json
  request.md                      # original request, verbatim
  spec.md                         # approved spec (sliced)
  slice-01/
    gate-<attempt>.log            # output of a failed quality gate
    round-1/
      diff.patch                  # git diff <base>...HEAD for the slice
      route.json                  # output of scripts/route.mjs
      code.json  security.json …  # validated reply of each reviewer
      consolidated.json           # output of scripts/review.mjs consolidate
      builder-response.md         # builder replies to the findings
      screens/                    # browser-tester screenshots
    round-2/ …
    pr-review.json                # payload sent to GitHub
  .playwright/                    # raw Playwright MCP output (moved into screens/)
  server/                         # dev server pid and log
```

## state.json

Write `state.json` **every time** a step finishes, before starting the next one. This file is what makes `--resume` possible.

```json
{
  "slug": "checkout",
  "request": "Add PIX checkout",
  "language": "en",
  "nature": "feature",
  "builderModel": "opus",
  "base": "dev",
  "integration": "feat/checkout",
  "phase": "slices",
  "createdAt": "2026-10-21T14:00:00Z",
  "updatedAt": "2026-10-21T15:10:00Z",
  "slices": [
    {
      "n": 1,
      "title": "model",
      "branch": "feat/checkout-01-model",
      "parent": "feat/checkout",
      "parentSha": "abc1234",
      "status": "pr-open",
      "step": "done",
      "builderAgentId": "a1b2c3",
      "gateAttempts": 1,
      "round": 2,
      "headSha": "def5678",
      "roundHeads": { "1": "aaa1111", "2": "def5678" },
      "pr": { "number": 41, "url": "https://github.com/o/r/pull/41", "draft": false },
      "pending": ["SEC-002"]
    }
  ],
  "finalPr": null,
  "backMergePr": null
}
```

| Field | Values |
| ----- | ------ |
| `language` | `en` or `pt-BR`, copied from `flow.json` at the start. It stays fixed for the whole run, including `--resume`. |
| `phase` | `triage` → `spec` → `spec-approved` → `slices` → `finalized`, or `stopped` with a `stopReason` |
| `slices[].status` | `pending`, `building`, `reviewing`, `pr-open`, `draft`, `merged`, `stopped` |
| `slices[].step` | `build`, `gate`, `route`, `review`, `consolidate`, `fix`, `push`, `pr`, `comments`, `done` |
| `parent` | The branch the slice was cut from: the integration branch (slice 01), the previous slice (stacked) or the base (single slice). |
| `parentSha` | The `parent` SHA when the slice was created. Used by `--restack`. |
| `roundHeads` | The slice HEAD at the end of each round. Round 2 uses `roundHeads["1"]` for the incremental diff. |

When resuming, git and GitHub are the source of truth, and `state.json` tells you where to look. If they disagree (e.g. a deleted branch or a closed PR), stop and ask the user.
