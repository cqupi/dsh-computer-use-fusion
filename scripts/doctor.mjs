import { writeFile, rm } from 'node:fs/promises';
import { stopFile } from '../src/core.js';
import { createProvider } from '../src/providers/index.js';
import { createRequire } from 'node:module';

if (process.argv.includes('--stop')) {
  await writeFile(stopFile(), 'Stopped by human operator\n');
  console.log('Stop marker written. Further actions refuse; an already-dispatched native gesture may finish.');
} else if (process.argv.includes('--resume')) {
  await rm(stopFile(), { force: true });
  console.log('Human resume: stop marker removed. Observe again and renew control approval.');
} else {
  let provider;
  try {
    provider = createProvider({ backend: process.env.DSH_FUSION_BACKEND || 'auto' });
    const health = await provider.health(AbortSignal.timeout(30000));
    const require = createRequire(import.meta.url);
    const version = require('@deepseek-ai/dsh-tools/package.json').version;
    console.log(JSON.stringify({ node: process.version, dshTools: version, backend: provider.name,
      ready: health.ready ?? health.ok ?? true, platform: process.platform,
      nativeMacOSRequires: 'macOS 14+, Accessibility; Screen Recording for screenshots',
      windowsForegroundMovesRealCursor: true }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await provider?.dispose(); }
}
