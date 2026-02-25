## PR draft: feat(ui): drag-and-drop import into SampleList

Summary
-------
- Adds drag-and-drop import UX to the renderer so users can drag files/folders from Finder/Explorer into the app's library list to import/index them.
- Reuses existing scan lifecycle: invokes `scan_directory` and listens for `scan-progress` events so dropped content is scanned and becomes visible in the library.

Files changed (summary)
-----------------------
- ui/src/App.tsx — Tauri drag event listeners, handleImportPaths orchestration, isDragOver state
- ui/src/components/SampleList/SampleList.tsx — HTML5 drag/drop handlers, overlay UI, onImportPaths prop
- ui/src/components/Header/Header.tsx — added DROP TO IMPORT affordance while dragging
- ui/src/utils/dataTransfer.ts — DataTransfer parsing helper
- ui/src/utils/importHelpers.ts — resolveDroppedPaths (stat/heuristic)
- ui/src/utils/handleImportPaths.ts — orchestration helper; invokes scan_directory and re-runs searches
- ui/src/components/SampleList/extractPaths.test.ts — unit tests for data transfer parsing
- ui/src/components/SampleList/drop.test.tsx — drop handler test
- ui/src/utils/*.test.ts — import helpers and orchestration tests
- scripts/manual_verify_drag.sh — helper script for manual verification

Verification performed
----------------------
- TypeScript typecheck (ui): passed
- Vitest suite (ui): 10 tests passing locally
- LSP diagnostics: no diagnostics on modified files
- cargo check: completed with non-blocking warnings

Manual verification required (desktop)
-----------------------------------
The following manual interactive checks require running the app in a desktop environment (Tauri):

1. Start the app: `npm run tauri:dev` (preferred) or `npm run dev --prefix ui` while running Tauri pointing to the dev server.
2. Drag files/folders from Finder/Explorer into the SampleList area.
3. Confirm UI affordances:
   - Header shows a prominent "DROP TO IMPORT" pill while dragging.
   - SampleList shows a centered translucent "IMPORT" overlay while dragging.
4. On drop, renderer logs should show `handleImportPaths` debug lines and `scan_directory` invocation; `scan-progress` events should be handled by the ScannerOverlay.

Attach screenshots to PR description (place into `.local/manual-verify/` before opening PR).

Notes
-----
- No commits or PRs were created automatically — awaiting explicit approval to create a branch and open PR (per repo policy).
- Playwright E2E tests were not added to the repo to avoid changing dependencies; README with guidance is included.

Suggested PR body (copy into GitHub PR):
-------------------------------------
## Summary

Adds drag-and-drop import UX to the app's SampleList. Users can now drag files or folders from the OS into the app; the UI shows a clear "DROP TO IMPORT" affordance and dropped paths are scanned using the existing `scan_directory` flow.

## Files changed

<describe files listed above>

## Verification

- TypeScript and tests pass locally (see vitest output in CI).
- Manual interactive verification steps (desktop) are documented in `.local/PR_DRAFT.md` and `scripts/manual_verify_drag.sh`.

## Notes for reviewers

- This change intentionally avoids adding backend surfaces; file drops resolve to directories and call `scan_directory`.
- If you want single-file ingestion, consider adding an `import_file` backend command as a follow-up.
