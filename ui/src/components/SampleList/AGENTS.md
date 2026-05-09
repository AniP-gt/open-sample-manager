# SAMPLE LIST COMPONENT

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f

## OVERVIEW
Large virtualized desktop sample table. Handles local filtering/sorting, column resizing, keyboard navigation, favorites, drag-out preparation, copy/open-folder actions, pagination sentinels, and grid/table view switching.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Main table | `SampleList.tsx` | 1200+ LOC hotspot; most behavior lives here |
| Grid view | `GridView.tsx` | Card/grid rendering for sample view mode |
| Drop behavior tests | `__test__/drop.test.tsx` | Drop to import paths |
| URI extraction tests | `__test__/extractPaths.test.ts` | macOS/Windows file URI parsing |
| Search utility | `../../utils/search.ts` | Fuzzy filtering imported by list |
| Favorites store | `../../store/useFavoritesStore.ts` | Star state and persistence |

## CONVENTIONS
- `@tanstack/react-virtual` owns row virtualization; keep `rowHeight` and `overscan` deliberate.
- Column widths are local state, not global settings, unlike MIDI list which persists widths.
- Drop/import paths flow through `onImportPaths`; do not invoke scan commands here.
- Drag-out uses `prepare_drag_file`, plugin drag commands, then best-effort temp-file deletion.
- Search filtering uses `matchesFuzzySearch(filters.search, [file_name, ...tags])`.
- `focusSelected` is exposed through `SampleListHandle` for keyboard navigation and load-around flows.

## ANTI-PATTERNS
- Do not add more cross-cutting behavior without considering extraction to a hook or child component.
- Do not bypass `samplePaths` for filesystem actions; row data alone may not carry original path.
- Do not break Windows `file:///C:/...` and macOS path handling in drag/drop helpers.
- Do not remove sentinels; they drive load-more/load-previous pagination.

## NOTES
- Active user changes are present in this file; avoid unrelated refactors.
- `instrumentColorCoding` changes row/accent colors only; classification semantics stay in hooks/core.
