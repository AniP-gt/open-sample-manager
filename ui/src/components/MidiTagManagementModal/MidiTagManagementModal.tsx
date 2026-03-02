import { useState } from "react";
import type { MidiTagRow } from "../../types/midi";

const DEFAULT_MIDI_TAGS = [
  "melody", "chord", "bass", "arp", "lead", "pad", "drum",
  "transition", "fx", "intro", "outro", "loop", "oneshot",
  "piano", "guitar", "strings", "brass", "synth", "percussion", "vocal", "other",
];

interface MidiTagManagementModalProps {
  isOpen: boolean;
  midiTags: MidiTagRow[];
  onAdd: (name: string) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, name: string) => void;
  onClose: () => void;
}

export function MidiTagManagementModal({
  isOpen,
  midiTags,
  onAdd,
  onDelete,
  onUpdate,
  onClose,
}: MidiTagManagementModalProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  if (!isOpen) return null;

  const isDefaultTag = (name: string) => {
    return DEFAULT_MIDI_TAGS.includes(name.toLowerCase());
  };

  const handleAdd = () => {
    const trimmed = newName.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter a name");
      return;
    }
    if (midiTags.some((t) => t.name === trimmed)) {
      setError("This tag already exists");
      return;
    }
    setError(null);
    onAdd(trimmed);
    setNewName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const startEditing = (id: number, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveEdit = () => {
    if (editingId === null) return;
    const trimmed = editName.trim().toLowerCase();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }
    if (midiTags.some((t) => t.name === trimmed && t.id !== editingId)) {
      setError("This tag already exists");
      return;
    }
    setError(null);
    onUpdate(editingId, trimmed);
    setEditingId(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setError(null);
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
        zIndex: 1001,
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
          maxWidth: "500px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
            MANAGE MIDI TAGS
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

        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="new tag..."
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "#080a0f",
                border: `1px solid ${error ? "#ef4444" : "#1f2937"}`,
                borderRadius: "2px",
                color: "#f1f5f9",
                fontSize: "12px",
                fontFamily: "'Courier New', monospace",
                outline: "none",
              }}
            />
            <button
              onClick={handleAdd}
              style={{
                padding: "10px 16px",
                background: "#22d3ee",
                color: "#080a0f",
                border: "none",
                borderRadius: "2px",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "'Courier New', monospace",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              ADD
            </button>
          </div>
          {error && (
            <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px" }}>
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            border: "1px solid #1f2937",
            borderRadius: "2px",
          }}
        >
          {midiTags.map((tag) => (
            <div
              key={tag.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid #1f2937",
                background: "#080a0f",
              }}
            >
              {editingId === tag.id ? (
                <div style={{ display: "flex", gap: "8px", flex: 1 }}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      background: "#080a0f",
                      border: "1px solid #374151",
                      borderRadius: "2px",
                      color: "#f1f5f9",
                      fontSize: "12px",
                      fontFamily: "'Courier New', monospace",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={saveEdit}
                    style={{
                      padding: "4px 8px",
                      background: "#22d3ee",
                      color: "#080a0f",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    SAVE
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{
                      padding: "4px 8px",
                      background: "transparent",
                      color: "#6b7280",
                      border: "1px solid #374151",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        fontFamily: "'Courier New', monospace",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        color: "#f1f5f9",
                        textTransform: "uppercase",
                      }}
                    >
                      {tag.name}
                    </span>
                    {isDefaultTag(tag.name) && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontFamily: "'Courier New', monospace",
                          background: "#374151",
                          color: "#9ca3af",
                          padding: "2px 4px",
                          borderRadius: "2px",
                        }}
                      >
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => startEditing(tag.id, tag.name)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#6b7280",
                        cursor: "pointer",
                        fontSize: "12px",
                        padding: "4px 8px",
                        transition: "color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#22d3ee")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
                      title="Edit"
                    >
                      ✎
                    </button>
                    {!isDefaultTag(tag.name) && (
                      <button
                        onClick={() => onDelete(tag.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#6b7280",
                          cursor: "pointer",
                          fontSize: "14px",
                          padding: "4px 8px",
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
                        title="Delete"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid #1f2937",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
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
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
