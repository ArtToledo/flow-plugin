import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesAny } from '../lib/glob.mjs';
import { route } from '../lib/route.mjs';

test('globs com ** e *', () => {
  assert.ok(matchesAny('src/app/page.tsx', ['src/**/*.tsx']));
  assert.ok(matchesAny('src/page.tsx', ['src/**/*.tsx']));
  assert.ok(!matchesAny('lib/page.tsx', ['src/**/*.tsx']));
  assert.ok(matchesAny('a/b/auth/login.ts', ['**/auth/**']));
  assert.ok(matchesAny('styles/x.scss', ['**/*.{css,scss}']));
});

test('padrão sem barra casa em qualquer profundidade', () => {
  assert.ok(matchesAny('Dockerfile', ['Dockerfile']));
  assert.ok(matchesAny('apps/api/package.json', ['package.json']));
  assert.ok(!matchesAny('package.json.bak', ['package.json']));
});

test('caminho com barra invertida', () => {
  assert.ok(matchesAny(['src', 'app', 'x.tsx'].join('\\'), ['src/**/*.tsx']));
});

test('roteamento: code sempre, demais por glob, browser só com config', () => {
  const config = {
    routing: { ui: ['src/**/*.tsx'], ux: ['src/app/**'], security: ['**/auth/**'] },
    browser: { devCommand: 'npm run dev', url: 'http://localhost:3000' },
  };
  const r = route(['src/app/page.tsx', 'README.md'], config);
  assert.deepEqual(r.reviewers, ['code', 'ux', 'ui']);
  assert.equal(r.browser, true);
  const backend = route(['src/auth/jwt.ts'], config);
  assert.deepEqual(backend.reviewers, ['code', 'security']);
  assert.equal(backend.browser, false);
  assert.equal(route(['src/app/page.tsx'], { routing: config.routing }).browser, false);
});
