import { translate, instrumentName } from "../../i18n";
import { useTranslation } from "react-i18next";
import type { SmartRules } from "../../types/discovery";

const instruments = ["kick", "snare", "hihat", "bass", "synth", "fx", "vocal", "percussion", "other"];

export function InstrumentSelect({ value, onChange, label = translate("instrument") }: {
  readonly value: string; readonly onChange: (value: string) => void; readonly label?: string;
}) {
  useTranslation();
  return <label>{label}<select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">{translate("all")}</option>{instruments.map((name) => <option key={name} value={name}>{instrumentName(name)}</option>)}
  </select></label>;
}

export function RuleFields({ rules, onChange }: { readonly rules: SmartRules; readonly onChange: (rules: SmartRules) => void }) {
  useTranslation();
  return <div className="discovery-toolbar">
    <InstrumentSelect label={translate("ruleInstrument")} value={rules.instrument ?? ""} onChange={(value) => onChange({ ...rules, instrument: value || null })} />
    <label>{translate("playbackType")}<select aria-label={translate("playbackType")} value={rules.playback_type ?? ""} onChange={(e) => {
      const value = e.target.value;
      onChange({ ...rules, playback_type: value === "loop" || value === "oneshot" ? value : null });
    }}><option value="">{translate("all")}</option><option value="loop">{translate("loopLabel")}</option><option value="oneshot">{translate("oneShotLabel")}</option></select></label>
    <label>{translate("minBpm")}<input type="number" min="0" max="1000" value={rules.bpm_min ?? ""} onChange={(e) => onChange({ ...rules, bpm_min: e.target.value === "" ? null : e.target.valueAsNumber })} /></label>
    <label>{translate("maxBpm")}<input type="number" min="0" max="1000" value={rules.bpm_max ?? ""} onChange={(e) => onChange({ ...rules, bpm_max: e.target.value === "" ? null : e.target.valueAsNumber })} /></label>
    <label className="discovery-check"><input type="checkbox" checked={rules.favorites_only} onChange={(e) => onChange({ ...rules, favorites_only: e.target.checked })} />{translate("favoritesOnly")}</label>
  </div>;
}
