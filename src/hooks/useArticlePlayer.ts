import { useCallback, useEffect, useRef, useState } from "react";
import { KokoroTTS } from "kokoro-js";
import { detectDevice, loadTTS, type Device, type Dtype, type Voice } from "../lib/tts";
import type { Paragraph } from "../lib/extract";

const PREFETCH_AHEAD = 2;

type ModelStatus = "idle" | "loading" | "ready" | "error";

function loadPref<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function savePref<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useArticlePlayer(paragraphs: Paragraph[]) {
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);

  const [voice, setVoiceState] = useState<Voice>(() =>
    loadPref("article-tts:voice", "af_heart" as Voice),
  );
  const [speed, setSpeedState] = useState<number>(() => loadPref("article-tts:speed", 1));

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const ttsRef = useRef<KokoroTTS | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<number, AudioBuffer>>(new Map());
  const pendingSynthRef = useRef<Map<number, Promise<AudioBuffer>>>(new Map());
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const stopRequestedRef = useRef(false);

  const setVoice = useCallback((v: Voice) => {
    setVoiceState(v);
    savePref("article-tts:voice", v);
    bufferCacheRef.current.clear();
    pendingSynthRef.current.clear();
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    savePref("article-tts:speed", s);
    if (sourceRef.current) sourceRef.current.playbackRate.value = s;
  }, []);

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }

  const ensureModel = useCallback(async () => {
    if (ttsRef.current) return ttsRef.current;
    setModelStatus("loading");
    setError(null);
    try {
      const dev = device ?? (await detectDevice());
      setDevice(dev);
      const dtype: Dtype = dev === "webgpu" ? "fp32" : "q8";
      setProgressText(`Loading Kokoro model (${dev}, ${dtype})…`);
      const tts = await loadTTS(dev, dtype, (p: any) => {
        if (p.status === "progress" && p.file) {
          const pct = p.progress ? Math.round(p.progress) : 0;
          setProgressText(`Downloading ${p.file}: ${pct}%`);
        } else {
          setProgressText(p.status ?? "");
        }
      });
      ttsRef.current = tts;
      setModelStatus("ready");
      setProgressText("");
      return tts;
    } catch (err) {
      setModelStatus("error");
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [device]);

  const synthesizeParagraph = useCallback(
    async (index: number): Promise<AudioBuffer> => {
      const cached = bufferCacheRef.current.get(index);
      if (cached) return cached;

      const pending = pendingSynthRef.current.get(index);
      if (pending) return pending;

      const paragraph = paragraphs[index];
      if (!paragraph) throw new Error(`No paragraph at index ${index}`);

      const promise = (async () => {
        const tts = await ensureModel();
        const raw = await tts.generate(paragraph.text, { voice });
        const wav = raw.toWav();
        const ctx = getAudioCtx();
        const buffer = await ctx.decodeAudioData(wav);
        bufferCacheRef.current.set(index, buffer);
        pendingSynthRef.current.delete(index);
        return buffer;
      })();

      pendingSynthRef.current.set(index, promise);
      return promise;
    },
    [paragraphs, voice, ensureModel],
  );

  const prefetch = useCallback(
    (fromIndex: number) => {
      for (let i = fromIndex + 1; i <= fromIndex + PREFETCH_AHEAD; i++) {
        if (i < paragraphs.length) {
          synthesizeParagraph(i).catch(() => {
            /* surfaced when actually played */
          });
        }
      }
      // Drop far-behind buffers to bound memory.
      for (const key of bufferCacheRef.current.keys()) {
        if (key < fromIndex - 1 || key > fromIndex + PREFETCH_AHEAD) {
          bufferCacheRef.current.delete(key);
        }
      }
    },
    [paragraphs, synthesizeParagraph],
  );

  const stopSource = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current = null;
    }
  }, []);

  const playFrom = useCallback(
    async (index: number, offsetSeconds = 0) => {
      if (index < 0 || index >= paragraphs.length) return;
      stopRequestedRef.current = false;
      setError(null);
      setCurrentIndex(index);
      prefetch(index);

      let buffer: AudioBuffer;
      try {
        buffer = await synthesizeParagraph(index);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }
      if (stopRequestedRef.current) return;

      stopSource();
      const ctx = getAudioCtx();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.connect(ctx.destination);
      source.onended = () => {
        if (sourceRef.current !== source) return; // superseded
        sourceRef.current = null;
        if (stopRequestedRef.current) return;
        const next = index + 1;
        if (next < paragraphs.length) {
          playFrom(next);
        } else {
          setIsPlaying(false);
        }
      };

      sourceRef.current = source;
      pausedAtRef.current = offsetSeconds;
      startedAtRef.current = ctx.currentTime - offsetSeconds / speed;
      source.start(0, offsetSeconds);
      setIsPlaying(true);
    },
    [paragraphs.length, prefetch, synthesizeParagraph, speed, stopSource],
  );

  const play = useCallback(() => {
    if (currentIndex === null) {
      playFrom(0);
    } else if (!isPlaying) {
      playFrom(currentIndex, pausedAtRef.current);
    }
  }, [currentIndex, isPlaying, playFrom]);

  const pause = useCallback(() => {
    if (!sourceRef.current || currentIndex === null) return;
    const ctx = getAudioCtx();
    const elapsed = (ctx.currentTime - startedAtRef.current) * speed;
    pausedAtRef.current = Math.max(0, elapsed);
    stopRequestedRef.current = true;
    stopSource();
    setIsPlaying(false);
  }, [currentIndex, speed, stopSource]);

  const next = useCallback(() => {
    if (currentIndex === null) return;
    pausedAtRef.current = 0;
    playFrom(currentIndex + 1);
  }, [currentIndex, playFrom]);

  const prev = useCallback(() => {
    if (currentIndex === null) return;
    pausedAtRef.current = 0;
    playFrom(Math.max(0, currentIndex - 1));
  }, [currentIndex, playFrom]);

  const jumpTo = useCallback(
    (index: number) => {
      pausedAtRef.current = 0;
      playFrom(index);
    },
    [playFrom],
  );

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      stopSource();
      bufferCacheRef.current.clear();
      pendingSynthRef.current.clear();
      audioCtxRef.current?.close();
    };
  }, [stopSource]);

  return {
    modelStatus,
    progressText,
    error,
    device,
    voice,
    setVoice,
    speed,
    setSpeed,
    currentIndex,
    isPlaying,
    play,
    pause,
    next,
    prev,
    jumpTo,
    ensureModel,
  };
}
