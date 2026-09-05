export const PROVIDER_IDS = {
  musicRadar: "music_radar",
  fiftySounds: "fifty_sounds",
} as const;

export type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

export const PROVIDER_BROWSER_MODES = {
  embedded: "embedded",
  window: "window",
} as const;

export type ProviderBrowserMode = (typeof PROVIDER_BROWSER_MODES)[keyof typeof PROVIDER_BROWSER_MODES];

export type ProviderBrowserBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ProviderImportReady = {
  readonly provider: ProviderId;
  readonly directory: string;
};

export type ProviderImportFailed = {
  readonly provider: ProviderId;
  readonly code: string;
};

export function isProviderId(value: unknown): value is ProviderId {
  return value === PROVIDER_IDS.musicRadar || value === PROVIDER_IDS.fiftySounds;
}
