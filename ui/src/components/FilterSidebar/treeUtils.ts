import type { TreeNode } from "./types";

export function normalizeTreePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const fullPath of paths) {
    const normalizedPath = normalizeTreePath(fullPath);
    const parts = normalizedPath.split("/").filter(Boolean);
    const rootPrefix = normalizedPath.startsWith("/") ? "/" : "";
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = rootPrefix + parts.slice(0, i + 1).join("/");
      let node = current.find((candidate) => candidate.name === part);

      if (!node) {
        node = { name: part, path: currentPath, children: [], isFolder: !isLast };
        current.push(node);
      }

      current = node.children;
    }
  }

  return root;
}

export function getAncestorPaths(path: string): Set<string> {
  const ancestors = new Set<string>();
  const normalizedPath = normalizeTreePath(path);
  const parts = normalizedPath.split("/").filter(Boolean);
  const rootPrefix = normalizedPath.startsWith("/") ? "/" : "";

  for (let i = 0; i < parts.length; i++) {
    ancestors.add(rootPrefix + parts.slice(0, i + 1).join("/"));
  }

  return ancestors;
}
