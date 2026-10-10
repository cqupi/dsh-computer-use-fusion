# DSH Computer Use Fusion

Download the ready-to-install `.tgz` from [Releases](https://github.com/cqupi/dsh-computer-use-fusion/releases/latest).
In DSH Desktop, open **Plugins → Add plugin**, enter the asset URL or the absolute
local `.tgz` path, install, then enable it. Do not extract the archive. Uninstall an
existing Desktop version before reinstalling. The package includes the Windows
backend and the compiled macOS universal helper; no checkout or build is required.

```powershell
dsh plugin --profile web add "https://github.com/cqupi/dsh-computer-use-fusion/releases/download/v0.2.0/cqupi-dsh-computer-use-fusion-0.2.0.tgz"
```

Maintainers: `npm run package` writes the installable archive, `SHA256SUMS`, and
Chinese installation instructions to `dist/`. CI also uploads these files as
the `dsh-installable-plugin` artifact after checking the installed package.

[中文](README.md) · [Validation](docs/VALIDATION.md) · [Attribution](THIRD_PARTY_NOTICES.md)

Version **0.2.0** adds a persistent JavaScript native-app API similar to Codex
Computer Use, with UIA/AX element targeting and real screenshot attachments.
MIT licensed; independent of OpenAI, DeepSeek and the upstream projects.

```text
dsh plugin --profile web add git+https://github.com/cqupi/dsh-computer-use-fusion.git
```

Use Node 24+ (minimum 22.19), DSH 0.2.0-rc.2. Host contracts also cover
0.2.1-alpha.2. Restart DSH and load `/dsh-computer-use-fusion`.

Call `fusion_computer` with JavaScript in its `code` parameter:

```javascript
await cua.getState();
let app = await cua.getApp({windowId: 123});
await app.getAXState();
```

Bindings persist between calls:

```javascript
await app.click(12);
await app.typeText('Hello');
await app.pressKey('ctrl+a');
await app.getAXStateAndScreenshot();
```

`computer` aliases `cua`. Also available: `getScreenshot`, `paste`, `setValue`,
`invoke`, `activate`, `scroll`, `drag`, `ocr`, `nodeRepl.write`, and 13 direct
`fusion_*` tools. Coordinate clicks use pixels in the last returned image.
Actions activate the selected window automatically. Observe after a batch to
inspect its effect. The native-app facade does not implement browser tabs or
Codex internals.

Removed from 0.1.0: plugin approvals, dangerous-label confirmation, app allowlist,
password input blocks, caller ownership checks, observation TTL, one-use IDs,
state-equality preflights, persistent stop/resume markers, cursor-corner stop,
and the Windows key block. Only the DSH tools service is required. Host policy
and operating-system permissions remain controlled by their respective systems.

Windows uses the real cursor and bundled persistent PowerShell UIA. macOS uses
a modified, rebuilt universal AX helper. `backend:cua` uses a separately
installed cua-driver and its virtual cursor. Native macOS GUI and actual
cua-driver sessions have not been verified here.

The JavaScript worker supports top-level await and persistent variables. Host
cancellation terminates it; the next call creates a new session. It is not a
security sandbox. Screenshots pass through the host attachment/model route;
there is no separate model API key or control HTTP server.

Run `node scripts/validate.mjs`. See the full Chinese README for the API table,
configuration, source attribution and validation scope.
