import type { Sample, FilterState, SortState, SampleProcessingSettings } from "../../types/sample";

export interface SampleListProps {
  samples: Sample[];
  samplePaths: Record<number, string>;
  filters: FilterState;
  sort: SortState;
  selectedSample: Sample | null;
  selectedIds?: Set<number>;
  onSampleSelect: (sample: Sample, isShift?: boolean, rangeIds?: Set<number>) => void;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onSortChange: (sort: SortState) => void;
  onDeleteSample: (id: number) => void;
  onTrashSample?: (id: number) => void;
  onTypeClick?: (sample: Sample) => void;
  onMetadataClick?: (sample: Sample) => void;
  onTogglePlayback?: () => void;
  onImportPaths?: (paths: string[]) => void;
  externalIsDragOver?: boolean;
  onLoadMore?: () => Promise<void>;
  isLoadingMore?: boolean;
  canLoadMore?: boolean;
  onLoadPrevious?: () => Promise<void>;
  isLoadingPrevious?: boolean;
  canLoadPrevious?: boolean;
  instrumentColorCoding?: boolean;
  getSampleProcessingSettings?: (sample: Sample, path?: string) => SampleProcessingSettings | undefined;
}

export type SampleListHandle = {
  focusSelected: () => void;
};

export type ActiveResizeState = { index: number; startX: number; startWidth: number; wasDragging: boolean } | null;
