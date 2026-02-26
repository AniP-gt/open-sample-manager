# UI KNOWLEDGE BASE

**Generated:** 2026-02-24T15:43:13+0900
**Commit:** edf68d0
**Branch:** main

## OVERVIEW
React + TypeScript frontend for search/filter/scan UX, wired to Tauri commands through typed invoke calls and local mapping logic.

## STRUCTURE
```text
ui/
|- src/App.tsx            # state orchestration + invoke/listen integration
|- src/components/*/      # one-folder-per-component pattern
|- src/types/             # shared UI domain types
|- src/test/              # Vitest setup and placeholder spec
|- vite.config.ts         # dev server + Vitest + Tauri watch rules
`- tsconfig*.json         # strict TS checks for app + node configs
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Backend command usage | `ui/src/App.tsx` | `invoke(...)` and `scan-progress` listener wiring |
| Type contracts | `ui/src/types/sample.ts`, `ui/src/types/scan.ts` | Domain model used across components |
| Similarity UI flow | `ui/src/components/DetailPanel/DetailPanel.tsx` | Embedding search interaction (component removed) |
| Component exports | `ui/src/components/index.ts` | Barrel list for top-level imports |
| Test setup | `ui/src/test/setup.ts`, `ui/src/test/placeholder.test.ts` | Vitest + jest-dom bootstrapping |

## CONVENTIONS
- Keep explicit value mapping between backend rows and UI types (normalize unknowns safely).
- Build pipeline requires typecheck before Vite build (`npm run build`).
- Vite dev server is fixed to port `5173`; keep this in sync with Tauri config.
- Component organization is directory-per-component with inline style objects.

## ANTI-PATTERNS
- Do not pass `any`-shaped payloads from IPC directly into UI state without normalization.
- Do not remove `src-tauri` watch ignore rule in `ui/vite.config.ts`.
- Do not bypass retry/error handling flow when adding new async invoke actions.

## COMMANDS
```bash
npm run dev --prefix ui
npm run typecheck --prefix ui
npm run test --prefix ui
npm run build --prefix ui
```

## NOTES
- `ui/src/App.tsx` is a high-complexity file (state + scan lifecycle + filter logic); keep changes bounded and typed.
