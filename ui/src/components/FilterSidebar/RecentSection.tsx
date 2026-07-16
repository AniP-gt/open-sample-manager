import type { Sample } from "../../types/sample";

interface RecentSectionProps {
  recentIds: number[];
  sampleById: Map<number, Sample>;
  onSampleSelect?: (sample: Sample) => void;
}

export function RecentSection({ recentIds, sampleById, onSampleSelect }: RecentSectionProps) {
  if (recentIds.length === 0) return null;

  return (
    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #0f1117" }}>
      <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em", padding: "0 12px 8px" }}>RECENT</div>
      {recentIds.map((id) => {
        const sample = sampleById.get(id);
        if (!sample) {
          return <div key={id} style={{ padding: "4px 12px", fontSize: "12px", color: "#374151", fontFamily: "'Courier New', monospace" }}>#{id}</div>;
        }
        return (
          <div
            key={id}
            onClick={() => onSampleSelect?.(sample)}
            title={sample.file_name}
            style={{ padding: "4px 12px", fontSize: "12px", color: "#9ca3af", fontFamily: "'Courier New', monospace", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f97316")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
          >
            ♪ {sample.file_name}
          </div>
        );
      })}
    </div>
  );
}
