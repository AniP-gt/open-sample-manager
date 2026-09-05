import type { Sample } from "../../types/sample";
import type { TauriSampleRow } from "../../types/tauri";
import { mapRowToSample } from "../../utils/sampleMapper";

export type ShowSamplesCommand = { readonly type: "ShowSamples"; readonly sample_ids: readonly number[]; readonly selected_id: number | null };
export type UiCommand = ShowSamplesCommand | { readonly type: "PreviewSample"; readonly sample_id: number } | { readonly type: "CollectionsChanged" };
export type UiCommandLease = UiCommand & { readonly id: number };
export type CommandDisposition = "ack" | "requeue";

export function isUiCommand(value: unknown): value is UiCommand {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  if (value.type === "CollectionsChanged") return true;
  if (value.type === "PreviewSample") return "sample_id" in value && typeof value.sample_id === "number";
  return value.type === "ShowSamples" && "sample_ids" in value && Array.isArray(value.sample_ids)
    && value.sample_ids.every((id) => typeof id === "number") && "selected_id" in value
    && (typeof value.selected_id === "number" || value.selected_id === null);
}

export function isUiCommandLease(value: unknown): value is UiCommandLease {
  return isUiCommand(value) && "id" in value && typeof value.id === "number";
}

export function isUiCommandLeaseId(value: unknown): value is { readonly id: number } {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "number";
}

export function reorderRows(sampleIds: readonly number[], rows: readonly TauriSampleRow[]): Sample[] | null {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  if (rowsById.size !== sampleIds.length) return null;
  const samples: Sample[] = [];
  for (const sampleId of sampleIds) {
    const row = rowsById.get(sampleId);
    if (!row) return null;
    samples.push(mapRowToSample(row));
  }
  return samples;
}
