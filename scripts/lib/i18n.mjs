// Strings the scripts write into PRs. The language comes from flow.json.language.
export const LANGUAGES = ['en', 'pt-BR'];

const MESSAGES = {
  en: {
    suggestedFix: 'Suggested fix',
    checklist: 'Checklist',
    pending: note => `⚠️ **Pending:** disputed by the builder${note ? ` — ${note}` : ''}. Needs a human decision.`,
    reviewTitle: round => `## Automated review — round ${round}`,
    outsideDiff: '### Findings outside the diff lines',
    nits: n => `Nits (${n})`,
    reviewer: name => `### Reviewer: ${name}`,
    noFindings: 'No findings.',
    tableHeader: '| Severity | Id | Location | Category |',
    disputed: ' (disputed)',
    screenshots: list => `Screenshots (local, in \`.claude/flow-runs/\`): ${list}`,
  },
  'pt-BR': {
    suggestedFix: 'Correção sugerida',
    checklist: 'Checklist',
    pending: note => `⚠️ **Pendente:** contestado pelo builder${note ? ` — ${note}` : ''}. Decisão humana.`,
    reviewTitle: round => `## Review automatizada — rodada ${round}`,
    outsideDiff: '### Achados fora das linhas do diff',
    nits: n => `Nits (${n})`,
    reviewer: name => `### Revisor: ${name}`,
    noFindings: 'Nenhum achado.',
    tableHeader: '| Severidade | Id | Local | Categoria |',
    disputed: ' (contestado)',
    screenshots: list => `Screenshots (locais, em \`.claude/flow-runs/\`): ${list}`,
  },
};

export function messages(lang = 'en') {
  if (!MESSAGES[lang]) throw new Error(`Unsupported language: ${lang}. Use one of: ${LANGUAGES.join(', ')}.`);
  return MESSAGES[lang];
}
