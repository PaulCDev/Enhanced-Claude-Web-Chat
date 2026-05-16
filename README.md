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

## Verifying it runs locally

This extension is designed to be easy to audit. If you're concerned about privacy,
you can confirm for yourself that it sends nothing to third parties:

1. **Read the source.** It's three unminified files — `content.js` (~250 lines),
   `manifest.json`, and `styles.css`. There is no build step and no bundled
   dependencies, so the code in this repo is exactly what runs in your browser.

2. **Check the manifest.** `manifest.json` declares no `permissions` and no
   `host_permissions`, and only runs on `https://claude.ai/*`. Your browser's
   extension details page will also show that its only access is to `claude.ai`.

3. **Watch the Network tab (the definitive check).** Open claude.ai, open DevTools
   (F12) → **Network** tab, then reload the page and use the extension. Every
   request it makes goes to `claude.ai` itself — you will not see requests to any
   other domain. The only API calls it makes are to claude.ai's own endpoints
   (`/api/organizations` and `/api/.../chat_conversations`).

4. **It can't silently update.** Because you load it unpacked from this repo, it
   has no auto-update channel. The code you reviewed is the code that keeps running
   until you manually pull changes.

### What it accesses, and where that data goes

The extension reads your chat list (chat names, summaries, and project names) via
claude.ai's own API, using your existing logged-in session. This is used purely to
draw the colored project chips in the sidebar. That data:

- never leaves your browser — it is held in memory and logged to the DevTools
  console for inspection;
- is not sent to the extension's author or any third party;
- the only thing persisted is your sidebar width and a per-project color map, stored
  in `localStorage` on claude.ai (`cwt.sidebarWidth`, `cwt.projectHues`).

No credentials, cookies, or message contents are collected, stored, or transmitted.

## Files

| File | Purpose |
|------|---------|
| [`extension/manifest.json`](extension/manifest.json) | Manifest V3 definition |
| [`extension/content.js`](extension/content.js) | Content script (resize handle + project chips) |
| [`extension/styles.css`](extension/styles.css) | Styles for the injected elements |

## Caveats

claude.ai's markup and API are not public and may change at any time, which can break this extension. It is provided as-is, with no guarantee of continued compatibility.
