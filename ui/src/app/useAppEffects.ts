import { useEffect } from "react";
import type { useMidiState } from "../hooks/useMidiState";
import type { useSampleState } from "../hooks/useSampleState";
import type { FilterState } from "../types/sample";

type AppEffectsParams = {
  readonly directoryClickFiltering: boolean;
  readonly favorites: number[];
  readonly midiFavorites: number[];
  readonly midiState: ReturnType<typeof useMidiState>;
  readonly sampleState: ReturnType<typeof useSampleState>;
  readonly showSampleMetadataQuality: boolean;
};

export function useAppEffects({
  directoryClickFiltering,
  favorites,
  midiFavorites,
  midiState,
  sampleState,
  showSampleMetadataQuality,
}: AppEffectsParams) {
  useEffect(() => {
    if (sampleState.filters.favoritesOnly && favorites.length === 0) sampleState.handleFilterChange({ favoritesOnly: false });
  }, [favorites, sampleState.filters.favoritesOnly]);

  useEffect(() => {
    if (midiState.favoritesOnly && midiFavorites.length === 0) midiState.setFavoritesOnly(false);
  }, [midiFavorites, midiState.favoritesOnly]);

  useEffect(() => {
    if (!directoryClickFiltering) {
      if (sampleState.filters.directoryPath) sampleState.handleFilterChange({ directoryPath: "" });
      if (midiState.directoryPath) midiState.setDirectoryPath("");
    }
  }, [directoryClickFiltering, midiState.directoryPath, midiState.setDirectoryPath, sampleState.filters.directoryPath, sampleState.handleFilterChange]);

  useEffect(() => {
    if (showSampleMetadataQuality) return;
    const updates: Partial<FilterState> = {};
    if (sampleState.filters.filterLicense) updates.filterLicense = "";
    if (sampleState.filters.qualityIssuesOnly) updates.qualityIssuesOnly = false;
    if (Object.keys(updates).length > 0) sampleState.handleFilterChange(updates);
    if (["license", "source", "quality_flags"].includes(sampleState.sort.field)) sampleState.setSort({ field: "id", direction: "asc" });
    if (sampleState.metadataModalOpen) sampleState.setMetadataModalOpen(false);
  }, [sampleState.filters.filterLicense, sampleState.filters.qualityIssuesOnly, sampleState.handleFilterChange, sampleState.metadataModalOpen, sampleState.setMetadataModalOpen, sampleState.setSort, sampleState.sort.field, showSampleMetadataQuality]);
}
