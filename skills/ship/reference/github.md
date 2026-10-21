# Comandos de GitHub e git

Todos via `gh`, já autenticado. `{owner}/{repo}` sai de `gh repo view --json nameWithOwner -q .nameWithOwner`.

## Push e PR de fatia

```bash
git push -u origin <branch>
gh pr create --base <integração ou base> --head <branch> --title "<título>" --body-file <arquivo> [--draft]
gh pr view <branch> --json number,url,isDraft
```

Escreva o corpo num arquivo dentro da pasta da fatia e use `--body-file`; nunca passe Markdown longo inline.

## Comentários

1. **Um comentário-resumo por revisor que rodou:**
   ```bash
   node "<plugin>/scripts/review.mjs" summary <round>/consolidated.json --reviewer security > <round>/summary-security.md
   gh pr comment <n> --body-file <round>/summary-security.md
   ```
2. **Achados com linha como review inline (evento sempre `COMMENT`):**
   ```bash
   git fetch origin <branch-alvo-do-PR>
   git diff origin/<branch-alvo-do-PR>...HEAD > <slice>/pr.diff
   node "<plugin>/scripts/review.mjs" payload <última rodada>/consolidated.json --diff <slice>/pr.diff --commit $(git rev-parse HEAD) --out <slice>/pr-review.json
   gh api repos/{owner}/{repo}/pulls/<n>/reviews --method POST --input <slice>/pr-review.json
   ```
   O script só põe inline os achados cujas linhas estão no diff do PR; o resto e os nits vão agrupados no corpo da review. Se o `gh api` falhar com 422 (linha fora do diff), apague `comments` do payload, mova-os para o corpo e reenvie. Não perca achados.

O `pr.diff` precisa ser o mesmo diff que o PR mostra, por isso a base é sempre a branch-alvo do PR (a integração ou a base), não a `parent`. Numa fatia empilhada ainda não mergeada, o PR também mostra as fatias anteriores; isso é esperado.

## Draft

- PR com blocker pendente após a última rodada nasce como `--draft`.
- Para tirar do draft depois que o usuário resolver: `gh pr ready <n>`.

## Restack (rebase das fatias empilhadas)

Quando a fatia `k` é mergeada na integração (com squash, rebase ou merge commit), cada fatia seguinte é reaplicada sobre o novo ponto:

```bash
git fetch origin
# fatia k+1 saiu de k; troca a base antiga (parentSha) pela integração atualizada
git rebase --onto origin/<integração> <parentSha de k+1> <branch k+1>
# fatias k+2… continuam empilhadas sobre a fatia anterior, já reescrita
git rebase --onto <branch k+1> <parentSha de k+2> <branch k+2>
git push --force-with-lease origin <branch>
```

Atualize `parent`/`parentSha` no `state.json` após cada rebase. Conflito:

- **Simples** (imports, lockfile, formatação, trechos adjacentes sem mudança de comportamento): resolva, `git rebase --continue`, rode o quality gate.
- **De lógica** (as duas versões mudam comportamento): `git rebase --abort`, pare e chame o usuário com os arquivos em conflito.

## Back-merge de hotfix

Depois do merge do hotfix em `main`:

```bash
git fetch origin
git switch -c chore/backmerge-<slug> origin/main
git push -u origin chore/backmerge-<slug>
gh pr create --base <hotfixBackMerge> --head chore/backmerge-<slug> --title "chore(release): back-merge <slug> para <dev>" --body-file <arquivo>
```

## Commits

Conventional commits com escopo: `feat(orders): add ownership check`. Correções de review: `fix(review): <o que mudou>`. **Sem trailers de coautoria nem menção a IA** em commits, PRs e comentários.
