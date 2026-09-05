import { useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MidiListHandle, PlayerBarHandle } from "../components";
import type { SampleListHandle } from "../components/SampleList/types";
import type { Midi } from "../types/midi";
import type { FilterState, Sample } from "../types/sample";

type SampleApi = {
  readonly allSamplePaths: string[];
  readonly filters: FilterState;
  readonly runSearch: (query: string) => Promise<Sample[]>;
  readonly fetchAllSamplePaths: () => Promise<void>;
  readonly setSelected: Dispatch<SetStateAction<Sample | null>>;
};

type MidiApi = {
  readonly fetchAllMidiPaths: () => Promise<void>;
  readonly setMidis: Dispatch<SetStateAction<Midi[]>>;
  readonly setLastFetchCountMidi: Dispatch<SetStateAction<number | null>>;
  readonly directoryPath: string;
  readonly midiTagFilterId: number | null;
};

export function useAppRefs() {
  const sampleListRef = useRef<SampleListHandle>(null);
  const midiListRef = useRef<MidiListHandle>(null);
  const [playerBar, setPlayerBar] = useState<PlayerBarHandle | null>(null);
  const playerBarRef = useMemo(() => ({ current: playerBar }), [playerBar]);
  const scanImportHandlerRef = useRef<((paths: string[]) => Promise<void>) | null>(null);
  const sampleApiRef = useRef<SampleApi | null>(null);
  const midiApiRef = useRef<MidiApi | null>(null);

  return { midiApiRef, midiListRef, playerBarRef, sampleApiRef, sampleListRef, scanImportHandlerRef, setPlayerBar };
}
