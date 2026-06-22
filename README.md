# article-tts

Local, in-browser text-to-speech for articles. No backend — paste a URL or
text, and it reads the article aloud using [Kokoro TTS](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)
running entirely in your browser via [kokoro-js](https://www.npmjs.com/package/kokoro-js).

## Running it

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. The first time you click Play, the Kokoro
model downloads and is cached by the browser — see "Model size" below.

> If `npm run dev` fails with `ENOSPC: System limit for number of file
> watchers reached`, your OS's inotify limit is too low for Vite's dev-server
> watcher. Either raise it (`sysctl fs.inotify.max_user_watches`) or use
> `npm run build && npx serve dist` instead, which doesn't watch files.

## How it works

1. **Input** — paste a URL or raw article text.
2. **Extraction** — for a URL, the page HTML is fetched and run through
   Mozilla's [Readability.js](https://github.com/mozilla/readability) to pull
   out the article title and body paragraphs, stripping nav/ads/boilerplate.
   Pasted text is split into paragraphs on blank lines instead.
3. **Synthesis** — paragraphs are sent to Kokoro one at a time. The player
   keeps the current paragraph's audio plus a 2-paragraph lookahead buffer
   synthesized in the background, so playback starts fast and memory use
   stays bounded (older buffers are evicted as you move forward).
4. **Playback** — audio is decoded and played via the Web Audio API
   (`AudioBufferSourceNode`), which gives sample-accurate pause/resume and
   `playbackRate` control for the speed slider. When a paragraph finishes,
   the next one's buffer is already warm and starts immediately.
5. **Highlighting** — the currently-playing paragraph is highlighted and
   auto-scrolled into view; click any paragraph to jump playback there.

## WebGPU vs WASM

On load, the app checks `navigator.gpu` for a WebGPU adapter:

- **WebGPU available** → loads the model in `fp32` on the GPU. Fastest
  synthesis, but the full-precision weights are the largest download.
- **No WebGPU** → falls back to WASM (CPU) with `q8` (8-bit quantized)
  weights, trading some quality for a much smaller download and to keep
  CPU inference tractable.

This logic lives in `src/lib/tts.ts` (`detectDevice`, `loadTTS`). The dtype
choice is currently automatic based on device; if you want to force a
specific dtype/device, edit the call in `src/hooks/useArticlePlayer.ts`.

### Model size expectations

Kokoro-82M is roughly:

| dtype | approx. size |
|-------|-------------|
| fp32  | ~300 MB |
| fp16  | ~150 MB |
| q8    | ~80 MB |
| q4 / q4f16 | ~50 MB |

The model is downloaded once and cached by the browser (via the Transformers.js
cache), so subsequent loads are instant. The progress bar text shows live
download percentage per file while loading.

## CORS limitation

Browsers block JavaScript from fetching most third-party pages directly
(CORS). This means "From URL" will fail on many sites with a fetch/network
error. Two ways around it:

1. **Paste the article text directly** — switch to the "Paste text" tab and
   paste the article body. This always works since there's no network
   request involved.
2. **Configure a CORS proxy** — open the "CORS proxy (optional)" field under
   the URL input and supply a proxy URL, e.g. `https://corsproxy.io/?url={url}`.
   `{url}` is replaced with the encoded target URL; if you omit `{url}`, the
   encoded URL is appended to the end of the proxy URL instead. The proxy
   value is saved to `localStorage` so you only need to set it once.

Note: routing article URLs through a third-party proxy means that proxy can
see what you're reading. Use one you trust, or self-host a small proxy.

## Error handling

- **Model load failure** (e.g. browser blocks WebGPU/WASM, network failure
  mid-download) — surfaced as an error message in the player bar; you can
  retry by hitting Play again.
- **Fetch/CORS failure** — surfaced inline under the URL input with a hint to
  use a proxy or paste text instead.
- **Empty extraction** — if Readability can't find any paragraphs (e.g. a
  paywalled or JS-only page), the app says so rather than rendering a blank
  article.

## Project structure

```
src/
  lib/
    tts.ts        # Kokoro model loading, device/dtype detection, voice list
    extract.ts     # Readability extraction + plain-text paragraph splitting
  hooks/
    useArticlePlayer.ts  # paragraph queue, synthesis cache, Web Audio playback
  App.tsx          # input UI, article view, player controls
```

## Stack

Vite + React + TypeScript + Tailwind CSS v4 (via `@tailwindcss/vite`).
