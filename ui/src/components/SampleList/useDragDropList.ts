import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { extractPathsFromDataTransfer } from "../../utils/dataTransfer";

export function useDragDropList(onImportPaths?: (paths: string[]) => void) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const dragIconPathRef = useRef<string>("");

  useEffect(() => {
    void invoke<string>("get_drag_icon_path").then((p) => {
      dragIconPathRef.current = p;
    }).catch(() => {});
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "copy";
    } catch {}
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const paths = extractPathsFromDataTransfer(e.dataTransfer ?? null);
    if (paths.length > 0) {
      onImportPaths?.(paths);
    }
  };

  return { isDragOver, handleDragEnter, handleDragOver, handleDragLeave, handleDrop, dragIconPathRef };
}
