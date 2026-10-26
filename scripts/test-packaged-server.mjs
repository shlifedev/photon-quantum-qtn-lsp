import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';
import { executableName, platformsFor, root, verifyRuntime } from './prepare-node-runtime.mjs';

export async function unpackPackage(archive, kind, destination) {
  assert.ok(['vs', 'vscode', 'jetbrains'].includes(kind), `Unknown package kind: ${kind}`);
  const platforms = kind === 'vscode' ? [] : platformsFor(kind);
  if (kind === 'jetbrains') assert.ok((await fs.stat(archive)).size < 400_000_000, 'Rider ZIP exceeds 400 MB');
  const bytes = await fs.readFile(archive);
  const entries = [];
  unzipSync(bytes, { filter: (entry) => { entries.push(entry.name); return false; } });
  const serverSuffix = kind === 'vscode' ? 'extension/dist/server.js' :
    kind === 'vs' ? 'LanguageServer/server.js' : '/language-server/out/server.js';
  const servers = entries.filter((name) => kind === 'jetbrains' ? name.endsWith(serverSuffix) : name === serverSuffix);
  assert.equal(servers.length, 1, 'Package must contain exactly one QTN server bundle');
  const prefix = kind === 'vscode' ? 'extension/' :
    kind === 'vs' ? '' : servers[0].slice(0, -'language-server/out/server.js'.length);
  const members = [servers[0]];
  for (const platform of platforms) {
    for (const name of [executableName(platform), 'LICENSE', 'runtime.json']) {
      const member = `${prefix}runtimes/${platform}/${name}`;
      assert.ok(entries.includes(member), `Missing packaged runtime file: ${member}`);
      members.push(member);
    }
  }
  if (kind === 'vscode') {
    for (const relative of ['dist/extension.js', 'package.json', 'syntaxes/qtn.tmLanguage.json', 'language-configuration.json']) {
      const member = `${prefix}${relative}`;
      assert.ok(entries.includes(member), `Missing VSCode package file: ${member}`);
      members.push(member);
    }
  }
  const allowed = new Set(members);
  for (const entry of entries.filter((name) => name.startsWith(`${prefix}runtimes/`) && !name.endsWith('/'))) {
    assert.ok(allowed.has(entry), `Unexpected runtime payload (npm/headers are not shipped): ${entry}`);
  }
  assert.ok(!entries.some((name) => /(^|\/)node_modules\//.test(name)), 'Do not ship node_modules');
  const files = unzipSync(bytes, { filter: (entry) => allowed.has(entry.name) });
  for (const member of members) {
    assert.ok(files[member]?.length > 0, `Empty package file: ${member}`);
    const relative = member.slice(prefix.length);
    const output = path.resolve(destination, relative);
    assert.ok(output.startsWith(path.resolve(destination) + path.sep), `Unsafe package path: ${member}`);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, files[member]);
  }
  for (const platform of platforms) {
    await verifyRuntime(path.join(destination, 'runtimes', platform), platform);
  }
  if (kind === 'vscode') {
    const metadata = JSON.parse(await fs.readFile(path.join(destination, 'package.json'), 'utf8'));
    assert.equal(metadata.main, './dist/extension.js', 'VSCode entry point must refer to the packaged client');
    assert.ok(metadata.contributes?.grammars?.some(grammar => grammar.language === 'qtn' &&
      grammar.path === './syntaxes/qtn.tmLanguage.json'), 'VSCode manifest must register the packaged QTN grammar');
    assert.deepEqual(await fs.readFile(path.join(destination, 'syntaxes/qtn.tmLanguage.json')),
      await fs.readFile(path.join(root, 'packages/shared/syntaxes/qtn.tmLanguage.json')), 'Packaged grammar is stale');
  }
  return path.join(destination, servers[0].slice(prefix.length));
}

function timeout(promise, description) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out: ${description}`)), 20_000); }),
  ]).finally(() => clearTimeout(timer));
}

async function smoke(node, server, installation, mode) {
  const require = createRequire(path.join(root, 'packages', 'language-server', 'package.json'));
  const { createProtocolConnection, StreamMessageReader, StreamMessageWriter } = require('vscode-languageserver-protocol/node');
  const source = 'enum WeaponType { Sword, Bow }\n\ncomponent Player {\n  FP Health;\n  WeaponType Weapon;\n}\n';
  const uri = pathToFileURL(path.join(installation, 'sample.qtn')).href;
  const fakePath = path.join(installation, 'broken system node');
  await fs.mkdir(fakePath, { recursive: true });
  await fs.writeFile(path.join(fakePath, executableName(process.platform === 'win32' ? 'win-x64' : 'linux-x64')), 'This is not Node.');
  if (process.platform !== 'win32') await fs.chmod(path.join(fakePath, 'node'), 0o755);
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (['PATH', 'NODE_OPTIONS', 'NODE_PATH'].includes(key.toUpperCase())) delete env[key];
  }
  env.PATH = mode === 'missing' ? '' : fakePath;
  const child = spawn(node, [server, '--stdio'], { cwd: installation, env, stdio: 'pipe', windowsHide: true });
  let stderr = '';
  child.stderr.on('data', (data) => { stderr = (stderr + data).slice(-8192); });
  child.stdin.on('error', () => {});
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code));
  });
  // Attach immediately: a spawn failure can precede the first protocol request.
  exited.catch(() => {});
  const connection = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  connection.listen();
  const request = (method, params) => timeout(connection.sendRequest(method, params), method);
  try {
    const init = await request('initialize', { processId: process.pid, rootUri: null, capabilities: {}, workspaceFolders: null });
    assert.ok(init.capabilities.completionProvider);
    assert.ok(init.capabilities.hoverProvider);
    assert.ok(init.capabilities.definitionProvider);
    await connection.sendNotification('initialized', {});
    await connection.sendNotification('textDocument/didOpen', { textDocument: { uri, languageId: 'qtn', version: 1, text: source } });
    const completion = await request('textDocument/completion', { textDocument: { uri }, position: { line: 1, character: 0 } });
    assert.ok((Array.isArray(completion) ? completion : completion.items).some((item) => item.label === 'component'));
    const hover = await request('textDocument/hover', { textDocument: { uri }, position: { line: 3, character: 3 } });
    assert.ok(JSON.stringify(hover).includes('FP'));
    const definition = await request('textDocument/definition', { textDocument: { uri }, position: { line: 4, character: 4 } });
    const location = Array.isArray(definition) ? definition[0] : definition;
    const normalizeDrive = (value) => value.replace(/^file:\/\/\/([A-Z]):/, (_, drive) => `file:///${drive.toLowerCase()}:`);
    assert.equal(normalizeDrive(location.uri), normalizeDrive(uri));
    assert.equal(location.range.start.line, 0);
    await request('shutdown', null);
    await connection.sendNotification('exit');
    assert.equal(await timeout(exited, 'clean server exit'), 0);
    console.log(`PASS ${process.platform}/${process.arch}: packaged LSP with ${mode} system Node`);
  } catch (error) {
    throw new Error(`${error.message}\nServer stderr: ${stderr}`, { cause: error });
  } finally {
    connection.dispose();
    if (child.exitCode === null) child.kill();
    await timeout(exited, 'server cleanup').catch(() => {});
  }
}

async function main() {
  const [kind, archive, ...options] = process.argv.slice(2);
  if (kind !== 'vscode') platformsFor(kind); // Validate before touching the filesystem.
  if (!archive || options.some((option) => option !== '--inspect-only')) throw new Error('Usage: test-packaged-server.mjs vscode|vs|jetbrains <archive> [--inspect-only]');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'qtn package 한글 '));
  try {
    const server = await unpackPackage(path.resolve(archive), kind, temporary);
    console.log(`PASS ${kind}: package contents verified`);
    if (options.includes('--inspect-only')) return;
    if (kind === 'vscode') {
      // VSCode provides Node itself. Exercise the extracted server with the test
      // host's Node; this does not replace an Extension Development Host test.
      await smoke(process.execPath, server, temporary, 'missing');
      await smoke(process.execPath, server, temporary, 'broken');
      return;
    }
    const platform = `${process.platform === 'win32' ? 'win' : process.platform}-${process.arch}`;
    if (process.env.QTN_TEST_PLATFORM) assert.equal(platform, process.env.QTN_TEST_PLATFORM, 'CI runner architecture must match the runtime under test');
    assert.ok(platformsFor(kind).includes(platform), `Cannot execute ${kind} package on ${platform}`);
    const node = path.join(temporary, 'runtimes', platform, executableName(platform));
    if (process.platform !== 'win32') {
      await fs.chmod(node, 0o644);
      const denied = spawn(node, ['--version'], { stdio: 'ignore' });
      await timeout(new Promise((resolve, reject) => {
        denied.once('error', (error) => error.code === 'EACCES' ? resolve() : reject(error));
        denied.once('exit', () => reject(new Error('Non-executable runtime unexpectedly launched')));
      }), 'missing execute permission');
      console.log('PASS non-executable runtime is rejected before permission repair');
    }
    // Like the Rider launcher, repair executable bits lost during ZIP installation.
    await fs.chmod(node, 0o755);
    await smoke(node, server, temporary, 'missing');
    await smoke(node, server, temporary, 'broken');
  } finally {
    await fs.rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
