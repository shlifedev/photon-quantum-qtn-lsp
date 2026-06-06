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
  return /[a-zA-Z0-9_]/.test(ch);
}

export interface BracketScan {
  /** Net nesting depth of '[' minus ']' outside strings/comments. */
  squareDepth: number;
  /** Net nesting depth of '{' minus '}' outside strings/comments. */
  braceDepth: number;
}

/**
 * Single-pass scan that tracks line/block comments and string literals, then
 * reports the net nesting depth of square brackets and curly braces in code.
 *
 * String parsing counts the run of consecutive backslashes before a quote: an
 * odd run means the quote is escaped (e.g. `"...\""`), an even run (including
 * zero) means it is a real delimiter. A naive "previous char isn't a backslash"
 * check mis-reads a literal that ends in an escaped backslash like `"a\\"`.
 */
export function scanBrackets(text: string): BracketScan {
  let squareDepth = 0;
  let braceDepth = 0;
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (!inString && !inBlockComment && ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (!inString && !inLineComment && ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (inBlockComment && ch === '*' && next === '/') {
      inBlockComment = false;
      i++;
      continue;
    }
    if (inLineComment && (ch === '\n' || ch === '\r')) {
      inLineComment = false;
      continue;
    }

    if (inLineComment || inBlockComment) continue;

    if (ch === '"') {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) {
        backslashes++;
      }
      if (backslashes % 2 === 0) {
        inString = !inString;
      }
      continue;
    }

    if (inString) continue;

    if (ch === '[') {
      squareDepth++;
    } else if (ch === ']') {
      squareDepth--;
    } else if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
    }
  }

  return { squareDepth, braceDepth };
}
