import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Sample } from "../../types/sample";
import type { FetchAllSamplePaths, NullableSampleSetter, RunSampleSearch } from "./sampleStateTypes";
import type { SamplePathMap } from "./samplePathHelpers";

type UseSampleMetadataStateParams = {
  samplePaths: SamplePathMap;
  searchQuery: string;
  runSearch: RunSampleSearch;
  fetchAllSamplePaths: FetchAllSamplePaths;
  setSelected: NullableSampleSetter;
  selectedIds: Set<number>;
  setError: (message: string | null) => void;
};

type MetadataField = "source" | "packName" | "license" | "licenseUrl" | "licenseMemo";

type MetadataForm = Record<MetadataField, string>;

const blankForm: MetadataForm = {
  source: "",
  packName: "",
  license: "",
  licenseUrl: "",
  licenseMemo: "",
};

const valueOrNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export function useSampleMetadataState({
  samplePaths,
  searchQuery,
  runSearch,
  fetchAllSamplePaths,
  setSelected,
  selectedIds,
  setError,
}: UseSampleMetadataStateParams) {
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [metadataSample, setMetadataSample] = useState<Sample | null>(null);
  const [metadataTargetIds, setMetadataTargetIds] = useState<number[]>([]);
  const [metadataForm, setMetadataForm] = useState<MetadataForm>(blankForm);

  const handleMetadataClick = useCallback((sample: Sample) => {
    setMetadataSample(sample);
    setMetadataForm({
      source: sample.source ?? "",
      packName: sample.pack_name ?? "",
      license: sample.license ?? "",
      licenseUrl: sample.license_url ?? "",
      licenseMemo: sample.license_memo ?? "",
    });
    setMetadataTargetIds(selectedIds.has(sample.id) ? Array.from(selectedIds) : [sample.id]);
    setMetadataModalOpen(true);
  }, [selectedIds]);

  const handleMetadataFieldChange = useCallback((field: MetadataField, value: string) => {
    setMetadataForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleMetadataSave = useCallback(async () => {
    if (!metadataSample) return;

    let successCount = 0;

    for (const targetId of metadataTargetIds) {
      const path = samplePaths[targetId];
      if (!path) continue;

      try {
        const updateResult = await invoke<number>("update_sample_license_metadata", {
          path,
          source: valueOrNull(metadataForm.source),
          packName: valueOrNull(metadataForm.packName),
          license: valueOrNull(metadataForm.license),
          licenseUrl: valueOrNull(metadataForm.licenseUrl),
          licenseMemo: valueOrNull(metadataForm.licenseMemo),
        });
        if (updateResult !== 0) successCount += 1;
      } catch (e) {
        console.error(`Failed to update sample metadata ${targetId}:`, e);
      }
    }

    if (successCount === 0) {
      setError("No sample metadata was updated successfully. The files may have been moved or deleted.");
      return;
    }

    try {
      const refreshedList = await runSearch(searchQuery);
      await fetchAllSamplePaths();
      const refreshedSample = refreshedList.find((sample) => sample.id === metadataSample.id) ?? null;
      setSelected((prev) => (prev?.id === metadataSample.id ? refreshedSample : prev));
      setMetadataModalOpen(false);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to refresh list after metadata save: ${errorMsg}`);
    }
  }, [
    fetchAllSamplePaths,
    metadataForm,
    metadataSample,
    metadataTargetIds,
    runSearch,
    samplePaths,
    searchQuery,
    setError,
    setSelected,
  ]);

  return {
    metadataModalOpen,
    setMetadataModalOpen,
    metadataSample,
    metadataTargetIds,
    metadataForm,
    handleMetadataClick,
    handleMetadataFieldChange,
    handleMetadataSave,
  };
}
