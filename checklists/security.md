# Checklist de segurança

A base é o OWASP Top 10:2025 e o ASVS 5.0 nível 2. Em `checklistRef`, cite como `security.md#<ID>` (ex.: `security.md#A01`).

## A01 — Controle de acesso

- Autorização **por recurso**: a consulta filtra pelo dono, tenant ou escopo do token, e não só "está logado".
- Negar por padrão: rota ou handler novo exige autorização explícita.
- IDs vindos do cliente nunca são confiáveis sem a checagem de posse (IDOR).
- SSRF (agora em A01): URL de saída montada com entrada do usuário passa por allowlist de host e esquema, e bloqueia IPs internos e metadata (`169.254.169.254`).
- CORS não reflete `Origin` arbitrária com credenciais.

## A02 — Configuração de segurança

- CORS restrito às origens conhecidas.
- Headers: CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors`.
- Debug, stack trace e endpoints de diagnóstico desligados em produção.
- IAM da AWS (e equivalentes) com menor privilégio, sem `*` em ação nem em recurso sem justificativa.
- Nada de bucket ou blob público, nem security group aberto a `0.0.0.0/0` em porta administrativa.
- Contêiner sem rodar como root quando der, e imagem base fixada.

## A03 — Cadeia de suprimentos

- Dependência nova justificada (tamanho, manutenção, licença) e sem alternativa nativa óbvia.
- Lockfile atualizado junto com o manifesto.
- `npm audit` (ou equivalente) sem high ou critical nas dependências novas.
- Actions do CI fixadas por SHA, não por tag.
- Scripts de `postinstall` de dependências novas revisados.

## A04 — Falhas criptográficas

- Senha com argon2id ou bcrypt (custo adequado), nunca hash rápido nem reversível.
- Segredo nunca no código, em fixture versionada ou em log. Use Secrets Manager, KMS ou variável de ambiente.
- TLS em toda chamada externa, sem `rejectUnauthorized: false`.
- Aleatoriedade de segurança com CSPRNG (`crypto.randomUUID`, `randomBytes`), nunca `Math.random`.

## A05 — Injeção

- Queries parametrizadas, inclusive `raw`, `$queryRawUnsafe` e `query()` de ORM.
- Nada de `exec`, `spawn` com `shell: true` ou `eval` com entrada do usuário.
- Saída escapada no frontend, sem `dangerouslySetInnerHTML` ou `v-html` com dado não sanitizado.
- Path traversal: caminhos de arquivo vindos do usuário normalizados e confinados.
- Cabeçalhos e logs sem CRLF vindo do usuário.

## A06 — Design inseguro

- Rate limit em login, cadastro, recuperação de senha e endpoints caros.
- Idempotência em pagamentos e em consumidores de fila (chave de idempotência).
- Limites de negócio: valor, quantidade, tentativas, tamanho de upload.
- Validação de entrada no servidor com schema, nunca só no cliente.

## A07 — Falhas de autenticação

- JWT valida `alg` (sem `none`, algoritmo fixo), `exp`, `aud` e `iss`.
- Logout e troca de senha invalidam sessão e refresh token.
- Proteção contra força bruta e enumeração de usuário (mensagens genéricas).
- Cookies de sessão com `HttpOnly`, `Secure` e `SameSite`.

## A08 — Integridade de software e dados

- Webhooks com assinatura verificada (HMAC com comparação em tempo constante) e proteção contra replay.
- Desserialização segura, sem `pickle`, `yaml.load` inseguro nem `JSON.parse` de entrada para objeto com protótipo.
- Uploads validados por conteúdo, não só pela extensão.

## A09 — Logs e alertas

- Eventos de segurança logados: login, falha de autorização, mudança de permissão.
- Sem PII, token, senha ou documento nos logs (LGPD). Mascare quando precisar correlacionar.
- Nada de log com o corpo inteiro de requisições sensíveis.

## A10 — Condições excepcionais

- Falha fechada: erro na checagem de permissão nega o acesso.
- Sem stack trace nem mensagem interna para o cliente.
- Timeouts em toda chamada externa, retries com backoff, DLQ nas filas.
- Exceções não tratadas não derrubam o processo inteiro sem log.
