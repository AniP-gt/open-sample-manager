import { useEffect, useRef } from "react";
import type { Midi } from "../../../types/midi";
import { isTextInputElement } from "../../../utils/keyboard";

export function useMidiKeyboard(
  listRef: React.RefObject<HTMLDivElement | null>,
  sortedMidis: Midi[],
  selectedMidi: Midi | null,
  onMidiSelect: (midi: Midi, isShift?: boolean) => void,
  onTogglePlayback?: () => void
) {
  const arrowDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectRef = useRef<Midi | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key !== "ArrowDown" && key !== "ArrowUp" && key !== " ") return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const listRoot = listRef.current;
      if (!listRoot) return;
      const target = event.target as Element | null;
      if (isTextInputElement(target)) return;
      if (target && target !== document.body && target !== document.documentElement && !listRoot.contains(target)) {
        return;
      }
      if (key === " ") {
        if (!selectedMidi || !onTogglePlayback) return;
        event.preventDefault();
        event.stopPropagation();
        onTogglePlayback();
        return;
      }
      if (sortedMidis.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      const currentIndex = selectedMidi ? sortedMidis.findIndex((m) => m.id === selectedMidi.id) : -1;
      let nextIndex = currentIndex;
      if (event.key === "ArrowDown") {
        if (currentIndex < sortedMidis.length - 1) {
          nextIndex = currentIndex + 1;
        } else if (currentIndex === -1) {
          nextIndex = 0;
        }
      } else {
        if (currentIndex > 0) {
          nextIndex = currentIndex - 1;
        } else if (currentIndex === -1) {
          nextIndex = sortedMidis.length - 1;
        }
      }

      if (nextIndex < 0 || nextIndex >= sortedMidis.length) return;
      const nextMidi = sortedMidis[nextIndex];
      if (!nextMidi) return;
      if (!selectedMidi || nextMidi.id !== selectedMidi.id) {
        pendingSelectRef.current = nextMidi;
        if (arrowDebounceRef.current) clearTimeout(arrowDebounceRef.current);
        arrowDebounceRef.current = setTimeout(() => {
          const pending = pendingSelectRef.current;
          if (pending) {
            onMidiSelect(pending);
            pendingSelectRef.current = null;
          }
        }, 80);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (arrowDebounceRef.current) clearTimeout(arrowDebounceRef.current);
    };
  }, [selectedMidi, onMidiSelect, sortedMidis, onTogglePlayback, listRef]);
}
