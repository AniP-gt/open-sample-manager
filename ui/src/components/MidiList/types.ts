import type { Midi, MidiTagRow } from "../../types/midi";

export interface MidiListProps {
  midis: Midi[];
  selectedMidi: Midi | null;
  selectedMidiIds?: Set<number>;
  onMidiSelect: (midi: Midi, isShift?: boolean, rangeIds?: Set<number>) => void;
  onTagBadgeClick?: (midi: Midi) => void;
  midiTags?: MidiTagRow[];
  onTagFilterChange?: (tagId: number | null) => void;
  tagFilterId?: number | null;
  onMidiTagChange?: (midiId: number, tagName: string | null) => void;
  onImportPaths?: (paths: string[]) => void;
  externalIsDragOver?: boolean;
  onLoadMore?: () => Promise<void> | void;
  isLoadingMore?: boolean;
  canLoadMore?: boolean;
  onLoadPrevious?: () => Promise<void> | void;
  isLoadingPrevious?: boolean;
  canLoadPrevious?: boolean;
  onTrashMidi?: (id: number) => void;
  midiSearch?: string;
  onMidiSearchChange?: (query: string) => void;
  onTogglePlayback?: () => void;
  filterKey?: string;
}

export type MidiListHandle = {
  focusSelected: () => void;
};
