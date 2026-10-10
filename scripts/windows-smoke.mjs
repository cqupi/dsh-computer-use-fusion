import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import { WindowsProvider } from '../src/providers/windows.js';
import { FusionCore } from '../src/core.js';

if (process.platform !== 'win32') { console.log('SKIP: native Windows test'); process.exit(0); }
const fixture = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./fixture.ps1', import.meta.url))],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let fixtureError = '';
fixture.stderr.on('data', data => { fixtureError += data; });
const provider = new WindowsProvider({ visionMaxPixels: 640000 });
const core = new FusionCore(provider, { requireControlApproval: false, settleMs: 150 });
const context = { owner: 'native-fixture-test', turn: 1, signal: AbortSignal.timeout(60000) };
try {
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Fixture startup timeout: ${fixtureError}`)), 15000);
    fixture.once('exit', () => { clearTimeout(timer); reject(new Error(fixtureError || 'Fixture exited')); });
    createInterface({ input: fixture.stdout }).on('line', line => {
      try { const value = JSON.parse(line); if (value.hwnd) { clearTimeout(timer); resolve(value); } } catch {}
    });
  });
  let o = await core.observe({ pid: ready.pid, windowId: ready.hwnd, screenshot: true }, context);
  assert.ok(o.mapping.width * o.mapping.height <= 640000);
  assert.ok(o.mapping.screenPerPixel[0] > 1, 'Real capture was downscaled before attachment');
  const input = o.elements.find(e => e.label === 'FusionEditor'); assert.ok(input, 'UIA editor present');
  let result = await core.action({ kind: 'set_value', observationId: o.observationId, element: input.index, text: 'Fusion exact input 验证' }, context);
  assert.equal(result.observation.elements.find(e => e.label === 'FusionEditor')?.value, 'Fusion exact input 验证');
  o = result.observation;
  const button = o.elements.find(e => e.label === 'FusionAction'); assert.ok(button);
  result = await core.action({ kind: 'invoke', observationId: o.observationId, handle: button.handle }, context);
  assert.ok(result.observation.elements.some(e => e.label === 'Status: clicked' || e.value === 'Status: clicked'), 'UIA confirms button effect');
  o = result.observation;
  const password = o.elements.find(e => e.label === 'FusionPassword'); assert.ok(password);
  await assert.rejects(core.action({ kind: 'set_value', observationId: o.observationId, element: password.index, text: 'blocked' }, context), /PASSWORD/);
  const old = await core.observe({ pid: ready.pid, windowId: ready.hwnd }, context);
  await provider.call('set_value', { ...provider.selector(old.target), elementId: input.ref, value: 'external change', fallbackType: false }, context.signal);
  await assert.rejects(core.action({ kind: 'invoke', observationId: old.observationId, element: button.index }, context), /STATE_CHANGED/);
  console.log('PASS: native UIA discovery, selected-window capture, pixel budget, semantic Unicode value/readback, background invoke/effect, password refusal, stale-state refusal.');
} finally { await core.dispose(); fixture.kill(); }
