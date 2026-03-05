# UI KNOWLEDGE BASE

**Generated:** 2026-03-05T11:59:00+0900
**Branch:** main

## OVERVIEW
React + TypeScript frontend for search/filter/scan UX, wired to Tauri commands through typed invoke calls and local mapping logic.

## STRUCTURE
```
ui/
|- src/App.tsx              # JSX/rendering only — composes domain hooks, passes props
|- src/hooks/               # Domain hooks (state + IPC logic)
|   |- useSampleState.ts    # Samples: search, filter, CRUD, classification
|   |- useMidiState.ts      # MIDI: list, tags, playback, pagination
|   |- useScanState.ts      # Scan/import: directory scan, sidebar import, progress
|   `- useUIState.ts        # UI state: sidebar width, drag-over, viewMode, pageLimit
|- src/store/               # Zustand global stores
|   `- useSettingsStore.ts  # autoPlayOnSelect (persisted via localStorage)
|- src/components/*/        # one-folder-per-component pattern (23 components)
|- src/types/               # Shared domain types
|   |- sample.ts            # Sample, FilterState, SortState, InstrumentTypeRow
|   |- scan.ts              # ScanProgress
|   |- midi.ts              # Midi, MidiTag, MidiTagRow, TimidityStatus
|   `- tauri.ts             # TauriSampleRow (raw backend row shape)
|- src/utils/               # Pure functions + utilities
|   |- sampleMapper.ts      # normalizeSampleType, mapRowToSample, getErrorMessage
|   |- importHelpers.ts     # Import path classification helpers
|   |- handleImportPaths.ts # Core import-path orchestration logic
|   |- audioCache.ts        # Audio blob URL cache
|   `- dataTransfer.ts      # Drag-and-drop data transfer helpers
|- src/test/                # Vitest setup and integration specs
|- vite.config.ts           # dev server port 5174 + Vitest + Tauri watch rules
`- tsconfig*.json           # project references: tsconfig.app.json + tsconfig.node.json
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Sample state + IPC | `ui/src/hooks/useSampleState.ts` | Search, filter, CRUD, classification |
| MIDI state + IPC | `ui/src/hooks/useMidiState.ts` | List, tags, playback, pagination |
| Scan/import logic | `ui/src/hooks/useScanState.ts` | Directory scan, sidebar import, progress |
| UI state | `ui/src/hooks/useUIState.ts` | Sidebar resize, drag-over, viewMode |
| Global settings | `ui/src/store/useSettingsStore.ts` | Zustand; persisted to localStorage (`osm_settings`) |
| Backend row → UI type | `ui/src/utils/sampleMapper.ts` | `mapRowToSample`, `normalizeSampleType` |
| Raw backend row shape | `ui/src/types/tauri.ts` | `TauriSampleRow` |
| Type contracts | `ui/src/types/sample.ts`, `ui/src/types/scan.ts` | Domain model used across components |
| MIDI types | `ui/src/types/midi.ts` | Midi, MidiTag, MidiTagRow shapes |
| Similarity UI flow | `ui/src/components/DetailPanel/`, `ui/src/components/EmbeddingResultsModal/` | Embedding search interaction |
| Component exports | `ui/src/components/index.ts` | Barrel list for top-level imports |
| Test setup | `ui/src/test/setup.ts`, `ui/src/test/placeholder.test.ts` | Vitest + jest-dom bootstrapping |
| Import/drop utilities | `ui/src/utils/` | Import path handling, audio cache, drag transfer |

## ARCHITECTURE

### Hook composition in App.tsx
Hooks are composed in this order (dependency order matters):

```
useUIState          → no deps
useScanState        → depends on: refs, sampleApiRef, midiApiRef, scanImportHandlerRef
useMidiState        → depends on: scanState.setError, scanState.setScanning, scanState.setScanProgress
useSampleState      → depends on: scanState.setError, midiState.{setMidis,setSelectedMidi,fetchAllMidiPaths}
```

Cross-hook communication uses stable `useRef` bridges to avoid circular deps:
- `sampleApiRef` — passed into `useScanState` to call sample methods after scan completes
- `midiApiRef` — passed into `useScanState` to call MIDI methods after scan
- `scanImportHandlerRef` — holds `useScanState.handleImportPaths` for use in MIDI hook

### State management strategy
- **Domain hooks** (`src/hooks/`) — useState for component-coupled state
- **Zustand** (`src/store/`) — global settings that need cross-component sharing or persistence
- **No Redux / Context** — intentional; this is a single-page desktop app

### confirmOpen composition
`sampleState.confirmOpen` and `midiState.confirmOpen` are OR-combined in App.tsx:
```typescript
const confirmOpen = sampleState.confirmOpen || midiState.confirmOpen;
```

## CONVENTIONS
- Keep explicit value mapping between backend rows and UI types (normalize unknowns safely).
- Build pipeline requires typecheck before Vite build (`npm run build`).
- Vite dev server is fixed to port `5174` (strictPort true); keep in sync with Tauri devUrl.
- Component organization is directory-per-component with inline style objects (no Tailwind, no CSS modules).
- All invoke calls are typed; do not add untyped or `any`-shaped invocations.
- New state/logic belongs in the appropriate domain hook, not App.tsx.
- Shared utilities (pure functions) go in `src/utils/`; shared types go in `src/types/`.

## ANTI-PATTERNS
- Do not pass `any`-shaped payloads from IPC directly into UI state without normalization.
- Do not remove `src-tauri` watch ignore rule in `ui/vite.config.ts`.
- Do not bypass retry/error handling flow when adding new async invoke actions.
- Do not add business logic directly into App.tsx — it should remain JSX/rendering only.
- Do not duplicate scan/import logic in `useSampleState` — `useScanState` owns that domain.

## COMMANDS
```bash
npm run dev --prefix ui
npm run typecheck --prefix ui
npm run test --prefix ui
npm run build --prefix ui
```

## NOTES
- `App.tsx` is now ~460 lines (JSX only); was ~1460 lines before refactor.
- No generated Tauri types; all backend→UI mapping is manual via `mapRowToSample` in `src/utils/sampleMapper.ts`.
- Test files use hardcoded `/Users/alice/...` macOS paths — acceptable for desktop-only app.
- Zustand `persist` middleware syncs `autoPlayOnSelect` to localStorage under key `osm_settings`.
