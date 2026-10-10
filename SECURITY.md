# Security boundaries

Report vulnerabilities privately through GitHub's private vulnerability
reporting UI when available; otherwise open an issue without secrets or desktop
screenshots. This is an early integration release.

The model does not choose arbitrary executables or shell commands. Packaged
PowerShell and Swift helpers receive structured JSON. The optional cua-driver
path is operator-controlled. macOS helper SHA-256 is checked before use.

IDs are caller-bound and one-use, input transactions are serialized, state is
re-observed before input, and approval latency does not extend observation TTL.
Configured app scope also covers screenshot observation. The sensitive flag
and dangerous-label heuristics do not replace the agent's or host's policy.
Applications may expose private data through AX/UIA or screenshots.

Windows requires foreground input for some actions. It can change focus and move
the real mouse. Background delivery may be ignored, and native APIs cannot make
the precheck/input pair fully atomic. Stop markers prevent subsequent actions;
they cannot undo input already delivered. Do not run against an unattended
desktop that contains critical workflows.

The plugin does not transmit files directly. The DSH host can transmit screenshot
attachments to its configured model provider. Temporary screenshot files are
not encrypted. The Windows helper also compiles/cache-loads its bundled C# native
interop and OCR helpers under the system temp directory.
