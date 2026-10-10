# Computer Use Fusion

Prefer `fusion_computer` for desktop work. It is a persistent JavaScript tool:
send code with top-level await; keep app bindings and variables between calls.
`cua`, its alias `computer`, and `nodeRepl` are already available.

```javascript
await cua.getState();
let app = await cua.getApp({windowId: 123});
await app.getAXState();
```

`getState` lists apps/windows. `listWindows` and `listApps` return each inventory.
`getApp` accepts `{windowId}`, `{pid}`, `{bundleId}`, a window/app title string,
or no selector for the active app. It automatically displays the initial tree.

## App methods

```javascript
await app.getAXState();
await app.getScreenshot();
await app.getAXStateAndScreenshot();
await app.click(12);
await app.click('Accessible name');
await app.click([200, 150], {mouseButton: 'right', clickCount: 1});
await app.typeText('Hello');
await app.paste('Hello');
await app.pressKey('ctrl+a');
await app.setValue(12, 'Hello');
await app.invoke(12);
await app.activate();
await app.scroll(12, 'down', 3);
await app.scroll([200, 150], 'down', {pixels: 360});
await app.scroll(undefined, 'down', 3);
await app.drag([100, 100], [300, 200]);
await app.ocr();
nodeRepl.write({anything: 'to inspect'});
```

States and images display automatically. `paste` aliases Unicode typing; it does
not require clipboard access. Windows uses a real pointer for coordinate input.
The optional cua-driver backend supplies a virtual cursor. This facade operates
native apps; use the browser's own tools for browser tabs.

Batch awaited actions in one call, then retrieve state or a screenshot to see
what happened. App objects remain usable across turns. Screenshot coordinates
are in the most recent returned image's pixels, including host resizing; no
manual screen scaling. A tree-only refresh preserves the last image mapping.
Refresh the image after a window resize. Missing image mapping is captured
automatically. No observation ID is required.

The plugin has no custom approval, dangerous-word check, password-input block,
app allowlist, observation expiry, state-equality preflight or stop/resume file.
Actions activate the bound window automatically. OS errors are reported as-is.
The DSH host's own policy is separate from this plugin.

JavaScript errors return completed outputs and an error; previous bindings can
usually be reused. Await native calls so their results/errors belong to this
execution. Host cancellation or a JS timeout terminates the worker and resets
bindings; the next call starts fresh, with no manual resume step.

Direct `fusion_*` tools remain available. `fusion_observe` defaults to images;
actions remember its window and return new state/images. Use `observeAfter:false`
for batching. Legacy observation IDs are optional and reusable.
