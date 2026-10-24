# GitHub and git commands

Everything goes through `gh`, which is already authenticated. Get `{owner}/{repo}` from `gh repo view --json nameWithOwner -q .nameWithOwner`.

## Push and PR

```bash
git push -u origin <branch>
gh pr create --base <base or integration> --head <branch> --title "<title>" --body-file <file> [--draft]
gh pr view <branch> --json number,url,isDraft
```

Write the body to a file inside the run folder and pass it with `--body-file`. Never pass long Markdown inline.

- **Single mode**: after slice 01, create the PR with `--draft`, targeting the base, with the "Single PR" template. After each later slice, push and refresh the body with `gh pr edit <n> --body-file <file>`. After the last slice, run `gh pr ready <n>` unless a blocker or major is left.
- **Stacked mode**: one PR per slice, targeting the integration branch (or the base for a single slice), with the "Slice PR" template.

## Review comments

Each slice gets **one** PR review. The reviewer summaries go in the review body, so there are no separate summary comments.

```bash
git fetch origin <pr-target-branch>
git diff origin/<pr-target-branch>...HEAD > <slice>/pr.diff
node "<plugin>/scripts/review.mjs" payload <last round>/consolidated.json --diff <slice>/pr.diff --commit $(git rev-parse HEAD) --slice NN --lang <lang> --out <slice>/pr-review.json
gh api repos/{owner}/{repo}/pulls/<n>/reviews --method POST --input <slice>/pr-review.json
```

- The script posts inline only the findings whose lines are in the PR diff. The rest, and the nits, are grouped in the review body.
- Each inline comment carries a hidden marker (`<!-- flow:slice=NN ids=CODE-001 -->`). That is how `threads.mjs` finds the thread later to reply and resolve it. Don't edit or remove it.
- If the slice ended with no findings, don't post a review; the PR body already shows the result.
- If `gh api` fails with 422 (a line outside the diff), remove `comments` from the payload, move them into the body and send it again. Don't lose any findings.

`pr.diff` must be the same diff the PR shows, so its base is always the PR's target branch, not the `parent` or `startSha`. In single mode the PR also shows the earlier slices, and on a stacked slice whose predecessors are not merged yet, the PR shows them too. That is expected.

## Resolving threads that were fixed

`--recheck` (and `--resume` on a draft slice) re-reviews the open findings and closes the threads whose findings are gone:

```bash
# open flow threads of the slice (also used as --skip-open, so open findings are not posted twice)
node "<plugin>/scripts/threads.mjs" list --pr <n> --slice NN > <slice>/recheck-threads.json
# after the new round is consolidated: reply "fixed in <sha>" and resolve
node "<plugin>/scripts/threads.mjs" sync --pr <n> --slice NN --current <round>/consolidated.json --commit $(git rev-parse HEAD) --lang <lang>
# post only what is new
node "<plugin>/scripts/review.mjs" payload <round>/consolidated.json --diff <slice>/pr.diff --commit $(git rev-parse HEAD) --slice NN --skip-open <slice>/recheck-threads.json --lang <lang> --out <slice>/pr-review.json
```

`threads.mjs` uses `gh api graphql` (`reviewThreads` and `resolveReviewThread`) and the REST replies endpoint. It only touches threads that carry the flow marker; human comments are never resolved. Add `--dry-run` to `sync` to see what it would resolve.

## Draft

- A PR that still has a blocker or major after the last round stays a draft (single mode) or is created with `--draft` (stacked mode). A blocker also stops the run; a major doesn't.
- Once they are resolved (`--resume` or `--recheck`), mark it ready with `gh pr ready <n>`. A person can also decide to accept a major and mark the PR ready by hand.

## Restack (stacked mode only)

When slice `k` is merged into the integration branch (by squash, rebase or merge commit), each later slice is replayed onto the new point:

```bash
git fetch origin
# slice k+1 was cut from k: swap the old base (parentSha) for the updated integration branch
git rebase --onto origin/<integration> <parentSha of k+1> <branch k+1>
# slices k+2… stay stacked on the previous, already rewritten slice
git rebase --onto <branch k+1> <parentSha of k+2> <branch k+2>
git push --force-with-lease origin <branch>
```

Update `parent` and `parentSha` in `state.json` after each rebase.

If there is a conflict:

- **Simple** (imports, lockfile, formatting, adjacent hunks that don't change behavior): resolve it, run `git rebase --continue` and run the quality gate.
- **Logic** (both sides change behavior): run `git rebase --abort`, stop, and show the user the conflicting files.

## Hotfix back-merge

After the hotfix is merged into `main`:

```bash
git fetch origin
git switch -c chore/backmerge-<slug> origin/main
git push -u origin chore/backmerge-<slug>
gh pr create --base <hotfixBackMerge> --head chore/backmerge-<slug> --title "chore(release): back-merge <slug> into <dev>" --body-file <file>
```

## Commits

Use conventional commits with a scope: `feat(orders): add ownership check`. Review fixes use `fix(review): <what changed>`. The type and scope are keywords; the description follows `<lang>`.

**No co-author trailers and no mention of AI** in commits, PRs or comments.
