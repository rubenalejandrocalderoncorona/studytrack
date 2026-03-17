# StudyTrack

A local study plan tracker that runs in a Docker container. Dark-themed, editorial UI — tracks study objectives broken into phases, weeks, and individual tasks with per-task checkboxes and persistent progress.

![StudyTrack](https://img.shields.io/badge/status-active-brightgreen) ![Node](https://img.shields.io/badge/node-20--alpine-blue) ![Docker](https://img.shields.io/badge/docker-compose-blue)

---

## Features

- **Multiple study objectives** — each with title, exam date, accent color, and description
- **Hierarchical plan** — Phases → Weeks → Days → Tasks
- **Per-task checkboxes** — progress persists to a local JSON file
- **Progress bars** — overall and per-phase
- **Inline editing** — click any task text or type tag to edit in place
- **Notes** — attach notes to individual tasks
- **JSON editor** — edit the full objective structure as raw JSON
- **Export** — download any objective as a JSON file
- **Custom task types** — add your own tag categories beyond the built-ins
- **Overdue indicators** — past days with incomplete tasks are flagged
- **Auto-start on boot** — via Docker `restart: always`

---

## Requirements

| Tool | Version |
|------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 4.x+ |
| Docker Compose | v2 (bundled with Docker Desktop) |

No Node.js installation required on the host — everything runs inside the container.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/rubenalejandrocalderoncorona/studytrack.git
cd studytrack

# 2. Build and start (detached)
docker compose up -d --build

# 3. Open in browser
open http://localhost:3333
```

The app seeds itself with a pre-loaded **GCP Professional ML Engineer** study plan on first run.

---

## Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d --build` | Build image and start container in background |
| `docker compose up -d` | Start existing container (no rebuild) |
| `docker compose down` | Stop and remove container |
| `docker compose logs -f` | Stream container logs |
| `docker compose ps` | Check container status |

---

## Auto-Start on Boot

The container uses `restart: always` in `docker-compose.yml`, which means it restarts automatically whenever Docker is running.

**To make it start on login (macOS / Windows):**

1. Open **Docker Desktop**
2. Go to **Settings → General**
3. Enable **"Start Docker Desktop when you log in"**

That's it — Docker starts on login, and the container starts with Docker.

---

## Data Persistence

All progress is stored in `./data/progress.json`, which is mounted as a Docker volume:

```yaml
volumes:
  - ./data:/app/data
```

This file survives container restarts and rebuilds. **Do not delete `./data/progress.json`** unless you want to reset all progress.

The `data/` directory is git-ignored so your personal study progress is never committed.

---

## File Structure

```
studytrack/
├── docker-compose.yml      # Container orchestration
├── Dockerfile              # Node 20 Alpine image
├── server.js               # Express API + static file server
├── version.json            # App version metadata
├── package.json
├── README.md
├── data/
│   └── progress.json       # ← persisted progress (git-ignored)
└── public/
    ├── index.html          # Single-page app shell
    ├── style.css           # Dark theme styles
    └── app.js              # Frontend logic (vanilla JS)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/progress` | Full app state (objectives + checked + notes) |
| `POST` | `/api/progress` | Toggle a task checkbox `{ taskId, checked }` |
| `POST` | `/api/objectives` | Create a new objective |
| `PUT` | `/api/objectives/:id` | Update an objective (full replace) |
| `DELETE` | `/api/objectives/:id` | Delete an objective |
| `POST` | `/api/notes` | Save a task note `{ taskId, note }` |
| `POST` | `/api/custom-types` | Save custom task type list |
| `GET` | `/api/version` | App version info |
| `GET` | `/api/export` | Download full `progress.json` |

---

## Customizing the Seed Data

Edit `server.js` and modify the `DEFAULT_DATA` object at the top of the file. The seed only runs when `./data/progress.json` does not exist yet.

To reset and re-seed:

```bash
rm data/progress.json
docker compose restart
```

---

## Development (without Docker)

```bash
# Install dependencies
npm install

# Start server directly
node server.js

# Open http://localhost:3333
```

Requires Node.js 18+.

---

## Updating the App Version

Edit `version.json`:

```json
{
  "version": "1.0.0",
  "build": "1.0.0",
  "updated": "2026-03-16",
  "changelog": [
    { "version": "1.0.0", "date": "2026-03-16", "notes": "Initial release." }
  ]
}
```

Then rebuild: `docker compose up -d --build`

---

## License

MIT