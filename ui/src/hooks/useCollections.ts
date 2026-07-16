import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Collection } from "../types/collection";
import type { TauriSampleRow } from "../types/tauri";
import { mapRowToSample } from "../utils/sampleMapper";

type UseCollectionsParams = {
  readonly onError?: (message: string) => void;
};

function collectionList(value: unknown): Collection[] {
  return Array.isArray(value) ? value.filter((item): item is Collection => (
    typeof item === "object"
    && item !== null
    && "id" in item
    && typeof item.id === "number"
    && "name" in item
    && typeof item.name === "string"
    && "created_at" in item
    && typeof item.created_at === "string"
    && "sample_count" in item
    && typeof item.sample_count === "number"
  )) : [];
}

function isTauriSampleRow(value: unknown): value is TauriSampleRow {
  return typeof value === "object"
    && value !== null
    && "id" in value
    && typeof value.id === "number"
    && "path" in value
    && typeof value.path === "string"
    && "file_name" in value
    && typeof value.file_name === "string"
    && "playback_type" in value
    && typeof value.playback_type === "string"
    && "instrument_type" in value
    && typeof value.instrument_type === "string"
    && "tags" in value
    && Array.isArray(value.tags);
}

export function useCollections({ onError }: UseCollectionsParams = {}) {
  const [collections, setCollections] = useState<readonly Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [activeMembers, setActiveMembers] = useState<readonly TauriSampleRow[]>([]);
  const [isCollectionView, setIsCollectionView] = useState(false);
  const isMountedRef = useRef(true);
  const activeCollectionIdRef = useRef<number | null>(null);
  const collectionRequestVersionRef = useRef(0);
  const memberRequestVersionRef = useRef(0);

  const loadMembers = useCallback(async (collectionId: number) => {
    const requestVersion = ++memberRequestVersionRef.current;
    const rows = await invoke<unknown>("get_collection_members", { collectionId });
    if (
      !isMountedRef.current
      || requestVersion !== memberRequestVersionRef.current
      || collectionId !== activeCollectionIdRef.current
    ) return;
    setActiveMembers(Array.isArray(rows) ? rows.filter(isTauriSampleRow) : []);
  }, []);

  const refresh = useCallback(async () => {
    const requestVersion = ++collectionRequestVersionRef.current;
    const nextCollections = collectionList(await invoke<unknown>("list_collections"));
    if (!isMountedRef.current || requestVersion !== collectionRequestVersionRef.current) return;
    setCollections(nextCollections);
    const currentCollectionId = activeCollectionIdRef.current;
    if (currentCollectionId === null) return;
    if (!nextCollections.some((collection) => collection.id === currentCollectionId)) {
      activeCollectionIdRef.current = null;
      setActiveCollectionId(null);
      setActiveMembers([]);
      return;
    }
    await loadMembers(currentCollectionId);
  }, [loadMembers]);

  const selectCollection = useCallback(async (collectionId: number) => {
    setIsCollectionView(true);
    activeCollectionIdRef.current = collectionId;
    setActiveCollectionId(collectionId);
    await loadMembers(collectionId);
  }, [loadMembers]);

  const clearCollection = useCallback(() => {
    setIsCollectionView(false);
    activeCollectionIdRef.current = null;
    setActiveCollectionId(null);
    setActiveMembers([]);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const requestVersion = ++collectionRequestVersionRef.current;
    void invoke<unknown>("list_collections")
      .then(collectionList)
      .then((nextCollections) => {
        if (isMountedRef.current && requestVersion === collectionRequestVersionRef.current) {
          setCollections(nextCollections);
        }
      })
      .then(undefined, () => {
        if (isMountedRef.current && requestVersion === collectionRequestVersionRef.current) {
          onError?.("Could not load collections.");
        }
      });
  }, [onError]);

  const samples = activeMembers.map(mapRowToSample);
  const samplePaths = Object.fromEntries(activeMembers.map((row) => [row.id, row.path]));

  return {
    collections,
    activeCollectionId,
    activeMembers: samples,
    samplePaths,
    isCollectionView,
    refresh,
    selectCollection,
    clearCollection,
  };
}
