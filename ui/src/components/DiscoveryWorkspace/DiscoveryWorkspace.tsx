import { useMessageState } from "../../i18n/useMessageState";
import { translate, translateLabel } from "../../i18n";
import { useTranslation } from "react-i18next";
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
  useTranslation();
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
  const [dragError, setDragError] = useMessageState();
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

  return <main className="discovery" aria-label={translate("exploreSamples")}>
    <header className="discovery-heading"><h1>{translate("exploreSamples")}</h1><button onClick={onClose}>{translate("backToLibrary")}</button></header>
    <nav className="discovery-tabs" aria-label={translate("sampleDiscoveryNavigation")}>{tabs.map((item) => <button key={item.id} aria-pressed={tab === item.id} onClick={() => { audio.stop(); setInstrument(""); setTab(item.id); }}>{translateLabel(item.label)}</button>)}</nav>
    <div className="discovery-body">
      {tab === "ranking" && <section aria-label={translate("rankingFilters")}>
        <div className="discovery-toolbar"><label>{translate("metric")}<select aria-label={translate("metric")} value={metric} onChange={(e) => { const v = e.target.value; if (v === "preview" || v === "export" || v === "adopted") setMetric(v); }}>
          <option value="preview">{translate("previews")}</option><option value="export">{translate("exports")}</option><option value="adopted">{translate("adoptedProjects")}</option>
        </select></label><label>{translate("period")}<select aria-label={translate("period")} value={days ?? "all"} onChange={(e) => setDays(e.target.value === "all" ? null : Number(e.target.value))}>
          <option value="30">{translate("last30Days")}</option><option value="all">{translate("allTime")}</option></select></label>
          <InstrumentSelect value={instrument} onChange={setInstrument} /><button onClick={state.refresh} disabled={state.loading}>{translate("refresh")}</button>
        </div>
        <p className="discovery-muted">{translate("usageIsTrackedFromThisVersionOnwardRepeatedActions")}</p>
      </section>}
      {tab === "projects" && <section aria-label={translate("projectManagement")}>
        <form className="discovery-toolbar" onSubmit={(e) => { e.preventDefault(); void state.mutate(async () => { const id = await invoke<unknown>("create_project_shelf", { name: projectName }); if (typeof id !== "number") throw new Error("Invalid project ID"); setProjectId(id); setProjectName(""); }, "Project created."); }}>
          <label>{translate("newProject")}<input value={projectName} maxLength={120} required onChange={(e) => setProjectName(e.target.value)} /></label><button disabled={state.busy}>{translate("create")}</button>
        </form><p className="discovery-muted">{translate("existingCollectionsCanAlsoServeAsProjectShelves")}</p>
      </section>}
      {tab !== "compare" && <div className="discovery-toolbar">
        <label>{tab === "projects" ? translate("project") : translate("addToProject")}<select aria-label={tab === "projects" ? translate("project") : translate("addToProject")} value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value === "" ? null : Number(e.target.value))}>
          <option value="">{tab === "projects" ? translate("selectAProject") : state.projects[0]?.name ?? translate("createAProjectFirst")}</option>
          {state.projects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.sample_count})</option>)}
        </select></label>
        {selectedEntry && <button disabled={targetProject === null || state.busy} onClick={() => { if (targetProject !== null) void state.addMember(selectedEntry, targetProject); }}>{translate("addLibrarySelection")}</button>}
      </div>}
      {tab === "smart" && <section aria-label={translate("smartCollectionSettings")}>
        <div className="discovery-toolbar"><label>{translate("savedRules")}<select aria-label={translate("savedRules")} value={savedId ?? ""} onChange={(e) => { const saved = state.saved.find((item) => item.id === Number(e.target.value)); setSavedId(saved?.id ?? null); if (saved) { setRules(saved.rules); setRuleName(saved.name); } }}>
          <option value="">{translate("newRules")}</option>{state.saved.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button disabled={savedId === null || state.busy} onClick={() => { if (savedId !== null) void state.mutate(() => invoke("delete_smart_collection", { id: savedId }), "Saved rules deleted.").then((ok) => { if (ok) { setSavedId(null); setRuleName(""); } }); }}>{translate("deleteRules")}</button>
        </div>
        <RuleFields rules={rules} onChange={setRules} />
        <form className="discovery-toolbar" onSubmit={(e) => { e.preventDefault(); void state.saveRule(ruleName, rules); }}>
          <label>{translate("ruleName")}<input required maxLength={120} value={ruleName} onChange={(e) => setRuleName(e.target.value)} /></label><button disabled={state.busy}>{translate("saveRules")}</button>
        </form><p className="discovery-muted">{translate("searchesTheEntireLibraryAndReflectsChangesToSamples")}</p><p className="discovery-muted">{translate("savingWithTheSameNameUpdatesTheExistingRules")}</p>
      </section>}
      {tab === "rediscover" && <section aria-label={translate("rediscoveryFilters")}><label>{translate("findSamples")}<select aria-label={translate("findSamples")} value={forgotten ? "forgotten" : "unplayed"} onChange={(e) => setForgotten(e.target.value === "forgotten")}>
        <option value="unplayed">{translate("unplayedSinceTrackingBegan")}</option><option value="forgotten">{translate("favoritesInactiveFor90Days")}</option></select></label>
        <p className="discovery-muted">{translate("favoritesWithoutRecordedActivityAreIncludedUsageOutsideThis")}</p></section>}
      {tab === "similar" && <section aria-label={translate("similaritySettings")}><h2>{translate("similarSamples")}</h2><p className="discovery-break">{translate("reference")} {similar?.sample.file_name ?? translate("selectASampleInTheLibraryOrChooseSimilar")}</p>
        {selected && <button onClick={() => setSimilar(selected)}>{translate("useLibrarySelectionAsReference")}</button>}
        <p className="discovery-muted">{translate("ranksSamplesOfTheSameInstrumentAndPlaybackType")}</p></section>}
      {tab === "compare" ? <ComparisonPanel a={a} b={b} audio={audio} normalized={normalized} onNormalizedChange={setNormalized} onClear={(slot) => { if (slot === "a") setA(null); else setB(null); }} /> : <>
        <div className="discovery-results-heading"><h2>{translateLabel(tabs.find((item) => item.id === tab)?.label ?? "")}</h2><span>{translate("sampleCount", { count: state.rows.length })}{state.hasMore ? "+" : ""}</span>
          {(a || b) && <button onClick={() => { audio.stop(); setTab("compare"); }}>{translate("openABComparison")}</button>}</div>
        {state.loading && <p role="status">{translate("loadingSamples")}</p>}
        {!state.loading && !state.error && state.rows.length === 0 && <p>{translate("noMatchingSamplesAdjustTheFiltersOrPreviewSamples")}</p>}
        <ol className="discovery-results">{state.rows.map((entry, index) => <DiscoverySampleRow key={entry.sample.id} entry={entry} draft={drafts.getDraft(entry)} onDraftChange={(draft) => drafts.updateDraft(entry, draft)} rank={tab === "ranking" ? index + 1 : null} playing={audio.playingId === entry.sample.id} loading={audio.loadingId === entry.sample.id} busy={state.busy} projectView={tab === "projects"} canAdd={targetProject !== null}
          onPlay={() => { if (audio.playingId === entry.sample.id) audio.stop(); else void audio.play(entry, false); }}
          onDrag={(event) => { void drag(event, entry); }}
          onCompare={(slot) => { audio.stop(); if (slot === "a") setA(entry); else setB(entry); }}
          onSimilar={() => { audio.stop(); setInstrument(""); setSimilar({ sample: entry.sample, path: entry.path }); setTab("similar"); }}
          onAdd={() => { if (targetProject !== null) void state.addMember(entry, targetProject); }}
          onSave={(status, note) => projectId !== null ? state.saveMember(entry, projectId, status, note) : Promise.resolve(false)}
          onRemove={() => { if (projectId !== null) void state.mutate(() => invoke("remove_project_member", { collectionId: projectId, sampleId: entry.sample.id }), "Sample removed from project.").then((ok) => { if (ok) drafts.clearDraft(entry); }); }}
        />)}</ol>
        {state.hasMore && <button disabled={state.loading} onClick={() => { void state.loadMore(); }}>{translate("load100More")}</button>}
      </>}
      {state.message && <p role="status">{state.message}</p>}
      {(state.error || audio.error || dragError) && <div role="alert"><p>{state.error ?? audio.error ?? dragError}</p><button onClick={state.refresh}>{translate("retry")}</button></div>}
    </div>
  </main>;
}
