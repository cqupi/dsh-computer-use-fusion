import { fileURLToPath } from 'node:url';
import { LineProcess } from '../process.js';
import { pngSize } from '../vision.js';

const backendPath = fileURLToPath(new URL('../../native/windows/windows-uia.ps1', import.meta.url));
export class WindowsProvider {
  name = 'windows-uia';
  constructor(config = {}) {
    this.config = config;
    this.process = new LineProcess(process.env.WINDOWS_CU_POWERSHELL || 'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', backendPath, '-Persistent']);
  }
  async call(action, args, signal) {
    const value = await this.process.call(action, args, signal, this.config.timeoutMs ?? 30000);
    if (value.ok !== true) throw new Error(`WINDOWS_BACKEND: ${value.error || 'unknown failure'}`);
    delete value.id;
    return value;
  }
  health(signal) { return this.call('health', {}, signal); }
  async list(signal) { return (await this.call('list_windows', {}, signal)).windows; }
  selector(target) { return { processId: target.pid, nativeWindowHandle: target.id, detailLevel: 'full' }; }
  async resolve(selector = {}, signal) {
    const windows = await this.list(signal);
    const candidates = windows.filter(w => (!selector.pid || w.processId === selector.pid)
      && (!selector.windowId || String(w.nativeWindowHandle) === String(selector.windowId))
      && (!selector.name || (w.name || w.title || '').toLowerCase().includes(selector.name.toLowerCase())));
    let w;
    if (selector.pid || selector.windowId || selector.name) {
      w = candidates.find(item => item.hasKeyboardFocus) ?? candidates[0];
      if (!w) throw new Error('WINDOW_NOT_FOUND');
    } else {
      const active = (await this.health(signal)).activeWindow;
      w = windows.find(item => String(item.nativeWindowHandle) === String(active.nativeWindowHandle));
      if (!w) throw new Error('ACTIVE_WINDOW_UNAVAILABLE');
    }
    return { id: w.nativeWindowHandle, pid: w.processId, name: w.name || w.title, appId: `pid:${w.processId}` };
  }
  async observe(target, screenshot, signal) {
    const args = { ...this.selector(target), maxNodes: this.config.maxNodes ?? 250, maxDepth: 8,
      includeScreenshot: screenshot, captureWindow: true, maxWidth: 0 };
    let raw = await this.call('snapshot', args, signal);
    const elements = [];
    const visit = node => {
      if (!node) return;
      elements.push({ ref: node.id, role: node.controlType, label: node.name, value: node.value,
        enabled: node.isEnabled, focused: node.hasKeyboardFocus, password: node.isPassword, frame: node.boundingBox,
        actions: node.patterns ?? [], native: node });
      for (const child of node.children ?? []) visit(child);
    };
    visit(raw.tree);
    let shot;
    if (raw.screenshot) {
      if (raw.screenshot.windowCaptureFailed) throw new Error('TARGET_WINDOW_CAPTURE_FAILED');
      let data = Buffer.from(raw.screenshot.base64, 'base64');
      let size = pngSize(data);
      const budget = this.config.visionMaxPixels ?? 640000;
      if (size.width * size.height > budget) {
        const maxWidth = Math.max(1, Math.floor(size.width * Math.sqrt(budget / (size.width * size.height))));
        const resized = await this.call('snapshot', { ...args, maxWidth }, signal);
        if (resized.screenshot.windowCaptureFailed) throw new Error('TARGET_WINDOW_CAPTURE_FAILED');
        raw = resized;
        data = Buffer.from(raw.screenshot.base64, 'base64');
      }
      shot = { ...raw.screenshot, data };
      delete shot.base64;
    }
    elements.length = 0;
    visit(raw.tree);
    return { target, elements, frame: raw.tree.boundingBox, truncated: raw.truncated, screenshot: shot };
  }
  async act(target, action, element, signal) {
    const foreground = action.foreground !== false;
    const args = { ...this.selector(target), activate: foreground };
    if (element) args.elementId = element.ref;
    if (action.point) Object.assign(args, action.point);
    switch (action.kind) {
      case 'click': return this.call(action.count === 2 ? 'double_click' : 'click', {
        ...args, button: action.button ?? 'left', dispatch: foreground ? 'foreground' : 'background' }, signal);
      case 'type': return this.call('type_text', { ...args, text: action.text,
        method: foreground ? 'sendinput' : 'background', restoreClipboard: true }, signal);
      case 'key':
        return this.call('keypress', { ...args, activate: true, keys: action.keys }, signal);
      case 'set_value': return this.call('set_value', { ...args, value: action.text, fallbackType: true }, signal);
      case 'invoke': return this.call('invoke', { ...args, fallbackClick: true }, signal);
      case 'scroll':
        return this.call('scroll', { ...args, activate: true,
          deltaY: ['up', 'down'].includes(action.direction) ? (action.direction === 'down' ? 1 : -1) * 120 * (action.amount ?? 3) : 0,
          deltaX: ['left', 'right'].includes(action.direction) ? (action.direction === 'right' ? 1 : -1) * 120 * (action.amount ?? 3) : 0 }, signal);
      case 'drag':
        return this.call('drag', { ...args, activate: true, path: [action.point, action.to], durationMs: 500 }, signal);
      case 'activate': return this.call('activate_window', { ...args, activate: true }, signal);
      default: throw new Error('UNSUPPORTED_ACTION');
    }
  }
  ocr(target, signal) { return this.call('ocr', { ...this.selector(target), captureWindow: true }, signal); }
  dispose() { this.process.dispose(); }
}
