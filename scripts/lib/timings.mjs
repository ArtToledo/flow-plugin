// Step timings kept in state.json (state.timings), so a run shows where its time went.

// The flow runs one step at a time, so opening a step closes whatever is still open.
export function startStep(state, step, { slice = null, round = null, now = new Date() } = {}) {
  endStep(state, { now });
  state.timings = [...(state.timings ?? []), { step, slice, round, start: now.toISOString(), end: null }];
  return state;
}

// Closes every open entry (the current step, or the run when it stops or ends).
export function endStep(state, { now = new Date() } = {}) {
  for (const e of state.timings ?? []) if (!e.end) e.end = now.toISOString();
  return state;
}

const seconds = e => (e.end ? (Date.parse(e.end) - Date.parse(e.start)) / 1000 : 0);

export function formatDuration(total) {
  const s = Math.round(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

// Markdown table: one row per slice (null = run-level steps like triage and spec),
// one column per step, plus totals.
export function timingReport(state) {
  const entries = state.timings ?? [];
  if (entries.length === 0) return 'No timings recorded.';
  const steps = [...new Set(entries.map(e => e.step))];
  const slices = [...new Set(entries.map(e => e.slice))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const sum = filter => entries.filter(filter).reduce((acc, e) => acc + seconds(e), 0);
  const lines = [`| Slice | ${steps.join(' | ')} | Total |`, `| --- | ${steps.map(() => '---').join(' | ')} | --- |`];
  for (const slice of slices) {
    const cells = steps.map(step => {
      const total = sum(e => e.slice === slice && e.step === step);
      return total ? formatDuration(total) : '—';
    });
    const label = slice === null ? 'run' : String(slice).padStart(2, '0');
    lines.push(`| ${label} | ${cells.join(' | ')} | ${formatDuration(sum(e => e.slice === slice))} |`);
  }
  const totals = steps.map(step => formatDuration(sum(e => e.step === step)));
  lines.push(`| **Total** | ${totals.join(' | ')} | **${formatDuration(sum(() => true))}** |`);
  return lines.join('\n');
}
