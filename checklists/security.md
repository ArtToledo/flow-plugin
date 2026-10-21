# Security checklist

Based on the OWASP Top 10:2025 and ASVS 5.0 level 2. Cite items in `checklistRef` as `security.md#<ID>` (e.g. `security.md#A01`).

## A01 — Broken Access Control

- **Per-resource** authorization: the query filters by owner, tenant or token scope, not just "is logged in".
- Deny by default: every new route or handler requires explicit authorization.
- IDs coming from the client are never trusted without an ownership check (IDOR).
- SSRF (now part of A01): an outbound URL built from user input goes through a host and scheme allowlist, and blocks internal IPs and metadata endpoints (`169.254.169.254`).
- CORS never reflects an arbitrary `Origin` together with credentials.

## A02 — Security Misconfiguration

- CORS is restricted to known origins.
- Headers: CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors`.
- Debug mode, stack traces and diagnostic endpoints are off in production.
- AWS IAM (and equivalents) follows least privilege: no `*` in actions or resources without a reason.
- No public buckets or blobs, and no security group open to `0.0.0.0/0` on an admin port.
- Containers don't run as root when avoidable, and base images are pinned.

## A03 — Software Supply Chain Failures

- Every new dependency is justified (size, maintenance, license) and has no obvious native alternative.
- The lockfile is updated together with the manifest.
- `npm audit` (or the equivalent) shows no high or critical issues in new dependencies.
- CI actions are pinned by SHA, not by tag.
- `postinstall` scripts of new dependencies have been reviewed.

## A04 — Cryptographic Failures

- Passwords use argon2id or bcrypt with a proper cost, never a fast or reversible hash.
- Secrets never appear in code, versioned fixtures or logs; they live in Secrets Manager, KMS or environment variables.
- Every external call uses TLS, with no `rejectUnauthorized: false`.
- Security randomness comes from a CSPRNG (`crypto.randomUUID`, `randomBytes`), never `Math.random`.

## A05 — Injection

- Queries are parameterized, including ORM `raw`, `$queryRawUnsafe` and `query()`.
- No `exec`, no `spawn` with `shell: true`, and no `eval` on user input.
- Output is escaped in the frontend: no `dangerouslySetInnerHTML` or `v-html` with unsanitized data.
- Path traversal: file paths from users are normalized and confined.
- No user-supplied CRLF in headers or logs.

## A06 — Insecure Design

- Rate limiting on login, sign-up, password recovery and expensive endpoints.
- Idempotency for payments and queue consumers (idempotency key).
- Business limits: amount, quantity, attempts, upload size.
- Input validated on the server with a schema, never only on the client.

## A07 — Authentication Failures

- JWT checks `alg` (no `none`, fixed algorithm), `exp`, `aud` and `iss`.
- Logout and password changes invalidate the session and the refresh token.
- Protection against brute force and user enumeration (generic messages).
- Session cookies use `HttpOnly`, `Secure` and `SameSite`.

## A08 — Software or Data Integrity Failures

- Webhooks have their signatures verified (HMAC with constant-time comparison) and are protected against replay.
- Deserialization is safe: no `pickle`, no unsafe `yaml.load`, and no `JSON.parse` of input into prototype-bearing objects.
- Uploads are validated by content, not just by extension.

## A09 — Security Logging and Alerting Failures

- Security events are logged: login, authorization failures, permission changes.
- No personal data, tokens, passwords or document numbers in logs (GDPR/LGPD). Mask them when you need correlation.
- Full bodies of sensitive requests are never logged.

## A10 — Mishandling of Exceptional Conditions

- Fail closed: an error during a permission check denies access.
- No stack traces or internal messages sent to the client.
- Timeouts on every external call, retries with backoff, and DLQs on queues.
- Unhandled exceptions never take down the whole process without being logged.
