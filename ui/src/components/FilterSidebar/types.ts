import type { Collection } from "../../types/collection";
import type { FilterState, Sample } from "../../types/sample";

export interface FilterSidebarProps {
  scannedPaths: string[];
  filePaths?: string[];
  selectedPath: string | null;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onPathSelect?: (path: string) => void;
  onImportPaths?: (paths: string[]) => void;
  width?: number;
  bottomInset?: number;
  favoritesOnly?: boolean;
  hideDuplicates?: boolean;
  duplicateCount?: number;
  filterKey?: string;
  samples?: Sample[];
  onSampleSelect?: (sample: Sample) => void;
  activeDirectoryPath?: string | null;
  onClearDirectoryPath?: () => void;
  favoritesCount?: number;
  collections?: readonly Collection[];
  activeCollectionId?: number | null;
  isCollectionView?: boolean;
  onSelectCollection?: (collectionId: number) => void;
  onClearCollection?: () => void;
}

export interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  isFolder: boolean;
}
