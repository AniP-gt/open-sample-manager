import { useEffect } from "react";
import type { PlayerBarHandle } from "../components";

type ViewMode = "sample" | "midi";

type SampleState = {
  selected: { id: number } | null;
};

type MidiState = {
  selectedMidi: { id: number } | null;
  togglePlaySelectedMidi: () => Promise<void>;
};

export function useKeyboardShortcuts({
  viewMode,
  sampleState,
  midiState,
  playerBarRef,
}: {
  viewMode: ViewMode;
  sampleState: SampleState;
  midiState: MidiState;
  playerBarRef: React.RefObject<PlayerBarHandle | null>;
}) {
  useEffect(() => {
    const handleSpaceKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target) {
        if (target.isContentEditable) {
          return;
        }
        if (target.closest("input,textarea,select,button,a,[role='button'],[role='link'],summary")) {
          return;
        }
      }

      let handled = false;

      if (viewMode === "sample" && sampleState.selected && playerBarRef.current) {
        playerBarRef.current.play();
        handled = true;
      } else if (viewMode === "midi" && midiState.selectedMidi) {
        handled = true;
        void midiState.togglePlaySelectedMidi();
      }

      if (handled) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleSpaceKey);
    return () => window.removeEventListener("keydown", handleSpaceKey);
  }, [viewMode, sampleState.selected, midiState.selectedMidi, midiState.togglePlaySelectedMidi, playerBarRef]);
}
