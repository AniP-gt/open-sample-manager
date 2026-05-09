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
  setError: (message: string | null) => void;
};

export function useSampleClassificationState({
  samplePaths,
  instrumentTypes,
  searchQuery,
  runSearch,
  fetchAllSamplePaths,
  setSelected,
  setError,
}: UseSampleClassificationStateParams) {
  const [classificationModalOpen, setClassificationModalOpen] = useState(false);
  const [classificationSample, setClassificationSample] = useState<Sample | null>(null);
  const [editInstrumentType, setEditInstrumentType] = useState<string>("");
  const [editSampleType, setEditSampleType] = useState<SampleType>("one-shot");

  const handleTypeClick = useCallback((sample: Sample) => {
    setClassificationSample(sample);
    setEditSampleType(sample.sample_type);
    setEditInstrumentType(sample.instrument_type);
    setClassificationModalOpen(true);
  }, []);

  const handleSampleTypeSelect = useCallback((type: SampleType) => {
    setEditSampleType(type);
    setEditInstrumentType((prev) => (prev === "kick" ? "other" : prev));
  }, []);

  const handleClassificationSave = useCallback(async () => {
    if (!classificationSample) return;
    const path = samplePaths[classificationSample.id];

    if (!path) {
      setError("Sample path not available for update");
      return;
    }

    try {
      const payloadPlayback = editSampleType === "loop" ? "loop" : "oneshot";
      const payloadInstrument = instrumentTypes.some((type) => type.name === editInstrumentType)
        ? editInstrumentType
        : classificationSample.instrument_type;
      const updateResult = await invoke<number>("update_sample_classification", {
        path,
        playbackType: payloadPlayback,
        instrumentType: payloadInstrument,
      });

      if (updateResult === 0) {
        setError("Sample not found in database. The file may have been moved or deleted.");
        return;
      }
      const refreshedList = await runSearch(searchQuery);
      await fetchAllSamplePaths();
      const refreshedSample = refreshedList.find((sample) => sample.id === classificationSample.id) ?? null;
      setSelected((prev) => (prev?.id === classificationSample.id ? refreshedSample : prev));
      setClassificationModalOpen(false);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to save: ${errorMsg}`);
    }
  }, [
    classificationSample,
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
    editInstrumentType,
    setEditInstrumentType,
    editSampleType,
    handleTypeClick,
    handleSampleTypeSelect,
    handleClassificationSave,
  };
}
