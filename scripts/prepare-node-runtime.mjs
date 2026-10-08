import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { unzipSync } from 'fflate';
import { x as extractTar } from 'tar';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const manifest = JSON.parse(await fs.readFile(new URL('./node-runtime-manifest.json', import.meta.url), 'utf8'));
export const runtimeRoot = path.join(root, 'dist', 'node-runtimes');

export function platformsFor(target) {
  if (target === 'vs') return ['win-x64'];
  if (target === 'jetbrains') return Object.keys(manifest.artifacts);
  throw new Error(`Unknown runtime target: ${target}. Use vs or jetbrains.`);
}

export function executableName(platform) {
  return platform.startsWith('win-') ? 'node.exe' : 'node';
}

export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifyChecksum(file, expected) {
  const actual = await sha256(file);
  if (actual !== expected) throw new Error(`SHA-256 mismatch for ${path.basename(file)}: expected ${expected}, got ${actual}`);
}

// LICENSE in official Node archives includes bundled third-party notices.
export async function verifyRuntime(directory, platform) {
  const artifact = manifest.artifacts[platform];
  if (!artifact) throw new Error(`Unsupported runtime platform: ${platform}`);
  const metadata = JSON.parse(await fs.readFile(path.join(directory, 'runtime.json'), 'utf8'));
  if (metadata.version !== manifest.version || metadata.platform !== platform || metadata.archiveSha256 !== artifact.sha256) {
    throw new Error(`Stale runtime in ${directory}; run npm run prepare:runtimes -- --target=jetbrains`);
  }
  const license = await fs.readFile(path.join(directory, 'LICENSE'), 'utf8');
  if (!license.includes('Node.js') || !license.includes('MIT')) throw new Error(`Missing Node license/notices in ${directory}`);
  await verifyChecksum(path.join(directory, executableName(platform)), metadata.executableSha256);
}

async function downloadArtifact(artifact, cache) {
  await fs.mkdir(cache, { recursive: true });
  const archivePath = path.join(cache, artifact.archive);
  try {
    await fs.access(archivePath);
  } catch {
    const downloadDir = await fs.mkdtemp(path.join(cache, '.download-'));
    try {
      const partial = path.join(downloadDir, artifact.archive);
      const response = await fetch(`https://nodejs.org/dist/v${manifest.version}/${artifact.archive}`, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${artifact.archive}`);
      await pipeline(response.body, createWriteStream(partial));
      await verifyChecksum(partial, artifact.sha256);
      await fs.rename(partial, archivePath);
    } finally {
      await fs.rm(downloadDir, { recursive: true, force: true });
    }
  }
  try {
    await verifyChecksum(archivePath, artifact.sha256);
  } catch (error) {
    // Never extract corrupted cache entries; next invocation can download again.
    await fs.rm(archivePath, { force: true });
    throw error;
  }
  return archivePath;
}

export async function prepareRuntime(platform, destination = runtimeRoot, cache = path.join(root, 'dist', 'node-downloads')) {
  const artifact = manifest.artifacts[platform];
  if (!artifact) throw new Error(`Unsupported runtime platform: ${platform}`);
  const archivePath = await downloadArtifact(artifact, cache);
  await fs.mkdir(destination, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(destination, '.extract-'));
  const prefix = `node-v${manifest.version}-${platform}`;
  const executable = executableName(platform);
  const sourceExecutable = platform.startsWith('win-') ? executable : `bin/${executable}`;
  try {
    if (artifact.archive.endsWith('.zip')) {
      const members = [`${prefix}/${sourceExecutable}`, `${prefix}/LICENSE`];
      const files = unzipSync(await fs.readFile(archivePath), { filter: (entry) => members.includes(entry.name) });
      for (const member of members) {
        if (!files[member]) throw new Error(`Missing ${member} in ${artifact.archive}`);
        const output = path.join(temporary, member);
        await fs.mkdir(path.dirname(output), { recursive: true });
        await fs.writeFile(output, files[member]);
      }
    } else {
      await extractTar({
        file: archivePath,
        cwd: temporary,
        filter: (entry) => entry === `${prefix}/${sourceExecutable}` || entry === `${prefix}/LICENSE`,
      });
    }
    const staged = path.join(temporary, 'runtime');
    await fs.mkdir(staged);
    await fs.copyFile(path.join(temporary, prefix, sourceExecutable), path.join(staged, executable));
    await fs.chmod(path.join(staged, executable), 0o755);
    await fs.copyFile(path.join(temporary, prefix, 'LICENSE'), path.join(staged, 'LICENSE'));
    await fs.writeFile(path.join(staged, 'runtime.json'), JSON.stringify({
      version: manifest.version, platform, archiveSha256: artifact.sha256,
      executableSha256: await sha256(path.join(staged, executable)),
    }, null, 2) + '\n');
    await verifyRuntime(staged, platform);
    const output = path.join(destination, platform);
    // output is always a known manifest key immediately beneath destination.
    await fs.rm(output, { recursive: true, force: true });
    await fs.rename(staged, output);
    console.log(`Prepared Node ${manifest.version}: ${platform}`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((arg) => arg.startsWith('--target='))?.slice('--target='.length) ?? 'jetbrains';
  if (args.some((arg) => arg !== '--check' && !arg.startsWith('--target='))) throw new Error('Usage: prepare-node-runtime.mjs [--target=vs|jetbrains] [--check]');
  for (const platform of platformsFor(target)) {
    if (args.includes('--check')) await verifyRuntime(path.join(runtimeRoot, platform), platform);
    else await prepareRuntime(platform);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
