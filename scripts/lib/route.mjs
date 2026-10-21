import { matchesAny } from './glob.mjs';

const ROUTED = ['security', 'ux', 'ui'];

// The code reviewer always runs; the others depend on the flow.json.routing globs.
// The browser-tester runs when config.browser exists and the diff touches
// routing.browser (or, without it, the ui and ux globs).
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
