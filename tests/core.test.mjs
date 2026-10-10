import test from 'node:test';
import assert from 'node:assert/strict';
import { FusionCore } from '../src/core.js';
import { mapping, imagePoint, attachScreenshot } from '../src/vision.js';

const context = { owner: 'agent-a' };
export function fixture(config = {}) {
  let state = 'initial'; const actions = []; let captures = 0;
  const target = { id: 7, pid: 42, name: 'Fixture', appId: 'fixture' };
  const provider = { name: 'fixture', resolve: async () => target, list: async () => [{ processId: 42, nativeWindowHandle: 7, name: 'Fixture' }],
    observe: async () => { captures++; return { target, frame: { x: 10, y: 20, width: 400, height: 300 },
      elements: [{ ref: 'stable', label: state, role: 'Button', enabled: true, frame: { x: 20, y: 20, width: 80, height: 30 } }] }; },
    act: async (_target, action, element) => { actions.push({ action, element }); state = 'clicked'; return { delivered: true }; }, dispose() {} };
  return { core: new FusionCore(provider, { settleMs: 0, screenshotAfterAction: false, ...config }), provider,
    change: value => { state = value; }, actions, captures: () => captures };
}

test('current target is remembered and repeated actions need no observation ID or approval service', async () => {
  const f = fixture();
  await f.core.observe({}, context);
  await f.core.action({ kind: 'click', element: 0 }, context);
  const result = await f.core.action({ kind: 'click', elementName: 'clicked' }, context);
  assert.equal(f.actions.length, 2);
  assert.equal(result.observation.elements[0].label, 'clicked');
  assert.equal(f.actions[0].action.foreground, true);
});

test('compatibility IDs are reusable across state changes, later observations and callers', async () => {
  const f = fixture(); const old = await f.core.observe({}, context);
  f.change('changed in app'); await f.core.observe({}, context);
  await f.core.action({ kind: 'click', observationId: old.observationId, element: 0, sensitive: true }, { owner: 'other-agent' });
  await f.core.action({ kind: 'click', observationId: old.observationId, element: 0 }, context);
  assert.equal(f.actions.length, 2);
});

test('danger labels, password flags and legacy gate settings do not intercept actions', async () => {
  const f = fixture({ requireControlApproval: true, allowedApps: ['other'], ttlMs: 1 });
  f.provider.observe = async target => ({ target, elements: [{ ref: 'password', label: 'Delete and Pay', focused: true, password: true, native: { isPassword: true } }] });
  await f.core.observe({}, context);
  await f.core.action({ kind: 'type', text: 'fixture-only password' }, context);
  await f.core.action({ kind: 'set_value', element: 0, text: 'fixture value' }, context);
  assert.equal(f.actions.length, 2);
});

test('batched actions do not add preflight or postflight captures', async () => {
  const f = fixture(); await f.core.observe({}, context);
  await f.core.action({ kind: 'click', ref: 'stable', observeAfter: false }, context);
  await f.core.action({ kind: 'type', text: 'hello', observeAfter: false }, context);
  assert.equal(f.captures(), 1);
  await f.core.observe({ screenshot: false }, context);
  assert.equal(f.captures(), 2);
});

test('coordinate mapping survives tree refresh and allows points outside the image rectangle', async () => {
  const f = fixture(); const o = await f.core.observe({ screenshot: false }, context);
  const snapshot = f.core.observations.get(o.observationId);
  snapshot.mapping = mapping({ x: -100, y: 20, width: 400, height: 300 }, 200, 150);
  await f.core.observe({ screenshot: false }, context);
  await f.core.action({ kind: 'click', x: 220, y: 40, observeAfter: false }, context);
  assert.deepEqual(f.actions[0].action.point, { x: 340, y: 100 });
});

test('no prior observation is required for keyboard input and default scroll centers the window', async () => {
  const f = fixture();
  await f.core.action({ kind: 'key', keys: ['control', 'a'], observeAfter: false }, context);
  await f.core.action({ kind: 'scroll', direction: 'down', observeAfter: false }, context);
  assert.deepEqual(f.actions[1].action.point, { x: 210, y: 170 });
});

test('negative monitor origins and attachment normalization map exactly once', () => {
  const m = mapping({ x: -1920, y: -40, width: 1920, height: 1080 }, 1045, 588);
  assert.deepEqual(imagePoint(m, 522.5, 294), { x: -960, y: 500 });
  assert.throws(() => imagePoint(m, NaN, 1), /COORDINATES_REQUIRED/);
});

test('real image attachment mapping includes host normalization and failed saves retain local evidence', async () => {
  const data = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(data); data.writeUInt32BE(1000, 16); data.writeUInt32BE(600, 20);
  const shot = { data, path: 'fixture.png', bounds: { x: -100, y: 20, width: 2000, height: 1200 } };
  const a = await attachScreenshot(shot, { imageCapable: true, attachments: { saveImage: async () => ({ attachmentId: 'id', width: 500, height: 300 }) } });
  assert.deepEqual(a.mapping.screenPerPixel, [4, 4]);
  const b = await attachScreenshot(shot, { imageCapable: false }); assert.equal(b.image, undefined); assert.equal(b.screenshot.path, 'fixture.png');
  const c = await attachScreenshot(shot, { imageCapable: true, attachments: { saveImage: async () => { throw Error(); } } });
  assert.ok(c.imageWarning); assert.deepEqual(c.mapping.screenPerPixel, [2, 2]);
});

test('host cancellation aborts observation without writing persistent stop state', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort();
  await assert.rejects(f.core.observe({}, { ...context, signal: controller.signal }), /abort/i);
});
