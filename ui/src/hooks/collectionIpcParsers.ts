import type { FilterState, SavedSearch, SortState } from "../types/sample";
import type { Collection } from "../types/collection";
import type { TauriSampleRow } from "../types/tauri";

type IpcRecord = Readonly<Record<string, unknown>>;

function ipcRecord(value: unknown): IpcRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }
  return record;
}

function stringField(record: IpcRecord, field: string): string | null {
  const value = record[field];
  return typeof value === "string" ? value : null;
}

function numberField(record: IpcRecord, field: string): number | null {
  const value = record[field];
  return typeof value === "number" ? value : null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseFilterType(value: unknown): FilterState["filterType"] | null {
  if (value === "all" || value === "loop" || value === "one-shot") return value;
  return null;
}

function parseInstrumentType(value: unknown): FilterState["filterInstrumentType"] | null {
  if (value === "" || value === "kick" || value === "snare" || value === "hihat" || value === "bass" || value === "synth" || value === "fx" || value === "vocal" || value === "percussion" || value === "other") return value;
  return null;
}

function parseSortField(value: unknown): SortState["field"] | null {
  if (value === "id" || value === "file_name" || value === "sample_type" || value === "instrument_type" || value === "bpm" || value === "duration" || value === "sample_rate" || value === "musical_key" || value === "license" || value === "source" || value === "quality_flags") return value;
  return null;
}

export function parseCollection(value: unknown): Collection | null {
  const record = ipcRecord(value);
  if (!record) return null;
  const id = numberField(record, "id");
  const name = stringField(record, "name");
  const createdAt = stringField(record, "created_at");
  const updatedAt = stringField(record, "updated_at");
  const sampleCount = numberField(record, "sample_count");
  const description = record["description"];
  if (id === null || name === null || createdAt === null || updatedAt === null || sampleCount === null || !isNullableString(description)) return null;
  return { id, name, description, created_at: createdAt, updated_at: updatedAt, sample_count: sampleCount };
}

export function parseSavedSearch(value: unknown): SavedSearch | null {
  const record = ipcRecord(value);
  if (!record) return null;
  const id = numberField(record, "id");
  const name = stringField(record, "name");
  const search = stringField(record, "search");
  const filterBpmMin = stringField(record, "filter_bpm_min");
  const filterBpmMax = stringField(record, "filter_bpm_max");
  const filterKey = stringField(record, "filter_key");
  const directoryPath = stringField(record, "directory_path");
  const createdAt = stringField(record, "created_at");
  const updatedAt = stringField(record, "updated_at");
  const filterType = parseFilterType(record["filter_type"]);
  const filterInstrumentType = parseInstrumentType(record["filter_instrument_type"]);
  const sortField = parseSortField(record["sort_field"]);
  const sortDirection = record["sort_direction"];
  const favoritesOnly = record["favorites_only"];
  if (id === null || name === null || search === null || filterBpmMin === null || filterBpmMax === null || filterKey === null || directoryPath === null || createdAt === null || updatedAt === null || filterType === null || filterInstrumentType === null || sortField === null || (sortDirection !== "asc" && sortDirection !== "desc") || typeof favoritesOnly !== "boolean") return null;
  return { id, name, search, filter_type: filterType, filter_bpm_min: filterBpmMin, filter_bpm_max: filterBpmMax, filter_instrument_type: filterInstrumentType, favorites_only: favoritesOnly, filter_key: filterKey, directory_path: directoryPath, sort_field: sortField, sort_direction: sortDirection, created_at: createdAt, updated_at: updatedAt };
}

export function parseTauriSampleRow(value: unknown): TauriSampleRow | null {
  const record = ipcRecord(value);
  if (!record) return null;
  const id = numberField(record, "id");
  const path = stringField(record, "path");
  const fileName = stringField(record, "file_name");
  const playbackType = stringField(record, "playback_type");
  const instrumentType = stringField(record, "instrument_type");
  const duration = record["duration"];
  const bpm = record["bpm"];
  const periodicity = record["periodicity"];
  const sampleRate = record["sample_rate"];
  const lowRatio = record["low_ratio"];
  const attackSlope = record["attack_slope"];
  const decayTime = record["decay_time"];
  const sampleType = record["sample_type"];
  const waveformPeaks = record["waveform_peaks"];
  const musicalKey = record["musical_key"];
  const source = record["source"];
  const packName = record["pack_name"];
  const license = record["license"];
  const licenseUrl = record["license_url"];
  const licenseMemo = record["license_memo"];
  const importedAt = record["imported_at"];
  const peakDb = record["peak_db"];
  const rmsDb = record["rms_db"];
  const leadingSilenceMs = record["leading_silence_ms"];
  const clippingCount = record["clipping_count"];
  const channelCount = record["channel_count"];
  const bitDepth = record["bit_depth"];
  const qualityFlags = record["quality_flags"];
  const contentHash = record["content_hash"];
  const duplicateCount = record["duplicate_count"];
  const tags = record["tags"];
  if (id === null || path === null || fileName === null || playbackType === null || instrumentType === null || !isNullableNumber(duration) || !isNullableNumber(bpm) || !isNullableNumber(periodicity) || !isNullableNumber(sampleRate) || !isNullableNumber(lowRatio) || !isNullableNumber(attackSlope) || !isNullableNumber(decayTime) || !isNullableString(sampleType) || !isNullableString(waveformPeaks) || !isNullableString(musicalKey) || !isNullableString(source) || !isNullableString(packName) || !isNullableString(license) || !isNullableString(licenseUrl) || !isNullableString(licenseMemo) || !isNullableString(importedAt) || !isNullableNumber(peakDb) || !isNullableNumber(rmsDb) || !isNullableNumber(leadingSilenceMs) || !isNullableNumber(clippingCount) || !isNullableNumber(channelCount) || !isNullableNumber(bitDepth) || !isNullableString(qualityFlags) || !isNullableString(contentHash) || !isNullableNumber(duplicateCount) || !isStringArray(tags)) return null;
  return { id, path, file_name: fileName, duration, bpm, periodicity, sample_rate: sampleRate, low_ratio: lowRatio, attack_slope: attackSlope, decay_time: decayTime, sample_type: sampleType, waveform_peaks: waveformPeaks, playback_type: playbackType, instrument_type: instrumentType, musical_key: musicalKey, source, pack_name: packName, license, license_url: licenseUrl, license_memo: licenseMemo, imported_at: importedAt, peak_db: peakDb, rms_db: rmsDb, leading_silence_ms: leadingSilenceMs, clipping_count: clippingCount, channel_count: channelCount, bit_depth: bitDepth, quality_flags: qualityFlags, content_hash: contentHash, duplicate_count: duplicateCount, tags };
}

export function parseIpcList<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const parsed: T[] = [];
  for (const item of value) {
    const row = parse(item);
    if (row !== null) parsed.push(row);
  }
  return parsed;
}
