// Contrato de review: validação, consolidação e montagem dos comentários do PR.
// O formato está descrito em skills/ship/reference/review-schema.json.

export const SEVERITIES = ['blocker', 'major', 'minor', 'nit'];
export const REVIEWERS = ['security', 'ux', 'ui', 'code', 'browser'];
const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

// Aceita o JSON puro ou a resposta do agente com um bloco ```json.
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
      // tenta o próximo candidato
    }
  }
  throw new Error('Nenhum objeto JSON válido encontrado na resposta.');
}

const isText = v => typeof v === 'string' && v.trim().length > 0;

export function validateReview(review) {
  const errors = [];
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    return ['A raiz precisa ser um objeto.'];
  }
  if (!REVIEWERS.includes(review.reviewer)) errors.push(`reviewer deve ser um de: ${REVIEWERS.join(', ')}.`);
  if (!Number.isInteger(review.round) || review.round < 1) errors.push('round deve ser inteiro >= 1.');
  if (!isText(review.summary)) errors.push('summary é obrigatório.');
  if (!Array.isArray(review.findings)) {
    errors.push('findings deve ser uma lista (vazia se não houver achados).');
    return errors;
  }
  const ids = new Set();
  review.findings.forEach((f, i) => {
    const at = `findings[${i}]`;
    if (!f || typeof f !== 'object') return errors.push(`${at} deve ser um objeto.`);
    for (const key of ['id', 'category', 'file', 'evidence', 'fix']) {
      if (!isText(f[key])) errors.push(`${at}.${key} é obrigatório.`);
    }
    if (!SEVERITIES.includes(f.severity)) errors.push(`${at}.severity deve ser um de: ${SEVERITIES.join(', ')}.`);
    if (f.line !== null && (!Number.isInteger(f.line) || f.line < 1)) errors.push(`${at}.line deve ser inteiro >= 1 ou null.`);
    if (f.checklistRef !== undefined && typeof f.checklistRef !== 'string') errors.push(`${at}.checklistRef deve ser texto.`);
    if (f.contested !== undefined && typeof f.contested !== 'boolean') errors.push(`${at}.contested deve ser booleano.`);
    if (f.builderNote !== undefined && typeof f.builderNote !== 'string') errors.push(`${at}.builderNote deve ser texto.`);
    if (ids.has(f.id)) errors.push(`${at}.id repetido: ${f.id}.`);
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

// Dois achados são o mesmo quando apontam o mesmo arquivo, linhas a até 2 de
// distância, e têm a mesma categoria ou evidência parecida.
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

// Linhas do lado novo (RIGHT) que aparecem em algum hunk do diff unificado.
// O GitHub só aceita comentário inline nessas linhas.
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

function findingBody(f) {
  const lines = [
    `**${LABEL[f.severity]}** · \`${f.ids.join(', ')}\` · ${f.reviewers.join(', ')} · ${f.category}`,
    '',
    f.evidence,
    '',
    `**Correção sugerida:** ${f.fix}`,
  ];
  if (f.checklistRef) lines.push('', `Checklist: \`${f.checklistRef}\``);
  if (f.contested) lines.push('', `⚠️ **Pendente:** contestado pelo builder${f.builderNote ? ` — ${f.builderNote}` : ''}. Decisão humana.`);
  return lines.join('\n');
}

// Payload para POST /repos/{owner}/{repo}/pulls/{n}/reviews. O evento é sempre
// COMMENT: o autor não pode pedir mudanças no próprio PR. Nits e achados fora do
// diff vão agrupados no corpo da review.
export function buildReviewPayload(consolidated, diffText, commitId) {
  const lines = commentableLines(diffText);
  const comments = [];
  const general = [];
  const nits = [];
  for (const f of consolidated.findings) {
    if (f.severity === 'nit') {
      nits.push(f);
    } else if (f.line !== null && lines.get(f.file)?.has(f.line)) {
      comments.push({ path: f.file, line: f.line, side: 'RIGHT', body: findingBody(f) });
    } else {
      general.push(f);
    }
  }
  const { blocker, major, minor, nit } = consolidated.counts;
  const body = [
    `## Review automatizada — rodada ${consolidated.round}`,
    '',
    `${blocker} blocker · ${major} major · ${minor} minor · ${nit} nit`,
  ];
  if (general.length) {
    body.push('', '### Achados fora das linhas do diff', '');
    for (const f of general) body.push(`- \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${findingBody(f).replace(/\n+/g, ' ')}`);
  }
  if (nits.length) {
    body.push('', '<details><summary>Nits (' + nits.length + ')</summary>', '');
    for (const f of nits) body.push(`- \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${f.evidence} → ${f.fix}`);
    body.push('', '</details>');
  }
  const payload = { event: 'COMMENT', body: body.join('\n'), comments };
  if (commitId) payload.commit_id = commitId;
  return payload;
}

// Comentário-resumo de um revisor (um por revisor, via gh pr comment).
export function reviewerSummary(consolidated, reviewer) {
  const meta = consolidated.reviewers.find(r => r.reviewer === reviewer);
  if (!meta) throw new Error(`Revisor ${reviewer} não participou da rodada.`);
  const own = consolidated.findings.filter(f => f.reviewers.includes(reviewer));
  const lines = [`### Revisor: ${reviewer}`, '', meta.summary, ''];
  if (own.length === 0) {
    lines.push('Nenhum achado.');
  } else {
    lines.push('| Severidade | Id | Local | Categoria |', '| --- | --- | --- | --- |');
    for (const f of own) {
      lines.push(`| ${LABEL[f.severity]}${f.contested ? ' (contestado)' : ''} | ${f.ids.join(', ')} | \`${f.file}${f.line ? `:${f.line}` : ''}\` | ${f.category} |`);
    }
  }
  const screens = meta.artifacts.filter(a => a.type === 'screenshot');
  if (screens.length) {
    lines.push('', `Screenshots (locais, em \`.claude/flow-runs/\`): ${screens.map(s => `\`${s.path}\``).join(', ')}`);
  }
  return lines.join('\n');
}
