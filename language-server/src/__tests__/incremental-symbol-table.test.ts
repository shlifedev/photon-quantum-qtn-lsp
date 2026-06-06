// Tests for incremental symbol-table updates.
//
// Updating one document must not drop symbols contributed by other documents,
// builtins must persist across updates without being rebuilt from scratch, and
// removing a document must drop only that document's symbols.

import { describe, it, expect } from 'vitest';
import { ProjectModel } from '../project-model.js';
import { SymbolTable } from '../symbol-table.js';
import { parse } from '../parser.js';

describe('Incremental symbol table', () => {
  it('updating one document keeps another document\'s symbols', () => {
    const pm = new ProjectModel();
    pm.updateDocument('test://a.qtn', 'component Alpha { FP A; }');
    pm.updateDocument('test://b.qtn', 'component Beta { FP B; }');

    expect(pm.findDefinition('Alpha')).not.toBeNull();
    expect(pm.findDefinition('Beta')).not.toBeNull();

    // Re-edit only document A; B's symbol must survive.
    pm.updateDocument('test://a.qtn', 'component Alpha { FP A; Int32 Extra; }');

    expect(pm.findDefinition('Alpha')).not.toBeNull();
    expect(pm.findDefinition('Beta')).not.toBeNull();
  });

  it('builtins persist across document updates', () => {
    const pm = new ProjectModel();
    pm.updateDocument('test://a.qtn', 'component Alpha { FP A; }');

    const fpBefore = pm.getSymbolTable().lookup('FP');
    expect(fpBefore?.source).toBe('builtin');

    pm.updateDocument('test://a.qtn', 'component Alpha { FP A; FP B; }');

    const fpAfter = pm.getSymbolTable().lookup('FP');
    expect(fpAfter?.source).toBe('builtin');
  });

  it('removeDocument drops only that document\'s symbols', () => {
    const pm = new ProjectModel();
    pm.updateDocument('test://a.qtn', 'component Alpha { FP A; }');
    pm.updateDocument('test://b.qtn', 'component Beta { FP B; }');

    pm.removeDocument('test://a.qtn');

    expect(pm.findDefinition('Alpha')).toBeNull();
    expect(pm.findDefinition('Beta')).not.toBeNull();
    // Builtins remain available after a removal.
    expect(pm.getSymbolTable().lookup('FP')?.source).toBe('builtin');
  });

  it('removing a document that shadowed a builtin restores the builtin', () => {
    const pm = new ProjectModel();
    pm.updateDocument('test://shadow.qtn', 'struct FP { Int32 X; }');

    expect(pm.getSymbolTable().lookup('FP')?.source).toBe('user');

    pm.removeDocument('test://shadow.qtn');

    expect(pm.getSymbolTable().lookup('FP')?.source).toBe('builtin');
  });

  it('keeps a later document\'s winner when an earlier document is re-edited', () => {
    const pm = new ProjectModel();
    // Both documents define Shared; the later-inserted b.qtn wins, matching the
    // old full-rebuild insertion-order semantics.
    pm.updateDocument('test://a.qtn', 'component Shared { FP A; }');
    pm.updateDocument('test://b.qtn', 'struct Shared { Int32 B; }');

    const winnerBefore = pm.getSymbolTable().lookup('Shared');
    expect(winnerBefore?.location.uri).toBe('test://b.qtn');

    // Re-edit a.qtn (still defines Shared, grows by a field). b.qtn must still win.
    pm.updateDocument('test://a.qtn', 'component Shared { FP A; FP A2; }');

    const winnerAfter = pm.getSymbolTable().lookup('Shared');
    expect(winnerAfter?.location.uri).toBe('test://b.qtn');
  });

  it('drops a name when a re-edit removes its definition', () => {
    const pm = new ProjectModel();
    pm.updateDocument('test://a.qtn', 'component Alpha { FP A; }\ncomponent Gamma { FP G; }');
    expect(pm.findDefinition('Gamma')).not.toBeNull();

    pm.updateDocument('test://a.qtn', 'component Alpha { FP A; }');
    expect(pm.findDefinition('Alpha')).not.toBeNull();
    expect(pm.findDefinition('Gamma')).toBeNull();
  });

  it('SymbolTable.removeDocument removes a single document\'s contribution', () => {
    const table = new SymbolTable();
    table.mergeBuiltins();
    table.addFromDocument(parse('component Alpha { FP A; }', 'test://a.qtn'));
    table.addFromDocument(parse('#define FOO 1', 'test://b.qtn'));

    expect(table.lookup('Alpha')).toBeDefined();
    expect(table.lookup('FOO')).toBeDefined();

    table.removeDocument('test://b.qtn');

    expect(table.lookup('Alpha')).toBeDefined();
    expect(table.lookup('FOO')).toBeUndefined();
    expect(table.lookup('FP')?.source).toBe('builtin');
  });
});
