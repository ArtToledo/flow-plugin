// Converte ["cmd", "--a", "1", "--flag"] em { _: ["cmd"], a: "1", flag: true }.
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else out[key] = argv[++i];
    } else {
      out._.push(arg);
    }
  }
  return out;
}

export function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
