import type { Sample, FilterState, SortState } from "../../types/sample";

export interface SampleListProps {
  samples: Sample[];
  samplePaths: Record<number, string>;
  filters: FilterState;
  sort: SortState;
  selectedSample: Sample | null;
  onSampleSelect: (sample: Sample) => void;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onSortChange: (sort: SortState) => void;
  onDeleteSample: (id: number) => void;
  onTrashSample?: (id: number) => void;
  onTypeClick?: (sample: Sample) => void;
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
}

export type SampleListHandle = {
  focusSelected: () => void;
};

export type ActiveResizeState = { index: number; startX: number; startWidth: number; wasDragging: boolean } | null;
