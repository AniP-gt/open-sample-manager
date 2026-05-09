# UI UTILS

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f

## OVERVIEW
Framework-light helpers for backend row mapping, file import orchestration, drag/drop path extraction, audio blob caching, keyboard shortcuts, and fuzzy list search.

## WHERE TO LOOK
| File | Role |
|---|---|
| `sampleMapper.ts` | Backend row normalization and `getErrorMessage` |
| `search.ts` | NFKC + multi-term ordered-subsequence fuzzy matching |
| `importHelpers.ts` | Resolve dropped paths to directories/files with injected stat function |
| `handleImportPaths.ts` | Testable import-path orchestration with injected invoke/listen callbacks |
| `dataTransfer.ts` | Browser `DataTransfer` file URI/path extraction |
| `audioCache.ts` | In-memory object URL cache for fetched audio blobs |
| `keyboard.ts` | Shortcut helpers |
| `__test__/` | Co-located Vitest specs for utility behavior |

## CONVENTIONS
- Keep utilities pure or dependency-injected; no React hooks here.
- Tauri calls in reusable utilities must be passed in as injected functions, not imported globally.
- Normalize full-width/half-width forms with `String.prototype.normalize('NFKC')` where search behavior depends on user text.
- Path utilities should handle macOS/Linux paths and Windows `file:///C:/...` URI forms.
- Tests for utility behavior stay in `src/utils/__test__/`.

## ANTI-PATTERNS
- Do not import React or component types into utils.
- Do not introduce direct global `invoke` calls into pure helpers.
- Do not widen utility return types to `unknown`; keep concrete string/path/domain types.
- Do not forget `URL.revokeObjectURL` ownership when changing `audioCache.ts` behavior.

## NOTES
- `matchesFuzzySearch` returns true for blank queries, false for nonblank queries with no targets, and ANDs terms across targets.
- `handleImportPaths` is the seam for tests that simulate scan progress without a Tauri runtime.
