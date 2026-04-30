import { useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions";

interface LoopMarkerProps {
  wavesurfer: WaveSurfer | null;
}

interface RegionInfo {
  start: number;
  end: number;
}

export function LoopMarker({ wavesurfer }: LoopMarkerProps) {
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const currentRegionRef = useRef<Region | null>(null);
  const loopEnabledRef = useRef(false);
  const [regionInfo, setRegionInfo] = useState<RegionInfo | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);

  // Mirror loopEnabled into a ref so the timeupdate handler reads the latest
  // value without needing to be re-bound.
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  // Register RegionsPlugin once per wavesurfer instance.
  useEffect(() => {
    if (!wavesurfer) return;

    const plugin = RegionsPlugin.create();
    let registered = false;
    try {
      wavesurfer.registerPlugin(plugin);
      registered = true;
    } catch (err) {
      console.error("Regions registration failed:", err);
      return;
    }

    regionsPluginRef.current = plugin;

    const disableDrag = plugin.enableDragSelection({
      color: "rgba(34,211,238,0.15)",
    });

    const handleCreated = (region: Region) => {
      // Enforce single-region behaviour by clearing any previous regions
      // before storing the newly created one.
      const all = plugin.getRegions();
      for (const r of all) {
        if (r.id !== region.id) r.remove();
      }
      currentRegionRef.current = region;
      setRegionInfo({ start: region.start, end: region.end });
    };

    const handleUpdated = (region: Region) => {
      if (currentRegionRef.current && region.id === currentRegionRef.current.id) {
        setRegionInfo({ start: region.start, end: region.end });
      }
    };

    const handleRemoved = (region: Region) => {
      if (currentRegionRef.current && region.id === currentRegionRef.current.id) {
        currentRegionRef.current = null;
        setRegionInfo(null);
      }
    };

    const handleTimeUpdate = (time: number) => {
      if (!loopEnabledRef.current) return;
      const region = currentRegionRef.current;
      if (!region) return;
      const duration = wavesurfer.getDuration();
      if (!duration) return;
      if (time >= region.end) {
        wavesurfer.seekTo(Math.max(0, region.start) / duration);
      }
    };

    plugin.on("region-created", handleCreated);
    plugin.on("region-updated", handleUpdated);
    plugin.on("region-removed", handleRemoved);
    wavesurfer.on("timeupdate", handleTimeUpdate);

    return () => {
      try {
        disableDrag();
      } catch {
        // ignore
      }
      try {
        wavesurfer.un("timeupdate", handleTimeUpdate);
      } catch {
        // ignore
      }
      if (registered) {
        try {
          plugin.destroy();
        } catch {
          // ignore
        }
      }
      regionsPluginRef.current = null;
      currentRegionRef.current = null;
      setRegionInfo(null);
      setLoopEnabled(false);
    };
  }, [wavesurfer]);

  const handleClear = () => {
    const plugin = regionsPluginRef.current;
    if (plugin) {
      try {
        plugin.clearRegions();
      } catch {
        // ignore
      }
    }
    currentRegionRef.current = null;
    setRegionInfo(null);
    setLoopEnabled(false);
  };

  const handleToggleLoop = () => {
    if (!regionInfo) return;
    setLoopEnabled((v) => !v);
  };

  const formatTime = (s: number) => `${s.toFixed(1)}s`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: "11px",
          color: "#374151",
          letterSpacing: "0.14em",
        }}
      >
        LOOP
      </span>
      <button
        onClick={handleToggleLoop}
        disabled={!regionInfo}
        style={{
          fontSize: "11px",
          color: loopEnabled ? "#22d3ee" : regionInfo ? "#9ca3af" : "#4b5563",
          background: "transparent",
          border: `1px solid ${loopEnabled ? "#22d3ee" : "#1f2937"}`,
          borderRadius: "4px",
          padding: "4px 10px",
          cursor: regionInfo ? "pointer" : "not-allowed",
          letterSpacing: "0.14em",
          fontFamily: "inherit",
        }}
      >
        {loopEnabled ? "LOOP ON" : "LOOP OFF"}
      </button>
      {regionInfo ? (
        <span
          style={{
            fontSize: "12px",
            color: "#a78bfa",
            fontFamily: "monospace",
          }}
        >
          {formatTime(regionInfo.start)} → {formatTime(regionInfo.end)}
        </span>
      ) : (
        <span style={{ fontSize: "11px", color: "#4b5563" }}>
          drag on waveform to select
        </span>
      )}
      {regionInfo && (
        <button
          onClick={handleClear}
          style={{
            fontSize: "11px",
            color: "#6b7280",
            background: "transparent",
            border: "1px solid #1f2937",
            borderRadius: "4px",
            padding: "4px 10px",
            cursor: "pointer",
            letterSpacing: "0.14em",
            fontFamily: "inherit",
          }}
        >
          CLEAR
        </button>
      )}
    </div>
  );
}
