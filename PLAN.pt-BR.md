# Plano: fluxo spec → builder → review → PR

Oct 21, 2026 · @Arthur Toledo Neto

## Visão geral e decisões

O fluxo vira um plugin do Claude Code com dois comandos (`/flow-init` e `/ship`) e sete subagentes. O `/ship` orquestra tudo na sessão principal.

| Decisão                  | Escolha                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Onde a orquestração roda | Sessão principal, dentro da skill `/ship`                                                     |
| Spec writer              | Opus 5.5, em modo de planejamento                                                             |
| Builder                  | Opus 5.5 por padrão; Fable quando você escolher na triagem                                    |
| Revisores                | Sonnet 5.5, somente leitura, em paralelo                                                      |
| Quais revisores rodam    | Decidido pelos arquivos alterados na fatia                                                    |
| Gatilho do loop          | Só achados `blocker` ou `major`; máximo 2 rodadas por fatia                                   |
| Rodadas esgotadas        | PR abre como draft, com os achados pendentes                                                  |
| Feature grande           | Vira N PRs médios empilhados, todos para uma branch de integração; só ela abre PR para a base |
| Achados                  | Comentários no PR, via `gh`                                                                   |
| Ambiente                 | Só Claude Code CLI local + `gh` autenticado                                                   |
| Configuração por projeto | Gerada pelo `/flow-init` em `.claude/flow.json`                                               |
| Idioma                   | Inglês ou português (Brasil), escolhido no `/flow-init` e gravado em `flow.json.language`     |

> Versão em inglês: [`PLAN.md`](PLAN.md).

Por que a orquestração fica na skill, e não num agente: os gates humanos (triagem e aprovação da spec) precisam conversar com você, e isso funciona de forma confiável na sessão principal. Subagentes aninhados existem desde a v2.1.172 (até 5 níveis), mas há relatos de tipos de agente que não recebem a ferramenta de delegação. O plano não depende disso.

## Estrutura do plugin

O plugin mora num repositório seu e é instalado em todos os projetos. Cada projeto guarda só a própria configuração e os artefatos de execução.

```
flow-plugin/
  .claude-plugin/plugin.json
  skills/
    flow-init/SKILL.md          # mapeia o projeto e gera .claude/flow.json
    ship/SKILL.md               # orquestrador do fluxo inteiro
    ship/reference/
      review-schema.json        # contrato de saída dos revisores
      reviewer-routing.md       # quais globs acionam quais revisores
      pr-body.md                # template de descrição de PR
  agents/
    spec-writer.md
    builder.md
    security-reviewer.md
    ux-reviewer.md
    ui-reviewer.md
    code-reviewer.md
  checklists/
    security.md  ux.md  ui.md  code.md

# em cada projeto
.claude/flow.json               # gerado pelo /flow-init
.claude/checklists/*.md         # opcional: sobrescreve ou estende os do plugin
.claude/flow-runs/<slug>/       # spec, achados por rodada, estado (gitignored)
```

Antes de implementar, o Claude Code deve confirmar com a documentação atual o formato do `plugin.json` e como skills e agentes de plugin são descobertos.

## Comandos

O `/flow-init` roda uma vez por projeto; o `/ship` roda a cada entrega e retoma de onde parou se for interrompido.

### /flow-init

1. Lê as branches remotas (`main`, `dev`, `develop`, `release/*`) e a branch padrão do repositório.
2. Lê os comandos de qualidade em `package.json`, `Makefile` ou equivalentes: lint, typecheck, testes, build.
3. Detecta a stack e as pastas de frontend, backend e infra, para o roteamento de revisores.
4. Confirma com você, via perguntas de múltipla escolha, a branch base de cada natureza, o prefixo das branches e se hotfix exige back-merge.
5. Grava `.claude/flow.json` e adiciona `.claude/flow-runs/` ao `.gitignore`.

```json
{
  "branches": {
    "feature": "dev",
    "bugfix": "dev",
    "refactor": "dev",
    "chore": "dev",
    "hotfix": "main"
  },
  "hotfixBackMerge": "dev",
  "branchPrefix": {
    "feature": "feat/",
    "bugfix": "fix/",
    "hotfix": "hotfix/",
    "refactor": "refactor/",
    "chore": "chore/"
  },
  "commands": {
    "lint": "npm run lint",
    "typecheck": "npm run typecheck",
    "test": "npm test",
    "build": "npm run build"
  },
  "routing": {
    "ui": ["src/**/*.tsx", "**/*.css", "**/*.scss"],
    "ux": ["src/app/**", "src/pages/**", "src/screens/**"],
    "security": [
      "**/auth/**",
      "**/*.controller.ts",
      "**/migrations/**",
      "Dockerfile",
      "**/*.tf",
      "package.json"
    ]
  },
  "maxReviewRounds": 2,
  "maxGateAttempts": 3
}
```

Se o projeto só tem `main`, o `/flow-init` aponta todas as naturezas para `main`.

### /ship

1. Pré-checagem: `flow.json` existe (senão sugere o `/flow-init`), working tree limpa, `gh auth status` ok.
2. Triagem com perguntas de múltipla escolha:
   1. Natureza: feature, bugfix, hotfix, refactor ou chore.
   2. Modelo do builder: Opus 5.5 (padrão) ou Fable.
   3. Branch base sugerida pelo `flow.json`, para você confirmar.
3. Spec writer gera `.claude/flow-runs/<slug>/spec.md`, já fatiada. Bugfix e hotfix saem com uma fatia só.
4. Gate humano: você aprova ou pede ajuste; ajustes voltam ao spec writer.
5. Branches: com mais de uma fatia, cria a integração `feat/<slug>` a partir da base; a fatia 01 sai dela e cada fatia seguinte sai da branch da anterior (empilhada), como `feat/<slug>-01-<resumo>`. Com uma fatia só, a branch sai direto da base.
6. Para cada fatia:
   1. Builder implementa com TDD e commits em conventional commits.
   2. Quality gate roda os comandos do `flow.json`. Falhou: o mesmo builder corrige, até 3 tentativas; depois para e chama você.
   3. Roteamento: `git diff --name-only` contra a base da fatia, cruzado com os globs. O Code reviewer roda sempre.
   4. Revisores selecionados rodam em paralelo, numa única mensagem com várias chamadas de agente.
   5. A skill valida e consolida os JSONs e remove achados duplicados.
   6. Houve `blocker` ou `major` e a rodada é menor que 2: retoma o mesmo builder com os achados e volta ao passo 2.
   7. Push, `gh pr create` para a integração (ou base), como draft se sobrou blocker, e publica os achados como comentários.
7. Finalização com `/ship --finalize <slug>`: depois que as fatias entram na integração, abre o PR integração → base com o resumo de todas as fatias.
8. Estado em `.claude/flow-runs/<slug>/state.json`, para `/ship --resume <slug>` continuar após interrupção.

## Agentes

Sete agentes (o sétimo, \`browser-tester\`, está na seção seguinte), cada um num arquivo em `agents/`, com modelo e ferramentas fixos no frontmatter. Só o builder escreve código.

| Agente              | Modelo                   | Ferramentas                                  | Entrada                       | Saída                   |
| ------------------- | ------------------------ | -------------------------------------------- | ----------------------------- | ----------------------- |
| `spec-writer`       | Opus                     | Read, Grep, Glob, Write (só em `flow-runs/`) | Pedido, natureza, `CLAUDE.md` | `spec.md` fatiada       |
| `builder`           | Opus; Fable por override | Read, Edit, Write, Bash, Grep, Glob          | Fatia da spec ou achados      | Código, testes, commits |
| `security-reviewer` | Sonnet                   | Read, Grep, Glob, Bash só leitura            | Diff, fatia, checklist        | JSON de review          |
| `ux-reviewer`       | Sonnet                   | Read, Grep, Glob                             | Diff, fatia, checklist        | JSON de review          |
| `ui-reviewer`       | Sonnet                   | Read, Grep, Glob                             | Diff, fatia, checklist        | JSON de review          |
| `code-reviewer`     | Sonnet                   | Read, Grep, Glob, Bash só leitura            | Diff, fatia, checklist        | JSON de review          |

### Regras de cada um

- `spec-writer`: cada fatia tem objetivo, arquivos prováveis, critérios de aceite testáveis, testes a escrever e dependência entre fatias. Fatia mira em até cerca de 400 linhas de diff. Lista dúvidas em vez de inventar requisito.
- `builder`: escreve o teste que falha primeiro, depois o código. Segue Clean/Hexagonal quando o projeto já usa. Não altera arquivos fora do escopo da fatia sem justificar. Ao ser retomado, trata cada achado e responde `corrigido` ou `contestado + motivo`.
- Revisores: só leem. Avaliam apenas o diff da fatia e o contexto necessário, nunca o repositório inteiro. Todo achado aponta arquivo, linha, evidência e correção sugerida. Sem achado concreto, devolvem lista vazia.
- `code-reviewer` roda sempre; os outros três dependem do roteamento.

O builder é retomado com o mesmo contexto entre rodadas (SendMessage com o id do agente), em vez de um agente novo. O modelo do builder vem no parâmetro `model` da chamada, sobrepondo o frontmatter.

## Teste real no navegador

Toda fatia que mexe em frontend web passa por um sétimo agente, o `browser-tester`, que sobe o app local e usa o Playwright MCP para executar os critérios de aceite num navegador de verdade. Ele roda junto com os revisores, na mesma rodada.

### Duas camadas

1. Testes E2E versionados: o builder escreve testes Playwright (`e2e/*.spec.ts`) para cada critério de aceite da fatia. Eles entram no quality gate e ficam no repositório, rodando para sempre.
2. Teste exploratório: o `browser-tester` navega como um usuário. Clica, preenche formulários, testa caminho feliz, erros e bordas, e verifica o que o teste escrito pode ter deixado passar.

### O que o browser-tester verifica

- Cada critério de aceite funcionando de ponta a ponta na tela.
- Console sem erros e sem requisições de rede com falha (4xx ou 5xx inesperados).
- Telas em 3 larguras: 320, 768 e 1280 px, com screenshot de cada uma.
- Navegação só pelo teclado nos fluxos novos.
- Scan de acessibilidade com axe-core injetado na página.
- Core Web Vitals medidos com Lighthouse no build de produção local, quando o projeto tem build.

Critério de aceite que falha no navegador é sempre `blocker`. Os screenshots ficam em `.claude/flow-runs/<slug>/round-N/screens/` e o resumo vai para o comentário do PR.

### Configuração no flow.json

```json
"browser": {
  "devCommand": "npm run dev",
  "url": "http://localhost:3000",
  "readyPath": "/health",
  "seedCommand": "npm run db:seed:test",
  "testUser": { "fromEnv": ["E2E_USER", "E2E_PASSWORD"] },
  "viewports": [320, 768, 1280]
}
```

- O `/flow-init` detecta o comando de dev e a porta, e pergunta como criar dados e usuário de teste.
- Credenciais vêm de variáveis de ambiente ou do seed do projeto, nunca de contas reais.
- O plugin declara o Playwright MCP no próprio manifesto, então quem instala não precisa configurar nada à parte. A fase 1 confirma o pacote e a forma de declarar.
- O `/ship` sobe o servidor antes da rodada, espera o `readyPath` responder e derruba no fim.
- React Native fica de fora por enquanto: Playwright cobre só web. Mobile nativo pode entrar depois com Maestro.

## Contrato de review e regras do loop

Todo revisor devolve exatamente este JSON; a skill rejeita e pede de novo, uma vez, se vier fora do formato.

```json
{
  "reviewer": "security",
  "round": 1,
  "summary": "Uma frase sobre o estado da fatia",
  "findings": [
    {
      "id": "SEC-001",
      "severity": "blocker",
      "category": "A01 Broken Access Control",
      "file": "src/orders/orders.controller.ts",
      "line": 42,
      "evidence": "GET /orders/:id não verifica dono do pedido",
      "fix": "Filtrar por userId do token no repositório",
      "checklistRef": "security.md#acesso"
    }
  ]
}
```

| Severidade | Significado                                                                                            | Volta pro builder?            |
| ---------- | ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `blocker`  | Falha de segurança, perda de dados, quebra funcional, critério de aceite não atendido                  | Sim                           |
| `major`    | Bug provável, falta de teste em caminho crítico, regressão de acessibilidade ou performance mensurável | Sim                           |
| `minor`    | Melhoria clara, mas não urgente                                                                        | Não; vira comentário          |
| `nit`      | Estilo e preferência                                                                                   | Não; vira comentário agrupado |

- Rodada 2 só reavalia os achados da rodada 1 e o diff novo, para não surgir uma leva inteira de achados novos.
- Achado que o builder contestou com motivo vai para o PR como pendente, para você decidir.
- Depois da 2ª rodada com `blocker` restante, o PR abre como draft e a descrição lista os pendentes no topo.

## Branches, PRs e comentários

Feature grande vira uma branch de integração com PRs médios; só a integração abre PR para a base.

```
dev
 └─ feat/checkout                        (integração)
     └─ feat/checkout-01-modelo          → PR para feat/checkout
         └─ feat/checkout-02-api         → PR para feat/checkout
             └─ feat/checkout-03-tela    → PR para feat/checkout
feat/checkout                            → PR final para dev

main
 └─ hotfix/pix-timeout                   → PR direto para main (+ back-merge para dev)
```

As fatias são empilhadas: o fluxo faz todas em sequência, sem esperar seus merges. Duas proteções:

- Se uma fatia termina com blocker pendente (PR em draft), o fluxo para ali e não empilha nada em cima.
- Depois que você mergeia uma fatia na integração, o `/ship --restack <slug>` faz rebase das fatias seguintes e atualiza o que cada PR mostra. Conflito simples ele resolve e roda o quality gate de novo; conflito de lógica ele para e chama você.
- Os PRs devem ser mergeados na ordem 01, 02, 03; a descrição de cada um indica de qual fatia ele depende.

* Commits: conventional commits com escopo, por exemplo `feat(orders): add ownership check`. Correções de review usam `fix(review): ...` para ficar fácil de ler o histórico.
* Título do PR: o mesmo padrão, por exemplo `feat(checkout): 02 - payment API`.
* Descrição do PR: objetivo da fatia, critérios de aceite marcados, como testar, revisores que rodaram e pendentes.
* Comentários: um comentário-resumo por revisor (`gh pr comment`) e os achados com linha como review inline (`gh api .../pulls/<n>/reviews`, evento `COMMENT`). O GitHub não deixa o autor pedir mudanças no próprio PR, então o evento é sempre `COMMENT`.
* Hotfix: depois do merge em `main`, o `/ship --finalize` abre o PR de back-merge para `dev` quando o `flow.json` pede.

## Checklists dos revisores

Cada checklist vira um arquivo em `checklists/` e se ancora num padrão público: OWASP Top 10:2025 e ASVS 5.0 (segurança), WCAG 2.2 AA e as 10 heurísticas de Nielsen (UX e UI), Core Web Vitals (performance de frontend) e clean code com arquitetura hexagonal (código). Cada projeto pode estender em `.claude/checklists/`.

### Security (OWASP Top 10:2025, ASVS 5.0 nível 2 como base)

- A01 Controle de acesso: autorização por recurso (dono do registro), negar por padrão; SSRF agora entra aqui, então URLs de saída passam por allowlist.
- A02 Configuração: CORS restrito, headers (CSP, HSTS), debug desligado, IAM da AWS com menor privilégio, nada de bucket público.
- A03 Cadeia de suprimentos: dependência nova justificada, lockfile atualizado, `npm audit` sem high/critical, actions do CI fixadas por SHA.
- A04 Criptografia: senha com argon2 ou bcrypt, segredo nunca no código (Secrets Manager ou KMS), TLS em toda chamada externa.
- A05 Injeção: queries parametrizadas (inclusive `raw` do ORM), nada de `exec` com entrada do usuário, saída escapada no frontend.
- A06 Design inseguro: rate limit, idempotência em pagamentos e consumidores, limites de negócio (valor, quantidade, tentativas).
- A07 Autenticação: JWT valida `alg`, `exp`, `aud` e `iss`; logout invalida sessão; proteção contra força bruta.
- A08 Integridade: webhooks com assinatura verificada, desserialização segura.
- A09 Logs e alertas: eventos de segurança logados, sem PII, token ou senha nos logs (LGPD).
- A10 Condições excepcionais: falha fechada, sem stack trace para o cliente, timeouts e DLQ nas filas.

### Code (clean code, hexagonal, TDD)

- Critérios de aceite da fatia atendidos; testes cobrem caminho feliz, erros e bordas, e falhariam sem a mudança.
- Domínio não importa infraestrutura; portas e adaptadores respeitados quando o projeto usa.
- Nomes claros, funções curtas, sem duplicação nem código morto; TypeScript sem `any` e com checagem estrita de nulos.
- Erros tipados e tratados, nunca engolidos.
- Concorrência: transações corretas, consumidores Kafka, SQS e RabbitMQ idempotentes (entrega pelo menos uma vez).
- Performance de backend: sem N+1, índice para query nova, paginação, cache Redis com invalidação definida.
- Contratos: sem quebra de API sem versionar; migrations reversíveis.
- Observabilidade: logs estruturados e métricas nos pontos novos.

### UX (heurísticas de Nielsen + comportamento WCAG 2.2 AA)

- Status visível: estados de carregamento, sucesso, erro e vazio em toda tela nova.
- Prevenção e recuperação de erro: confirmação em ação destrutiva, validação inline, mensagem que diz como resolver.
- Controle do usuário: desfazer, voltar e cancelar disponíveis.
- Consistência com os padrões já existentes no produto.
- Teclado: tudo acessível, ordem de foco lógica, foco visível e não encoberto (2.4.7, 2.4.11).
- Alvos de toque com pelo menos 24x24 px (2.5.8); arrastar sempre com alternativa (2.5.7).
- Formulários: rótulos reais, sem pedir de novo o que já foi informado (3.3.7), login sem teste cognitivo (3.3.8).
- Textos em português claro, sem jargão técnico para o usuário final.

### UI design (visual, responsivo e rápido)

- Usa tokens do design system; sem cor, espaçamento ou fonte fixos no código.
- Contraste de 4.5:1 para texto e 3:1 para componentes e ícones (1.4.3, 1.4.11).
- Responsivo: funciona em 320 px sem rolagem horizontal (1.4.10), breakpoints testados, tema escuro quando o projeto suporta.
- Hierarquia tipográfica, alinhamento e espaçamento consistentes.
- Estados de hover, foco, desabilitado e carregamento desenhados.
- Core Web Vitals no percentil 75: LCP até 2,5 s, INP até 200 ms, CLS até 0,1.
- Imagens com dimensão definida e lazy loading; espaço reservado para conteúdo assíncrono; bundle novo justificado; sem tarefas longas na thread principal.

## Ordem de implementação

Cinco fases, cada uma testável sozinha num projeto de teste antes de seguir. Passe uma fase por vez ao Claude Code.

1. Esqueleto e verificação: criar o repositório do plugin, o `plugin.json` e instalar localmente. Pedir ao Claude Code que confira na documentação atual o formato de plugin, skills, agentes, o parâmetro `model` e o SendMessage.
2. `/flow-init`: detecção de branches, comandos e stack; perguntas de confirmação; gravação do `flow.json`. Testar em um repo só com `main` e outro com `dev` e `main`.
3. Spec writer e builder: `/ship` até o fim de uma fatia única, com quality gate e commit, sem revisores e sem PR.
4. Revisores: os quatro agentes, os checklists, o contrato JSON, o roteamento por globs, a execução em paralelo e o loop de no máximo 2 rodadas. Depois, o \`browser-tester\` com Playwright MCP e os testes E2E no quality gate.
5. PRs e fatiamento: branch de integração, PR por fatia, comentários inline, draft com pendentes, empilhamento com \`--restack\`, `--resume` e `--finalize`.

Como teste de aceite do plugin inteiro, rode uma feature pequena que mexa em backend e frontend e confira: revisores certos acionados, loop parando na 2ª rodada, PRs nas branches certas e comentários nas linhas certas.

- [x] Fase 1: esqueleto e verificação (ver `docs/phase-1-verification.md`)
- [x] Fase 2: `/flow-init`
- [x] Fase 3: spec writer e builder
- [x] Fase 4: revisores e loop
- [x] Fase 5: PRs e fatiamento
- [x] Escolha de idioma: inglês ou português (Brasil)
- [ ] Teste de aceite do plugin inteiro numa feature real (backend + frontend)

O plugin se chama `flow`, então os comandos ficam `/flow:flow-init` e `/flow:ship`, e os agentes `flow:<nome>`. A lógica determinística está em `scripts/`, em Node sem dependências: detecção, roteamento por glob, validação e consolidação das reviews, payload de comentários inline e servidor de dev.

## Riscos e pontos em aberto

- [ ] Empilhamento: mudança pedida numa fatia mergeada antes exige rebase das seguintes. O \`--restack\` cobre o caso comum; conflitos de lógica param o fluxo.
- [ ] Custo: quatro revisores por rodada, até duas rodadas por fatia. Vale acompanhar o consumo nas primeiras features.
- [ ] Revisor de UI sem navegador mede Core Web Vitals só por inspeção de código. Uma evolução possível é rodar Lighthouse no build local.
- [ ] Falso positivo: se um revisor errar sempre o mesmo tipo de achado, ajuste o checklist do projeto em vez de aumentar rodadas.
- [ ] Documentação do Claude Code muda rápido; a fase 1 existe para validar formatos antes de escrever o resto.

## Fontes

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP ASVS](https://owasp.org/www-project-ASVS/) (versão 5.0, publicada em maio de 2025)
- [web.dev: limites dos Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds)
- [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Nielsen Norman Group: 10 heurísticas](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Claude Code: issue sobre subagentes aninhados](https://github.com/anthropics/claude-code/issues/80036)
