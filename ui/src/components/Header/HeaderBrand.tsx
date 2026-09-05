export function HeaderBrand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "3px",
          background: "linear-gradient(135deg, #f97316, #ea580c)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 12px #f9731640",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z" />
        </svg>
      </div>
      <div>
        <div
          style={{
            fontSize: "18px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#f1f5f9",
          }}
        >
          OPEN SAMPLE MANAGER
        </div>
        <div
          style={{
            fontSize: "14px",
            color: "#374151",
            letterSpacing: "0.12em",
          }}
        >
          v0.1.0-alpha · Logic Pro AU · LOCAL
        </div>
      </div>
    </div>
  );
}
