import * as path from 'path';
import { workspace, ExtensionContext, env, window } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext) {
  // Path to the language server module (bundled)
  const serverModule = path.join(
    context.extensionPath,
    'dist',
    'server.js'
  );

  // Server options: use stdio transport
  const serverOptions: ServerOptions = {
    module: serverModule,
    transport: TransportKind.stdio
  };

  // Client options: document selector and file watcher
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'qtn' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.qtn')
    },
    initializationOptions: {
      locale: env.language  // e.g. 'ko', 'en', 'ja'
    }
  };

  // Create and start the language client
  client = new LanguageClient(
    'qtnLanguageServer',
    'QTN Language Server',
    serverOptions,
    clientOptions
  );

  try {
    await client.start();
  } catch (err) {
    console.error('QTN language server failed to start:', err);
    void window.showErrorMessage(
      `QTN Language Server failed to start: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
