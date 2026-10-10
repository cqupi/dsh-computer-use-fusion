import { ComputerRepl } from './repl.js';

const string = description => ({ type: 'string', description });
const integer = description => ({ type: 'integer', description });
const boolean = description => ({ type: 'boolean', description });
const selector = { pid: integer('Process ID.'), windowId: integer('Window ID from fusion_list_windows.'),
  name: string('Window title or app name.'), bundleId: string('macOS bundle identifier.') };
const bound = { ...selector, observationId: string('Optional compatibility ID. Usually omit: the current window is remembered.') };
const element = { element: integer('Element index from the latest state.'), handle: string('Native element handle.'),
  ref: string('Native element ref; alias for handle.'), elementName: string('Exact accessible element name.') };
const point = { x: { type: 'number', description: 'X in the most recently returned image pixels.' },
  y: { type: 'number', description: 'Y in the most recently returned image pixels.' } };
const options = { foreground: boolean('Defaults to true. Set false only when background input is desired.'),
  screenshot: boolean('Return an image after the action; default from screenshotAfterAction.'),
  observeAfter: boolean('Defaults to true. Set false to batch actions and observe at the end.') };

export function renderResult(_args, value) {
  const images = new Map();
  const visit = item => {
    if (!item || typeof item !== 'object') return item;
    if (Array.isArray(item)) return item.map(visit);
    return Object.fromEntries(Object.entries(item).filter(([key, entry]) => {
      if (key !== 'image' || !entry) return true;
      images.set(entry.attachmentId ?? JSON.stringify(entry), entry); return false;
    }).map(([key, entry]) => [key, visit(entry)]));
  };
  const text = visit(value);
  return [{ type: 'text', text: JSON.stringify(text) }, ...[...images.values()].map(attachment => ({ type: 'image', attachment }))];
}

export function createTools(core, defineTool, contextOf, repl = new ComputerRepl(core)) {
  const make = (name, description, parameters, run) => defineTool({ name, description, parameters,
    output: { schema: { type: 'json' }, render: renderResult },
    execute: async (args, exec) => run(args, await contextOf(exec)) });
  const action = (kind, args, context) => core.action({ ...args, kind }, context);
  const tools = [
    make('fusion_computer', 'Codex-style persistent JavaScript computer use. cua/computer and nodeRepl are preloaded. Keep app bindings across calls; use await cua.getState(), let app=await cua.getApp({windowId}), await app.click(index), typeText, pressKey, getAXState and getScreenshot. Multiple awaited actions per call; no approvals, observation IDs or expiry. Read the dsh-computer-use-fusion skill for the API.',
      { code: { ...string('JavaScript with top-level await. Variables persist within this agent.'), required: true } }, (a, c) => repl.execute(a.code, c)),
    make('fusion_health', 'Diagnose the local desktop backend.', {}, (_a, c) => core.serial(() => core.provider.health(c.signal))),
    make('fusion_list_windows', 'List native windows/apps with process and window IDs.', {}, (_a, c) => core.serial(async () => ({ windows: await core.provider.list(c.signal) }))),
    make('fusion_observe', 'Observe a window or the remembered current window. Returns numbered elements and, by default, a real image. IDs are informational and reusable.',
      { ...selector, screenshot: boolean('Include screenshot, default true.') }, (a, c) => core.observe(a, c)),
    make('fusion_screenshot', 'Return the current or selected window as a real image with exact coordinate mapping.', selector, (a, c) => core.observe({ ...a, screenshot: true }, c)),
    make('fusion_click', 'Click an element index/ref/name or image pixel. The current target is remembered; activation is automatic.',
      { ...bound, ...element, ...point, ...options, button: { type: 'string', enum: ['left', 'right', 'middle'] }, count: integer('Click count, usually 1 or 2.') }, (a, c) => action('click', a, c)),
    make('fusion_type', 'Type Unicode text into the current target, including password controls. Activation is automatic.',
      { ...bound, ...options, text: { ...string('Unicode text.'), required: true } }, (a, c) => action('type', a, c)),
    make('fusion_key', 'Press a key or chord in the current window; activation is automatic.',
      { ...bound, ...options, keys: { type: 'array', items: { type: 'string' }, required: true, description: 'Modifiers then key, e.g. ["control","a"].' } }, (a, c) => action('key', a, c)),
    make('fusion_scroll', 'Scroll the current window at an element or image point, or its center.',
      { ...bound, ...element, ...point, ...options, direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], required: true }, amount: integer('Wheel ticks (macOS pages), default 3.') }, (a, c) => action('scroll', a, c)),
    make('fusion_drag', 'Drag between two image-pixel points. Activation is automatic.',
      { ...bound, ...point, ...options, toX: { type: 'number', required: true }, toY: { type: 'number', required: true } }, (a, c) => action('drag', a, c)),
    make('fusion_set_value', 'Set an editable element value. Falls back to focused typing when the native pattern is unavailable.',
      { ...bound, ...element, ...options, text: { type: 'string', required: true } }, (a, c) => action('set_value', a, c)),
    make('fusion_invoke', 'Invoke a native element action, falling back to a click when necessary.',
      { ...bound, ...element, ...options }, (a, c) => action('invoke', a, c)),
    make('fusion_activate', 'Bring the current or selected window forward.', { ...bound, ...options }, (a, c) => action('activate', a, c)),
    make('fusion_ocr', 'Run local Windows OCR on the current or selected window.', bound, (a, c) => core.ocr(a, c)),
  ];
  tools.dispose = () => repl.dispose();
  return tools;
}
