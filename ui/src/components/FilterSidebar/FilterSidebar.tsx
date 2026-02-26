import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FilterState } from "../../types/sample";

interface FilterSidebarProps {
  scannedPaths: string[];
  // full file paths for scanned sample files (e.g. /foo/bar/sample.wav)
  filePaths?: string[];
  selectedPath: string | null;
  onFilterChange: (filters: Partial<FilterState>) => void;
  // called when a file path is clicked in the sidebar
  onPathSelect?: (path: string) => void;
  // Called when external files/folders are dropped onto a folder node in the sidebar
  onImportPaths?: (paths: string[]) => void;
  width?: number;
  bottomInset?: number; // space to leave at the bottom (e.g. player height)
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  isFolder: boolean;
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const fullPath of paths) {
    const parts = fullPath.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = "/" + parts.slice(0, i + 1).join("/");

      let node = current.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          children: [],
          isFolder: !isLast,
        };
        current.push(node);
      }

      current = node.children;
    }
  }

  return root;
}

// Get all ancestor paths for a given path
function getAncestorPaths(path: string): Set<string> {
  const ancestors = new Set<string>();
  const parts = path.split("/").filter(Boolean);
  
  for (let i = 0; i < parts.length; i++) {
    const ancestorPath = "/" + parts.slice(0, i + 1).join("/");
    ancestors.add(ancestorPath);
  }
  
  return ancestors;
}

interface FileTreeItemProps {
  node: TreeNode;
  depth?: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggleExpand: (path: string) => void;
  onMoveSample: (oldPath: string, newPath: string) => void;
  onPathSelect?: (path: string) => void;
  onImportPaths?: (paths: string[]) => void;
}

function FileTreeItem({
  node,
  depth = 0,
  expandedPaths,
  selectedPath,
  onToggleExpand,
  onMoveSample,
  onPathSelect,
  onImportPaths,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedPath === node.path;
  const isAncestorOfSelected = selectedPath ? selectedPath.startsWith(node.path + "/") : false;

  const handleDragOver = (e: React.DragEvent) => {
    if (node.isFolder || hasChildren) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if ((node.isFolder || hasChildren) && e.dataTransfer) {
      e.preventDefault();
      e.stopPropagation();
      // If the drop contains files from the OS, prefer treating it as an import
      try {
        const dt = e.dataTransfer;
        const uriList = dt?.getData && (dt.getData("text/uri-list") || dt.getData("text/plain"));
        const hasFiles = (dt && (dt.files && dt.files.length > 0)) || !!uriList;

        if (hasFiles) {
          // Dynamically import the shared utility to avoid circular imports and keep this file light
          import("../../utils/dataTransfer").then((mod) => {
            const paths = mod.extractPathsFromDataTransfer(e.dataTransfer ?? null);
            if (paths && paths.length > 0) {
              onImportPaths?.(paths);
              return;
            }
            // Fallback to treating as internal move if no filesystem paths found
            const draggedPath = dt.getData("text/plain");
            if (draggedPath) {
              const fileName = draggedPath.split("/").pop() || "sample.wav";
              const newPath = `${node.path}/${fileName}`;
              if (draggedPath !== newPath) {
                onMoveSample(draggedPath, newPath);
              }
            }
          }).catch(() => {
            // On dynamic import failure, fall back to internal move
            const draggedPath = e.dataTransfer.getData("text/plain");
            if (draggedPath) {
              const fileName = draggedPath.split("/").pop() || "sample.wav";
              const newPath = `${node.path}/${fileName}`;
              if (draggedPath !== newPath) {
                onMoveSample(draggedPath, newPath);
              }
            }
          });
          return;
        }

        // Internal drag from within the app (text/plain path)
        const draggedPath = e.dataTransfer.getData("text/plain");
        if (draggedPath) {
          const fileName = draggedPath.split("/").pop() || "sample.wav";
          const newPath = `${node.path}/${fileName}`;
          if (draggedPath !== newPath) {
            onMoveSample(draggedPath, newPath);
          }
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
          cursor: "pointer",
              color: isSelected ? "#f97316" : isAncestorOfSelected ? "#9ca3af" : "#6b7280",
              fontSize: "13px",
              fontFamily: "'Courier New', monospace",
              borderRadius: "2px",
              background: isSelected ? "#1f2937" : "transparent",
            }}
            onClick={() => {
          // If node is a folder toggle expand; always call onPathSelect so
          // parent can handle clicking a sample (leaf) or a folder path.
          if (hasChildren) {
            onToggleExpand(node.path);
          }
          onPathSelect?.(node.path);
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
      {isExpanded &&
        node.children.map((child) => (
          <FileTreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            onToggleExpand={onToggleExpand}
            onMoveSample={onMoveSample}
            onPathSelect={onPathSelect}
          />
        ))}
    </div>
  );
}

export function FilterSidebar({
  scannedPaths,
  filePaths,
  selectedPath,
  onFilterChange,
  onPathSelect,
  onImportPaths,
  width = 180,
  bottomInset = 0,
}: FilterSidebarProps) {
  // Sidebar is now a simple file tree container; no top/bottom split or resizer.

  // No filter controls here anymore; counts and tags are rendered in the DetailPanel

  const tree = useMemo(() => buildTree([...(scannedPaths || []), ...(filePaths || [])]), [scannedPaths, filePaths]);
  
  // Track expanded paths
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Initially expand first 2 levels
    tree.forEach((node) => {
      initial.add(node.path);
      node.children.forEach((child) => {
        initial.add(child.path);
      });
    });
    return initial;
  });

  // Auto-expand tree when a sample is selected
  useEffect(() => {
    if (selectedPath) {
      const ancestors = getAncestorPaths(selectedPath);
      setExpandedPaths((prev) => {
        const newSet = new Set(prev);
        let changed = false;
        ancestors.forEach((path) => {
          if (!newSet.has(path)) {
            newSet.add(path);
            changed = true;
          }
        });
        return changed ? newSet : prev;
      });
    }
  }, [selectedPath]);

  const handleToggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleMoveSample = async (oldPath: string, newPath: string) => {
    try {
      await invoke<string>("move_sample", { oldPath, newPath });
      // Refresh the list after move
      onFilterChange({}); // Trigger a refresh
    } catch (error) {
      console.error("Failed to move sample:", error);
    }
  };

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0, // allow flex children to shrink so internal scrolling works
        width: `${width}px`,
        borderRight: "1px solid #0f1117",
        background: "#0a0c12",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
      className="filter-sidebar-root"
    >
      {/* Top: file tree only — controls were moved to the right/detail panel */}
      {/* Make this a flexible scroll container. Use flex:1 + minHeight:0 so
          in a flex layout the browser allows the child to be scrollable.
          paddingBottom includes bottomInset so content isn't hidden under
          an overlapping bottom UI (player bar). */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          paddingTop: "12px",
          paddingLeft: "0",
          paddingRight: "0",
          paddingBottom: `${12 + bottomInset}px`,
        }}
      >
        {scannedPaths.length > 0 ? (
          <>
            <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em", padding: "0 12px 8px" }}>
              SCANNED FOLDERS
            </div>
            {tree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                depth={0}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                onToggleExpand={handleToggleExpand}
                onMoveSample={handleMoveSample}
                onPathSelect={onPathSelect}
                onImportPaths={onImportPaths}
              />
            ))}
          </>
        ) : (
          <div style={{ padding: "16px 12px", fontSize: "12px", color: "#4b5563", fontFamily: "'Courier New', monospace" }}>
            No folders scanned
          </div>
        )}
      </div>
    </div>
  );
}
