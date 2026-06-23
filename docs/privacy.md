# Article TTS — Privacy Policy

Last updated: 2026-06-23

## What this extension does

Article TTS reads the article you're currently viewing aloud using a local neural text-to-speech model. The article content never leaves your browser.

## What data this extension collects

**None.** Article TTS does not collect, store, transmit, or sell any personal information, browsing history, or article content.

## How the extension works

1. When you click the extension's toolbar icon while viewing an article, the extension reads the current page's HTML content (via the standard browser `chrome.scripting.executeScript` API) so that it can extract the article text using Mozilla's Readability library.
2. The extracted article text is processed entirely in your browser. It is never sent to any remote server.
3. The extension loads a neural text-to-speech model (Kokoro 82M, open-source, Apache 2.0 licensed). The model is downloaded once from the Hugging Face model hub (cdn-lfs.huggingface.co) and cached by your browser. This is a data file download, not code execution.
4. The model runs entirely in your browser via WebGPU or WebAssembly. Synthesized audio is played through your browser's standard Web Audio API and is never stored or transmitted.

## Permissions

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | To read the content of the article you actively chose to read aloud |
| `sidePanel` | To display the player UI |
| `http://*/*`, `https://*/*` | To run Readability.js on any site you choose to read aloud. The extension does not initiate network requests to these hosts. |

The extension does not run in the background, does not auto-scan tabs, and does not initiate any network requests when you are not actively using it.

## Third-party services

- **Hugging Face Model Hub** (`huggingface.co`) — the only network destination the extension contacts. Used solely for downloading the open-source Kokoro text-to-speech model weights on first run, and only after you click the extension icon.

## Changes to this policy

If we update this policy, we will post the changes here and bump the "Last updated" date above. Material changes will be noted in the extension's release notes on the Chrome Web Store listing.

## Contact

Questions or concerns: open an issue at https://github.com/25b3nk/article-tts/issues