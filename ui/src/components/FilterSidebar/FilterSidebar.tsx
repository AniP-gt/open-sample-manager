import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Sample, SampleType, FilterState } from "../../types/sample";

interface FilterSidebarProps {
  samples: Sample[];
  filters: FilterState;
  scannedPaths: string[];
  selectedPath: string | null;
  onFilterChange: (filters: Partial<FilterState>) => void;
  width?: number;
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
}

function FileTreeItem({
  node,
  depth = 0,
  expandedPaths,
  selectedPath,
  onToggleExpand,
  onMoveSample,
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
      
      const draggedPath = e.dataTransfer.getData("text/plain");
      if (draggedPath) {
        const fileName = draggedPath.split("/").pop() || "sample.wav";
        const newPath = `${node.path}/${fileName}`;
        
        if (draggedPath !== newPath) {
          onMoveSample(draggedPath, newPath);
        }
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
          cursor: node.isFolder ? "pointer" : "default",
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
          />
        ))}
    </div>
  );
}

export function FilterSidebar({
  samples,
  filters,
  scannedPaths,
  selectedPath,
  onFilterChange,
  width = 180,
}: FilterSidebarProps) {
  const allTags = [...new Set(samples.flatMap((s) => s.tags))].slice(0, 14);

  const typeFilters: Array<SampleType | "all"> = [
    "all",
    "kick",
    "loop",
    "one-shot",
  ];

  const getTypeCount = (type: SampleType | "all") => {
    return type === "all"
      ? samples.length
      : samples.filter((s) => s.sample_type === type).length;
  };

  const tree = useMemo(() => buildTree(scannedPaths), [scannedPaths]);
  
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
        width: `${width}px`,
        borderRight: "1px solid #0f1117",
        background: "#0a0c12",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 0",
          borderBottom: "1px solid #1f2937",
        }}
      >
        {scannedPaths.length > 0 ? (
          <>
            <div
              style={{
                fontSize: "11px",
                color: "#374151",
                letterSpacing: "0.14em",
                padding: "0 12px 8px",
              }}
            >
              SCANNED FOLDERS
            </div>
            {tree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                onToggleExpand={handleToggleExpand}
                onMoveSample={handleMoveSample}
              />
            ))}
          </>
        ) : (
          <div
            style={{
              padding: "16px 12px",
              fontSize: "12px",
              color: "#4b5563",
              fontFamily: "'Courier New', monospace",
            }}
          >
            No folders scanned
          </div>
        )}
      </div>

      <div
        style={{
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          overflowY: "auto",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#374151",
              letterSpacing: "0.14em",
              marginBottom: "8px",
            }}
          >
            SAMPLE TYPE
          </div>
          {typeFilters.map((t) => (
            <button
              key={t}
              onClick={() => onFilterChange({ filterType: t })}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: filters.filterType === t ? "#111827" : "transparent",
                border: "none",
                borderLeft:
                  filters.filterType === t
                    ? "2px solid #f97316"
                    : "2px solid transparent",
                padding: "4px 8px",
                fontFamily: "'Courier New', monospace",
                fontSize: "14px",
                color: filters.filterType === t ? "#f1f5f9" : "#6b7280",
                cursor: "pointer",
                letterSpacing: "0.08em",
                marginBottom: "2px",
                borderRadius: "0 2px 2px 0",
              }}
            >
              {t.toUpperCase()}
              <span
                style={{ float: "right", color: "#374151", fontSize: "13px" }}
              >
                {getTypeCount(t)}
              </span>
            </button>
          ))}
        </div>

        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#374151",
              letterSpacing: "0.14em",
              marginBottom: "8px",
            }}
          >
            BPM RANGE
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <div
              style={{
                flex: 1,
                border: "1px solid #1f2937",
                borderRadius: "2px",
                padding: "4px 6px",
              }}
            >
              <input
                type="number"
                placeholder="MIN"
                value={filters.filterBpmMin}
                onChange={(e) =>
                  onFilterChange({ filterBpmMin: e.target.value })
                }
                style={{
                  width: "100%",
                  fontSize: "13px",
                  color: "#9ca3af",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                }}
              />
            </div>
            <span style={{ color: "#374151", fontSize: "13px" }}>—</span>
            <div
              style={{
                flex: 1,
                border: "1px solid #1f2937",
                borderRadius: "2px",
                padding: "4px 6px",
              }}
            >
              <input
                type="number"
                placeholder="MAX"
                value={filters.filterBpmMax}
                onChange={(e) =>
                  onFilterChange({ filterBpmMax: e.target.value })
                }
                style={{
                  width: "100%",
                  fontSize: "13px",
                  color: "#9ca3af",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#374151",
              letterSpacing: "0.14em",
              marginBottom: "8px",
            }}
          >
            TAGS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {allTags.map((tag) => (
              <span
                key={tag}
                className="tag-chip"
                onClick={() => onFilterChange({ search: tag })}
                style={{
                  fontSize: "12px",
                  padding: "2px 6px",
                  background: "#0f1117",
                  border: "1px solid #1f2937",
                  borderRadius: "2px",
                  color: "#6b7280",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
