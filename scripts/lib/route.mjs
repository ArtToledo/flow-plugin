import { matchesAny } from './glob.mjs';

const ROUTED = ['security', 'ux', 'ui'];

// O code reviewer roda sempre; os outros dependem dos globs de flow.json.routing.
// O browser-tester roda quando há config.browser e o diff toca routing.browser
// (ou, na falta dele, os globs de ui e ux).
export function route(files, config) {
  const routing = config.routing ?? {};
  const matched = {};
  for (const reviewer of ROUTED) {
    matched[reviewer] = files.filter(f => matchesAny(f, routing[reviewer]));
  }
  const browserGlobs = routing.browser ?? [...(routing.ui ?? []), ...(routing.ux ?? [])];
  matched.browser = files.filter(f => matchesAny(f, browserGlobs));
  return {
    files,
    reviewers: ['code', ...ROUTED.filter(r => matched[r].length > 0)],
    browser: Boolean(config.browser) && matched.browser.length > 0,
    matched,
  };
}
