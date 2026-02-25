// Lightweight helper to extract filesystem paths or filenames from a
// DataTransfer-like object. Supports both browser text/uri-list payloads and
// DataTransfer File items that expose a `path` (as in Tauri/Electron).
export function extractPathsFromDataTransfer(dataTransfer: DataTransfer | null): string[] {
  const paths: string[] = [];

  const items = (dataTransfer as any)?.items;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      try {
        const file = item.getAsFile?.();
        if (!file) continue;
        const maybePath = (file as File & { path?: string }).path;
        if (maybePath) {
          paths.push(maybePath);
          continue;
        }
        // Fallback to filename when full path is unavailable in browser
        paths.push(file.name);
      } catch (err) {
        // ignore
      }
    }
  }

  if (paths.length === 0) {
    const uriList = (dataTransfer as any)?.getData?.('text/uri-list') || (dataTransfer as any)?.getData?.('text/plain') || '';
    if (uriList) {
    const lines = uriList.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('file://')) {
          try {
            const decoded = decodeURI(line.replace(/^file:\/\//, ''));
            const winMatch = decoded.match(/^\/?[A-Za-z]:/);
            const path = winMatch ? decoded.replace(/^\//, '') : decoded;
            paths.push(path);
          } catch {
            paths.push(line);
          }
        } else {
          paths.push(line);
        }
      }
    }
  }

  return Array.from(new Set(paths));
}
