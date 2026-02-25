import React from "react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  danger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel, danger }) => {
  const [loading, setLoading] = React.useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setLoading(true);
      // Support both sync and async onConfirm handlers
      await Promise.resolve(onConfirm());
    } finally {
      setLoading(false);
    }
  };

  const confirmButtonStyle = danger
    ? { background: "#b91c1c", border: "none", color: "white", padding: "6px 12px", cursor: loading ? "default" : "pointer", borderRadius: "3px", opacity: loading ? 0.7 : 1 }
    : { background: "#ef4444", border: "none", color: "white", padding: "6px 12px", cursor: loading ? "default" : "pointer", borderRadius: "3px", opacity: loading ? 0.7 : 1 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
      }}
    >
      <div style={{ background: "#0b1220", padding: "20px", borderRadius: "6px", width: "420px", color: "#e5e7eb", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
        {title && <div style={{ fontSize: "18px", marginBottom: "8px", color: danger ? "#fecaca" : "#f97316" }}>{title}</div>}
        <div style={{ marginBottom: "16px", color: "#d1d5db" }}>{message}</div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{ background: "transparent", border: "1px solid #374151", color: "#cbd5e1", padding: "6px 12px", cursor: loading ? "default" : "pointer", borderRadius: "3px", opacity: loading ? 0.6 : 1 }}
          >
            No
          </button>

          <button
            onClick={handleConfirm}
            disabled={loading}
            style={confirmButtonStyle}
          >
            {loading ? "Working..." : "Yes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
