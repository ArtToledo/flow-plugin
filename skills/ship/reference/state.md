# Estado de execução

Tudo que o `/ship` gera fica em `.claude/flow-runs/<slug>/`, que está no `.gitignore`.

```
.claude/flow-runs/<slug>/
  state.json
  request.md                      # pedido original, como o usuário escreveu
  spec.md                         # spec aprovada (fatiada)
  slice-01/
    gate-<tentativa>.log          # saída do quality gate que falhou
    round-1/
      diff.patch                  # git diff <base>...HEAD da fatia
      route.json                  # saída de scripts/route.mjs
      code.json  security.json …  # resposta validada de cada revisor
      consolidated.json           # saída de scripts/review.mjs consolidate
      builder-response.md         # respostas do builder aos achados
      screens/                    # screenshots do browser-tester
    round-2/ …
    pr-review.json                # payload enviado ao GitHub
  .playwright/                    # saída bruta do Playwright MCP (movida para screens/)
  server/                         # pid e log do servidor de dev
```

## state.json

Grave o `state.json` **sempre** que uma etapa terminar, antes de começar a próxima. É ele que permite o `--resume`.

```json
{
  "slug": "checkout",
  "request": "Adicionar checkout com PIX",
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
      "title": "modelo",
      "branch": "feat/checkout-01-modelo",
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

| Campo | Valores |
| ----- | ------- |
| `phase` | `triage` → `spec` → `spec-approved` → `slices` → `finalized` (ou `stopped`, com `stopReason`) |
| `slices[].status` | `pending`, `building`, `reviewing`, `pr-open`, `draft`, `merged`, `stopped` |
| `slices[].step` | `build`, `gate`, `route`, `review`, `consolidate`, `fix`, `push`, `pr`, `comments`, `done` |
| `parent` | Branch de onde a fatia saiu: integração (fatia 01), a fatia anterior (empilhada) ou a base (fatia única). |
| `parentSha` | SHA da `parent` no momento em que a fatia foi criada; usado no `--restack`. |
| `roundHeads` | HEAD da fatia no fim de cada rodada; a rodada 2 usa `roundHeads["1"]` para o diff incremental. |

Ao retomar, a fonte de verdade é o git e o GitHub; o `state.json` diz onde olhar. Se divergirem (ex.: branch apagada, PR fechado), pare e pergunte.
