#!/usr/bin/env node
// Starts and stops the local server used by the browser-tester.
//   start --name dev --cmd "npm run dev" --url http://localhost:3000 [--ready /health] --dir <folder> [--timeout 120]
//   stop  --name dev --dir <folder>
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, fail } from './lib/args.mjs';

const args = parseArgs(process.argv.slice(2));
const [command] = args._;
const name = args.name ?? 'dev';
if (!args.dir) fail('--dir is required');
mkdirSync(args.dir, { recursive: true });
const pidFile = join(args.dir, `${name}.pid`);
const logFile = join(args.dir, `${name}.log`);

function kill(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    // process already exited
  }
}

async function isReady(url) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
    return res.status < 400;
  } catch {
    return false;
  }
}

if (command === 'start') {
  if (!args.cmd || !args.url) fail('Usage: start --name <n> --cmd "<command>" --url <url> [--ready /path] --dir <folder>');
  const readyUrl = new URL(args.ready ?? '/', args.url).toString();
  if (await isReady(readyUrl)) fail(`Something is already answering at ${readyUrl}. Stop it before running the flow.`);
  const log = openSync(logFile, 'w');
  const child = spawn(args.cmd, { shell: true, detached: true, stdio: ['ignore', log, log] });
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  const deadline = Date.now() + Number(args.timeout ?? 120) * 1000;
  while (Date.now() < deadline) {
    if (await isReady(readyUrl)) {
      process.stdout.write(`ready: ${readyUrl} (pid ${child.pid})\n`);
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  kill(child.pid);
  rmSync(pidFile, { force: true });
  const tail = readFileSync(logFile, 'utf8').split('\n').slice(-30).join('\n');
  fail(`Server did not answer at ${readyUrl} in time. Last log lines:\n${tail}`);
} else if (command === 'stop') {
  if (!existsSync(pidFile)) {
    process.stdout.write('nothing to stop\n');
  } else {
    kill(Number(readFileSync(pidFile, 'utf8')));
    rmSync(pidFile, { force: true });
    process.stdout.write('stopped\n');
  }
} else {
  fail('Commands: start | stop');
}
