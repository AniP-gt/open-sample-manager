import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
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
  useTranslation();
  if (scannedPaths.length === 0) {
    return <div style={{ padding: "16px 12px", fontSize: "12px", color: "var(--osm-secondary)", fontFamily: "var(--osm-font)" }}>{translate("noFoldersScanned")}</div>;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px 8px" }}>
        <div style={{ fontSize: "11px", color: "var(--osm-secondary)", letterSpacing: "0.04em" }}>{translate("scannedFolders")}</div>
        {activeDirectoryPath && (
          <button type="button" title={translate("clearDirectoryFilter")} aria-label={translate("clearDirectoryFilter")} onClick={onClearDirectoryPath} style={{ background: "transparent", border: "none", color: "#f97316", fontSize: "11px", cursor: "pointer", fontFamily: "var(--osm-font)", padding: 0 }}>
            {translate("clear")}
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
