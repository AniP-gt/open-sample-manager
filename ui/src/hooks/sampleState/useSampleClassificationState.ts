import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { InstrumentTypeRow, Sample, SampleType } from "../../types/sample";
import type {
  FetchAllSamplePaths,
  NullableSampleSetter,
  RunSampleSearch,
} from "./sampleStateTypes";
import type { SamplePathMap } from "./samplePathHelpers";

type UseSampleClassificationStateParams = {
  samplePaths: SamplePathMap;
  instrumentTypes: InstrumentTypeRow[];
  searchQuery: string;
  runSearch: RunSampleSearch;
  fetchAllSamplePaths: FetchAllSamplePaths;
  setSelected: NullableSampleSetter;
  selectedIds: Set<number>;
  setError: (message: string | null) => void;
};

export function useSampleClassificationState({
  samplePaths,
  instrumentTypes,
  searchQuery,
  runSearch,
  fetchAllSamplePaths,
  setSelected,
  selectedIds,
  setError,
}: UseSampleClassificationStateParams) {
  const [classificationModalOpen, setClassificationModalOpen] = useState(false);
  const [classificationSample, setClassificationSample] = useState<Sample | null>(null);
  const [classificationTargetIds, setClassificationTargetIds] = useState<number[]>([]);
  const [editInstrumentType, setEditInstrumentType] = useState<string>("");
  const [editSampleType, setEditSampleType] = useState<SampleType>("one-shot");

  const handleTypeClick = useCallback((sample: Sample) => {
    setClassificationSample(sample);
    setEditSampleType(sample.sample_type);
    setEditInstrumentType(sample.instrument_type);
    if (selectedIds.has(sample.id)) {
      setClassificationTargetIds(Array.from(selectedIds));
    } else {
      setClassificationTargetIds([sample.id]);
    }
    setClassificationModalOpen(true);
  }, [selectedIds]);

  const handleSampleTypeSelect = useCallback((type: SampleType) => {
    setEditSampleType(type);
    setEditInstrumentType((prev) => (prev === "kick" ? "other" : prev));
  }, []);

  const handleClassificationSave = useCallback(async () => {
    if (!classificationSample) return;
    
    let successCount = 0;
    
    for (const targetId of classificationTargetIds) {
      const path = samplePaths[targetId];
      if (!path) continue;

      try {
        const payloadPlayback = editSampleType === "loop" ? "loop" : "oneshot";
        const isKnownInstrument = instrumentTypes.some((type) => type.name === editInstrumentType);
        
        const updateResult = await invoke<number>("update_sample_classification", {
          path,
          playbackType: payloadPlayback,
          instrumentType: isKnownInstrument ? editInstrumentType : classificationSample.instrument_type,
        });
        if (updateResult !== 0) successCount++;
      } catch (e) {
        console.error(`Failed to update sample ${targetId}:`, e);
      }
    }

    if (successCount === 0) {
      setError("No samples were updated successfully. They may have been moved or deleted.");
      return;
    }

    try {
      const refreshedList = await runSearch(searchQuery);
      await fetchAllSamplePaths();
      const refreshedSample = refreshedList.find((sample) => sample.id === classificationSample.id) ?? null;
      setSelected((prev) => (prev?.id === classificationSample.id ? refreshedSample : prev));
      setClassificationModalOpen(false);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to refresh list after save: ${errorMsg}`);
    }
  }, [
    classificationSample,
    classificationTargetIds,
    editInstrumentType,
    editSampleType,
    fetchAllSamplePaths,
    instrumentTypes,
    runSearch,
    samplePaths,
    searchQuery,
    setError,
    setSelected,
  ]);

  return {
    classificationModalOpen,
    setClassificationModalOpen,
    classificationSample,
    classificationTargetIds,
    editInstrumentType,
    setEditInstrumentType,
    editSampleType,
    handleTypeClick,
    handleSampleTypeSelect,
    handleClassificationSave,
  };
}
