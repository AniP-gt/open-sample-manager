import type { Sample } from "./sample";

export type UsageKind = "preview" | "export";
export type RankingMetric = UsageKind | "adopted";
export type ProjectStatus = "candidate" | "adopted";
export type ProjectDraft = { readonly status: ProjectStatus; readonly note: string };
export type SmartRules = {
  readonly instrument: string | null;
  readonly playback_type: "loop" | "oneshot" | null;
  readonly bpm_min: number | null;
  readonly bpm_max: number | null;
  readonly favorites_only: boolean;
};
export type SmartCollection = { readonly id: number; readonly name: string; readonly rules: SmartRules };
export type DiscoveryView =
  | { readonly mode: "ranking"; readonly metric: RankingMetric; readonly days: number | null }
  | { readonly mode: "project"; readonly collection_id: number }
  | { readonly mode: "smart"; readonly rules: SmartRules }
  | { readonly mode: "unplayed" }
  | { readonly mode: "forgotten"; readonly days: number }
  | { readonly mode: "similar"; readonly sample_id: number };
export type DiscoverySample = {
  readonly sample: Sample;
  readonly path: string;
  readonly count: number | null;
  readonly lastUsed: number | null;
  readonly status: ProjectStatus;
  readonly note: string;
};
export const emptySmartRules: SmartRules = {
  instrument: null, playback_type: null, bpm_min: null, bpm_max: null, favorites_only: false,
};
