import { act, renderHook } from "@testing-library/react";
import type { ComponentType, PropsWithChildren } from "react";
import { vi } from "vitest";
import type { ProviderBrowserMode } from "../../types/provider";
import type { ViewMode } from "../../types/viewMode";
import { useProviderBrowser } from "../useProviderBrowser";

export type BrowserProps = {
  readonly mode: ProviderBrowserMode;
  readonly settingsOpen?: boolean;
  readonly viewMode: ViewMode;
};

type RenderProviderBrowserOptions = {
  readonly attachViewport?: boolean;
  readonly downloadRoot?: string | null;
  readonly initialProps: BrowserProps;
  readonly setError?: (message: string | null) => void;
  readonly wrapper?: ComponentType<PropsWithChildren>;
};

export function renderProviderBrowser({
  attachViewport = false,
  downloadRoot = "/Users/alice/Downloads",
  initialProps,
  setError = vi.fn<(message: string | null) => void>(),
  wrapper,
}: RenderProviderBrowserOptions) {
  const rendered = renderHook<ReturnType<typeof useProviderBrowser>, BrowserProps>(
    ({ mode, settingsOpen = false, viewMode }) => useProviderBrowser({
      downloadRoot,
      mode,
      settingsOpen,
      viewMode,
      performScan: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      setError,
    }),
    { initialProps, wrapper },
  );

  if (attachViewport) {
    const viewport = document.createElement("div");
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(12, 24, 640, 480));
    act(() => rendered.result.current.viewportRef(viewport));
  }

  return rendered;
}
