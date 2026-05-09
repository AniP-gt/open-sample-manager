# MIDI LIST COMPONENT

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f

## OVERVIEW
Large virtualized MIDI table. Handles local fuzzy search, key/tag filters, column resizing with persistence, keyboard navigation, tag badge actions, playback triggers, drag-out preparation, copy/open-folder actions, and pagination sentinels.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Main table | `MidiList.tsx` | 1100+ LOC hotspot; most behavior lives here |
| MIDI state | `../../hooks/useMidiState.ts` | Fetch/search/tag/playback IPC |
| MIDI detail | `../MidiDetailPanel/MidiDetailPanel.tsx` | TiMidity status and tag controls |
| MIDI types | `../../types/midi.ts` | Row/domain contracts |
| Fuzzy search | `../../utils/search.ts` | Used for local filename filtering |

## CONVENTIONS
- Column widths persist under localStorage key `midiListColWidths_v1`.
- `MidiListHandle.focusSelected` supports keyboard and load-around workflows.
- Local search filters `file_name`; key filtering uses first note token from `key_estimate`.
- Tag selection flows through callbacks to `useMidiState`; component should not own tag IPC.
- Playback button delegates to `onTogglePlayback`; TiMidity process control stays in Tauri/hook layers.
- Drag-out mirrors SampleList: prepare path, plugin drag, best-effort cleanup.

## ANTI-PATTERNS
- Do not call `play_midi`/`stop_midi` directly from this component.
- Do not mutate `midiTags` or selected tag state locally except through callbacks.
- Do not remove pagination sentinels or virtualizer root refs.
- Do not add sample-specific path assumptions; MIDI files may use `.mid` or `.midi`.

## NOTES
- Active user changes are present in this file; avoid unrelated refactors.
- Tests for MIDI UI are mostly in `ui/src/__test__/midi-ui.test.tsx`, not co-located here.
