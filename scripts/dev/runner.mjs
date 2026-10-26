import { spawn, spawnSync } from 'node:child_process';
import { openSync, closeSync, writeSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Run an argv array without a shell, keeping both output streams in a log. */
export async function runStep(step, { log, signal, quiet = false, timeoutMs = 600_000 } = {}) {
  const started = Date.now();
  if (signal?.aborted) return { status: 'interrupted', exitCode: null, durationMs: 0 };
  const fd = openSync(log, 'w');
  try {
    return await new Promise(resolve => {
      let timedOut = false;
      let error;
      const child = spawn(step.command, step.args ?? [], {
        cwd: step.cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true, detached: process.platform !== 'win32',
      });
      const output = data => {
        writeSync(fd, data);
        if (!quiet) process.stderr.write(data);
      };
      child.stdout.on('data', output);
      child.stderr.on('data', output);
      const stop = () => {
        if (!child.pid) return;
        if (process.platform === 'win32') {
          // npm launches grandchildren; kill the whole tree, not just npm.
          spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 5000 });
          child.kill('SIGKILL');
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        }
      };
      const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
      signal?.addEventListener('abort', stop, { once: true });
      if (signal?.aborted) stop();
      child.once('error', cause => { error = cause.message; output(Buffer.from(`${error}\n`)); });
      child.once('close', (exitCode, exitSignal) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', stop);
        resolve({ status: signal?.aborted ? 'interrupted' : timedOut ? 'timed-out' : error || exitCode !== 0 ? 'failed' : 'passed',
          exitCode, signal: exitSignal, ...(error ? { error } : {}), durationMs: Date.now() - started });
      });
    });
  } finally { closeSync(fd); }
}

/** A report is persisted before each step so an interrupted run cannot look green. */
export async function runSteps(steps, { directory, profile, metadata = {}, signal, quiet = false, timeoutMs } = {}) {
  await fs.mkdir(directory, { recursive: true });
  const reportFile = path.join(directory, 'report.json');
  const report = { schemaVersion: 1, profile, status: 'running', startedAt: new Date().toISOString(), ...metadata,
    steps: steps.map((step, index) => ({ name: step.name, command: [step.command, ...(step.args ?? [])],
      cwd: step.cwd, status: 'pending', log: `${index + 1}.log` })) };
  const save = () => fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  await save();
  for (let index = 0; index < steps.length; index++) {
    const entry = report.steps[index];
    entry.status = 'running';
    await save();
    if (!quiet) process.stderr.write(`\n[${index + 1}/${steps.length}] ${entry.name}\n`);
    Object.assign(entry, await runStep(steps[index], { log: path.join(directory, entry.log), signal, quiet, timeoutMs }));
    if (entry.status !== 'passed') {
      report.status = entry.status;
      report.steps.slice(index + 1).forEach(step => { step.status = 'skipped'; });
      break;
    }
  }
  if (report.status === 'running') report.status = 'passed';
  report.finishedAt = new Date().toISOString();
  await save();
  return { ...report, reportFile };
}
