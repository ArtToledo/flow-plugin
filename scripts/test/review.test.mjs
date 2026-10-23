import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReviewPayload, carryForward, commentableLines, consolidate, extractJson, flowThreads, marker, openThreadIds, parseBuilderResponse,
  reviewerSummary, threadsToResolve, validateReview,
} from '../lib/review.mjs';

const finding = over => ({
  id: 'X-001', severity: 'major', category: 'A01 Broken Access Control', file: 'src/a.ts', line: 10,
  evidence: 'GET /orders/:id does not check the order owner', fix: 'Filter by the token userId', ...over,
});

test('extracts JSON from a fenced block', () => {
  const text = 'Here:\n```json\n{"reviewer":"code","round":1,"summary":"ok","findings":[]}\n```\n';
  assert.equal(extractJson(text).reviewer, 'code');
});

test('validates required fields and severity', () => {
  assert.deepEqual(validateReview({ reviewer: 'code', round: 1, summary: 's', findings: [finding()] }), []);
  const errors = validateReview({ reviewer: 'x', round: 0, summary: '', findings: [finding({ severity: 'high', line: 0 })] });
  assert.equal(errors.length, 5);
});

test('merges duplicates keeping the highest severity', () => {
  const result = consolidate([
    { reviewer: 'security', round: 1, summary: 's', findings: [finding({ id: 'SEC-001', severity: 'blocker' })] },
    { reviewer: 'code', round: 1, summary: 'c', findings: [
      finding({ id: 'CODE-001', line: 11, category: 'Authorization' }),
      finding({ id: 'CODE-002', file: 'src/b.ts', severity: 'nit', category: 'Naming', evidence: 'bad name' }),
    ] },
  ]);
  assert.equal(result.findings.length, 2);
  assert.equal(result.findings[0].severity, 'blocker');
  assert.deepEqual(result.findings[0].reviewers, ['security', 'code']);
  assert.equal(result.needsFix, true);
  assert.equal(result.hasBlocker, true);
});

const diff = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -8,3 +8,5 @@ export function x() {',
  ' a', '+b', '+c', ' d', ' e',
  'diff --git a/old.ts b/old.ts',
  '--- a/old.ts',
  '+++ /dev/null',
  '@@ -1,2 +0,0 @@',
].join('\n');

test('commentable lines come from the new-side hunks', () => {
  const lines = commentableLines(diff);
  assert.deepEqual([...lines.get('src/a.ts')], [8, 9, 10, 11, 12]);
  assert.ok(!lines.has('old.ts'));
});

const roundTwo = () => consolidate([{ reviewer: 'code', round: 2, summary: 's', findings: [
  finding({ id: 'A', line: 10 }),
  finding({ id: 'B', line: 99, category: 'Other', evidence: 'outside the diff' }),
  finding({ id: 'C', file: 'src/c.ts', severity: 'nit', category: 'Style', evidence: 'comma' }),
] }]);

test('payload: inline on diff lines, the rest and nits in the body, COMMENT event', () => {
  const payload = buildReviewPayload(roundTwo(), diff, { commitId: 'abc123' });
  assert.equal(payload.event, 'COMMENT');
  assert.equal(payload.commit_id, 'abc123');
  assert.deepEqual(payload.comments.map(c => c.line), [10]);
  assert.match(payload.body, /Automated review — round 2/);
  assert.match(payload.body, /outside the diff/);
  assert.match(payload.body, /Nits \(1\)/);
  assert.match(payload.comments[0].body, /Suggested fix/);
  assert.match(payload.body, /| code | s |/);
});

test('payload and summary follow the chosen language', () => {
  const payload = buildReviewPayload(roundTwo(), diff, { lang: 'pt-BR' });
  assert.match(payload.body, /Review automatizada — rodada 2/);
  assert.match(payload.comments[0].body, /Correção sugerida/);
  assert.match(reviewerSummary(roundTwo(), 'code', { lang: 'pt-BR' }), /### Revisor: code/);
  assert.match(reviewerSummary(roundTwo(), 'code'), /### Reviewer: code/);
  assert.throws(() => buildReviewPayload(roundTwo(), diff, { lang: 'fr' }), /Unsupported language/);
});

test('payload marks threads with the slice and skips ids that already have an open thread', () => {
  const payload = buildReviewPayload(roundTwo(), diff, { slice: '01' });
  assert.match(payload.body, /Automated review — slice 01, round 2/);
  assert.match(payload.comments[0].body, /<!-- flow:slice=01 ids=A -->/);
  const skipped = buildReviewPayload(roundTwo(), diff, { slice: '01', skipIds: new Set(['A']) });
  assert.equal(skipped.comments.length, 0);
});

test('parses the builder reply per id', () => {
  const r = parseBuilderResponse('SEC-001: fixed — abc1234\n- `CODE-002`: disputed — validated at X:42\nUX-003: deferred: out of scope\nnoise');
  assert.deepEqual([...r.keys()], ['SEC-001', 'CODE-002', 'UX-003']);
  assert.equal(r.get('CODE-002').status, 'disputed');
  assert.equal(r.get('CODE-002').note, 'validated at X:42');
  assert.equal(r.get('UX-003').status, 'deferred');
});

test('carries a reviewer forward without the findings the builder fixed', () => {
  const review = { reviewer: 'browser', round: 1, summary: 's', findings: [finding({ id: 'BRW-001' }), finding({ id: 'BRW-002' }), finding({ id: 'BRW-003' })] };
  const responses = parseBuilderResponse('BRW-001: fixed — abc\nBRW-002: disputed — expected');
  const carried = carryForward(review, responses, 2);
  assert.equal(carried.round, 2);
  assert.deepEqual(carried.findings.map(f => f.id), ['BRW-002', 'BRW-003']);
  assert.equal(carried.findings[0].contested, true);
  assert.equal(carried.findings[0].builderNote, 'expected');
  assert.deepEqual(validateReview(carried), []);
});

const graphql = { data: { repository: { pullRequest: { reviewThreads: { nodes: [
  { id: 'T1', isResolved: false, comments: { nodes: [{ databaseId: 11, body: `x\n\n${marker('01', ['CODE-001', 'SEC-001'])}` }] } },
  { id: 'T2', isResolved: false, comments: { nodes: [{ databaseId: 12, body: `y\n\n${marker('01', ['CODE-002'])}` }] } },
  { id: 'T3', isResolved: true, comments: { nodes: [{ databaseId: 13, body: marker('01', ['CODE-003']) }] } },
  { id: 'T4', isResolved: false, comments: { nodes: [{ databaseId: 14, body: marker('02', ['CODE-001']) }] } },
  { id: 'T5', isResolved: false, comments: { nodes: [{ databaseId: 15, body: 'a human comment' }] } },
] } } } } };

test('reads only the flow threads of a PR', () => {
  const threads = flowThreads(graphql);
  assert.deepEqual(threads.map(t => t.threadId), ['T1', 'T2', 'T3', 'T4']);
  assert.deepEqual(threads[0].ids, ['CODE-001', 'SEC-001']);
  assert.deepEqual([...openThreadIds(threads, '01')], ['CODE-001', 'SEC-001', 'CODE-002']);
});

test('resolves the open threads of the slice whose findings are gone', () => {
  const current = consolidate([{ reviewer: 'code', round: 3, summary: 's', findings: [finding({ id: 'CODE-002' })] }]);
  const toResolve = threadsToResolve(flowThreads(graphql), current, '01');
  assert.deepEqual(toResolve.map(t => [t.threadId, t.commentId]), [['T1', 11]]);
});
