import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Midi, MidiTagRow, TimidityStatus } from "../types/midi";
import { getErrorMessage } from "../utils/sampleMapper";
import type { MidiListHandle } from "../components";

type UseMidiStateParams = {
  setError: (message: string | null) => void;
  pageLimit: number;
  midiListRef: React.RefObject<MidiListHandle | null>;
  viewMode: "sample" | "midi";
  autoPlayOnSelect: boolean;
};

export function useMidiState({
  setError,
  pageLimit,
  midiListRef,
  viewMode,
  autoPlayOnSelect,
}: UseMidiStateParams) {
  const [midis, setMidis] = useState<Midi[]>([]);
  const [selectedMidi, setSelectedMidi] = useState<Midi | null>(null);
  const [_timidityStatus, setTimidityStatus] = useState<TimidityStatus | null>(null);
  const [isMidiPlaying, setIsMidiPlaying] = useState(false);
  const [midiTags, setMidiTags] = useState<MidiTagRow[]>([]);
  const [midiTagFilterId, setMidiTagFilterId] = useState<number | null>(null);
  const [midiSearch, setMidiSearch] = useState("");
  const [debouncedMidiSearch, setDebouncedMidiSearch] = useState("");
  const [midiTagModalOpen, setMidiTagModalOpen] = useState(false);
  const [midiTagEditOpen, setMidiTagEditOpen] = useState(false);
  const [midiTagEditTarget, setMidiTagEditTarget] = useState<Midi | null>(null);
  const [midiScannedPaths, setMidiScannedPaths] = useState<string[]>([]);
  const [allMidiPaths, setAllMidiPaths] = useState<string[]>([]);
  const [isLoadingMoreMidi, setIsLoadingMoreMidi] = useState(false);
  const [lastFetchCountMidi, setLastFetchCountMidi] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrashMidiId, setPendingTrashMidiId] = useState<number | null>(null);

  const fetchAllMidiPaths = async () => {
    try {
      const paths = await invoke<string[]>("get_all_midi_paths");
      setAllMidiPaths(paths);
    } catch (e) {
      console.error("Failed to fetch all MIDI paths:", e);
    }
  };

  const loadMidiByPath = async (path: string) => {
    try {
      const row = await invoke<Midi | null>("get_midi", { path });
      if (!row) return;
      setMidis((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
      setSelectedMidi(row);
      requestAnimationFrame(() => {
        midiListRef.current?.focusSelected?.();
      });
    } catch (e) {
      console.error("Failed to load MIDI:", e);
    }
  };

  const runMidiSearch = async (query: string) => {
    try {
      if (query.trim()) {
        const rows = await invoke<Midi[]>("search_midis", { query });
        setMidis(rows);
        setLastFetchCountMidi(rows.length);
      } else {
        const rows = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
        setMidis(rows);
        setLastFetchCountMidi(rows.length);
      }
    } catch (e) {
      console.error("MIDI search failed:", e);
    }
  };

  const requestTrashMidi = (id: number) => {
    setPendingTrashMidiId(id);
    setConfirmOpen(true);
  };

  const confirmTrashMidi = async () => {
    if (pendingTrashMidiId == null) return;
    const midiRow = midis.find((m) => m.id === pendingTrashMidiId);
    const path = midiRow?.path;
    if (!path) {
      setConfirmOpen(false);
      setPendingTrashMidiId(null);
      return;
    }

    try {
      await invoke<string>("send_to_trash", { path });
      const rows = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
      setMidis(rows);
      setLastFetchCountMidi(rows.length);
      await fetchAllMidiPaths();
      if (selectedMidi?.id === pendingTrashMidiId) setSelectedMidi(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setConfirmOpen(false);
      setPendingTrashMidiId(null);
    }
  };

  const handleMidiTagChange = async (midiId: number, tagId: number | null) => {
    try {
      await invoke("set_midi_file_tag", { midiId, tagId });
      const tagName = tagId != null ? (midiTags.find((t) => t.id === tagId)?.name ?? "") : "";
      setMidis((prev) => prev.map((m) => (m.id === midiId ? { ...m, tag_name: tagName } : m)));
    } catch (e) {
      setError(`Failed to set MIDI tag: ${e}`);
    }
  };

  const handleAddMidiTag = async (name: string) => {
    try {
      await invoke<number>("add_midi_tag", { name });
      const updated = await invoke<MidiTagRow[]>("get_midi_tags");
      setMidiTags(updated ?? []);
    } catch (e) {
      setError(`Failed to add MIDI tag: ${e}`);
    }
  };

  const handleDeleteMidiTag = async (id: number) => {
    try {
      await invoke<number>("delete_midi_tag", { id });
      const updated = await invoke<MidiTagRow[]>("get_midi_tags");
      setMidiTags(updated ?? []);
    } catch (e) {
      setError(`Failed to delete MIDI tag: ${e}`);
    }
  };

  const handleUpdateMidiTag = async (id: number, name: string) => {
    try {
      await invoke<number>("update_midi_tag", { id, name });
      const updated = await invoke<MidiTagRow[]>("get_midi_tags");
      setMidiTags(updated ?? []);
    } catch (e) {
      setError(`Failed to update MIDI tag: ${e}`);
    }
  };

  const loadMoreMidi = async () => {
    setIsLoadingMoreMidi(true);
    try {
      const rows = await invoke<Midi[]>("list_midis_paginated", {
        limit: pageLimit,
        offset: midis.length,
      });
      setMidis((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const fresh = rows.filter((r) => !existing.has(r.id));
        return [...prev, ...fresh];
      });
      setLastFetchCountMidi(rows.length);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoadingMoreMidi(false);
    }
  };

  const handleMidiSelect = async (midi: Midi) => {
    if (isMidiPlaying) {
      await invoke("stop_midi").catch(() => {});
      setIsMidiPlaying(false);
    }
    setSelectedMidi(midi);
    requestAnimationFrame(() => {
      midiListRef.current?.focusSelected?.();
    });
    if (autoPlayOnSelect && midi.path) {
      try {
        await invoke("play_midi", { path: midi.path });
        setIsMidiPlaying(true);
      } catch {
        setIsMidiPlaying(false);
      }
    }
  };

  const togglePlaySelectedMidi = async () => {
    if (!selectedMidi) return;
    if (isMidiPlaying) {
      try {
        await invoke("stop_midi");
      } catch (e) {
        console.error("stop_midi failed:", e);
      } finally {
        setIsMidiPlaying(false);
      }
    } else {
      try {
        await invoke("play_midi", { path: selectedMidi.path });
        setIsMidiPlaying(true);
      } catch (e) {
        setError(getErrorMessage(e));
        setIsMidiPlaying(false);
      }
    }
  };

  useEffect(() => {
    invoke<TimidityStatus>("check_timidity").then(setTimidityStatus).catch(console.error);
  }, []);

  useEffect(() => {
    if (viewMode === "midi") {
      invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 })
        .then((rows) => {
          setMidis(rows);
          setLastFetchCountMidi(rows.length);
        })
        .catch(console.error);
      void fetchAllMidiPaths();
      invoke<MidiTagRow[]>("get_midi_tags").then(setMidiTags).catch(console.error);
    }
  }, [viewMode, pageLimit]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedMidiSearch(midiSearch), 300);
    return () => clearTimeout(id);
  }, [midiSearch]);

  useEffect(() => {
    if (viewMode === "midi") {
      void runMidiSearch(debouncedMidiSearch);
    }
  }, [debouncedMidiSearch, viewMode]);

  useEffect(() => {
    if (viewMode !== "midi") return;
    const uniqueDirs = new Set<string>();
    for (const fullPath of allMidiPaths) {
      const pathParts = fullPath.split("/");
      if (pathParts.length > 1) {
        let currentPath = "";
        for (let i = 0; i < pathParts.length - 1; i += 1) {
          currentPath += "/" + pathParts[i];
          uniqueDirs.add(currentPath);
        }
      }
    }
    setMidiScannedPaths(Array.from(uniqueDirs).sort());
  }, [allMidiPaths, viewMode]);

  return {
    midis,
    setMidis,
    selectedMidi,
    setSelectedMidi,
    _timidityStatus,
    isMidiPlaying,
    setIsMidiPlaying,
    midiTags,
    midiTagFilterId,
    setMidiTagFilterId,
    midiSearch,
    setMidiSearch,
    debouncedMidiSearch,
    midiTagModalOpen,
    setMidiTagModalOpen,
    midiTagEditOpen,
    setMidiTagEditOpen,
    midiTagEditTarget,
    setMidiTagEditTarget,
    midiScannedPaths,
    allMidiPaths,
    isLoadingMoreMidi,
    lastFetchCountMidi,
    setLastFetchCountMidi,
    confirmOpen,
    setConfirmOpen,
    pendingTrashMidiId,
    setPendingTrashMidiId,
    fetchAllMidiPaths,
    loadMidiByPath,
    runMidiSearch,
    requestTrashMidi,
    confirmTrashMidi,
    handleMidiTagChange,
    handleAddMidiTag,
    handleDeleteMidiTag,
    handleUpdateMidiTag,
    loadMoreMidi,
    handleMidiSelect,
    togglePlaySelectedMidi,
  };
}
