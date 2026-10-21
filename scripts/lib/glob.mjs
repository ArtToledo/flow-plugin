// Glob mínimo, sem dependências. Semântica parecida com .gitignore:
// padrão sem "/" casa com o nome do arquivo em qualquer profundidade.
export function globToRegExp(glob) {
  const anywhere = !glob.includes('/');
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(anywhere ? `^(?:.*/)?${re}$` : `^${re}$`);
}

// "**/*.{css,scss}" vira ["**/*.css", "**/*.scss"].
export function expandBraces(glob) {
  const match = glob.match(/\{([^{}]*)\}/);
  if (!match) return [glob];
  const [before, after] = [glob.slice(0, match.index), glob.slice(match.index + match[0].length)];
  return match[1].split(',').flatMap(alt => expandBraces(`${before}${alt}${after}`));
}

export function matchesAny(file, globs = []) {
  const path = file.replace(/\\/g, '/');
  return globs
    .flatMap(expandBraces)
    .some(g => globToRegExp(g.replace(/^\.\//, '')).test(path));
}
