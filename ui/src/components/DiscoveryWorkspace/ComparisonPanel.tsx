import type { DiscoverySample } from "../../types/discovery";
import type { useDiscoveryAudio } from "../../hooks/discovery/useDiscoveryAudio";

export function ComparisonPanel({ a, b, audio, normalized, onNormalizedChange, onClear }: {
  readonly a: DiscoverySample | null; readonly b: DiscoverySample | null;
  readonly audio: ReturnType<typeof useDiscoveryAudio>; readonly normalized: boolean;
  readonly onNormalizedChange: (value: boolean) => void; readonly onClear: (slot: "a" | "b") => void;
}) {
  return <section aria-label="A/B comparison" className="discovery-comparison">
    <h2>A/B comparison</h2>
    <p>Choose Compare A and Compare B in the list. Switching samples starts playback from the same position.</p>
    <label className="discovery-check"><input type="checkbox" checked={normalized} onChange={(e) => { audio.stop(); onNormalizedChange(e.target.checked); }} />Match loudness</label>
    <p className="discovery-muted">Targets −20 dBFS RMS with a −1 dBFS peak ceiling.</p>
    <p className="discovery-muted">Perceived loudness may still differ.</p>
    <div className="discovery-compare-slots">
      {([{ slot: "a", entry: a }, { slot: "b", entry: b }] as const).map(({ slot, entry }) => <div key={slot}>
        <h3>{slot.toUpperCase()}</h3><p className="discovery-break">{entry?.sample.file_name ?? "Choose a sample"}</p>
        <div className="discovery-toolbar"><button className="discovery-primary" disabled={!entry || audio.loadingId !== null} onClick={() => { if (entry) void audio.play(entry, normalized, true); }}>Preview {slot.toUpperCase()}</button>
          <button disabled={!entry} onClick={() => { audio.stop(); onClear(slot); }}>Remove</button></div>
      </div>)}
    </div>
    <div className="discovery-toolbar"><button disabled={audio.playingId === null && audio.loadingId === null} onClick={audio.stop}>Stop</button>
      <span role="status">{audio.loadingId !== null ? "Loading audio…" : audio.playingId !== null ? `Playing · Gain ${audio.gainDb?.toFixed(1) ?? "0"} dB` : "Stopped"}</span></div>
  </section>;
}
