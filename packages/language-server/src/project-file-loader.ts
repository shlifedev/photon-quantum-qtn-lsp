import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ProjectModel } from './project-model.js';
import { normalizeUri } from './uri-utils.js';

/** Synchronize disk reads without letting stale I/O replace editor content. */
export class ProjectFileLoader {
  private readonly pending = new Map<string, object>();

  constructor(
    private readonly project: ProjectModel,
    private readonly getOpenText: (uri: string) => string | undefined,
    private readonly warn: (message: string) => void,
    private readonly readFile: (path: string) => Promise<string> = path => fs.readFile(path, 'utf8'),
  ) {}

  updateOpenDocument(uri: string, text: string): void {
    this.pending.delete(normalizeUri(uri));
    this.project.updateDocument(uri, text);
  }

  deleteFile(uri: string): void {
    this.pending.delete(normalizeUri(uri));
    const text = this.getOpenText(uri);
    if (text !== undefined) this.project.updateDocument(uri, text);
    else this.project.removeDocument(uri);
  }

  async load(uri: string): Promise<void> {
    uri = normalizeUri(uri);
    const request = {};
    this.pending.set(uri, request);
    try {
      const openText = this.getOpenText(uri);
      if (openText !== undefined) {
        this.project.updateDocument(uri, openText);
        return;
      }
      if (!uri.startsWith('file:')) {
        this.project.removeDocument(uri);
        return;
      }
      const text = await this.readFile(fileURLToPath(uri));
      if (this.pending.get(uri) === request) {
        this.project.updateDocument(uri, this.getOpenText(uri) ?? text);
      }
    } catch (error) {
      if (this.pending.get(uri) !== request) return;
      const openText = this.getOpenText(uri);
      if (openText !== undefined) {
        this.project.updateDocument(uri, openText);
      } else if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.project.removeDocument(uri);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.warn(`Failed to read QTN file '${uri}': ${message}`);
      }
    } finally {
      if (this.pending.get(uri) === request) this.pending.delete(uri);
    }
  }
}
