import { randomUUID } from 'node:crypto';
import { resolveBin, createCuaCall } from '../../vendor/cua/cua.js';
import { runJson } from '../process.js';

// Driver integration derived from 988hj7tczd-oss/dsh-computer-use.
// Each installation uses an isolated cursor session; no credential fallback.
export class CuaProvider {
  name = 'cua-driver';
  constructor(config = {}) {
    this.config = config;
    this.bin = resolveBin();
    this.session = `dsh-fusion-${randomUUID()}`;
    this.callRecovered = createCuaCall((tool, args) => runJson(this.bin,
      ['call', tool, JSON.stringify(args)], undefined, this.signal, config.timeoutMs), this.session);
  }
  async call(tool, args = {}, signal) {
    this.signal = signal;
    const result = await this.callRecovered(tool, { session: this.session, ...args });
    if (result?.isError || result?.ok === false || result?.error || ['refused', 'rejected', 'suspected_noop'].includes(result?.effect)) {
      throw new Error(`CUA_REFUSED: ${result.reason || result.error || result.effect}`);
    }
    return result;
  }
  async health(signal) { await this.call('start_session', {}, signal); return { ready: true, provider: this.name, virtualCursor: true }; }
  async list(signal) { return (await this.call('list_windows', { on_screen_only: true }, signal)).windows ?? []; }
  async resolve(selector = {}, signal) {
    const windows = await this.list(signal);
    const candidates = windows.filter(w => (!selector.pid || w.pid === selector.pid)
      && (!selector.windowId || String(w.window_id) === String(selector.windowId))
      && (!selector.name || `${w.title} ${w.app_name}`.toLowerCase().includes(selector.name.toLowerCase())));
    if (candidates.length !== 1) throw new Error('CUA_SELECT_EXACT_WINDOW: supply windowId from fusion_list_windows');
    const w = candidates[0];
    return { id: w.window_id, pid: w.pid, name: w.app_name, appId: w.bundle_id || `pid:${w.pid}` };
  }
  async observe(target, screenshot, signal) {
    const raw = await this.call('get_window_state', { pid: target.pid, window_id: target.id,
      include_screenshot: true, max_elements: this.config.maxNodes ?? 250 }, signal);
    const frame = { x: 0, y: 0, width: raw.screenshot_width || raw.window?.frame?.w,
      height: raw.screenshot_height || raw.window?.frame?.h };
    return { target, frame, coordinateSystem: 'cua-local', elements: (raw.elements ?? []).map(e => ({ ref: e.element_token,
      label: e.label || e.value, value: e.value, role: e.role, focused: e.focused,
      frame: e.frame ? { x: e.frame.x, y: e.frame.y, width: e.frame.w, height: e.frame.h } : undefined,
      actions: e.actions ?? [], native: e })),
      screenshot: screenshot && raw.screenshot_png_b64 ? { data: Buffer.from(raw.screenshot_png_b64, 'base64'),
        bounds: frame, method: 'cua-window-local' } : undefined };
  }
  act(target, action, element, signal) {
    const args = { pid: target.pid, window_id: target.id, ...(element ? { element_token: element.ref } : action.point),
      delivery_mode: action.foreground ? 'foreground' : 'background' };
    switch (action.kind) {
      case 'click': return this.call(action.count === 2 ? 'double_click' : action.button === 'right' ? 'right_click' : 'click', args, signal);
      case 'type': return this.call('type_text', { ...args, text: action.text }, signal);
      case 'key': return this.call('press_key', { ...args, key: action.keys.join('+') }, signal);
      case 'scroll': return this.call('scroll', { ...args, direction: action.direction, amount: action.amount ?? 3 }, signal);
      case 'drag': return this.call('drag', { ...args, from_x: action.point.x, from_y: action.point.y,
        to_x: action.to.x, to_y: action.to.y, duration_ms: 500 }, signal);
      default: throw new Error('UNSUPPORTED_ACTION_ON_CUA');
    }
  }
  async dispose() { await this.call('end_session').catch(() => {}); }
}
