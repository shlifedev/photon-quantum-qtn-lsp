import { describe, expect, it } from 'vitest';
import { shouldSkipDirectory } from '../workspace-index.js';

describe('workspace indexing helpers', () => {
  it('skips generated and auxiliary directories', () => {
    expect(shouldSkipDirectory('.git')).toBe(true);
    expect(shouldSkipDirectory('node_modules')).toBe(true);
    expect(shouldSkipDirectory('dist')).toBe(true);
    expect(shouldSkipDirectory('out')).toBe(true);
    expect(shouldSkipDirectory('build')).toBe(true);
    expect(shouldSkipDirectory('.worktrees')).toBe(true);
  });

  it('does not skip ordinary source directories', () => {
    expect(shouldSkipDirectory('src')).toBe(false);
    expect(shouldSkipDirectory('shared')).toBe(false);
    expect(shouldSkipDirectory('Gameplay')).toBe(false);
  });
});
