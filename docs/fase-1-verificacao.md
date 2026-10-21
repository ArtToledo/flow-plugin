# Fase 1: verificação de formatos

Verificado em 2026-10-21, com o Claude Code 2.1.306, contra a documentação em code.claude.com/docs (plugins-reference, plugin-marketplaces, skills, sub-agents, mcp).

## Resultados dos testes

| Verificação | Como | Resultado |
| ----------- | ---- | --------- |
| Repo como plugin e marketplace com `"source": "./"` | `claude plugin validate .` | ✅ passa. Avisos: só o ícone, que é exigido apenas pelo diretório oficial |
| Skills de plugin com namespace | `claude -p --plugin-dir . "/flow:vartest foo --bar"` | ✅ `/flow:<skill>` |
| `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}` e `$ARGUMENTS` no corpo do `SKILL.md` | mesma skill de teste | ✅ substituídos (`C:/lm/flow-plugin`, `…/skills/vartest`, `foo --bar`) |
| Agente de plugin como `flow:<nome>` | `Agent(subagent_type: "flow:smoke")` | ✅ |
| `model` do frontmatter | `smoke` com `model: haiku`, chamado sem `model` | ✅ `claude-haiku-5-5` |
| `model` da chamada sobrepõe o frontmatter | mesma chamada com `model: "sonnet"` | ✅ `claude-sonnet-5-5` |
| SendMessage retoma com contexto | token passado na 1ª chamada e pedido de volta via SendMessage | ✅ o agente devolveu o token |
| Pacote do Playwright MCP | `npm view @playwright/mcp` | ✅ `@playwright/mcp@0.0.83`, bin `playwright-mcp`, Node ≥ 18 |

A skill `vartest` e o agente `smoke` eram temporários e foram removidos depois dos testes.

## Formatos confirmados

- **`plugin.json`** fica em `.claude-plugin/`. O único campo obrigatório é `name`. Sem `version`, `description` ou `author`, o validador só avisa. Os componentes ficam na raiz do plugin: `skills/`, `agents/`, `hooks/hooks.json` e `.mcp.json`.
- **`marketplace.json`** também fica em `.claude-plugin/` e exige `name`, `owner.name` e `plugins[]`, cada entrada com `name` e `source`. Fontes relativas começam com `./`, são resolvidas a partir da pasta que contém `.claude-plugin/` e não podem conter `..`. A versão fica só no `plugin.json`, porque, se aparecer nos dois arquivos, o `plugin.json` vence e o validador avisa.
- **Skills**: `skills/<nome>/SKILL.md`, com namespace `/flow:<nome>`. Usamos `name`, `description`, `argument-hint` e `disable-model-invocation: true`, para que o fluxo só rode quando o usuário chamar. O SKILL.md deve ter menos de 500 linhas; detalhes vão em `reference/`.
- **Agentes**: `agents/<nome>.md`, com `name` e `description` obrigatórios, e `tools`, `disallowedTools`, `model` e `color` opcionais.
  - Em plugin, **os campos `hooks`, `mcpServers` e `permissionMode` são ignorados**. Por isso o "modo de planejamento" do spec-writer é garantido pelas ferramentas (sem Edit/Bash) e pelas instruções, não pelo `permissionMode`.
  - Por isso também o Playwright MCP é declarado no `.mcp.json` do plugin, e não no frontmatter do `browser-tester`. Esse agente omite `tools`, herdando as ferramentas do MCP, e usa `disallowedTools` para bloquear a edição.
- **MCP**: `.mcp.json` na raiz do plugin, carregado sempre que o plugin está ativo.

## Pontos em aberto

- O `.mcp.json` sobe o Playwright MCP (`npx`) em toda sessão com o plugin ativo. Se isso pesar, a alternativa é mover o servidor para um plugin separado (`flow-browser`).
- O `--output-dir` relativo do Playwright MCP depende de o servidor herdar o diretório do projeto como `cwd`. Para não depender disso, o `browser-tester` move os screenshots para a pasta da rodada usando o caminho que a ferramenta devolve.
- Retomar um builder por `SendMessage` funciona dentro da mesma sessão. Num `--resume` em outra sessão, o `/ship` tenta e, se não conseguir, cria um builder novo com o contexto da fatia.
