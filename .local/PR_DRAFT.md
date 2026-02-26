## PR draft: feat(ui): drag-and-drop import into SampleList

Summary
-------
- Adds drag-and-drop import UX to the renderer so users can drag files/folders from Finder/Explorer into the app's library list to import/index them.
- Reuses existing scan lifecycle: invokes `scan_directory` and listens for `scan-progress` events so dropped content is scanned and becomes visible in the library.

Files changed (summary)
-----------------------
- ui/src/App.tsx — Tauri drag event listeners, handleImportPaths orchestration, isDragOver state
- ui/src/components/SampleList/SampleList.tsx — HTML5 drag/drop handlers, overlay UI, onImportPaths prop
- ui/src/components/FilterSidebar/FilterSidebar.tsx — added onImportPaths forwarding for sidebar folder drops
- ui/package.json — dev dependency adjustments for Playwright (for local E2E testing only)

Verification performed
----------------------
- TypeScript typecheck (ui): passed
- Vitest suite (ui): 10 tests passing locally
- LSP diagnostics: no diagnostics on modified files

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
- This PR intentionally avoids adding backend surfaces; file drops resolve to directories and call `scan_directory`.
- No PR will be opened until explicit approval is given.
