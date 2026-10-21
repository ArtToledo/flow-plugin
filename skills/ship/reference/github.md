# GitHub and git commands

Everything goes through `gh`, which is already authenticated. Get `{owner}/{repo}` from `gh repo view --json nameWithOwner -q .nameWithOwner`.

## Push and slice PR

```bash
git push -u origin <branch>
gh pr create --base <integration or base> --head <branch> --title "<title>" --body-file <file> [--draft]
gh pr view <branch> --json number,url,isDraft
```

Write the body to a file inside the slice folder and pass it with `--body-file`. Never pass long Markdown inline.

## Comments

1. **One summary comment per reviewer that ran:**
   ```bash
   node "<plugin>/scripts/review.mjs" summary <round>/consolidated.json --reviewer security --lang <lang> > <round>/summary-security.md
   gh pr comment <n> --body-file <round>/summary-security.md
   ```
2. **Findings with a line, posted as an inline review (always the `COMMENT` event):**
   ```bash
   git fetch origin <pr-target-branch>
   git diff origin/<pr-target-branch>...HEAD > <slice>/pr.diff
   node "<plugin>/scripts/review.mjs" payload <last round>/consolidated.json --diff <slice>/pr.diff --commit $(git rev-parse HEAD) --lang <lang> --out <slice>/pr-review.json
   gh api repos/{owner}/{repo}/pulls/<n>/reviews --method POST --input <slice>/pr-review.json
   ```
   The script only posts inline the findings whose lines are in the PR diff. The rest, and the nits, are grouped in the review body.

   If `gh api` fails with 422 (a line outside the diff), remove `comments` from the payload, move them into the body and send it again. Don't lose any findings.

`pr.diff` must be the same diff the PR shows, so its base is always the PR's target branch (the integration branch or the base), not the `parent`. On a stacked slice whose predecessors are not merged yet, the PR also shows the earlier slices. That is expected.

## Draft

- A PR that still has a blocker after the last round is created with `--draft`.
- Once the user resolves it, mark it ready with `gh pr ready <n>`.

## Restack (rebasing stacked slices)

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
