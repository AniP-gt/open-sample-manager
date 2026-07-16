import type { MutableRefObject } from "react";
import { FileTreeItem } from "./FileTreeItem";
import type { TreeNode } from "./types";

interface ScannedFoldersProps {
  scannedPaths: string[];
  tree: TreeNode[];
  expandedPaths: Set<string>;
  selectedPath: string | null;
  activeDirectoryPath?: string | null;
  onClearDirectoryPath?: () => void;
  onToggleExpand: (path: string) => void;
  onMoveSample: (oldPath: string, newPath: string) => void;
  onPathSelect?: (path: string) => void;
  onImportPaths?: (paths: string[]) => void;
  draggableFilePaths: Set<string>;
  preparedPathsRef: MutableRefObject<Record<string, string>>;
  dragIconPathRef: MutableRefObject<string>;
}

export function ScannedFolders({
  scannedPaths,
  tree,
  expandedPaths,
  selectedPath,
  activeDirectoryPath,
  onClearDirectoryPath,
  onToggleExpand,
  onMoveSample,
  onPathSelect,
  onImportPaths,
  draggableFilePaths,
  preparedPathsRef,
  dragIconPathRef,
}: ScannedFoldersProps) {
  if (scannedPaths.length === 0) {
    return <div style={{ padding: "16px 12px", fontSize: "12px", color: "#4b5563", fontFamily: "'Courier New', monospace" }}>No folders scanned</div>;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px 8px" }}>
        <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em" }}>SCANNED FOLDERS</div>
        {activeDirectoryPath && (
          <button type="button" title="Clear directory filter" aria-label="Clear directory filter" onClick={onClearDirectoryPath} style={{ background: "transparent", border: "none", color: "#f97316", fontSize: "11px", cursor: "pointer", fontFamily: "'Courier New', monospace", padding: 0 }}>
            [clear]
          </button>
        )}
      </div>
      {tree.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          onToggleExpand={onToggleExpand}
          onMoveSample={onMoveSample}
          onPathSelect={onPathSelect}
          onImportPaths={onImportPaths}
          draggableFilePaths={draggableFilePaths}
          preparedPathsRef={preparedPathsRef}
          dragIconPathRef={dragIconPathRef}
        />
      ))}
    </>
  );
}
