import test from 'node:test';
import assert from 'node:assert/strict';
import { MacOSProvider } from '../src/providers/macos.js';
import { CuaProvider } from '../src/providers/cua.js';
import { WindowsProvider } from '../src/providers/windows.js';

test('macOS targets elements directly without expected-state gates and activates by default', async () => {
  const provider = new MacOSProvider(); let request;
  provider.call = async value => { request = value; return { channel: 'accessibility' }; };
  const target = { pid: 12, bundleId: 'test.fixture', id: 34 };
  const observed = { frame: { x: -20, y: 10, width: 400, height: 300 } };
  const native = { locator: [0, 2], index: 2 };
  await provider.act(target, { kind: 'set_value', text: 'hello' }, { native }, undefined, observed);
  assert.equal(request.request.expectedStateHash, undefined);
  assert.deepEqual(request.request.element, native);
  assert.equal(request.request.interaction.keyboardPolicy, 'activate');
  await provider.act(target, { kind: 'drag', point: { x: -10, y: 30 }, to: { x: 20, y: 40 } }, undefined, undefined, observed);
  assert.equal(request.request.interaction.cursorSpeedPxPerSecond, 3000);
  await provider.act(target, { kind: 'activate' }, undefined, undefined, observed);
  assert.equal(request.command, 'activate-for-cursor');
});

test('CUA adapter uses window-local coordinates and foreground delivery by default', async () => {
  const provider = new CuaProvider(); let request;
  provider.call = async (tool, args) => { request = { tool, args }; return { effect: 'changed' }; };
  await provider.act({ pid: 5, id: 8 }, { kind: 'click', point: { x: 50, y: 25 } });
  assert.deepEqual(request.args, { pid: 5, window_id: 8, x: 50, y: 25, delivery_mode: 'foreground' });
  await provider.act({ pid: 5, id: 8 }, { kind: 'type', text: 'hello', foreground: false }, { ref: 'token' });
  assert.equal(request.args.element_token, 'token'); assert.equal(request.args.delivery_mode, 'background');
});

test('Windows activates automatically and enables native semantic fallbacks', async () => {
  const provider = new WindowsProvider(); let request;
  provider.call = async (kind, args) => { request = { kind, args }; return { ok: true }; };
  await provider.act({ pid: 3, id: 4 }, { kind: 'type', text: 'hello' });
  assert.equal(request.args.method, 'sendinput'); assert.equal(request.args.activate, true);
  await provider.act({ pid: 3, id: 4 }, { kind: 'invoke' }, { ref: 'exact' });
  assert.equal(request.args.fallbackClick, true);
  await provider.act({ pid: 3, id: 4 }, { kind: 'set_value', text: 'hello' }, { ref: 'exact' });
  assert.equal(request.args.fallbackType, true);
  await provider.act({ pid: 3, id: 4 }, { kind: 'key', keys: ['control', 'a'] });
  assert.equal(request.kind, 'keypress'); assert.equal(request.args.activate, true);
  provider.dispose();
});
