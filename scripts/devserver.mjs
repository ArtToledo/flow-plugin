#!/usr/bin/env node
// Sobe e derruba o servidor local usado pelo browser-tester.
//   start --name dev --cmd "npm run dev" --url http://localhost:3000 [--ready /health] --dir <pasta> [--timeout 120]
//   stop  --name dev --dir <pasta>
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, fail } from './lib/args.mjs';

const args = parseArgs(process.argv.slice(2));
const [command] = args._;
const name = args.name ?? 'dev';
if (!args.dir) fail('--dir é obrigatório');
mkdirSync(args.dir, { recursive: true });
const pidFile = join(args.dir, `${name}.pid`);
const logFile = join(args.dir, `${name}.log`);

function kill(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    // processo já terminou
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
  if (!args.cmd || !args.url) fail('Uso: start --name <n> --cmd "<comando>" --url <url> [--ready /path] --dir <pasta>');
  const readyUrl = new URL(args.ready ?? '/', args.url).toString();
  if (await isReady(readyUrl)) fail(`Já existe algo respondendo em ${readyUrl}. Pare-o antes de rodar o fluxo.`);
  const log = openSync(logFile, 'w');
  const child = spawn(args.cmd, { shell: true, detached: true, stdio: ['ignore', log, log] });
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  const deadline = Date.now() + Number(args.timeout ?? 120) * 1000;
  while (Date.now() < deadline) {
    if (await isReady(readyUrl)) {
      process.stdout.write(`pronto: ${readyUrl} (pid ${child.pid})\n`);
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  kill(child.pid);
  rmSync(pidFile, { force: true });
  const tail = readFileSync(logFile, 'utf8').split('\n').slice(-30).join('\n');
  fail(`Servidor não respondeu em ${readyUrl} a tempo. Últimas linhas do log:\n${tail}`);
} else if (command === 'stop') {
  if (!existsSync(pidFile)) {
    process.stdout.write('nada a parar\n');
  } else {
    kill(Number(readFileSync(pidFile, 'utf8')));
    rmSync(pidFile, { force: true });
    process.stdout.write('parado\n');
  }
} else {
  fail('Comandos: start | stop');
}
