function normalizeTrailingWhitespace(line: string) {
  if (!/[ \t]+$/.test(line)) return line;
  if (/\S[ \t]{2,}$/.test(line)) return line.replace(/[ \t]+$/, '  ');
  return line.replace(/[ \t]+$/, '');
}

function normalizeMarkdownLine(line: string) {
  let formatted = normalizeTrailingWhitespace(line);

  const headingMatch = /^(\s{0,3})(#{1,6})[ \t]+(.+)$/.exec(formatted);
  if (headingMatch) {
    const [, indent = '', markers = '', text = ''] = headingMatch;
    formatted = `${indent}${markers} ${text.trimStart()}`;
  }

  const taskMatch = /^(\s*)([-+*])[ \t]+\[([ xX])\][ \t]*(.*)$/.exec(formatted);
  if (taskMatch) {
    const [, indent = '', bullet = '', marker = ' ', text = ''] = taskMatch;
    formatted = `${indent}${bullet} [${marker.toLowerCase() === 'x' ? 'x' : ' '}] ${text.trimStart()}`;
  } else {
    const unorderedMatch = /^(\s*)([-+*])[ \t]+(.+)$/.exec(formatted);
    if (unorderedMatch) {
      const [, indent = '', bullet = '', text = ''] = unorderedMatch;
      formatted = `${indent}${bullet} ${text.trimStart()}`;
    }
  }

  const orderedMatch = /^(\s*)(\d+[.)])[ \t]+(.+)$/.exec(formatted);
  if (orderedMatch) {
    const [, indent = '', marker = '', text = ''] = orderedMatch;
    formatted = `${indent}${marker} ${text.trimStart()}`;
  }

  return formatted;
}

function getFenceMarker(line: string) {
  const match = /^\s{0,3}(```+|~~~+)/.exec(line);
  if (!match) return null;
  const fence = match[1] ?? '';
  return {
    char: fence[0] ?? '`',
    length: fence.length,
  };
}

function isClosingFence(line: string, fence: { char: string; length: number }) {
  const closePattern = new RegExp(`^\\s{0,3}${fence.char.repeat(fence.length)}${fence.char}*\\s*$`);
  return closePattern.test(line);
}

function isAtxHeading(line: string) {
  return /^\s{0,3}#{1,6}\s+\S/.test(line);
}

export function formatMarkdownDocument(input: string) {
  const normalizedInput = input.replace(/\r\n?/g, '\n');
  const hadTrailingNewline = normalizedInput.endsWith('\n');
  const lines = normalizedInput.split('\n');
  if (hadTrailingNewline) lines.pop();

  const output: string[] = [];
  let pendingBlankLine = false;
  let forceBlankBeforeNext = false;
  let activeFence: { char: string; length: number } | null = null;

  for (const rawLine of lines) {
    if (activeFence) {
      output.push(rawLine);
      if (isClosingFence(rawLine, activeFence)) {
        activeFence = null;
        forceBlankBeforeNext = true;
      } else {
        forceBlankBeforeNext = false;
      }
      pendingBlankLine = false;
      continue;
    }

    const line = normalizeMarkdownLine(rawLine);
    const trimmed = line.trim();

    if (!trimmed) {
      pendingBlankLine = output.length > 0;
      forceBlankBeforeNext = false;
      continue;
    }

    const isHeading = isAtxHeading(line);
    const fence = getFenceMarker(line);
    const shouldInsertBlank = output.length > 0
      && output[output.length - 1] !== ''
      && (pendingBlankLine || forceBlankBeforeNext || isHeading || Boolean(fence));

    if (shouldInsertBlank) output.push('');
    output.push(line);

    activeFence = fence;
    pendingBlankLine = false;
    forceBlankBeforeNext = isHeading && !fence;
  }

  while (output[output.length - 1] === '') output.pop();

  const result = output.join('\n');
  return hadTrailingNewline && result ? `${result}\n` : result;
}
