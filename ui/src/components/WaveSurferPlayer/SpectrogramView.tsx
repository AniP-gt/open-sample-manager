import { useEffect, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";
import SpectrogramPlugin from "wavesurfer.js/dist/plugins/spectrogram";

interface SpectrogramViewProps {
  wavesurfer: WaveSurfer | null;
  enabled: boolean;
  onToggle: () => void;
}

export function SpectrogramView({ wavesurfer, enabled, onToggle }: SpectrogramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<ReturnType<typeof SpectrogramPlugin.create> | null>(null);

  useEffect(() => {
    if (!enabled || !wavesurfer || !containerRef.current) return;

    const plugin = SpectrogramPlugin.create({
      container: containerRef.current,
      height: 80,
      labels: true,
    });

    try {
      wavesurfer.registerPlugin(plugin);
      pluginRef.current = plugin;
    } catch (err) {
      console.error("Spectrogram registration failed:", err);
    }

    return () => {
      try {
        plugin.destroy();
      } catch {
        // plugin may already be torn down by wavesurfer destruction
      }
      if (pluginRef.current === plugin) {
        pluginRef.current = null;
      }
    };
  }, [enabled, wavesurfer]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={onToggle}
          style={{
            fontSize: "11px",
            color: enabled ? "#22d3ee" : "#6b7280",
            background: "transparent",
            border: `1px solid ${enabled ? "#22d3ee" : "#1f2937"}`,
            borderRadius: "4px",
            padding: "4px 10px",
            cursor: "pointer",
            letterSpacing: "0.14em",
            fontFamily: "inherit",
          }}
        >
          SPECTROGRAM {enabled ? "ON" : "OFF"}
        </button>
      </div>
      {enabled && (
        <div
          ref={containerRef}
          style={{
            width: "100%",
            minHeight: "80px",
            background: "#0a0c12",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        />
      )}
    </div>
  );
}
