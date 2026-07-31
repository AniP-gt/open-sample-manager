export const SAMPLE_LIST_COLUMN_GAP = 8;

export const SAMPLE_LIST_MIN_WIDTH = 960;

export const SAMPLE_LIST_METADATA_HIDDEN_MIN_WIDTH = 798;

export const DEFAULT_SAMPLE_COLUMN_WIDTHS = [
  "44px",
  "28px",
  "minmax(200px, 1fr)",
  "100px",
  "72px",
  "64px",
  "60px",
  "54px",
  "82px",
  "64px",
  "88px",
] as const;

export function getSampleListMinWidth(showSampleMetadataQuality: boolean): number {
  return showSampleMetadataQuality
    ? SAMPLE_LIST_MIN_WIDTH
    : SAMPLE_LIST_METADATA_HIDDEN_MIN_WIDTH;
}
