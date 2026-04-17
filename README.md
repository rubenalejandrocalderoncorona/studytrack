# StudyTrack

Personal study tracker with AI exam generation and code challenges.
Runs as a **Docker stack** (Linux / Web) or a **native macOS app** (Tauri).

---

## Debugging make targets

```bash
make <target> --dry-run   # print commands without running
make <target> -n          # same thing, shorthand
```

For verbose shell output, prefix any recipe manually:
```bash
make logs-app             # to see what docker compose command runs — use --dry-run first
```

---

## Web UI (Docker — Linux / macOS)

**Prerequisites:** Docker Desktop running.

```bash
# First time or after code changes
make up-bg        # builds images + starts everything in background
                  # opens → http://localhost:3333

# Day-to-day
make restart      # restart app only after editing server.js / routes / public/
make logs         # stream logs from all containers
make logs-app     # stream app logs only
make status       # check all three services are green
make down         # stop everything
```

**After editing any file inside `public/` or `routes/`**, `make restart` is enough.  
**After editing `server.js` or `package.json`**, run `make up-bg` to rebuild the image.

---

## macOS App (Tauri)

**Prerequisites:** Docker Desktop running, Rust toolchain (`rustup`), Node.js 18+.

```bash
# Build the .app + .dmg  (takes ~3–5 min first time)
make macos-build

# Open the app  (builds automatically if the bundle doesn't exist)
make macos-open
```

The app stores data in `~/Library/Application Support/studytrack/`.  
AI + Code features require clicking **"Launch AI Services"** in the app — it starts ChromaDB and Piston as Docker containers.

**Rebuilding after code changes:**
```bash
make macos-build   # re-compiles sidecar + Rust shell
make macos-open    # opens the updated bundle
```

**Dev mode** (faster iteration — no recompile):
```bash
# Terminal 1
make macos-dev          # starts node server.js on port 3333

# Terminal 2
npx tauri dev           # opens Tauri window pointing at localhost:3333
```

---

## AI Key Setup

Copy `.env.example` to `.env` and fill in your key:

```bash
cp .env.example .env
# edit .env — set ANTHROPIC_API_KEY and optionally ANTHROPIC_BASE_URL
```

The Docker stack picks this up automatically. The macOS app reads it from your shell environment — export it before launching.

---

## Smoke tests

```bash
make test-api     # requires the stack to be running (make up-bg first)
```

---

## File structure

```
studytrack/
├── server.js                    # Express API + static server
├── routes/
│   ├── exams.js                 # AI exam generation + grading
│   ├── sandbox.js               # Code execution (Piston)
│   └── sync.js                  # RAG document sync
├── services/
│   ├── ai.service.js            # Anthropic SDK wrapper
│   ├── rag.service.js           # ChromaDB vector store
│   └── sandbox.service.js       # Piston HTTP client
├── public/
│   ├── index.html
│   ├── app.js                   # Vanilla JS SPA
│   └── style.css
├── src-tauri/                   # macOS Tauri v2 shell
│   ├── src/main.rs              # Rust: sidecar spawn, tray, Docker mgmt
│   └── tauri.conf.json
├── docker-compose.yml           # Full stack (app + ChromaDB + Piston)
├── docker-compose.services.yml  # ChromaDB + Piston only (used by macOS app)
├── Makefile
├── .env.example
└── data/                        # git-ignored — progress.json, exams.json
```
