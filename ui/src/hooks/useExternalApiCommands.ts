import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Sample } from "../types/sample";
import type { PlayerBarHandle } from "../components";
import type { TauriSampleRow } from "../types/tauri";
import { mapRowToSample } from "../utils/sampleMapper";

type ShowSamplesCommand = {
  readonly type: "ShowSamples";
  readonly sample_ids: readonly number[];
  readonly selected_id: number | null;
};

type UiCommand = ShowSamplesCommand | { readonly type: "PreviewSample"; readonly sample_id: number } | { readonly type: "CollectionsChanged" };
type UiCommandLease = UiCommand & { readonly id: number };
type CommandDisposition = "ack" | "requeue";
type ExternalAppWindow = Pick<ReturnType<typeof getCurrentWindow>, "show" | "setFocus">;

export type ExternalSampleResults = {
  readonly samples: Sample[];
  readonly samplePaths: Readonly<Record<number, string>>;
  readonly selectedId: number | null;
};

type UseExternalApiCommandsParams = {
  readonly showExternalResults: (results: ExternalSampleResults) => void;
  readonly setViewMode: (mode: "sample" | "midi") => void;
  readonly setError: (message: string | null) => void;
  readonly playerBarRef: RefObject<PlayerBarHandle | null>;
  readonly selectSample: (sample: Sample) => Promise<void>;
  readonly refreshCollections?: () => Promise<void>;
  readonly getAppWindow?: () => ExternalAppWindow;
};

function isUiCommand(value: unknown): value is UiCommand {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const type = value.type;
  if (type === "CollectionsChanged") return true;
  if (type === "PreviewSample") return "sample_id" in value && typeof value.sample_id === "number";
  return type === "ShowSamples"
    && "sample_ids" in value
    && Array.isArray(value.sample_ids)
    && value.sample_ids.every((id) => typeof id === "number")
    && "selected_id" in value
    && (typeof value.selected_id === "number" || value.selected_id === null);
}

function isUiCommandLease(value: unknown): value is UiCommandLease {
  return isUiCommand(value) && "id" in value && typeof value.id === "number";
}

function isUiCommandLeaseId(value: unknown): value is { readonly id: number } {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "number";
}

function reorderRows(sampleIds: readonly number[], rows: readonly TauriSampleRow[]): Sample[] | null {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  if (rowsById.size !== sampleIds.length) return null;

  const samples: Sample[] = [];
  for (const sampleId of sampleIds) {
    const row = rowsById.get(sampleId);
    if (!row) return null;
    samples.push(mapRowToSample(row));
  }
  return samples;
}

export function useExternalApiCommands({
  showExternalResults,
  setViewMode,
  setError,
  playerBarRef,
  selectSample,
  refreshCollections,
  getAppWindow = getCurrentWindow,
}: UseExternalApiCommandsParams) {
  const isMountedRef = useRef(true);
  const drainingRef = useRef<Promise<void>>(Promise.resolve());
  const drainRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const setErrorRef = useRef(setError);
  const pendingPreviewSampleIdRef = useRef<number | null>(null);
  const rejectedPreviewSampleIdRef = useRef<number | null>(null);
  const stoppedPreviewSampleIdRef = useRef<number | null>(null);
  const previewAwaitingPlayerRef = useRef(false);
  const processedLeaseIdsRef = useRef(new Set<number>());
  const [previewSampleId, setPreviewSampleId] = useState<number | null>(null);
  const [playerReadyVersion, setPlayerReadyVersion] = useState(0);
  setErrorRef.current = setError;

  const handleShowSamples = useCallback(async (command: ShowSamplesCommand): Promise<CommandDisposition> => {
    const rows = await invoke<TauriSampleRow[]>("get_samples_by_ids", { sampleIds: command.sample_ids });
    if (!isMountedRef.current) return "requeue";
    const samples = reorderRows(command.sample_ids, rows);
    if (!samples) {
      setError("Could not load every requested sample.");
      return "ack";
    }

    setViewMode("sample");
    showExternalResults({
      samples,
      samplePaths: Object.fromEntries(rows.map((row) => [row.id, row.path])),
      selectedId: command.selected_id,
    });
    const appWindow = getAppWindow();
    await appWindow.show();
    if (!isMountedRef.current) return "requeue";
    await appWindow.setFocus();
    return isMountedRef.current ? "ack" : "requeue";
  }, [getAppWindow, setError, setViewMode, showExternalResults]);

  const handlePreviewSample = useCallback(async (sampleId: number): Promise<CommandDisposition> => {
    if (pendingPreviewSampleIdRef.current === sampleId) return "ack";

    rejectedPreviewSampleIdRef.current = null;
    stoppedPreviewSampleIdRef.current = null;
    const playerBar = playerBarRef.current;
    playerBar?.stop();
    if (playerBar) stoppedPreviewSampleIdRef.current = sampleId;
    const rows = await invoke<TauriSampleRow[]>("get_samples_by_ids", { sampleIds: [sampleId] });
    if (!isMountedRef.current) return "requeue";
    const row = rows[0];
    if (rows.length !== 1 || !row?.path) {
      setError("Could not preview the requested sample because it is unavailable.");
      return "ack";
    }

    pendingPreviewSampleIdRef.current = sampleId;
    previewAwaitingPlayerRef.current = true;
    setPreviewSampleId(sampleId);
    setViewMode("sample");
    await selectSample(mapRowToSample(row));
    return isMountedRef.current ? "ack" : "requeue";
  }, [playerBarRef, selectSample, setError, setViewMode]);

  useEffect(() => {
    if (previewSampleId === null || pendingPreviewSampleIdRef.current !== previewSampleId) return;
    if (rejectedPreviewSampleIdRef.current === previewSampleId) return;
    if (previewAwaitingPlayerRef.current) return;
    const playerBar = playerBarRef.current;
    if (!playerBar) return;

    if (!playerBar.playFromStart) {
      setError("Could not preview the requested sample because the player is unavailable.");
      rejectedPreviewSampleIdRef.current = previewSampleId;
      pendingPreviewSampleIdRef.current = null;
      previewAwaitingPlayerRef.current = false;
      return;
    }

    if (stoppedPreviewSampleIdRef.current !== previewSampleId) {
      playerBar.stop();
      stoppedPreviewSampleIdRef.current = previewSampleId;
    }
    playerBar.playFromStart();
    pendingPreviewSampleIdRef.current = null;
    rejectedPreviewSampleIdRef.current = null;
    previewAwaitingPlayerRef.current = false;
  }, [playerBarRef, playerReadyVersion, previewSampleId]);

  const nack = useCallback(async (id: number) => {
    try {
      await invoke("nack_ui_command", { id });
    } catch {
      if (isMountedRef.current) setError("Could not return the external app command to the queue.");
    }
  }, [setError]);

  const acknowledge = useCallback(async (id: number, attemptedLeaseIds: Set<number>) => {
    if (attemptedLeaseIds.has(id)) return;
    attemptedLeaseIds.add(id);
    try {
      await invoke("acknowledge_ui_command", { id });
    } catch {
      if (isMountedRef.current) setError("Could not acknowledge the external app command.");
    }
  }, [setError]);

  const processLease = useCallback(async (lease: UiCommandLease, attemptedLeaseIds: Set<number>) => {
    if (!isMountedRef.current) {
      await nack(lease.id);
      return;
    }

    if (processedLeaseIdsRef.current.has(lease.id)) {
      await acknowledge(lease.id, attemptedLeaseIds);
      return;
    }

    let disposition: CommandDisposition;
    try {
      switch (lease.type) {
        case "ShowSamples":
          disposition = await handleShowSamples(lease);
          break;
        case "PreviewSample":
          disposition = await handlePreviewSample(lease.sample_id);
          break;
        case "CollectionsChanged":
          if (refreshCollections) await refreshCollections();
          disposition = "ack";
          break;
      }
    } catch {
      await nack(lease.id);
      if (isMountedRef.current) setError("Could not process the external app command.");
      return;
    }

    if (disposition === "requeue") {
      await nack(lease.id);
      return;
    }

    processedLeaseIdsRef.current.add(lease.id);
    await acknowledge(lease.id, attemptedLeaseIds);
  }, [acknowledge, handlePreviewSample, handleShowSamples, nack, refreshCollections, setError]);

  const drain = useCallback(() => {
    drainingRef.current = drainingRef.current.then(async () => {
      const commands = await invoke<unknown[]>("claim_ui_command_queue");
      const attemptedLeaseIds = new Set<number>();
      if (!isMountedRef.current) {
        for (const command of commands) {
          if (isUiCommandLeaseId(command)) await nack(command.id);
        }
        return;
      }
      for (const command of commands) {
        if (!isUiCommandLease(command)) {
          if (isUiCommandLeaseId(command)) {
            processedLeaseIdsRef.current.add(command.id);
            if (isMountedRef.current) setError("Could not process an incompatible external app command.");
            await acknowledge(command.id, attemptedLeaseIds);
          } else if (isMountedRef.current) {
            setError("Could not process an incompatible external app command.");
          }
          continue;
        }
        await processLease(command, attemptedLeaseIds);
      }
    }).catch(() => {
      if (isMountedRef.current) setError("Could not process the external app command.");
    });
    return drainingRef.current;
  }, [acknowledge, nack, processLease, setError]);
  drainRef.current = drain;

  useEffect(() => {
    isMountedRef.current = true;
    let unlisten: (() => void) | undefined;

    void drainRef.current();
    void listen("osm:ui-command-queue:wake", () => {
      void drainRef.current();
    }).then((dispose) => {
      if (isMountedRef.current) {
        unlisten = dispose;
      } else {
        dispose();
      }
    }).catch(() => {
      if (isMountedRef.current) setErrorRef.current("Could not listen for external app commands.");
    });

    return () => {
      isMountedRef.current = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => () => {
    pendingPreviewSampleIdRef.current = null;
    previewAwaitingPlayerRef.current = false;
  }, []);

  const onPlayerBarReady = useCallback(() => {
    if (!isMountedRef.current) return;
    if (pendingPreviewSampleIdRef.current !== null) {
      previewAwaitingPlayerRef.current = false;
    }
    setPlayerReadyVersion((version) => version + 1);
  }, []);

  return { previewSampleId, onPlayerBarReady };
}
