import type { SmartRules } from "../../types/discovery";

const instruments = ["kick", "snare", "hihat", "bass", "synth", "fx", "vocal", "percussion", "other"];

export function InstrumentSelect({ value, onChange, label = "Instrument" }: {
  readonly value: string; readonly onChange: (value: string) => void; readonly label?: string;
}) {
  return <label>{label}<select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">All</option>{instruments.map((name) => <option key={name}>{name}</option>)}
  </select></label>;
}

export function RuleFields({ rules, onChange }: { readonly rules: SmartRules; readonly onChange: (rules: SmartRules) => void }) {
  return <div className="discovery-toolbar">
    <InstrumentSelect label="Rule instrument" value={rules.instrument ?? ""} onChange={(value) => onChange({ ...rules, instrument: value || null })} />
    <label>Playback type<select aria-label="Playback type" value={rules.playback_type ?? ""} onChange={(e) => {
      const value = e.target.value;
      onChange({ ...rules, playback_type: value === "loop" || value === "oneshot" ? value : null });
    }}><option value="">All</option><option value="loop">Loop</option><option value="oneshot">One-shot</option></select></label>
    <label>Min BPM<input type="number" min="0" max="1000" value={rules.bpm_min ?? ""} onChange={(e) => onChange({ ...rules, bpm_min: e.target.value === "" ? null : e.target.valueAsNumber })} /></label>
    <label>Max BPM<input type="number" min="0" max="1000" value={rules.bpm_max ?? ""} onChange={(e) => onChange({ ...rules, bpm_max: e.target.value === "" ? null : e.target.valueAsNumber })} /></label>
    <label className="discovery-check"><input type="checkbox" checked={rules.favorites_only} onChange={(e) => onChange({ ...rules, favorites_only: e.target.checked })} />Favorites only</label>
  </div>;
}
