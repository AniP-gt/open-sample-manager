import { useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { startSampleDrag } from "../fileDragOut";
import type { DiscoverySample, DiscoveryView, RankingMetric } from "../../types/discovery";
import type { Sample } from "../../types/sample";
import { emptySmartRules } from "../../types/discovery";
import { useFavoritesStore } from "../../store/useFavoritesStore";
import { useDiscovery } from "../../hooks/discovery/useDiscovery";
import { useDiscoveryAudio } from "../../hooks/discovery/useDiscoveryAudio";
import { useProjectDrafts } from "../../hooks/discovery/useProjectDrafts";
import { getErrorMessage } from "../../utils/sampleMapper";
import { InstrumentSelect, RuleFields } from "./DiscoveryFilters";
import { DiscoverySampleRow } from "./DiscoverySampleRow";
import { ComparisonPanel } from "./ComparisonPanel";
import "./discovery.css";

type Tab = "ranking" | "projects" | "smart" | "rediscover" | "similar" | "compare";
const tabs: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "ranking", label: "Most used" }, { id: "projects", label: "Projects" },
  { id: "smart", label: "Smart collections" }, { id: "rediscover", label: "Rediscover" },
  { id: "similar", label: "Similar samples" }, { id: "compare", label: "A/B comparison" },
];

export function DiscoveryWorkspace({ selected, onClose }: { readonly selected: { readonly sample: Sample; readonly path: string } | null; readonly onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("ranking");
  const [metric, setMetric] = useState<RankingMetric>("preview");
  const [days, setDays] = useState<number | null>(30);
  const [instrument, setInstrument] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const drafts = useProjectDrafts(projectId);
  const [projectName, setProjectName] = useState("");
  const [rules, setRules] = useState(emptySmartRules);
  const [ruleName, setRuleName] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [forgotten, setForgotten] = useState(false);
  const [similar, setSimilar] = useState(selected);
  const [a, setA] = useState<DiscoverySample | null>(null);
  const [b, setB] = useState<DiscoverySample | null>(null);
  const [normalized, setNormalized] = useState(true);
  const [dragError, setDragError] = useState<string | null>(null);
  const dragBusy = useRef(false);
  const favoriteIds = useFavoritesStore((state) => state.favorites);
  const view = useMemo((): DiscoveryView => {
    switch (tab) {
      case "ranking": return { mode: "ranking", metric, days };
      case "projects": return { mode: "project", collection_id: projectId ?? -1 };
      case "smart": return { mode: "smart", rules };
      case "rediscover": return forgotten ? { mode: "forgotten", days: 90 } : { mode: "unplayed" };
      case "similar": return similar ? { mode: "similar", sample_id: similar.sample.id } : { mode: "project", collection_id: -1 };
      case "compare": return { mode: "project", collection_id: -1 };
    }
  }, [tab, metric, days, projectId, rules, forgotten, similar]);
  const state = useDiscovery({ view, instrument, favoriteIds });
  const audio = useDiscoveryAudio();
  const selectedEntry: DiscoverySample | null = selected ? { ...selected, count: null, lastUsed: null, status: "candidate", note: "" } : null;
  const targetProject = tab === "projects" ? projectId : projectId ?? state.projects[0]?.id ?? null;

  const drag = async (event: React.DragEvent, entry: DiscoverySample) => {
    event.preventDefault();
    if (dragBusy.current) return;
    dragBusy.current = true; setDragError(null);
    try {
      const icon = await invoke<string>("get_drag_icon_path");
      await startSampleDrag({ sourcePath: entry.path, exportPath: entry.path, icon });
    } catch (e: unknown) { setDragError(e instanceof Error ? e.message : getErrorMessage(e)); }
    finally { dragBusy.current = false; }
  };

  return <main className="discovery" aria-label="Explore samples">
    <header className="discovery-heading"><h1>Explore samples</h1><button onClick={onClose}>Back to library</button></header>
    <nav className="discovery-tabs" aria-label="Sample discovery navigation">{tabs.map((item) => <button key={item.id} aria-pressed={tab === item.id} onClick={() => { audio.stop(); setInstrument(""); setTab(item.id); }}>{item.label}</button>)}</nav>
    <div className="discovery-body">
      {tab === "ranking" && <section aria-label="Ranking filters">
        <div className="discovery-toolbar"><label>Metric<select aria-label="Metric" value={metric} onChange={(e) => { const v = e.target.value; if (v === "preview" || v === "export" || v === "adopted") setMetric(v); }}>
          <option value="preview">Previews</option><option value="export">Exports</option><option value="adopted">Adopted projects</option>
        </select></label><label>Period<select aria-label="Period" value={days ?? "all"} onChange={(e) => setDays(e.target.value === "all" ? null : Number(e.target.value))}>
          <option value="30">Last 30 days</option><option value="all">All time</option></select></label>
          <InstrumentSelect value={instrument} onChange={setInstrument} /><button onClick={state.refresh} disabled={state.loading}>Refresh</button>
        </div>
        <p className="discovery-muted">Usage is tracked from this version onward. Repeated actions on the same sample within 5 seconds count once. Exports count completed drops; adoption counts projects where the sample is currently adopted.</p>
      </section>}
      {tab === "projects" && <section aria-label="Project management">
        <form className="discovery-toolbar" onSubmit={(e) => { e.preventDefault(); void state.mutate(async () => { const id = await invoke<unknown>("create_project_shelf", { name: projectName }); if (typeof id !== "number") throw new Error("Invalid project ID"); setProjectId(id); setProjectName(""); }, "Project created."); }}>
          <label>New project<input value={projectName} maxLength={120} required onChange={(e) => setProjectName(e.target.value)} /></label><button disabled={state.busy}>Create</button>
        </form><p className="discovery-muted">Existing collections can also serve as project shelves.</p>
      </section>}
      {tab !== "compare" && <div className="discovery-toolbar">
        <label>{tab === "projects" ? "Project" : "Add to project"}<select aria-label={tab === "projects" ? "Project" : "Add to project"} value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value === "" ? null : Number(e.target.value))}>
          <option value="">{tab === "projects" ? "Select a project" : state.projects[0]?.name ?? "Create a project first"}</option>
          {state.projects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.sample_count})</option>)}
        </select></label>
        {selectedEntry && <button disabled={targetProject === null || state.busy} onClick={() => { if (targetProject !== null) void state.addMember(selectedEntry, targetProject); }}>Add library selection</button>}
      </div>}
      {tab === "smart" && <section aria-label="Smart collection settings">
        <div className="discovery-toolbar"><label>Saved rules<select aria-label="Saved rules" value={savedId ?? ""} onChange={(e) => { const saved = state.saved.find((item) => item.id === Number(e.target.value)); setSavedId(saved?.id ?? null); if (saved) { setRules(saved.rules); setRuleName(saved.name); } }}>
          <option value="">New rules</option>{state.saved.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button disabled={savedId === null || state.busy} onClick={() => { if (savedId !== null) void state.mutate(() => invoke("delete_smart_collection", { id: savedId }), "Saved rules deleted.").then((ok) => { if (ok) { setSavedId(null); setRuleName(""); } }); }}>Delete rules</button>
        </div>
        <RuleFields rules={rules} onChange={setRules} />
        <form className="discovery-toolbar" onSubmit={(e) => { e.preventDefault(); void state.saveRule(ruleName, rules); }}>
          <label>Rule name<input required maxLength={120} value={ruleName} onChange={(e) => setRuleName(e.target.value)} /></label><button disabled={state.busy}>Save rules</button>
        </form><p className="discovery-muted">Searches the entire library and reflects changes to samples and favorites.</p><p className="discovery-muted">Saving with the same name updates the existing rules.</p>
      </section>}
      {tab === "rediscover" && <section aria-label="Rediscovery filters"><label>Find samples<select aria-label="Find samples" value={forgotten ? "forgotten" : "unplayed"} onChange={(e) => setForgotten(e.target.value === "forgotten")}>
        <option value="unplayed">Unplayed since tracking began</option><option value="forgotten">Favorites inactive for 90+ days</option></select></label>
        <p className="discovery-muted">Favorites without recorded activity are included. Usage outside this app is not tracked.</p></section>}
      {tab === "similar" && <section aria-label="Similarity settings"><h2>Similar samples</h2><p className="discovery-break">Reference: {similar?.sample.file_name ?? "Select a sample in the library or choose Similar samples in the list."}</p>
        {selected && <button onClick={() => setSimilar(selected)}>Use library selection as reference</button>}
        <p className="discovery-muted">Ranks samples of the same instrument and playback type by BPM, duration, low-frequency ratio, and key. Similarity does not guarantee a matching timbre.</p></section>}
      {tab === "compare" ? <ComparisonPanel a={a} b={b} audio={audio} normalized={normalized} onNormalizedChange={setNormalized} onClear={(slot) => { if (slot === "a") setA(null); else setB(null); }} /> : <>
        <div className="discovery-results-heading"><h2>{tabs.find((item) => item.id === tab)?.label}</h2><span>{state.rows.length}{state.hasMore ? "+" : ""} {state.rows.length === 1 ? "sample" : "samples"}</span>
          {(a || b) && <button onClick={() => { audio.stop(); setTab("compare"); }}>Open A/B comparison</button>}</div>
        {state.loading && <p role="status">Loading samples…</p>}
        {!state.loading && !state.error && state.rows.length === 0 && <p>No matching samples. Adjust the filters or preview samples in the library.</p>}
        <ol className="discovery-results">{state.rows.map((entry, index) => <DiscoverySampleRow key={entry.sample.id} entry={entry} draft={drafts.getDraft(entry)} onDraftChange={(draft) => drafts.updateDraft(entry, draft)} rank={tab === "ranking" ? index + 1 : null} playing={audio.playingId === entry.sample.id} loading={audio.loadingId === entry.sample.id} busy={state.busy} projectView={tab === "projects"} canAdd={targetProject !== null}
          onPlay={() => { if (audio.playingId === entry.sample.id) audio.stop(); else void audio.play(entry, false); }}
          onDrag={(event) => { void drag(event, entry); }}
          onCompare={(slot) => { audio.stop(); if (slot === "a") setA(entry); else setB(entry); }}
          onSimilar={() => { audio.stop(); setInstrument(""); setSimilar({ sample: entry.sample, path: entry.path }); setTab("similar"); }}
          onAdd={() => { if (targetProject !== null) void state.addMember(entry, targetProject); }}
          onSave={(status, note) => projectId !== null ? state.saveMember(entry, projectId, status, note) : Promise.resolve(false)}
          onRemove={() => { if (projectId !== null) void state.mutate(() => invoke("remove_project_member", { collectionId: projectId, sampleId: entry.sample.id }), "Sample removed from project.").then((ok) => { if (ok) drafts.clearDraft(entry); }); }}
        />)}</ol>
        {state.hasMore && <button disabled={state.loading} onClick={() => { void state.loadMore(); }}>Load 100 more</button>}
      </>}
      {state.message && <p role="status">{state.message}</p>}
      {(state.error || audio.error || dragError) && <div role="alert"><p>{state.error ?? audio.error ?? dragError}</p><button onClick={state.refresh}>Retry</button></div>}
    </div>
  </main>;
}
