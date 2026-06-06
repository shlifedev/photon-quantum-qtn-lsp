// Tests for the hover handler across its lookup tiers:
// keyword → builtin type → attribute → user-defined symbol.

import { describe, it, expect } from 'vitest';
import { handleHover } from '../hover.js';
import { setupDocument, pos } from './helpers.js';

function hoverText(source: string, line: number, character: number): string | null {
  const { projectModel, documents, uri } = setupDocument(source);
  const hover = handleHover(
    { textDocument: { uri }, position: pos(line, character) },
    projectModel,
    documents,
  );
  if (!hover) return null;
  return (hover.contents as { value: string }).value;
}

describe('Hover handler', () => {
  it('describes a declaration keyword', () => {
    const value = hoverText('component Player {}', 0, 3);
    expect(value).toContain('component');
  });

  it('describes a builtin type', () => {
    const value = hoverText('component P {\n  FP X;\n}', 1, 3);
    expect(value).toContain('FP');
  });

  it('describes an attribute', () => {
    const value = hoverText('[Header("x")]\ncomponent P {}', 0, 3);
    expect(value).toContain('Header');
  });

  it('describes a user-defined type with its declaration site', () => {
    const source = `enum Weapon { Sword }
component P {
  Weapon W;
}`;
    const value = hoverText(source, 2, 4);
    expect(value).not.toBeNull();
    // User-defined hover resolves to the symbol and cites its source file.
    expect(value).toContain('test.qtn');
  });

  it('returns null when the cursor is not on an identifier', () => {
    // Leading blank line: offset 0 sits on a newline, no identifier to resolve.
    expect(hoverText('\ncomponent P {}', 0, 0)).toBeNull();
  });
});
