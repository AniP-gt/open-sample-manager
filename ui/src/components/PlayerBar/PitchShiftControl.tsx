import { useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";

interface PitchShiftControlProps {
  audioElement: HTMLAudioElement;
  wavesurfer?: WaveSurfer | null;
  /** When true, the slider is disabled — adjusting pitch during playback
   *  causes audible glitches because the worklet graph is being rewired. */
  isPlaying: boolean;
}

// Internal-API shape we care about on the WebAudioPlayer that WaveSurfer
// constructs when `backend: "WebAudio"` is used. We access it via the
// `media` property (returned by `getMediaElement()`).
interface WebAudioPlayerLike {
  audioContext?: AudioContext;
  gainNode?: GainNode;
}

interface PipelineEntry {
  workletNode: AudioWorkletNode | null;
  // Tracks the GainNode currently feeding the worklet. WaveSurfer can rebuild
  // its internal gain node across loads, so on a cache hit we compare and
  // rewire if the reference has changed.
  gainNode: GainNode | null;
  moduleLoaded: Promise<void>;
}

// Module-level cache so each AudioContext gets exactly one worklet pipeline,
// even if PitchShiftControl unmounts/remounts (e.g. when the user toggles
// the advanced controls panel).
const pipelineCache = new WeakMap<AudioContext, PipelineEntry>();

function getWebAudioPlayer(ws: WaveSurfer): WebAudioPlayerLike | null {
  // WaveSurfer 7.x stores the media (HTMLMediaElement OR WebAudioPlayer)
  // on `this.media`, exposed publicly via `getMediaElement()`. When the
  // `WebAudio` backend is selected the returned object is a WebAudioPlayer
  // with `.audioContext` and `.gainNode` as public properties.
  let media: unknown = null;
  try {
    media = ws.getMediaElement();
  } catch {
    media = null;
  }
  if (!media) {
    // Fallback: peek at the documented internal property name.
    media = (ws as unknown as { media?: unknown }).media ?? null;
  }
  if (media && typeof media === "object") {
    const m = media as WebAudioPlayerLike;
    if (m.audioContext && m.gainNode) return m;
  }
  return null;
}

export function PitchShiftControl({
  audioElement: _audioElement,
  wavesurfer,
  isPlaying,
}: PitchShiftControlProps) {
  const [semitones, setSemitones] = useState(0);
  const [ready, setReady] = useState(false);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    if (!wavesurfer) {
      setReady(false);
      workletNodeRef.current = null;
      return;
    }

    let cancelled = false;

    const setup = async () => {
      const player = getWebAudioPlayer(wavesurfer);
      if (!player || !player.audioContext || !player.gainNode) {
        console.warn(
          "[PitchShiftControl] Could not access WaveSurfer's internal AudioContext.",
        );
        return;
      }

      const audioCtx = player.audioContext;
      const gainNode = player.gainNode;

      // Resume suspended AudioContext (browser autoplay policy may suspend it
      // before the first user gesture that involves audio).
      if (audioCtx.state === "suspended") {
        await audioCtx.resume().catch(() => {});
      }
      if (cancelled) return;

      let entry = pipelineCache.get(audioCtx);
      if (!entry) {
        const moduleLoaded = audioCtx.audioWorklet.addModule(
          "/pitch-processor.js",
        );
        entry = { workletNode: null, gainNode: gainNode, moduleLoaded };
        pipelineCache.set(audioCtx, entry);

        try {
          await moduleLoaded;
        } catch (err) {
          pipelineCache.delete(audioCtx);
          console.warn("[PitchShiftControl] Worklet module load failed:", err);
          return;
        }
        if (cancelled) {
          // Drop the half-initialized cache entry so a remount can retry
          // cleanly instead of awaiting a worklet that will never be wired.
          pipelineCache.delete(audioCtx);
          return;
        }

        const node = new AudioWorkletNode(audioCtx, "pitch-processor");
        // Insert the worklet between the gain node and the destination.
        // gainNode -> destination (default)
        // becomes:
        // gainNode -> workletNode -> destination
        try {
          gainNode.disconnect(audioCtx.destination);
        } catch {
          // gainNode was not connected to destination — safe to ignore.
        }
        gainNode.connect(node);
        node.connect(audioCtx.destination);
        entry.workletNode = node;
        entry.gainNode = gainNode;
      } else {
        try {
          await entry.moduleLoaded;
        } catch {
          return;
        }
        if (cancelled) return;

        // Cache hit: WaveSurfer may have rebuilt its gainNode (e.g. after a
        // new sample load), in which case the worklet is still alive but the
        // wiring points at a stale node. Rewire to the current gainNode.
        if (entry.workletNode && entry.gainNode !== gainNode) {
          try {
            entry.gainNode?.disconnect(entry.workletNode);
          } catch {
            // Stale node may already be disconnected.
          }
          try {
            gainNode.disconnect(audioCtx.destination);
          } catch {
            // Current gainNode may not have a default-destination edge.
          }
          gainNode.connect(entry.workletNode);
          entry.gainNode = gainNode;
        }
      }

      if (cancelled || !entry.workletNode) return;
      workletNodeRef.current = entry.workletNode;
      setReady(true);
    };

    setup().catch((err) => {
      console.warn("[PitchShiftControl] setup failed:", err);
    });

    return () => {
      cancelled = true;
      workletNodeRef.current = null;
      setReady(false);
    };
  }, [wavesurfer]);

  // Push pitchFactor changes to the worklet via its message port.
  useEffect(() => {
    if (!workletNodeRef.current || !ready) return;
    const pitchFactor = Math.pow(2, semitones / 12);
    workletNodeRef.current.port.postMessage({ pitchFactor });
  }, [semitones, ready]);

  const semitoneLabel =
    semitones > 0 ? `+${semitones}st` : semitones === 0 ? "0st" : `${semitones}st`;

  const sliderDisabled = isPlaying || !ready;
  // The reset button stays enabled even during playback. Only the slider
  // is locked during playback (rewiring the worklet graph causes glitches);
  // resetting to 0 just posts a message to the existing worklet.
  const buttonDisabled = false;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em" }}>
        PITCH
      </span>
      <input
        type="range"
        min={-12}
        max={12}
        step={1}
        value={semitones}
        disabled={sliderDisabled}
        aria-label="Pitch shift in semitones"
        aria-valuetext={semitoneLabel}
        onChange={(e) => setSemitones(parseInt(e.target.value, 10))}
        style={{
          width: "140px",
          accentColor: "#a78bfa",
          cursor: sliderDisabled ? "not-allowed" : "pointer",
          opacity: sliderDisabled ? 0.4 : 1,
        }}
      />
      <span
        style={{
          minWidth: "44px",
          color: "#a78bfa",
          fontFamily: "monospace",
          fontSize: "13px",
          textAlign: "right",
        }}
      >
        {semitoneLabel}
      </span>
      <button
        type="button"
        onClick={() => setSemitones(0)}
        disabled={buttonDisabled}
        style={{
          fontSize: "11px",
          color: "#6b7280",
          background: "transparent",
          border: "1px solid #1f2937",
          borderRadius: "4px",
          padding: "4px 10px",
          cursor: buttonDisabled ? "not-allowed" : "pointer",
          letterSpacing: "0.14em",
          fontFamily: "inherit",
          opacity: buttonDisabled ? 0.4 : 1,
        }}
      >
        0
      </button>
      {!ready && (
        <span style={{ fontSize: "10px", color: "#4b5563" }}>
          {wavesurfer ? "loading..." : "load a sample"}
        </span>
      )}
    </div>
  );
}
