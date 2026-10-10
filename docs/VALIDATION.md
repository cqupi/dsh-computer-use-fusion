# Validation record — 2026-10-10 (Asia/Hong_Kong)

Baseline from the official npm registry at implementation time:
`@deepseek-ai/dsh` latest/next = **0.2.0-rc.2**, alpha = **0.2.1-alpha.2**.
These are developer-preview releases, not a claim of stable DSH support forever.
The plugin pins its compatibility to those exact published generations.

Local machine: Windows, Node **24.19.0** for final validation. The system Node
22.17.1 is below the documented requirement; the bundled Node 24 runtime was
used without modifying the user's system installation.

| Check | Evidence / scope |
| --- | --- |
| Syntax, DSH input/output schemas and bundle identity | `node scripts/check.mjs`; all 13 schemas accepted by the current SDK. |
| macOS release artifact integrity | Pinned binary SHA-256 and helper Swift source tree hash match upstream manifest. |
| Deterministic tests | 17 tests covering caller isolation, one-use IDs, TTL/state refusal, scope, approval denial/latency, password guard, image mapping, real PNG budget fitting, process cancellation/generation discard and adapter payloads. |
| DSH 0.2.0-rc.2 host contract | Real Cordis, ToolRuntime and Skill service. Registered and dispatched tools with canonical output validation; actual plugin load/unload; image attachment rendering. |
| DSH 0.2.1-alpha.2 host contract | Same contract against separately installed published alpha tools/skill packages. This is not an alpha full-profile/model E2E test. |
| DSH CLI 0.2.0-rc.2 profile integration | Installed local plugin through `dsh plugin` into isolated Web and Headless profiles. Both composed `--dump-config` outputs include the Fusion bundle and config. User profiles were not modified. |
| Public Git installation | Installed `git+https://github.com/cqupi/dsh-computer-use-fusion.git` through the real DSH CLI into a separate Headless profile. Composed config and `--dump-config-schema` succeed and include Fusion's config schema. pnpm reports absent profile-local SDK peers because this profile uses the installation's shared SDK; DSH's runtime resolver successfully imports the plugin. |
| Native Windows fixture | A separate WinForms process: exact HWND/PID discovery, window capture/downscale, Unicode semantic value write and UIA readback, background invoke and observed status change, password rejection and externally changed-state rejection. Only this process was operated and closed. |
| Package contents | `npm pack`; sources, native providers, licenses, skills and bundle patch included; upstream checkouts, host sandboxes, screenshots and local paths excluded. |
| Hosted CI | [Initial source validation](https://github.com/cqupi/dsh-computer-use-fusion/actions/runs/38029512724) passed all seven jobs: Windows/macOS/Linux host contracts for both DSH versions, Windows native fixture, and universal macOS helper source rebuild. This does not establish macOS GUI behavior. |

Reproduce the local core/host/native checks:

```text
node scripts/validate.mjs
```

For the alpha contract:

```text
npm install --prefix .compat/alpha --ignore-scripts @deepseek-ai/dsh-tools@0.2.1-alpha.2 @deepseek-ai/dsh-skill@0.2.1-alpha.2
node scripts/host-smoke.mjs .compat/alpha
```

Not established by the local run:

- Native macOS GUI behavior, permissions and cursor routing on actual hardware.
- Actual cua-driver sessions, its virtual cursor, Linux desktop compatibility.
- Windows OCR availability across language packs, WGC availability and all third-party UI stacks.
- A live model conversation, provider-side image preprocessing, multi-monitor
  hardware behavior or all foreground mouse/keyboard actions. Negative monitor
  origins and attachment normalization are covered by deterministic tests.
- Permission-dependent macOS GUI verification. The successful macOS source
  build and host contract jobs are separate from native GUI verification.

Limits are deliberate: dispatched input is not proof of task completion. UIA/AX
cannot observe every visual, transient, remote or external change. A selected
window capture can be flagged `occludedPossible`. Windows foreground input uses
the real cursor. Review README and SECURITY before unattended use.
