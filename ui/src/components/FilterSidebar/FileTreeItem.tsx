import type { DragEvent, MutableRefObject } from "react";
import { prepareDragFile, startFileDrag } from "../fileDragOut";
import type { TreeNode } from "./types";
import { normalizeTreePath } from "./treeUtils";

interface FileTreeItemProps {
  node: TreeNode;
  depth?: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggleExpand: (path: string) => void;
  onMoveSample: (oldPath: string, newPath: string) => void;
  onPathSelect?: (path: string) => void;
  onImportPaths?: (paths: string[]) => void;
  draggableFilePaths: Set<string>;
  preparedPathsRef: MutableRefObject<Record<string, string>>;
  dragIconPathRef: MutableRefObject<string>;
}

export function FileTreeItem({
  node,
  depth = 0,
  expandedPaths,
  selectedPath,
  onToggleExpand,
  onMoveSample,
  onPathSelect,
  onImportPaths,
  draggableFilePaths,
  preparedPathsRef,
  dragIconPathRef,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedPath === node.path;
  const isAncestorOfSelected = selectedPath ? selectedPath.startsWith(node.path + "/") : false;
  const isDraggableFile = draggableFilePaths.has(normalizeTreePath(node.path));

  const moveDraggedPath = (draggedPath: string) => {
    const fileName = draggedPath.split("/").pop() || "sample.wav";
    const newPath = `${node.path}/${fileName}`;
    if (draggedPath !== newPath) {
      onMoveSample(draggedPath, newPath);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    if (node.isFolder || hasChildren) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleDrop = (e: DragEvent) => {
    if ((node.isFolder || hasChildren) && e.dataTransfer) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const dt = e.dataTransfer;
        const uriList = dt?.getData && (dt.getData("text/uri-list") || dt.getData("text/plain"));
        const hasFiles = (dt && (dt.files && dt.files.length > 0)) || !!uriList;

        if (hasFiles) {
          import("../../utils/dataTransfer").then((mod) => {
            const paths = mod.extractPathsFromDataTransfer(e.dataTransfer ?? null);
            if (paths && paths.length > 0) {
              onImportPaths?.(paths);
              return;
            }
            const draggedPath = dt.getData("text/plain");
            if (draggedPath) {
              moveDraggedPath(draggedPath);
            }
          }).catch(() => {
            const draggedPath = e.dataTransfer.getData("text/plain");
            if (draggedPath) {
              moveDraggedPath(draggedPath);
            }
          });
          return;
        }

        const draggedPath = e.dataTransfer.getData("text/plain");
        if (draggedPath) {
          moveDraggedPath(draggedPath);
        }
      } catch (err) {
        // ignore and allow default behavior
      }
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 8px",
          paddingLeft: `${depth * 12 + 8}px`,
          cursor: isDraggableFile ? "grab" : "pointer",
          color: isSelected ? "#f97316" : isAncestorOfSelected ? "#9ca3af" : "#6b7280",
          fontSize: "13px",
          fontFamily: "'Courier New', monospace",
          borderRadius: "2px",
          background: isSelected ? "#1f2937" : "transparent",
        }}
        onClick={() => {
          if (hasChildren) {
            onToggleExpand(node.path);
          }
          onPathSelect?.(node.path);
        }}
        draggable={isDraggableFile}
        onMouseDown={(e) => {
          if (e.button === 0 && isDraggableFile) {
            prepareDragFile(node.path, node.path, preparedPathsRef);
          }
        }}
        onDragStart={(e) => {
          if (!isDraggableFile) return;
          e.stopPropagation();
          startFileDrag(e, node.path, node.path, preparedPathsRef, dragIconPathRef.current, "[sidebar-dragout]");
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {hasChildren ? (
          <span style={{ marginRight: "4px", color: "#4b5563" }}>
            {isExpanded ? "▼" : "▶"}
          </span>
        ) : (
          <span style={{ marginRight: "4px", width: "12px", display: "inline-block" }}>♪</span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name}
        </span>
      </div>
      {isExpanded && node.children.map((child) => (
        <FileTreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
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
    </div>
  );
}
