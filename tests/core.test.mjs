import test from 'node:test';
import assert from 'node:assert/strict';
import { FusionCore } from '../src/core.js';
import { mapping, imagePoint, attachScreenshot } from '../src/vision.js';

const context = { owner: 'agent-a', turn: 1, callId: 'call-a' };
function fixture(config = {}, approve = async () => 'allowed-once') {
  let state = 'initial'; let calls = 0;
  const target = { id: 7, pid: 42, name: 'Fixture', appId: 'fixture' };
  const provider = { name: 'fixture', resolve: async () => target, observe: async () => ({ target, frame: { x: 0, y: 0, width: 400, height: 300 },
    elements: [{ ref: 'stable', label: state, role: 'Button', enabled: true, frame: { x: 20, y: 20, width: 80, height: 30 } }] }),
    act: async () => { calls++; state = 'clicked'; return { delivered: true }; }, dispose() {} };
  return { core: new FusionCore(provider, { settleMs: 0, ...config }, { approve }), provider,
    change: value => { state = value; }, calls: () => calls };
}
test('IDs are isolated by caller, consumed once, and actions return fresh evidence', async () => {
  const { core, calls } = fixture();
  const o = await core.observe({}, context);
  await assert.rejects(core.action({ kind: 'click', observationId: o.observationId, element: 0 }, { owner: 'agent-b' }), /WRONG_CALLER/);
  assert.equal(calls(), 0);
  const after = await core.action({ kind: 'click', observationId: o.observationId, element: 0 }, context);
  assert.equal(after.observation.elements[0].label, 'clicked');
  assert.equal(after.observedStateChanged, true);
  await assert.rejects(core.action({ kind: 'click', observationId: o.observationId, element: 0 }, context), /MISSING/);
  assert.equal(calls(), 1);
});
test('new observation invalidates previous caller ID', async () => {
  const { core } = fixture(); const a = await core.observe({}, context); await core.observe({}, context);
  await assert.rejects(core.action({ kind: 'click', observationId: a.observationId, element: 0 }, context), /MISSING/);
});
test('state changes and expiry refuse before input', async () => {
  const f = fixture(); const o = await f.core.observe({}, context); f.change('different');
  await assert.rejects(f.core.action({ kind: 'click', observationId: o.observationId, element: 0 }, context), /STATE_CHANGED/);
  const next = await f.core.observe({}, context); f.core.observations.get(next.observationId).expiresAt = 0;
  await assert.rejects(f.core.action({ kind: 'click', observationId: next.observationId, element: 0 }, context), /EXPIRED/);
  assert.equal(f.calls(), 0);
});
test('allowlist covers reading as well as control', async () => {
  const { core } = fixture({ allowedApps: ['other'] });
  await assert.rejects(core.observe({}, context), /SCOPE_DENIED/);
});
test('control denial cannot be retried into an approval loop in the same turn', async () => {
  let prompts = 0;
  const { core, calls } = fixture({}, async () => { prompts++; return 'denied'; });
  const o = await core.observe({}, context); const a = { kind: 'click', observationId: o.observationId, element: 0 };
  await assert.rejects(core.action(a, context), /APPROVAL_DENIED/);
  await assert.rejects(core.action(a, context), /CONTROL_DENIED/);
  assert.equal(prompts, 1); assert.equal(calls(), 0);
});
test('dangerous targets require separate one-use approval', async () => {
  let prompts = 0; const f = fixture({}, async () => { prompts++; return 'allowed-once'; });
  f.change('Delete'); const o = await f.core.observe({}, context);
  await f.core.action({ kind: 'click', observationId: o.observationId, element: 0 }, context);
  assert.equal(prompts, 2);
});
test('password typing refuses before requesting control', async () => {
  const f = fixture(); f.provider.observe = async target => ({ target, elements: [{ ref: 'p', role: 'Edit', focused: true, native: { isPassword: true } }] });
  const o = await f.core.observe({}, context);
  await assert.rejects(f.core.action({ kind: 'type', observationId: o.observationId, text: 'secret' }, context), /PASSWORD/);
  assert.equal(f.calls(), 0);
});
test('approval wait cannot authorize an expired observation', async () => {
  const f = fixture({}, async () => { for (const o of f.core.observations.values()) o.expiresAt = 0; return 'allowed-once'; });
  const o = await f.core.observe({}, context);
  await assert.rejects(f.core.action({ kind: 'click', observationId: o.observationId, element: 0 }, context), /EXPIRED/);
  assert.equal(f.calls(), 0);
});
test('negative monitor origins and unequal downscale factors map exactly once', () => {
  const m = mapping({ x: -1920, y: -40, width: 1920, height: 1080 }, 1045, 588);
  assert.deepEqual(imagePoint(m, 522.5, 294), { x: -960, y: 500 });
  assert.throws(() => imagePoint(m, 1045, 0), /OUTSIDE/);
  assert.throws(() => imagePoint(m, NaN, 1), /OUTSIDE/);
});
test('host normalization updates mapping, text-only and failed saves retain path', async () => {
  const data = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(data); data.writeUInt32BE(1000, 16); data.writeUInt32BE(600, 20);
  const shot = { data, path: 'fixture.png', bounds: { x: -100, y: 20, width: 2000, height: 1200 } };
  const a = await attachScreenshot(shot, { imageCapable: true, attachments: { saveImage: async () => ({ attachmentId: 'id', width: 500, height: 300 }) } });
  assert.deepEqual(a.mapping.screenPerPixel, [4, 4]);
  const b = await attachScreenshot(shot, { imageCapable: false }); assert.equal(b.image, undefined); assert.equal(b.screenshot.path, 'fixture.png');
  const c = await attachScreenshot(shot, { imageCapable: true, attachments: { saveImage: async () => { throw Error(); } } });
  assert.ok(c.imageWarning); assert.deepEqual(c.mapping.screenPerPixel, [2, 2]);
});
test('aborted calls refuse before any observation or input', async () => {
  const { core } = fixture(); const controller = new AbortController(); controller.abort();
  await assert.rejects(core.observe({}, { ...context, signal: controller.signal }), /abort/i);
});
