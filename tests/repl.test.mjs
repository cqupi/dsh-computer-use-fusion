import test from 'node:test';
import assert from 'node:assert/strict';
import { FusionCore } from '../src/core.js';
import { ComputerRepl } from '../src/repl.js';
import { renderResult } from '../src/tools.js';

function fixture() {
  const actions = []; let captures = 0;
  const target = { id: 7, pid: 42, name: 'REPL Fixture' };
  const provider = { name: 'fixture', list: async () => [{ processId: 42, nativeWindowHandle: 7, name: 'REPL Fixture' }], resolve: async () => target,
    observe: async (_target, shot) => { captures++; return { target, elements: [{ ref: 'editor', role: 'Edit', label: 'Editor' }], frame: { x: 10, y: 20, width: 2, height: 2 },
      screenshot: shot ? { path: 'unused.png', data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'), bounds: { x: 10, y: 20, width: 2, height: 2 } } : undefined }; },
    act: async (_target, action) => { actions.push(action); return { delivered: true }; }, dispose() {} };
  const core = new FusionCore(provider, { settleMs: 0 }); const repl = new ComputerRepl(core);
  const context = { owner: 'a', signal: AbortSignal.timeout(15000), imageCapable: true, attachments: { saveImage: async () => ({ attachmentId: 'image', width: 1, height: 1 }) } };
  return { repl, core, context, actions, captures: () => captures, dispose: async () => { await repl.dispose(); await core.dispose(); } };
}

test('Codex-style app binding and variables persist across calls with current cancellation context', async () => {
  const f = fixture();
  try {
    const a = await f.repl.execute('let app = await cua.getApp({windowId:7}); let count = 1;', f.context);
    assert.equal(a.ok, true, JSON.stringify(a));
    const b = await f.repl.execute('await app.click(0); await app.typeText("hello"); await app.pressKey("ctrl+a"); count += 1; nodeRepl.write(count); await app.getAXState();', f.context);
    assert.equal(b.ok, true, JSON.stringify(b));
    assert.equal(f.actions.length, 3); assert.equal(f.captures(), 2);
    assert.deepEqual(f.actions[2].keys, ['control', 'a']);
    assert.ok(b.outputs.includes(2));
    assert.equal(f.actions[0].observeAfter, false);
  } finally { await f.dispose(); }
});

test('screenshots are real image blocks, including screenshots nested inside REPL output', async () => {
  const f = fixture();
  try {
    const result = await f.repl.execute('const app = await computer.getApp({windowId:7}); await app.getScreenshot();', f.context);
    assert.equal(result.ok, true, JSON.stringify(result));
    const blocks = renderResult({}, result);
    assert.equal(blocks.filter(b => b.type === 'image').length, 1);
    assert.equal(blocks[1].attachment.attachmentId, 'image');
    await f.repl.execute('await app.click([0.5,0.5]);', f.context);
    assert.deepEqual(f.actions[0].point, { x: 11, y: 21 });
  } finally { await f.dispose(); }
});

test('JavaScript errors preserve previous bindings and report already-completed outputs', async () => {
  const f = fixture();
  try {
    const failed = await f.repl.execute('let value = 10; nodeRepl.write("before"); await Promise.reject(new Error("fixture error"));', f.context);
    assert.equal(failed.ok, false); assert.match(failed.error, /fixture error/);
    assert.ok(failed.outputs.includes('before'));
    const next = await f.repl.execute('value += 1; value', f.context);
    assert.equal(next.value, 11);
  } finally { await f.dispose(); }
});

test('host cancellation terminates an infinite JS loop without blocking the desktop host', async () => {
  const f = fixture(); const controller = new AbortController();
  try {
    const pending = f.repl.execute('while (true) {}', { ...f.context, signal: controller.signal });
    setTimeout(() => controller.abort(new Error('fixture cancel')), 100);
    await assert.rejects(pending, /fixture cancel/);
    const next = await f.repl.execute('1 + 1', f.context);
    assert.equal(next.value, 2);
  } finally { await f.dispose(); }
});
