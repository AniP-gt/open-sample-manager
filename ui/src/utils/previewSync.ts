const KEY_OFFSETS: Record<string, number> = {
  C: 0,
  "C#": 1,
  DB: 1,
  D: 2,
  "D#": 3,
  EB: 3,
  E: 4,
  F: 5,
  "F#": 6,
  GB: 6,
  G: 7,
  "G#": 8,
  AB: 8,
  A: 9,
  "A#": 10,
  BB: 10,
  B: 11,
};

const CANONICAL_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface ProjectSyncSettings {
  projectBpm: string;
  projectKey: string;
  tempoSync: boolean;
  keySync: boolean;
}

export interface PreviewSyncResult {
  targetBpm?: number;
  transposeSemitones?: number;
}

export function normalizeKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/♯/g, "#")
    .replace(/[♭ｂ]/gi, "b")
    .toUpperCase();
  const match = normalized.match(/^([A-G])\s*([#B]?)/);
  if (!match) return null;
  const key = `${match[1]}${match[2] ?? ""}`;
  if (!(key in KEY_OFFSETS)) return null;
  const pitchClass = KEY_OFFSETS[key];
  return CANONICAL_KEYS[pitchClass] ?? null;
}

export function parseProjectBpm(value: string): number | null {
  const bpm = Number(value);
  return Number.isFinite(bpm) && bpm > 0 ? bpm : null;
}

export function computeTempoRate(sourceBpm: number | null | undefined, targetBpm: number | null | undefined): number | null {
  if (!sourceBpm || !targetBpm || sourceBpm <= 0 || targetBpm <= 0) return null;
  return targetBpm / sourceBpm;
}

export function computeShortestSemitoneShift(sourceKey: string | null | undefined, targetKey: string | null | undefined): number | null {
  const source = normalizeKey(sourceKey);
  const target = normalizeKey(targetKey);
  if (!source || !target) return null;
  const sourceOffset = KEY_OFFSETS[source];
  const targetOffset = KEY_OFFSETS[target];
  let shift = targetOffset - sourceOffset;
  if (shift > 6) shift -= 12;
  if (shift < -6) shift += 12;
  return shift;
}

export function parseMidiKeyEstimate(value: string | null | undefined): string | null {
  return normalizeKey(value);
}

export function buildPreviewSyncResult(
  settings: ProjectSyncSettings,
  sourceBpm: number | null | undefined,
  sourceKey: string | null | undefined,
): PreviewSyncResult {
  const targetBpm = settings.tempoSync ? parseProjectBpm(settings.projectBpm) : null;
  const transposeSemitones = settings.keySync
    ? computeShortestSemitoneShift(sourceKey, settings.projectKey)
    : null;
  return {
    ...(targetBpm && sourceBpm ? { targetBpm } : {}),
    ...(transposeSemitones !== null ? { transposeSemitones } : {}),
  };
}
