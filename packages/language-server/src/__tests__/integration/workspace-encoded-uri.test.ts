// 실사용 환경 재현 통합 테스트.
//
// 사용자 워크스페이스 경로에 '@'가 포함되면 VSCode는 didOpen URI를 %40으로
// 인코딩하고, 서버 인덱서는 pathToFileURL로 '@' 원형 URI를 만든다. 이 조합에서
// 워크스페이스 인덱싱 + didOpen + completion이 전부 정상 동작하는지, 서버가
// 도중에 죽지 않는지를 실제 컴파일된 server.js를 stdio로 띄워 검증한다.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  DidCloseTextDocumentNotification,
  DidChangeWatchedFilesNotification,
  WorkspaceSymbolRequest,
  FileChangeType,
  PublishDiagnosticsNotification,
  ShutdownRequest,
  ExitNotification,
  type CompletionItem,
  type CompletionList,
  type PublishDiagnosticsParams,
} from 'vscode-languageserver-protocol';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = process.env.QTN_TEST_SERVER ?? path.resolve(here, '../../../out/server.js');

const OPEN_SOURCE = `enum WeaponType { Sword, Bow, Staff, Dagger }

component Player {
  FP Health;
  WeaponType Weapon;
}
`;

const OTHER_SOURCE = `component Enemy {
  FP Health;
}
`;

// VSCode(vscode-uri)처럼 '@'를 %40으로 인코딩한 URI를 만든다
function vscodeStyleUri(filePath: string): string {
  return pathToFileURL(filePath).toString().replace(/@/g, '%40');
}

let workspaceDir: string;
let child: ChildProcessWithoutNullStreams;
let connection: ProtocolConnection;
let serverExited = false;
const diagnosticsLog: PublishDiagnosticsParams[] = [];

function completionLabels(result: CompletionItem[] | CompletionList | null): string[] {
  if (!result) return [];
  const items = Array.isArray(result) ? result : result.items;
  return items.map((i) => i.label);
}

beforeAll(async () => {
  // '@' 포함 경로 — 사용자 환경(/Users/x/@src/...)과 동일한 조건
  workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qtn-@src-'));
  fs.writeFileSync(path.join(workspaceDir, 'player.qtn'), OPEN_SOURCE);
  fs.writeFileSync(path.join(workspaceDir, 'enemy.qtn'), OTHER_SOURCE);

  child = spawn(process.execPath, [serverPath, '--stdio'], { stdio: 'pipe' });
  child.on('exit', () => {
    serverExited = true;
  });
  // Exit 알림 직후 서버가 죽으면 stdin으로의 비동기 write가 EPIPE를 던질 수 있다.
  // unhandled rejection으로 vitest가 실패하지 않도록 삼킨다 (teardown 경쟁 — flaky 방지).
  child.stdin.on('error', () => {});
  connection = createProtocolConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
    diagnosticsLog.push(params);
  });
  connection.listen();

  await connection.sendRequest(InitializeRequest.type, {
    processId: process.pid,
    rootUri: null,
    capabilities: {},
    workspaceFolders: [
      { uri: vscodeStyleUri(workspaceDir), name: path.basename(workspaceDir) },
    ],
  });
  connection.sendNotification(InitializedNotification.type, {});

  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: vscodeStyleUri(path.join(workspaceDir, 'player.qtn')),
      languageId: 'qtn',
      version: 1,
      text: OPEN_SOURCE,
    },
  });

  // Wait for an observable indexing result instead of a fixed delay.
  await vi.waitFor(async () => {
    const symbols = await connection.sendRequest(WorkspaceSymbolRequest.type, { query: 'Enemy' });
    expect(symbols?.map(symbol => symbol.name)).toContain('Enemy');
  }, { timeout: 5000 });
});

afterAll(async () => {
  try {
    await connection.sendRequest(ShutdownRequest.type, undefined);
    await connection.sendNotification(ExitNotification.type);
  } catch {
    // ignore
  }
  connection?.dispose();
  child?.kill();
  fs.rmSync(workspaceDir, { recursive: true, force: true });
});

describe('encoded-URI workspace (real server.js over stdio)', () => {
  it('keeps the server process alive through indexing', () => {
    expect(serverExited).toBe(false);
  });

  it('publishes no diagnostics at all (feature removed by design)', () => {
    expect(diagnosticsLog.flatMap((p) => p.diagnostics)).toEqual([]);
  });

  it('returns field-type completions inside a component', async () => {
    const result = await connection.sendRequest(CompletionRequest.type, {
      textDocument: { uri: vscodeStyleUri(path.join(workspaceDir, 'player.qtn')) },
      position: { line: 3, character: 2 },
    });
    const labels = completionLabels(result);
    expect(labels).toEqual(expect.arrayContaining(['FP', 'WeaponType', 'Enemy']));
  });

  it('returns top-level completions on a blank line', async () => {
    const result = await connection.sendRequest(CompletionRequest.type, {
      textDocument: { uri: vscodeStyleUri(path.join(workspaceDir, 'player.qtn')) },
      position: { line: 1, character: 0 },
    });
    const labels = completionLabels(result);
    expect(labels).toEqual(expect.arrayContaining(['component', 'struct', 'enum']));
  });
});


describe('Workspace file lifecycle over LSP', () => {
  it('keeps an externally deleted open buffer until it closes, then indexes recreations', async () => {
    const file = path.join(workspaceDir, 'lifecycle.qtn');
    const uri = vscodeStyleUri(file);
    const diskUri = pathToFileURL(file).href;
    const names = async () => (await connection.sendRequest(WorkspaceSymbolRequest.type,
      { query: 'Lifecycle' }))?.map(symbol => symbol.name);

    fs.writeFileSync(file, 'struct LifecycleDisk {}');
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId: 'qtn', version: 1, text: 'struct LifecycleUnsaved {}' },
    });
    fs.unlinkSync(file);
    await connection.sendNotification(DidChangeWatchedFilesNotification.type, {
      changes: [{ uri: diskUri, type: FileChangeType.Deleted }],
    });
    expect(await names()).toEqual(['LifecycleUnsaved']);

    await connection.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri } });
    await expect.poll(names).toEqual([]);

    fs.writeFileSync(file, 'struct LifecycleRecreated {}');
    await connection.sendNotification(DidChangeWatchedFilesNotification.type, {
      changes: [{ uri: diskUri, type: FileChangeType.Created }],
    });
    await expect.poll(names).toEqual(['LifecycleRecreated']);
  });
});


describe('Generated file watcher events', () => {
  it('keeps generated copies out of search while allowing explicitly opened files', async () => {
    const file = path.join(workspaceDir, 'Library', 'copy.qtn');
    const uri = vscodeStyleUri(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'struct GeneratedCopy {}');
    const names = async () => (await connection.sendRequest(WorkspaceSymbolRequest.type,
      { query: 'GeneratedCopy' }))?.map(symbol => symbol.name);

    await connection.sendNotification(DidChangeWatchedFilesNotification.type, {
      changes: [{ uri, type: FileChangeType.Created }],
    });
    // Wait for an ordinary file to be indexed before checking the cache result.
    const barrier = path.join(workspaceDir, 'barrier.qtn');
    fs.writeFileSync(barrier, 'struct WatcherBarrier {}');
    await connection.sendNotification(DidChangeWatchedFilesNotification.type, {
      changes: [{ uri: pathToFileURL(barrier).href, type: FileChangeType.Created }],
    });
    await expect.poll(async () => (await connection.sendRequest(WorkspaceSymbolRequest.type,
      { query: 'WatcherBarrier' }))?.length).toBe(1);
    expect(await names()).toEqual([]);

    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId: 'qtn', version: 1, text: 'struct GeneratedCopy {}' },
    });
    expect(await names()).toEqual(['GeneratedCopy']);
    await connection.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri } });
    expect(await names()).toEqual([]);
  });
});
