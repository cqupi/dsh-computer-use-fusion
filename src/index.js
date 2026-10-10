import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { readFileSync } from 'node:fs';
import { createProvider } from './providers/index.js';
import { FusionCore } from './core.js';
import { createTools } from './tools.js';

export const name = 'dsh-computer-use-fusion';
export const inject = ['tools', 'approval'];
export const Config = z.object({
  backend: z.union(['auto', 'windows', 'macos', 'cua']).default('auto'),
  ttlMs: z.number().min(1000).max(300000).default(30000),
  timeoutMs: z.number().min(1000).max(120000).default(30000),
  maxNodes: z.number().min(10).max(2000).default(250),
  allowedApps: z.array(z.string()).default([]),
  requireControlApproval: z.boolean().default(true),
  vision: z.boolean().default(true),
  visionMaxPixels: z.number().min(10000).max(640000).default(640000),
  settleMs: z.number().min(0).max(3000).default(100),
});

const skillContent = readFileSync(new URL('../skills/computer-use-fusion.md', import.meta.url), 'utf8');
export const skill = { name: 'dsh-computer-use-fusion', source: 'runtime', content: skillContent,
  description: 'Unified native Windows/macOS computer use with exact image coordinates and scoped fresh observations.',
  whenToUse: 'Use only when a purpose-built connector, API, CLI or browser automation cannot operate the local native application.' };

export function executionContext(exec, ctx, identities = new WeakMap()) {
  const agent = exec?.agent;
  if (!agent?.session) throw new Error('DSH_AGENT_SESSION_REQUIRED');
  // Agent object identity prevents two agents in one session borrowing IDs.
  if (!identities.has(agent)) identities.set(agent, `${agent.session.id || agent.session.header?.sessionId}:${identitiesCounter++}`);
  const events = agent.session.snapshotEvents?.() ?? agent.session.events ?? [];
  let turn;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'turn/end') break;
    if (events[i].type === 'turn/start') { turn = events[i].data.turn; break; }
  }
  return { owner: identities.get(agent), turn, callId: exec.callId, signal: exec.signal, agent,
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
  const core = new FusionCore(provider, config, {
    approve: (context, reason) => {
      const policy = ctx.approval.overrideOf?.(context.agent.session) ?? ctx.approval.config?.policy;
      if (policy === 'never') throw new Error('DSH_APPROVAL_POLICY_NEVER: approvals unavailable; user must change policy or operate manually');
      return ctx.approval.request({ agent: context.agent, toolName: 'fusion_control', callId: context.callId,
        reason, signal: context.signal });
    },
  });
  const contextOf = async exec => {
    const context = executionContext(exec, ctx, identities);
    // Never send image blocks to a route that does not declare image input.
    try {
      const llm = ctx.get?.('llm');
      const route = context.agent.session.requestHeader?.()?.config ?? context.agent.options;
      const info = await llm?.resolveModelInfo?.(route?.provider, route?.model, exec.signal);
      context.imageCapable = info?.inputModalities?.includes('image') === true;
    } catch { context.imageCapable = false; }
    return context;
  };
  ctx.effect(() => {
    const releases = createTools(core, defineTool, contextOf).map(tool => ctx.tools.register(tool));
    return async () => { releases.forEach(release => release()); await core.dispose(); };
  });
  ctx.inject?.(['skills'], sctx => sctx.skills.register(skill));
  ctx.logger?.info?.(`Computer Use Fusion registered: backend=${provider.name}; 13 tools.`);
}
export default { name, inject, Config, apply };
