# Architecture — 0.2.0

`fusion_computer` owns one persistent Node worker per DSH conversation. Node's built-in
REPL supplies top-level await and persistent lexical bindings. Worker calls to
`cua`/`computer` and bound app objects cross an RPC bridge to the main host.
`nodeRepl.write` returns additional output; nested screenshots become real DSH
image blocks through the shared renderer. A failed await reports its error and
completed outputs instead of hanging the tool. Host cancellation terminates the
worker, and a subsequent call creates a fresh one automatically.

App objects retain an exact provider target. The shared core caches the latest
tree and image mapping per window and remembers a current target for direct
tools. Compatibility observation IDs reference bounded history, with no TTL,
consumption or ownership check. There is no approval or app-scope layer and no
whole-UI hash comparison before input.

The native desktop queue serializes OS transactions. JavaScript can batch actions
without forced observations; direct tools capture afterward by default. Exact
image-to-backend coordinates include screenshot capture bounds, plugin resizing
and attachment-service normalization. Tree-only refresh retains the image
mapping. Input arguments must still describe an actual supported operation.

Windows uses one persistent packaged PowerShell process with JSON-line request
IDs. Native UIA patterns and Unicode/virtual-key SendInput provide input; window
activation is automatic. Semantic writes/invokes enable input fallbacks. Password
controls are writable. The old corner stop and Windows-key block are removed.
OS foreground-lock or input-queue failures remain delivery errors.

The macOS Swift helper is a Fusion-modified upstream implementation, rebuilt for
arm64/x86_64 on hosted macOS. Element locators are resolved against the current
tree without matching prior window/element values or whole-UI state hashes.
Activation reobserves focus without rejecting ordinary UI changes. AX and
target-process CoreGraphics input remain the native delivery mechanisms.

Optional cua-driver retains its external session/virtual-cursor semantics. Its
driver errors are reported rather than interpreted as successful input. The
plugin does not include browser tab automation or the private Codex runtime.
