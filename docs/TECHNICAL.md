# StudyTrack — Technical Reference

---

## Architecture overview

```
┌─────────────────────────────────────────────┐
│  Web UI  (Docker)          macOS App (Tauri) │
│                                              │
│  docker-compose.yml        StudyTrack.app    │
│   ├─ studytrack (Node)      ├─ Rust shell    │
│   ├─ chromadb               ├─ sidecar (pkg) │
│   └─ piston                 └─ docker-compose│
│                                 .services.yml│
└─────────────────────────────────────────────┘
         │                         │
         └──── Express API ────────┘
                localhost:3333
```

**Web UI:** Docker Compose runs all three services. `.env` is read by Docker.  
**macOS App:** Tauri spawns a `pkg`-bundled Node binary (the sidecar). ChromaDB + Piston are started on demand via the "Launch AI Services" button.

---

## Environment variables

| Variable | Where to set | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | `.env` (Docker) / shell export (macOS app) | AI exam + code generation |
| `ANTHROPIC_BASE_URL` | `.env` (Docker) / shell export (macOS app) | Override API endpoint (proxy) |
| `DATA_DIR` | Set by Tauri at runtime | Data storage path for macOS app |
| `MANAGE_SERVICES` | Set by Tauri at runtime | Enables `/api/services/start+stop` |
| `SERVICES_COMPOSE_FILE` | Set by Tauri at runtime | Path to bundled `docker-compose.services.yml` |

### Docker notes
- Inside Docker, use `host.docker.internal` instead of `localhost` for any host services.
- Example proxy URL: `ANTHROPIC_BASE_URL=http://host.docker.internal:6655`
- The `Makefile` runs `unexport ANTHROPIC_API_KEY` and `unexport ANTHROPIC_BASE_URL` to prevent your shell's Claude Code proxy from leaking into the Docker container.

### macOS app notes
- The app reads `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` from the **shell environment at launch time** — not from `.env`.
- To make the key permanent, add `export ANTHROPIC_API_KEY=sk-ant-...` to `~/.zshrc`, then restart the terminal before `make macos-open`.
- Data directory: `~/Library/Application Support/studytrack/` (progress.json, exams.json, vector_data/).

---

## Services: ChromaDB + Piston

| Service | Port | Purpose |
|---|---|---|
| ChromaDB | 8000 | Vector store for RAG context |
| Piston | 2000 | Sandboxed code execution |

**Web UI:** both start with `make up-bg`.  
**macOS App:** click **"Launch AI Services"** in the app, or run manually:
```bash
docker compose -f docker-compose.services.yml up -d
docker compose -f docker-compose.services.yml down   # stop
```

The app runs `docker compose down` automatically on quit.

---

## macOS App internals

### Sidecar binary
`server.js` is compiled into a self-contained binary by `pkg`:
```bash
npm run build:sidecar
# → src-tauri/binaries/studytrack-server-aarch64-apple-darwin
```
The binary is bundled inside `StudyTrack.app/Contents/MacOS/`.

### Build pipeline
```
make macos-build
  └─ npx tauri build
       ├─ beforeBuildCommand: bash scripts/build-sidecar.sh
       │    ├─ npm run build:sidecar  (pkg → binary)
       │    └─ cp docker-compose.services.yml src-tauri/
       └─ cargo build --release
            └─ bundles StudyTrack.app + StudyTrack.dmg
```

### Unsigned binary / Gatekeeper
The app is not code-signed. If macOS blocks it:
```bash
xattr -dr com.apple.quarantine src-tauri/target/release/bundle/macos/StudyTrack.app
```
`make macos-open` runs this automatically.

### Dev mode vs production
| | Dev (`make macos-dev` + `npx tauri dev`) | Production (`make macos-build`) |
|---|---|---|
| Server | `node server.js` (live, your machine) | `pkg` sidecar binary inside `.app` |
| Data dir | `./data/` (repo local) | `~/Library/Application Support/studytrack/` |
| API key | from shell env | from shell env (same) |
| Rebuild needed | No — edit files and refresh | Yes — `make macos-build` |

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
│   ├── tauri.conf.json
│   └── Cargo.toml
├── scripts/
│   └── build-sidecar.sh         # pkg build helper
├── docker-compose.yml           # Full stack (app + ChromaDB + Piston)
├── docker-compose.services.yml  # ChromaDB + Piston only (macOS app)
├── Makefile
├── .env.example
└── data/                        # git-ignored — progress.json, exams.json
```

---

## Troubleshooting

### `EADDRINUSE: address already in use :::3333`
Something else is already on port 3333. Kill it first:
```bash
lsof -ti :3333 | xargs kill -9
```
Common causes:
- A previous `node server.js` left running in another terminal
- The macOS app sidecar didn't exit cleanly (quit from the menu bar, not force-kill)
- Docker stack is still up (`make down` stops it)

`make macos-dev` runs the kill automatically.

### AI dot is gray / "configure ANTHROPIC_API_KEY"
- **Docker:** check `.env` has `ANTHROPIC_API_KEY=sk-ant-...`, then `make restart`
- **macOS app:** `echo $ANTHROPIC_API_KEY` in your terminal — if empty, `export ANTHROPIC_API_KEY=sk-ant-...` then relaunch with `make macos-open`

### Chroma / Piston dot is gray
- **Docker:** `make status` — if containers are down, `make up-bg`
- **macOS app:** click **"Launch AI Services"** in the app. Requires Docker Desktop to be running.

### `git pull` — no tracking information
The local branch isn't linked to the remote. Fix once:
```bash
git branch --set-upstream-to=origin/main main
```

### `cargo tauri build` fails — sidecar binary not found
The `pkg` build must run before `cargo build`. Run the full pipeline:
```bash
make macos-build
```
Or manually: `bash scripts/build-sidecar.sh` then `npx tauri build`.
