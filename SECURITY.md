# Access model

Version 0.2.0 delegates desktop access decisions to the user, DSH host and OS.
The plugin does not request approval, inspect action labels, impose an app
allowlist, block password input, expire observations or maintain a stop file.
The persistent JavaScript worker is a normal Node execution environment, not a
security sandbox. It is terminated on host cancellation or execution timeout.

Windows keyboard/coordinate input can activate windows and move the real mouse.
macOS still needs system Accessibility and Screen Recording permissions. An
external cua-driver follows its own delivery behavior.

Screenshots are stored in OS temporary directories and can be attached through
DSH to its configured model provider. This plugin has no telemetry, embedded
model key or independent network control endpoint.

Report reproducible implementation defects through GitHub Issues. Do not attach
private screenshots or credentials to a public issue.
