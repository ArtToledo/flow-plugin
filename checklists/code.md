# Checklist de código

A base é clean code, arquitetura hexagonal e TDD. Em `checklistRef`, cite como `code.md#<ID>` (ex.: `code.md#CODE-02`).

## CODE-01 — Critérios de aceite

- Todos os critérios de aceite da fatia estão implementados.
- Nada fora do escopo da fatia sem justificativa.

## CODE-02 — Testes

- Cada critério tem teste que **falharia sem a mudança**.
- Caminho feliz, erros e bordas cobertos (vazio, nulo, limite, concorrência quando aplicável).
- Testes determinísticos: sem depender de ordem, relógio real, rede externa ou dados compartilhados.
- Mocks só nas fronteiras (portas), sem mockar o que está sendo testado.

## CODE-03 — Arquitetura

- Domínio não importa infraestrutura (ORM, HTTP, SDKs).
- Portas e adaptadores respeitados quando o projeto usa. Regra de negócio fora de controllers e handlers.
- Dependências apontam para dentro, e o padrão novo é consistente com o resto do projeto.

## CODE-04 — Legibilidade

- Nomes claros e do domínio, funções curtas com uma responsabilidade.
- Sem duplicação, sem código morto e sem comentário que repete o código.
- TypeScript sem `any` (nem `as any`) e sem `!` desnecessário. Nulos tratados com checagem estrita.

## CODE-05 — Erros

- Erros tipados (classes ou resultados de domínio) e tratados no nível certo.
- Nunca engolidos (`catch {}` vazio) nem relançados sem contexto.
- Mensagens úteis para quem opera, sem vazar dados internos ao cliente.

## CODE-06 — Concorrência e consistência

- Transações delimitadas corretamente, sem chamada externa dentro de transação longa.
- Consumidores Kafka, SQS e RabbitMQ idempotentes (entrega pelo menos uma vez), com retries e DLQ.
- Condições de corrida em contadores, saldos e estoque tratadas (lock, versão ou operação atômica).

## CODE-07 — Performance de backend

- Sem N+1. Carregamento em lote ou join.
- Índice para cada query nova em tabela grande.
- Paginação em listagens.
- Cache (Redis) com chave, TTL e invalidação definidos.

## CODE-08 — Contratos

- Sem quebra de API pública sem versionamento.
- DTOs validados na borda.
- Migrations reversíveis e seguras para deploy sem downtime (expand/contract).

## CODE-09 — Observabilidade

- Logs estruturados nos pontos novos, com correlação (request id).
- Métricas ou eventos para fluxos de negócio novos.
