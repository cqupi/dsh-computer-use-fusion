import { createProvider } from '../src/providers/index.js';
import { createRequire } from 'node:module';

let provider;
try {
  provider = createProvider({ backend: process.env.DSH_FUSION_BACKEND || 'auto' });
  const health = await provider.health(AbortSignal.timeout(30000));
  const require = createRequire(import.meta.url);
  console.log(JSON.stringify({ node: process.version, dshTools: require('@deepseek-ai/dsh-tools/package.json').version,
    backend: provider.name, ready: health.ready ?? health.ok ?? true, platform: process.platform,
    interaction: 'persistent JavaScript / remembered target / automatic activation',
    nativeMacOSRequires: 'macOS 14+, Accessibility; Screen Recording for screenshots',
    windowsForegroundMovesRealCursor: true }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await provider?.dispose(); }
