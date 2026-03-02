
import type { Midi } from "../../types/midi";
import type { MidiTagRow } from "../../types/midi";

interface MidiListProps {
  midis: Midi[];
  selectedMidi: Midi | null;
  onMidiSelect: (midi: Midi) => void;
  onTagBadgeClick?: (midi: Midi) => void;
  midiTags?: MidiTagRow[];
  onMidiTagChange?: (midiId: number, tagName: string | null) => void;
  // Pagination handlers
  onLoadMore?: () => Promise<void> | void;
  isLoadingMore?: boolean;
  canLoadMore?: boolean;
}

export function MidiList({ midis, selectedMidi, onMidiSelect, onTagBadgeClick, onLoadMore, isLoadingMore, canLoadMore }: MidiListProps) {
  if (midis.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: "14px",
          fontFamily: "'Courier New', monospace",
        }}
      >
        No MIDI files indexed. Switch to Sample List or scan a directory containing MIDI files.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        background: "#0a0c12",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
          fontFamily: "'Courier New', monospace",
        }}
      >
        <thead
          style={{
            position: "sticky",
            top: 0,
            background: "#1f2937",
            zIndex: 1,
          }}
        >
          <tr>
            <th style={{ padding: "8px 12px", textAlign: "left", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              FILE NAME
            </th>
            <th style={{ padding: "8px 12px", textAlign: "left", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              TAG
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              TEMPO
            </th>
            <th style={{ padding: "8px 12px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              TIME SIG
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              TRACKS
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              NOTES
            </th>
            <th style={{ padding: "8px 12px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              KEY
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              DURATION
            </th>
          </tr>
        </thead>
        <tbody>
          {midis.map((midi) => {
            const isSelected = selectedMidi?.id === midi.id;
            return (
              <tr
                key={midi.id}
                onClick={() => onMidiSelect(midi)}
                style={{
                  background: isSelected ? "#3b82f620" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#1f2937";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <td style={{ padding: "8px 12px", color: "#e2e8f0", borderBottom: "1px solid #1f2937" }}>
                  {midi.file_name}
                </td>
                <td
                  style={{ padding: "8px 8px", borderBottom: "1px solid #1f2937" }}
                  onClick={(e) => { e.stopPropagation(); onTagBadgeClick?.(midi); }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      background: midi.tag_name ? "#22d3ee18" : "transparent",
                      border: `1px solid ${midi.tag_name ? "#22d3ee55" : "#1f2937"}`,
                      borderRadius: "2px",
                      color: midi.tag_name ? "#22d3ee" : "#4b5563",
                      fontSize: "11px",
                      fontFamily: "'Courier New', monospace",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      padding: "3px 8px",
                      cursor: "pointer",
                      minWidth: "64px",
                      textAlign: "center",
                    }}
                  >
                    {midi.tag_name || "+ tag"}
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "#22d3ee", textAlign: "right", borderBottom: "1px solid #1f2937" }}>
                  {midi.tempo ? `${midi.tempo.toFixed(1)} BPM` : "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#9ca3af", textAlign: "center", borderBottom: "1px solid #1f2937" }}>
                  {midi.time_signature_numerator}/{midi.time_signature_denominator}
                </td>
                <td style={{ padding: "8px 12px", color: "#a78bfa", textAlign: "right", borderBottom: "1px solid #1f2937" }}>
                  {midi.track_count ?? "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#34d399", textAlign: "right", borderBottom: "1px solid #1f2937" }}>
                  {midi.note_count ?? "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#fbbf24", textAlign: "center", borderBottom: "1px solid #1f2937" }}>
                  {midi.key_estimate ?? "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#9ca3af", textAlign: "right", borderBottom: "1px solid #1f2937" }}>
                  {midi.duration ? formatDuration(midi.duration) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <LoadMoreControl onLoadMore={onLoadMore} isLoadingMore={isLoadingMore} canLoadMore={canLoadMore} />

    </div>
  );
}

// Render load more control below the table when provided
function LoadMoreControl({ onLoadMore, isLoadingMore, canLoadMore }: { onLoadMore?: () => Promise<void> | void; isLoadingMore?: boolean; canLoadMore?: boolean; }) {
  if (!onLoadMore) return null;
  return (
    <div style={{ padding: "8px 12px", borderTop: "1px solid #111827", display: "flex", justifyContent: "center" }}>
      <button
        type="button"
        onClick={() => { if (onLoadMore) void onLoadMore(); }}
        disabled={isLoadingMore || !canLoadMore}
        style={{
          background: "#3b82f6",
          color: "white",
          border: "none",
          padding: "6px 12px",
          borderRadius: "4px",
          cursor: isLoadingMore || !canLoadMore ? "not-allowed" : "pointer",
          fontFamily: "'Courier New', monospace",
        }}
      >
        {isLoadingMore ? "Loading..." : canLoadMore ? "Load more" : "No more"}
      </button>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
