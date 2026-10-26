import { describe, expect, it } from 'vitest';
import { handleDefinition } from '../definition.js';
import { handleHover } from '../hover.js';
import { handleWorkspaceSymbol } from '../symbols.js';
import { setupDocument } from './helpers.js';

function setup(reverse = false) {
  const fixture = setupDocument('component UsesPlayer { Player Value; }', 'file:///project/use.qtn');
  const parts = [
    ['file:///project/a.qtn', 'component Player { FP Health; }'],
    ['file:///project/b.qtn', 'component Player { int Ammo; }'],
  ];
  for (const [uri, source] of reverse ? parts.reverse() : parts) {
    fixture.projectModel.updateDocument(uri, source);
  }
  return fixture;
}

describe('Declarations split across files', () => {
  it.each([false, true])('keeps all fields regardless of indexing order (reverse=%s)', reverse => {
    const { projectModel } = setup(reverse);
    const symbol = projectModel.getSymbolTable().lookup('Player');
    expect(symbol?.children.map(child => child.name)).toEqual(['Health', 'Ammo']);
  });

  it('returns all declaration locations for go-to-definition', () => {
    const { projectModel, documents, uri } = setup(true);
    const result = handleDefinition({ textDocument: { uri }, position: { line: 0, character: 25 } }, projectModel, documents);
    expect(result).toEqual([
      { uri: 'file:///project/a.qtn', range: { start: { line: 0, character: 10 }, end: { line: 0, character: 16 } } },
      { uri: 'file:///project/b.qtn', range: { start: { line: 0, character: 10 }, end: { line: 0, character: 16 } } },
    ]);
  });

  it('shows the total field count and all declaration files in hover', () => {
    const { projectModel, documents, uri } = setup();
    const hover = handleHover({ textDocument: { uri }, position: { line: 0, character: 25 } }, projectModel, documents);
    const text = (hover?.contents as { value: string }).value;
    expect(text).toContain('2 fields');
    expect(text).toContain('a.qtn');
    expect(text).toContain('b.qtn');
  });

  it('returns the same matching declarations in empty and filtered workspace searches', () => {
    const { projectModel } = setup();
    const all = handleWorkspaceSymbol({ query: '' }, projectModel).filter(s => s.name === 'Player');
    expect(handleWorkspaceSymbol({ query: 'Player' }, projectModel).filter(s => s.name === 'Player')).toEqual(all);
  });

  it('drops removed fields and locations when a partial declaration is deleted', () => {
    const { projectModel } = setup();
    projectModel.getSymbolTable();
    projectModel.removeDocument('file:///project/b.qtn');
    expect(projectModel.getSymbolTable().lookup('Player')?.children.map(s => s.name)).toEqual(['Health']);
    expect(projectModel.findDefinition('Player')?.uri).toBe('file:///project/a.qtn');
  });

  it('combines input/global blocks without losing fields', () => {
    const { projectModel } = setup();
    projectModel.updateDocument('file:///project/a.qtn', 'input { button Jump; } global { FP Timer; }');
    projectModel.updateDocument('file:///project/b.qtn', 'input { FPVector2 Move; } global { int Score; }');
    expect(projectModel.getSymbolTable().lookup('input')?.children.map(s => s.name)).toEqual(['Jump', 'Move']);
    expect(projectModel.getSymbolTable().lookup('global')?.children.map(s => s.name)).toEqual(['Timer', 'Score']);
  });
});
