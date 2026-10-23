import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endStep, formatDuration, startStep, timingReport } from '../lib/timings.mjs';

const at = s => new Date(Date.UTC(2026, 9, 23, 12, 0, s));

test('records steps per slice and reports the totals', () => {
  const state = {};
  startStep(state, 'spec', { now: at(0) });
  endStep(state, { now: at(90) });
  startStep(state, 'build', { slice: 1, now: at(100) });
  startStep(state, 'review', { slice: 1, round: 1, now: at(400) });
  endStep(state, { now: at(520) });
  const report = timingReport(state);
  assert.match(report, /\| Slice \| spec \| build \| review \| Total \|/);
  assert.match(report, /\| run \| 1m 30s \| — \| — \| 1m 30s \|/);
  assert.match(report, /\| 01 \| — \| 5m 00s \| 2m 00s \| 7m 00s \|/);
  assert.match(report, /\*\*8m 30s\*\*/);
});

test('starting a step closes the one left open', () => {
  const state = {};
  startStep(state, 'gate', { slice: 1, now: at(0) });
  startStep(state, 'review', { slice: 1, now: at(30) });
  assert.equal(state.timings[0].end, at(30).toISOString());
  assert.equal(state.timings[1].end, null);
});

test('formats durations', () => {
  assert.equal(formatDuration(42), '42s');
  assert.equal(formatDuration(125), '2m 05s');
  assert.equal(formatDuration(3720), '1h 02m');
});
