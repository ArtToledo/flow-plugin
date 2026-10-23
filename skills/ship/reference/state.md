# Run state

Everything `/ship` produces lives in `.claude/flow-runs/<slug>/`, which is in `.gitignore`.

```
.claude/flow-runs/<slug>/
  state.json
  request.md                      # original request, verbatim
  spec.md                         # approved spec (sliced)
  pr-body.md                      # single mode: body of the run's PR
  slice-01/
    gate-<attempt>.log            # output of a failed quality gate
    recheck-threads.json          # open flow threads listed by --recheck
    round-1/
      diff.patch                  # git diff <startSha>...HEAD for the slice
      diff-incremental.patch      # round 2+: git diff <previous round head>..HEAD
      route.json                  # output of scripts/route.mjs
      code.json  security.json …  # reply of each reviewer (called or carried forward)
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
  "mode": "full",
  "prMode": "single",
  "browser": true,
  "lighthouse": false,
  "nature": "feature",
  "builderModel": "opus",
  "base": "dev",
  "integration": null,
  "pr": { "number": 41, "url": "https://github.com/o/r/pull/41", "draft": false },
  "phase": "slices",
  "createdAt": "2026-10-21T14:00:00Z",
  "updatedAt": "2026-10-21T15:10:00Z",
  "slices": [
    {
      "n": 1,
      "title": "model",
      "branch": "feat/checkout",
      "parent": "dev",
      "parentSha": "abc1234",
      "startSha": "abc1234",
      "status": "pr-open",
      "step": "done",
      "builderAgentId": "a1b2c3",
      "gateAttempts": 1,
      "round": 2,
      "headSha": "def5678",
      "roundHeads": { "1": "aaa1111", "2": "def5678" },
      "reviewedSha": "def5678",
      "pr": { "number": 41, "url": "https://github.com/o/r/pull/41", "draft": false },
      "pending": ["SEC-002"]
    }
  ],
  "timings": [
    { "step": "spec", "slice": null, "round": null, "start": "2026-10-21T14:00:10Z", "end": "2026-10-21T14:03:40Z" },
    { "step": "build", "slice": 1, "round": null, "start": "2026-10-21T14:05:00Z", "end": "2026-10-21T14:21:30Z" }
  ],
  "finalPr": null,
  "backMergePr": null
}
```

| Field | Values |
| ----- | ------ |
| `language` | `en` or `pt-BR`, copied from `flow.json` at the start. It stays fixed for the whole run, including `--resume`. |
| `mode` | `lite` or `full`, chosen at triage. |
| `prMode` | `single` (one branch and one PR for the run, the default) or `stacked` (one PR per slice on an integration branch). |
| `browser` / `lighthouse` | Whether the browser round and the Lighthouse measurement run in this run. |
| `integration` | The integration branch in stacked mode; `null` otherwise. |
| `pr` | Single mode: the run's PR. In stacked mode each slice has its own `pr`. |
| `phase` | `triage` → `spec` → `spec-approved` → `slices` → `finalized`, or `stopped` with a `stopReason` |
| `slices[].status` | `pending`, `building`, `reviewing`, `pr-open`, `draft`, `merged`, `stopped` |
| `slices[].step` | `build`, `gate`, `route`, `review`, `consolidate`, `fix`, `full-gate`, `publish`, `done` |
| `parent` | The branch the slice was cut from: the integration branch (slice 01), the previous slice (stacked) or the base (single mode). |
| `startSha` | HEAD right before the builder started the slice. The slice diff is `<startSha>...HEAD`, in both modes. |
| `reviewedSha` | HEAD when the slice's review was last posted. `--recheck` diffs from it. |
| `parentSha` | The `parent` SHA when the slice was created. Used by `--restack`. |
| `roundHeads` | The slice HEAD at the end of each round. Round R uses `roundHeads[R-1]` for the incremental diff. |
| `timings` | Written by `scripts/timings.mjs` (`start` per step, `end` when the run stops). `timings.mjs report` turns it into a table per slice and step. Re-read `state.json` before rewriting it so these entries are not lost. |

When resuming, git and GitHub are the source of truth, and `state.json` tells you where to look. If they disagree (e.g. a deleted branch or a closed PR), stop and ask the user.
