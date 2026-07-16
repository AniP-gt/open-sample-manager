import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Sample } from "../../types/sample";
import { useRecentStore } from "../../store/useRecentStore";
import { loadDragIconPath } from "../fileDragOut";
import { CollectionSelector } from "../CollectionSelector/CollectionSelector";
import { FilterControls } from "./FilterControls";
import { RecentSection } from "./RecentSection";
import { ScannedFolders } from "./ScannedFolders";
import { buildTree, getAncestorPaths, normalizeTreePath } from "./treeUtils";
import type { FilterSidebarProps } from "./types";

export function FilterSidebar({
  scannedPaths,
  filePaths,
  selectedPath,
  onFilterChange,
  onPathSelect,
  onImportPaths,
  width = 180,
  bottomInset = 0,
  favoritesOnly = false,
  hideDuplicates = false,
  duplicateCount = 0,
  filterKey = "",
  samples = [],
  onSampleSelect,
  activeDirectoryPath,
  onClearDirectoryPath,
  favoritesCount = 0,
  collections = [],
  activeCollectionId = null,
  isCollectionView = false,
  onSelectCollection,
  onClearCollection,
}: FilterSidebarProps) {
  const { recentIds } = useRecentStore();
  const preparedPathsRef = useRef<Record<string, string>>({});
  const dragIconPathRef = useRef<string>("");
  const sampleById = useMemo(() => {
    const map = new Map<number, Sample>();
    for (const sample of samples) map.set(sample.id, sample);
    return map;
  }, [samples]);
  const tree = useMemo(() => buildTree([...(scannedPaths || []), ...(filePaths || [])]), [scannedPaths, filePaths]);
  const draggableFilePaths = useMemo(() => new Set((filePaths || []).map(normalizeTreePath)), [filePaths]);

  useEffect(() => {
    loadDragIconPath(dragIconPathRef);
  }, []);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    tree.forEach((node) => {
      initial.add(node.path);
      node.children.forEach((child) => initial.add(child.path));
    });
    return initial;
  });

  useEffect(() => {
    if (selectedPath) {
      const ancestors = getAncestorPaths(selectedPath);
      setExpandedPaths((previous) => {
        const next = new Set(previous);
        let changed = false;
        ancestors.forEach((path) => {
          if (!next.has(path)) {
            next.add(path);
            changed = true;
          }
        });
        return changed ? next : previous;
      });
    }
  }, [selectedPath]);

  const handleToggleExpand = (path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleMoveSample = async (oldPath: string, newPath: string) => {
    try {
      await invoke<string>("move_sample", { oldPath, newPath });
      onFilterChange({});
    } catch (error) {
      console.error("Failed to move sample:", error);
    }
  };

  return (
    <div style={{ height: "100%", minHeight: 0, width: `${width}px`, borderRight: "1px solid #0f1117", background: "#0a0c12", display: "flex", flexDirection: "column", flexShrink: 0 }} className="filter-sidebar-root">
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: "12px", paddingLeft: "0", paddingRight: "0", paddingBottom: `${12 + bottomInset}px` }}>
        <FilterControls favoritesOnly={favoritesOnly} hideDuplicates={hideDuplicates} duplicateCount={duplicateCount} filterKey={filterKey} favoritesCount={favoritesCount} onFilterChange={onFilterChange} />
        <CollectionSelector collections={collections} activeCollectionId={activeCollectionId} isCollectionView={isCollectionView} onSelectCollection={(collectionId) => onSelectCollection?.(collectionId)} onClearCollection={() => onClearCollection?.()} />
        <ScannedFolders scannedPaths={scannedPaths} tree={tree} expandedPaths={expandedPaths} selectedPath={selectedPath} activeDirectoryPath={activeDirectoryPath} onClearDirectoryPath={onClearDirectoryPath} onToggleExpand={handleToggleExpand} onMoveSample={handleMoveSample} onPathSelect={onPathSelect} onImportPaths={onImportPaths} draggableFilePaths={draggableFilePaths} preparedPathsRef={preparedPathsRef} dragIconPathRef={dragIconPathRef} />
        <RecentSection recentIds={recentIds} sampleById={sampleById} onSampleSelect={onSampleSelect} />
      </div>
    </div>
  );
}
