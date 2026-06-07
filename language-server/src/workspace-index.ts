const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.worktrees',
  'node_modules',
  'dist',
  'out',
  'build',
]);

export function shouldSkipDirectory(name: string): boolean {
  return SKIPPED_DIRECTORIES.has(name);
}
