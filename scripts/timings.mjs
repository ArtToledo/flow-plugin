#!/usr/bin/env node
// Step timings of a /ship run, stored in state.json.
//   start  <state.json> <step> [--slice N] [--round R]   closes the open step and opens this one
//   end    <state.json>                                  closes the open step (pause, stop or end of the run)
//   report <state.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, fail } from './lib/args.mjs';
import { endStep, startStep, timingReport } from './lib/timings.mjs';

const args = parseArgs(process.argv.slice(2));
const [command, file, step] = args._;
if (!file) fail('Usage: start <state.json> <step> [--slice N] [--round R] | end <state.json> | report <state.json>');
const state = JSON.parse(readFileSync(file, 'utf8'));
const slice = args.slice === undefined ? null : Number(args.slice);
const round = args.round === undefined ? null : Number(args.round);
const save = () => writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);

switch (command) {
  case 'start':
    if (!step) fail('The step is required.');
    startStep(state, step, { slice, round });
    save();
    break;
  case 'end':
    endStep(state);
    save();
    break;
  case 'report':
    process.stdout.write(`${timingReport(state)}\n`);
    break;
  default:
    fail('Commands: start | end | report');
}
