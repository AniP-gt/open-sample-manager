const importFileNames = new Set(["samples.db"]);

export function getLibraryImportFolderPath(selectedPath: string): string | null {
  const normalized = selectedPath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;

  if (!importFileNames.has(fileName)) {
    return null;
  }

  return lastSlash > 0 ? normalized.slice(0, lastSlash) : "/";
}
