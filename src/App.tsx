import { useRef, useState } from "react";
import { detectDevice, loadTTS, type Device, type Dtype } from "./lib/tts";

const HARDCODED_SENTENCE =
  "The quick brown fox jumps over the lazy dog, proving that local text to speech works entirely in your browser.";

type Status = "idle" | "loading" | "ready" | "synthesizing" | "error";

function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  async function handleSpeak() {
    setError(null);
    try {
      setStatus("loading");
      const dev = device ?? (await detectDevice());
      setDevice(dev);
      const dtype: Dtype = dev === "webgpu" ? "fp32" : "q8";
      setProgressText(`Loading Kokoro model (${dev}, ${dtype})…`);

      const tts = await loadTTS(dev, dtype, (p) => {
        if (p.status === "progress" && p.file) {
          const pct = p.progress ? Math.round(p.progress) : 0;
          setProgressText(`Downloading ${p.file}: ${pct}%`);
        } else {
          setProgressText(p.status);
        }
      });

      setStatus("synthesizing");
      setProgressText("Synthesizing speech…");
      const audio = await tts.generate(HARDCODED_SENTENCE, { voice: "af_heart" });

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const blob = audio.toBlob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      setStatus("ready");
      setProgressText("");
      requestAnimationFrame(() => audioRef.current?.play());
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-950 text-slate-100 p-8">
      <h1 className="text-2xl font-semibold">article-tts — Stage 1</h1>
      <p className="max-w-md text-center text-slate-400 text-sm">
        {HARDCODED_SENTENCE}
      </p>

      <button
        type="button"
        onClick={handleSpeak}
        disabled={status === "loading" || status === "synthesizing"}
        className="rounded-md bg-indigo-600 px-5 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-50"
      >
        {status === "idle" || status === "ready" || status === "error"
          ? "Speak"
          : "Working…"}
      </button>

      {progressText && <p className="text-sm text-slate-400">{progressText}</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}
      {device && <p className="text-xs text-slate-500">Device: {device}</p>}

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} controls className="w-80" />
      )}
    </div>
  );
}

export default App;
