import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PlayerBarHandle } from "../components";
import type { Sample } from "../types/sample";

type UseUIStateParams = {
  getHandleImportPaths: () => ((paths: string[]) => Promise<void>) | null;
};

export function useUIState({ getHandleImportPaths }: UseUIStateParams) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<"sample" | "midi">("sample");
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null);
  const pageLimit = 20;

  const handleViewModeChange = async (
    mode: "sample" | "midi",
    deps: {
      isMidiPlaying: boolean;
      setIsMidiPlaying: (value: boolean) => void;
      playerBarRef: React.RefObject<PlayerBarHandle | null>;
      setSelected: React.Dispatch<React.SetStateAction<Sample | null>>;
      setMidiSearch: (value: string) => void;
    },
  ) => {
    if (deps.isMidiPlaying) {
      await invoke("stop_midi").finally(() => deps.setIsMidiPlaying(false));
    }
    if (mode === "midi") {
      try {
        deps.playerBarRef.current?.stop();
      } catch (e) {
        console.warn("Failed to stop PlayerBar when switching to MIDI view", e);
      }
      deps.setSelected(null);
    }
    deps.setMidiSearch("");
    setViewMode(mode);
  };

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = Math.max(100, Math.min(400, e.clientX));
    setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const handler = () => {
      window.dispatchEvent(new CustomEvent("osm:request-clear-all"));
    };
    window.addEventListener("confirm-clear-all", handler as EventListener);
    return () => window.removeEventListener("confirm-clear-all", handler as EventListener);
  }, []);

  useEffect(() => {
    let unlistenEnter: (() => void) | null = null;
    let unlistenOver: (() => void) | null = null;
    let unlistenLeave: (() => void) | null = null;
    let unlistenDrop: (() => void) | null = null;

    const setup = async () => {
      try {
        unlistenEnter = await listen<{ paths?: string[] }>("tauri://drag-enter", () => {
          setIsDragOver(true);
        });

        unlistenOver = await listen("tauri://drag-over", () => {
          setIsDragOver(true);
        });

        unlistenLeave = await listen("tauri://drag-leave", () => {
          setIsDragOver(false);
        });

        unlistenDrop = await listen<{ paths?: string[] }>("tauri://drag-drop", (e) => {
          setIsDragOver(false);
          const paths = e.payload?.paths ?? [];
          if (paths.length > 0) {
            const fn = getHandleImportPaths();
            if (fn) {
              void fn(paths);
            }
          }
        });
      } catch {}
    };

    void setup();

    return () => {
      try {
        unlistenEnter?.();
      } catch {}
      try {
        unlistenOver?.();
      } catch {}
      try {
        unlistenLeave?.();
      } catch {}
      try {
        unlistenDrop?.();
      } catch {}
    };
  }, [getHandleImportPaths]);

  return {
    settingsOpen,
    setSettingsOpen,
    sidebarWidth,
    isResizing,
    isDragOver,
    viewMode,
    setViewMode,
    lastFetchCount,
    setLastFetchCount,
    pageLimit,
    handleViewModeChange,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
