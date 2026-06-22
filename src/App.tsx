import { useEffect, useRef, useState } from "react";
import {
  extractFromHtml,
  extractFromPlainText,
  fetchArticleHtml,
  type ExtractedArticle,
} from "./lib/extract";
import { VOICE_LIST } from "./lib/tts";
import { useArticlePlayer } from "./hooks/useArticlePlayer";

type Mode = "url" | "text";

function App() {
  const [mode, setMode] = useState<Mode>("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [proxyUrl, setProxyUrl] = useState(
    () => localStorage.getItem("article-tts:proxyUrl") ?? "",
  );
  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const paragraphs = article?.paragraphs ?? [];
  const player = useArticlePlayer(paragraphs);
  const paragraphRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());

  useEffect(() => {
    if (player.currentIndex === null) return;
    paragraphRefs.current
      .get(player.currentIndex)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [player.currentIndex]);

  function saveProxyUrl(value: string) {
    setProxyUrl(value);
    localStorage.setItem("article-tts:proxyUrl", value);
  }

  async function handleLoadArticle() {
    setExtractError(null);
    setArticle(null);
    setExtracting(true);
    try {
      if (mode === "url") {
        if (!urlInput.trim()) throw new Error("Enter a URL first.");
        const html = await fetchArticleHtml(urlInput.trim(), proxyUrl.trim() || null);
        setArticle(extractFromHtml(html, urlInput.trim()));
      } else {
        if (!textInput.trim()) throw new Error("Paste some article text first.");
        setArticle(extractFromPlainText(textInput));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExtractError(
        mode === "url"
          ? `${message} — many sites block cross-origin fetches (CORS). Try a CORS proxy URL below, or paste the article text instead.`
          : message,
      );
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-10 pb-40">
        <h1 className="text-2xl font-semibold mb-6">article-tts</h1>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              mode === "url" ? "bg-indigo-600" : "bg-slate-800 text-slate-400"
            }`}
          >
            From URL
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              mode === "text" ? "bg-indigo-600" : "bg-slate-800 text-slate-400"
            }`}
          >
            Paste text
          </button>
        </div>

        {mode === "url" ? (
          <div className="space-y-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            />
            <details className="text-sm text-slate-400">
              <summary className="cursor-pointer">CORS proxy (optional)</summary>
              <input
                type="text"
                value={proxyUrl}
                onChange={(e) => saveProxyUrl(e.target.value)}
                placeholder="https://corsproxy.io/?url={url}"
                className="mt-2 w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Use <code>{"{url}"}</code> as a placeholder, or leave it to append the
                encoded URL at the end. Most sites block direct cross-origin fetches;
                a proxy or pasting the text directly works around this.
              </p>
            </details>
          </div>
        ) : (
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste article text here…"
            rows={10}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          />
        )}

        <button
          type="button"
          onClick={handleLoadArticle}
          disabled={extracting}
          className="mt-4 rounded-md bg-indigo-600 px-5 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {extracting ? "Extracting…" : "Load article"}
        </button>

        {extractError && <p className="mt-4 text-sm text-red-400">{extractError}</p>}

        {article && (
          <article className="mt-10 border-t border-slate-800 pt-6">
            {article.title && (
              <h2 className="text-xl font-semibold mb-4">{article.title}</h2>
            )}
            {paragraphs.length === 0 ? (
              <p className="text-sm text-slate-500">
                No readable paragraphs were extracted.
              </p>
            ) : (
              <div className="space-y-4 text-slate-300 leading-relaxed">
                {paragraphs.map((p) => (
                  <p
                    key={p.id}
                    ref={(el) => {
                      if (el) paragraphRefs.current.set(p.id, el);
                      else paragraphRefs.current.delete(p.id);
                    }}
                    onClick={() => player.jumpTo(p.id)}
                    className={`cursor-pointer rounded-md px-2 py-1 transition-colors ${
                      player.currentIndex === p.id
                        ? "bg-indigo-500/20 text-indigo-100"
                        : "hover:bg-slate-800/50"
                    }`}
                  >
                    {p.text}
                  </p>
                ))}
              </div>
            )}
          </article>
        )}
      </div>

      {paragraphs.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur px-6 py-4">
          <div className="mx-auto max-w-3xl flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={player.prev}
              disabled={player.currentIndex === null || player.currentIndex === 0}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm disabled:opacity-40"
            >
              ⏮ Prev
            </button>
            <button
              type="button"
              onClick={player.isPlaying ? player.pause : player.play}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              {player.isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              type="button"
              onClick={player.next}
              disabled={
                player.currentIndex === null ||
                player.currentIndex >= paragraphs.length - 1
              }
              className="rounded-md bg-slate-800 px-3 py-2 text-sm disabled:opacity-40"
            >
              Next ⏭
            </button>

            <label className="flex items-center gap-2 text-sm text-slate-400">
              Speed
              <select
                value={player.speed}
                onChange={(e) => player.setSpeed(Number(e.target.value))}
                className="rounded-md bg-slate-800 px-2 py-1 text-slate-100"
              >
                {[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-400">
              Voice
              <select
                value={player.voice}
                onChange={(e) => player.setVoice(e.target.value as any)}
                className="rounded-md bg-slate-800 px-2 py-1 text-slate-100"
              >
                {VOICE_LIST.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-xs text-slate-500">
              {player.modelStatus === "loading" && player.progressText}
              {player.modelStatus === "ready" && player.device && `device: ${player.device}`}
              {player.error && (
                <span className="text-red-400">{player.error}</span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
