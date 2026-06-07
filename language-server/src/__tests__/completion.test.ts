// Tests for the context-aware completion handler.
// Each case forces a specific completion context via cursor position and
// asserts the returned labels match the source-of-truth keyword/type lists.

import { describe, it, expect } from 'vitest';
import { handleCompletion } from '../completion.js';
import {
  TOP_LEVEL_KEYWORDS,
  IMPORT_SUB_KEYWORDS,
  ENUM_BASE_TYPES,
  ATTRIBUTES,
} from '../builtins.js';
import { setupDocument, pos } from './helpers.js';

function complete(source: string, line: number, character: number): string[] {
  const { projectModel, documents, uri } = setupDocument(source);
  return handleCompletion(
    { textDocument: { uri }, position: pos(line, character) },
    projectModel,
    documents,
  ).map((item) => item.label);
}

describe('Completion handler', () => {
  it('top-level context offers declaration keywords', () => {
    const labels = complete('', 0, 0);
    expect(labels).toEqual(expect.arrayContaining(TOP_LEVEL_KEYWORDS));
  });

  it('top-level context does not offer field-only modifiers', () => {
    const labels = complete('', 0, 0);
    expect(labels).not.toContain('local');
    expect(labels).not.toContain('remote');
  });

  it('field-type context offers builtin and user-defined types', () => {
    const source = `enum Weapon { Sword }
component Player {

}`;
    const labels = complete(source, 2, 0);
    expect(labels).toEqual(expect.arrayContaining(['FP', 'int', 'Weapon', 'local', 'remote']));
  });

  it('attribute context offers attribute names', () => {
    const labels = complete('[', 0, 1);
    expect(labels).toEqual(expect.arrayContaining(ATTRIBUTES.map((a) => a.name)));
  });

  it('import context offers import sub-keywords', () => {
    const labels = complete('import Weapon', 0, 'import Weapon'.length);
    expect(labels).toEqual(expect.arrayContaining(IMPORT_SUB_KEYWORDS));
  });

  it('enum-base context offers integer base types', () => {
    const labels = complete('enum Color :', 0, 'enum Color :'.length);
    expect(labels).toEqual(expect.arrayContaining(ENUM_BASE_TYPES));
  });

  it('generic argument context offers types', () => {
    const source = `component Player {
  list<
}`;
    const labels = complete(source, 1, 7);
    expect(labels).toEqual(expect.arrayContaining(['FP', 'int']));
  });

  it('ignores braces in line comments when detecting top-level completion context', () => {
    const labels = complete('// component Ghost {\n', 1, 0);
    expect(labels).toEqual(expect.arrayContaining(['component']));
    expect(labels).not.toContain('FP');
  });

  it('ignores input blocks mentioned inside block comments', () => {
    const labels = complete('/* input { */\n', 1, 0);
    expect(labels).toEqual(expect.arrayContaining(['component']));
    expect(labels).not.toContain('button');
  });

  it('returns no completions inside comments or strings', () => {
    expect(complete('// list<', 0, '// list<'.length)).toEqual([]);
    expect(complete('[Header("list<")]\ncomponent P {}', 0, '[Header("list<'.length)).toEqual([]);
  });
});
