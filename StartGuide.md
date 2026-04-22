# StudyTrack — Start Guide

Personal study tracker with AI exam generation and code challenges.

---

## 1 — Configure your AI credentials (required for AI + Code features)

Open `.env` in the project root and set your credentials. Two options:

**Option A — Direct Anthropic API key**
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
# leave ANTHROPIC_BASE_URL unset
```
Get a key at https://console.anthropic.com/settings/keys

**Option B — AI API Proxy**
```
ANTHROPIC_API_KEY=your-proxy-key
ANTHROPIC_BASE_URL=http://localhost:6655/anthropic
```
The `ANTHROPIC_BASE_URL` must be the base path the proxy expects **before** `/v1/messages`.
For example if your proxy serves `http://localhost:6655/anthropic/v1/messages`, set the URL to `http://localhost:6655/anthropic`.

> `.env` is gitignored — never commit real keys. The server loads it automatically on every `make app` or `make web`.

---

## 2 — Start the app

**macOS app (Tauri window):**
```bash
make app
```
Starts Docker (if not running), launches ChromaDB + Piston, starts the Node server, then opens the native app window.

**Web UI (browser):**
```bash
make web
```
Same as above but opens `http://localhost:3333` in your browser instead.

---

## 3 — Stop / Restart

```bash
make stop              # kill server + stop ChromaDB + Piston
make restart           # stop then restart web UI
make restart MODE=app  # stop then restart macOS app
```

---

## 4 — After editing credentials

If you change `.env`, restart the server so it picks up the new values:
```bash
make restart           # web UI
make restart MODE=app  # macOS app
```

---

## 5 — Build a distributable macOS app

```bash
make macos-build   # compiles .app + .dmg (3–5 min first time)
```

Output: `src-tauri/target/release/bundle/macos/StudyTrack.app`

---

## Smoke tests

```bash
make test-api   # requires the server to be running (make app or make web first)
```

> For architecture, internals, and troubleshooting see [`docs/TECHNICAL.md`](docs/TECHNICAL.md).
