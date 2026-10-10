# Validation — 0.2.0, 2026-10-10 (Asia/Hong_Kong)

DSH default/next is 0.2.0-rc.2; alpha is 0.2.1-alpha.2. Validation uses Node
24.19.0 on Windows and Node 24 in hosted Linux/macOS/Windows jobs. The local
system Node 22.17.1 is below the required 22.19 and was not changed.

## Reproducible checks

```text
node scripts/validate.mjs
node scripts/host-smoke.mjs .compat/alpha
```

- Syntax, all 14 tool schemas, bundle identity, Swift source and binary hashes.
- 19 deterministic tests: persistent app/variable bindings, batched actions
  without forced observations, reusable compatibility IDs after UI changes,
  absence of approval/password/scope gates, image mapping and host resizing,
  real PNG resizing, adapter payloads and process cancellation.
- REPL tests exercise a rejected await and continued variable use, nested real
  image blocks, and host cancellation of an infinite JS loop followed by a
  fresh worker. Node's REPL runtime-error path is covered explicitly.
- Real Cordis, DSH ToolRuntime and Skills on rc.2 and alpha.2: actual plugin
  load/unload, all 14 schemas and JavaScript/image dispatch. No approval service
  is provided to the plugin in this test.
- Dedicated Windows WinForms fixture: window discovery/capture, image budget,
  semantic Unicode write/readback, button effect, password test-control write,
  reusable observations after external UI changes, and persistent JS batching.
  Foreground mouse/keyboard readback is tested locally; hosted CI skips that
  interactive-desktop-dependent portion.
- Hosted macOS rebuild of the modified Swift helper for arm64 and x86_64,
  followed by ad-hoc signing and generated source/binary manifest. The rebuilt
  helper and manifest are retained as a CI artifact for release packaging.
  A native health call through the real Node provider verifies executable startup
  without the former managed-parent/process-group gate; it needs no GUI permission.
  The published universal helper was retrieved from that build and its artifact
  digest, Swift source hash and binary hash were checked before packaging.

## Installation and previous validation

The 0.2.0 release tarball was installed with the real DSH CLI into fresh isolated
Web and Headless profiles. Both composed the bundle patch and passed all 14 tool
lifecycle/dispatch checks against the installed copy, including persistent JS
and real image output. Installed native helpers and JavaScript entry points were
compared byte-for-byte with the packaged inputs. Headless config/schema loading
also passed. The Web `--dump-config-schema` command reports four Loader-carrier
errors in DSH's own template; a fresh Web profile without Fusion reproduces the
same errors. Web installation and composed config loading passed.

`npm run package` runs the prepack checks, verifies required runtime payloads and
produces a DSH-installable `.tgz`, `SHA256SUMS` and Chinese install instructions.
CI installs the packed copy and repeats the host smoke checks before uploading
the `dsh-installable-plugin` artifact. GitHub Releases distribute the installable
tarball separately from GitHub's automatic source archives.

The 0.1.0 baseline was installed through the real DSH CLI into isolated Web and
Headless profiles. A public Git install into another Headless profile succeeded,
and composed config/schema included the plugin. Shared SDK peers are supplied by
DSH's installation resolver; pnpm can report missing profile-local peers without
preventing DSH schema loading. User profiles and model credentials were not modified.

[Initial 0.1.0 CI](https://github.com/cqupi/dsh-computer-use-fusion/actions/runs/38029512724)
passed all seven jobs. [0.2.0 source and macOS helper validation](https://github.com/cqupi/dsh-computer-use-fusion/actions/runs/38035891581)
also passed all seven jobs, including both DSH versions on all three operating
systems and native macOS helper startup. Current validation runs are available under
[Actions](https://github.com/cqupi/dsh-computer-use-fusion/actions).

## Scope not established

- Actual macOS GUI execution, system permissions and cursor behavior on hardware.
- Actual cua-driver/virtual-cursor sessions or Linux desktop GUI behavior.
- Windows OCR language packs, every capture API and third-party UI framework.
- A live model conversation, provider-side image transformations and every
  multi-monitor/foreground input combination.

UIA/AX reports and dispatched OS input are evidence to inspect, rather than a
guarantee that an application completed a larger task. The plugin returns
backend facts, observation errors and possible capture occlusion explicitly.
