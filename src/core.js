import { createHash, randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { attachScreenshot, imagePoint } from './vision.js';

export const stopFile = () => process.env.DSH_FUSION_STOP_FILE || join(tmpdir(), 'dsh-computer-use-fusion.stop');
export const dangerous = label => /删除|移除|清空|格式化|支付|付款|购买|下单|转账|汇款|提交订单|永久|delete|erase|format|pay\b|purchase|buy\b|transfer|checkout/i.test(label ?? '');
export const password = element => element?.password === true || element?.native?.isPassword === true
  || /SecureTextField|PasswordField|password/i.test(`${element?.role ?? ''} ${element?.native?.subrole ?? ''}`);
const clean = value => JSON.parse(JSON.stringify(value));
export function fingerprint(raw) {
  return createHash('sha256').update(JSON.stringify({ target: raw.target, frame: raw.frame,
    elements: raw.elements.map(({ native, ...e }) => {
      if (raw.coordinateSystem === 'cua-local') delete e.ref;
      return e;
    }) })).digest('hex');
}

export class FusionCore {
  constructor(provider, config = {}, services = {}) {
    this.provider = provider;
    this.config = { ttlMs: 30000, maxNodes: 250, vision: true, requireControlApproval: true, allowedApps: [], settleMs: 100, ...config };
    this.services = services;
    this.observations = new Map();
    this.grants = new Map();
    this.denials = new Set();
    this.tail = Promise.resolve();
    this.lifecycle = new AbortController();
  }
  // Serialize the entire desktop transaction, including approval and revalidation.
  serial(task) { const next = this.tail.catch(() => {}).then(task); this.tail = next; return next; }
  assertRunning(signal) {
    signal?.throwIfAborted();
    if (this.stopped || existsSync(stopFile())) {
      this.observations.clear(); this.grants.clear();
      throw new Error('USER_STOPPED: user must run doctor --resume before continuing');
    }
  }
  assertScope(target) {
    const allowed = this.config.allowedApps;
    if (allowed.length && !allowed.includes(target.appId) && !allowed.includes(target.name)) throw new Error('APP_SCOPE_DENIED');
  }
  async approve(context, reason) {
    if (!this.services.approve) throw new Error('APPROVAL_UNAVAILABLE');
    if (await this.services.approve(context, reason) !== 'allowed-once') throw new Error('APPROVAL_DENIED');
  }
  async control(context, target) {
    const key = JSON.stringify([context.owner, context.turn ?? context.callId, target.appId, target.id]);
    if (this.denials.has(key)) throw new Error('CONTROL_DENIED_THIS_TURN');
    if (!this.config.requireControlApproval || this.grants.has(key)) return;
    try { await this.approve(context, `Allow desktop control of ${target.name} (pid=${target.pid}, window=${target.id}) for this turn?`); }
    catch (error) { this.denials.add(key); throw error; }
    this.grants.set(key, true);
    if (this.grants.size > 256) this.grants.delete(this.grants.keys().next().value);
    if (this.denials.size > 256) this.denials.delete(this.denials.values().next().value);
  }
  lifetime(context) { return { ...context, signal: context.signal
    ? AbortSignal.any([context.signal, this.lifecycle.signal]) : this.lifecycle.signal }; }
  observe(selector, context = {}) { context = this.lifetime(context); return this.serial(async () => {
    this.assertRunning(context.signal);
    if (!context.owner) throw new Error('CALLER_IDENTITY_REQUIRED');
    const target = await this.provider.resolve(selector, context.signal);
    this.assertScope(target);
    return this.capture(target, selector.screenshot === true, context);
  }); }
  async capture(target, screenshot, context) {
    const raw = await this.provider.observe(target, screenshot, context.signal);
    const createdAt = Date.now();
    this.assertRunning(context.signal);
    const vision = await attachScreenshot(raw.screenshot, { ...context, vision: this.config.vision,
      visionMaxPixels: this.config.visionMaxPixels ?? 640000 });
    const observationId = randomUUID();
    // Only one live snapshot per caller: previous IDs cannot silently retarget.
    for (const [id, item] of this.observations) if (item.owner === context.owner || item.expiresAt < createdAt) this.observations.delete(id);
    const elements = raw.elements.map((e, index) => ({ ...e, index, handle: randomUUID() }));
    const snapshot = { observationId, owner: context.owner, target: raw.target, raw: { ...raw, elements },
      hash: fingerprint(raw), createdAt, expiresAt: createdAt + this.config.ttlMs, mapping: vision.mapping };
    this.observations.set(observationId, snapshot);
    if (this.observations.size > 128) this.observations.delete(this.observations.keys().next().value);
    return clean({ ok: true, observationId, provider: this.provider.name, target: raw.target, frame: raw.frame,
      createdAt, expiresAt: snapshot.expiresAt, truncated: raw.truncated,
      elements: elements.map(({ native, ...e }) => e), ...vision });
  }
  getObservation(id, context) {
    const observed = this.observations.get(id);
    if (!observed || observed.owner !== context.owner) throw new Error('OBSERVATION_MISSING_OR_WRONG_CALLER');
    if (Date.now() >= observed.expiresAt) { this.observations.delete(id); throw new Error('OBSERVATION_EXPIRED'); }
    return observed;
  }
  action(request, context = {}) { context = this.lifetime(context); return this.serial(async () => {
    this.assertRunning(context.signal);
    const observed = this.getObservation(request.observationId, context);
    this.assertScope(observed.target);
    const action = { ...request };
    if (!['click', 'type', 'key', 'set_value', 'invoke', 'scroll', 'drag', 'activate'].includes(action.kind)) throw new Error('INVALID_ACTION_KIND');
    if (action.count !== undefined && ![1, 2].includes(action.count)) throw new Error('INVALID_CLICK_COUNT');
    if (action.amount !== undefined && (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > 20)) throw new Error('INVALID_SCROLL_AMOUNT');
    if (['type', 'set_value'].includes(action.kind) && (typeof action.text !== 'string' || action.text.length > 100000)) throw new Error('INVALID_TEXT');
    if (action.kind === 'key' && (!Array.isArray(action.keys) || !action.keys.length || action.keys.length > 6 || !action.keys.every(k => typeof k === 'string' && k.length > 0 && k.length < 40))) throw new Error('INVALID_KEY_CHORD');
    const target = observed.target;
    let element;
    if (action.element !== undefined || action.handle !== undefined) {
      element = action.handle !== undefined ? observed.raw.elements.find(e => e.handle === action.handle)
        : observed.raw.elements[action.element];
      if (!element) throw new Error('ELEMENT_NOT_IN_OBSERVATION');
      if (action.handle !== undefined && action.element !== undefined && element.index !== action.element) throw new Error('CONFLICTING_TARGET');
      if (element.enabled === false) throw new Error('ELEMENT_DISABLED');
    }
    if (action.x !== undefined || action.y !== undefined) {
      if (element) throw new Error('CONFLICTING_TARGET');
      action.point = imagePoint(observed.mapping, action.x, action.y);
      const hit = observed.raw.elements.filter(e => e.frame && action.point.x >= e.frame.x && action.point.y >= e.frame.y
        && action.point.x < e.frame.x + e.frame.width && action.point.y < e.frame.y + e.frame.height)
        .sort((a, b) => a.frame.width * a.frame.height - b.frame.width * b.frame.height)[0];
      element = hit; // Safety classification only; preserve exact coordinate dispatch below.
    }
    if (action.kind === 'drag') action.to = imagePoint(observed.mapping, action.toX, action.toY);
    const focused = observed.raw.elements.find(e => e.focused);
    if (['type', 'key', 'set_value'].includes(action.kind) && password(element ?? focused)) throw new Error('PASSWORD_INPUT_BLOCKED');
    if (['invoke', 'set_value'].includes(action.kind) && !element) throw new Error('ELEMENT_REQUIRED');
    if (action.kind === 'click' && !element && !action.point) throw new Error('CLICK_TARGET_REQUIRED');
    if (action.kind === 'drag' && !action.point) throw new Error('DRAG_POINTS_REQUIRED');
    await this.control(context, target);
    if (action.sensitive || dangerous(element?.label)) {
      await this.approve(context, `Confirm this one action: ${action.kind} on ${element?.label || target.name}. Reason: ${action.reason || 'Potentially high-impact UI action'}`);
    }
    this.assertRunning(context.signal);
    this.getObservation(request.observationId, context); // Approval may outlive TTL.
    const fresh = await this.provider.observe(target, false, context.signal);
    if (fingerprint(fresh) !== observed.hash) {
      this.observations.delete(request.observationId);
      throw new Error('OBSERVED_STATE_CHANGED: observe again before acting');
    }
    this.assertRunning(context.signal);
    this.observations.delete(request.observationId); // one-use even if provider fails
    const liveElement = element ? fresh.elements[element.index] : undefined;
    const effect = await this.provider.act(target, action, action.point ? undefined : liveElement, context.signal, fresh);
    if (this.config.settleMs) await delay(this.config.settleMs, undefined, { signal: context.signal });
    try {
      const after = await this.capture(target, false, context);
      return { ok: true, effect: clean(effect), observation: after,
        observedStateChanged: this.observations.get(after.observationId).hash !== observed.hash };
    } catch (error) {
      return { ok: true, effect: clean(effect), observationWarning: `Input completed, post-observation unavailable: ${error.message}. Observe before further input.` };
    }
  }); }
  ocr(id, context) { context = this.lifetime(context); return this.serial(async () => {
    this.assertRunning(context.signal);
    const observed = this.getObservation(id, context);
    if (!this.provider.ocr) throw new Error('OCR_UNAVAILABLE_ON_THIS_BACKEND');
    this.assertScope(observed.target);
    return this.provider.ocr(observed.target, context.signal);
  }); }
  stop() { writeFileSync(stopFile(), 'Stopped by user or fusion_stop\n'); this.observations.clear(); this.grants.clear();
    this.provider.process?.reset(new Error('USER_STOPPED')); }
  async dispose() { this.stopped = true; this.lifecycle.abort(new Error('PLUGIN_DISPOSED')); this.observations.clear();
    await this.provider.dispose(); await this.tail.catch(() => {}); }
}
