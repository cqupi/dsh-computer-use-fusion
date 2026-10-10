import test from 'node:test';
import assert from 'node:assert/strict';
import { MacOSProvider } from '../src/providers/macos.js';
import { CuaProvider } from '../src/providers/cua.js';
import { WindowsProvider } from '../src/providers/windows.js';
import { fingerprint } from '../src/core.js';

test('macOS passes exact native state, locator and foreground policy to helper', async () => {
  const provider = new MacOSProvider(); let request;
  provider.call = async value => { request = value; return { channel: 'accessibility' }; };
  const target = { pid: 12, bundleId: 'test.fixture', id: 34 };
  const observed = { stateHash: 'hash', frame: { x: -20, y: 10, width: 400, height: 300 } };
  const native = { locator: [0, 2], index: 2 };
  await provider.act(target, { kind: 'set_value', text: 'hello' }, { native }, undefined, observed);
  assert.equal(request.command, 'act');
  assert.equal(request.request.expectedStateHash, 'hash');
  assert.deepEqual(request.request.element, native);
  assert.equal(request.request.interaction.keyboardPolicy, 'preserve');
  assert.deepEqual(request.request.window, { id: 34, frame: observed.frame });
  await provider.act(target, { kind: 'click', point: { x: -10, y: 30 }, foreground: true }, undefined, undefined, observed);
  assert.equal(request.request.action.coordinateSpace, 'screen');
  assert.equal(request.request.action.x, -10);
  assert.equal(request.request.interaction.focusPolicy, 'activate');
});
test('CUA adapter uses window-local image pixels and exact window/session', async () => {
  const provider = new CuaProvider(); let request;
  provider.call = async (tool, args) => { request = { tool, args }; return { effect: 'changed' }; };
  await provider.act({ pid: 5, id: 8 }, { kind: 'click', point: { x: 50, y: 25 } });
  assert.equal(request.tool, 'click');
  assert.deepEqual(request.args, { pid: 5, window_id: 8, x: 50, y: 25, delivery_mode: 'background' });
  await provider.act({ pid: 5, id: 8 }, { kind: 'type', text: 'hello' }, { ref: 'fresh-token' });
  assert.equal(request.args.element_token, 'fresh-token');
  const a = { coordinateSystem: 'cua-local', target: { pid: 5, id: 8 }, frame: { x: 0, y: 0, width: 100, height: 100 }, elements: [{ ref: 'old', label: 'Hello' }] };
  assert.equal(fingerprint(a), fingerprint({ ...a, elements: [{ ref: 'new', label: 'Hello' }] }));
});
test('Windows never silently upgrades background text or semantic operations to global input', async () => {
  const provider = new WindowsProvider(); let request;
  provider.call = async (kind, args) => { request = { kind, args }; return { ok: true }; };
  await provider.act({ pid: 3, id: 4 }, { kind: 'type', text: 'hello' });
  assert.equal(request.args.method, 'background'); assert.equal(request.args.activate, false);
  await provider.act({ pid: 3, id: 4 }, { kind: 'invoke' }, { ref: 'exact' });
  assert.equal(request.args.fallbackClick, false);
  await provider.act({ pid: 3, id: 4 }, { kind: 'set_value', text: 'hello' }, { ref: 'exact' });
  assert.equal(request.args.fallbackType, false);
  await assert.rejects(provider.act({ pid: 3, id: 4 }, { kind: 'key', keys: ['control', 'a'] }), /FOREGROUND/);
  provider.dispose();
});
