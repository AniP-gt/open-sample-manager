import { useMemo } from "react";
import type { Sample } from "../../types/sample";

interface WaveformDisplayProps {
  sample: Sample;
  isPlaying: boolean;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  height?: number;
}

export function WaveformDisplay({ sample, isPlaying, currentTime = 0, duration = 1, onSeek, height = 48 }: WaveformDisplayProps) {
  const bars = 96;

  const waveData = useMemo(() => {
    if (sample.waveform_peaks && sample.waveform_peaks.length > 0) {
      return sample.waveform_peaks;
    }

    return Array.from({ length: bars }, (_, i) => {
      const x = i / bars;
      const base =
      sample.instrument_type === "kick"
        ? Math.exp(-x * 6) * (0.7 + Math.random() * 0.3)
        : sample.sample_type === "loop"
          ? 0.3 + Math.sin(x * Math.PI * 8) * 0.25 + Math.random() * 0.2
          : Math.exp(-x * 3) * (0.5 + Math.random() * 0.4);
      return Math.max(0.04, base);
    });
  }, [sample.waveform_peaks, sample.sample_type, sample.instrument_type]);

  const getWaveColors = () => {
    switch (sample.instrument_type) {
      case "kick":
        return { base: "#f97316", glow: "#fdba74" };
      default:
        return sample.sample_type === "loop"
          ? { base: "#22d3ee", glow: "#67e8f9" }
          : { base: "#c084fc", glow: "#f0abfc" };
    }
  };

  const { base, glow } = getWaveColors();
  const progress = duration > 0 ? currentTime / duration : 0;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const playedId = `played-${sample.id}`;
  const gradientId = `wave-gradient-${sample.id}`;
  const heightBox = 100;
  const widthBox = 100;
  const mid = heightBox / 2;

  const wavePath = useMemo(() => {
    const points = waveData.map((amp, i) => {
      const x = (i / (waveData.length - 1)) * widthBox;
      const scaled = Math.max(0.06, Math.min(1, amp));
      const yTop = mid - scaled * mid;
      const yBottom = mid + scaled * mid;
      return { x, yTop, yBottom };
    });

    if (points.length === 0) return "";

    const top = points.map((p, index) => `${index === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.yTop.toFixed(2)}`).join(" ");
    const bottom = points
      .slice()
      .reverse()
      .map((p) => `L${p.x.toFixed(2)},${p.yBottom.toFixed(2)}`)
      .join(" ");

    return `${top} ${bottom} Z`;
  }, [waveData]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const seekTime = ratio * duration;
    onSeek(seekTime);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        height: `${height}px`,
        width: "100%",
        cursor: onSeek ? "pointer" : "default",
        position: "relative",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${widthBox} ${heightBox}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={glow} stopOpacity="0.95" />
            <stop offset="40%" stopColor={base} stopOpacity="0.85" />
            <stop offset="100%" stopColor={base} stopOpacity="0.7" />
          </linearGradient>
          <clipPath id={playedId}>
            <rect x="0" y="0" width={clampedProgress * widthBox} height={heightBox} />
          </clipPath>
        </defs>
        <path
          d={wavePath}
          fill={`url(#${gradientId})`}
          opacity={0.55}
        />
        <g clipPath={`url(#${playedId})`}>
          <path d={wavePath} fill={base} opacity={0.95} />
        </g>
        <line
          x1={clampedProgress * widthBox}
          x2={clampedProgress * widthBox}
          y1={0}
          y2={heightBox}
          stroke={isPlaying ? glow : base}
          strokeWidth={0.6}
          opacity={isPlaying ? 0.9 : 0.5}
        />
      </svg>
    </div>
  );
}
