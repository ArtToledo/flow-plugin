# Browser round

This round runs **once per run**: on the last slice whose spec says "Touches web frontend: yes", when `state.browser` is `true` (full mode with `flow.json.browser` configured, or `--browser`). In round 2 or later it runs again only if it found a `blocker`; otherwise its findings are carried forward (`review.mjs carry`). Lite runs skip it unless `--browser` was passed.

The `browser-tester` uses the Playwright MCP server declared in the plugin's `.mcp.json`. Projects don't need any extra setup.

## Configuration (`flow.json.browser`)

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

`seedCommand`, `testUser` and `prod` are optional. Lighthouse needs a production build, which is slow, so it runs **only when `/ship` gets `--lighthouse`** and `prod` is configured. Otherwise the browser-tester skips it and the summary says so.

## Sequence (run by the skill, in the main session)

1. **Credentials**: if `testUser.fromEnv` is set, check that the variables exist with `test -n "$E2E_USER"`. Never print their values. If any is missing, skip login, warn the user, and test only the public screens. Never use real accounts.
2. **Seed**: run `seedCommand` if there is one. If it fails, skip the browser round but keep the reviewers. Record the failure as a `major` `browser` finding with `file: "flow.json"` and `line: null`.
3. **Start the server**:
   ```bash
   node "<plugin>/scripts/devserver.mjs" start --name dev --cmd "<devCommand>" --url "<url>" --ready "<readyPath>" --dir .claude/flow-runs/<slug>/server
   ```
   If it doesn't come up, handle it like a failed seed.
4. **Lighthouse (only when `state.lighthouse` is `true`)**: run `buildCommand`, then `devserver.mjs start --name prod --cmd "<startCommand>" --url "<prod.url>"`. If it uses the same port as dev, stop dev first and start it again afterwards.
5. **Call the `browser-tester`** in the same message as the reviewers, in parallel, with the prompt described in `SKILL.md`.
6. **Stop**: run `devserver.mjs stop --name dev` (and `--name prod`) **always**, including when there was an error. Check that nothing is left on the port.
7. The screenshots saved by the agent go in `slice-NN/round-N/screens/`. The summary goes into the `browser` reviewer's PR comment. The files are not committed.

## browser-tester severity rules

| Situation | Severity |
| --------- | -------- |
| An acceptance criterion fails on screen | `blocker` (always) |
| Console error or unexpected 4xx/5xx request | `major` |
| axe-core violation: `serious` or `critical` | `major` |
| axe-core violation: `moderate` | `minor` |
| axe-core violation: `minor` | `nit` |
| Horizontal scroll at 320 px, or an overlapping or clipped element | `major` |
| A new flow that can't be completed by keyboard alone | `major` |
| Core Web Vitals over the limit (LCP > 2.5 s, high INP/TBT, CLS > 0.1) | `major` |
| Core Web Vitals close to the limit | `minor` |
