#!/usr/bin/env node
// Decides which reviewers run on a slice.
// Usage: node route.mjs --base <ref> [--head HEAD] [--config .claude/flow.json]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs, fail } from './lib/args.mjs';
import { route } from './lib/route.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.base) fail('Usage: node route.mjs --base <ref> [--head HEAD] [--config .claude/flow.json]');

const config = JSON.parse(readFileSync(args.config ?? '.claude/flow.json', 'utf8'));
const out = execFileSync('git', ['diff', '--name-only', `${args.base}...${args.head ?? 'HEAD'}`], { encoding: 'utf8' });
const files = out.split('\n').map(s => s.trim()).filter(Boolean);
process.stdout.write(`${JSON.stringify(route(files, config), null, 2)}\n`);
