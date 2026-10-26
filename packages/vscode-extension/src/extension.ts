import * as fs from 'fs';
import * as path from 'path';
import { window, workspace, ExtensionContext, env } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext) {
  // Path to the language server module (bundled)
  const serverModule = path.join(
    context.extensionPath,
    'dist',
    'server.js'
  );

  // Without the bundled server only TextMate highlighting works — tell the
  // user why IntelliSense is missing instead of failing silently
  if (!fs.existsSync(serverModule)) {
    window.showErrorMessage(
      'QTN Language Server bundle is missing (dist/server.js). ' +
      'Syntax highlighting still works, but IntelliSense is disabled. ' +
      'Please reinstall the extension.'
    );
    return;
  }

  // Server options: use stdio transport
  const serverOptions: ServerOptions = {
    module: serverModule,
    transport: TransportKind.stdio
  };

  // Client options: document selector and file watcher
  const watcher = workspace.createFileSystemWatcher('**/*.qtn');
  context.subscriptions.push(watcher);
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'qtn' }],
    synchronize: {
      fileEvents: watcher
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

  client.start().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    window.showErrorMessage(`QTN Language Server failed to start: ${message}`);
    client = undefined;
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
