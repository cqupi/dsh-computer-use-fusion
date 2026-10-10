# Architecture

`src/index.js` is a Cordis consumer requiring DSH tools and approval. Skills,
attachments and LLM route metadata are read through available host services.
It does not import the removed `settingsNamespace` export or write a Settings
scope. Config is validated at mount time; configuration changes require restart.

`src/core.js` owns desktop transaction serialization, agent-object identity,
observation snapshots, application scope, control grants and one-use actions.
Control grants are keyed to owner, turn (or call ID if unavailable), app and
window. Rejections are cached for that turn. The store is bounded and ephemeral;
a restart requires new control approval. It does not migrate upstream grants.

`src/vision.js` folds capture bounds and final attachment dimensions into one
transform. Windows re-captures smaller before attachment when needed to fit the
configured pixel budget. A shared sharp resize stage also bounds macOS/CUA
captures before host normalization, whose final dimensions update the mapping.
Captures always target one window. A required target-window
capture must not silently become a desktop capture on Windows.

Provider interfaces implement `health`, `list`, `resolve`, `observe`, `act` and
`dispose`; Windows also implements local OCR. Windows uses a persistent,
generation-bound JSON-line PowerShell child. Timeout/cancellation kills that
generation and rejects its waiters. Native macOS invokes the pinned helper's
JSON protocol and passes its expected state hash to the helper. CUA uses fixed
argv, explicit sessions, bounded/cancellable execution and session recovery.

The model-facing schema uses DSH's current `defineTool` canonical-value output
contract. The renderer appends real image attachment blocks only on image-capable
routes. The namespaced surface avoids upstream `computer_*` collisions; running
multiple desktop-control plugins concurrently is still discouraged.

The first release intentionally does not merge upstream web overlays, HTTP
routes, approval persistence, LLM wrappers, external vision APIs or arbitrary
application launchers. This keeps the integration inspectable. Keyword safety
is heuristic; structural revalidation does not prove task completion, detect all
pixel changes or eliminate OS-level focus races.
