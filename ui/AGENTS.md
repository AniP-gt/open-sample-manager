# UI KNOWLEDGE BASE

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f
**Branch:** main

## OVERVIEW
React + TypeScript frontend for sample/MIDI search, scanning, playback, drag-out, classification edits, and settings. Tauri IPC is typed at call sites and backend rows are normalized manually.

## STRUCTURE
```text
ui/
|- src/App.tsx              # Hook composition + layout; keep logic out
|- src/hooks/               # Domain hooks: sample, MIDI, scan/import, UI
|- src/store/               # Zustand persisted stores
|- src/components/          # One-folder-per-component, barrel exported
|- src/types/               # Shared sample/MIDI/scan/Tauri row types
|- src/utils/               # Pure search/import/path/cache/mapping helpers
|- src/__test__/            # Vitest setup + integration-style UI specs
|- src/**/__test__/         # Co-located component/util tests
|- public/pitch-processor.js # AudioWorklet used by pitch shift control
`- vite.config.ts           # port 5174, Vitest jsdom, Tauri watch ignore
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| App composition | `src/App.tsx` | Hook dependency order and modal/layout wiring |
| Sample state + IPC | `src/hooks/useSampleState.ts` | Search, pagination, CRUD, classification, trash |
| MIDI state + IPC | `src/hooks/useMidiState.ts` | List/search/tags/playback, TiMidity status |
| Scan/import state | `src/hooks/useScanState.ts` | Directory dialog, scan events, drag/drop import paths |
| UI mode/drag state | `src/hooks/useUIState.ts` | View mode, sidebar resize, Tauri drag listeners |
| Persisted settings | `src/store/useSettingsStore.ts` | `osm_settings`: autoPlay + instrument color coding |
| Favorites/recent | `src/store/useFavoritesStore.ts`, `src/store/useRecentStore.ts` | `osm-favorites`, `osm-recent` |
| Backend row mapping | `src/utils/sampleMapper.ts` | `mapRowToSample`, unknown value normalization |
| Fuzzy list search | `src/utils/search.ts` | NFKC multi-term ordered subsequence matching |
| Sample table hotspot | `src/components/SampleList/` | Virtualized sample list; see local AGENTS.md |
| MIDI table hotspot | `src/components/MidiList/` | Virtualized MIDI list; see local AGENTS.md |
| WaveSurfer controls | `src/components/WaveSurferPlayer/`, `src/components/PlayerBar/` | WaveSurfer, spectrogram, loop marker, pitch worklet |
| Test setup | `src/__test__/setup.ts`, `vite.config.ts` | Vitest globals + jsdom |

## ARCHITECTURE
Hook composition in `App.tsx` is dependency ordered:

```text
useUIState -> useScanState -> useMidiState -> useSampleState
```

Cross-hook communication uses refs rather than circular hook dependencies:
- `sampleApiRef`: sample methods used by scan/import flow.
- `midiApiRef`: MIDI methods used after scan/import.
- `scanImportHandlerRef`: import handler exposed to Tauri drag listeners.

State split:
- Domain hooks own IPC-coupled state.
- Zustand stores own cross-component persisted preferences/lists.
- Utilities stay framework-agnostic and do not call Tauri directly except injected helpers in testable orchestration utilities.

## CONVENTIONS
- Vite dev server is fixed to `5174` with `strictPort: true`; keep Tauri devUrl aligned.
- `npm run build` means `npm run typecheck && vite build`.
- Component styles are inline objects plus sparse global CSS; no Tailwind/CSS modules.
- Add new top-level components to `src/components/index.ts`.
- Tauri invoke payloads stay explicit; normalize unknown backend values before setting UI state.
- Tests live in `src/__test__` for integration specs or co-located `__test__` folders for component/util behavior.
- `matchesFuzzySearch` normalizes NFKC and splits ASCII/full-width whitespace; preserve Japanese-width behavior.

## ANTI-PATTERNS
- Do not pass `any`-shaped IPC payloads into state without mapping.
- Do not remove `src-tauri` from Vite watch ignore.
- Do not add business logic directly into `App.tsx`.
- Do not duplicate scan/import logic between hooks and utils; `useScanState` orchestrates and `handleImportPaths` owns reusable path flow.
- Do not mutate persisted store shapes without a merge/default strategy for existing localStorage.
- Do not access WaveSurfer internals outside the player/pitch-control boundary.

## COMMANDS
```bash
npm run dev --prefix ui
npm run typecheck --prefix ui
npm run test --prefix ui
npm run build --prefix ui
```

## NOTES
- Large hotspots: `SampleList.tsx`, `MidiList.tsx`, `useSampleState.ts`, `App.tsx`.
- `@tanstack/react-virtual` powers both list views; tests mock it where needed.
- UI tests use hardcoded `/Users/alice/...` paths to simulate desktop file paths.
- `public/pitch-processor.js` is loaded by `AudioWorklet.addModule('/pitch-processor.js')`.
