import { createHash } from 'node:crypto';
import { readFile, chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJson } from '../process.js';

const root = fileURLToPath(new URL('../../native/macos/', import.meta.url));
export class MacOSProvider {
  name = 'macos-ax';
  constructor(config = {}) { this.config = config; }
  async call(request, signal) {
    if (!this.prepared) {
      const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
      const binary = join(root, manifest.binary.path);
      const hash = createHash('sha256').update(await readFile(binary)).digest('hex');
      if (hash !== manifest.binary.sha256) throw new Error('MACOS_HELPER_INTEGRITY_MISMATCH');
      await chmod(binary, 0o755);
      this.prepared = binary;
    }
    const envelope = await runJson(this.prepared, [], { protocolVersion: 1, ...request }, signal, this.config.timeoutMs);
    if (!envelope.ok) throw new Error(`MACOS_BACKEND: ${envelope.error?.code}: ${envelope.error?.message}`);
    return envelope.value;
  }
  health(signal) { return this.call({ command: 'health' }, signal); }
  list(signal) { return this.call({ command: 'list-apps' }, signal); }
  async resolve(selector = {}, signal) {
    if (!selector.bundleId && !selector.pid && !selector.name) throw new Error('MACOS_SELECT_EXACT_APP: supply bundleId or pid');
    const app = await this.call({ command: 'resolve-app', selector }, signal);
    return { ...app, appId: app.bundleId };
  }
  async observe(target, screenshot, signal) {
    const dir = screenshot ? await mkdtemp(join(tmpdir(), 'dsh-fusion-')) : undefined;
    const raw = await this.call({ command: 'observe', app: target,
      options: { screenshot: screenshot ? 'required' : 'none', screenshotPath: dir ? join(dir, 'window.png') : undefined,
        maxNodes: this.config.maxNodes ?? 250, maxDepth: 12, maxTextBytes: 64000 } }, signal);
    return { target: { ...target, id: raw.window?.id }, frame: raw.window?.frame,
      elements: raw.elements.map(e => ({ ...e, ref: String(e.index), label: e.label || e.title, native: e })),
      stateHash: raw.stateHash, frontmost: raw.frontmost, truncated: raw.truncated,
      screenshot: raw.screenshot ? { ...raw.screenshot, bounds: raw.window.frame, method: 'native-window' } : undefined };
  }
  async act(target, action, element, signal, observed) {
    const point = action.point ?? {};
    const base = { coordinateSpace: 'screen', ...point };
    const nativeAction = {
      click: { ...base, kind: 'click', button: action.button ?? 'left', clickCount: action.count ?? 1, allowCoordinateFallback: true },
      type: { kind: 'type-text', text: action.text },
      key: { kind: 'press-key', key: action.keys?.at(-1), modifiers: action.keys?.slice(0, -1) },
      set_value: { kind: 'set-value', value: action.text },
      invoke: { kind: 'perform-action', action: element?.actions?.[0] },
      scroll: { ...base, kind: 'scroll', direction: action.direction, pages: action.amount ?? 1 },
      drag: { kind: 'drag', coordinateSpace: 'screen', fromX: point.x, fromY: point.y, toX: action.to?.x, toY: action.to?.y },
    }[action.kind];
    if (!nativeAction) throw new Error('UNSUPPORTED_ACTION_ON_MACOS');
    return this.call({ command: 'act', request: { app: target, action: nativeAction,
      expectedStateHash: observed.stateHash, element: element?.native,
      window: { id: target.id, frame: observed.frame }, actionTimeoutMs: this.config.timeoutMs ?? 30000,
      interaction: { focusPolicy: action.foreground ? 'activate' : 'preserve', keyboardPolicy: action.foreground ? 'activate' : 'preserve', pointerInputPolicy: 'targeted' },
      limits: { maxNodes: this.config.maxNodes ?? 250, maxDepth: 12, maxTextBytes: 64000 } } }, signal);
  }
  dispose() {}
}
