import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const pathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadIdRef = useRef(0);
  const autoPlayRef = useRef(autoPlay);
  const trimRef = useRef({ start: trimStart, end: trimEnd });
  const objectUrlRef = useRef<string | null>(null);
  const gainMultiplier = Math.pow(10, gainDb / 20);
  const effectiveVolume = Math.min(1, Math.max(0, volume * gainMultiplier));

  autoPlayRef.current = autoPlay;
  trimRef.current = { start: trimStart, end: trimEnd };

  useEffect(() => {
    audioRef.current.volume = effectiveVolume;
  }, [effectiveVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    loadIdRef.current += 1;
    audio.pause();
    onPathChange();
    audio.src = "";
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
      setAudioUrl(null);
    }
    if (pathTimerRef.current) {
      clearTimeout(pathTimerRef.current);
    }

    pathTimerRef.current = setTimeout(() => {
      setStablePath(path);
    }, autoPlayRef.current ? 250 : 50);

    return () => {
      if (pathTimerRef.current) {
        clearTimeout(pathTimerRef.current);
      }
    };
  }, [path, onPathChange]);

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

    let objectUrl: string | null = null;
    audio.onloadedmetadata = audio.onerror = audio.onended = audio.onpause = audio.onplay = audio.ontimeupdate = null;
    audio.pause();

    setLoading(true);
    setLoadError(null);
    setPlaying(false);
    setCurrentTime(0);

    const loadAudio = async () => {
      try {
        const bytes = await invoke<ArrayBuffer>("read_audio_file", { path: stablePath });
        if (loadIdRef.current !== myLoadId) return;
        objectUrl = URL.createObjectURL(new Blob([bytes]));
        if (loadIdRef.current !== myLoadId) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        objectUrlRef.current = objectUrl;
        setAudioUrl(objectUrl);
        audio.src = objectUrl;
        audio.playbackRate = 1;
      } catch {
        if (loadIdRef.current !== myLoadId) return;
        setLoadError("ファイルを読み込めません");
        setLoading(false);
      }
    };
    void loadAudio();

    audio.onloadedmetadata = () => {
      if (loadIdRef.current !== myLoadId) return;
      setDuration(audio.duration);
      setLoading(false);
      if (autoPlayRef.current) {
        if (trimRef.current.start > 0) audio.currentTime = trimRef.current.start;
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
      if (trimRef.current.end > 0 && audio.currentTime >= trimRef.current.end) {
        audio.pause();
        audio.currentTime = trimRef.current.end;
      }
      setCurrentTime(audio.currentTime);
    };

    return () => {
      loadIdRef.current += 1;
      audio.onloadedmetadata = audio.onerror = audio.onended = audio.onpause = audio.onplay = audio.ontimeupdate = null;
      audio.pause();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        if (objectUrlRef.current === objectUrl) {
          objectUrlRef.current = null;
        }
      }
    };
  }, [stablePath]);

  const playFromPreviewStart = () => {
    const audio = audioRef.current;
    const { start, end } = trimRef.current;
    if (start > 0 && (audio.currentTime < start || (end > 0 && audio.currentTime >= end))) {
      audio.currentTime = start;
      setCurrentTime(start);
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
    audioUrl,
    volume,
  };
}
