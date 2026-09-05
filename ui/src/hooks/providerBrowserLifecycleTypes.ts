import type { ProviderBrowserMode, ProviderId } from "../types/provider";
import type { ViewMode } from "../types/viewMode";

export type ProviderUrlByProvider = Partial<Record<ProviderId, string>>;

export type LifecycleState = {
  readonly activeProvider: ProviderId | null;
  readonly downloadRoot: string | null;
  readonly mode: ProviderBrowserMode;
  readonly settingsOpen: boolean;
  readonly viewMode: ViewMode;
  readonly viewport: HTMLDivElement | null;
};

export type UseProviderBrowserLifecycleParams = LifecycleState & {
  readonly setActiveProvider: (provider: ProviderId | null) => void;
  readonly setError: (message: string | null) => void;
  readonly setStatus: (status: string | null) => void;
};
