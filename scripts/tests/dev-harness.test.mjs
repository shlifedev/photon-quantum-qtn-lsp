import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runStep, runSteps } from '../dev/runner.mjs';
import { parseOptions } from '../dev/verify.mjs';
import { inspectEnvironment } from '../dev/doctor.mjs';

async function fixture(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qtn harness 한글 '));
  try { await run(directory); } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
const node = (name, source, cwd) => ({ name, command: process.execPath, args: ['-e', source], cwd });

test('failed verification preserves logs and skips later steps', () => fixture(async directory => {
  const report = await runSteps([
    node('broken', 'console.log("stdout evidence"); console.error("stderr evidence"); process.exit(7)', directory),
    node('must not run', 'require("node:fs").writeFileSync("unexpected", "bad")', directory),
  ], { directory, profile: 'fixture', quiet: true });
  assert.equal(report.status, 'failed');
  assert.equal(report.steps[0].exitCode, 7);
  assert.equal(report.steps[1].status, 'skipped');
  const log = await fs.readFile(path.join(directory, '1.log'), 'utf8');
  assert.match(log, /stdout evidence/);
  assert.match(log, /stderr evidence/);
  assert.equal(JSON.parse(await fs.readFile(report.reportFile, 'utf8')).status, 'failed');
  await assert.rejects(fs.access(path.join(directory, 'unexpected')));
}));

test('argv containing spaces, Unicode and shell syntax is passed literally', () => fixture(async directory => {
  const value = '한글 space $(echo injected) `echo injected` & | ;';
  const result = await runStep({ command: process.execPath, args: ['-e', 'console.log(process.argv[1])', value], cwd: directory },
    { log: path.join(directory, 'output.log'), quiet: true });
  assert.equal(result.status, 'passed');
  assert.equal((await fs.readFile(path.join(directory, 'output.log'), 'utf8')).trim(), value);
}));

test('missing commands fail with an actionable error instead of hanging', () => fixture(async directory => {
  const result = await runStep({ command: path.join(directory, 'missing-command'), cwd: directory },
    { log: path.join(directory, 'output.log'), quiet: true });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /ENOENT/);
}));

test('hung commands are terminated and never reported as passing', () => fixture(async directory => {
  const result = await runStep(node('hang', 'setInterval(() => {}, 1000)', directory),
    { log: path.join(directory, 'output.log'), quiet: true, timeoutMs: 150 });
  assert.equal(result.status, 'timed-out');
}));

test('cancellation stops the running command and skips the next one', () => fixture(async directory => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150);
  try {
    const report = await runSteps([node('hang', 'setInterval(() => {}, 1000)', directory), node('later', '', directory)],
      { directory, profile: 'fixture', signal: controller.signal, quiet: true });
    assert.equal(report.status, 'interrupted');
    assert.equal(report.steps[1].status, 'skipped');
  } finally { clearTimeout(timer); }
}));

test('success reports contain the exact command and durable result', () => fixture(async directory => {
  const step = node('ok', 'console.log("done")', directory);
  const report = await runSteps([step], { directory, profile: 'fixture', quiet: true });
  const saved = JSON.parse(await fs.readFile(report.reportFile, 'utf8'));
  assert.equal(saved.status, 'passed');
  assert.deepEqual(saved.steps[0].command, [step.command, ...step.args]);
  assert.equal(saved.steps[0].exitCode, 0);
}));

test('invalid profiles and unknown arguments are rejected', () => {
  assert.throws(() => parseOptions(['--profile', 'ful']), /Profile must/);
  assert.throws(() => parseOptions(['--profile']), /Profile must/);
  assert.throws(() => parseOptions(['--profle', 'full']), /Unknown argument/);
  assert.deepEqual(parseOptions([]), { profile: 'full', json: false });
});

test('doctor catches unsupported Node and missing or stale locked dependencies', () => fixture(async directory => {
  await fs.writeFile(path.join(directory, '.nvmrc'), '22.23.3\n');
  for (const relative of ['.', 'packages/language-server', 'packages/vscode-extension']) {
    const base = path.join(directory, relative);
    await fs.mkdir(base, { recursive: true });
    await fs.writeFile(path.join(base, 'package.json'), JSON.stringify({ dependencies: { fixture: '^2.0.0' } }));
    await fs.writeFile(path.join(base, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/fixture': { version: '2.0.0' } } }));
  }
  const missing = await inspectEnvironment(directory, '20.19.0');
  assert.equal(missing.ok, false);
  assert.equal(missing.checks.find(check => check.name === 'node').status, 'fail');
  assert.equal(missing.checks.filter(check => check.name.startsWith('dependencies:') && check.status === 'fail').length, 3);
  for (const relative of ['.', 'packages/language-server', 'packages/vscode-extension']) {
    const modules = path.join(directory, relative, 'node_modules/fixture');
    await fs.mkdir(modules, { recursive: true });
    await fs.writeFile(path.join(modules, 'package.json'), '{"version":"1.0.0"}');
  }
  const stale = await inspectEnvironment(directory, '22.23.3');
  assert.equal(stale.checks.filter(check => check.name.startsWith('dependencies:') && check.status === 'fail').length, 3);
}));
