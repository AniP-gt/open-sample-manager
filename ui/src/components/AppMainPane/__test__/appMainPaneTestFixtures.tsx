import { createRef } from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import "./appMainPaneTestDoubles";
import { AppMainPane } from "../AppMainPane";
import type { useMidiState } from "../../../hooks/useMidiState";
import type { useSampleState } from "../../../hooks/useSampleState";
import type { useScanState } from "../../../hooks/useScanState";
import type { useUIState } from "../../../hooks/useUIState";
import type { Midi } from "../../../types/midi";
import type { Sample } from "../../../types/sample";
import type { ViewMode } from "../../../types/viewMode";
import type { MidiListHandle } from "../../MidiList/types";
import type { PlayerBarHandle } from "../../PlayerBar/PlayerBar";
import type { SampleListHandle } from "../../SampleList/types";

export const sample: Sample = { id: 1, file_name: "kick.wav", duration: 1, bpm: 120, periodicity: 0, low_ratio: 0.8, sample_rate: 44100, attack_slope: 0.9, decay_time: null, sample_type: "one-shot", tags: [], waveform_peaks: null, playback_type: "oneshot", instrument_type: "kick", musical_key: "C", quality_flags: [] };
export const midi: Midi = { id: 2, file_name: "beat.mid", path: "/library/beat.mid", duration: null, tempo: null, time_signature_numerator: 4, time_signature_denominator: 4, track_count: null, note_count: null, channel_count: null, key_estimate: null, file_size: null, created_at: "", modified_at: "", tag_name: "" };

type RenderOverrides = {
  readonly viewMode?: ViewMode;
  readonly selectedSample?: Sample | null;
  readonly selectedMidi?: Midi | null;
  readonly sampleDirectoryPath?: string;
  readonly midiDirectoryPath?: string;
  readonly isMidiPlaying?: boolean;
  readonly directoryClickFiltering?: boolean;
};

export function renderPane(overrides: RenderOverrides = {}) {
  const uiState = { viewMode: overrides.viewMode ?? "sample", isResizing: false, handleMouseDown: vi.fn(), sidebarWidth: 240, isDragOver: false } as unknown as ReturnType<typeof useUIState>;
  const scanState = { handleSidebarImport: vi.fn(), handleImportPaths: vi.fn(), setError: vi.fn() } as unknown as ReturnType<typeof useScanState>;
  const sampleState = {
    scannedPaths: ["/library/kick.wav"], allSamplePaths: ["/library/kick.wav"], selected: overrides.selectedSample ?? null, samplePaths: { 1: "/library/kick.wav" },
    filters: { directoryPath: overrides.sampleDirectoryPath ?? "", favoritesOnly: false, hideDuplicates: false, filterKey: "", filterLicense: "", qualityIssuesOnly: false },
    handleFilterChange: vi.fn(), suppressNextSearch: vi.fn(), loadSampleByPath: vi.fn(), setSelected: vi.fn(), samples: [sample], sort: { field: "id", direction: "asc" }, setSort: vi.fn(), handleDeleteSample: vi.fn(), requestTrash: vi.fn(), handleTypeClick: vi.fn(), loadMore: vi.fn(), isLoadingMore: false, lastFetchCount: 50, loadPrevious: vi.fn(), isLoadingPrevious: false, canLoadPrevious: true, togglePlayback: vi.fn(), instrumentTypes: [{ id: 1, name: "kick", created_at: "" }],
  } as unknown as ReturnType<typeof useSampleState>;
  const midiState = {
    midiScannedPaths: ["/library/beat.mid"], allMidiPaths: ["/library/kick.wav"], selectedMidi: overrides.selectedMidi ?? null, selectedMidiIds: new Set<number>(overrides.selectedMidi ? [overrides.selectedMidi.id] : []), directoryPath: overrides.midiDirectoryPath ?? "", suppressNextMidiSearch: vi.fn(), setDirectoryPath: vi.fn(), loadMidiByPath: vi.fn(), isMidiPlaying: overrides.isMidiPlaying ?? false, togglePlaySelectedMidi: vi.fn(), setSelectedMidi: vi.fn(), setMidiTagEditTargetIds: vi.fn(), handleMidiSelect: vi.fn(), setMidiTagEditTarget: vi.fn(), setMidiTagEditOpen: vi.fn(), midiTags: [{ id: 3, name: "drums", created_at: "" }], setMidiTagFilterId: vi.fn(), midiTagFilterId: null, requestTrashMidi: vi.fn(), loadMoreMidi: vi.fn(), isLoadingMoreMidi: false, lastFetchCountMidi: null, loadPreviousMidi: vi.fn(), isLoadingPreviousMidi: false, canLoadPreviousMidi: true, midiSearch: "", setMidiSearch: vi.fn(), setMidiTagModalOpen: vi.fn(), _timidityStatus: { installed: true, install_command: "" },
  } as unknown as ReturnType<typeof useMidiState>;
  const playerBarRef = { current: { stop: vi.fn() } as unknown as PlayerBarHandle };
  const handleSampleSelectWithRecent = vi.fn();
  const { container } = render(<AppMainPane uiState={uiState} scanState={scanState} sampleState={sampleState} midiState={midiState} playerBarRef={playerBarRef} sampleListRef={createRef<SampleListHandle>()} midiListRef={createRef<MidiListHandle>()} displayedSamples={[sample]} samplePaths={{ 1: "/library/kick.wav" }} collections={[]} activeCollectionId={null} isCollectionView={false} onSelectCollection={vi.fn()} onClearCollection={vi.fn()} filteredMidis={[midi]} instrumentColorCoding directoryClickFiltering={overrides.directoryClickFiltering ?? true} showSampleMetadataQuality handleSampleSelectWithRecent={handleSampleSelectWithRecent} />);

  return { uiState, scanState, sampleState, midiState, playerBarRef, handleSampleSelectWithRecent, container };
}
