# UI KNOWLEDGE BASE

**Generated:** 2026-03-03T06:50:00+0900
**Commit:** 68204da
**Branch:** main

## OVERVIEW
React + TypeScript frontend for search/filter/scan UX, wired to Tauri commands through typed invoke calls and local mapping logic.

## STRUCTURE
ui/
|- src/App.tsx            # state orchestration + invoke/listen integration (~28 invoke commands)
|- src/components/*/      # one-folder-per-component pattern (23 components)
|- src/types/             # sample.ts, scan.ts, midi.ts — shared UI domain types
|- src/utils/             # importHelpers, handleImportPaths, audioCache, dataTransfer
|- src/test/              # Vitest setup and integration specs
|- vite.config.ts         # dev server port 5174 + Vitest + Tauri watch rules
`- tsconfig*.json         # project references: tsconfig.app.json + tsconfig.node.json

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Backend command usage | `ui/src/App.tsx` | `invoke(...)` and `scan-progress` listener wiring |
| Type contracts | `ui/src/types/sample.ts`, `ui/src/types/scan.ts` | Domain model used across components |
| MIDI types | `ui/src/types/midi.ts` | Midi, MidiTag, MidiTagRow shapes |
| Similarity UI flow | `ui/src/components/DetailPanel/`, `ui/src/components/EmbeddingResultsModal/` | Embedding search interaction |
| Component exports | `ui/src/components/index.ts` | Barrel list for top-level imports |
| Test setup | `ui/src/test/setup.ts`, `ui/src/test/placeholder.test.ts` | Vitest + jest-dom bootstrapping |
| Import/drop utilities | `ui/src/utils/` | Import path handling, audio cache, drag transfer — see utils/AGENTS.md |

## CONVENTIONS
- Keep explicit value mapping between backend rows and UI types (normalize unknowns safely).
- Build pipeline requires typecheck before Vite build (`npm run build`).
- Vite dev server is fixed to port `5174` (strictPort true); keep in sync with Tauri devUrl.
- Component organization is directory-per-component with inline style objects (no Tailwind, no CSS modules).
- State management is exclusively React `useState` in `App.tsx`; no Zustand/Redux/Context.
- All invoke calls are typed; do not add untyped or `any`-shaped invocations.
## ANTI-PATTERNS
- Do not pass `any`-shaped payloads from IPC directly into UI state without normalization.
- Do not remove `src-tauri` watch ignore rule in `ui/vite.config.ts`.
- Do not bypass retry/error handling flow when adding new async invoke actions.
- Do not add state management libraries without consensus — useState-only is intentional.

## COMMANDS
```bash
npm run dev --prefix ui
npm run typecheck --prefix ui
npm run test --prefix ui
npm run build --prefix ui
```

## NOTES
- `ui/src/App.tsx` is a high-complexity file (~50K); keep changes bounded and typed.
- No generated Tauri types; all backend→UI mapping is manual via `mapRowToSample` and inline normalization.
- Test files use hardcoded `/Users/alice/...` macOS paths — acceptable for desktop-only app.
