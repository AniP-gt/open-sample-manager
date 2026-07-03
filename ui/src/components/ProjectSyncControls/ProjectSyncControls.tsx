const keyOptions = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface ProjectSyncControlsProps {
  projectBpm: string;
  projectKey: string;
  tempoSync: boolean;
  keySync: boolean;
  onProjectBpmChange: (value: string) => void;
  onProjectKeyChange: (value: string) => void;
  onTempoSyncChange: (value: boolean) => void;
  onKeySyncChange: (value: boolean) => void;
}

export function ProjectSyncControls({
  projectBpm,
  projectKey,
  tempoSync,
  keySync,
  onProjectBpmChange,
  onProjectKeyChange,
  onTempoSyncChange,
  onKeySyncChange,
}: ProjectSyncControlsProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 8px",
        border: "1px solid #1f2937",
        borderRadius: "3px",
        background: "#0d1019",
        boxShadow: "inset 0 0 0 1px #0f172a",
      }}
      aria-label="Project preview sync controls"
    >
      <span style={{ fontSize: "11px", color: "#64748b", letterSpacing: "0.12em" }}>PROJECT</span>
      <input
        aria-label="Project BPM"
        type="number"
        min="1"
        value={projectBpm}
        onChange={(event) => onProjectBpmChange(event.target.value)}
        style={{
          width: "58px",
          background: "#080a0f",
          border: "1px solid #1f2937",
          color: "#22d3ee",
          borderRadius: "2px",
          padding: "4px 6px",
          fontFamily: "'Courier New', monospace",
          fontSize: "12px",
        }}
      />
      <span style={{ fontSize: "11px", color: "#475569" }}>BPM</span>
      <select
        aria-label="Project Key"
        value={projectKey}
        onChange={(event) => onProjectKeyChange(event.target.value)}
        style={{
          background: "#080a0f",
          border: "1px solid #1f2937",
          color: "#a78bfa",
          borderRadius: "2px",
          padding: "4px 6px",
          fontFamily: "'Courier New', monospace",
          fontSize: "12px",
        }}
      >
        {keyOptions.map((key) => (
          <option key={key} value={key}>{key}</option>
        ))}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: tempoSync ? "#22d3ee" : "#64748b" }}>
        <input type="checkbox" checked={tempoSync} onChange={(event) => onTempoSyncChange(event.target.checked)} />
        TEMPO
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: keySync ? "#a78bfa" : "#64748b" }}>
        <input type="checkbox" checked={keySync} onChange={(event) => onKeySyncChange(event.target.checked)} />
        KEY
      </label>
    </div>
  );
}
