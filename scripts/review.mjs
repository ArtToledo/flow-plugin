#!/usr/bin/env node
// Review contract CLI.
//   validate <file> [--write]          validates a reviewer reply; --write saves the normalized JSON
//   consolidate <round-dir>            merges the <reviewer>.json files of the folder into consolidated.json
//   carry <prev-round>/<reviewer>.json --response <builder-response.md> --round <R> --out <file>
//                                      carries a reviewer that is not called again into the next round
//   payload <consolidated.json> --diff <file> [--commit <sha>] [--slice NN] [--skip-open <threads.json>] [--lang en|pt-BR] --out <file>
//   summary <consolidated.json> --reviewer <name> [--lang en|pt-BR]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, fail } from './lib/args.mjs';
import {
  REVIEWERS, buildReviewPayload, carryForward, consolidate, extractJson, openThreadIds, parseBuilderResponse, reviewerSummary, validateReview,
} from './lib/review.mjs';

const args = parseArgs(process.argv.slice(2));
const [command, target] = args._;
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const lang = args.lang ?? 'en';
const slice = args.slice === undefined ? undefined : String(args.slice);

try {
  switch (command) {
    case 'validate': {
      const review = extractJson(readFileSync(target, 'utf8'));
      const errors = validateReview(review);
      if (errors.length) fail(`Invalid review (${target}):\n- ${errors.join('\n- ')}`);
      if (args.write) writeFileSync(target, `${JSON.stringify(review, null, 2)}\n`);
      process.stdout.write(`ok: ${review.reviewer}, ${review.findings.length} finding(s)\n`);
      break;
    }
    case 'consolidate': {
      const reviews = REVIEWERS.map(r => join(target, `${r}.json`)).filter(existsSync).map(readJson);
      if (reviews.length === 0) fail(`No <reviewer>.json in ${target}.`);
      for (const review of reviews) {
        const errors = validateReview(review);
        if (errors.length) fail(`Invalid review (${review.reviewer}):\n- ${errors.join('\n- ')}`);
      }
      const result = consolidate(reviews);
      writeFileSync(join(target, 'consolidated.json'), `${JSON.stringify(result, null, 2)}\n`);
      const { counts } = result;
      process.stdout.write(
        `${counts.blocker} blocker, ${counts.major} major, ${counts.minor} minor, ${counts.nit} nit — needsFix=${result.needsFix} hasBlocker=${result.hasBlocker}\n`,
      );
      break;
    }
    case 'carry': {
      if (!args.round || !args.out) fail('Usage: carry <reviewer.json> [--response <builder-response.md>] --round <R> --out <file>');
      const responses = args.response && existsSync(args.response) ? parseBuilderResponse(readFileSync(args.response, 'utf8')) : new Map();
      const carried = carryForward(readJson(target), responses, Number(args.round));
      writeFileSync(args.out, `${JSON.stringify(carried, null, 2)}\n`);
      process.stdout.write(`carried: ${carried.reviewer}, ${carried.findings.length} finding(s)\n`);
      break;
    }
    case 'payload': {
      if (!args.diff || !args.out) fail('Usage: payload <consolidated.json> --diff <file> [--commit <sha>] [--slice NN] [--skip-open <threads.json>] [--lang en|pt-BR] --out <file>');
      const skipIds = args['skip-open'] ? openThreadIds(readJson(args['skip-open']), slice) : new Set();
      const consolidated = readJson(target);
      const payload = buildReviewPayload(consolidated, readFileSync(args.diff, 'utf8'), { commitId: args.commit, lang, slice, skipIds });
      writeFileSync(args.out, `${JSON.stringify(payload, null, 2)}\n`);
      const fresh = consolidated.findings.filter(f => !f.ids.some(id => skipIds.has(id))).length;
      process.stdout.write(`${payload.comments.length} inline comment(s), ${fresh} new finding(s)\n`);
      break;
    }
    case 'summary': {
      if (!args.reviewer) fail('Usage: summary <consolidated.json> --reviewer <name> [--lang en|pt-BR]');
      process.stdout.write(`${reviewerSummary(readJson(target), args.reviewer, { lang })}\n`);
      break;
    }
    default:
      fail('Commands: validate | consolidate | carry | payload | summary');
  }
} catch (err) {
  fail(err.message);
}
