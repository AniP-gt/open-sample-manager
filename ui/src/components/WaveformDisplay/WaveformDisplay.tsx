import { useRef } from "react";
import type { Sample } from "../../types/sample";

interface WaveformDisplayProps {
  sample: Sample;
  isPlaying: boolean;
}

export function WaveformDisplay({ sample, isPlaying }: WaveformDisplayProps) {
  const bars = 64;
  const waveData = useRef<number[]>(
    Array.from({ length: bars }, (_, i) => {
      const x = i / bars;
      const base =
        sample.sample_type === "kick"
          ? Math.exp(-x * 6) * (0.7 + Math.random() * 0.3)
          : sample.sample_type === "loop"
          ? 0.3 + Math.sin(x * Math.PI * 8) * 0.25 + Math.random() * 0.2
          : Math.exp(-x * 3) * (0.5 + Math.random() * 0.4);
      return Math.max(0.04, base);
    })
  );

  const getBarColor = (index: number) => {
    const isPast = isPlaying && index / bars < (Date.now() / 2000) % 1;
    if (isPast) return "#f97316";

    switch (sample.sample_type) {
      case "kick":
        return "#f97316aa";
      case "loop":
        return "#22d3eeaa";
      default:
        return "#a78bfaaa";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1px",
        height: "48px",
        width: "100%",
      }}
    >
      {waveData.current.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h * 100}%`,
            background: getBarColor(i),
            borderRadius: "1px",
            transition: "background 0.1s",
          }}
        />
      ))}
    </div>
  );
}
