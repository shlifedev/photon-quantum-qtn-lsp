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
});
