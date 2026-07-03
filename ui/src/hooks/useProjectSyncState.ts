import { useMemo, useState } from "react";
import type { Midi } from "../types/midi";
import type { Sample } from "../types/sample";
import {
  buildPreviewSyncResult,
  computeTempoRate,
  parseMidiKeyEstimate,
  parseProjectBpm,
  type ProjectSyncSettings,
} from "../utils/previewSync";

export function useProjectSyncState() {
  const [projectBpm, setProjectBpm] = useState("120");
  const [projectKey, setProjectKey] = useState("C");
  const [tempoSync, setTempoSync] = useState(false);
  const [keySync, setKeySync] = useState(false);

  const settings = useMemo<ProjectSyncSettings>(
    () => ({ projectBpm, projectKey, tempoSync, keySync }),
    [keySync, projectBpm, projectKey, tempoSync],
  );

  const getSamplePlaybackRate = (sample: Sample | null) => {
    if (!sample || !tempoSync) return 1;
    return computeTempoRate(sample.bpm, parseProjectBpm(projectBpm)) ?? 1;
  };

  const getSamplePitchShift = (sample: Sample | null) => {
    if (!sample) return 0;
    return buildPreviewSyncResult(settings, sample.bpm, sample.musical_key).transposeSemitones ?? 0;
  };

  const getMidiPreviewOptions = (midi: Midi | null) => {
    if (!midi) return {};
    return buildPreviewSyncResult(settings, midi.tempo, parseMidiKeyEstimate(midi.key_estimate));
  };

  return {
    projectBpm,
    setProjectBpm,
    projectKey,
    setProjectKey,
    tempoSync,
    setTempoSync,
    keySync,
    setKeySync,
    settings,
    getSamplePlaybackRate,
    getSamplePitchShift,
    getMidiPreviewOptions,
  };
}
