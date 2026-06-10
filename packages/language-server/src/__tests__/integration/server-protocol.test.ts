// LSP protocol integration test.
//
// This spawns the *real* compiled server (out/server.js) and drives it over the
// JSON-RPC wire exactly the way every IDE does:
//   VSCode  → extension.ts          spawns `node server.js --stdio`
//   VS 2022 → QtnLanguageClient.cs  spawns `node server.js --stdio`
//   Rider   → QtnLspServerSupportProvider.kt spawns `node server.js --stdio`
//
// So a green run here means the shared artifact all three IDEs bundle answers
// initialize / didOpen / completion / hover / definition / documentSymbol /
// workspaceSymbol correctly — the integration contract, validated once.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type ProtocolConnection,
} from 'vscode-languageserver-protocol/node';
import {
  InitializeRequest,
  InitializedNotification,
  DidOpenTextDocumentNotification,
  CompletionRequest,
  HoverRequest,
  DefinitionRequest,
  DocumentSymbolRequest,
  WorkspaceSymbolRequest,
  ShutdownRequest,
  ExitNotification,
  PublishDiagnosticsNotification,
  type CompletionItem,
  type CompletionList,
  type PublishDiagnosticsParams,
  type Hover,
  type Location,
  type DocumentSymbol,
  type SymbolInformation,
} from 'vscode-languageserver-protocol';

const here = path.dirname(fileURLToPath(import.meta.url));
// src/__tests__/integration -> src/__tests__ -> src -> package root -> out/server.js
const serverPath = path.resolve(here, '../../../out/server.js');

const DOC_URI = 'file:///virtual/test.qtn';
const SOURCE = `enum WeaponType { Sword, Bow }

component Player {
  FP Health;
  WeaponType Weapon;
}

signal OnHit(EntityRef target);
`;
// Line index reference (0-based):
// 0: enum WeaponType { Sword, Bow }
// 2: component Player {
// 3:   FP Health;
// 4:   WeaponType Weapon;
// 7: signal OnHit(EntityRef target);

let child: ChildProcessWithoutNullStreams;
let connection: ProtocolConnection;

function completionLabels(result: CompletionItem[] | CompletionList | null): string[] {
  if (!result) return [];
  const items = Array.isArray(result) ? result : result.items;
  return items.map((i) => i.label);
}

beforeAll(async () => {
  child = spawn(process.execPath, [serverPath, '--stdio'], { stdio: 'pipe' });
  // Exit 알림 직후 서버가 죽으면 stdin으로의 비동기 write가 EPIPE를 던질 수 있다.
  // unhandled rejection으로 vitest가 실패하지 않도록 삼킨다 (teardown 경쟁 — flaky 방지).
  child.stdin.on('error', () => {});
  connection = createProtocolConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  connection.listen();

  const init = await connection.sendRequest(InitializeRequest.type, {
    processId: process.pid,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null,
  });
  // Sanity: the server advertises the providers the IDEs rely on.
  expect(init.capabilities.completionProvider).toBeTruthy();
  expect(init.capabilities.completionProvider).toMatchObject({
    triggerCharacters: expect.arrayContaining(['.', '[', '#', 'c', 'F', '_']),
  });
  expect(init.capabilities.definitionProvider).toBeTruthy();
  expect(init.capabilities.hoverProvider).toBeTruthy();

  connection.sendNotification(InitializedNotification.type, {});
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: { uri: DOC_URI, languageId: 'qtn', version: 1, text: SOURCE },
  });
});

afterAll(async () => {
  try {
    await connection.sendRequest(ShutdownRequest.type, undefined);
    connection.sendNotification(ExitNotification.type, undefined);
  } catch {
    // ignore — we kill the process below regardless
  }
  connection?.dispose();
  child?.kill();
});

describe('LSP protocol (real server.js over stdio)', () => {
  it('completes top-level keywords on a blank line', async () => {
    const result = await connection.sendRequest(CompletionRequest.type, {
      textDocument: { uri: DOC_URI },
      position: { line: 1, character: 0 },
    });
    const labels = completionLabels(result);
    expect(labels).toEqual(expect.arrayContaining(['component', 'struct', 'enum']));
  });

  it('completes types (builtin + user-defined) in field position', async () => {
    const result = await connection.sendRequest(CompletionRequest.type, {
      textDocument: { uri: DOC_URI },
      position: { line: 3, character: 2 },
    });
    const labels = completionLabels(result);
    expect(labels).toEqual(expect.arrayContaining(['FP', 'WeaponType']));
  });

  it('returns hover markdown for a user-defined type', async () => {
    const hover = (await connection.sendRequest(HoverRequest.type, {
      textDocument: { uri: DOC_URI },
      position: { line: 4, character: 4 },
    })) as Hover | null;
    expect(hover).not.toBeNull();
    const value = (hover!.contents as { value: string }).value;
    // Resolved to the user symbol — hover cites the declaring file.
    expect(value).toContain('test.qtn');
  });

  it('returns hover markdown for a builtin type', async () => {
    const hover = (await connection.sendRequest(HoverRequest.type, {
      textDocument: { uri: DOC_URI },
      position: { line: 3, character: 2 },
    })) as Hover | null;
    expect(hover).not.toBeNull();
    expect((hover!.contents as { value: string }).value).toContain('FP');
  });

  it('resolves go-to-definition for a user-defined type reference', async () => {
    const def = (await connection.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: DOC_URI },
      position: { line: 4, character: 4 },
    })) as Location | null;
    expect(def).not.toBeNull();
    const loc = Array.isArray(def) ? def[0] : def!;
    expect(loc.uri).toBe(DOC_URI);
    // WeaponType is declared on line 0.
    expect(loc.range.start.line).toBe(0);
  });

  it('returns no definition for a builtin type', async () => {
    const def = await connection.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: DOC_URI },
      position: { line: 3, character: 2 },
    });
    expect(def == null || (Array.isArray(def) && def.length === 0)).toBe(true);
  });

  it('returns a hierarchical document outline', async () => {
    const symbols = (await connection.sendRequest(DocumentSymbolRequest.type, {
      textDocument: { uri: DOC_URI },
    })) as DocumentSymbol[];
    const names = symbols.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['WeaponType', 'Player', 'OnHit']));

    const player = symbols.find((s) => s.name === 'Player');
    expect(player?.children?.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Health', 'Weapon']),
    );
  });

  it('finds symbols via fuzzy workspace search', async () => {
    const results = (await connection.sendRequest(WorkspaceSymbolRequest.type, {
      query: 'Weapon',
    })) as SymbolInformation[];
    expect(results.map((s) => s.name)).toContain('WeaponType');
  });

  it('does not publish diagnostics (feature removed by design)', async () => {
    const BROKEN_URI = 'file:///virtual/broken.qtn';
    const published: PublishDiagnosticsParams[] = [];
    connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
      published.push(params);
    });

    // 오진단 소음 때문에 진단 발행을 제거했다 — 깨진 문서를 열어도 아무것도 오지 않아야 한다
    connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: BROKEN_URI,
        languageId: 'qtn',
        version: 1,
        text: 'component Broken {\n  MissingType Health;\n',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(published).toEqual([]);
  });
});
