import { useState } from "react";
import {
  extractFromHtml,
  extractFromPlainText,
  fetchArticleHtml,
  type ExtractedArticle,
} from "./lib/extract";

type Mode = "url" | "text";

function App() {
  const [mode, setMode] = useState<Mode>("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [proxyUrl, setProxyUrl] = useState(
    () => localStorage.getItem("article-tts:proxyUrl") ?? "",
  );
  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function saveProxyUrl(value: string) {
    setProxyUrl(value);
    localStorage.setItem("article-tts:proxyUrl", value);
  }

  async function handleLoadArticle() {
    setError(null);
    setArticle(null);
    setLoading(true);
    try {
      if (mode === "url") {
        if (!urlInput.trim()) throw new Error("Enter a URL first.");
        const html = await fetchArticleHtml(urlInput.trim(), proxyUrl.trim() || null);
        const result = extractFromHtml(html, urlInput.trim());
        setArticle(result);
      } else {
        if (!textInput.trim()) throw new Error("Paste some article text first.");
        setArticle(extractFromPlainText(textInput));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        mode === "url"
          ? `${message} — many sites block cross-origin fetches (CORS). Try a CORS proxy URL below, or paste the article text instead.`
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
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
          disabled={loading}
          className="mt-4 rounded-md bg-indigo-600 px-5 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Extracting…" : "Load article"}
        </button>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {article && (
          <article className="mt-10 border-t border-slate-800 pt-6">
            {article.title && (
              <h2 className="text-xl font-semibold mb-4">{article.title}</h2>
            )}
            {article.paragraphs.length === 0 ? (
              <p className="text-sm text-slate-500">
                No readable paragraphs were extracted.
              </p>
            ) : (
              <div className="space-y-4 text-slate-300 leading-relaxed">
                {article.paragraphs.map((p) => (
                  <p key={p.id} data-paragraph-id={p.id}>
                    {p.text}
                  </p>
                ))}
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}

export default App;
