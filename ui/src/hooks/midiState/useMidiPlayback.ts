import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import type { RefObject, SetStateAction } from "react";
import type { MidiListHandle } from "../../components";
import type { Midi } from "../../types/midi";
import { getErrorMessage } from "../../utils/sampleMapper";

type UseMidiPlaybackParams = { readonly autoPlayOnSelect: boolean; readonly midiListRef: RefObject<MidiListHandle | null>; readonly setError: (message: string | null) => void };
export function useMidiPlayback({ autoPlayOnSelect, midiListRef, setError }: UseMidiPlaybackParams) {
  const [selectedMidi, setSelectedMidiState] = useState<Midi | null>(null); const [selectedMidiIds, setSelectedMidiIds] = useState<Set<number>>(new Set()); const [isMidiPlaying, setIsMidiPlaying] = useState(false);
  const setSelectedMidi = useCallback((value: SetStateAction<Midi | null>) => setSelectedMidiState((previous) => { const next = typeof value === "function" ? value(previous) : value; setSelectedMidiIds(next ? new Set([next.id]) : new Set()); return next; }), []);
  const handleMidiSelect = useCallback(async (midi: Midi, isShift?: boolean, rangeIds?: Set<number>) => { if (selectedMidi?.id !== midi.id && isMidiPlaying) { await invoke("stop_midi").catch(() => undefined); setIsMidiPlaying(false); } setSelectedMidiState(midi); setSelectedMidiIds(isShift && rangeIds ? rangeIds : new Set([midi.id])); requestAnimationFrame(() => midiListRef.current?.focusSelected?.()); if (autoPlayOnSelect && midi.path && selectedMidi?.id !== midi.id) { try { await invoke("play_midi", { path: midi.path }); setIsMidiPlaying(true); } catch { setIsMidiPlaying(false); } } }, [autoPlayOnSelect, isMidiPlaying, midiListRef, selectedMidi?.id]);
  const togglePlaySelectedMidi = useCallback(async () => { if (!selectedMidi) return; if (isMidiPlaying) { try { await invoke("stop_midi"); } catch (error) { console.error("stop_midi failed:", error); } finally { setIsMidiPlaying(false); } } else { try { await invoke("play_midi", { path: selectedMidi.path }); setIsMidiPlaying(true); } catch (error) { setError(getErrorMessage(error)); setIsMidiPlaying(false); } } }, [isMidiPlaying, selectedMidi, setError]);
  const playMidi = useCallback(async (midi: Midi) => { if (!autoPlayOnSelect || !midi.path) return; if (isMidiPlaying) { await invoke("stop_midi").catch(() => undefined); setIsMidiPlaying(false); } try { await invoke("play_midi", { path: midi.path }); setIsMidiPlaying(true); } catch { setIsMidiPlaying(false); } }, [autoPlayOnSelect, isMidiPlaying]);
  return { selectedMidi, setSelectedMidi, selectedMidiIds, setSelectedMidiIds, isMidiPlaying, setIsMidiPlaying, handleMidiSelect, togglePlaySelectedMidi, playMidi };
}
