Manual verification artifacts for drag-and-drop import

Files:
- renderer.log — captured vitest/dev logs (if Tauri started via script)
- ui_dev.log — Vite dev server logs
- overlay_placeholder.png — placeholder screenshot for PR (replace with real screenshot if available)

How to replace placeholder screenshot:
1. Run the app using `npm run tauri:dev` or `npm run dev --prefix ui` and make sure the app window is visible.
2. While dragging files from Finder/Explorer into the SampleList, run:
   - macOS interactive screenshot: `screencapture -i .local/manual-verify/import-overlay-$(date +%s).png`
3. Commit or attach the captured PNG to the PR description.
