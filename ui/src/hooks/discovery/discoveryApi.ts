import { invoke } from "@tauri-apps/api/core";
import type { DiscoverySample, SmartCollection, SmartRules, UsageKind } from "../../types/discovery";
import { mapRowToSample } from "../../utils/sampleMapper";

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid response format");
  return Object.fromEntries(Object.entries(value));
}
function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function string(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid list response");
  return value;
}

export function parseDiscoveryRows(value: unknown): DiscoverySample[] {
  return array(value).map((item) => {
    const entry = record(item), row = record(entry.sample);
    const id = number(row.id), path = string(row.path), fileName = string(row.file_name);
    if (id === null || path === null || fileName === null) throw new Error("Invalid sample response");
    return {
      path, count: number(entry.count), lastUsed: number(entry.last_used),
      status: entry.status === "adopted" ? "adopted" : "candidate", note: string(entry.note) ?? "",
      sample: mapRowToSample({
        id, path, file_name: fileName, duration: number(row.duration), bpm: number(row.bpm),
        periodicity: number(row.periodicity), sample_rate: number(row.sample_rate), low_ratio: number(row.low_ratio),
        attack_slope: number(row.attack_slope), decay_time: number(row.decay_time), sample_type: string(row.sample_type),
        waveform_peaks: string(row.waveform_peaks), playback_type: string(row.playback_type) ?? "oneshot",
        instrument_type: string(row.instrument_type) ?? "other", musical_key: string(row.musical_key),
        source: string(row.source), pack_name: string(row.pack_name), license: string(row.license),
        license_url: string(row.license_url), license_memo: string(row.license_memo), imported_at: string(row.imported_at),
        peak_db: number(row.peak_db), rms_db: number(row.rms_db), leading_silence_ms: number(row.leading_silence_ms),
        clipping_count: number(row.clipping_count), channel_count: number(row.channel_count), bit_depth: number(row.bit_depth),
        quality_flags: string(row.quality_flags), content_hash: string(row.content_hash), duplicate_count: number(row.duplicate_count),
        tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
      }),
    };
  });
}

export function parseSmartCollections(value: unknown): SmartCollection[] {
  return array(value).map((item) => {
    const row = record(item), rules = record(row.rules), id = number(row.id), name = string(row.name);
    if (id === null || name === null) throw new Error("Invalid saved rules response");
    const playback = rules.playback_type;
    const parsedRules: SmartRules = {
      instrument: string(rules.instrument), playback_type: playback === "loop" || playback === "oneshot" ? playback : null,
      bpm_min: number(rules.bpm_min), bpm_max: number(rules.bpm_max), favorites_only: rules.favorites_only === true,
    };
    return { id, name, rules: parsedRules };
  });
}

export async function recordUsage(sampleId: number, kind: UsageKind): Promise<void> {
  await invoke("record_sample_usage", { sampleId, kind });
  window.dispatchEvent(new Event("osm-usage-changed"));
}
