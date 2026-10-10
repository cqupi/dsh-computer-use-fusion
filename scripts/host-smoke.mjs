import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { createTools } from '../src/tools.js';
import plugin, { apply, skill } from '../src/index.js';

// Optional directory lets the exact published alpha SDK be tested in isolation.
const requireHost = createRequire(resolve(process.argv[2] || '.', 'package.json'));
const sdk = await import(pathToFileURL(requireHost.resolve('@deepseek-ai/dsh-tools')).href);
const { default: Skills } = await import(pathToFileURL(requireHost.resolve('@deepseek-ai/dsh-skill')).href);
const version = requireHost('@deepseek-ai/dsh-tools/package.json').version;
const ctx = new Context();
ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {} });
const toolFiber = ctx.plugin(sdk.default, { mode: 'native' });
const skillFiber = ctx.plugin(Skills);
await Promise.all([toolFiber, skillFiber]);
const fakeProvider = { name: 'contract-test', health: async () => ({ ok: true }), list: async () => [], dispose() {} };
const target = { pid: 42, id: 5, name: 'Contract fixture', appId: 'fixture' };
fakeProvider.resolve = async () => target;
fakeProvider.observe = async (_target, screenshot) => ({ target, elements: [], frame: { x: 20, y: 30, width: 2, height: 2 },
  screenshot: screenshot ? { data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'), bounds: { x: 20, y: 30, width: 2, height: 2 } } : undefined });
const { FusionCore } = await import('../src/core.js');
const core = new FusionCore(fakeProvider);
const tools = createTools(core, sdk.defineTool, () => ({ owner: 'test', signal: AbortSignal.timeout(5000) }));
const releases = tools.map(tool => ctx.tools.register(tool));
const releaseSkill = ctx.skills.register(skill);
assert.equal(ctx.tools.schemas().length, 14);
const result = await ctx.tools.execute({ name: 'fusion_health', arguments: {}, callId: 'host-smoke', signal: AbortSignal.timeout(5000) });
assert.equal(result.isError, false, JSON.stringify(result));
assert.equal(result.value.ok, true);
assert.equal(result.content[0].type, 'text');
releases.forEach(release => release());
await tools.dispose();
releaseSkill();
assert.equal(ctx.tools.schemas().length, 0, 'Disposal unregisters all tools');
ctx.provide('llm', { resolveModelInfo: async () => ({ inputModalities: ['text', 'image'] }) });
ctx.provide('attachments', { saveImage: async ({ data }) => ({ attachmentId: 'contract-image', mediaType: 'image/png', bytes: data.length, width: 1, height: 1 }) });
const installed = ctx.plugin({ inject: ['tools'], apply: (child, config) => apply(child, config, fakeProvider) }, {});
await installed;
assert.equal(ctx.tools.schemas().length, 14, 'Actual plugin lifecycle installs all tools without approval service');
const agent = { session: { id: 'session-test', header: { createdAt: 1 }, snapshotEvents: () => [{ type: 'turn/start', data: { turn: 1 } }] }, options: {} };
const dispatched = await ctx.tools.execute({ name: 'fusion_health', arguments: {}, agent,
  callId: 'plugin-smoke', signal: AbortSignal.timeout(5000) });
assert.equal(dispatched.isError, false, JSON.stringify(dispatched));
const visual = await ctx.tools.execute({ name: 'fusion_observe', arguments: { screenshot: true }, agent,
  callId: 'image-smoke', signal: AbortSignal.timeout(5000) });
assert.equal(visual.isError, false, JSON.stringify(visual));
assert.equal(visual.content[1].type, 'image');
assert.deepEqual(visual.value.mapping.screenPerPixel, [2, 2]);
const js = await ctx.tools.execute({ name: 'fusion_computer', arguments: { code: 'let app = await cua.getApp({windowId:5}); await app.getScreenshot();' }, agent,
  callId: 'repl-smoke', signal: AbortSignal.timeout(10000) });
assert.equal(js.isError, false, JSON.stringify(js));
assert.equal(js.value.ok, true, JSON.stringify(js));
assert.equal(js.content.filter(block => block.type === 'image').length, 1);
const continued = await ctx.tools.execute({ name: 'fusion_computer', arguments: { code: 'await app.getAXState();' }, agent: { ...agent, session: { ...agent.session } },
  callId: 'repl-next-turn', signal: AbortSignal.timeout(10000) });
assert.equal(continued.value.ok, true, 'A new Agent object in the same conversation retains JavaScript bindings');
await installed.dispose();
assert.equal(ctx.tools.schemas().length, 0, 'Actual plugin unload unregisters all tools');
assert.equal(plugin.name, 'dsh-computer-use-fusion');
await skillFiber.dispose();
await toolFiber.dispose();
console.log(`PASS: real Cordis + DSH tools/skills ${version}, 14 schemas, no approval dependency, persistent JS image output, clean unregistration.`);
