import { useCallback, useEffect, useRef, useState } from "react";
import type { RefCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ProviderBrowserMode, ProviderId, ProviderImportReady } from "../types/provider";
import { isProviderId } from "../types/provider";
import type { ViewMode } from "../types/viewMode";
import { useProviderBrowserLifecycle } from "./providerBrowserLifecycle";

type UseProviderBrowserParams = {
  readonly downloadRoot: string | null;
  readonly mode: ProviderBrowserMode;
  readonly settingsOpen: boolean;
  readonly viewMode: ViewMode;
  readonly performScan: (directory: string) => Promise<void>;
  readonly setError: (message: string | null) => void;
};

function parseReadyPayload(value: unknown): ProviderImportReady | null {
  if (typeof value !== "object" || value === null || !("provider" in value) || !("directory" in value)) {
    return null;
  }

  if (!isProviderId(value.provider) || typeof value.directory !== "string" || value.directory.length === 0) {
    return null;
  }

  return { provider: value.provider, directory: value.directory };
}

function getFailureCode(value: unknown): string {
  if (typeof value !== "object" || value === null || !("code" in value) || typeof value.code !== "string") {
    return "provider_error";
  }

  return /^[a-z0-9_]{1,64}$/.test(value.code) ? value.code : "provider_error";
}

export function useProviderBrowser({ downloadRoot, mode, settingsOpen, viewMode, performScan, setError }: UseProviderBrowserParams) {
  const [status, setStatus] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderId | null>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const performScanRef = useRef(performScan);
  const setErrorRef = useRef(setError);
  const pendingImportScansRef = useRef(0);
  const importScanQueueRef = useRef<Promise<void>>(Promise.resolve());

  performScanRef.current = performScan;
  setErrorRef.current = setError;

  const viewportRef = useCallback<RefCallback<HTMLDivElement>>((element) => {
    setViewport(element);
  }, []);

  const { selectProvider, clearActiveProvider, goBack, goForward, hideEmbeddedBrowserBeforeLeavingWeb, changeMode } = useProviderBrowserLifecycle({
    activeProvider,
    downloadRoot,
    mode,
    settingsOpen,
    setActiveProvider,
    setError,
    setStatus,
    viewMode,
    viewport,
  });

  useEffect(() => {
    let isMounted = true;
    let unlistenReady: (() => void) | undefined;
    let unlistenFailed: (() => void) | undefined;

    const registerListeners = async () => {
      try {
        const readyUnlisten = await listen<unknown>("provider-import-ready", (event) => {
          const payload = parseReadyPayload(event.payload);
          if (!payload) return;

          pendingImportScansRef.current += 1;
          setStatus(`SCANNING ${payload.provider} IMPORT`);
          importScanQueueRef.current = importScanQueueRef.current.then(async () => {
            try {
              await performScanRef.current(payload.directory);
            } catch {
              if (isMounted) setErrorRef.current("Could not scan a provider import.");
            } finally {
              pendingImportScansRef.current -= 1;
              if (isMounted && pendingImportScansRef.current === 0) setStatus(null);
            }
          });
        });
        if (!isMounted) {
          readyUnlisten();
          return;
        }
        unlistenReady = readyUnlisten;

        const failedUnlisten = await listen<unknown>("provider-import-failed", (event) => {
          const failureCode = getFailureCode(event.payload);
          setStatus(null);
          setErrorRef.current(`Provider import failed (${failureCode}).`);
        });
        if (!isMounted) {
          failedUnlisten();
          return;
        }
        unlistenFailed = failedUnlisten;
      } catch {
        unlistenReady?.();
        unlistenReady = undefined;
        if (isMounted) setErrorRef.current("Could not listen for provider imports.");
      }
    };

    void registerListeners();

    return () => {
      isMounted = false;
      unlistenReady?.();
      unlistenFailed?.();
    };
  }, []);

  return { status, activeProvider, viewportRef, selectProvider, clearActiveProvider, goBack, goForward, hideEmbeddedBrowserBeforeLeavingWeb, changeMode };
}
