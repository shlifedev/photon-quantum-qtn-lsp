import { describe, expect, it, vi } from 'vitest';
import { ProjectFileLoader } from '../project-file-loader.js';
import { ProjectModel } from '../project-model.js';

const uri = 'file:///project/Player.qtn';
function deferred() {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function setup() {
  const project = new ProjectModel();
  const read = vi.fn<(path: string) => Promise<string>>();
  const open = new Map<string, string>();
  const warn = vi.fn();
  const loader = new ProjectFileLoader(project, uri => open.get(uri), warn, read);
  const names = () => project.getDocument(uri)?.definitions.map(d => d.name);
  return { project, read, open, warn, loader, names };
}

describe('Project file loading', () => {
  it('keeps an unsaved edit made while indexing reads the disk', async () => {
    const { read, open, loader, names } = setup();
    const disk = deferred();
    read.mockReturnValue(disk.promise);
    const loading = loader.load(uri);
    open.set(uri, 'struct Edited {}');
    loader.updateOpenDocument(uri, open.get(uri)!);
    disk.resolve('struct Stale {}');
    await loading;
    expect(names()).toEqual(['Edited']);
  });

  it('keeps the latest watcher result when reads complete out of order', async () => {
    const { read, loader, names } = setup();
    const old = deferred();
    const latest = deferred();
    read.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const first = loader.load(uri);
    const second = loader.load(uri);
    latest.resolve('struct Latest {}');
    await second;
    old.resolve('struct Stale {}');
    await first;
    expect(names()).toEqual(['Latest']);
  });

  it('does not resurrect a deleted document from an in-flight read', async () => {
    const { read, loader, names } = setup();
    const disk = deferred();
    read.mockReturnValue(disk.promise);
    const loading = loader.load(uri);
    loader.deleteFile(uri);
    disk.resolve('struct Deleted {}');
    await loading;
    expect(names()).toBeUndefined();
  });

  it('retains an open buffer after external deletion and removes it after close', async () => {
    const { read, open, loader, names } = setup();
    open.set(uri, 'struct Unsaved {}');
    loader.deleteFile(uri);
    expect(names()).toEqual(['Unsaved']);
    open.clear();
    read.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    await loader.load(uri);
    expect(names()).toBeUndefined();
  });

  it('treats an empty open buffer as authoritative', async () => {
    const { project, read, open, loader, names } = setup();
    project.updateDocument(uri, 'struct Old {}');
    open.set(uri, '');
    await loader.load(uri);
    expect(names()).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it('ignores a stale missing-file error after a document is opened', async () => {
    const { read, open, loader, names, warn } = setup();
    const disk = deferred();
    read.mockReturnValue(disk.promise);
    const loading = loader.load(uri);
    open.set(uri, 'struct New {}');
    loader.updateOpenDocument(uri, open.get(uri)!);
    disk.reject(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    await loading;
    expect(names()).toEqual(['New']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports read failures without discarding previously indexed symbols', async () => {
    const { project, read, loader, names, warn } = setup();
    project.updateDocument(uri, 'struct Existing {}');
    read.mockRejectedValue(new Error('permission denied'));
    await loader.load(uri);
    expect(names()).toEqual(['Existing']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('permission denied'));
  });

  it('removes closed non-file documents without disk access', async () => {
    const { project, read, loader } = setup();
    project.updateDocument('untitled:test.qtn', 'struct Scratch {}');
    await loader.load('untitled:test.qtn');
    expect(project.getDocument('untitled:test.qtn')).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });
});
