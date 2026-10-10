# Changelog

Release packaging: `npm run package` generates an installable `.tgz`, checksum
and Chinese instructions. CI checks the installed archive and saves the package
artifact; GitHub Releases provide the ready-to-install plugin download.

## 0.2.0 — 2026-10-10

- Added `fusion_computer`: persistent JavaScript with top-level await, `cua` /
  `computer`, bound app objects, numbered trees and real image output.
- Added `fusion_screenshot`; direct tools remember their window and no longer
  require an observation ID. Default activation and post-action images.
- Removed plugin approvals, label confirmations, app allowlists, password input
  blocks, observation TTL/consumption/ownership gates, state-equality checks,
  stop/resume files, cursor-corner stop and Windows-key restriction.
- Enabled semantic fallbacks; Windows keyboard chords use native SendInput.
- Modified the macOS helper to resolve live element locators without state
  comparison; supplied a universal source build/artifact workflow.
- JS workers return failed-await output promptly and reset automatically after
  host cancellation. Added functional REPL and unrestricted interaction tests.

## 0.1.0 — 2026-10-10

- Unified 13 namespaced DSH tools over native Windows UIA, pinned native macOS AX,
  and optional cua-driver adapters.
- Added caller-scoped one-use observations, state/TTL checks, app scope,
  per-turn control grants, sensitive-action approval and human stop markers.
- Added real host image attachments with exact capture/normalization mapping.
- Added Windows fixture verification, current DSH host contract checks, CI,
  source provenance and MIT notices.
