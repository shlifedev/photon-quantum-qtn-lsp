import { Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

export interface IdentifierOptions {
  allowHashPrefix?: boolean;
}

export function getIdentifierAtPosition(
  document: TextDocument,
  position: Position,
  options: IdentifierOptions = {}
): string | null {
  const text = document.getText();
  const offset = document.offsetAt(position);

  if (getCodeContext(text, offset).inCommentOrString) {
    return null;
  }

  let start = offset;
  while (start > 0 && isIdentifierChar(text[start - 1])) {
    start--;
  }

  if (options.allowHashPrefix && start > 0 && text[start - 1] === '#') {
    start--;
  }

  let end = offset;
  while (end < text.length && isIdentifierChar(text[end])) {
    end++;
  }

  if (start === end) {
    return null;
  }

  return text.substring(start, end);
}

export function isIdentifierChar(ch: string): boolean {
  return /^[a-zA-Z0-9_@]$/.test(ch);
}

/** Mask comments/strings while preserving UTF-16 offsets and line endings. */
export function getCodeContext(text: string, offset: number): {
  code: string;
  inCommentOrString: boolean;
} {
  const chars = text.slice(0, offset).split('');
  let state: 'code' | 'string' | 'lineComment' | 'blockComment' = 'code';
  const mask = (index: number) => {
    if (chars[index] !== '\r' && chars[index] !== '\n') chars[index] = ' ';
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (state === 'lineComment') {
      if (ch === '\n' || ch === '\r') state = 'code';
      mask(i);
    } else if (state === 'blockComment') {
      mask(i);
      if (ch === '*' && next === '/' && i + 1 < chars.length) {
        mask(++i);
        state = 'code';
      }
    } else if (state === 'string') {
      mask(i);
      if (ch === '\\' && i + 1 < chars.length) mask(++i);
      else if (ch === '"') state = 'code';
    } else if (ch === '"') {
      mask(i);
      state = 'string';
    } else if (ch === '/' && (next === '/' || next === '*') && i + 1 < chars.length) {
      mask(i);
      mask(++i);
      state = next === '/' ? 'lineComment' : 'blockComment';
    }
  }

  return { code: chars.join(''), inCommentOrString: state !== 'code' };
}
