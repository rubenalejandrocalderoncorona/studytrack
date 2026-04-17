# StudyTrack

Personal study tracker with AI exam generation and code challenges.
Runs as a **Docker stack** (Web UI) or a **native macOS app** (Tauri).

> For deeper technical detail — architecture, troubleshooting, internals — see [`docs/TECHNICAL.md`](docs/TECHNICAL.md).

---

## 1 — Set your API key (required for AI + Code features)

Check if it's already set:
```bash
echo $ANTHROPIC_API_KEY
```

If it prints your key — skip to step 2. If it's empty, set it permanently:
```bash
echo 'export ANTHROPIC_API_KEY=sk-ant-...' >> ~/.zshrc
source ~/.zshrc
```

Then create the `.env` file for the Docker stack:
```bash
cp .env.example .env
# open .env and set ANTHROPIC_API_KEY to the same value
```

**Web UI:** reads from `.env`.  
**macOS app:** reads from your shell — already set if you did the `~/.zshrc` step (or it was already there).

---

## 2 — Web UI (Docker)

**Requires:** Docker Desktop running.

```bash
make up-bg      # build + start everything  →  http://localhost:3333
make restart    # after editing any source file (faster than up-bg)
make down       # stop everything
make status     # check all services are green
make logs       # stream logs
```

> AI and Code features also need ChromaDB + Piston — both start automatically with `make up-bg`.

---

## 3 — macOS App (Tauri)

**Requires:** Docker Desktop running, Rust toolchain (`rustup`), Node.js 18+.

```bash
make macos-build   # compile .app + .dmg  (3–5 min first time)
make macos-open    # open the app (builds first if missing)
```

Inside the app, click **"Launch AI Services"** to start ChromaDB + Piston.  
Data is stored in `~/Library/Application Support/studytrack/`.

**Dev mode** (no recompile — edit files and refresh):
```bash
# Terminal 1
make macos-dev     # start Node server on port 3333

# Terminal 2
npx tauri dev      # open Tauri window
```

---

## Debugging make targets

```bash
make <target> --dry-run   # print commands without running them
make <target> -n          # same thing, shorthand
make status               # check which services are up
make logs-app             # stream app logs only
```

---

## Smoke tests

```bash
make test-api     # requires the stack to be running (make up-bg first)
```
