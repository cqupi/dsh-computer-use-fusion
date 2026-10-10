import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { readFileSync } from 'node:fs';
import { createProvider } from './providers/index.js';
import { FusionCore } from './core.js';
import { createTools } from './tools.js';

export const name = 'dsh-computer-use-fusion';
export const inject = ['tools'];
export const Config = z.object({
  backend: z.union(['auto', 'windows', 'macos', 'cua']).default('auto'),
  timeoutMs: z.number().min(1000).max(120000).default(30000),
  maxNodes: z.number().min(10).max(2000).default(250),
  vision: z.boolean().default(true),
  visionMaxPixels: z.number().min(10000).max(640000).default(640000),
  settleMs: z.number().min(0).max(3000).default(100),
  screenshotAfterAction: z.boolean().default(true),
});

const skillContent = readFileSync(new URL('../skills/computer-use-fusion.md', import.meta.url), 'utf8');
export const skill = { name: 'dsh-computer-use-fusion', source: 'runtime', content: skillContent,
  description: 'Codex-style persistent JavaScript computer use, native UIA/AX and real screenshots.',
  whenToUse: 'Use to view and interact with native desktop applications through cua/computer app bindings or direct fusion tools.' };

export function executionContext(exec, ctx, identities = new WeakMap()) {
  const agent = exec?.agent;
  if (agent && !identities.has(agent)) identities.set(agent, `agent:${identitiesCounter++}`);
  return { owner: agent ? identities.get(agent) : 'default', callId: exec?.callId, signal: exec?.signal, agent,
    attachments: ctx.get?.('attachments') };
}
let identitiesCounter = 0;

export function apply(ctx, rawConfig = {}, suppliedProvider) {
  // Resolve new Loader reference wrappers without importing removed settings exports.
  const values = Object.fromEntries(Object.entries(rawConfig).map(([key, value]) => [key,
    value && typeof value.get === 'function' ? value.get() : value]));
  const config = Config(values);
  const provider = suppliedProvider ?? createProvider(config);
  const identities = new WeakMap();
  const core = new FusionCore(provider, config);
  const contextOf = async exec => {
    const context = executionContext(exec, ctx, identities);
    // Never send image blocks to a route that does not declare image input.
    try {
      const llm = ctx.get?.('llm');
      const route = context.agent?.session?.requestHeader?.()?.config ?? context.agent?.options;
      const info = await llm?.resolveModelInfo?.(route?.provider, route?.model, exec?.signal);
      context.imageCapable = info?.inputModalities?.includes('image') === true;
    } catch { context.imageCapable = false; }
    return context;
  };
  ctx.effect(() => {
    const tools = createTools(core, defineTool, contextOf);
    const releases = tools.map(tool => ctx.tools.register(tool));
    return async () => { releases.forEach(release => release()); await tools.dispose(); await core.dispose(); };
  });
  ctx.inject?.(['skills'], sctx => sctx.skills.register(skill));
  ctx.logger?.info?.(`Computer Use Fusion registered: backend=${provider.name}; persistent computer REPL + 13 direct tools.`);
}
export default { name, inject, Config, apply };
