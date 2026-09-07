import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import type { FreesoundSearchResponse, FreesoundSound } from "../types/freesound";
import { getTauriCommandErrorCode } from "../utils/tauriError";
import { useFreesoundErrorState } from "./freesoundErrorState";
export type FreesoundCredentialState = "loading" | "unset" | "configured";
export type FreesoundInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
export type FreesoundOpen = (url: string) => Promise<void>;

const FREESOUND_HOMEPAGE_URL = "https://freesound.org/";
const FREESOUND_REGISTRATION_URL = "https://freesound.org/apiv2/apply/";
export type FreesoundWorkspace = {
  readonly credential: FreesoundCredentialState;
  readonly error: string | null;
  readonly fetchPreview: (previewUrl: string) => Promise<void>;
  readonly isBusy: boolean;
  readonly activeQuery: string;
  readonly page: number;
  readonly previewUrl: string | null;
  readonly query: string;
  readonly results: readonly FreesoundSound[];
  readonly saveApiKey: (apiKey: string) => Promise<void>;
  readonly search: (query: string, page: number) => Promise<void>;
  readonly setQuery: (query: string) => void;
  readonly stopPreview: () => void;
  readonly totalCount: number;
  readonly deleteApiKey: () => Promise<void>;
  readonly failPreview: (previewUrl: string) => void;
  readonly openHomepage: () => Promise<void>;
  readonly openRegistration: () => Promise<void>;
};

function messageFor(error: unknown): string {
  const code = getTauriCommandErrorCode(error, ["freesound_unauthorized", "freesound_rate_limited"]);
  if (code === "freesound_unauthorized") {
    return "Freesound rejected this API key. Replace it in settings.";
  }
  if (code === "freesound_rate_limited") return "Freesound is rate limiting requests. Try again shortly.";
  return "Freesound request failed. Try again.";
}

function previewBytes(value: unknown): ArrayBuffer | null {
  return value instanceof ArrayBuffer ? value : null;
}

function isCredentialStatus(value: unknown): value is { readonly configured: boolean } {
  return typeof value === "object" && value !== null && "configured" in value && typeof value.configured === "boolean";
}

function isFreesoundSound(value: unknown): value is FreesoundSound {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "number"
    && "name" in value && typeof value.name === "string"
    && "uploader" in value && typeof value.uploader === "string"
    && "license" in value && typeof value.license === "string"
    && "licenseUrl" in value && typeof value.licenseUrl === "string"
    && "pageUrl" in value && typeof value.pageUrl === "string"
    && "previewUrl" in value && typeof value.previewUrl === "string";
}

function isSearchResponse(value: unknown): value is FreesoundSearchResponse {
  return typeof value === "object" && value !== null && "page" in value && typeof value.page === "number"
    && "pageSize" in value && typeof value.pageSize === "number" && "hasPrevious" in value && typeof value.hasPrevious === "boolean"
    && "hasNext" in value && typeof value.hasNext === "boolean" && "sounds" in value && Array.isArray(value.sounds)
    && value.sounds.every(isFreesoundSound) && "totalCount" in value && typeof value.totalCount === "number";
}

export function useFreesoundWorkspace(enabled = true, invokeCommand: FreesoundInvoke = invoke, openExternal: FreesoundOpen = open): FreesoundWorkspace {
  const [credential, setCredential] = useState<FreesoundCredentialState>("loading");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<readonly FreesoundSound[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const { clearOwnedError, error, setOwnedError } = useFreesoundErrorState();
  const [isBusy, setIsBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewGenerationRef = useRef(0);
  const credentialGenerationRef = useRef(0);
  const browserGenerationRef = useRef(0);
  const operationGenerationRef = useRef(0);
  const requestBusyRef = useRef(false);
  const enabledRef = useRef(enabled);
  const mountedRef = useRef(true);
  enabledRef.current = enabled;

  const stopPreview = useCallback(() => {
    previewGenerationRef.current += 1;
    const currentUrl = previewUrlRef.current;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  const failPreview = useCallback((failedPreviewUrl: string) => {
    if (previewUrlRef.current !== failedPreviewUrl) return;
    stopPreview();
    setOwnedError("preview", "Audio preview could not be played.");
  }, [setOwnedError, stopPreview]);

  const loadCredential = useCallback(async () => {
    const generation = ++credentialGenerationRef.current;
    try {
      const status = await invokeCommand("get_freesound_credential_status");
      if (!isCredentialStatus(status)) throw new Error("Invalid Freesound credential status.");
      if (!mountedRef.current || !enabledRef.current || credentialGenerationRef.current !== generation) return;
      setCredential(status.configured ? "configured" : "unset");
      clearOwnedError("credential");
    } catch (requestError) {
      if (!mountedRef.current || !enabledRef.current || credentialGenerationRef.current !== generation) return;
      setCredential("unset");
      setOwnedError("credential", messageFor(requestError));
    }
  }, [clearOwnedError, invokeCommand, setOwnedError]);

  useEffect(() => { if (enabled) void loadCredential(); else { browserGenerationRef.current += 1; credentialGenerationRef.current += 1; operationGenerationRef.current += 1; requestBusyRef.current = false; setIsBusy(false); stopPreview(); } }, [enabled, loadCredential, stopPreview]);
  useEffect(() => { mountedRef.current = true; return () => { browserGenerationRef.current += 1; mountedRef.current = false; stopPreview(); }; }, [stopPreview]);
  useEffect(() => stopPreview, [stopPreview]);

  const saveApiKey = useCallback(async (apiKey: string) => {
    if (requestBusyRef.current || !enabledRef.current) return;
    credentialGenerationRef.current += 1;
    const generation = ++operationGenerationRef.current;
    requestBusyRef.current = true;
    setIsBusy(true); clearOwnedError("credential");
    try {
      await invokeCommand("save_freesound_api_key", { apiKey });
      if (mountedRef.current && enabledRef.current && operationGenerationRef.current === generation) setCredential("configured");
    } catch (requestError) {
      if (mountedRef.current && enabledRef.current && operationGenerationRef.current === generation) setOwnedError("credential", messageFor(requestError));
    } finally { if (operationGenerationRef.current === generation) { requestBusyRef.current = false; if (mountedRef.current) setIsBusy(false); } }
  }, [clearOwnedError, invokeCommand, setOwnedError]);

  const deleteApiKey = useCallback(async () => {
    if (requestBusyRef.current || !enabledRef.current) return;
    credentialGenerationRef.current += 1;
    const generation = ++operationGenerationRef.current;
    requestBusyRef.current = true;
    setIsBusy(true); clearOwnedError("credential"); stopPreview();
    try {
      await invokeCommand("delete_freesound_api_key");
      if (mountedRef.current && enabledRef.current && operationGenerationRef.current === generation) { setCredential("unset"); setResults([]); setTotalCount(0); }
    } catch (requestError) {
      if (mountedRef.current && enabledRef.current && operationGenerationRef.current === generation) setOwnedError("credential", messageFor(requestError));
    } finally { if (operationGenerationRef.current === generation) { requestBusyRef.current = false; if (mountedRef.current) setIsBusy(false); } }
  }, [clearOwnedError, invokeCommand, setOwnedError, stopPreview]);

  const openBrowserPage = useCallback(async (url: string) => {
    if (!enabledRef.current) return;
    const generation = ++browserGenerationRef.current;
    clearOwnedError("browser");
    try { await openExternal(url); } catch (requestError) {
      if (mountedRef.current && enabledRef.current && browserGenerationRef.current === generation) setOwnedError("browser", messageFor(requestError));
    }
  }, [clearOwnedError, openExternal, setOwnedError]);
  const openHomepage = useCallback(() => openBrowserPage(FREESOUND_HOMEPAGE_URL), [openBrowserPage]);
  const openRegistration = useCallback(() => openBrowserPage(FREESOUND_REGISTRATION_URL), [openBrowserPage]);

  const search = useCallback(async (nextQuery: string, nextPage: number) => {
    if (requestBusyRef.current || !enabledRef.current || nextQuery.trim().length === 0) return;
    stopPreview(); requestBusyRef.current = true;
    const generation = ++operationGenerationRef.current;
    setIsBusy(true); clearOwnedError("search");
    try {
      const response = await invokeCommand("search_freesound", { query: nextQuery.trim(), page: nextPage });
      if (!isSearchResponse(response)) throw new Error("Invalid Freesound search response.");
      if (mountedRef.current && enabledRef.current && operationGenerationRef.current === generation) { setActiveQuery(nextQuery.trim()); setPage(nextPage); setResults(response.sounds); setTotalCount(response.totalCount); }
    } catch (requestError) {
      if (mountedRef.current && enabledRef.current && operationGenerationRef.current === generation) setOwnedError("search", messageFor(requestError));
    } finally { if (operationGenerationRef.current === generation) { requestBusyRef.current = false; if (mountedRef.current) setIsBusy(false); } }
  }, [clearOwnedError, invokeCommand, setOwnedError, stopPreview]);

  const fetchPreview = useCallback(async (sourceUrl: string) => {
    if (requestBusyRef.current || !enabledRef.current) return;
    stopPreview();
    const previewGeneration = previewGenerationRef.current;
    const generation = ++operationGenerationRef.current;
    requestBusyRef.current = true;
    setIsBusy(true); clearOwnedError("preview");
    try {
      const bytes = await invokeCommand("fetch_freesound_preview", { previewUrl: sourceUrl });
      const preview = previewBytes(bytes);
      if (!preview) throw new Error("Invalid Freesound preview response.");
      const nextUrl = URL.createObjectURL(new Blob([preview], { type: "audio/mpeg" }));
      if (!mountedRef.current || !enabledRef.current || previewGenerationRef.current !== previewGeneration || operationGenerationRef.current !== generation) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      previewUrlRef.current = nextUrl; setPreviewUrl(nextUrl);
    } catch (requestError) {
      if (mountedRef.current && enabledRef.current && previewGenerationRef.current === previewGeneration && operationGenerationRef.current === generation) setOwnedError("preview", messageFor(requestError));
    } finally { if (operationGenerationRef.current === generation) { requestBusyRef.current = false; if (mountedRef.current) setIsBusy(false); } }
  }, [clearOwnedError, invokeCommand, setOwnedError, stopPreview]);

  return { credential, error, fetchPreview, isBusy, page, activeQuery, previewUrl, query, results, saveApiKey, search, setQuery, stopPreview, totalCount, deleteApiKey, failPreview, openHomepage, openRegistration };
}
