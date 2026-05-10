import { useCallback, useState } from "react";
import type { RefObject, SetStateAction } from "react";
import type { PlayerBarHandle } from "../../components";
import type { SampleListHandle } from "../../components/SampleList/types";
import type { Sample } from "../../types/sample";

type UseSampleSelectionStateParams = {
  sampleListRef: RefObject<SampleListHandle | null>;
  playerBarRef: RefObject<PlayerBarHandle | null>;
};

export function useSampleSelectionState({ sampleListRef, playerBarRef }: UseSampleSelectionStateParams) {
  const [selected, setSelectedSample] = useState<Sample | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const setSelected = useCallback((value: SetStateAction<Sample | null>) => {
    setSelectedSample((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      setSelectedIds(next ? new Set([next.id]) : new Set());
      return next;
    });
  }, []);

  const handleSampleSelect = useCallback(
    async (sample: Sample, isShift?: boolean, rangeIds?: Set<number>) => {
      if (selected?.id !== sample.id) {
        playerBarRef.current?.stop();
      }

      setSelectedSample(sample);
      if (isShift && rangeIds) {
        setSelectedIds(rangeIds);
      } else {
        setSelectedIds(new Set([sample.id]));
      }

      requestAnimationFrame(() => {
        sampleListRef.current?.focusSelected?.();
      });
    },
    [playerBarRef, sampleListRef, selected?.id],
  );

  const togglePlayback = useCallback(() => {
    if (!selected) return;
    const playerBar = playerBarRef.current;
    if (!playerBar) return;
    if (playerBar.isPlaying) {
      playerBar.stop();
    } else {
      playerBar.play();
    }
  }, [playerBarRef, selected]);

  return {
    selected,
    selectedIds,
    setSelected,
    handleSampleSelect,
    togglePlayback,
  };
}
