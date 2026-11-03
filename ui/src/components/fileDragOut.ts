import { invoke } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import type React from "react";
import type { SampleProcessingSettings } from "../types/sample";
import { hasSampleProcessingEdits, toProcessedDragParams } from "../utils/sampleProcessing";

const FALLBACK_DRAG_ICON = "/tmp/osm_drag_icon.png";

export function startSampleDrag({ sourcePath, exportPath, icon }: { readonly sourcePath: string; readonly exportPath: string; readonly icon: string }) {
  return startDrag({ item: [exportPath], icon: icon || FALLBACK_DRAG_ICON }, (event) => {
    if (event.result !== "Dropped") return;
    void invoke("record_sample_export", { path: sourcePath }).catch((error: unknown) => {
      console.warn("Export history could not be saved", error);
    });
  });
}

export function loadDragIconPath(dragIconPathRef: React.MutableRefObject<string>) {
  void invoke<string>("get_drag_icon_path").then((path) => {
    dragIconPathRef.current = path;
  }).catch(() => {});
}

export function prepareDragFile(
  path: string | undefined,
  key: string | number,
  preparedPathsRef: React.MutableRefObject<Record<string, string>>,
  processingSettings?: SampleProcessingSettings,
) {
  if (!path || preparedPathsRef.current[key]) return;

  const hasEdits = hasSampleProcessingEdits(processingSettings);
  if (!hasEdits || !processingSettings) return;

  void invoke<string>("prepare_processed_drag_file", {
    path,
    params: toProcessedDragParams(processingSettings),
  }).then((preparedPath) => {
    if (typeof preparedPath === "string" && preparedPath) {
      preparedPathsRef.current[key] = preparedPath;
    }
  }).catch(() => {});
}

export function startFileDrag(
  event: React.DragEvent,
  path: string | undefined,
  key: string | number,
  preparedPathsRef: React.MutableRefObject<Record<string, string>>,
  dragIconPath: string,
  logPrefix: string,
  processingSettings?: SampleProcessingSettings,
) {
  if (!path) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  const hasEdits = hasSampleProcessingEdits(processingSettings);
  const preparedPath = preparedPathsRef.current[key];

  if (!hasEdits) {
    void startSampleDrag({ sourcePath: path, exportPath: path, icon: dragIconPath }).catch((err) => {
      console.warn(`${logPrefix} startDrag failed:`, err);
    });
    return;
  }

  if (hasEdits && !preparedPath && processingSettings) {
    void invoke<string>("prepare_processed_drag_file", {
      path,
      params: toProcessedDragParams(processingSettings),
    }).then((processedPath) => {
      if (!processedPath) return;
      preparedPathsRef.current[key] = processedPath;
      return startSampleDrag({ sourcePath: path, exportPath: processedPath, icon: dragIconPath }).catch((err) => {
        console.warn(`${logPrefix} startDrag failed:`, err);
      });
    }).catch((err) => {
      console.warn(`${logPrefix} processed drag failed:`, err);
    });
    return;
  }

  if (!preparedPath) return;

  void startSampleDrag({ sourcePath: path, exportPath: preparedPath, icon: dragIconPath }).catch((err) => {
    console.warn(`${logPrefix} startDrag failed:`, err);
  });
}
