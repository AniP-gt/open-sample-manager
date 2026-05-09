import type { Sample } from "../../types/sample";
import type { TauriSampleRow } from "../../types/tauri";
import { mapRowToSample } from "../../utils/sampleMapper";

export type SamplePathMap = Record<number, string>;

export function mapSampleRowsToSamples(rows: TauriSampleRow[]): Sample[] {
  return rows.map(mapRowToSample);
}

export function mapSampleRowsToPathMap(rows: TauriSampleRow[]): SamplePathMap {
  const nextPaths: SamplePathMap = {};

  rows.forEach((row) => {
    nextPaths[row.id] = row.path;
  });

  return nextPaths;
}

export function mergeSampleRowsIntoPathMap(prev: SamplePathMap, rows: TauriSampleRow[]): SamplePathMap {
  const copy: SamplePathMap = { ...prev };

  rows.forEach((row) => {
    copy[row.id] = row.path;
  });

  return copy;
}

export function appendFreshSamples(prev: Sample[], nextSamples: Sample[]): Sample[] {
  const existingIds = new Set(prev.map((sample) => sample.id));
  const fresh = nextSamples.filter((sample) => !existingIds.has(sample.id));
  return [...prev, ...fresh];
}

export function prependFreshSamples(prev: Sample[], nextSamples: Sample[]): Sample[] {
  const existingIds = new Set(prev.map((sample) => sample.id));
  const fresh = nextSamples.filter((sample) => !existingIds.has(sample.id));
  return [...fresh, ...prev];
}

export function collectScannedDirectories(rows: TauriSampleRow[]): string[] {
  const uniqueDirs = new Set<string>();

  rows.forEach((row) => {
    const pathParts = row.path.split("/");
    if (pathParts.length > 1) {
      let currentPath = "";
      for (let index = 0; index < pathParts.length - 1; index += 1) {
        currentPath += "/" + pathParts[index];
        uniqueDirs.add(currentPath);
      }
    }
  });

  return Array.from(uniqueDirs).sort();
}

export function getAroundOffset(targetId: number, pageLimit: number): number {
  const halfWindow = Math.floor(pageLimit / 2);
  return Math.max(0, targetId - halfWindow);
}
