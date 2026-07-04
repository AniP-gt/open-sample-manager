import { useCallback, useMemo, useState } from "react";
import type { Sample, SampleProcessingSettings } from "../types/sample";
import {
  clampSampleProcessingSettings,
  createDefaultSampleProcessingSettings,
  hasSampleProcessingEdits,
} from "../utils/sampleProcessing";

type ProcessingStateByKey = Record<string, SampleProcessingSettings>;

export function getSampleProcessingKey(sample: Sample | null, path?: string): string | null {
  if (!sample) return null;
  return `${sample.id}:${path ?? sample.file_name}`;
}

export function useSampleProcessingState(selectedSample: Sample | null, selectedPath?: string) {
  const [settingsByKey, setSettingsByKey] = useState<ProcessingStateByKey>({});
  const selectedKey = getSampleProcessingKey(selectedSample, selectedPath);

  const selectedSettings = useMemo(() => {
    if (!selectedKey) return createDefaultSampleProcessingSettings();
    return settingsByKey[selectedKey] ?? createDefaultSampleProcessingSettings();
  }, [selectedKey, settingsByKey]);

  const updateSelectedSettings = useCallback((next: SampleProcessingSettings) => {
    if (!selectedKey || !selectedSample) return;
    const clamped = clampSampleProcessingSettings(next, selectedSample.duration);
    setSettingsByKey((current) => ({ ...current, [selectedKey]: clamped }));
  }, [selectedKey, selectedSample]);

  const resetSelectedSettings = useCallback(() => {
    if (!selectedKey) return;
    setSettingsByKey((current) => ({ ...current, [selectedKey]: createDefaultSampleProcessingSettings() }));
  }, [selectedKey]);

  const clearSelectedSettings = useCallback(() => {
    if (!selectedKey) return;
    setSettingsByKey((current) => {
      const next = { ...current };
      delete next[selectedKey];
      return next;
    });
  }, [selectedKey]);

  const getSettingsForSample = useCallback((sample: Sample, path?: string) => {
    const key = getSampleProcessingKey(sample, path);
    if (!key) return undefined;
    const settings = settingsByKey[key];
    return hasSampleProcessingEdits(settings) ? settings : undefined;
  }, [settingsByKey]);

  return {
    selectedSettings,
    settingsByKey,
    updateSelectedSettings,
    resetSelectedSettings,
    clearSelectedSettings,
    getSettingsForSample,
  };
}
