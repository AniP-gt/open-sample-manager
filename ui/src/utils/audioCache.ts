import { readFile } from "@tauri-apps/plugin-fs";

type Entry = { url: string; refCount: number };

const cache = new Map<string, Entry>();

export async function getBlobUrlForPath(path: string): Promise<string> {
  const existing = cache.get(path);
  if (existing) {
    existing.refCount += 1;
    return existing.url;
  }

  const fileData = await readFile(path);
  const blob = new Blob([fileData], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  cache.set(path, { url, refCount: 1 });
  return url;
}

export function releaseBlobUrlForPath(path: string) {
  const e = cache.get(path);
  if (!e) return;
  e.refCount -= 1;
  if (e.refCount <= 0) {
    try {
      URL.revokeObjectURL(e.url);
    } catch {}
    cache.delete(path);
  }
}

export function debugCacheSize() {
  return cache.size;
}
