#!/usr/bin/env node
// Review threads the flow opened on a PR.
//   list --pr <n> [--slice NN] [--all]       prints the open flow threads as JSON (--all includes resolved ones)
//   sync --pr <n> --slice NN --current <consolidated.json> --commit <sha> [--lang en|pt-BR] [--dry-run]
//        replies "fixed in <sha>" and resolves every open thread whose findings are gone from the latest review
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs, fail } from './lib/args.mjs';
import { messages } from './lib/i18n.mjs';
import { flowThreads, threadsToResolve } from './lib/review.mjs';

const QUERY = `query($owner: String!, $repo: String!, $n: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $n) {
      reviewThreads(first: 100) { nodes { id isResolved comments(first: 1) { nodes { databaseId body } } } }
    }
  }
}`;
const RESOLVE = 'mutation($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { isResolved } } }';

const args = parseArgs(process.argv.slice(2));
const [command] = args._;
const slice = args.slice === undefined ? undefined : String(args.slice);
const gh = list => execFileSync('gh', list, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function fetchThreads(pr) {
  // gh fills {owner} and {repo} from the repository in the current folder.
  const out = gh(['api', 'graphql', '-f', `query=${QUERY}`, '-F', 'owner={owner}', '-F', 'repo={repo}', '-F', `n=${pr}`]);
  return flowThreads(JSON.parse(out));
}

try {
  if (!args.pr) fail('--pr is required');
  switch (command) {
    case 'list': {
      const threads = fetchThreads(args.pr).filter(th => (args.all || !th.resolved) && (slice === undefined || th.slice === slice));
      process.stdout.write(`${JSON.stringify(threads, null, 2)}\n`);
      break;
    }
    case 'sync': {
      if (!slice || !args.current || !args.commit) fail('Usage: sync --pr <n> --slice NN --current <consolidated.json> --commit <sha> [--lang en|pt-BR] [--dry-run]');
      const t = messages(args.lang ?? 'en');
      const current = JSON.parse(readFileSync(args.current, 'utf8'));
      const toResolve = threadsToResolve(fetchThreads(args.pr), current, slice);
      for (const th of toResolve) {
        if (args['dry-run']) continue;
        gh(['api', `repos/{owner}/{repo}/pulls/${args.pr}/comments/${th.commentId}/replies`, '--method', 'POST', '-f', `body=${t.fixedReply(args.commit)}`]);
        gh(['api', 'graphql', '-f', `query=${RESOLVE}`, '-F', `id=${th.threadId}`]);
      }
      const verb = args['dry-run'] ? 'would resolve' : 'resolved';
      process.stdout.write(`${verb} ${toResolve.length} thread(s)${toResolve.length ? `: ${toResolve.flatMap(th => th.ids).join(', ')}` : ''}\n`);
      break;
    }
    default:
      fail('Commands: list | sync');
  }
} catch (err) {
  fail(err.stderr?.toString() || err.message);
}
