import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DiscoverySample } from "../../types/discovery";
import { getErrorMessage } from "../../utils/sampleMapper";
import { recordUsage } from "./discoveryApi";

export function measureAudio(buffer: Pick<AudioBuffer, "numberOfChannels" | "length" | "getChannelData">): { readonly rms: number; readonly peak: number } {
  let squares = 0, peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    for (const sample of buffer.getChannelData(channel)) { squares += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
  }
  return { rms: Math.sqrt(squares / Math.max(1, buffer.length * buffer.numberOfChannels)), peak };
}

export function comparisonGain(level: { readonly rms: number; readonly peak: number }): number {
  if (level.rms === 0 || level.peak === 0) return 1;
  return Math.min(0.1 / level.rms, Math.pow(10, -1 / 20) / level.peak);
}

export function useDiscoveryAudio() {
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const output = useRef<GainNode | null>(null);
  const generation = useRef(0);
  const startedAt = useRef(0);
  const currentOffset = useRef(0);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gainDb, setGainDb] = useState<number | null>(null);

  const stop = useCallback(() => {
    generation.current += 1;
    const old = source.current;
    source.current = null;
    if (old) { old.onended = null; old.stop(); old.disconnect(); }
    output.current?.disconnect(); output.current = null;
    setPlayingId(null); setLoadingId(null);
  }, []);

  const play = async (entry: DiscoverySample, normalized: boolean, aligned = false) => {
    const previousOffset = source.current && context.current
      ? context.current.currentTime - startedAt.current + currentOffset.current : 0;
    stop();
    const version = generation.current;
    setLoadingId(entry.sample.id); setError(null);
    try {
      const audioContext = context.current ?? new AudioContext();
      context.current = audioContext;
      await audioContext.resume();
      const bytes = await invoke<ArrayBuffer>("read_audio_file", { path: entry.path });
      const buffer = await audioContext.decodeAudioData(bytes);
      if (version !== generation.current) return;
      const gain = audioContext.createGain();
      output.current = gain;
      gain.gain.value = normalized ? comparisonGain(measureAudio(buffer)) : 1;
      setGainDb(20 * Math.log10(gain.gain.value));
      const nextSource = audioContext.createBufferSource();
      nextSource.buffer = buffer;
      nextSource.connect(gain); gain.connect(audioContext.destination);
      const offset = aligned && buffer.duration > 0 ? previousOffset % buffer.duration : 0;
      currentOffset.current = offset; startedAt.current = audioContext.currentTime;
      nextSource.onended = () => {
        if (version === generation.current) { source.current = null; nextSource.disconnect(); gain.disconnect(); setPlayingId(null); }
      };
      source.current = nextSource;
      nextSource.start(0, offset);
      setPlayingId(entry.sample.id);
      void recordUsage(entry.sample.id, "preview").catch((e: unknown) => {
        if (version === generation.current) setError(`Could not save usage history: ${getErrorMessage(e)}`);
      });
    } catch (e: unknown) { if (version === generation.current) setError(`Could not preview sample: ${e instanceof Error ? e.message : getErrorMessage(e)}`); }
    finally { if (version === generation.current) setLoadingId(null); }
  };

  useEffect(() => () => {
    stop();
    if (context.current) void context.current.close().catch((e: unknown) => console.warn("Audio context close failed", getErrorMessage(e)));
  }, [stop]);

  return { play, stop, playingId, loadingId, error, gainDb };
}
