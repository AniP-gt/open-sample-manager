import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PlayerBarHandle } from "../components";
import type { Sample } from "../types/sample";
import type { TauriSampleRow } from "../types/tauri";
import type { ViewMode } from "../types/viewMode";
import { mapRowToSample } from "../utils/sampleMapper";
import { reorderRows, type CommandDisposition, type ShowSamplesCommand } from "./externalApi/externalCommandProtocol";
import { useExternalCommandQueue } from "./externalApi/useExternalCommandQueue";

type ExternalAppWindow = Pick<ReturnType<typeof getCurrentWindow>, "show" | "setFocus">;
export type ExternalSampleResults = { readonly samples: Sample[]; readonly samplePaths: Readonly<Record<number, string>>; readonly selectedId: number | null };
type UseExternalApiCommandsParams = {
  readonly showExternalResults: (results: ExternalSampleResults) => void;
  readonly setViewMode: (mode: ViewMode) => void;
  readonly setError: (message: string | null) => void;
  readonly playerBarRef: RefObject<PlayerBarHandle | null>;
  readonly selectSample: (sample: Sample) => Promise<void>;
  readonly refreshCollections?: () => Promise<void>;
  readonly getAppWindow?: () => ExternalAppWindow;
};

export function useExternalApiCommands({ showExternalResults, setViewMode, setError, playerBarRef, selectSample, refreshCollections, getAppWindow = getCurrentWindow }: UseExternalApiCommandsParams) {
  const isMountedRef = useRef(true); const pendingPreviewSampleIdRef = useRef<number | null>(null);
  const rejectedPreviewSampleIdRef = useRef<number | null>(null); const stoppedPreviewSampleIdRef = useRef<number | null>(null);
  const previewAwaitingPlayerRef = useRef(false); const [previewSampleId, setPreviewSampleId] = useState<number | null>(null);
  const [playerReadyVersion, setPlayerReadyVersion] = useState(0);
  const handleShowSamples = useCallback(async (command: ShowSamplesCommand): Promise<CommandDisposition> => {
    const rows = await invoke<TauriSampleRow[]>("get_samples_by_ids", { sampleIds: command.sample_ids });
    if (!isMountedRef.current) return "requeue";
    const samples = reorderRows(command.sample_ids, rows);
    if (!samples) { setError("Could not load every requested sample."); return "ack"; }
    setViewMode("sample"); showExternalResults({ samples, samplePaths: Object.fromEntries(rows.map((row) => [row.id, row.path])), selectedId: command.selected_id });
    const appWindow = getAppWindow(); await appWindow.show(); if (!isMountedRef.current) return "requeue";
    await appWindow.setFocus(); return isMountedRef.current ? "ack" : "requeue";
  }, [getAppWindow, setError, setViewMode, showExternalResults]);
  const handlePreviewSample = useCallback(async (sampleId: number): Promise<CommandDisposition> => {
    if (pendingPreviewSampleIdRef.current === sampleId) return "ack";
    rejectedPreviewSampleIdRef.current = null; stoppedPreviewSampleIdRef.current = null;
    const playerBar = playerBarRef.current; playerBar?.stop(); if (playerBar) stoppedPreviewSampleIdRef.current = sampleId;
    const rows = await invoke<TauriSampleRow[]>("get_samples_by_ids", { sampleIds: [sampleId] });
    if (!isMountedRef.current) return "requeue";
    const row = rows[0]; if (rows.length !== 1 || !row?.path) { setError("Could not preview the requested sample because it is unavailable."); return "ack"; }
    pendingPreviewSampleIdRef.current = sampleId; previewAwaitingPlayerRef.current = true; setPreviewSampleId(sampleId); setViewMode("sample"); await selectSample(mapRowToSample(row));
    return isMountedRef.current ? "ack" : "requeue";
  }, [playerBarRef, selectSample, setError, setViewMode]);
  useExternalCommandQueue({ isMountedRef, setError: (message) => setError(message), handleShowSamples, handlePreviewSample, refreshCollections });
  useEffect(() => {
    if (previewSampleId === null || pendingPreviewSampleIdRef.current !== previewSampleId || rejectedPreviewSampleIdRef.current === previewSampleId || previewAwaitingPlayerRef.current) return;
    const playerBar = playerBarRef.current; if (!playerBar) return;
    if (!playerBar.playFromStart) { setError("Could not preview the requested sample because the player is unavailable."); rejectedPreviewSampleIdRef.current = previewSampleId; pendingPreviewSampleIdRef.current = null; previewAwaitingPlayerRef.current = false; return; }
    if (stoppedPreviewSampleIdRef.current !== previewSampleId) { playerBar.stop(); stoppedPreviewSampleIdRef.current = previewSampleId; }
    playerBar.playFromStart(); pendingPreviewSampleIdRef.current = null; rejectedPreviewSampleIdRef.current = null; previewAwaitingPlayerRef.current = false;
  }, [playerBarRef, playerReadyVersion, previewSampleId, setError]);
  useEffect(() => () => { pendingPreviewSampleIdRef.current = null; previewAwaitingPlayerRef.current = false; }, []);
  const onPlayerBarReady = useCallback(() => { if (!isMountedRef.current) return; if (pendingPreviewSampleIdRef.current !== null) previewAwaitingPlayerRef.current = false; setPlayerReadyVersion((version) => version + 1); }, []);
  return { previewSampleId, onPlayerBarReady };
}
