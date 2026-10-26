import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { manifest, prepareRuntime, sha256, verifyChecksum, verifyRuntime } from '../prepare-node-runtime.mjs';
import { unpackPackage } from '../test-packaged-server.mjs';

async function fixture(run) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'qtn-runtime-test-'));
  try { await run(temporary); } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

test('checksum mismatch rejects an archive', () => fixture(async (directory) => {
  const file = path.join(directory, 'archive.zip');
  await fs.writeFile(file, 'corrupted download');
  await assert.rejects(verifyChecksum(file, manifest.artifacts['win-x64'].sha256), /SHA-256 mismatch/);
}));

test('corrupt cached download cannot replace an existing runtime', () => fixture(async (directory) => {
  const cache = path.join(directory, 'cache');
  const destination = path.join(directory, 'runtimes');
  await fs.mkdir(cache);
  await fs.mkdir(path.join(destination, 'win-x64'), { recursive: true });
  await fs.writeFile(path.join(destination, 'win-x64', 'node.exe'), 'previous valid runtime');
  await fs.writeFile(path.join(cache, manifest.artifacts['win-x64'].archive), 'corrupted download');
  await assert.rejects(prepareRuntime('win-x64', destination, cache), /SHA-256 mismatch/);
  assert.equal(await fs.readFile(path.join(destination, 'win-x64', 'node.exe'), 'utf8'), 'previous valid runtime');
  assert.deepEqual(await fs.readdir(cache), []);
}));

test('runtime verification rejects missing executable, license, stale version and corruption', () => fixture(async (directory) => {
  const exe = path.join(directory, 'node.exe');
  await fs.writeFile(exe, 'fixture executable');
  const metadata = { version: manifest.version, platform: 'win-x64', archiveSha256: manifest.artifacts['win-x64'].sha256, executableSha256: await sha256(exe) };
  await fs.writeFile(path.join(directory, 'runtime.json'), JSON.stringify(metadata));
  await assert.rejects(verifyRuntime(directory, 'win-x64'), /ENOENT/);
  await fs.writeFile(path.join(directory, 'LICENSE'), 'Node.js MIT license fixture');
  await verifyRuntime(directory, 'win-x64');
  await fs.writeFile(path.join(directory, 'runtime.json'), JSON.stringify({ ...metadata, version: '18.0.0' }));
  await assert.rejects(verifyRuntime(directory, 'win-x64'), /Stale runtime/);
  await fs.writeFile(path.join(directory, 'runtime.json'), JSON.stringify(metadata));
  await fs.writeFile(exe, 'corrupted runtime');
  await assert.rejects(verifyRuntime(directory, 'win-x64'), /SHA-256 mismatch/);
  await fs.rm(exe);
  await assert.rejects(verifyRuntime(directory, 'win-x64'), /ENOENT/);
}));

test('package inspection rejects a server-only VSIX', () => fixture(async (directory) => {
  const archive = path.join(directory, 'incomplete.vsix');
  await fs.writeFile(archive, zipSync({ 'LanguageServer/server.js': strToU8('// fixture') }));
  await assert.rejects(unpackPackage(archive, 'vs', path.join(directory, 'output')), /Missing packaged runtime file/);
}));

test('package inspection rejects a missing server', () => fixture(async (directory) => {
  const archive = path.join(directory, 'incomplete.zip');
  await fs.writeFile(archive, zipSync({ 'plugin/META-INF/plugin.xml': strToU8('<idea-plugin/>') }));
  await assert.rejects(unpackPackage(archive, 'jetbrains', path.join(directory, 'output')), /exactly one QTN server bundle/);
}));

async function vscodeFiles() {
  return {
    'extension/package.json': strToU8(JSON.stringify({
      main: './dist/extension.js',
      contributes: { grammars: [{ language: 'qtn', path: './syntaxes/qtn.tmLanguage.json' }] },
    })),
    'extension/dist/extension.js': strToU8('// client fixture'),
    'extension/dist/server.js': strToU8('// server fixture'),
    'extension/language-configuration.json': strToU8('{}'),
    'extension/syntaxes/qtn.tmLanguage.json': await fs.readFile(new URL('../../packages/shared/syntaxes/qtn.tmLanguage.json', import.meta.url)),
  };
}

test('VSCode package inspection requires the client and server bundles', () => fixture(async directory => {
  const archive = path.join(directory, 'qtn.vsix');
  const files = await vscodeFiles();
  delete files['extension/dist/extension.js'];
  await fs.writeFile(archive, zipSync(files));
  await assert.rejects(unpackPackage(archive, 'vscode', path.join(directory, 'output')), /Missing VSCode package file/);
}));

test('VSCode package inspection rejects stale grammar', () => fixture(async directory => {
  const archive = path.join(directory, 'qtn.vsix');
  const files = await vscodeFiles();
  files['extension/syntaxes/qtn.tmLanguage.json'] = strToU8('{}');
  await fs.writeFile(archive, zipSync(files));
  await assert.rejects(unpackPackage(archive, 'vscode', path.join(directory, 'output')), /Packaged grammar is stale/);
}));

test('VSCode package inspection rejects an incorrect manifest entry point', () => fixture(async directory => {
  const archive = path.join(directory, 'qtn.vsix');
  const files = await vscodeFiles();
  files['extension/package.json'] = strToU8(JSON.stringify({ main: './out/extension.js' }));
  await fs.writeFile(archive, zipSync(files));
  await assert.rejects(unpackPackage(archive, 'vscode', path.join(directory, 'output')), /entry point/);
}));

test('VSCode package inspection accepts a self-contained extension', () => fixture(async directory => {
  const archive = path.join(directory, 'qtn.vsix');
  await fs.writeFile(archive, zipSync(await vscodeFiles()));
  const server = await unpackPackage(archive, 'vscode', path.join(directory, 'output'));
  assert.equal(await fs.readFile(server, 'utf8'), '// server fixture');
}));
