import { useCallback, useState } from "react";
import type { RefObject } from "react";
import type { PlayerBarHandle } from "../../components";
import type { SampleListHandle } from "../../components/SampleList/types";
import type { Sample } from "../../types/sample";

type UseSampleSelectionStateParams = {
  sampleListRef: RefObject<SampleListHandle | null>;
  playerBarRef: RefObject<PlayerBarHandle | null>;
};

export function useSampleSelectionState({ sampleListRef, playerBarRef }: UseSampleSelectionStateParams) {
  const [selected, setSelected] = useState<Sample | null>(null);

  const handleSampleSelect = useCallback(
    async (sample: Sample) => {
      if (selected?.id !== sample.id) {
        playerBarRef.current?.stop();
      }

      setSelected(sample);
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
    setSelected,
    handleSampleSelect,
    togglePlayback,
  };
}
