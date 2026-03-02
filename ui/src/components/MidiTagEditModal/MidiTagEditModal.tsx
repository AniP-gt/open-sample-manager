import { useState, useEffect } from "react";
import type { Midi, MidiTagRow } from "../../types/midi";

const DEFAULT_MIDI_TAGS = [
  "melody", "chord", "bass", "arp", "lead", "pad", "drum",
  "transition", "fx", "intro", "outro", "loop", "oneshot",
  "piano", "guitar", "strings", "brass", "synth", "percussion", "vocal", "other",
];

interface MidiTagEditModalProps {
  isOpen: boolean;
  midi: Midi | null;
  midiTags: MidiTagRow[];
  onSave: (midiId: number, tagId: number | null) => void;
  onClose: () => void;
  onManageClick?: () => void;
}

export function MidiTagEditModal({
  isOpen,
  midi,
  midiTags,
  onSave,
  onClose,
  onManageClick,
}: MidiTagEditModalProps) {
  const [customInput, setCustomInput] = useState("");

  // Sync selectedTagId when the modal opens for a different midi
  const currentTagId = midiTags.find((t) => t.name === (midi?.tag_name ?? ""))?.id ?? null;
  const [selectedTagId, setSelectedTagId] = useState<number | null>(currentTagId);
  useEffect(() => {
    if (isOpen) {
      const id = midiTags.find((t) => t.name === (midi?.tag_name ?? ""))?.id ?? null;
      setSelectedTagId(id);
      setCustomInput("");
    }
  }, [isOpen, midi?.id]);
  if (!isOpen || !midi) return null;

  // All tag names available (from DB), merged with defaults for display order
  const existingNames = new Set(midiTags.map((t) => t.name));
  const defaultsInDb = DEFAULT_MIDI_TAGS.filter((n) => existingNames.has(n));
  const userAdded = midiTags.filter((t) => !DEFAULT_MIDI_TAGS.includes(t.name));

  const orderedTags: MidiTagRow[] = [
    ...defaultsInDb.map((n) => midiTags.find((t) => t.name === n)!),
    ...userAdded,
  ];

  const handleTagClick = (tag: MidiTagRow) => {
    // Toggle: clicking selected tag deselects it
    setSelectedTagId((prev) => (prev === tag.id ? null : tag.id));
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applyCustom();
    }
  };

  const applyCustom = () => {
    const trimmed = customInput.trim().toLowerCase();
    if (!trimmed) return;
    const match = midiTags.find((t) => t.name === trimmed);
    if (match) {
      setSelectedTagId(match.id);
    }
    // If not found in DB, still allow saving as free text – but we can only
    // map to an existing tag id. Inform user tag doesn't exist yet.
  };

  const handleSave = () => {
    onSave(midi.id, selectedTagId);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0f1117",
          border: "1px solid #1f2937",
          borderRadius: "4px",
          padding: "24px",
          minWidth: "420px",
          maxWidth: "520px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            paddingBottom: "16px",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#f1f5f9",
              margin: 0,
            }}
          >
            EDIT MIDI TAG
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* File name */}
        <div
          style={{
            fontSize: "14px",
            color: "#9ca3af",
            marginBottom: "20px",
            padding: "12px",
            background: "#080a0f",
            borderRadius: "2px",
            wordBreak: "break-all",
          }}
        >
          {midi.file_name}
        </div>

        {/* Tag grid */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                letterSpacing: "0.1em",
                color: "#9ca3af",
                margin: 0,
              }}
            >
              TAG
            </h3>
            {onManageClick && (
              <button
                onClick={onManageClick}
                style={{
                  background: "#1f2937",
                  border: "1px solid #374151",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: "10px",
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: "0.05em",
                  padding: "4px 8px",
                  borderRadius: "2px",
                }}
              >
                MANAGE
              </button>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
            }}
          >
            {orderedTags.map((tag) => {
              const isSelected = selectedTagId === tag.id;
              return (
                <button
                  key={tag.id}
                  onClick={() => handleTagClick(tag)}
                  style={{
                    fontSize: "12px",
                    fontFamily: "'Courier New', monospace",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    padding: "10px 8px",
                    borderRadius: "2px",
                    cursor: "pointer",
                    background: isSelected ? "#22d3ee20" : "#080a0f",
                    color: isSelected ? "#22d3ee" : "#6b7280",
                    border: `1px solid ${isSelected ? "#22d3ee50" : "#1f2937"}`,
                    transition: "all 0.15s ease",
                    textTransform: "uppercase",
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Free-text input for tag lookup */}
        <div style={{ marginBottom: "28px" }}>
          <h3
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            OR TYPE TAG NAME
          </h3>
          <input
            type="text"
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              // Live selection: if input matches a tag, highlight it
              const match = midiTags.find(
                (t) => t.name === e.target.value.trim().toLowerCase()
              );
              if (match) setSelectedTagId(match.id);
            }}
            onKeyDown={handleCustomKeyDown}
            placeholder="tag name..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              background: "#080a0f",
              border: "1px solid #1f2937",
              borderRadius: "2px",
              color: "#f1f5f9",
              fontSize: "12px",
              fontFamily: "'Courier New', monospace",
              outline: "none",
            }}
          />
          <div style={{ fontSize: "11px", color: "#4b5563", marginTop: "6px" }}>
            Type to highlight an existing tag. To add new tags, use MANAGE.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              fontSize: "12px",
              letterSpacing: "0.1em",
              background: "transparent",
              color: "#6b7280",
              border: "1px solid #1f2937",
              padding: "10px 20px",
              borderRadius: "2px",
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            style={{
              fontSize: "12px",
              letterSpacing: "0.1em",
              background: "#22d3ee",
              color: "#080a0f",
              border: "none",
              padding: "10px 20px",
              borderRadius: "2px",
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
              fontWeight: 700,
            }}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
