import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { shouldSkipDirectory, isExcludedWorkspaceFile } from '../workspace-index.js';

describe('workspace indexing helpers', () => {
  it('skips generated and auxiliary directories', () => {
    expect(shouldSkipDirectory('.git')).toBe(true);
    expect(shouldSkipDirectory('node_modules')).toBe(true);
    expect(shouldSkipDirectory('dist')).toBe(true);
    expect(shouldSkipDirectory('out')).toBe(true);
    expect(shouldSkipDirectory('build')).toBe(true);
    expect(shouldSkipDirectory('.worktrees')).toBe(true);
  });

  it('skips Unity and IDE artifact directories regardless of casing', () => {
    expect(shouldSkipDirectory('Library')).toBe(true);
    expect(shouldSkipDirectory('Temp')).toBe(true);
    expect(shouldSkipDirectory('Logs')).toBe(true);
    expect(shouldSkipDirectory('obj')).toBe(true);
    expect(shouldSkipDirectory('bin')).toBe(true);
    expect(shouldSkipDirectory('Builds')).toBe(true);
    expect(shouldSkipDirectory('.idea')).toBe(true);
    expect(shouldSkipDirectory('.vs')).toBe(true);
    expect(shouldSkipDirectory('Build')).toBe(true);
  });

  it('does not skip ordinary source directories', () => {
    expect(shouldSkipDirectory('src')).toBe(false);
    expect(shouldSkipDirectory('shared')).toBe(false);
    expect(shouldSkipDirectory('Gameplay')).toBe(false);
  });
});


describe('Watcher path exclusions', () => {
  const root = path.resolve('/workspace/game');
  const uri = (...parts: string[]) => pathToFileURL(path.join(root, ...parts)).href;

  it('excludes generated files without excluding normal source files', () => {
    expect(isExcludedWorkspaceFile(uri('Library', 'generated.qtn'), [root])).toBe(true);
    expect(isExcludedWorkspaceFile(uri('Assets', 'Temp', 'copy.qtn'), [root])).toBe(true);
    expect(isExcludedWorkspaceFile(uri('Assets', 'player.qtn'), [root])).toBe(false);
    expect(isExcludedWorkspaceFile(uri('Assets', 'Library.qtn'), [root])).toBe(false);
  });

  it('does not confuse a sibling path with a containing workspace root', () => {
    expect(isExcludedWorkspaceFile(uri('..', 'game-other', 'Library', 'copy.qtn'), [root])).toBe(false);
  });

  it('ignores excluded directory names above the workspace root', () => {
    const nestedRoot = path.join(root, 'Temp', 'project');
    expect(isExcludedWorkspaceFile(pathToFileURL(path.join(nestedRoot, 'player.qtn')).href, [nestedRoot])).toBe(false);
  });

  it('honors an explicitly added nested root', () => {
    expect(isExcludedWorkspaceFile(uri('Library', 'player.qtn'), [root, path.join(root, 'Library')])).toBe(false);
  });

  it('handles non-file URIs and empty workspace roots', () => {
    expect(isExcludedWorkspaceFile('untitled:scratch.qtn', [root])).toBe(false);
    expect(isExcludedWorkspaceFile(uri('Library', 'copy.qtn'), [])).toBe(false);
  });
});
