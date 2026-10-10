# DSH Computer Use Fusion

[中文说明](README.md) · [Validation](docs/VALIDATION.md) · [Attribution](THIRD_PARTY_NOTICES.md)

One independent MIT plugin combining native Windows UIA, native macOS AX,
optional cua-driver, and image feedback with exact image-to-backend mapping.
Initial release: 0.1.0. Not affiliated with DeepSeek or upstream maintainers.

```text
dsh plugin --profile web add git+https://github.com/cqupi/dsh-computer-use-fusion.git
```

Requires Node 22.19+ or 24+, DSH 0.2.0-rc.2. Host contract tests also cover
0.2.1-alpha.2. Restart the host, start a new session, load
`/dsh-computer-use-fusion`, and use `fusion_health`, `fusion_list_windows`, then
`fusion_observe` with an exact target. This repository is not yet published to npm.

13 namespaced tools share caller-bound, one-use observations, TTL, application
scope checks, per-turn control approval, sensitive-action approval, and
pre-input structural revalidation. Password input is blocked. Each successful
input returns a new observation or an explicit post-observation warning.

Coordinates use the returned image pixels. The attachment service's final image
dimensions are included in `mapping.screenPerPixel`. Tree-only observations
carry no image mapping: request a screenshot before another coordinate action.

Windows foreground mouse input moves the real cursor and activates the target.
Only the optional, separately installed cua-driver provides its isolated cursor.
Native macOS uses Anionex's pinned, integrity-checked universal helper.
macOS and Linux/CUA have not had native end-to-end testing on this Windows host.
Background PostMessage delivery is not guaranteed; UI state is evidence, not
proof of remote or pixel-only effects. Consult the Chinese README for the full
platform matrix, settings, tool list, privacy behavior and current limitations.

```text
npm ci
npm run check
npm test
npm run test:host
npm run test:windows
node scripts/doctor.mjs
node scripts/doctor.mjs --stop
node scripts/doctor.mjs --resume
```

Image feedback sends the selected window to the configured DSH model provider
only when image input is declared and attachments are available. The plugin has
no direct network client, key fallback or telemetry. Screenshots use temporary
files. Only a human should remove a stop marker and resume.

All four upstream projects, pinned commits, MIT notices and modifications are
listed in THIRD_PARTY_NOTICES.md. Contributions should include observable
outcomes from a dedicated fixture and must not use the user's working apps.
