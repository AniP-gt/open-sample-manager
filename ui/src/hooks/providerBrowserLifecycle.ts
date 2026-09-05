import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ProviderBrowserBounds, ProviderBrowserMode, ProviderId } from "../types/provider";
import { useProviderBrowserLifecycleQueue } from "./providerBrowserLifecycleQueue";
import { createProviderBrowserLifecycleSurface } from "./providerBrowserLifecycleSurface";
import type { LifecycleState, ProviderUrlByProvider, UseProviderBrowserLifecycleParams } from "./providerBrowserLifecycleTypes";

function getBounds(element: HTMLDivElement): ProviderBrowserBounds {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}

function consumeUnmountCloseFailure(_error: unknown): undefined {
  return undefined;
}

export function useProviderBrowserLifecycle({
  activeProvider,
  downloadRoot,
  mode,
  settingsOpen,
  setActiveProvider,
  setError,
  setStatus,
  viewMode,
  viewport,
}: UseProviderBrowserLifecycleParams) {
  const stateRef = useRef<LifecycleState>({ activeProvider, downloadRoot, mode, settingsOpen, viewMode, viewport });
  const mountedRef = useRef(true);
  const intentRef = useRef(0);
  const openingProviderRef = useRef<ProviderId | null>(null);
  const openedProviderRef = useRef<ProviderId | null>(null);
  const visibleProviderRef = useRef<ProviderId | null>(null);
  const hiddenProviderRef = useRef<ProviderId | null>(null);
  const surfaceDownloadRootRef = useRef<string | null | undefined>(undefined);
  const previousDownloadRootRef = useRef(downloadRoot);
  const mountVersionRef = useRef(0);
  const lastUrlByProviderRef = useRef<ProviderUrlByProvider>({});
  const leavingWebRef = useRef<"idle" | "leaving" | "left">("idle");
  const setErrorRef = useRef(setError);
  const { enqueue, enqueueReconcile, cancelReconcile } = useProviderBrowserLifecycleQueue();

  stateRef.current = { activeProvider, downloadRoot, mode, settingsOpen, viewMode, viewport };
  setErrorRef.current = setError;

  const advanceIntent = useCallback(() => {
    intentRef.current += 1;
    cancelReconcile();
    return intentRef.current;
  }, [cancelReconcile]);

  const reportError = useCallback((message: string) => {
    if (mountedRef.current) setErrorRef.current(message);
  }, []);

  const canReconcile = useCallback((intent: number, provider: ProviderId) => {
    const state = stateRef.current;
    return mountedRef.current && intent === intentRef.current && state.activeProvider === provider
      && state.mode === "embedded" && state.viewMode === "web" && !state.settingsOpen && state.viewport !== null
      && leavingWebRef.current === "idle";
  }, []);

  const isCurrentProvider = useCallback((intent: number, expectedMode: ProviderBrowserMode, provider: ProviderId) => (
    intent === intentRef.current && stateRef.current.mode === expectedMode && stateRef.current.activeProvider === provider
  ), []);

  const surface = useMemo(() => createProviderBrowserLifecycleSurface({
    refs: { openingProviderRef, openedProviderRef, visibleProviderRef, hiddenProviderRef, surfaceDownloadRootRef, lastUrlByProviderRef },
    stateRef,
    mountedRef,
    enqueue,
    canReconcile,
    isCurrentProvider,
    reportError,
    setActiveProvider,
    setStatus,
  }), [canReconcile, enqueue, isCurrentProvider, reportError, setActiveProvider, setStatus]);

  const queueReconcile = useCallback((updateBounds = false) => {
    enqueueReconcile(async () => {
      const state = stateRef.current;
      if (state.viewport !== null) await surface.reconcile(intentRef.current, getBounds(state.viewport), updateBounds);
    });
  }, [enqueueReconcile, surface]);

  const queueDownloadRootTransition = useCallback((intent: number) => enqueue(async () => {
    const state = stateRef.current;
    const provider = state.activeProvider;
    if (provider === null) return;
    await surface.closeProviderAndAll(provider);
    const next = stateRef.current;
    if (!mountedRef.current || intent !== intentRef.current || next.activeProvider !== provider) return;
    if (next.mode === "window") {
      await surface.openProvider({ intent, mode: "window", provider });
      return;
    }
    if (next.viewport !== null) await surface.reconcile(intent, getBounds(next.viewport));
  }), [enqueue, surface]);

  useEffect(() => {
    const downloadRootChanged = previousDownloadRootRef.current !== downloadRoot;
    previousDownloadRootRef.current = downloadRoot;
    if (mode === "window" && !downloadRootChanged) return;
    const intent = advanceIntent();
    if (downloadRootChanged && surface.hasDownloadRootChange(downloadRoot)) {
      void queueDownloadRootTransition(intent).catch(() => reportError("Provider browser could not be closed."));
      return;
    }
    if (mode !== "embedded") return;
    if (settingsOpen) {
      if (activeProvider !== null) void surface.queueCloseOpenedProvider(activeProvider);
      return;
    }
    if (viewMode !== "web") {
      if (leavingWebRef.current === "leaving") leavingWebRef.current = "left";
      void surface.queueCloseProviderAndAll(activeProvider);
      return;
    }
    if (activeProvider === null || viewport === null) return;
    if (leavingWebRef.current === "left") leavingWebRef.current = "idle";
    queueReconcile();
  }, [activeProvider, advanceIntent, downloadRoot, mode, queueDownloadRootTransition, queueReconcile, reportError, settingsOpen, surface, viewMode, viewport]);

  useEffect(() => {
    if (viewport === null) return;
    const observer = new ResizeObserver(() => {
      queueReconcile(true);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [queueReconcile, viewport]);

  useEffect(() => {
    mountedRef.current = true;
    mountVersionRef.current += 1;
    const mountVersion = mountVersionRef.current;
    return () => {
      mountedRef.current = false;
      advanceIntent();
      queueMicrotask(() => {
        if (mountVersion === mountVersionRef.current) void surface.queueCloseAll(true).then(surface.resetHistory).catch(consumeUnmountCloseFailure);
      });
    };
  }, []);

  const selectProvider = useCallback(async (provider: ProviderId) => {
    const intent = advanceIntent();
    const previousProvider = stateRef.current.activeProvider;
    if (stateRef.current.mode === "embedded" && previousProvider !== provider) void surface.queueCloseOpenedProvider(previousProvider);
    stateRef.current = { ...stateRef.current, activeProvider: provider };
    setError(null);
    setStatus(`OPENING ${provider} BROWSER`);
    setActiveProvider(provider);
    if (stateRef.current.mode === "window") await enqueue(() => surface.openProvider({ intent, mode: "window", provider }));
  }, [advanceIntent, enqueue, setActiveProvider, setError, setStatus, surface]);

  const clearActiveProvider = useCallback(async () => {
    const provider = stateRef.current.activeProvider;
    await surface.queueCloseProviderAndAll(provider, true);
    advanceIntent();
    stateRef.current = { ...stateRef.current, activeProvider: null };
    setActiveProvider(null);
    setStatus(null);
  }, [advanceIntent, setActiveProvider, setStatus, surface]);

  const queueHistoryNavigation = useCallback(async (command: "go_back_provider_browser" | "go_forward_provider_browser", errorMessage: string) => {
    const provider = stateRef.current.activeProvider;
    if (stateRef.current.mode !== "embedded" || provider === null) return Promise.resolve();
    await enqueue(async () => {
      const state = stateRef.current;
      if (state.mode === "embedded" && state.activeProvider === provider) await invoke(command, { provider });
    }).catch(() => reportError(errorMessage));
  }, [enqueue, reportError]);

  const hideEmbeddedBrowserBeforeLeavingWeb = useCallback(async () => {
    const state = stateRef.current;
    if (state.mode !== "embedded" || state.viewMode !== "web") return true;
    leavingWebRef.current = "leaving";
    const intent = advanceIntent();
    setError(null);
    try {
      await surface.queueCloseProviderAndAll(state.activeProvider, true);
      return intent === intentRef.current;
    } catch {
      if (intent === intentRef.current) {
        leavingWebRef.current = "idle";
        reportError("Provider browser could not be closed.");
      }
      return false;
    }
  }, [advanceIntent, reportError, setError, surface]);

  const changeMode = useCallback(async (nextMode: ProviderBrowserMode) => {
    const intent = advanceIntent();
    try {
      await surface.queueCloseAll(true);
      if (intent !== intentRef.current) return false;
      surface.resetHistory();
      stateRef.current = { ...stateRef.current, activeProvider: null };
      setActiveProvider(null);
      setStatus(null);
      return nextMode;
    } catch {
      if (intent === intentRef.current) reportError("Provider browser could not be closed.");
      return false;
    }
  }, [advanceIntent, reportError, setActiveProvider, setStatus, surface]);

  return { selectProvider, clearActiveProvider, goBack: () => queueHistoryNavigation("go_back_provider_browser", "Provider browser could not go back."), goForward: () => queueHistoryNavigation("go_forward_provider_browser", "Provider browser could not go forward."), hideEmbeddedBrowserBeforeLeavingWeb, changeMode };
}
