const string = description => ({ type: 'string', description });
const integer = description => ({ type: 'integer', description });
const boolean = description => ({ type: 'boolean', description });
const bound = { observationId: { ...string('Exact ID from the latest fusion_observe or action result.'), required: true } };
const element = { element: integer('Observation-local element index; prefer semantic targeting.'), handle: string('Opaque element handle from this same observation.') };
const point = { x: { type: 'number', description: 'X in the returned image pixels, never original screen pixels.' },
  y: { type: 'number', description: 'Y in the returned image pixels.' } };
const consent = { foreground: boolean('Explicitly activate the exact window for this action. May move the real mouse on Windows.'),
  sensitive: boolean('True for consequential action requiring one-use human confirmation.'), reason: string('Human-readable impact of a sensitive action.') };

export function renderResult(_args, value) {
  const { image, ...text } = value;
  const blocks = [{ type: 'text', text: JSON.stringify(text) }];
  if (image) blocks.push({ type: 'image', attachment: image });
  return blocks;
}

export function createTools(core, defineTool, contextOf) {
  const make = (name, description, parameters, run) => defineTool({ name, description, parameters,
    output: { schema: { type: 'json' }, render: renderResult },
    execute: async (args, exec) => run(args, await contextOf(exec)) });
  const action = (kind, args, context) => core.action({ ...args, kind }, context);
  return [
    make('fusion_health', 'Diagnose the selected local desktop backend; sends no input.', {}, (_args, c) => core.serial(() => core.provider.health(c.signal))),
    make('fusion_list_windows', 'List native windows/apps with exact process and window IDs. Resolve ambiguity before observation.', {}, (_args, c) => core.serial(async () => ({ windows: await core.provider.list(c.signal) }))),
    make('fusion_observe', 'Observe one exact window: bounded Accessibility/UIA tree, local element handles and optional real image. Every input consumes the ID and returns fresh state. Read the dsh-computer-use-fusion skill.', {
      pid: integer('Exact process ID.'), windowId: integer('Exact window ID from fusion_list_windows.'), name: string('Unique window-title substring on Windows; application name on macOS.'),
      bundleId: string('Exact macOS bundle identifier.'), screenshot: boolean('Request selected-window screenshot and coordinate mapping; needed before coordinate input.') },
    (args, c) => core.observe(args, c)),
    make('fusion_click', 'Click an observed element, or image pixel. Semantic/background input is the default. Set foreground=true explicitly for global Windows input. Dangerous labels request confirmation.',
      { ...bound, ...element, ...point, ...consent, button: { type: 'string', enum: ['left', 'right', 'middle'] }, count: integer('1 or 2.') }, (a, c) => action('click', a, c)),
    make('fusion_type', 'Type text into the target window. Background delivery may be unverified; use fusion_set_value for an exact editable element. Password input is blocked. No automatic foreground retry.',
      { ...bound, ...consent, text: { ...string('Unicode text.'), required: true } }, (a, c) => action('type', a, c)),
    make('fusion_key', 'Press a chord in the observed target window. Windows requires foreground=true; focus is checked by the backend.',
      { ...bound, ...consent, keys: { type: 'array', items: { type: 'string' }, required: true, description: 'Modifiers then key, e.g. ["control","a"].' } }, (a, c) => action('key', a, c)),
    make('fusion_scroll', 'Scroll in the observed window; use an element or image point. Windows requires foreground=true.',
      { ...bound, ...element, ...point, ...consent, direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], required: true }, amount: integer('1 to 20 wheel ticks (macOS pages).') }, (a, c) => action('scroll', a, c)),
    make('fusion_drag', 'Drag between two points in the exact observed image. Windows requires foreground=true.',
      { ...bound, ...point, ...consent, toX: { type: 'number', required: true }, toY: { type: 'number', required: true } }, (a, c) => action('drag', a, c)),
    make('fusion_set_value', 'Set one editable observed UIA/AX element value semantically. No keyboard fallback. Password controls are blocked.',
      { ...bound, ...element, ...consent, text: { type: 'string', required: true } }, (a, c) => action('set_value', a, c)),
    make('fusion_invoke', 'Invoke an advertised native semantic action on an observed element, with no coordinate fallback.',
      { ...bound, ...element, ...consent }, (a, c) => action('invoke', a, c)),
    make('fusion_activate', 'Explicitly bring the exact observed Windows window forward; returns fresh evidence.',
      { ...bound, ...consent }, (a, c) => action('activate', { ...a, foreground: true }, c)),
    make('fusion_ocr', 'Run local Windows OCR on the exact observed window. Returns screen-space OCR boxes as evidence; coordinate input still uses the screenshot image mapping.', bound,
      (a, c) => core.ocr(a.observationId, c)),
    make('fusion_stop', 'Stop desktop control immediately. Only the human can resume through node scripts/doctor.mjs --resume. This tool cannot clear the stop marker.', {}, async () => {
      core.stop(); return { stopped: true };
    }),
  ];
}
