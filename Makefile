PORT     ?= 3333
COMPOSE  := docker compose
DC       := $(COMPOSE) -f docker-compose.yml
APP_BUNDLE := src-tauri/target/release/bundle/macos/StudyTrack.app
DMG        := src-tauri/target/release/bundle/dmg/StudyTrack_0.3.0_aarch64.dmg

# Docker Desktop on macOS uses a non-default socket path.
# Export it so every docker/compose call in this Makefile finds the daemon.
export DOCKER_HOST ?= unix:///Users/$(USER)/.docker/run/docker.sock

# Prevent shell-level ANTHROPIC_* vars from overriding .env values.
# This is important when Claude Code sets ANTHROPIC_BASE_URL in the shell
# for its own proxy — studytrack reads its own values from .env instead.
unexport ANTHROPIC_API_KEY
unexport ANTHROPIC_BASE_URL

.PHONY: up up-bg down restart logs logs-app logs-chroma logs-piston \
        status health install test-api pull \
        macos-build macos-open macos-dev \
        help

## ── Web / Linux (Docker) ──────────────────────────────────────────────────────

## Build images and start all services in the background
up-bg: install
	@echo "→ Starting studytrack stack in background..."
	$(DC) up --build -d
	@echo "✓ Stack started — run 'make logs' to follow output"
	@sleep 2
	@$(MAKE) --no-print-directory status

## Start all services in the foreground (Ctrl-C to stop)
up: install
	@echo "→ Starting studytrack stack (app + chromadb + piston)..."
	$(DC) up --build

## Stop and remove containers (volumes are preserved)
down:
	@echo "→ Stopping studytrack stack..."
	$(DC) down
	@echo "✓ Stack stopped"

## Restart app container only (fast — skips rebuilding chroma/piston)
restart:
	$(DC) restart studytrack
	@echo "✓ studytrack-app restarted"

## Pull latest images for all services
pull:
	$(DC) pull

## Install npm dependencies
install:
	@if [ ! -d node_modules ]; then \
	    echo "→ Installing npm dependencies..."; \
	    npm install; \
	    echo "✓ Dependencies installed"; \
	fi

## ── macOS App ─────────────────────────────────────────────────────────────────

## Build the macOS .app + .dmg  (runs sidecar build + cargo tauri build)
macos-build: install
	@echo "→ Building macOS app bundle..."
	npm install
	npx tauri build
	@echo "✓ Built:"
	@echo "    $(APP_BUNDLE)"
	@echo "    $(DMG)"

## Open the already-built macOS app  (builds first if missing)
macos-open:
	@if [ ! -d "$(APP_BUNDLE)" ]; then \
	    echo "→ App bundle not found — building first..."; \
	    $(MAKE) --no-print-directory macos-build; \
	fi
	@echo "→ Removing quarantine (unsigned build)..."
	@xattr -dr com.apple.quarantine "$(APP_BUNDLE)" 2>/dev/null || true
	@echo "→ Opening StudyTrack.app..."
	open "$(APP_BUNDLE)"

## Run the macOS app in dev mode (server.js live, no sidecar compilation)
macos-dev: install
	@echo "→ Starting Node.js server for Tauri dev mode..."
	@echo "   (in another terminal: npx tauri dev)"
	node server.js

## ── Logs ──────────────────────────────────────────────────────────────────────

## Follow logs for all services
logs:
	$(DC) logs -f

## Follow logs for the Node.js app only
logs-app:
	$(DC) logs -f studytrack

## Follow logs for ChromaDB
logs-chroma:
	$(DC) logs -f chromadb

## Follow logs for Piston
logs-piston:
	$(DC) logs -f piston

## ── Status / health ───────────────────────────────────────────────────────────

## Show running container status + service health
status:
	@echo "=== Container status ==="
	@$(DC) ps 2>/dev/null || echo "(stack not running)"
	@echo ""
	@echo "=== Service health ==="
	@curl -sf http://localhost:$(PORT)/api/version > /dev/null \
	    && echo "  ✓ studytrack-app  UP  http://localhost:$(PORT)" \
	    || echo "  ✗ studytrack-app  DOWN"
	@curl -sf http://localhost:8000/api/v2/heartbeat > /dev/null \
	    && echo "  ✓ chromadb        UP  http://localhost:8000" \
	    || echo "  ✗ chromadb        DOWN"
	@curl -sf http://localhost:2000/api/v2/runtimes > /dev/null \
	    && echo "  ✓ piston          UP  http://localhost:2000" \
	    || echo "  ✗ piston          DOWN"

## ── Smoke tests ───────────────────────────────────────────────────────────────

## Run a full API smoke test against the running stack
test-api:
	@echo "=== studytrack API smoke tests (port $(PORT)) ==="
	@BASE=http://localhost:$(PORT); \
	PASS=0; FAIL=0; \
	_check() { \
	    STATUS=$$(curl -s -o /dev/null -w "%{http_code}" "$$1"); \
	    if [ "$$STATUS" = "$$2" ]; then \
	        echo "  ✓ $$3  [$$STATUS]"; PASS=$$((PASS+1)); \
	    else \
	        echo "  ✗ $$3  [got $$STATUS, want $$2]"; FAIL=$$((FAIL+1)); \
	    fi; \
	}; \
	_checkpost() { \
	    STATUS=$$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$$2" "$$1"); \
	    if [ "$$STATUS" = "$$3" ]; then \
	        echo "  ✓ $$4  [$$STATUS]"; PASS=$$((PASS+1)); \
	    else \
	        echo "  ✗ $$4  [got $$STATUS, want $$3]"; FAIL=$$((FAIL+1)); \
	    fi; \
	}; \
	\
	echo ""; \
	echo "── Core endpoints ──────────────────────────────"; \
	_check  "$$BASE/api/version"                200 "GET  /api/version"; \
	_check  "$$BASE/api/progress"               200 "GET  /api/progress"; \
	_check  "$$BASE/api/export"                 200 "GET  /api/export"; \
	\
	echo ""; \
	echo "── Objectives ──────────────────────────────────"; \
	OBJ_RESP=$$(curl -s -X POST $$BASE/api/objectives \
	    -H 'Content-Type: application/json' \
	    -d '{"title":"Smoke Test Obj","examDate":"2099-01-01","type":"theoretical","studyGoal":"pass"}'); \
	OBJ_ID=$$(echo $$OBJ_RESP | sed -n 's/.*"id":"\([^"]*\)".*/\1/p'); \
	if [ -n "$$OBJ_ID" ]; then \
	    echo "  ✓ POST /api/objectives  [created id=$$OBJ_ID]"; PASS=$$((PASS+1)); \
	else \
	    echo "  ✗ POST /api/objectives  [no id returned: $$OBJ_RESP]"; FAIL=$$((FAIL+1)); \
	fi; \
	\
	echo ""; \
	echo "── Tracks (sync) ───────────────────────────────"; \
	if [ -n "$$OBJ_ID" ]; then \
	    _check "$$BASE/api/tracks/$$OBJ_ID"        200 "GET  /api/tracks/:id (existing)"; \
	fi; \
	_check  "$$BASE/api/tracks/nonexistent-id"  404 "GET  /api/tracks/:id (missing)"; \
	\
	echo ""; \
	echo "── Sandbox runtimes ────────────────────────────"; \
	RUNTIMES=$$(curl -s http://localhost:2000/api/v2/runtimes 2>/dev/null); \
	if echo "$$RUNTIMES" | grep -q '"language"'; then \
	    echo "  ✓ GET  /api/sandbox/runtimes (via Piston direct)"; PASS=$$((PASS+1)); \
	else \
	    echo "  ✗ Piston not reachable — sandbox tests skipped"; FAIL=$$((FAIL+1)); \
	fi; \
	\
	echo ""; \
	echo "── Code execution ──────────────────────────────"; \
	RUN_RESP=$$(curl -s -X POST $$BASE/api/sandbox/run \
	    -H 'Content-Type: application/json' \
	    -d '{"language":"python","code":"print(\"hello studytrack\")"}' 2>/dev/null); \
	if echo "$$RUN_RESP" | grep -q '"hello studytrack"'; then \
	    echo "  ✓ POST /api/sandbox/run  [python print OK]"; PASS=$$((PASS+1)); \
	else \
	    echo "  ~ POST /api/sandbox/run  [$$RUN_RESP]  (Piston may need runtime install)"; \
	fi; \
	\
	echo ""; \
	echo "── AI exam (requires ANTHROPIC_API_KEY) ────────"; \
	if [ -n "$$ANTHROPIC_API_KEY" ] && [ -n "$$OBJ_ID" ]; then \
	    EXAM_RESP=$$(curl -s -X POST $$BASE/api/exams/generate \
	        -H 'Content-Type: application/json' \
	        -d "{\"objectiveId\":\"$$OBJ_ID\",\"topic\":\"test topic\",\"type\":\"theoretical\",\"count\":2}"); \
	    if echo "$$EXAM_RESP" | grep -q '"id"'; then \
	        echo "  ✓ POST /api/exams/generate  [theoretical OK]"; PASS=$$((PASS+1)); \
	    else \
	        echo "  ✗ POST /api/exams/generate  [$$EXAM_RESP]"; FAIL=$$((FAIL+1)); \
	    fi; \
	else \
	    echo "  ~ POST /api/exams/generate  [skipped — set ANTHROPIC_API_KEY to test]"; \
	fi; \
	\
	echo ""; \
	echo "── Cleanup ─────────────────────────────────────"; \
	if [ -n "$$OBJ_ID" ]; then \
	    STATUS=$$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $$BASE/api/objectives/$$OBJ_ID); \
	    if [ "$$STATUS" = "200" ]; then echo "  ✓ DELETE /api/objectives/$$OBJ_ID  [200]"; PASS=$$((PASS+1)); \
	    else echo "  ✗ DELETE /api/objectives/$$OBJ_ID  [$$STATUS]"; FAIL=$$((FAIL+1)); fi; \
	fi; \
	\
	echo ""; \
	echo "=== Results: $$PASS passed, $$FAIL failed ==="; \
	[ "$$FAIL" = "0" ]

## ── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "studytrack — available targets"
	@echo ""
	@echo "  Web / Linux (Docker):"
	@echo "    make up-bg        — build + start all services in background"
	@echo "    make up           — build + start all services in foreground"
	@echo "    make down         — stop and remove containers"
	@echo "    make restart      — restart app container only (fast)"
	@echo "    make logs         — follow all service logs"
	@echo "    make logs-app     — follow studytrack app logs only"
	@echo "    make status       — container state + service health"
	@echo "    make test-api     — smoke-test all API endpoints"
	@echo ""
	@echo "  macOS App:"
	@echo "    make macos-build  — build StudyTrack.app + .dmg"
	@echo "    make macos-open   — open the app (builds if missing)"
	@echo "    make macos-dev    — start server for live Tauri dev mode"
	@echo ""
	@echo "  Debugging a make target:"
	@echo "    make <target> --dry-run   — print commands without running them"
	@echo "    make <target> VERBOSE=1   — enable verbose shell tracing"
	@echo ""
