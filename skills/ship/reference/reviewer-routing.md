# Reviewer routing

Routing is done by `scripts/route.mjs`. It matches `git diff --name-only <slice-base>...HEAD` against `flow.json.routing`.

| Reviewer            | When it runs                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| `code-reviewer`     | Always                                                                       |
| `security-reviewer` | When a file matches `routing.security`                                       |
| `ux-reviewer`       | When a file matches `routing.ux`                                             |
| `ui-reviewer`       | When a file matches `routing.ui`                                             |
| `browser-tester`    | When `flow.json.browser` exists and a file matches `routing.browser` (or, without it, `ui` or `ux`) |

## Glob syntax

- `*` matches anything within one path segment.
- `**` matches any depth.
- `?` matches one character.
- `{a,b}` matches either alternative.
- A pattern **without** `/` matches the file name in any folder (`Dockerfile`, `package.json`, `*.tf`), as in `.gitignore`.
- A pattern **with** `/` is anchored at the repository root (`src/**/*.tsx`).

## Defaults suggested by /flow-init

Adapt them to the project layout. In a monorepo, prefix them with `apps/web/` and so on.

```json
{
  "ui": ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.css", "**/*.scss", "**/tailwind.config.*"],
  "ux": ["src/app/**", "src/pages/**", "src/screens/**", "app/**/page.*", "**/*form*.*"],
  "security": [
    "**/auth/**", "**/*auth*.*", "**/*.controller.ts", "**/routes/**", "**/middleware*/**",
    "**/migrations/**", "Dockerfile", "docker-compose*.yml", "*.tf", "**/.github/workflows/**",
    "package.json", "*.lock", "package-lock.json", "pnpm-lock.yaml", ".env.example"
  ]
}
```

A file can trigger more than one reviewer. Files that match nothing get only the `code-reviewer`.

## Who is actually called

`route.json` says who *may* review. `/ship` narrows it down to keep runs fast:

| Situation | Reviewers called |
| --------- | ---------------- |
| Full mode, round 1 | Every reviewer in `route.json.reviewers` |
| Lite mode, round 1 | `code`, plus `security` when routed. Never `ux`, `ui` or `browser` (unless `--browser`) |
| Browser | Once per run, on the last slice that touches the web frontend |
| Round 2+ | Only reviewers with a `blocker` or `major` in the previous round (the `browser` redoes only the flows tied to its findings) |
| After full-gate fixes | `code`, plus `security` when the fixes route to it, on the fixes' diff only. Skipped when the full gate passes the first time |
| `--recheck` | Only reviewers that own an open finding (by id prefix) |

Reviewers that are not called again are carried forward with `review.mjs carry`, so `consolidated.json` always covers every reviewer of the slice. Their previous findings stay; the ones the builder reported as `fixed` are marked **unverified** instead of dropped, because only a reviewer can confirm a fix. They are listed in the review body and in `pending`, and `--recheck` confirms them.
