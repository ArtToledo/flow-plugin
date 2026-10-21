#!/usr/bin/env node
// CLI do contrato de review.
//   validate <arquivo> [--write]          valida a resposta de um revisor; --write grava o JSON normalizado
//   consolidate <pasta-da-rodada>         junta os <revisor>.json da pasta em consolidated.json
//   payload <consolidated.json> --diff <arquivo> [--commit <sha>] --out <arquivo>
//   summary <consolidated.json> --reviewer <nome>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, fail } from './lib/args.mjs';
import { REVIEWERS, buildReviewPayload, consolidate, extractJson, reviewerSummary, validateReview } from './lib/review.mjs';

const args = parseArgs(process.argv.slice(2));
const [command, target] = args._;
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

switch (command) {
  case 'validate': {
    let review;
    try {
      review = extractJson(readFileSync(target, 'utf8'));
    } catch (err) {
      fail(err.message);
    }
    const errors = validateReview(review);
    if (errors.length) fail(`Review inválida (${target}):\n- ${errors.join('\n- ')}`);
    if (args.write) writeFileSync(target, `${JSON.stringify(review, null, 2)}\n`);
    process.stdout.write(`ok: ${review.reviewer}, ${review.findings.length} achado(s)\n`);
    break;
  }
  case 'consolidate': {
    const reviews = REVIEWERS.map(r => join(target, `${r}.json`)).filter(existsSync).map(readJson);
    if (reviews.length === 0) fail(`Nenhum <revisor>.json em ${target}.`);
    for (const review of reviews) {
      const errors = validateReview(review);
      if (errors.length) fail(`Review inválida (${review.reviewer}):\n- ${errors.join('\n- ')}`);
    }
    const result = consolidate(reviews);
    writeFileSync(join(target, 'consolidated.json'), `${JSON.stringify(result, null, 2)}\n`);
    const { counts } = result;
    process.stdout.write(
      `${counts.blocker} blocker, ${counts.major} major, ${counts.minor} minor, ${counts.nit} nit — needsFix=${result.needsFix} hasBlocker=${result.hasBlocker}\n`,
    );
    break;
  }
  case 'payload': {
    if (!args.diff || !args.out) fail('Uso: payload <consolidated.json> --diff <arquivo> [--commit <sha>] --out <arquivo>');
    const payload = buildReviewPayload(readJson(target), readFileSync(args.diff, 'utf8'), args.commit);
    writeFileSync(args.out, `${JSON.stringify(payload, null, 2)}\n`);
    process.stdout.write(`${payload.comments.length} comentário(s) inline\n`);
    break;
  }
  case 'summary': {
    if (!args.reviewer) fail('Uso: summary <consolidated.json> --reviewer <nome>');
    process.stdout.write(`${reviewerSummary(readJson(target), args.reviewer)}\n`);
    break;
  }
  default:
    fail('Comandos: validate | consolidate | payload | summary');
}
