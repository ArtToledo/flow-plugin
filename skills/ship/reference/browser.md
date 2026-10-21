# Rodada de navegador

Ela roda quando `route.json` traz `"browser": true`, o que exige `flow.json.browser` configurado e uma fatia que toque frontend web. O `browser-tester` usa o Playwright MCP declarado no `.mcp.json` do plugin, sem configuração extra por projeto.

## Configuração (`flow.json.browser`)

```json
{
  "devCommand": "npm run dev",
  "url": "http://localhost:3000",
  "readyPath": "/health",
  "seedCommand": "npm run db:seed:test",
  "testUser": { "fromEnv": ["E2E_USER", "E2E_PASSWORD"] },
  "viewports": [320, 768, 1280],
  "prod": { "buildCommand": "npm run build", "startCommand": "npm run start", "url": "http://localhost:3000" }
}
```

`seedCommand`, `testUser` e `prod` são opcionais. Sem `prod`, a medição de Core Web Vitals com Lighthouse é pulada, e o resumo deixa isso explícito.

## Sequência (feita pela skill, na sessão principal)

1. **Credenciais**: se houver `testUser.fromEnv`, confira se as variáveis existem. Use `test -n "$E2E_USER"` e nunca imprima o valor. Se faltar alguma, pule o login, avise e siga com as telas públicas. Não use contas reais.
2. **Seed**: rode `seedCommand`, se existir. Se falhar, pare a rodada de navegador, mas continue com os revisores, e registre a falha como achado `major` do `browser`, com `file: "flow.json"` e `line: null`.
3. **Subir o servidor**:
   ```bash
   node "<plugin>/scripts/devserver.mjs" start --name dev --cmd "<devCommand>" --url "<url>" --ready "<readyPath>" --dir .claude/flow-runs/<slug>/server
   ```
   Se não subir, trate como o seed.
4. **Lighthouse (só com `prod`)**: rode `buildCommand` e depois `devserver.mjs start --name prod --cmd "<startCommand>" --url "<prod.url>"`. Se a porta for a mesma do dev, derrube o dev antes e suba de novo depois.
5. **Chamar o `browser-tester`** na mesma mensagem dos revisores, em paralelo com eles, usando o prompt descrito em `SKILL.md`.
6. **Derrubar**: `devserver.mjs stop --name dev` (e `--name prod`), **sempre**, inclusive quando houver erro. Confira que nenhum processo ficou na porta.
7. Os screenshots que o agente salvou ficam em `slice-NN/round-N/screens/`. O resumo vai para o comentário do revisor `browser` no PR, e os arquivos não são commitados.

## Regras de severidade do browser-tester

- Critério de aceite que falha na tela é sempre `blocker`.
- Erro no console, ou requisição 4xx/5xx inesperada, é `major`.
- Violação de axe-core `serious`/`critical` é `major`; `moderate` é `minor`; `minor` é `nit`.
- Rolagem horizontal em 320 px, ou elemento sobreposto ou cortado, é `major`.
- Fluxo novo que não funciona só pelo teclado é `major`.
- Core Web Vitals acima do limite (LCP > 2,5 s, INP/TBT alto, CLS > 0,1) é `major`; perto do limite é `minor`.
