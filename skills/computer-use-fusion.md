# Computer Use Fusion

Prefer purpose-built connectors, APIs, CLIs, and browser automation. Use this
plugin for native desktop UI that those interfaces cannot handle.

1. Call fusion_health, then fusion_list_windows. Choose an exact process/window.
   On macOS prefer bundleId plus pid. A missing or ambiguous target is an error.
2. Call fusion_observe. Read the UIA/AX elements first; request screenshot=true
   for a visual task or coordinate actions. It captures the selected window.
3. Use an observation-local element or handle whenever possible. Every input
   requires the exact observationId and consumes it. Use the new observation
   returned by the action, or observe again. Never borrow another agent's ID.
4. Coordinate x/y and drag endpoints are pixels in the image the tool returned.
   mapping.origin and mapping.screenPerPixel describe its transform. Do not
   multiply them yourself: the plugin does the conversion exactly once.
   A tree-only post-observation has no image; observe with screenshot=true
   before the next coordinate action. OCR boxes use screen coordinates; use
   (screen - mapping.origin) / mapping.screenPerPixel to derive image pixels.
5. Default to semantic/background actions. Windows foreground=true activates
   the selected window and may move the user's real cursor. Never claim that
   native Windows foreground input uses an isolated cursor. Key, scroll and
   drag require explicit foreground=true on Windows. Background PostMessage
   can be ignored by applications: read fresh evidence and report uncertainty.
   Do not automatically retry in foreground after a refusal.
6. Read the actual effect and post-observation. A successful input dispatch
   does not prove task completion. occludedPossible means the screenshot may
   show another window. Observe after UI changes; changed-state errors require
   a new observation, never blind replay. Pixel-only changes may evade AX/UIA.
7. Set sensitive=true and explain the impact in reason before payments,
   purchases, account/security changes, consequential communications, destructive
   operations, or publication. The host asks for one-use confirmation tied to
   that proposed action. Keyword detection is an extra heuristic, not a full
   policy. A denied approval is final for this turn. Do not bypass it.
8. Password fields cannot receive automated text or chords. Let the human enter
   credentials. Screenshots may contain private content; narrow the target.
   Image feedback sends the captured window to the configured model provider.
9. Use fusion_stop immediately when the user asks to stop. Only the human can
   resume with node scripts/doctor.mjs --resume. Never remove the stop marker
   through shell tools to continue an agent workflow.

The packaged Windows and macOS providers are native. backend=cua uses an
independently installed cua-driver and its isolated virtual cursor. Linux/CUA
and native macOS require platform validation; consult docs/VALIDATION.md.
