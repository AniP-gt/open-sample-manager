import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import type { DiscoverySample } from "../../types/discovery";
import type { useDiscoveryAudio } from "../../hooks/discovery/useDiscoveryAudio";

export function ComparisonPanel({ a, b, audio, normalized, onNormalizedChange, onClear }: {
  readonly a: DiscoverySample | null; readonly b: DiscoverySample | null;
  readonly audio: ReturnType<typeof useDiscoveryAudio>; readonly normalized: boolean;
  readonly onNormalizedChange: (value: boolean) => void; readonly onClear: (slot: "a" | "b") => void;
}) {
  useTranslation();
  return <section aria-label={translate("aBComparison")} className="discovery-comparison">
    <h2>{translate("aBComparison")}</h2>
    <p>{translate("chooseCompareAAndCompareBInTheList")}</p>
    <label className="discovery-check"><input type="checkbox" checked={normalized} onChange={(e) => { audio.stop(); onNormalizedChange(e.target.checked); }} />{translate("matchLoudness")}</label>
    <p className="discovery-muted">{translate("targets20DbfsRmsWithA1DbfsPeak")}</p>
    <p className="discovery-muted">{translate("perceivedLoudnessMayStillDiffer")}</p>
    <div className="discovery-compare-slots">
      {([{ slot: "a", entry: a }, { slot: "b", entry: b }] as const).map(({ slot, entry }) => <div key={slot}>
        <h3>{slot.toUpperCase()}</h3><p className="discovery-break">{entry?.sample.file_name ?? translate("chooseASample")}</p>
        <div className="discovery-toolbar"><button className="discovery-primary" disabled={!entry || audio.loadingId !== null} onClick={() => { if (entry) void audio.play(entry, normalized, true); }}>{translate("preview")} {slot.toUpperCase()}</button>
          <button disabled={!entry} onClick={() => { audio.stop(); onClear(slot); }}>{translate("remove")}</button></div>
      </div>)}
    </div>
    <div className="discovery-toolbar"><button disabled={audio.playingId === null && audio.loadingId === null} onClick={audio.stop}>{translate("stop")}</button>
      <span role="status">{audio.loadingId !== null ? translate("loadingAudio") : audio.playingId !== null ? translate("playingGain", { gain: audio.gainDb?.toFixed(1) ?? "0" }) : translate("stopped")}</span></div>
  </section>;
}
