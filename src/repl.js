import { Worker } from 'node:worker_threads';

export const computerDocumentation = `Computer Use Fusion: persistent JavaScript
Preloaded: cua (alias computer), nodeRepl.write(value), nodeRepl.emitImage(screenshot).
await cua.getState(); await cua.listWindows(); await cua.listApps();
let app = await cua.getApp({windowId: 123}); // or {pid: 123}, or a title string
await app.getAXState(); // numbered accessibility tree, automatically displayed
await app.getScreenshot(); // real image and mapping, automatically displayed
await app.getAXStateAndScreenshot();
await app.click(12); await app.click([x,y], {mouseButton:'right', clickCount:2});
await app.typeText('hello'); await app.paste('hello'); await app.pressKey('ctrl+a');
await app.setValue(12, 'hello'); await app.invoke(12); await app.activate();
await app.scroll(12, 'down', 3); await app.scroll([x,y], 'down', {pixels:360});
await app.drag([x1,y1], [x2,y2]); await app.ocr();
Bindings persist between fusion_computer calls. Operations activate the bound window by default.
Coordinates refer to the last returned image. Missing mapping is captured automatically.
Batch awaited actions, then getAXState()/getScreenshot() to inspect the result.
No plugin approval, one-use observation ID, TTL, allowlist, password block or stop marker.
This implements a native-app API similar to Codex; it does not implement browser tabs or Codex internals.`;

const json = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const targetOf = value => Array.isArray(value) ? { x: value[0], y: value[1] }
  : typeof value === 'number' ? { element: value }
    : typeof value === 'string' ? { elementName: value } : value ?? {};
const keyAliases = { ctrl: 'control', cmd: 'command', meta: 'command', super: 'command', option: 'alt',
  return: 'enter', esc: 'escape', prior: 'pageup', next: 'pagedown' };
const keysOf = value => (Array.isArray(value) ? value : String(value).split('+'))
  .map(key => keyAliases[key.toLowerCase()] ?? key.toLowerCase());

class ReplSession {
  constructor(core) {
    this.core = core; this.apps = new Map(); this.nextApp = 0; this.tail = Promise.resolve(); this.outputs = [];
    this.worker = new Worker(new URL('./repl-worker.js', import.meta.url));
    this.worker.on('message', message => {
      if (message.type === 'rpc') {
        Promise.resolve().then(() => this.call(message.method, message.args)).then(value => {
          this.worker.postMessage({ type: 'rpc-result', id: message.id, value: json(value) });
        }, error => { this.worker.postMessage({ type: 'rpc-result', id: message.id, error: error.message }); });
      } else if (message.type === 'output') this.outputs.push(message.value);
      else if (message.type === 'done') this.finish?.(message);
    });
    this.worker.on('error', error => this.fail?.(error));
    this.worker.on('exit', code => { this.closed = true; this.fail?.(new Error(`Computer JavaScript worker exited (${code}); the next call creates a new session.`)); });
  }
  emit(value) { this.outputs.push(json(value)); return value; }
  async call(method, args = []) {
    const core = this.core, context = this.context;
    context.signal?.throwIfAborted();
    if (method === 'getState' || method === 'listWindows' || method === 'listApps') {
      const windows = await core.serial(() => core.provider.list(context.signal));
      const apps = [...new Map(windows.map(w => {
        const pid = w.processId ?? w.pid;
        return [pid, { id: w.bundleId ?? w.bundle_id ?? `pid:${pid}`, pid, displayName: w.app_name ?? w.name ?? w.title,
          windows: windows.filter(item => (item.processId ?? item.pid) === pid) }];
      })).values()];
      return this.emit(method === 'getState' ? { apps, windows } : method === 'listApps' ? apps : windows);
    }
    if (method === 'getApp') {
      let selector = args[0] ?? {};
      if (typeof selector === 'string') selector = selector.startsWith('pid:') ? { pid: Number(selector.slice(4)) } : { name: selector };
      const target = await core.serial(() => core.provider.resolve(selector, context.signal));
      const appId = ++this.nextApp;
      this.apps.set(appId, target);
      const state = await core.observe({ target, screenshot: false }, context);
      this.emit({ state: formatState(state) });
      return { appId, target };
    }
    const [appId, ...params] = args;
    const target = this.apps.get(appId);
    if (!target) throw new Error('APP_BINDING_NOT_FOUND: call cua.getApp() again');
    if (method === 'getAXState' || method === 'getScreenshot' || method === 'getAXStateAndScreenshot') {
      const observation = await core.observe({ target, screenshot: method !== 'getAXState' }, context);
      if (method === 'getAXState') return this.emit(formatState(observation));
      const result = method === 'getScreenshot'
        ? { target: observation.target, screenshot: observation.screenshot, mapping: observation.mapping, image: observation.image, imageWarning: observation.imageWarning }
        : { state: formatState(observation), ...observation };
      return this.emit(result);
    }
    if (method === 'ocr') return this.emit(await core.ocr({ target }, context));
    let action;
    const options = params[1] ?? {};
    switch (method) {
      case 'click': action = { kind: 'click', ...targetOf(params[0]), button: options.mouseButton ?? options.button ?? 'left', count: options.clickCount ?? options.count ?? 1,
        foreground: options.foreground ?? true }; break;
      case 'typeText': case 'paste': action = { kind: 'type', text: params[0] }; break;
      case 'pressKey': action = { kind: 'key', keys: keysOf(params[0]) }; break;
      case 'setValue': action = { kind: 'set_value', ...targetOf(params[0]), text: params[1] }; break;
      case 'invoke': action = { kind: 'invoke', ...targetOf(params[0]) }; break;
      case 'activate': action = { kind: 'activate' }; break;
      case 'scroll': action = { kind: 'scroll', ...targetOf(params[0]), direction: params[1],
        amount: typeof params[2] === 'object' ? Math.max(1, Math.round(params[2].pixels / 120)) : params[2] ?? 3 }; break;
      case 'drag': action = { kind: 'drag', ...targetOf(params[0]), toX: params[1]?.[0], toY: params[1]?.[1] }; break;
      default: throw new Error(`UNKNOWN_COMPUTER_METHOD: ${method}`);
    }
    if (action.button) action.button = ({ l: 'left', r: 'right', m: 'middle' })[action.button] ?? action.button;
    return this.emit(await core.action({ target, ...action, observeAfter: false }, context));
  }
  execute(code, context) {
    const run = async () => {
      if (this.closed) throw new Error('REPL_SESSION_CLOSED');
      this.context = context; this.outputs = [];
      if (!this.documented) { this.emit({ documentation: computerDocumentation }); this.documented = true; }
      const timeoutMs = Math.max(120000, this.core.config.timeoutMs ?? 30000);
      return new Promise((resolve, reject) => {
        const cleanup = () => { clearTimeout(timer); context.signal?.removeEventListener('abort', abort); this.finish = this.fail = undefined; };
        const abort = () => { cleanup(); this.closed = true; void this.worker.terminate(); reject(context.signal?.reason ?? new Error('Computer JavaScript cancelled')); };
        const timer = setTimeout(() => { cleanup(); this.closed = true; void this.worker.terminate(); reject(new Error('Computer JavaScript timed out; its bindings were reset.')); }, timeoutMs);
        this.finish = message => { cleanup(); resolve({ ok: !message.error, outputs: this.outputs,
          ...(message.error ? { error: message.error } : message.value !== undefined ? { value: message.value } : {}) }); };
        this.fail = error => { cleanup(); reject(error); };
        if (context.signal?.aborted) { abort(); return; }
        context.signal?.addEventListener('abort', abort, { once: true });
        this.worker.postMessage({ type: 'eval', code });
      });
    };
    const next = this.tail.catch(() => {}).then(run); this.tail = next; return next;
  }
  async dispose() { this.closed = true; await this.worker.terminate(); }
}

export function formatState(observation) {
  const lines = [`Window ${observation.target.id ?? observation.target.bundleId}: ${observation.target.name} (pid ${observation.target.pid})`];
  for (const e of observation.elements) {
    const frame = e.frame ? ` @ [${e.frame.x}, ${e.frame.y}, ${e.frame.width}, ${e.frame.height}]` : '';
    lines.push(`${e.index} ${e.role ?? 'Element'} ${JSON.stringify(e.label ?? '')}${e.value != null ? ` value=${JSON.stringify(e.value)}` : ''}${e.focused ? ' [focused]' : ''}${frame}`);
  }
  if (observation.truncated) lines.push('(tree truncated; increase maxNodes to see more)');
  return lines.join('\n');
}

export class ComputerRepl {
  constructor(core) { this.core = core; this.sessions = new Map(); }
  execute(code, context = {}) {
    const key = context.owner ?? 'default';
    let session = this.sessions.get(key);
    if (!session || session.closed) { session = new ReplSession(this.core); this.sessions.set(key, session); }
    return session.execute(code, context);
  }
  async dispose() { await Promise.all([...this.sessions.values()].map(session => session.dispose())); this.sessions.clear(); }
}
