export const SAMPLE_LIST_COLUMN_GAP = 8;

export const SAMPLE_LIST_MIN_WIDTH = 960;

export const SAMPLE_LIST_METADATA_HIDDEN_MIN_WIDTH = 798;

export const SAMPLE_LIST_COMPACT_MIN_WIDTH = 736;

export const SAMPLE_LIST_COMPACT_BREAKPOINT = 900;

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

export function isCompactSampleList(width: number): boolean {
  return width < SAMPLE_LIST_COMPACT_BREAKPOINT;
}

export function getSampleListMinWidth(
  compact: boolean,
  showSampleMetadataQuality: boolean,
): number {
  if (compact) return SAMPLE_LIST_COMPACT_MIN_WIDTH;
  return showSampleMetadataQuality
    ? SAMPLE_LIST_MIN_WIDTH
    : SAMPLE_LIST_METADATA_HIDDEN_MIN_WIDTH;
}
