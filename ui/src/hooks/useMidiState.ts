import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { MidiListHandle } from "../components";
import type { MidiTagRow, TimidityStatus } from "../types/midi";
import type { ViewMode } from "../types/viewMode";
import { useMidiLibrary } from "./midiState/useMidiLibrary";
import { useMidiPlayback } from "./midiState/useMidiPlayback";
import { useMidiTags } from "./midiState/useMidiTags";

type UseMidiStateParams = { readonly setError: (message: string | null) => void; readonly pageLimit: number; readonly midiListRef: RefObject<MidiListHandle | null>; readonly viewMode: ViewMode; readonly autoPlayOnSelect: boolean };

export function useMidiState({ setError, pageLimit, midiListRef, viewMode, autoPlayOnSelect }: UseMidiStateParams) {
  const [midiTagFilterId, setMidiTagFilterId] = useState<number | null>(null); const [midiSearch, setMidiSearch] = useState("");
  const [midiTempoMin, setMidiTempoMin] = useState(""); const [midiTempoMax, setMidiTempoMax] = useState(""); const [midiFilterKey, setMidiFilterKey] = useState("");
  const [directoryPath, setDirectoryPath] = useState(""); const [favoritesOnly, setFavoritesOnly] = useState(false); const [allMidiPaths, setAllMidiPaths] = useState<string[]>([]); const [midiScannedPaths, setMidiScannedPaths] = useState<string[]>([]); const [_timidityStatus, setTimidityStatus] = useState<TimidityStatus | null>(null); const suppressMidiSearchRef = useRef(false);
  const playback = useMidiPlayback({ autoPlayOnSelect, midiListRef, setError });
  const library = useMidiLibrary({ pageLimit, directoryPath, midiTagFilterId, setError });
  const fetchAllMidiPaths = useCallback(async () => { try { setAllMidiPaths(await invoke<string[]>("get_all_midi_paths")); } catch (error) { console.error("Failed to fetch all MIDI paths:", error); } }, []);
  const { debouncedMidiSearch, runMidiSearch } = library;
  const tags = useMidiTags({ midis: library.midis, setMidis: library.setMidis, selectedMidi: playback.selectedMidi, setSelectedMidi: playback.setSelectedMidi, setSelectedMidiIds: playback.setSelectedMidiIds, runMidiSearch: library.runMidiSearch, fetchAllMidiPaths, debouncedMidiSearch: library.debouncedMidiSearch, midiTagFilterId, setError });
  const loadMidiByPath = useCallback(async (path: string, overrideDirectoryPath?: string) => { const midi = await library.loadMidiByPath(path, playback, overrideDirectoryPath); if (!midi) return; requestAnimationFrame(() => midiListRef.current?.focusSelected?.()); await playback.playMidi(midi); }, [library, midiListRef, playback]);
  const submitMidiSearch = useCallback(async () => { await library.runMidiSearch(midiSearch); }, [library, midiSearch]);
  const suppressNextMidiSearch = () => { suppressMidiSearchRef.current = true; };
  useEffect(() => { invoke<TimidityStatus>("check_timidity").then(setTimidityStatus).catch(console.error); }, []);
  useEffect(() => { if (viewMode === "midi") { void fetchAllMidiPaths(); invoke<MidiTagRow[]>("get_midi_tags").then(tags.setMidiTags).catch(console.error); } }, [fetchAllMidiPaths, tags.setMidiTags, viewMode]);
  useEffect(() => { if (viewMode !== "midi") return; if (suppressMidiSearchRef.current) { suppressMidiSearchRef.current = false; return; } void runMidiSearch(debouncedMidiSearch); }, [debouncedMidiSearch, directoryPath, midiTagFilterId, pageLimit, runMidiSearch, viewMode]);
  useEffect(() => { if (viewMode !== "midi") return; const directories = new Set<string>(); for (const path of allMidiPaths) { const segments = path.split("/"); let current = ""; for (const segment of segments.slice(0, -1)) { current += `/${segment}`; directories.add(current); } } setMidiScannedPaths(Array.from(directories).sort()); }, [allMidiPaths, viewMode]);
  return { ...library, ...playback, ...tags, _timidityStatus, midiTagFilterId, setMidiTagFilterId, midiSearch, setMidiSearch, midiTempoMin, setMidiTempoMin, midiTempoMax, setMidiTempoMax, midiFilterKey, setMidiFilterKey, directoryPath, setDirectoryPath, favoritesOnly, setFavoritesOnly, midiScannedPaths, allMidiPaths, fetchAllMidiPaths, loadMidiByPath, submitMidiSearch, suppressNextMidiSearch };
}
