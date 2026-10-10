import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { attachScreenshot, imagePoint } from './vision.js';

const clean = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const windowKey = target => `${target.pid}:${target.id ?? target.bundleId}`;

export class FusionCore {
  constructor(provider, config = {}) {
    this.provider = provider;
    this.config = { maxNodes: 250, vision: true, settleMs: 100, screenshotAfterAction: true, ...config };
    this.observations = new Map();
    this.windows = new Map();
    this.current = new Map();
    this.tail = Promise.resolve();
    this.lifecycle = new AbortController();
  }
  // Native desktop operations share one physical desktop input queue.
  serial(task) { const next = this.tail.catch(() => {}).then(task); this.tail = next; return next; }
  lifetime(context = {}) { return { ...context, signal: context.signal
    ? AbortSignal.any([context.signal, this.lifecycle.signal]) : this.lifecycle.signal }; }
  remember(snapshot, context) {
    this.observations.set(snapshot.observationId, snapshot);
    this.windows.set(windowKey(snapshot.target), snapshot);
    this.current.set(context.owner ?? 'default', snapshot);
    // Keep compatibility IDs reusable; bounded history is just a memory cache.
    if (this.observations.size > 512) this.observations.delete(this.observations.keys().next().value);
  }
  async resolve(selector = {}, context = {}) {
    if (selector.target) return selector.target;
    const explicit = ['pid', 'windowId', 'name', 'bundleId'].some(key => selector[key] !== undefined);
    const previous = this.current.get(context.owner ?? 'default');
    return !explicit && previous ? previous.target : this.provider.resolve(selector, context.signal);
  }
  observe(selector = {}, context = {}) {
    context = this.lifetime(context);
    return this.serial(async () => {
      context.signal.throwIfAborted();
      const target = await this.resolve(selector, context);
      return this.capture(target, selector.screenshot ?? true, context);
    });
  }
  async capture(target, screenshot, context) {
    const raw = await this.provider.observe(target, screenshot, context.signal);
    const vision = await attachScreenshot(raw.screenshot, { ...context, vision: this.config.vision,
      visionMaxPixels: this.config.visionMaxPixels ?? 640000 });
    const elements = raw.elements.map((e, index) => ({ ...e, index, handle: e.ref ?? String(index) }));
    const previous = this.windows.get(windowKey(raw.target));
    const snapshot = { observationId: randomUUID(), target: raw.target, raw: { ...raw, elements },
      createdAt: Date.now(), mapping: vision.mapping ?? previous?.mapping };
    this.remember(snapshot, context);
    return clean({ ok: true, observationId: snapshot.observationId, provider: this.provider.name,
      target: raw.target, frame: raw.frame, createdAt: snapshot.createdAt, truncated: raw.truncated,
      elements: elements.map(({ native, ...e }) => e), ...vision });
  }
  async snapshot(request, context) {
    if (request.observationId && this.observations.has(request.observationId)) return this.observations.get(request.observationId);
    const target = await this.resolve(request, context);
    let snapshot = this.windows.get(windowKey(target));
    if (!snapshot) {
      const observed = await this.capture(target, request.x !== undefined || request.kind === 'drag', context);
      snapshot = this.observations.get(observed.observationId);
    }
    return snapshot;
  }
  action(request, context = {}) {
    context = this.lifetime(context);
    return this.serial(async () => {
      context.signal.throwIfAborted();
      let observed = await this.snapshot(request, context);
      const action = { foreground: true, ...request };
      if (!['click', 'type', 'key', 'set_value', 'invoke', 'scroll', 'drag', 'activate'].includes(action.kind)) throw new Error('UNSUPPORTED_ACTION');
      if (['type', 'set_value'].includes(action.kind) && typeof action.text !== 'string') throw new Error('TEXT_REQUIRED');
      if (action.kind === 'key' && (!Array.isArray(action.keys) || !action.keys.length)) throw new Error('KEY_CHORD_REQUIRED');
      let element;
      if (action.element !== undefined || action.handle !== undefined || action.ref !== undefined || action.elementName !== undefined) {
        const ref = action.handle ?? action.ref;
        const find = () => ref !== undefined ? observed.raw.elements.find(e => String(e.handle) === String(ref) || String(e.ref) === String(ref))
          : action.elementName !== undefined ? observed.raw.elements.find(e => e.label === action.elementName)
            : observed.raw.elements[action.element];
        element = find();
        if (!element) {
          const refreshed = await this.capture(observed.target, false, context);
          observed = this.observations.get(refreshed.observationId);
          element = find();
        }
        if (!element) throw new Error('ELEMENT_NOT_FOUND');
      }
      if (action.x !== undefined || action.y !== undefined || action.kind === 'drag') {
        if (!observed.mapping) {
          const visual = await this.capture(observed.target, true, context);
          observed = this.observations.get(visual.observationId);
        }
        action.point = imagePoint(observed.mapping, action.x, action.y);
      }
      if (action.kind === 'drag') action.to = imagePoint(observed.mapping, action.toX, action.toY);
      if (action.kind === 'scroll' && !action.point && !element && observed.raw.frame) {
        const frame = observed.raw.frame;
        action.point = { x: Math.round(frame.x + frame.width / 2), y: Math.round(frame.y + frame.height / 2) };
      }
      if (['invoke', 'set_value'].includes(action.kind) && !element) throw new Error('ELEMENT_REQUIRED');
      if (action.kind === 'click' && !element && !action.point) throw new Error('CLICK_TARGET_REQUIRED');
      const effect = await this.provider.act(observed.target, action, action.point ? undefined : element, context.signal, observed.raw);
      if (this.config.settleMs) await delay(this.config.settleMs, undefined, { signal: context.signal });
      if (request.observeAfter === false) return { ok: true, target: observed.target, effect: clean(effect) };
      try {
        const observation = await this.capture(observed.target, request.screenshot ?? this.config.screenshotAfterAction, context);
        return { ok: true, effect: clean(effect), observation };
      } catch (error) {
        return { ok: true, effect: clean(effect), observationWarning: `Input delivered; observation unavailable: ${error.message}` };
      }
    });
  }
  ocr(request = {}, context = {}) {
    context = this.lifetime(context);
    if (typeof request === 'string') request = { observationId: request };
    return this.serial(async () => {
      context.signal.throwIfAborted();
      if (!this.provider.ocr) throw new Error('OCR_UNAVAILABLE_ON_THIS_BACKEND');
      const observed = await this.snapshot(request, context);
      return this.provider.ocr(observed.target, context.signal);
    });
  }
  async dispose() {
    this.lifecycle.abort(new Error('PLUGIN_DISPOSED'));
    await this.provider.dispose(); await this.tail.catch(() => {});
    this.observations.clear(); this.current.clear(); this.windows.clear();
  }
}
