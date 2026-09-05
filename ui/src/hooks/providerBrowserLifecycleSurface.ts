import { invoke } from "@tauri-apps/api/core";
import type { MutableRefObject } from "react";
import type { ProviderBrowserBounds, ProviderBrowserMode, ProviderId } from "../types/provider";
import { formatTauriCommandError } from "../utils/tauriError";
import type { LifecycleState, ProviderUrlByProvider } from "./providerBrowserLifecycleTypes";

type SurfaceRefs = {
  readonly openingProviderRef: MutableRefObject<ProviderId | null>;
  readonly openedProviderRef: MutableRefObject<ProviderId | null>;
  readonly visibleProviderRef: MutableRefObject<ProviderId | null>;
  readonly hiddenProviderRef: MutableRefObject<ProviderId | null>;
  readonly surfaceDownloadRootRef: MutableRefObject<string | null | undefined>;
  readonly lastUrlByProviderRef: MutableRefObject<ProviderUrlByProvider>;
};

type SurfaceOperationsParams = {
  readonly refs: SurfaceRefs;
  readonly stateRef: MutableRefObject<LifecycleState>;
  readonly mountedRef: MutableRefObject<boolean>;
  readonly enqueue: (operation: () => Promise<void>) => Promise<void>;
  readonly canReconcile: (intent: number, provider: ProviderId) => boolean;
  readonly isCurrentProvider: (intent: number, mode: ProviderBrowserMode, provider: ProviderId) => boolean;
  readonly reportError: (message: string) => void;
  readonly setActiveProvider: (provider: ProviderId | null) => void;
  readonly setStatus: (status: string | null) => void;
};

type OpenOptions = {
  readonly bounds?: ProviderBrowserBounds;
  readonly intent: number;
  readonly mode: ProviderBrowserMode;
  readonly provider: ProviderId;
};

export function createProviderBrowserLifecycleSurface({
  refs,
  stateRef,
  mountedRef,
  enqueue,
  canReconcile,
  isCurrentProvider,
  reportError,
  setActiveProvider,
  setStatus,
}: SurfaceOperationsParams) {
  function clearOwnership() {
    refs.openingProviderRef.current = null;
    refs.openedProviderRef.current = null;
    refs.visibleProviderRef.current = null;
    refs.hiddenProviderRef.current = null;
    refs.surfaceDownloadRootRef.current = undefined;
  }

  function resetHistory() {
    refs.lastUrlByProviderRef.current = {};
  }

  async function closeOpenedProvider(targetProvider: ProviderId | null) {
    const provider = targetProvider ?? refs.openedProviderRef.current ?? refs.openingProviderRef.current;
    if (provider === null) return;

    const capturedUrl = await invoke<unknown>("close_embedded_provider_browser", { provider });
    if (typeof capturedUrl === "string") refs.lastUrlByProviderRef.current[provider] = capturedUrl;
    if (refs.openedProviderRef.current === provider) refs.openedProviderRef.current = null;
    if (refs.openingProviderRef.current === provider) refs.openingProviderRef.current = null;
    if (refs.visibleProviderRef.current === provider) refs.visibleProviderRef.current = null;
    if (refs.hiddenProviderRef.current === provider) refs.hiddenProviderRef.current = null;
    refs.surfaceDownloadRootRef.current = undefined;
  }

  async function closeAllProviderBrowsers() {
    await invoke("close_all_provider_browsers");
    clearOwnership();
  }

  async function closeProviderAndAll(provider: ProviderId | null) {
    if (stateRef.current.mode === "embedded") await closeOpenedProvider(provider);
    await closeAllProviderBrowsers();
  }

  async function closeStaleProvider(provider: ProviderId, mode: ProviderBrowserMode) {
    try {
      if (mode === "embedded") {
        const capturedUrl = await invoke<unknown>("close_embedded_provider_browser", { provider });
        if (typeof capturedUrl === "string") refs.lastUrlByProviderRef.current[provider] = capturedUrl;
      } else {
        await invoke("close_all_provider_browsers");
      }
    } catch {
      reportError("Provider browser could not be closed.");
      return;
    }

    if (refs.openedProviderRef.current === provider) refs.openedProviderRef.current = null;
    if (refs.openingProviderRef.current === provider) refs.openingProviderRef.current = null;
    if (refs.visibleProviderRef.current === provider) refs.visibleProviderRef.current = null;
    if (refs.hiddenProviderRef.current === provider) refs.hiddenProviderRef.current = null;
    if (refs.openedProviderRef.current === null && refs.openingProviderRef.current === null) {
      refs.surfaceDownloadRootRef.current = undefined;
    }
  }

  async function openProvider({ bounds, intent, mode, provider }: OpenOptions) {
    const state = stateRef.current;
    refs.openingProviderRef.current = provider;
    refs.surfaceDownloadRootRef.current = state.downloadRoot;
    const url = refs.lastUrlByProviderRef.current[provider];
    const payload = {
      provider,
      mode,
      downloadRoot: state.downloadRoot,
      ...(bounds === undefined ? {} : { bounds }),
      ...(url === undefined ? {} : { url }),
    };

    try {
      await invoke("open_provider_browser", payload);
      const stale = mode === "embedded"
        ? !canReconcile(intent, provider)
        : !mountedRef.current || !isCurrentProvider(intent, mode, provider);
      if (stale) {
        await closeStaleProvider(provider, mode);
        return;
      }
      refs.openingProviderRef.current = null;
      refs.openedProviderRef.current = provider;
      refs.visibleProviderRef.current = provider;
      refs.hiddenProviderRef.current = null;
      setStatus(null);
    } catch (error) {
      if (refs.openingProviderRef.current === provider) refs.openingProviderRef.current = null;
      refs.surfaceDownloadRootRef.current = undefined;
      if (mode === "embedded" && !canReconcile(intent, provider)) return;
      if (mode === "window" && (!mountedRef.current || !isCurrentProvider(intent, mode, provider))) return;
      stateRef.current = { ...stateRef.current, activeProvider: null };
      setActiveProvider(null);
      setStatus(null);
      reportError(formatTauriCommandError(error, "Provider browser could not be opened."));
    }
  }

  async function reconcile(intent: number, bounds: ProviderBrowserBounds, updateBounds = false) {
    const state = stateRef.current;
    const provider = state.activeProvider;
    if (provider === null) return;

    if (refs.openedProviderRef.current !== provider) {
      if (!canReconcile(intent, provider)) return;
      if (refs.openingProviderRef.current === provider) return;
      await openProvider({ bounds, intent, mode: "embedded", provider });
      return;
    }

    if (!mountedRef.current || !updateBounds) return;

    try {
      await invoke("set_provider_browser_bounds", { provider, bounds });
      if (refs.visibleProviderRef.current !== provider) {
        await invoke("show_provider_browser", { provider });
        refs.visibleProviderRef.current = provider;
        refs.hiddenProviderRef.current = null;
      }
    } catch {
      return;
    }
  }

  function hasDownloadRootChange(downloadRoot: string | null) {
    const provider = refs.openedProviderRef.current ?? refs.openingProviderRef.current;
    return provider !== null && refs.surfaceDownloadRootRef.current !== downloadRoot;
  }

  function queueCloseAll(propagateFailure = false) {
    return enqueue(async () => {
      try {
        await closeAllProviderBrowsers();
      } catch (error) {
        if (propagateFailure) throw error;
        reportError("Provider browser could not be closed.");
      }
    });
  }

  function queueCloseOpenedProvider(provider: ProviderId | null, propagateFailure = false) {
    return enqueue(async () => {
      try {
        await closeOpenedProvider(provider);
      } catch (error) {
        if (propagateFailure) throw error;
        reportError("Provider browser could not be closed.");
      }
    });
  }

  function queueCloseProviderAndAll(provider: ProviderId | null, propagateFailure = false) {
    return enqueue(async () => {
      try {
        await closeProviderAndAll(provider);
      } catch (error) {
        if (propagateFailure) throw error;
        reportError("Provider browser could not be closed.");
      }
    });
  }

  return {
    clearOwnership,
    closeProviderAndAll,
    closeOpenedProvider,
    hasDownloadRootChange,
    openProvider,
    queueCloseAll,
    queueCloseOpenedProvider,
    queueCloseProviderAndAll,
    reconcile,
    resetHistory,
  };
}
