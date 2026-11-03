import { formatDate } from "../../i18n/formatters";
import { translate, instrumentName, translateLabel } from "../../i18n";
import { useTranslation } from "react-i18next";
import type { DiscoverySample, ProjectDraft, ProjectStatus } from "../../types/discovery";

type DiscoverySampleRowProps = {
  readonly entry: DiscoverySample;
  readonly draft: ProjectDraft;
  readonly onDraftChange: (draft: ProjectDraft) => void;
  readonly rank: number | null;
  readonly playing: boolean;
  readonly loading: boolean;
  readonly projectView: boolean;
  readonly busy: boolean;
  readonly canAdd: boolean;
  readonly onPlay: () => void;
  readonly onDrag: (event: React.DragEvent) => void;
  readonly onCompare: (slot: "a" | "b") => void;
  readonly onSimilar: () => void;
  readonly onAdd: () => void;
  readonly onSave: (status: ProjectStatus, note: string) => Promise<boolean>;
  readonly onRemove: () => void;
};

export function DiscoverySampleRow({ entry, draft, onDraftChange, rank, playing, loading, projectView, busy, canAdd, onPlay, onDrag, onCompare, onSimilar, onAdd, onSave, onRemove }: DiscoverySampleRowProps) {
  useTranslation();
  const { status, note } = draft;
  const sample = entry.sample;
  return <li className="discovery-row">
    <div className="discovery-row-main">
      {rank !== null && <span className="discovery-rank">{rank}</span>}
      <button className="discovery-primary" onClick={onPlay} aria-label={translate("samplePlaybackAction", { action: playing ? translate("stop") : translate("preview"), name: sample.file_name })} disabled={loading}>
        {loading ? translate("loadingLabel") : playing ? translate("stop") : translate("preview")}
      </button>
      <div className="discovery-name" draggable onDragStart={onDrag} title={translate("dragSampleTooltip", { name: sample.file_name, path: entry.path })}>
        <strong>{sample.file_name}</strong>
        <span>{instrumentName(sample.instrument_type)} / {translateLabel(sample.playback_type === "oneshot" ? "one-shot" : sample.playback_type)} / {sample.bpm ?? "—"} BPM / {sample.duration.toFixed(2)}s / {sample.musical_key ?? translate("unknownKey")}</span>
      </div>
      {rank !== null && <span className="discovery-count">{entry.count ?? 0}</span>}
    </div>
    <div className="discovery-row-actions">
      <button onClick={() => onCompare("a")} aria-label={translate("addComparisonA", { name: sample.file_name })}>{translate("compareA")}</button>
      <button onClick={() => onCompare("b")} aria-label={translate("addComparisonB", { name: sample.file_name })}>{translate("compareB")}</button>
      <button onClick={onSimilar} aria-label={translate("samplesSimilarTo", { name: sample.file_name })}>{translate("similarSamples")}</button>
      {!projectView && <button onClick={onAdd} disabled={!canAdd || busy}>{translate("addToProject")}</button>}
      {entry.lastUsed !== null && <span className="discovery-muted">{translate("lastActivity")} {formatDate(new Date(entry.lastUsed * 1000))}</span>}
    </div>
    {projectView && <form className="discovery-toolbar" onSubmit={(e) => { e.preventDefault(); void onSave(status, note); }}>
      <label>{translate("adoptionStatus")}<select aria-label={translate("adoptionStatus")} value={status} onChange={(e) => onDraftChange({ ...draft, status: e.target.value === "adopted" ? "adopted" : "candidate" })}>
        <option value="candidate">{translate("candidate")}</option><option value="adopted">{translate("adopted")}</option>
      </select></label>
      <label className="discovery-note">{translate("notes")}<input maxLength={4000} value={note} onChange={(e) => onDraftChange({ ...draft, note: e.target.value })} /></label>
      <button type="submit" disabled={busy}>{translate("save")}</button><button type="button" onClick={onRemove} disabled={busy}>{translate("removeFromProject")}</button>
    </form>}
  </li>;
}
