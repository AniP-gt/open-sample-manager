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
  const { status, note } = draft;
  const sample = entry.sample;
  return <li className="discovery-row">
    <div className="discovery-row-main">
      {rank !== null && <span className="discovery-rank">{rank}</span>}
      <button className="discovery-primary" onClick={onPlay} aria-label={`${playing ? "Stop" : "Preview"} ${sample.file_name}`} disabled={loading}>
        {loading ? "Loading" : playing ? "Stop" : "Preview"}
      </button>
      <div className="discovery-name" draggable onDragStart={onDrag} title={`${sample.file_name}\n${entry.path}\nDrag to another app`}>
        <strong>{sample.file_name}</strong>
        <span>{sample.instrument_type} / {sample.playback_type} / {sample.bpm ?? "—"} BPM / {sample.duration.toFixed(2)}s / {sample.musical_key ?? "Unknown key"}</span>
      </div>
      {rank !== null && <span className="discovery-count">{entry.count ?? 0}</span>}
    </div>
    <div className="discovery-row-actions">
      <button onClick={() => onCompare("a")} aria-label={`Add ${sample.file_name} to comparison A`}>Compare A</button>
      <button onClick={() => onCompare("b")} aria-label={`Add ${sample.file_name} to comparison B`}>Compare B</button>
      <button onClick={onSimilar} aria-label={`Samples similar to ${sample.file_name}`}>Similar samples</button>
      {!projectView && <button onClick={onAdd} disabled={!canAdd || busy}>Add to project</button>}
      {entry.lastUsed !== null && <span className="discovery-muted">Last activity {new Date(entry.lastUsed * 1000).toLocaleDateString("en-US")}</span>}
    </div>
    {projectView && <form className="discovery-toolbar" onSubmit={(e) => { e.preventDefault(); void onSave(status, note); }}>
      <label>Adoption status<select aria-label="Adoption status" value={status} onChange={(e) => onDraftChange({ ...draft, status: e.target.value === "adopted" ? "adopted" : "candidate" })}>
        <option value="candidate">Candidate</option><option value="adopted">Adopted</option>
      </select></label>
      <label className="discovery-note">Notes<input maxLength={4000} value={note} onChange={(e) => onDraftChange({ ...draft, note: e.target.value })} /></label>
      <button type="submit" disabled={busy}>Save</button><button type="button" onClick={onRemove} disabled={busy}>Remove from project</button>
    </form>}
  </li>;
}
