# UI UTILS

**Generated:** 2026-03-03T06:50:00+0900
**Commit:** 68204da

## OVERVIEW
Cross-cutting utilities for file import, path normalization, audio playback caching, and drag-and-drop data transfer.

## WHERE TO LOOK
| File | Role |
|---|---|
| `importHelpers.ts` | Path deduplication + batch import helpers called from App.tsx |
| `handleImportPaths.ts` | Normalizes dropped/imported path arrays before invoke |
| `dataTransfer.ts` | Extracts file paths from DragEvent dataTransfer objects |
| `audioCache.ts` | In-memory URL cache for audio blobs; avoids redundant fetches |

## CONVENTIONS
- These are pure functions or simple stateful caches — no React hooks, no invoke calls.
- `handleImportPaths` and `importHelpers` must return `string[]`; do not widen to `unknown`.
- Audio cache (`audioCache.ts`) uses `URL.createObjectURL`; call `revokeObjectURL` when done.

## ANTI-PATTERNS
- Do not add invoke calls inside utils — all Tauri IPC stays in `App.tsx`.
- Do not import React or component types into utils — keep them framework-agnostic.

## NOTES
- Tests for `importHelpers` and `handleImportPaths` live alongside source (`*.test.ts`) — keep co-located.
- `/tmp` drag icon paths used as fallbacks in components referencing these utils — platform-specific, macOS only.
