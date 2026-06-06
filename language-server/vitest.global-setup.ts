import { execSync } from 'node:child_process';

// Build the server before the protocol integration tests so they exercise a
// fresh out/server.js — the same artifact every IDE bundles and spawns.
export default function setup() {
  execSync('npm run build', { stdio: 'inherit' });
}
