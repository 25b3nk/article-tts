import { useCallback, useEffect, useRef, useState } from "react";
import { extractFromHtml, type ExtractedArticle } from "../../../src/lib/extract";
import { VOICE_LIST } from "../../../src/lib/tts";
import { useArticlePlayer } from "../../../src/hooks/useArticlePlayer";

// Stable reference — see App.tsx for why this matters (React error #185).
const EMPTY_PARAGRAPHS: never[] = [];

function SidePanel() {
  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const paragraphs = article?.paragraphs ?? EMPTY_PARAGRAPHS;
  const player = useArticlePlayer(paragraphs);
  const paragraphRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());

  // Only one extraction run at a time.
  const extractingRef = useRef(false);

  // Hard size cap, enforced inside the page itself before any of the HTML
  // is serialized back to the panel. Auto-extracting on every tab
  // switch/page-load against arbitrary sites (huge SPA DOMs, infinite
  // scroll feeds) is what was hanging/crashing the tab — capping this and
  // dropping the automatic tab-switch/page-load triggers (see below) fixes
  // both the lag and the crash.
  const MAX_HTML_LENGTH = 3_000_000;

  const extractActiveTab = useCallback(async () => {
    if (extractingRef.current) return;
    extractingRef.current = true;
    setExtracting(true);
    setExtractError(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab found.");
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (maxLength: number) => {
          const html = document.documentElement.outerHTML;
          if (html.length > maxLength) {
            return { error: "This page is too large/complex to read automatically." };
          }
          return { html, url: location.href };
        },
        args: [MAX_HTML_LENGTH],
      });
      const result = results[0]?.result;
      if (!result) throw new Error("Couldn't read this page's content.");
      if ("error" in result) throw new Error(result.error);
      setArticle(extractFromHtml(result.html, result.url));
    } catch (err) {
      setExtractError(
        err instanceof Error
          ? err.message
          : "Couldn't read this page (it may be a restricted browser page).",
      );
    } finally {
      extractingRef.current = false;
      setExtracting(false);
    }
  }, []);

  useEffect(() => {
    extractActiveTab();
  }, [extractActiveTab]);

  useEffect(() => {
    if (player.currentIndex === null) return;
    paragraphRefs.current
      .get(player.currentIndex)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [player.currentIndex]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 text-sm">
      <div className="px-4 py-4 pb-32">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-semibold">Article TTS</h1>
          <button
            type="button"
            onClick={() => extractActiveTab()}
            disabled={extracting}
            className="rounded-md bg-slate-800 px-2.5 py-1 text-xs hover:bg-slate-700 disabled:opacity-50"
          >
            {extracting ? "Reading…" : "Re-read page"}
          </button>
        </div>

        {extractError && <p className="text-red-400 mb-4">{extractError}</p>}

        {!article && !extracting && !extractError && (
          <p className="text-slate-500">Open an article and click the extension icon.</p>
        )}

        {article && (
          <article>
            {article.title && <h2 className="text-base font-semibold mb-3">{article.title}</h2>}
            {paragraphs.length === 0 ? (
              <p className="text-slate-500">No readable paragraphs found on this page.</p>
            ) : (
              <div className="space-y-3 text-slate-300 leading-relaxed">
                {paragraphs.map((p) => (
                  <p
                    key={p.id}
                    ref={(el) => {
                      if (el) paragraphRefs.current.set(p.id, el);
                      else paragraphRefs.current.delete(p.id);
                    }}
                    onClick={() => player.jumpTo(p.id)}
                    className={`cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${
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
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur px-4 py-3 space-y-2">
          {player.modelStatus === "loading" && (
            <div className="rounded-md bg-indigo-950 border border-indigo-800 px-3 py-2 text-xs text-indigo-200">
              <span className="font-medium">Downloading speech model…</span>{" "}
              {player.progressText || "starting…"}
              <div className="mt-1 text-indigo-400">
                First run only — this is cached after it finishes.
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={player.prev}
              disabled={player.currentIndex === null || player.currentIndex === 0}
              className="rounded-md bg-slate-800 px-2.5 py-1.5 text-xs disabled:opacity-40"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={player.isPlaying ? player.pause : player.play}
              disabled={player.modelStatus === "loading"}
              className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium hover:bg-indigo-500 disabled:opacity-60"
            >
              {player.modelStatus === "loading"
                ? "Loading model…"
                : player.isPlaying
                  ? "⏸ Pause"
                  : "▶ Play"}
            </button>
            <button
              type="button"
              onClick={player.next}
              disabled={
                player.currentIndex === null || player.currentIndex >= paragraphs.length - 1
              }
              className="rounded-md bg-slate-800 px-2.5 py-1.5 text-xs disabled:opacity-40"
            >
              ⏭
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <label className="flex items-center gap-1">
              Speed
              <select
                value={player.speed}
                onChange={(e) => player.setSpeed(Number(e.target.value))}
                className="rounded-md bg-slate-800 px-1.5 py-0.5 text-slate-100"
              >
                {[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              Voice
              <select
                value={player.voice}
                onChange={(e) => player.setVoice(e.target.value as any)}
                className="rounded-md bg-slate-800 px-1.5 py-0.5 text-slate-100"
              >
                {VOICE_LIST.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <span className="truncate">
              {player.modelStatus === "loading" && player.progressText}
              {player.modelStatus === "ready" && player.device && `· ${player.device}`}
              {player.error && <span className="text-red-400">{player.error}</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SidePanel;
