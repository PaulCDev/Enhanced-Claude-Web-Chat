# Claude Web Tweaks

A small Chrome/Edge extension that adds quality-of-life tweaks to the [claude.ai](https://claude.ai) web interface.

> **Disclaimer:** This is an unofficial, third-party browser extension for claude.ai. It is **not affiliated with, endorsed by, or supported by Anthropic** in any way. "Claude" and "claude.ai" are properties of Anthropic. Use at your own risk.

## Features

- **Resizable sidebar** — adds a drag handle to the right edge of the sidebar. Drag to resize; double-click to reset to the default width. Your chosen width is saved across sessions.
- **Project chips** — tags each chat in the sidebar with a colored chip showing which project it belongs to. Each project gets a stable, distinct color.

## Installation

This extension is not published to any store. Load it unpacked:

1. Clone or download this repository.
2. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the [`extension/`](extension/) folder.
5. Open or reload [claude.ai](https://claude.ai).

## How it works

The extension runs a single content script on `https://claude.ai/*`:

- It locates the sidebar `<nav>`, injects a resize handle, and persists the width in `localStorage` (`cwt.sidebarWidth`).
- It fetches your chat conversations via claude.ai's own API (`/api/organizations/.../chat_conversations`) to map each chat to its project, then renders the project chips. This uses your existing logged-in session — no credentials are collected, stored, or sent anywhere.

A `MutationObserver` re-applies the tweaks as claude.ai re-renders its UI.

## Permissions & privacy

The extension only runs on `claude.ai`. It makes requests to claude.ai's own API using your existing session cookies and does not transmit any data to third parties.

## Files

| File | Purpose |
|------|---------|
| [`extension/manifest.json`](extension/manifest.json) | Manifest V3 definition |
| [`extension/content.js`](extension/content.js) | Content script (resize handle + project chips) |
| [`extension/styles.css`](extension/styles.css) | Styles for the injected elements |

## Caveats

claude.ai's markup and API are not public and may change at any time, which can break this extension. It is provided as-is, with no guarantee of continued compatibility.
