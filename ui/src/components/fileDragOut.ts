import { invoke } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import type React from "react";

const FALLBACK_DRAG_ICON = "/tmp/osm_drag_icon.png";
const PREPARED_FILE_CLEANUP_DELAY_MS = 1500;

export function loadDragIconPath(dragIconPathRef: React.MutableRefObject<string>) {
  void invoke<string>("get_drag_icon_path").then((path) => {
    dragIconPathRef.current = path;
  }).catch(() => {});
}

export function prepareDragFile(
  path: string | undefined,
  key: string | number,
  preparedPathsRef: React.MutableRefObject<Record<string, string>>,
) {
  if (!path || preparedPathsRef.current[key]) return;

  void invoke("prepare_drag_file", { path }).then((preparedPath) => {
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
) {
  if (!path) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  const preparedPath = preparedPathsRef.current[key] || path;
  void startDrag({ item: [preparedPath], icon: dragIconPath || FALLBACK_DRAG_ICON }).catch((err) => {
    console.warn(`${logPrefix} startDrag failed:`, err);
  });

  setTimeout(() => {
    const prepared = preparedPathsRef.current[key];
    if (prepared) {
      void invoke("delete_file", { path: prepared }).catch(() => {});
      delete preparedPathsRef.current[key];
    }
  }, PREPARED_FILE_CLEANUP_DELAY_MS);
}
