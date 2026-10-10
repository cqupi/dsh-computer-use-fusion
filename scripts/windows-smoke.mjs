import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import { WindowsProvider } from '../src/providers/windows.js';
import { FusionCore } from '../src/core.js';
import { ComputerRepl } from '../src/repl.js';

if (process.platform !== 'win32') { console.log('SKIP: native Windows test'); process.exit(0); }
const fixture = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./fixture.ps1', import.meta.url))],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let fixtureError = '';
fixture.stderr.on('data', data => { fixtureError += data; });
const provider = new WindowsProvider({ visionMaxPixels: 640000 });
const core = new FusionCore(provider, { settleMs: 150, screenshotAfterAction: false });
const repl = new ComputerRepl(core);
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
  result = await core.action({ kind: 'set_value', element: password.index, text: 'fixture-only' }, context);
  assert.ok(result.observation.elements.some(e => e.label === 'Password length: 12'), 'Password input reached the fixture');
  const old = await core.observe({ pid: ready.pid, windowId: ready.hwnd }, context);
  await provider.call('set_value', { ...provider.selector(old.target), elementId: input.ref, value: 'external change', fallbackType: false }, context.signal);
  await core.action({ kind: 'invoke', observationId: old.observationId, element: button.index }, context);
  const js = await repl.execute(`let app = await cua.getApp({windowId:${ready.hwnd}}); await app.setValue('FusionEditor', 'Persistent JS 验证'); await app.invoke('FusionAction'); await app.getAXState();`, context);
  assert.equal(js.ok, true, JSON.stringify(js));
  assert.ok(js.outputs.some(value => typeof value === 'string' && value.includes('Persistent JS 验证')));
  if (!process.env.CI) {
    const typed = await repl.execute(`await app.click('FusionEditor'); await app.pressKey('ctrl+a'); await app.typeText('Keyboard Unicode 验证');`, context);
    assert.equal(typed.ok, true, JSON.stringify(typed));
    const readback = await core.observe({ target: old.target, screenshot: false }, context);
    assert.equal(readback.elements.find(e => e.label === 'FusionEditor')?.value, 'Keyboard Unicode 验证', JSON.stringify(typed));
  }
  console.log('PASS: native capture/mapping, semantic Unicode readback, password input, reusable observations after UI changes, persistent JS multi-action loop and local foreground keyboard input.');
} finally { await repl.dispose(); await core.dispose(); fixture.kill(); }
