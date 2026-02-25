export type StatFn = (p: string) => Promise<{ isDirectory: boolean; isFile: boolean }>;

export async function resolveDroppedPaths(paths: string[], statFn?: StatFn): Promise<string[]> {
  if (!paths || paths.length === 0) return [];

  const normalizedTargets: string[] = [];

  const results = await Promise.allSettled(
    paths.map(async (p) => {
      if (!p) return null;
      const normalized = p.replace(/\\/g, "/");

      if (statFn) {
        try {
          const info = await statFn(normalized);
          if (info.isDirectory) return normalized;
          if (info.isFile) {
            const parts = normalized.split("/");
            return parts.slice(0, -1).join("/") || "/";
          }
        } catch {
          // stat failed; fall back to heuristic below
        }
      }

      // Heuristic fallback: treat last segment with a dot as file
      const parts = normalized.split("/");
      const last = parts[parts.length - 1] ?? "";
      if (last.includes(".")) {
        return parts.slice(0, -1).join("/") || "/";
      }
      return normalized;
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) normalizedTargets.push(r.value);
  }

  // Deduplicate while preserving order
  return Array.from(new Set(normalizedTargets));
}
