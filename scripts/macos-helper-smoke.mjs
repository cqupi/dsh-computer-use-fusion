import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MacOSProvider } from '../src/providers/macos.js';

if (process.platform !== 'darwin') { console.log('SKIP: macOS helper health'); process.exit(0); }
const provider = new MacOSProvider();
try {
  const health = await provider.health(AbortSignal.timeout(30000));
  const manifest = JSON.parse(await readFile(new URL('../native/macos/manifest.json', import.meta.url)));
  assert.equal(health.helperVersion, manifest.helperVersion);
  assert.ok(['granted', 'denied'].includes(health.accessibility));
  console.log(`PASS: compiled helper ${health.helperVersion} executes through normal Node child-process transport.`);
} finally { await provider.dispose(); }
