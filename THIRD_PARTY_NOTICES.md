# Third-party attribution

This is an independent integration maintained by cqupi, not an official DSH or
upstream release. MIT permits integration and redistribution provided the
copyright and license notices are preserved. Full upstream notices are in
`licenses/` and alongside the vendored implementations.

| Project | Pinned commit | Material used |
| --- | --- | --- |
| [Anionex/dsh-computer-use](https://github.com/Anionex/dsh-computer-use) | `99e12a298d6c291ce39342c0dc6720721409527a` | Unmodified macOS Swift source, universal helper 0.3.3, integrity manifest. Observation-local handles, stale-state checks and scoped control informed the new core. Copyright 2026 anionex. |
| [988hj7tczd-oss/dsh-computer-use](https://github.com/988hj7tczd-oss/dsh-computer-use) | `3cf9bd8ae60271512f263bfa75485cb242ca0892` | Unmodified `lib/cua.js` vendored as `vendor/cua/cua.js` for binary resolution and session recovery, with a new bounded, cancellable transport and provider adapter. Copyright 2026 dsh-computer-use contributors. |
| [Yu-tao-Li/dsh-computer-use-win](https://github.com/Yu-tao-Li/dsh-computer-use-win) | `18a8a5c9b749ab10ec1992c88de0deebbe812612` | `scripts/windows-uia.ps1`, adapted as `native/windows/windows-uia.ps1`. Copyright 2026 Yu-tao-Li and cgissing. Native upstream techniques also reference desktop-touch-mcp; see source comments. |
| [xie129716/computer-user-vision](https://github.com/xie129716/computer-user-vision) | `e10491d868d7ed67ad1461b48fb9df32f2b3f8a9` | Host-attachment image feedback, image budget, image-to-screen mapping and settings API drift informed the new `src/vision.js` and host adapter. Copyright 2026 jing-hy (original computer-user) and computer-user-vision contributors. |

Windows changes: expose `IsPassword`, redact password values, reject semantic
password writes and password keyboard input, keep text focus in the exact
target window, and use semantic invocation only for a left click. The Fusion
adapter disables implicit coordinate/typing fallbacks and adds caller-scoped,
one-use observations and pre-input state checks around the backend.

The macOS binary is the upstream release artifact, SHA-256
`6b2eca0992d6e2a9c622a7bddcd8573724139ef0abfe6e12d2b54daaef28ed3e`.
It is checked before execution. It has not been rebuilt or run on Windows.

Optional `cua-driver` is a separately installed third-party executable. It is
not redistributed here. This project does not claim ownership of upstream code.

The npm dependency sharp (Apache-2.0) and its platform image libraries are used
for bounded screenshot resizing. Their licenses ship with the installed npm
packages; they are not copied into this repository. See
[sharp](https://github.com/lovell/sharp).
