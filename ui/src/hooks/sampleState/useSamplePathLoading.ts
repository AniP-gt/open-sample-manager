import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { MidiListHandle } from "../../components";
import type { SampleListHandle } from "../../components/SampleList/types";
import type { Midi } from "../../types/midi";
import type { TauriSampleRow } from "../../types/tauri";
import {
  getAroundOffset,
  mapSampleRowsToPathMap,
  mapSampleRowsToSamples,
} from "./samplePathHelpers";
import type {
  BooleanSetter,
  NullableNumberSetter,
  NullableSampleSetter,
  NumberSetter,
  SamplePathMapSetter,
  SampleStateSetter,
} from "./sampleStateTypes";

type UseSamplePathLoadingParams = {
  pageLimit: number;
  sampleListRef: RefObject<SampleListHandle | null>;
  midiListRef: RefObject<MidiListHandle | null>;
  setMidis: Dispatch<SetStateAction<Midi[]>>;
  setSelectedMidi: Dispatch<SetStateAction<Midi | null>>;
  setSelected: NullableSampleSetter;
  setSamples: SampleStateSetter;
  setSamplePaths: SamplePathMapSetter;
  setCurrentOffset: NumberSetter;
  setLastFetchCount: NullableNumberSetter;
  setCanLoadMore: BooleanSetter;
  setCanLoadPrevious: BooleanSetter;
};

export function useSamplePathLoading({
  pageLimit,
  sampleListRef,
  midiListRef,
  setMidis,
  setSelectedMidi,
  setSelected,
  setSamples,
  setSamplePaths,
  setCurrentOffset,
  setLastFetchCount,
  setCanLoadMore,
  setCanLoadPrevious,
}: UseSamplePathLoadingParams) {
  const loadSampleByPath = useCallback(
    async (path: string) => {
      try {
        const row = await invoke<TauriSampleRow | null>("get_sample", { path });
        if (row) {
          const aroundRows = await invoke<TauriSampleRow[]>("list_samples_around_id", {
            targetId: row.id,
            limit: pageLimit,
          });
          const nextSamples = mapSampleRowsToSamples(aroundRows);
          const aroundOffset = getAroundOffset(row.id, pageLimit);
          setSamples(nextSamples);
          setSamplePaths(mapSampleRowsToPathMap(aroundRows));
          setCurrentOffset(aroundOffset);
          setLastFetchCount(aroundRows.length);
          setCanLoadMore(aroundRows.length >= pageLimit);
          setCanLoadPrevious(aroundOffset > 0);
          setSelected(mapSampleRowsToSamples([row])[0]);
          setTimeout(() => {
            sampleListRef.current?.focusSelected?.();
          }, 0);
        }
      } catch (e) {
        console.error("Failed to load sample:", e);
      }
    },
    [
      pageLimit,
      sampleListRef,
      setCanLoadMore,
      setCanLoadPrevious,
      setCurrentOffset,
      setLastFetchCount,
      setSamplePaths,
      setSamples,
      setSelected,
    ],
  );

  const loadMidiByPath = useCallback(
    async (path: string) => {
      try {
        const row = await invoke<Midi | null>("get_midi", { path });
        if (!row) return;
        setMidis((prev) => (prev.some((midi) => midi.id === row.id) ? prev : [row, ...prev]));
        setSelectedMidi(row);
        requestAnimationFrame(() => {
          midiListRef.current?.focusSelected?.();
        });
      } catch (e) {
        console.error("Failed to load MIDI:", e);
      }
    },
    [midiListRef, setMidis, setSelectedMidi],
  );

  return { loadSampleByPath, loadMidiByPath };
}
