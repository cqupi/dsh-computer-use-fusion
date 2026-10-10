# Third-party attribution

This is an independent integration maintained by cqupi, not an official DSH or
upstream release. MIT permits integration and redistribution provided the
copyright and license notices are preserved. Full upstream notices are in
`licenses/` and alongside the vendored implementations.

| Project | Pinned commit | Material used |
| --- | --- | --- |
| [Anionex/dsh-computer-use](https://github.com/Anionex/dsh-computer-use) | `99e12a298d6c291ce39342c0dc6720721409527a` | macOS Swift helper source and universal build workflow. Fusion 0.2.0 modifies state/activation handling and rebuilds the helper as `0.3.3-fusion.0.2.0`. Copyright 2026 anionex. |
| [988hj7tczd-oss/dsh-computer-use](https://github.com/988hj7tczd-oss/dsh-computer-use) | `3cf9bd8ae60271512f263bfa75485cb242ca0892` | Unmodified `lib/cua.js` vendored as `vendor/cua/cua.js` for binary resolution and session recovery, with a new bounded, cancellable transport and provider adapter. Copyright 2026 dsh-computer-use contributors. |
| [Yu-tao-Li/dsh-computer-use-win](https://github.com/Yu-tao-Li/dsh-computer-use-win) | `18a8a5c9b749ab10ec1992c88de0deebbe812612` | `scripts/windows-uia.ps1`, adapted as `native/windows/windows-uia.ps1`. Copyright 2026 Yu-tao-Li and cgissing. Native upstream techniques also reference desktop-touch-mcp; see source comments. |
| [xie129716/computer-user-vision](https://github.com/xie129716/computer-user-vision) | `e10491d868d7ed67ad1461b48fb9df32f2b3f8a9` | Host-attachment image feedback, image budget, image-to-screen mapping and settings API drift informed the new `src/vision.js` and host adapter. Copyright 2026 jing-hy (original computer-user) and computer-user-vision contributors. |

Windows changes: expose `IsPassword` as metadata, retain text focus, add native
virtual-key chord input including the Windows key, correct Unicode key release,
avoid repeated foreground activation consuming the first typed character,
and remove password input, title-identity and cursor-corner interception.
Fusion 0.2.0 enables activation and semantic input fallbacks without adding an
approval, expiry or state-equality layer.

macOS changes: remove the managed-parent/process-group transport gate and
prior-state/element-value comparison before input and
activation, retain current AX locator resolution, enable set-value keyboard
fallback and preserve right/double-click semantics. The modified helper is
rebuilt on hosted macOS for arm64/x86_64; source and binary hashes are recorded
in `native/macos/manifest.json`. Native GUI execution is not verified on Windows.

Optional `cua-driver` is a separately installed third-party executable. It is
not redistributed here. This project does not claim ownership of upstream code.

The npm dependency sharp (Apache-2.0) and its platform image libraries are used
for bounded screenshot resizing. Their licenses ship with the installed npm
packages; they are not copied into this repository. See
[sharp](https://github.com/lovell/sharp).
