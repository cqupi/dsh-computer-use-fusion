import { spawnSync } from 'node:child_process';
const checks = [['scripts/check.mjs'], ['--test', ...['core', 'providers', 'process', 'image-budget', 'repl'].map(name => `tests/${name}.test.mjs`)],
  ['scripts/host-smoke.mjs'], ...(process.platform === 'win32' ? [['scripts/windows-smoke.mjs']] : [])];
for (const args of checks) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('All local validation passed. See docs/VALIDATION.md for platform limits.');
