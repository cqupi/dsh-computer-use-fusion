import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { LineProcess } from '../src/process.js';

test('timeout destroys generation; later call cannot receive late output', async () => {
  const process = new LineProcess(globalThis.process.execPath, [fileURLToPath(new URL('./line-backend.mjs', import.meta.url))]);
  try {
    await assert.rejects(process.call('slow', {}, undefined, 100), /TIMEOUT/);
    const result = await process.call('next', {}, undefined, 5000);
    assert.equal(result.action, 'next');
  } finally { process.dispose(); }
});
test('caller abort kills active request and leaves no pending waiter', async () => {
  const process = new LineProcess(globalThis.process.execPath, [fileURLToPath(new URL('./line-backend.mjs', import.meta.url))]);
  const controller = new AbortController();
  try {
    const pending = process.call('slow', {}, controller.signal);
    setTimeout(() => controller.abort(new Error('test cancelled')), 50);
    await assert.rejects(pending, /cancelled/); assert.equal(process.pending.size, 0);
  } finally { process.dispose(); }
});
