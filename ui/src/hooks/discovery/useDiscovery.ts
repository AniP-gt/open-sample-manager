import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Collection } from "../../types/collection";
import type { DiscoverySample, DiscoveryView, ProjectStatus, SmartCollection, SmartRules } from "../../types/discovery";
import { getErrorMessage } from "../../utils/sampleMapper";
import { parseDiscoveryRows, parseSmartCollections } from "./discoveryApi";

function parseProjects(value: unknown): Collection[] {
  if (!Array.isArray(value)) throw new Error("Invalid project response");
  return value.filter((v): v is Collection => typeof v === "object" && v !== null
    && "id" in v && typeof v.id === "number" && "name" in v && typeof v.name === "string"
    && "created_at" in v && typeof v.created_at === "string" && "sample_count" in v && typeof v.sample_count === "number");
}

export function useDiscovery({ view, instrument, favoriteIds }: {
  readonly view: DiscoveryView; readonly instrument: string; readonly favoriteIds: readonly number[];
}) {
  const [rows, setRows] = useState<readonly DiscoverySample[]>([]);
  const [projects, setProjects] = useState<readonly Collection[]>([]);
  const [saved, setSaved] = useState<readonly SmartCollection[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const query = useMemo(() => ({ view, instrument: instrument || null, favorite_ids: favoriteIds }), [view, instrument, favoriteIds]);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    const version = ++request.current;
    setLoading(true); setError(null); setRows([]); setOffset(0);
    void invoke<unknown>("query_discovery", { query: { ...query, offset: 0 } }).then(parseDiscoveryRows).then((result) => {
      if (version !== request.current) return;
      setRows(result); setHasMore(result.length === 100);
    }).catch((e: unknown) => { if (version === request.current) setError(getErrorMessage(e)); })
      .finally(() => { if (version === request.current) setLoading(false); });
    return () => { request.current += 1; };
  }, [query, revision]);

  useEffect(() => {
    let active = true;
    void Promise.all([invoke<unknown>("list_collections").then(parseProjects), invoke<unknown>("list_smart_collections").then(parseSmartCollections)])
      .then(([nextProjects, nextSaved]) => { if (active) { setProjects(nextProjects); setSaved(nextSaved); } })
      .catch((e: unknown) => { if (active) setError(getErrorMessage(e)); });
    return () => { active = false; };
  }, [revision]);

  const loadMore = async () => {
    const version = request.current;
    setLoading(true);
    try {
      const nextOffset = offset + 100;
      const result = parseDiscoveryRows(await invoke<unknown>("query_discovery", { query: { ...query, offset: nextOffset } }));
      if (version === request.current) { setRows((old) => [...old, ...result]); setOffset(nextOffset); setHasMore(result.length === 100); }
    } catch (e: unknown) { if (version === request.current) setError(e instanceof Error ? e.message : getErrorMessage(e)); }
    finally { if (version === request.current) setLoading(false); }
  };

  const mutate = async (operation: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true); setError(null); setMessage("");
    try { await operation(); setMessage(success); refresh(); return true; }
    catch (e: unknown) { setError(e instanceof Error ? e.message : getErrorMessage(e)); return false; }
    finally { setBusy(false); }
  };
  const saveMember = (entry: DiscoverySample, projectId: number, status: ProjectStatus, note: string) => mutate(
    () => invoke("update_project_member", { update: { collection_id: projectId, sample_id: entry.sample.id, status, note, add_only: false } }), "Sample saved.",
  );
  const addMember = (entry: DiscoverySample, projectId: number) => mutate(
    () => invoke("update_project_member", { update: { collection_id: projectId, sample_id: entry.sample.id, status: "candidate", note: "", add_only: true } }), "Sample added. Existing status and notes are preserved.",
  );
  const saveRule = (name: string, rules: SmartRules) => mutate(() => invoke("save_smart_collection", { name, rules }), "Rules saved.");

  return { rows, projects, saved, loading, busy, error, message, hasMore, refresh, loadMore, mutate, saveMember, addMember, saveRule };
}
