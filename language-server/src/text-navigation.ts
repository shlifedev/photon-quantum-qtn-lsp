import { Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

export interface IdentifierOptions {
  allowHashPrefix?: boolean;
}

export function isPositionInCommentOrString(document: TextDocument, position: Position): boolean {
  return isOffsetInCommentOrString(document.getText(), document.offsetAt(position));
}

export function isOffsetInCommentOrString(text: string, offset: number): boolean {
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < offset && i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === '\n' || ch === '\r') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
    } else if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
    } else if (ch === '"') {
      inString = true;
    }
  }

  return inString || inLineComment || inBlockComment;
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
