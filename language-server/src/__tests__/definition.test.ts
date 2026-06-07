// Tests for go-to-definition: user-defined types resolve to their declaration,
// builtins and non-symbols resolve to nothing.

import { describe, it, expect } from 'vitest';
import { handleDefinition } from '../definition.js';
import { setupDocument, pos } from './helpers.js';

function define(source: string, line: number, character: number) {
  const { projectModel, documents, uri } = setupDocument(source);
  return handleDefinition(
    { textDocument: { uri }, position: pos(line, character) },
    projectModel,
    documents,
  );
}

describe('Definition handler', () => {
  it('resolves a user-defined type reference to its declaration', () => {
    const source = `enum Weapon { Sword }
component P {
  Weapon W;
}`;
    const loc = define(source, 2, 4);
    expect(loc).not.toBeNull();
    expect(loc!.uri).toBe('test://test.qtn');
    expect(loc!.range.start.line).toBe(0);
  });

  it('returns null for a builtin type', () => {
    const loc = define('component P {\n  FP X;\n}', 1, 3);
    expect(loc).toBeNull();
  });

  it('returns null for a field name (not a top-level symbol)', () => {
    const loc = define('component P {\n  FP Health;\n}', 1, 6);
    expect(loc).toBeNull();
  });

  it('returns null for identifiers inside comments and strings', () => {
    const source = `enum Weapon { Sword }
component P {
  // Weapon comment
  [Header("Weapon")]
  FP Value;
}`;
    expect(define(source, 2, 5)).toBeNull();
    expect(define(source, 3, 12)).toBeNull();
  });
});
