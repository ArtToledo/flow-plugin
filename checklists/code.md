# Code checklist

Based on clean code, hexagonal architecture and TDD. Cite items in `checklistRef` as `code.md#<ID>` (e.g. `code.md#CODE-02`).

## CODE-01 — Acceptance criteria

- Every acceptance criterion of the slice is implemented.
- Nothing outside the slice scope without a justification.

## CODE-02 — Tests

- Every criterion has a test that **would fail without the change**.
- The tests cover the happy path, errors and edge cases: empty, null, limits, and concurrency where it applies.
- The tests are deterministic: they don't depend on order, the real clock, the external network or shared data.
- Mocks are used only at the boundaries (ports), never on the code under test.

## CODE-03 — Architecture

- The domain doesn't import infrastructure (ORM, HTTP, SDKs).
- Ports and adapters are respected when the project uses them, and business rules stay out of controllers and handlers.
- Dependencies point inward, and new code follows the patterns the project already uses.

## CODE-04 — Readability

- Clear domain names and short, single-purpose functions.
- No duplication, no dead code, and no comments that just repeat the code.
- TypeScript without `any` (or `as any`) and without unnecessary `!`. Nulls are handled under strict checks.

## CODE-05 — Errors

- Errors are typed (domain classes or results) and handled at the right level.
- They are never swallowed (empty `catch {}`) or rethrown without context.
- Messages help whoever operates the system, without leaking internals to the client.

## CODE-06 — Concurrency and consistency

- Transactions are scoped correctly, with no external calls inside a long transaction.
- Kafka, SQS and RabbitMQ consumers are idempotent (at-least-once delivery), with retries and a DLQ.
- Race conditions on counters, balances and stock are handled with a lock, a version or an atomic operation.

## CODE-07 — Backend performance

- No N+1 queries: load in batches or with a join.
- Every new query on a large table has an index.
- Listings are paginated.
- Caches (Redis) have a defined key, TTL and invalidation.

## CODE-08 — Contracts

- No public API break without versioning.
- DTOs are validated at the edge.
- Migrations are reversible and safe for zero-downtime deploys (expand/contract).

## CODE-09 — Observability

- Structured logs at the new points, with correlation (a request id).
- Metrics or events for new business flows.
