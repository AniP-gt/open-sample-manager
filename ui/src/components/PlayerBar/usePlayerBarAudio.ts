import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { sharedPlayerBarAudio } from "./playerBarAudio";

interface UsePlayerBarAudioOptions {
  readonly path?: string;
  readonly autoPlay?: boolean;
  readonly trimStart: number;
  readonly trimEnd: number;
  readonly gainDb: number;
  readonly onPathChange: () => void;
}

export function usePlayerBarAudio({ path, autoPlay, trimStart, trimEnd, gainDb, onPathChange }: UsePlayerBarAudioOptions) {
  const audioRef = useRef<HTMLAudioElement>(sharedPlayerBarAudio);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [volume, setVolume] = useState(() => audioRef.current.volume);
  const [stablePath, setStablePath] = useState<string | undefined>(path);
  const pathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadIdRef = useRef(0);
  const autoPlayRef = useRef(autoPlay);
  const gainMultiplier = Math.pow(10, gainDb / 20);
  const effectiveVolume = Math.min(1, Math.max(0, volume * gainMultiplier));

  autoPlayRef.current = autoPlay;

  useEffect(() => {
    audioRef.current.volume = effectiveVolume;
  }, [effectiveVolume]);

  useEffect(() => {
    // Stop current audio immediately — reuse the same element
    const audio = audioRef.current;
    audio.pause();

    onPathChange();

    if (pathTimerRef.current) clearTimeout(pathTimerRef.current);

    pathTimerRef.current = setTimeout(() => {
      setStablePath(path);
    }, autoPlayRef.current ? 250 : 50);

    return () => {
      if (pathTimerRef.current) clearTimeout(pathTimerRef.current);
    };
  }, [path, onPathChange]);

  // Load audio when stable path settles — reuses a single Audio element.
  useEffect(() => {
    const audio = audioRef.current;
    const myLoadId = ++loadIdRef.current;

    if (!stablePath) {
      audio.pause();
      audio.src = "";
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setLoading(false);
      return;
    }

    const assetUrl = convertFileSrc(stablePath);

    // Detach old handlers before assigning new src
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.onended = null;
    audio.onpause = null;
    audio.onplay = null;
    audio.ontimeupdate = null;
    audio.pause();

    setLoading(true);
    setLoadError(null);
    setPlaying(false);
    setCurrentTime(0);

    audio.src = assetUrl;
    audio.playbackRate = 1;

    audio.onloadedmetadata = () => {
      if (loadIdRef.current !== myLoadId) return;
      setDuration(audio.duration);
      setLoading(false);
      if (autoPlayRef.current) {
        if (trimStart > 0) audio.currentTime = trimStart;
        audio.play().catch(() => {});
      }
    };

    audio.onerror = () => {
      if (loadIdRef.current !== myLoadId) return;
      setLoadError("ファイルを読み込めません");
      setLoading(false);
    };

    audio.onended = () => { if (loadIdRef.current === myLoadId) setPlaying(false); };
    audio.onpause = () => { if (loadIdRef.current === myLoadId) setPlaying(false); };
    audio.onplay = () => { if (loadIdRef.current === myLoadId) setPlaying(true); };
    audio.ontimeupdate = () => {
      if (loadIdRef.current !== myLoadId) return;
      if (trimEnd > 0 && audio.currentTime >= trimEnd) {
        audio.pause();
        audio.currentTime = trimEnd;
      }
      setCurrentTime(audio.currentTime);
    };

    return () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.onended = null;
      audio.onpause = null;
      audio.onplay = null;
      audio.ontimeupdate = null;
      audio.pause();
    };
  }, [stablePath, trimStart, trimEnd]);

  const playFromPreviewStart = () => {
    const audio = audioRef.current;
    if (trimStart > 0 && (audio.currentTime < trimStart || (trimEnd > 0 && audio.currentTime >= trimEnd))) {
      audio.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
    audio.play().catch((err) => {
      setLoadError(err.message);
    });
  };

  return {
    audio: audioRef.current,
    currentTime,
    duration,
    loadError,
    loading,
    playing,
    setLoadError,
    setVolume: (value: number) => {
      setVolume(value);
      audioRef.current.volume = value;
    },
    stop: () => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      setCurrentTime(0);
    },
    play: () => {
      if (audioRef.current.paused) playFromPreviewStart();
    },
    playFromStart: () => {
      const audio = audioRef.current;
      audio.pause();
      audio.currentTime = 0;
      setCurrentTime(0);
      audio.play().catch((err) => {
        setLoadError(err.message);
      });
    },
    toggle: () => {
      if (audioRef.current.paused) {
        playFromPreviewStart();
      } else {
        audioRef.current.pause();
      }
    },
    close: () => {
      const audio = audioRef.current;
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setLoadError(null);
    },
    seek: (time: number) => {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    },
    stablePath,
    volume,
  };
}
