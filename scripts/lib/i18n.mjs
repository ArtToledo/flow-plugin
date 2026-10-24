// Strings the scripts write into PRs. The language comes from flow.json.language.
export const LANGUAGES = ['en', 'pt-BR'];

const MESSAGES = {
  en: {
    suggestedFix: 'Suggested fix',
    checklist: 'Checklist',
    pending: note => `⚠️ **Pending:** disputed by the builder${note ? ` — ${note}` : ''}. Needs a human decision.`,
    reviewTitle: (round, slice) => `## Automated review — ${slice ? `slice ${slice}, ` : ''}round ${round}`,
    reviewersHeader: '| Reviewer | Summary |',
    fixedReply: sha => `✅ Fixed in \`${sha.slice(0, 7)}\`, confirmed by the automated re-review.`,
    outsideDiff: '### Findings outside the diff lines',
    nits: n => `Nits (${n})`,
    reviewer: name => `### Reviewer: ${name}`,
    noFindings: 'No findings.',
    tableHeader: '| Severity | Id | Location | Category |',
    disputed: ' (disputed)',
    claimedFixed: ' (reported fixed, not re-checked)',
    unverifiedHeader: '### Reported fixed by the builder, not re-checked yet',
    screenshots: list => `Screenshots (local, in \`.claude/flow-runs/\`): ${list}`,
  },
  'pt-BR': {
    suggestedFix: 'Correção sugerida',
    checklist: 'Checklist',
    pending: note => `⚠️ **Pendente:** contestado pelo builder${note ? ` — ${note}` : ''}. Decisão humana.`,
    reviewTitle: (round, slice) => `## Review automatizada — ${slice ? `fatia ${slice}, ` : ''}rodada ${round}`,
    reviewersHeader: '| Revisor | Resumo |',
    fixedReply: sha => `✅ Corrigido em \`${sha.slice(0, 7)}\`, confirmado pela re-review automatizada.`,
    outsideDiff: '### Achados fora das linhas do diff',
    nits: n => `Nits (${n})`,
    reviewer: name => `### Revisor: ${name}`,
    noFindings: 'Nenhum achado.',
    tableHeader: '| Severidade | Id | Local | Categoria |',
    disputed: ' (contestado)',
    claimedFixed: ' (corrigido segundo o builder, sem reverificação)',
    unverifiedHeader: '### Corrigidos segundo o builder, ainda sem reverificação',
    screenshots: list => `Screenshots (locais, em \`.claude/flow-runs/\`): ${list}`,
  },
};

export function messages(lang = 'en') {
  if (!MESSAGES[lang]) throw new Error(`Unsupported language: ${lang}. Use one of: ${LANGUAGES.join(', ')}.`);
  return MESSAGES[lang];
}
