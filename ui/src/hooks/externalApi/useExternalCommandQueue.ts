import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { CommandDisposition, ShowSamplesCommand, UiCommandLease } from "./externalCommandProtocol";
import { isUiCommandLease, isUiCommandLeaseId } from "./externalCommandProtocol";

type UseExternalCommandQueueParams = {
  readonly isMountedRef: MutableRefObject<boolean>;
  readonly setError: (message: string) => void;
  readonly handleShowSamples: (command: ShowSamplesCommand) => Promise<CommandDisposition>;
  readonly handlePreviewSample: (sampleId: number) => Promise<CommandDisposition>;
  readonly refreshCollections?: () => Promise<void>;
};

export function useExternalCommandQueue({ isMountedRef, setError, handleShowSamples, handlePreviewSample, refreshCollections }: UseExternalCommandQueueParams) {
  const drainingRef = useRef<Promise<void>>(Promise.resolve());
  const drainRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const setErrorRef = useRef(setError);
  const processedLeaseIdsRef = useRef(new Set<number>());
  setErrorRef.current = setError;
  const nack = useCallback(async (id: number) => {
    try { await invoke("nack_ui_command", { id }); } catch { if (isMountedRef.current) setError("Could not return the external app command to the queue."); }
  }, [isMountedRef, setError]);
  const acknowledge = useCallback(async (id: number, attemptedLeaseIds: Set<number>) => {
    if (attemptedLeaseIds.has(id)) return;
    attemptedLeaseIds.add(id);
    try { await invoke("acknowledge_ui_command", { id }); } catch { if (isMountedRef.current) setError("Could not acknowledge the external app command."); }
  }, [isMountedRef, setError]);
  const processLease = useCallback(async (lease: UiCommandLease, attemptedLeaseIds: Set<number>) => {
    if (!isMountedRef.current) { await nack(lease.id); return; }
    if (processedLeaseIdsRef.current.has(lease.id)) { await acknowledge(lease.id, attemptedLeaseIds); return; }
    let disposition: CommandDisposition;
    try {
      switch (lease.type) {
        case "ShowSamples": disposition = await handleShowSamples(lease); break;
        case "PreviewSample": disposition = await handlePreviewSample(lease.sample_id); break;
        case "CollectionsChanged": if (refreshCollections) await refreshCollections(); disposition = "ack"; break;
      }
    } catch { await nack(lease.id); if (isMountedRef.current) setError("Could not process the external app command."); return; }
    if (disposition === "requeue") { await nack(lease.id); return; }
    processedLeaseIdsRef.current.add(lease.id); await acknowledge(lease.id, attemptedLeaseIds);
  }, [acknowledge, handlePreviewSample, handleShowSamples, isMountedRef, nack, refreshCollections, setError]);
  const drain = useCallback(() => {
    drainingRef.current = drainingRef.current.then(async () => {
      const commands = await invoke<unknown[]>("claim_ui_command_queue"); const attemptedLeaseIds = new Set<number>();
      if (!isMountedRef.current) { for (const command of commands) if (isUiCommandLeaseId(command)) await nack(command.id); return; }
      for (const command of commands) {
        if (isUiCommandLease(command)) { await processLease(command, attemptedLeaseIds); continue; }
        if (isUiCommandLeaseId(command)) { processedLeaseIdsRef.current.add(command.id); if (isMountedRef.current) setError("Could not process an incompatible external app command."); await acknowledge(command.id, attemptedLeaseIds); }
        else if (isMountedRef.current) setError("Could not process an incompatible external app command.");
      }
    }).catch(() => { if (isMountedRef.current) setError("Could not process the external app command."); });
    return drainingRef.current;
  }, [acknowledge, isMountedRef, nack, processLease, setError]);
  drainRef.current = drain;
  useEffect(() => {
    isMountedRef.current = true; let unlisten: (() => void) | undefined;
    void drainRef.current();
    void listen("osm:ui-command-queue:wake", () => { void drainRef.current(); }).then((dispose) => {
      if (isMountedRef.current) unlisten = dispose; else dispose();
    }).catch(() => { if (isMountedRef.current) setErrorRef.current("Could not listen for external app commands."); });
    return () => { isMountedRef.current = false; unlisten?.(); };
  }, [isMountedRef]);
}
