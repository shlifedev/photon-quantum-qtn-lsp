import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// 워크스페이스 인덱싱에서 제외할 디렉토리.
// 빌드·캐시 산출물에 .qtn 사본이 들어가면 원본과 중복 정의로 오진단되므로
// VCS/패키지 외에 Unity(Library, Temp 등)와 IDE 산출물도 걸러낸다.
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.worktrees',
  '.idea',
  '.vs',
  'node_modules',
  'dist',
  'out',
  'build',
  'builds',
  'bin',
  'obj',
  'library',
  'temp',
  'logs',
]);

export function shouldSkipDirectory(name: string): boolean {
  return SKIPPED_DIRECTORIES.has(name.toLowerCase());
}

/** Apply the scan exclusions to watcher events and closed documents too. */
export function isExcludedWorkspaceFile(uri: string, roots: readonly string[]): boolean {
  let file: string;
  try { file = fileURLToPath(uri); } catch { return false; }

  const relativePaths = roots.map(root => path.relative(root, file)).filter(relative =>
    relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  // Only inspect directories relative to a containing root. A project itself
  // may live in a Temp directory, or be explicitly added as a nested root.
  return relativePaths.length > 0 && relativePaths.every(relative =>
    relative.split(path.sep).slice(0, -1).some(shouldSkipDirectory));
}
