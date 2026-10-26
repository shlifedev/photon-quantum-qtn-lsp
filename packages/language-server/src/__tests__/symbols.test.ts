// Tests for document outline and workspace symbol search.

import { describe, it, expect } from 'vitest';
import { handleDocumentSymbol, handleWorkspaceSymbol } from '../symbols.js';
import { setupDocument } from './helpers.js';

const SOURCE = `enum Weapon { Sword, Bow }
component Player {
  FP Health;
  Weapon Equipped;
}`;

describe('Document symbols', () => {
  it('returns top-level types with nested members and fields', () => {
    const { projectModel, uri } = setupDocument(SOURCE);
    const symbols = handleDocumentSymbol({ textDocument: { uri } }, projectModel);

    const names = symbols.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['Weapon', 'Player']));

    const player = symbols.find((s) => s.name === 'Player');
    expect(player?.children?.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Health', 'Equipped']),
    );

    const weapon = symbols.find((s) => s.name === 'Weapon');
    expect(weapon?.children?.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Sword', 'Bow']),
    );
  });

  it('returns empty for an unknown document', () => {
    const { projectModel } = setupDocument(SOURCE);
    const symbols = handleDocumentSymbol(
      { textDocument: { uri: 'test://missing.qtn' } },
      projectModel,
    );
    expect(symbols).toEqual([]);
  });

  it('returns signal parameters as nested document symbols', () => {
    const { projectModel, uri } = setupDocument('signal OnDamage(EntityRef target, FP amount);');
    const symbols = handleDocumentSymbol({ textDocument: { uri } }, projectModel);

    const signal = symbols.find((s) => s.name === 'OnDamage');
    expect(signal?.children?.map((child) => child.name)).toEqual(['target', 'amount']);
    expect(signal?.children?.map((child) => child.detail)).toEqual(['EntityRef', 'FP']);
  });
});

describe('Workspace symbols', () => {
  it('finds a user-defined type via fuzzy query', () => {
    const { projectModel } = setupDocument(SOURCE);
    const results = handleWorkspaceSymbol({ query: 'Play' }, projectModel);
    expect(results.map((s) => s.name)).toContain('Player');
  });

  it('does not return builtin types', () => {
    const { projectModel } = setupDocument(SOURCE);
    const results = handleWorkspaceSymbol({ query: 'FP' }, projectModel);
    // FP is a builtin — must not appear as a workspace symbol.
    expect(results.some((s) => s.name === 'FP')).toBe(false);
  });

  it('uses descriptive names for directives in empty workspace search', () => {
    const { projectModel } = setupDocument(`#pragma max_players 8
#define MAX_PLAYERS 8
using Game.Core;
input {
  button Fire;
}`);
    const results = handleWorkspaceSymbol({ query: '' }, projectModel);
    const names = results.map((symbol) => symbol.name);

    expect(names).toEqual(expect.arrayContaining([
      '#pragma max_players',
      'MAX_PLAYERS',
      'Game.Core',
      'input',
    ]));
    expect(names).not.toContain('pragma');
  });
});

describe('Symbol presentation regressions', () => {
  it('finds using directives and pragmas when a query is entered', () => {
    const { projectModel } = setupDocument('using Game.Core;\n#pragma max_players 8');
    expect(handleWorkspaceSymbol({ query: 'Core' }, projectModel).map(s => s.name)).toEqual(['Game.Core']);
    expect(handleWorkspaceSymbol({ query: 'max_players' }, projectModel).map(s => s.name)).toEqual(['#pragma max_players']);
  });

  it('selects the type name when navigating the document outline', () => {
    const { projectModel, uri } = setupDocument('component Player { FP Health; }');
    const [symbol] = handleDocumentSymbol({ textDocument: { uri } }, projectModel);
    expect(symbol.selectionRange).toEqual({ start: { line: 0, character: 10 }, end: { line: 0, character: 16 } });
    expect(symbol.range.end.character).toBe(31);
  });

  it('preserves nullable suffixes in field and nested generic descriptions', () => {
    const { projectModel, uri } = setupDocument('component Stats { FP? Health; list<FP?> Values; }');
    const [symbol] = handleDocumentSymbol({ textDocument: { uri } }, projectModel);
    expect(symbol.children?.map(field => field.detail)).toEqual(['FP?', 'list<FP?>']);
  });
});

describe('Incomplete declaration outline ranges', () => {
  it.each(['component ', 'struct ', 'event ', 'signal '])('keeps selection inside the declaration while typing %s', source => {
    const { projectModel, uri } = setupDocument(source);
    const [symbol] = handleDocumentSymbol({ textDocument: { uri } }, projectModel);
    expect(symbol.selectionRange).toEqual(symbol.range);
  });
});
