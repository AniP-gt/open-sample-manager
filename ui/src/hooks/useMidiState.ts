import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
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
  const [selectedMidi, setSelectedMidiState] = useState<Midi | null>(null);
  const [selectedMidiIds, setSelectedMidiIds] = useState<Set<number>>(new Set());
  const [_timidityStatus, setTimidityStatus] = useState<TimidityStatus | null>(null);
  const [isMidiPlaying, setIsMidiPlaying] = useState(false);
  const [midiTags, setMidiTags] = useState<MidiTagRow[]>([]);
  const [midiTagFilterId, setMidiTagFilterId] = useState<number | null>(null);
  const [midiSearch, setMidiSearch] = useState("");
  const [debouncedMidiSearch, setDebouncedMidiSearch] = useState("");
  const [directoryPath, setDirectoryPath] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const suppressMidiSearchRef = useRef(false);
  const [midiTagModalOpen, setMidiTagModalOpen] = useState(false);
  const [midiTagEditOpen, setMidiTagEditOpen] = useState(false);
  const [midiTagEditTarget, setMidiTagEditTarget] = useState<Midi | null>(null);
  const [midiTagEditTargetIds, setMidiTagEditTargetIds] = useState<number[]>([]);
  const [midiScannedPaths, setMidiScannedPaths] = useState<string[]>([]);
  const [allMidiPaths, setAllMidiPaths] = useState<string[]>([]);
  const [isLoadingMoreMidi, setIsLoadingMoreMidi] = useState(false);
  const [isLoadingPreviousMidi, setIsLoadingPreviousMidi] = useState(false);
  const [currentMidiOffset, setCurrentMidiOffset] = useState(0);
  const [canLoadMoreMidi, setCanLoadMoreMidi] = useState(true);
  const [canLoadPreviousMidi, setCanLoadPreviousMidi] = useState(false);
  const [lastFetchCountMidi, setLastFetchCountMidi] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrashMidiId, setPendingTrashMidiId] = useState<number | null>(null);

  const setSelectedMidi = useCallback((value: SetStateAction<Midi | null>) => {
    setSelectedMidiState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      setSelectedMidiIds(next ? new Set([next.id]) : new Set());
      return next;
    });
  }, []);

  const fetchAllMidiPaths = async () => {
    try {
      const paths = await invoke<string[]>("get_all_midi_paths");
      setAllMidiPaths(paths);
    } catch (e) {
      console.error("Failed to fetch all MIDI paths:", e);
    }
  };

  const hasActiveMidiFilters = (overrideDirectoryPath?: string) => {
    const query = debouncedMidiSearch.trim();
    const directoryFilter = (overrideDirectoryPath ?? directoryPath) || "";
    return query.length > 0 || midiTagFilterId !== null || directoryFilter.length > 0;
  };

  const loadFilteredMidiPage = async (query: string, overrideDirectoryPath?: string) => {
    const payload = {
      limit: pageLimit,
      offset: 0,
      directoryPath: (overrideDirectoryPath ?? directoryPath) || null,
      tagId: midiTagFilterId,
    } as const;

    return query.trim()
      ? invoke<Midi[]>("search_midis_paginated", { query, ...payload })
      : invoke<Midi[]>("list_midis_paginated", payload);
  };

  const loadMidiByPath = async (path: string, overrideDirectoryPath?: string) => {
    try {
      const row = await invoke<Midi | null>("get_midi", { path });
      if (!row) return;

      if (hasActiveMidiFilters(overrideDirectoryPath)) {
        const rows = await loadFilteredMidiPage(debouncedMidiSearch.trim(), overrideDirectoryPath);
        setMidis(rows);
        setCurrentMidiOffset(0);
        setLastFetchCountMidi(rows.length);
        setCanLoadMoreMidi(rows.length >= pageLimit);
        setCanLoadPreviousMidi(false);
      } else {
        const aroundRows = await invoke<Midi[]>("list_midis_around_id", {
          targetId: row.id,
          limit: pageLimit,
        });
        const halfWindow = Math.floor(pageLimit / 2);
        const aroundOffset = Math.max(0, row.id - halfWindow);
        setMidis(aroundRows);
        setCurrentMidiOffset(aroundOffset);
        setLastFetchCountMidi(aroundRows.length);
        setCanLoadMoreMidi(aroundRows.length >= pageLimit);
        setCanLoadPreviousMidi(aroundOffset > 0);
      }
      setSelectedMidi(row);
      requestAnimationFrame(() => {
        midiListRef.current?.focusSelected?.();
      });
      if (autoPlayOnSelect && row.path) {
        if (isMidiPlaying) {
          await invoke("stop_midi").catch(() => {});
          setIsMidiPlaying(false);
        }
        try {
          await invoke("play_midi", { path: row.path });
          setIsMidiPlaying(true);
        } catch {
          setIsMidiPlaying(false);
        }
      }
    } catch (e) {
      console.error("Failed to load MIDI:", e);
    }
  };

  const runMidiSearch = useCallback(async (query: string) => {
    try {
      if (query.trim()) {
        const rows = await invoke<Midi[]>("search_midis_paginated", {
          query,
          limit: pageLimit,
          offset: 0,
          directoryPath: directoryPath || null,
          tagId: midiTagFilterId,
        });
        setMidis(rows);
        setLastFetchCountMidi(rows.length);
        setCurrentMidiOffset(0);
        setCanLoadMoreMidi(rows.length >= pageLimit);
        setCanLoadPreviousMidi(false);
      } else {
        const rows = await invoke<Midi[]>("list_midis_paginated", {
          limit: pageLimit,
          offset: 0,
          directoryPath: directoryPath || null,
          tagId: midiTagFilterId,
        });
        setMidis(rows);
        setLastFetchCountMidi(rows.length);
        setCurrentMidiOffset(0);
        setCanLoadMoreMidi(rows.length >= pageLimit);
        setCanLoadPreviousMidi(false);
      }
    } catch (e) {
      console.error("MIDI search failed:", e);
    }
  }, [directoryPath, midiTagFilterId, pageLimit]);

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
      await runMidiSearch(debouncedMidiSearch);
      await fetchAllMidiPaths();
      if (selectedMidi?.id === pendingTrashMidiId) setSelectedMidi(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setConfirmOpen(false);
      setPendingTrashMidiId(null);
    }
  };

  const handleMidiTagChange = async (midiIds: number | number[], tagId: number | null) => {
    try {
      const ids = Array.isArray(midiIds) ? midiIds : [midiIds];
      await Promise.all(ids.map(id => invoke("set_midi_file_tag", { midiId: id, tagId })));
      const tagName = tagId != null ? (midiTags.find((t) => t.id === tagId)?.name ?? "") : "";
      setMidis((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, tag_name: tagName } : m)));
      if (midiTagFilterId != null && tagId !== midiTagFilterId) {
        await runMidiSearch(debouncedMidiSearch);
      }
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
    if (isLoadingMoreMidi || !canLoadMoreMidi) return;
    setIsLoadingMoreMidi(true);
    try {
      const nextOffset = currentMidiOffset + midis.length;
      const searchQuery = debouncedMidiSearch.trim();
      const rows = searchQuery
        ? await invoke<Midi[]>("search_midis_paginated", {
            query: debouncedMidiSearch,
            limit: pageLimit,
            offset: nextOffset,
            directoryPath: directoryPath || null,
            tagId: midiTagFilterId,
          })
        : await invoke<Midi[]>("list_midis_paginated", {
            limit: pageLimit,
            offset: nextOffset,
            directoryPath: directoryPath || null,
            tagId: midiTagFilterId,
          });
      setMidis((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const fresh = rows.filter((r) => !existing.has(r.id));
        return [...prev, ...fresh];
      });
      setLastFetchCountMidi(rows.length);
      setCanLoadMoreMidi(rows.length >= pageLimit);
      setCanLoadPreviousMidi(currentMidiOffset > 0);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoadingMoreMidi(false);
    }
  };

  const loadPreviousMidi = async () => {
    if (isLoadingPreviousMidi || !canLoadPreviousMidi || currentMidiOffset === 0) return;
    setIsLoadingPreviousMidi(true);
    try {
      const prevOffset = Math.max(0, currentMidiOffset - pageLimit);
      const searchQuery = debouncedMidiSearch.trim();
      const rows = searchQuery
        ? await invoke<Midi[]>("search_midis_paginated", {
            query: debouncedMidiSearch,
            limit: pageLimit,
            offset: prevOffset,
            directoryPath: directoryPath || null,
            tagId: midiTagFilterId,
          })
        : await invoke<Midi[]>("list_midis_paginated", {
            limit: pageLimit,
            offset: prevOffset,
            directoryPath: directoryPath || null,
            tagId: midiTagFilterId,
          });
      setMidis((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const fresh = rows.filter((r) => !existing.has(r.id));
        return [...fresh, ...prev];
      });
      setCurrentMidiOffset(prevOffset);
      setLastFetchCountMidi(rows.length);
      setCanLoadPreviousMidi(prevOffset > 0);
      setCanLoadMoreMidi(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoadingPreviousMidi(false);
    }
  };

  const loadAroundMidi = async (targetIndex: number) => {
    setIsLoadingMoreMidi(true);
    setIsLoadingPreviousMidi(true);
    try {
      if (hasActiveMidiFilters()) {
        const rows = await loadFilteredMidiPage(debouncedMidiSearch.trim());
        setMidis(rows);
        setCurrentMidiOffset(0);
        setCanLoadPreviousMidi(false);
        setLastFetchCountMidi(rows.length);
        setCanLoadMoreMidi(rows.length >= pageLimit);
      } else {
        const rows = await invoke<Midi[]>("list_midis_around_id", {
          targetId: targetIndex,
          limit: pageLimit,
        });
        const halfWindow = Math.floor(pageLimit / 2);
        const aroundOffset = Math.max(0, targetIndex - halfWindow);
        setMidis(rows);
        setCurrentMidiOffset(aroundOffset);
        setCanLoadPreviousMidi(aroundOffset > 0);
        setLastFetchCountMidi(rows.length);
        setCanLoadMoreMidi(rows.length >= pageLimit);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoadingMoreMidi(false);
      setIsLoadingPreviousMidi(false);
    }
  };

  const handleMidiSelect = async (midi: Midi, isShift?: boolean, rangeIds?: Set<number>) => {
    if (selectedMidi?.id !== midi.id && isMidiPlaying) {
      await invoke("stop_midi").catch(() => {});
      setIsMidiPlaying(false);
    }
    setSelectedMidiState(midi);
    if (isShift && rangeIds) {
      setSelectedMidiIds(rangeIds);
    } else {
      setSelectedMidiIds(new Set([midi.id]));
    }
    requestAnimationFrame(() => {
      midiListRef.current?.focusSelected?.();
    });
    if (autoPlayOnSelect && midi.path && selectedMidi?.id !== midi.id) {
      try {
        await invoke("play_midi", { path: midi.path });
        setIsMidiPlaying(true);
      } catch {
        setIsMidiPlaying(false);
      }
    }
  };

  const togglePlaySelectedMidi = useCallback(async () => {
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
  }, [selectedMidi, isMidiPlaying, setError]);

  useEffect(() => {
    invoke<TimidityStatus>("check_timidity").then(setTimidityStatus).catch(console.error);
  }, []);

  useEffect(() => {
    if (viewMode === "midi") {
      void fetchAllMidiPaths();
      invoke<MidiTagRow[]>("get_midi_tags").then(setMidiTags).catch(console.error);
    }
  }, [viewMode]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedMidiSearch(midiSearch), 300);
    return () => clearTimeout(id);
  }, [midiSearch]);

  useEffect(() => {
    if (viewMode === "midi") {
      if (suppressMidiSearchRef.current) {
        suppressMidiSearchRef.current = false;
        return;
      }
      void runMidiSearch(debouncedMidiSearch);
    }
  }, [debouncedMidiSearch, directoryPath, midiTagFilterId, pageLimit, runMidiSearch, viewMode]);

  const suppressNextMidiSearch = () => {
    suppressMidiSearchRef.current = true;
  };

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
    selectedMidiIds,
    setSelectedMidiIds,
    _timidityStatus,
    isMidiPlaying,
    setIsMidiPlaying,
    midiTags,
    midiTagFilterId,
    setMidiTagFilterId,
    midiSearch,
    setMidiSearch,
    debouncedMidiSearch,
    directoryPath,
    setDirectoryPath,
    favoritesOnly,
    setFavoritesOnly,
    midiTagModalOpen,
    setMidiTagModalOpen,
    midiTagEditOpen,
    setMidiTagEditOpen,
    midiTagEditTarget,
    setMidiTagEditTarget,
    midiTagEditTargetIds,
    setMidiTagEditTargetIds,
    midiScannedPaths,
    allMidiPaths,
    isLoadingMoreMidi,
    isLoadingPreviousMidi,
    canLoadMoreMidi,
    canLoadPreviousMidi,
    lastFetchCountMidi,
    setLastFetchCountMidi,
    confirmOpen,
    setConfirmOpen,
    pendingTrashMidiId,
    setPendingTrashMidiId,
    fetchAllMidiPaths,
    loadMidiByPath,
    runMidiSearch,
    suppressNextMidiSearch,
    requestTrashMidi,
    confirmTrashMidi,
    handleMidiTagChange,
    handleAddMidiTag,
    handleDeleteMidiTag,
    handleUpdateMidiTag,
    loadMoreMidi,
    loadPreviousMidi,
    loadAroundMidi,
    handleMidiSelect,
    togglePlaySelectedMidi,
  };
}
