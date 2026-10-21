// Review contract: validation, consolidation and PR comment payloads.
// The format is described in skills/ship/reference/review-schema.json.
import { messages } from './i18n.mjs';

export const SEVERITIES = ['blocker', 'major', 'minor', 'nit'];
export const REVIEWERS = ['security', 'ux', 'ui', 'code', 'browser'];
const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

// Accepts plain JSON or the agent's reply with a ```json block.
export function extractJson(text) {
  const fenced = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].map(m => m[1]);
  const candidates = [...fenced, text];
  for (const candidate of candidates) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // try the next candidate
    }
  }
  throw new Error('No valid JSON object found in the reply.');
}

const isText = v => typeof v === 'string' && v.trim().length > 0;

export function validateReview(review) {
  const errors = [];
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    return ['The root must be an object.'];
  }
  if (!REVIEWERS.includes(review.reviewer)) errors.push(`reviewer must be one of: ${REVIEWERS.join(', ')}.`);
  if (!Number.isInteger(review.round) || review.round < 1) errors.push('round must be an integer >= 1.');
  if (!isText(review.summary)) errors.push('summary is required.');
  if (!Array.isArray(review.findings)) {
    errors.push('findings must be an array (empty when there are no findings).');
    return errors;
  }
  const ids = new Set();
  review.findings.forEach((f, i) => {
    const at = `findings[${i}]`;
    if (!f || typeof f !== 'object') return errors.push(`${at} must be an object.`);
    for (const key of ['id', 'category', 'file', 'evidence', 'fix']) {
      if (!isText(f[key])) errors.push(`${at}.${key} is required.`);
    }
    if (!SEVERITIES.includes(f.severity)) errors.push(`${at}.severity must be one of: ${SEVERITIES.join(', ')}.`);
    if (f.line !== null && (!Number.isInteger(f.line) || f.line < 1)) errors.push(`${at}.line must be an integer >= 1 or null.`);
    if (f.checklistRef !== undefined && typeof f.checklistRef !== 'string') errors.push(`${at}.checklistRef must be a string.`);
    if (f.contested !== undefined && typeof f.contested !== 'boolean') errors.push(`${at}.contested must be a boolean.`);
    if (f.builderNote !== undefined && typeof f.builderNote !== 'string') errors.push(`${at}.builderNote must be a string.`);
    if (ids.has(f.id)) errors.push(`${at}.id is duplicated: ${f.id}.`);
    ids.add(f.id);
  });
  return errors;
}

const tokens = text => new Set(text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9_]{3,}/g) ?? []);

function similar(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter) >= 0.4;
}

// Two findings are the same when they point to the same file, lines at most 2
// apart, and share the category or have similar evidence.
function isDuplicate(a, b) {
  if (a.file !== b.file) return false;
  if (a.line === null || b.line === null) {
    if (a.line !== b.line) return false;
  } else if (Math.abs(a.line - b.line) > 2) {
    return false;
  }
  return a.category.toLowerCase() === b.category.toLowerCase() || similar(a.evidence, b.evidence);
}

export function consolidate(reviews) {
  const merged = [];
  for (const review of reviews) {
    for (const finding of review.findings) {
      const item = { ...finding, reviewers: [review.reviewer], ids: [finding.id] };
      const dup = merged.find(m => isDuplicate(m, item));
      if (!dup) {
        merged.push(item);
        continue;
      }
      if (RANK[item.severity] < RANK[dup.severity]) {
        Object.assign(dup, { severity: item.severity, category: item.category, evidence: item.evidence, fix: item.fix });
      }
      dup.reviewers = [...new Set([...dup.reviewers, review.reviewer])];
      dup.ids.push(item.id);
      dup.contested = Boolean(dup.contested || item.contested);
    }
  }
  merged.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0));
  const counts = Object.fromEntries(SEVERITIES.map(s => [s, merged.filter(f => f.severity === s).length]));
  return {
    round: Math.max(...reviews.map(r => r.round), 1),
    reviewers: reviews.map(r => ({ reviewer: r.reviewer, summary: r.summary, artifacts: r.artifacts ?? [] })),
    counts,
    needsFix: counts.blocker + counts.major > 0,
    hasBlocker: counts.blocker > 0,
    findings: merged,
  };
}

// Lines on the new side (RIGHT) that appear in some hunk of the unified diff.
// GitHub only accepts inline comments on those lines.
export function commentableLines(diffText) {
  const result = new Map();
  let path = null;
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4).trim();
      path = target === '/dev/null' ? null : target.replace(/^b\//, '');
      if (path && !result.has(path)) result.set(path, new Set());
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk && path) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let n = start; n < start + count; n++) result.get(path).add(n);
    }
  }
  return result;
}

const LABEL = { blocker: '🔴 blocker', major: '🟠 major', minor: '🟡 minor', nit: '⚪ nit' };

function findingBody(f, t) {
  const lines = [
    `**${LABEL[f.severity]}** · \`${f.ids.join(', ')}\` · ${f.reviewers.join(', ')} · ${f.category}`,
    '',
    f.evidence,
    '',
    `**${t.suggestedFix}:** ${f.fix}`,
  ];
  if (f.checklistRef) lines.push('', `${t.checklist}: \`${f.checklistRef}\``);
  if (f.contested) lines.push('', t.pending(f.builderNote));
  return lines.join('\n');
}

// Payload for POST /repos/{owner}/{repo}/pulls/{n}/reviews. The event is always
// COMMENT: the author cannot request changes on their own PR. Nits and findings
// outside the diff go grouped into the review body.
export function buildReviewPayload(consolidated, diffText, { commitId, lang = 'en' } = {}) {
  const t = messages(lang);
  const lines = commentableLines(diffText);
  const comments = [];
  const general = [];
  const nits = [];
  for (const f of consolidated.findings) {
    if (f.severity === 'nit') {
      nits.push(f);
    } else if (f.line !== null && lines.get(f.file)?.has(f.line)) {
      comments.push({ path: f.file, line: f.line, side: 'RIGHT', body: findingBody(f, t) });
    } else {
      general.push(f);
    }
  }
  const { blocker, major, minor, nit } = consolidated.counts;
  const body = [t.reviewTitle(consolidated.round), '', `${blocker} blocker · ${major} major · ${minor} minor · ${nit} nit`];
  if (general.length) {
    body.push('', t.outsideDiff, '');
    for (const f of general) body.push(`- \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${findingBody(f, t).replace(/\n+/g, ' ')}`);
  }
  if (nits.length) {
    body.push('', `<details><summary>${t.nits(nits.length)}</summary>`, '');
    for (const f of nits) body.push(`- \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${f.evidence} → ${f.fix}`);
    body.push('', '</details>');
  }
  const payload = { event: 'COMMENT', body: body.join('\n'), comments };
  if (commitId) payload.commit_id = commitId;
  return payload;
}

// Summary comment for one reviewer (one per reviewer, via gh pr comment).
export function reviewerSummary(consolidated, reviewer, { lang = 'en' } = {}) {
  const t = messages(lang);
  const meta = consolidated.reviewers.find(r => r.reviewer === reviewer);
  if (!meta) throw new Error(`Reviewer ${reviewer} did not take part in this round.`);
  const own = consolidated.findings.filter(f => f.reviewers.includes(reviewer));
  const lines = [t.reviewer(reviewer), '', meta.summary, ''];
  if (own.length === 0) {
    lines.push(t.noFindings);
  } else {
    lines.push(t.tableHeader, '| --- | --- | --- | --- |');
    for (const f of own) {
      lines.push(`| ${LABEL[f.severity]}${f.contested ? t.disputed : ''} | ${f.ids.join(', ')} | \`${f.file}${f.line ? `:${f.line}` : ''}\` | ${f.category} |`);
    }
  }
  const screens = meta.artifacts.filter(a => a.type === 'screenshot');
  if (screens.length) lines.push('', t.screenshots(screens.map(s => `\`${s.path}\``).join(', ')));
  return lines.join('\n');
}
