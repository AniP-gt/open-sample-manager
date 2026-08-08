import type { Dispatch, RefObject, SetStateAction } from "react";
import type { PlayerBarHandle, MidiListHandle } from "../../components";
import type { SampleListHandle } from "../../components/SampleList/types";
import type { Midi } from "../../types/midi";
import type { FilterState, Sample } from "../../types/sample";
import type { SamplePathMap } from "./samplePathHelpers";

export type InvokeErrorHandler = (error: unknown) => void;

export type RetryAction = () => Promise<void>;

export type SampleStateSetter = Dispatch<SetStateAction<Sample[]>>;

export type SamplePathMapSetter = Dispatch<SetStateAction<SamplePathMap>>;

export type NullableSampleSetter = Dispatch<SetStateAction<Sample | null>>;

export type BooleanSetter = Dispatch<SetStateAction<boolean>>;

export type NumberSetter = Dispatch<SetStateAction<number>>;

export type NullableNumberSetter = Dispatch<SetStateAction<number | null>>;

export type StringArraySetter = Dispatch<SetStateAction<string[]>>;

export type RetryActionSetter = Dispatch<SetStateAction<RetryAction | null>>;

export type RunSampleSearch = (query: string, directoryPath?: string | null) => Promise<Sample[]>;

export type FetchAllSamplePaths = () => Promise<void>;

export type UseSampleStateParams = {
  setError: (message: string | null) => void;
  sampleListRef: RefObject<SampleListHandle | null>;
  midiListRef: RefObject<MidiListHandle | null>;
  playerBarRef: RefObject<PlayerBarHandle | null>;
  pageLimit: number;
  setMidis: Dispatch<SetStateAction<Midi[]>>;
  setSelectedMidi: Dispatch<SetStateAction<Midi | null>>;
  fetchAllMidiPaths: () => Promise<void>;
};

export type SearchFiltersSnapshot = Pick<FilterState, "search" | "directoryPath">;
