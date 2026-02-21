import { useState, useEffect, useRef } from "react";

const MOCK_SAMPLES = [
  { id: 1, file_name: "Kick_Deep_909.wav", duration: 0.42, bpm: null, periodicity: 0.08, low_ratio: 0.81, attack_slope: 2.41, decay_time: 320, sample_type: "kick", tags: ["808", "deep", "punchy"] },
  { id: 2, file_name: "Drum_Loop_128bpm.wav", duration: 3.75, bpm: 128.0, periodicity: 0.72, low_ratio: 0.34, attack_slope: 0.91, decay_time: null, sample_type: "loop", tags: ["hip-hop", "groove"] },
  { id: 3, file_name: "Snare_Crisp_14.wav", duration: 0.31, bpm: null, periodicity: 0.05, low_ratio: 0.12, attack_slope: 3.22, decay_time: 180, sample_type: "one-shot", tags: ["snare", "crisp"] },
  { id: 4, file_name: "Kick_Punchy_Transient.wav", duration: 0.55, bpm: null, periodicity: 0.09, low_ratio: 0.76, attack_slope: 2.88, decay_time: 290, sample_type: "kick", tags: ["punchy", "transient"] },
  { id: 5, file_name: "Arp_Loop_140bpm_Am.wav", duration: 6.86, bpm: 140.0, periodicity: 0.85, low_ratio: 0.09, attack_slope: 0.44, decay_time: null, sample_type: "loop", tags: ["melodic", "Am"] },
  { id: 6, file_name: "HiHat_Closed_TR.wav", duration: 0.18, bpm: null, periodicity: 0.03, low_ratio: 0.04, attack_slope: 4.11, decay_time: 90, sample_type: "one-shot", tags: ["hihat", "TR"] },
  { id: 7, file_name: "Bass_Loop_90bpm.wav", duration: 5.33, bpm: 90.0, periodicity: 0.68, low_ratio: 0.61, attack_slope: 0.72, decay_time: null, sample_type: "loop", tags: ["bass", "deep"] },
  { id: 8, file_name: "Kick_SubBoom_808.wav", duration: 0.88, bpm: null, periodicity: 0.11, low_ratio: 0.89, attack_slope: 1.97, decay_time: 510, sample_type: "kick", tags: ["808", "sub"] },
  { id: 9, file_name: "Clap_Room_Reverb.wav", duration: 0.62, bpm: null, periodicity: 0.06, low_ratio: 0.08, attack_slope: 2.73, decay_time: 450, sample_type: "one-shot", tags: ["clap", "room"] },
  { id: 10, file_name: "Synth_Loop_174bpm_Dm.wav", duration: 2.76, bpm: 174.0, periodicity: 0.91, low_ratio: 0.11, attack_slope: 0.38, decay_time: null, sample_type: "loop", tags: ["synth", "Dm", "dnb"] },
  { id: 11, file_name: "Perc_Shaker_Tight.wav", duration: 0.22, bpm: null, periodicity: 0.04, low_ratio: 0.06, attack_slope: 3.55, decay_time: 110, sample_type: "one-shot", tags: ["perc", "shaker"] },
  { id: 12, file_name: "Kick_Vinyl_Dusty.wav", duration: 0.38, bpm: null, periodicity: 0.07, low_ratio: 0.73, attack_slope: 2.15, decay_time: 260, sample_type: "kick", tags: ["vinyl", "lo-fi"] },
];

const WaveformDisplay = ({ sample, isPlaying }) => {
  const bars = 64;
  const waveData = useRef(
    Array.from({ length: bars }, (_, i) => {
      const x = i / bars;
      const base = sample.sample_type === "kick"
        ? Math.exp(-x * 6) * (0.7 + Math.random() * 0.3)
        : sample.sample_type === "loop"
        ? 0.3 + Math.sin(x * Math.PI * 8) * 0.25 + Math.random() * 0.2
        : Math.exp(-x * 3) * (0.5 + Math.random() * 0.4);
      return Math.max(0.04, base);
    })
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1px", height: "48px", width: "100%" }}>
      {waveData.current.map((h, i) => {
        const progress = isPlaying ? (Date.now() / 1000) % 1 : 0;
        const isPast = isPlaying && i / bars < (Date.now() / 2000) % 1;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h * 100}%`,
              background: isPast
                ? "#f97316"
                : sample.sample_type === "kick"
                ? "#f97316aa"
                : sample.sample_type === "loop"
                ? "#22d3eeaa"
                : "#a78bfaaa",
              borderRadius: "1px",
              transition: "background 0.1s",
            }}
          />
        );
      })}
    </div>
  );
};

const TypeBadge = ({ type }) => {
  const styles = {
    kick: { bg: "#f9731620", color: "#f97316", border: "#f9731650" },
    loop: { bg: "#22d3ee20", color: "#22d3ee", border: "#22d3ee50" },
    "one-shot": { bg: "#a78bfa20", color: "#a78bfa", border: "#a78bfa50" },
  };
  const s = styles[type] || styles["one-shot"];
  return (
    <span style={{
      fontSize: "9px",
      fontFamily: "'Courier New', monospace",
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      padding: "2px 6px",
      borderRadius: "2px",
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {type}
    </span>
  );
};

const AnalysisBar = ({ label, value, max, color }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "9px", color: "#6b7280", fontFamily: "'Courier New', monospace", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: "9px", color: color, fontFamily: "'Courier New', monospace" }}>{typeof value === "number" ? value.toFixed(2) : "—"}</span>
    </div>
    <div style={{ height: "3px", background: "#1f2937", borderRadius: "2px" }}>
      <div style={{
        height: "100%",
        width: `${Math.min(100, (value / max) * 100)}%`,
        background: color,
        borderRadius: "2px",
        transition: "width 0.3s ease",
      }} />
    </div>
  </div>
);

const ScannerOverlay = ({ onDone }) => {
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("Initializing scanner...");
  const files = [
    "Scanning /Samples/Drums/Kicks...",
    "Analyzing spectral content: Kick_Deep_909.wav",
    "Computing FFT autocorrelation...",
    "Detecting onset envelopes...",
    "Classifying: loop vs one-shot...",
    "Building FTS5 index...",
    "Generating embeddings [64-dim]...",
    "Writing to SQLite cache...",
    "Scan complete. 12 samples indexed.",
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setProgress((i / files.length) * 100);
      setCurrentFile(files[Math.min(i, files.length - 1)]);
      if (i >= files.length) {
        clearInterval(interval);
        setTimeout(onDone, 600);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000090", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "#0f1117", border: "1px solid #1f2937",
        padding: "32px", width: "420px", borderRadius: "4px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "#f97316", boxShadow: "0 0 8px #f97316",
            animation: "pulse 1s infinite",
          }} />
          <span style={{ color: "#f1f5f9", fontFamily: "'Courier New', monospace", fontSize: "13px", letterSpacing: "0.06em" }}>
            SCANNING LIBRARY
          </span>
        </div>
        <div style={{
          fontFamily: "'Courier New', monospace", fontSize: "11px",
          color: "#6b7280", marginBottom: "16px", minHeight: "16px",
        }}>
          {currentFile}
        </div>
        <div style={{ height: "2px", background: "#1f2937", borderRadius: "1px", marginBottom: "8px" }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: "linear-gradient(90deg, #f97316, #fb923c)",
            borderRadius: "1px", transition: "width 0.3s ease",
          }} />
        </div>
        <div style={{ textAlign: "right", fontFamily: "'Courier New', monospace", fontSize: "10px", color: "#374151" }}>
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
};

export default function OpenSampleManager() {
  const [samples, setSamples] = useState(MOCK_SAMPLES);
  const [selected, setSelected] = useState(MOCK_SAMPLES[0]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterBpmMin, setFilterBpmMin] = useState("");
  const [filterBpmMax, setFilterBpmMax] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTick(t => t + 1), 50);
    return () => clearInterval(id);
  }, [playing]);

  const filtered = samples.filter(s => {
    const matchSearch = s.file_name.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchType = filterType === "all" || s.sample_type === filterType;
    const matchBpmMin = filterBpmMin === "" || (s.bpm && s.bpm >= parseFloat(filterBpmMin));
    const matchBpmMax = filterBpmMax === "" || (s.bpm && s.bpm <= parseFloat(filterBpmMax));
    return matchSearch && matchType && matchBpmMin && matchBpmMax;
  });

  return (
    <div style={{
      background: "#080a0f",
      minHeight: "100vh",
      fontFamily: "'Courier New', monospace",
      color: "#e2e8f0",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f1117; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #374151; }
        input { background: transparent; border: none; outline: none; color: #e2e8f0; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .sample-row:hover { background: #0f1117 !important; cursor: pointer; }
        .sample-row.active { background: #111827 !important; border-left: 2px solid #f97316 !important; }
        .icon-btn:hover { color: #f97316 !important; }
        .tag-chip:hover { background: #1f2937 !important; cursor: pointer; }
      `}</style>

      {scanning && <ScannerOverlay onDone={() => { setScanning(false); setScanned(true); }} />}

      {/* Header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid #0f1117",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#0a0c12",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "3px",
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px #f9731640",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", color: "#f1f5f9" }}>
              OPEN SAMPLE MANAGER
            </div>
            <div style={{ fontSize: "9px", color: "#374151", letterSpacing: "0.12em" }}>
              v0.1.0-alpha · Logic Pro AU · LOCAL
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {scanned && (
            <div style={{
              fontSize: "9px", color: "#22d3ee", letterSpacing: "0.1em",
              background: "#22d3ee10", border: "1px solid #22d3ee30",
              padding: "3px 8px", borderRadius: "2px",
            }}>
              ✓ {samples.length} SAMPLES INDEXED
            </div>
          )}
          <button
            onClick={() => setScanning(true)}
            style={{
              fontSize: "10px", letterSpacing: "0.1em",
              background: "#f97316", color: "#000",
              border: "none", padding: "6px 14px",
              borderRadius: "2px", cursor: "pointer",
              fontFamily: "'Courier New', monospace",
              fontWeight: 700,
            }}
          >
            SCAN LIBRARY
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 57px)" }}>
        {/* Left sidebar - filters */}
        <div style={{
          width: "180px", borderRight: "1px solid #0f1117",
          background: "#0a0c12", padding: "16px 12px",
          display: "flex", flexDirection: "column", gap: "20px",
          flexShrink: 0, overflowY: "auto",
        }}>
          <div>
            <div style={{ fontSize: "9px", color: "#374151", letterSpacing: "0.14em", marginBottom: "10px" }}>
              SAMPLE TYPE
            </div>
            {["all", "kick", "loop", "one-shot"].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: filterType === t ? "#111827" : "transparent",
                  border: "none", borderLeft: filterType === t ? "2px solid #f97316" : "2px solid transparent",
                  padding: "6px 8px",
                  fontFamily: "'Courier New', monospace",
                  fontSize: "11px",
                  color: filterType === t ? "#f1f5f9" : "#6b7280",
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                  marginBottom: "2px",
                  borderRadius: "0 2px 2px 0",
                }}
              >
                {t.toUpperCase()}
                <span style={{ float: "right", color: "#374151", fontSize: "10px" }}>
                  {t === "all" ? samples.length : samples.filter(s => s.sample_type === t).length}
                </span>
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize: "9px", color: "#374151", letterSpacing: "0.14em", marginBottom: "10px" }}>
              BPM RANGE
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <div style={{ flex: 1, border: "1px solid #1f2937", borderRadius: "2px", padding: "4px 6px" }}>
                <input
                  type="number" placeholder="MIN" value={filterBpmMin}
                  onChange={e => setFilterBpmMin(e.target.value)}
                  style={{ width: "100%", fontSize: "10px", color: "#9ca3af" }}
                />
              </div>
              <span style={{ color: "#374151", fontSize: "10px" }}>—</span>
              <div style={{ flex: 1, border: "1px solid #1f2937", borderRadius: "2px", padding: "4px 6px" }}>
                <input
                  type="number" placeholder="MAX" value={filterBpmMax}
                  onChange={e => setFilterBpmMax(e.target.value)}
                  style={{ width: "100%", fontSize: "10px", color: "#9ca3af" }}
                />
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "9px", color: "#374151", letterSpacing: "0.14em", marginBottom: "10px" }}>
              TAGS
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {[...new Set(samples.flatMap(s => s.tags))].slice(0, 14).map(tag => (
                <span
                  key={tag}
                  className="tag-chip"
                  onClick={() => setSearch(tag)}
                  style={{
                    fontSize: "9px", padding: "2px 6px",
                    background: "#0f1117", border: "1px solid #1f2937",
                    borderRadius: "2px", color: "#6b7280",
                    letterSpacing: "0.06em",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "9px", color: "#374151", letterSpacing: "0.14em", marginBottom: "10px" }}>
              DB STATUS
            </div>
            <div style={{ fontSize: "9px", color: "#4b5563", lineHeight: 1.8 }}>
              <div>ENGINE: SQLite + FTS5</div>
              <div>RECORDS: {samples.length}</div>
              <div>INDEX: ✓ BPM, TYPE</div>
              <div>EMBED: 64-dim</div>
            </div>
          </div>
        </div>

        {/* Main list */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Search bar */}
          <div style={{
            padding: "10px 16px",
            borderBottom: "1px solid #0f1117",
            background: "#0a0c12",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by filename, tag, key... (FTS5)"
              style={{
                flex: 1, fontSize: "12px", color: "#9ca3af",
                letterSpacing: "0.04em",
              }}
            />
            <span style={{ fontSize: "9px", color: "#374151", letterSpacing: "0.1em" }}>
              {filtered.length}/{samples.length} RESULTS
            </span>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr 80px 60px 60px 80px",
            padding: "6px 16px",
            borderBottom: "1px solid #0f1117",
            fontSize: "8px", letterSpacing: "0.14em", color: "#374151",
          }}>
            <div />
            <div>FILENAME</div>
            <div>TYPE</div>
            <div>BPM</div>
            <div>DUR</div>
            <div>LOW RATIO</div>
          </div>

          {/* Sample list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.map((s, idx) => (
              <div
                key={s.id}
                className={`sample-row ${selected?.id === s.id ? "active" : ""}`}
                onClick={() => { setSelected(s); setPlaying(false); }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr 80px 60px 60px 80px",
                  padding: "8px 16px",
                  borderBottom: "1px solid #0d0f16",
                  borderLeft: selected?.id === s.id ? "2px solid #f97316" : "2px solid transparent",
                  background: selected?.id === s.id ? "#111827" : "transparent",
                  alignItems: "center",
                  animation: `fadeIn 0.2s ease ${idx * 0.03}s both`,
                  transition: "background 0.1s",
                }}
              >
                <div style={{ fontSize: "9px", color: "#374151" }}>{s.id}</div>
                <div>
                  <div style={{ fontSize: "11px", color: "#d1d5db", letterSpacing: "0.02em", marginBottom: "3px" }}>
                    {s.file_name}
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {s.tags.map(t => (
                      <span key={t} style={{
                        fontSize: "8px", padding: "1px 4px",
                        background: "#0f1117", color: "#4b5563",
                        border: "1px solid #1a1f2e", borderRadius: "1px",
                      }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div><TypeBadge type={s.sample_type} /></div>
                <div style={{ fontSize: "11px", color: s.bpm ? "#22d3ee" : "#374151", fontWeight: s.bpm ? 700 : 400 }}>
                  {s.bpm ? `${s.bpm}` : "—"}
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  {s.duration.toFixed(2)}s
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ flex: 1, height: "3px", background: "#1f2937", borderRadius: "1px" }}>
                    <div style={{
                      height: "100%",
                      width: `${s.low_ratio * 100}%`,
                      background: s.low_ratio > 0.6 ? "#f97316" : "#4b5563",
                      borderRadius: "1px",
                    }} />
                  </div>
                  <span style={{ fontSize: "9px", color: "#4b5563", width: "28px" }}>
                    {(s.low_ratio * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel - detail */}
        {selected && (
          <div style={{
            width: "260px", borderLeft: "1px solid #0f1117",
            background: "#0a0c12", padding: "20px 16px",
            display: "flex", flexDirection: "column", gap: "20px",
            flexShrink: 0, overflowY: "auto",
          }}>
            {/* File info */}
            <div>
              <div style={{ fontSize: "10px", color: "#f1f5f9", letterSpacing: "0.06em", marginBottom: "4px", lineHeight: 1.4 }}>
                {selected.file_name}
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "12px" }}>
                <TypeBadge type={selected.sample_type} />
                {selected.bpm && (
                  <span style={{ fontSize: "9px", color: "#22d3ee", letterSpacing: "0.1em" }}>
                    {selected.bpm} BPM
                  </span>
                )}
              </div>
            </div>

            {/* Waveform */}
            <div style={{
              background: "#080a0f",
              border: "1px solid #1a1f2e",
              borderRadius: "3px",
              padding: "10px",
            }}>
              <div style={{ marginBottom: "8px" }}>
                <WaveformDisplay sample={selected} isPlaying={playing} key={`${selected.id}-${tick}`} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button
                  onClick={() => setPlaying(p => !p)}
                  style={{
                    background: playing ? "#f97316" : "#1f2937",
                    border: "none", borderRadius: "2px",
                    width: "28px", height: "28px",
                    cursor: "pointer", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {playing ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>
                <span style={{ fontSize: "9px", color: "#374151" }}>{selected.duration.toFixed(3)}s</span>
              </div>
            </div>

            {/* Analysis */}
            <div>
              <div style={{ fontSize: "9px", color: "#374151", letterSpacing: "0.14em", marginBottom: "12px" }}>
                SPECTRAL ANALYSIS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <AnalysisBar label="LOW RATIO" value={selected.low_ratio} max={1} color="#f97316" />
                <AnalysisBar label="PERIODICITY" value={selected.periodicity} max={1} color="#22d3ee" />
                <AnalysisBar label="ATTACK SLOPE" value={selected.attack_slope} max={5} color="#a78bfa" />
                {selected.decay_time && (
                  <AnalysisBar label="DECAY (ms)" value={selected.decay_time} max={600} color="#fb923c" />
                )}
              </div>
            </div>

            {/* Kick detection result */}
            {selected.sample_type === "kick" && (
              <div style={{
                background: "#f9731610",
                border: "1px solid #f9731630",
                borderRadius: "3px",
                padding: "10px",
              }}>
                <div style={{ fontSize: "9px", color: "#f97316", letterSpacing: "0.12em", marginBottom: "8px" }}>
                  KICK DETECTION
                </div>
                <div style={{ fontSize: "9px", color: "#6b7280", lineHeight: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>low_ratio &gt; 0.6</span>
                    <span style={{ color: selected.low_ratio > 0.6 ? "#22d3ee" : "#ef4444" }}>
                      {selected.low_ratio > 0.6 ? "✓" : "✗"} {selected.low_ratio.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>attack_slope &gt; θ</span>
                    <span style={{ color: selected.attack_slope > 1.5 ? "#22d3ee" : "#ef4444" }}>
                      {selected.attack_slope > 1.5 ? "✓" : "✗"} {selected.attack_slope.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>decay &lt; 400ms</span>
                    <span style={{ color: selected.decay_time < 400 ? "#22d3ee" : "#ef4444" }}>
                      {selected.decay_time < 400 ? "✓" : "✗"} {selected.decay_time}ms
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Loop detection */}
            {selected.sample_type === "loop" && (
              <div style={{
                background: "#22d3ee10",
                border: "1px solid #22d3ee30",
                borderRadius: "3px",
                padding: "10px",
              }}>
                <div style={{ fontSize: "9px", color: "#22d3ee", letterSpacing: "0.12em", marginBottom: "8px" }}>
                  LOOP CLASSIFIER
                </div>
                <div style={{ fontSize: "9px", color: "#6b7280", lineHeight: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>duration &gt; 1.0s</span>
                    <span style={{ color: "#22d3ee" }}>✓ {selected.duration.toFixed(2)}s</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>periodicity &gt; 0.3</span>
                    <span style={{ color: "#22d3ee" }}>✓ {selected.periodicity.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>BPM (FFT-ACF)</span>
                    <span style={{ color: "#22d3ee" }}>{selected.bpm}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Embedding */}
            <div>
              <div style={{ fontSize: "9px", color: "#374151", letterSpacing: "0.14em", marginBottom: "8px" }}>
                EMBEDDING [64-dim]
              </div>
              <div style={{ display: "flex", gap: "1px", flexWrap: "wrap", opacity: 0.6 }}>
                {Array.from({ length: 32 }, (_, i) => (
                  <div key={i} style={{
                    width: "6px", height: "6px",
                    background: `hsl(${(selected.id * 37 + i * 11) % 360}, 60%, 40%)`,
                    borderRadius: "1px",
                  }} />
                ))}
              </div>
              <div style={{ fontSize: "8px", color: "#374151", marginTop: "6px" }}>
                cos-sim search · HNSW ready
              </div>
            </div>

            {/* Path */}
            <div style={{ borderTop: "1px solid #0f1117", paddingTop: "12px" }}>
              <div style={{ fontSize: "8px", color: "#374151", letterSpacing: "0.08em", marginBottom: "4px" }}>PATH</div>
              <div style={{ fontSize: "8px", color: "#4b5563", wordBreak: "break-all", lineHeight: 1.6 }}>
                ~/Samples/Library/{selected.file_name}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
