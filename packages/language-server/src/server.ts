// LSP Server Entry Point for QTN Language Server
// This file sets up the LSP connection, document sync, and LSP feature handlers.

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  InitializeParams,
  InitializeResult,
  FileChangeType,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { promises as fs, type Dirent } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ProjectModel } from './project-model.js';
import { ProjectFileLoader } from './project-file-loader.js';
import { handleDefinition } from './definition.js';
import { handleCompletion } from './completion.js';
import { handleHover } from './hover.js';
import { handleDocumentSymbol, handleWorkspaceSymbol } from './symbols.js';
import { handleSemanticTokensFull, tokenTypes, tokenModifiers } from './semantic-tokens.js';
import { setLocale } from './locale.js';
import { shouldSkipDirectory } from './workspace-index.js';
import { normalizeUri } from './uri-utils.js';

// Create the transport selected by the client (--stdio for packaged extensions).
const connection = createConnection(ProposedFeatures.all);

// Create text document manager
const documents = new TextDocuments(TextDocument);

// Create project model to manage .qtn files and symbols
const projectModel = new ProjectModel();
const fileLoader = new ProjectFileLoader(
  projectModel,
  uri => findOpenDocument(uri)?.getText(),
  message => connection.console.warn(message),
);
let workspaceRoots: string[] = [];

const IDENTIFIER_TRIGGER_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split('');
const COMPLETION_TRIGGER_CHARACTERS = ['.', '<', '[', '#', ...IDENTIFIER_TRIGGER_CHARACTERS];

// Initialize handler - declare server capabilities
connection.onInitialize((params: InitializeParams): InitializeResult => {
  workspaceRoots = getWorkspaceRoots(params);

  // Read locale from initialization options
  const options = params.initializationOptions as { locale?: string } | undefined;
  setLocale(typeof options?.locale === 'string' && options.locale.startsWith('ko') ? 'ko' : 'en');

  return {
    capabilities: {
      // Incremental document sync - only send changes, not full text
      textDocumentSync: TextDocumentSyncKind.Incremental,

      // Code completion with trigger characters
      completionProvider: {
        triggerCharacters: COMPLETION_TRIGGER_CHARACTERS,
        resolveProvider: false,
      },

      // Go to definition
      definitionProvider: true,

      // Hover info
      hoverProvider: true,

      // Document symbols (outline)
      documentSymbolProvider: true,

      // Workspace-wide symbol search
      workspaceSymbolProvider: true,

      // Semantic tokens for type references
      semanticTokensProvider: {
        legend: {
          tokenTypes,
          tokenModifiers,
        },
        full: true,
      },
    },
  };
});

connection.onInitialized(() => {
  void indexWorkspaceFiles();
});

// Document change handler - update project model when documents change
documents.onDidChangeContent((change) => {
  fileLoader.updateOpenDocument(change.document.uri, change.document.getText());
});

// Document close handler - keep workspace files indexed from disk.
documents.onDidClose((event) => {
  void fileLoader.load(event.document.uri);
});

// Handle workspace file changes (external edits, file creation/deletion)
connection.onDidChangeWatchedFiles((params) => {
  for (const change of params.changes) {
    if (!change.uri.endsWith('.qtn')) continue;

    switch (change.type) {
      case FileChangeType.Deleted:
        fileLoader.deleteFile(change.uri);
        break;
      case FileChangeType.Created:
      case FileChangeType.Changed:
        if (!findOpenDocument(change.uri)) {
          void fileLoader.load(change.uri);
        }
        break;
    }
  }
});

function getWorkspaceRoots(params: InitializeParams): string[] {
  const roots: string[] = [];

  for (const folder of params.workspaceFolders ?? []) {
    const filePath = uriToFilePath(folder.uri);
    if (filePath) {
      roots.push(filePath);
    }
  }

  if (roots.length === 0 && params.rootUri) {
    const filePath = uriToFilePath(params.rootUri);
    if (filePath) {
      roots.push(filePath);
    }
  }

  if (roots.length === 0 && params.rootPath) {
    roots.push(params.rootPath);
  }

  return roots;
}

async function indexWorkspaceFiles(): Promise<void> {
  for (const root of workspaceRoots) {
    try {
      const files = await findQtnFiles(root);
      // Bound concurrent reads to avoid exhausting file descriptors in large Unity projects.
      for (let offset = 0; offset < files.length; offset += 32) {
        await Promise.all(files.slice(offset, offset + 32).map(file => fileLoader.load(pathToFileURL(file).toString())));
      }
    } catch (error) {
      connection.console.warn(`Failed to index QTN workspace '${root}': ${formatError(error)}`);
    }
  }
}

// TextDocuments는 클라이언트가 보낸 URI를 그대로 키로 쓰므로, 인덱서가 만든
// URI(pathToFileURL 형식)로 조회하면 인코딩 차이 때문에 열린 문서를 놓칠 수 있다
function findOpenDocument(uri: string): TextDocument | undefined {
  const direct = documents.get(uri);
  if (direct) {
    return direct;
  }
  const normalized = normalizeUri(uri);
  return documents.all().find((doc) => normalizeUri(doc.uri) === normalized);
}

async function findQtnFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) {
          await visit(fullPath);
        }
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.qtn')) {
        files.push(fullPath);
      }
    }
  }

  await visit(root);
  return files;
}

function uriToFilePath(uri: string): string | null {
  if (!uri.startsWith('file:')) {
    return null;
  }

  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ============================================================================
// LSP REQUEST HANDLERS
// ============================================================================

// Completion handler
// Provides: keywords, types, fields, built-ins
connection.onCompletion((params) => {
  return handleCompletion(params, projectModel, documents);
});

// Go to Definition handler
// Navigate to symbol definitions
connection.onDefinition((params) => {
  return handleDefinition(params, projectModel, documents);
});

// Hover handler
// Shows type info and documentation
connection.onHover((params) => {
  return handleHover(params, projectModel, documents);
});

// Document Symbols handler
// Provides outline/structure of current file
connection.onDocumentSymbol((params) => {
  return handleDocumentSymbol(params, projectModel);
});

// Workspace Symbols handler
// Provides project-wide symbol search
connection.onWorkspaceSymbol((params) => {
  return handleWorkspaceSymbol(params, projectModel);
});

// Semantic Tokens handler
// Provides semantic token data for type references
connection.languages.semanticTokens.on((params) => {
  return handleSemanticTokensFull(params, projectModel);
});

// ============================================================================
// START SERVER
// ============================================================================

// Listen to document events
documents.listen(connection);

// Start listening for LSP requests
connection.listen();

// Export for testing and use by feature handlers
export { connection, documents, projectModel };
