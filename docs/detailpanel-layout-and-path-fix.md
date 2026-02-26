Title: DetailPanel layout, sticky PATH footer, and copy affordance

Overview
--------
This change makes the right-side DetailPanel reliably scrollable and ensures the file PATH is always visible (single-line with ellipsis) and copyable. It fixes reported issues where the PATH was being clipped or disappeared when the waveform UI / PlayerBar were present.

What changed
------------
- DetailPanel now uses a flex column layout with a dedicated scrollable content area (flex:1, minHeight:0, overflowY:auto). This prevents the common CSS issue where a child cannot scroll because the parent doesn't allow it.
- The PATH footer is implemented as a sticky element (position: sticky; bottom: 0) inside the panel rather than absolute. This keeps it visible while the content scrolls and prevents clipping by ancestor overflow.
- PATH text displays as a single connected line with white-space: nowrap and text-overflow: ellipsis; the full path is available via the title attribute.
- Added a small copy-to-clipboard button next to the PATH that calls the existing copy_to_clipboard invoke. A temporary inline "Copied" indicator appears after copy.
- EmbeddingResultsModal import is now dynamic and guarded: the modal is imported at runtime only when needed so branches without the optional modal file do not break the typecheck/build.

Files modified
--------------
- ui/src/components/DetailPanel/DetailPanel.tsx — main changes: layout, sticky footer, copy button, dynamic modal import.
- ui/src/global.d.ts — ambient module declaration to allow optional dynamic import without breaking TypeScript compilation.

Verification performed
---------------------
- Type check: npm run typecheck --prefix ui — completed successfully after the changes.
- Build: npm run build --prefix ui — Vite build completed successfully. (Vite reported an informational message about a dynamic import pattern for plugin-fs but it was non-fatal.)

How to test locally
-------------------
1. Start the dev server: npm run dev --prefix ui
2. Open localhost:5173 in a browser
3. Select a sample from the list so the DetailPanel appears at the right
4. Verify:
   - The right-side panel content scrolls independently.
   - The file PATH appears as a single line with ellipsis when long.
   - Hover the PATH to see the full path in the title tooltip.
   - Click the clipboard button to copy the path; you should see a short "Copied" indicator.
   - Resize the window and ensure the PATH remains visible and the PlayerBar does not obscure it.

Notes and rationale
-------------------
- Using sticky (instead of absolute) for the PATH footer avoids layout clipping in nested scrolling/overflow contexts.
- PaddingBottom on the panel was increased slightly to leave room for the fixed PlayerBar (160px) plus a small buffer to avoid accidental overlap in edge cases.
- The dynamic import for EmbeddingResultsModal is defensive so the UI remains buildable even when the optional modal is missing in some branches; this is purely defensive and preserves existing modal behavior where present.
