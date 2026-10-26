import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from './doctor.mjs';
import { runSteps } from './runner.mjs';

export function parseOptions(args) {
  let profile = 'full';
  let json = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--profile') profile = args[++index];
    else if (args[index] === '--json') json = true;
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  if (!['quick', 'full', 'package'].includes(profile)) throw new Error('Profile must be quick, full, or package');
  return { profile, json };
}

export function verificationSteps(profile, npmCli, directory) {
  const npm = (name, args) => ({ name, command: process.execPath, args: [npmCli, ...args], cwd: root });
  const steps = [
    { name: 'Environment', command: process.execPath, args: [path.join(root, 'scripts/dev/doctor.mjs')], cwd: root },
  ];
  if (profile === 'quick') {
    steps.push(npm('Grammar synchronization', ['run', 'check:grammar']), npm('TypeScript source and tests', ['run', 'typecheck']),
      npm('Language server unit tests', ['--prefix', 'packages/language-server', 'test']));
  } else {
    steps.push(npm('Full regression suite', ['test']));
  }
  if (profile === 'package') {
    const archive = path.join(directory, 'qtn.vsix');
    steps.push({ name: 'Build VSCode package', command: process.execPath,
      args: [path.join(root, 'packages/vscode-extension/node_modules/@vscode/vsce/vsce'), 'package', '--no-dependencies', '--out', archive],
      cwd: path.join(root, 'packages/vscode-extension') });
    steps.push(npm('Extracted VSCode server', ['run', 'test:package', '--', 'vscode', archive]));
  }
  return steps;
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('npm run verify -- [--profile quick|full|package] [--json]\nDefault: full. Reports and logs: .artifacts/verification/<run>/');
    return;
  }
  const { profile, json } = parseOptions(process.argv.slice(2));
  if (!process.env.npm_execpath) throw new Error('Use npm run verify so the active npm CLI is available.');
  const artifacts = path.join(root, '.artifacts/verification');
  await fs.mkdir(artifacts, { recursive: true });
  const directory = await fs.mkdtemp(path.join(artifacts, `${new Date().toISOString().replace(/[:.]/g, '-')}-${profile}-`));
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000 }).stdout?.trim() ?? null;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const report = await runSteps(verificationSteps(profile, process.env.npm_execpath, directory), {
      directory, profile, quiet: json, signal: controller.signal,
      metadata: { node: process.versions.node, platform: `${process.platform}/${process.arch}`,
        git: { head: git(['rev-parse', 'HEAD']), status: git(['status', '--porcelain']) } },
    });
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log(`\n${report.status.toUpperCase()} ${profile}: ${report.reportFile}`);
    process.exitCode = report.status === 'passed' ? 0 : 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
