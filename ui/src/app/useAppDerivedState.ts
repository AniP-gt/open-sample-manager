import { useMemo } from "react";
import { useDisplayedSamples } from "../hooks/useDisplayedSamples";
import { useSampleProcessingState } from "../hooks/useSampleProcessingState";
import type { useCollections } from "../hooks/useCollections";
import type { useMidiState } from "../hooks/useMidiState";
import type { useSampleState } from "../hooks/useSampleState";

type AppDerivedStateParams = {
  readonly collectionState: ReturnType<typeof useCollections>;
  readonly favorites: number[];
  readonly midiFavorites: number[];
  readonly midiState: ReturnType<typeof useMidiState>;
  readonly sampleState: ReturnType<typeof useSampleState>;
};

export function useAppDerivedState({ collectionState, favorites, midiFavorites, midiState, sampleState }: AppDerivedStateParams) {
  const displayedSamples = useDisplayedSamples(
    sampleState.samples,
    sampleState.filters,
    favorites,
    sampleState.externalResults,
    collectionState.isCollectionView ? collectionState.activeMembers : null,
  );
  const filteredMidis = useMemo(() => {
    if (!midiState.favoritesOnly) return midiState.midis;
    const favoriteIds = new Set(midiFavorites);
    return midiState.midis.filter((midi) => favoriteIds.has(midi.id));
  }, [midiFavorites, midiState.favoritesOnly, midiState.midis]);
  const displayedSamplePaths = sampleState.externalResults
    ? sampleState.samplePaths
    : collectionState.isCollectionView
      ? collectionState.samplePaths
      : sampleState.samplePaths;
  const selectedSamplePath = sampleState.selected ? displayedSamplePaths[sampleState.selected.id] : undefined;
  const sampleProcessingState = useSampleProcessingState(sampleState.selected, selectedSamplePath);

  return { displayedSamplePaths, displayedSamples, filteredMidis, sampleProcessingState, selectedSamplePath };
}
