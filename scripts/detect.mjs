#!/usr/bin/env node
// Gathers project facts for /flow-init: branches, quality commands, stack,
// relevant folders and dev server. Read-only; prints JSON.
// Usage: node detect.mjs [--dir .]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './lib/args.mjs';

const args = parseArgs(process.argv.slice(2));
const root = args.dir ?? '.';
const has = p => existsSync(join(root, p));
const read = p => (has(p) ? readFileSync(join(root, p), 'utf8') : null);

function run(cmd, cmdArgs) {
  try {
    return execFileSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function detectBranches() {
  const lsRemote = run('git', ['ls-remote', '--heads', 'origin']);
  const remote = lsRemote
    ? lsRemote.split('\n').map(l => l.split('refs/heads/')[1]).filter(Boolean)
    : (run('git', ['branch', '-r', '--format=%(refname:short)']) ?? '')
        .split('\n')
        .map(b => b.replace(/^origin\//, ''))
        .filter(b => b && b !== 'origin' && b !== 'HEAD');
  const local = (run('git', ['branch', '--format=%(refname:short)']) ?? '').split('\n').filter(Boolean);
  let defaultBranch = run('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])?.replace(/^origin\//, '') ?? null;
  defaultBranch ??= run('gh', ['repo', 'view', '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name']);
  const relevant = b => /^(main|master|dev|develop|development|staging|homolog|release\/.+)$/.test(b);
  return {
    hasRemote: lsRemote !== null || remote.length > 0,
    default: defaultBranch,
    relevant: [...new Set(remote.filter(relevant))],
    localOnly: local.filter(b => relevant(b) && !remote.includes(b)),
  };
}

function packageManager() {
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('yarn.lock')) return 'yarn';
  if (has('bun.lockb') || has('bun.lock')) return 'bun';
  if (has('package-lock.json') || has('package.json')) return 'npm';
  return null;
}

const SCRIPT_CANDIDATES = {
  lint: ['lint', 'lint:all', 'eslint'],
  typecheck: ['typecheck', 'type-check', 'check-types', 'types', 'tsc'],
  test: ['test', 'test:unit', 'test:ci'],
  build: ['build'],
  e2e: ['test:e2e', 'e2e', 'playwright'],
};

function nodeProject() {
  const raw = read('package.json');
  if (!raw) return null;
  const pkg = JSON.parse(raw);
  const pm = packageManager();
  const scripts = pkg.scripts ?? {};
  const runScript = s => (s === 'test' && pm !== 'bun' ? `${pm} test` : `${pm} run ${s}`);
  const commands = {};
  for (const [kind, names] of Object.entries(SCRIPT_CANDIDATES)) {
    const found = names.find(n => scripts[n]);
    if (found) commands[kind] = runScript(found);
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!commands.typecheck && deps.typescript && has('tsconfig.json')) commands.typecheck = 'npx tsc --noEmit';
  if (!commands.e2e && deps['@playwright/test']) commands.e2e = 'npx playwright test';
  const frameworks = [
    'next', 'react', 'react-native', 'expo', 'vue', 'nuxt', 'svelte', '@sveltejs/kit', '@angular/core', 'vite',
    'express', '@nestjs/core', 'fastify', 'hono', 'prisma', 'typeorm', 'drizzle-orm', '@playwright/test', 'jest', 'vitest',
  ].filter(f => deps[f]);
  const devScript = ['dev', 'start:dev', 'start'].find(s => scripts[s]);
  let dev = null;
  if (devScript) {
    const port = scripts[devScript].match(/(?:--port|-p)[ =](\d+)/)?.[1]
      ?? (deps.vite && !deps.next ? '5173' : deps['@angular/core'] ? '4200' : '3000');
    dev = { command: runScript(devScript), url: `http://localhost:${port}` };
  }
  const seed = Object.keys(scripts).filter(s => /seed/.test(s)).map(runScript);
  return { packageManager: pm, workspaces: pkg.workspaces ?? null, scripts, commands, frameworks, dev, seedCandidates: seed };
}

function makeTargets() {
  const raw = read('Makefile');
  if (!raw) return null;
  const targets = [...raw.matchAll(/^([A-Za-z0-9_.-]+):(?!=)/gm)].map(m => m[1]).filter(t => !t.startsWith('.'));
  const commands = {};
  for (const [kind, names] of Object.entries(SCRIPT_CANDIDATES)) {
    const found = names.find(n => targets.includes(n));
    if (found) commands[kind] = `make ${found}`;
  }
  return { targets, commands };
}

function otherStacks() {
  const stacks = {};
  if (has('pyproject.toml') || has('requirements.txt')) {
    const py = read('pyproject.toml') ?? '';
    stacks.python = {
      commands: {
        ...(py.includes('ruff') && { lint: 'ruff check .' }),
        ...(py.includes('mypy') && { typecheck: 'mypy .' }),
        test: 'pytest',
      },
    };
  }
  if (has('go.mod')) stacks.go = { commands: { lint: 'go vet ./...', test: 'go test ./...', build: 'go build ./...' } };
  if (has('Cargo.toml')) {
    stacks.rust = { commands: { lint: 'cargo clippy -- -D warnings', test: 'cargo test', build: 'cargo build' } };
  }
  return stacks;
}

const DIRS = [
  'src', 'src/app', 'src/pages', 'src/screens', 'src/components', 'src/modules', 'src/domain', 'src/infra',
  'app', 'pages', 'components', 'screens', 'apps', 'packages', 'frontend', 'backend', 'web', 'api', 'server',
  'infra', 'terraform', 'deploy', 'k8s', 'migrations', 'prisma', 'db', 'e2e', 'tests', 'test', '.github/workflows',
];

function listChildren(dir) {
  try {
    return readdirSync(join(root, dir), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => `${dir}/${d.name}`);
  } catch {
    return [];
  }
}

const result = {
  branches: detectBranches(),
  node: nodeProject(),
  make: makeTargets(),
  other: otherStacks(),
  dirs: DIRS.filter(has),
  monorepoPackages: [...listChildren('apps'), ...listChildren('packages')],
  files: ['Dockerfile', 'docker-compose.yml', 'compose.yaml', 'CLAUDE.md', 'playwright.config.ts', 'tsconfig.json'].filter(has),
  existing: { flowJson: has('.claude/flow.json'), gitignore: has('.gitignore'), checklists: has('.claude/checklists') },
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
