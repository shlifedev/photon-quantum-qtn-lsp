import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const packages = ['.', 'packages/language-server', 'packages/vscode-extension'];

export async function inspectEnvironment(directory = root, nodeVersion = process.versions.node) {
  const checks = [];
  const pin = (await fs.readFile(path.join(directory, '.nvmrc'), 'utf8')).trim();
  const [major, minor] = nodeVersion.split('.').map(Number);
  const supported = major >= 24 || (major === 22 && minor >= 12);
  checks.push({ name: 'node', status: supported ? 'pass' : 'fail', detail: `Node ${nodeVersion}; recommended ${pin}`, remedy: 'nvm install && nvm use' });
  if (supported && nodeVersion !== pin) {
    checks.push({ name: 'node-pin', status: 'warn', detail: 'Supported Node differs from CI .nvmrc', remedy: 'nvm install && nvm use' });
  }
  const npmCli = process.env.npm_execpath;
  const npmAvailable = npmCli && await fs.access(npmCli).then(() => true, () => false);
  checks.push({ name: 'npm', status: npmAvailable ? 'pass' : 'fail', detail: npmAvailable ? 'npm CLI available' : 'Run this harness through npm', remedy: 'npm run doctor' });

  for (const relative of packages) {
    const base = path.join(directory, relative);
    const manifest = JSON.parse(await fs.readFile(path.join(base, 'package.json'), 'utf8'));
    const lock = JSON.parse(await fs.readFile(path.join(base, 'package-lock.json'), 'utf8'));
    const missing = [];
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
      const installed = await fs.readFile(path.join(base, 'node_modules', name, 'package.json'), 'utf8')
        .then(JSON.parse, () => null);
      if (!installed || installed.version !== lock.packages?.[`node_modules/${name}`]?.version) missing.push(name);
    }
    checks.push({ name: `dependencies:${relative}`, status: missing.length ? 'fail' : 'pass',
      detail: missing.length ? `Missing/stale direct dependencies: ${missing.join(', ')}` : 'Direct dependencies match lockfile versions',
      remedy: 'npm run setup' });
  }
  return { schemaVersion: 1, ok: checks.every(check => check.status !== 'fail'), checks };
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--json')) throw new Error('Usage: npm run doctor -- [--json]');
  const report = await inspectEnvironment();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    for (const check of report.checks) {
      console.log(`${check.status.toUpperCase()} ${check.name}: ${check.detail}`);
      if (check.status !== 'pass') console.log(`  ${check.remedy}`);
    }
    console.log('Native builds: Rider requires JDK 21; Visual Studio requires Windows + VS build tools. See docs/AI_DEVELOPMENT.md.');
  }
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
