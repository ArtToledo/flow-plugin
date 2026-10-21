import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPayload, commentableLines, consolidate, extractJson, reviewerSummary, validateReview } from '../lib/review.mjs';

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
});

test('payload and summary follow the chosen language', () => {
  const payload = buildReviewPayload(roundTwo(), diff, { lang: 'pt-BR' });
  assert.match(payload.body, /Review automatizada — rodada 2/);
  assert.match(payload.comments[0].body, /Correção sugerida/);
  assert.match(reviewerSummary(roundTwo(), 'code', { lang: 'pt-BR' }), /### Revisor: code/);
  assert.match(reviewerSummary(roundTwo(), 'code'), /### Reviewer: code/);
  assert.throws(() => buildReviewPayload(roundTwo(), diff, { lang: 'fr' }), /Unsupported language/);
});
