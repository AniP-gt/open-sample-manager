export function MidiListOverlay({ isDragOver }: { isDragOver: boolean }) {
  if (!isDragOver) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(2,6,23,0.65)",
        zIndex: 40,
        pointerEvents: "none",
        transition: "opacity 160ms ease",
      }}
      aria-hidden={!isDragOver}
    >
      <div style={{ textAlign: "center", color: "#f1f5f9", transform: isDragOver ? 'scale(1)' : 'scale(0.98)', transition: 'transform 140ms ease' }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 8 }} aria-hidden>
          <path d="M12 3v10" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 7l4-4 4 4" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="11" width="18" height="10" rx="2" stroke="#f97316" strokeWidth="1.2" />
        </svg>
        <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "0.08em" }}>IMPORT</div>
        <div style={{ color: "#9ca3af", marginTop: 4, fontSize: 13 }}>Drop files or folders to import into the library</div>
      </div>
    </div>
  );
}
