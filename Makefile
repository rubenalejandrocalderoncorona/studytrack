PORT      ?= 3333
APP_BUNDLE := src-tauri/target/release/bundle/macos/StudyTrack.app
DMG        := src-tauri/target/release/bundle/dmg/StudyTrack_0.3.0_aarch64.dmg
DC_SERVICES := docker compose -f docker-compose.services.yml

# Docker Desktop on macOS — active socket path.
export DOCKER_HOST ?= unix://$(HOME)/.docker/run/docker.sock

# Prevent shell-level ANTHROPIC_* vars from overriding .env values.
unexport ANTHROPIC_API_KEY
unexport ANTHROPIC_BASE_URL

.PHONY: app web stop restart install _start-services _start-server \
        macos-build test-api help

## ── Primary targets ───────────────────────────────────────────────────────────

## Start the macOS app in dev mode (services in background + tauri dev window)
app: install _start-services _start-server
	@echo "→ Opening Tauri dev window..."
	npx tauri dev

## Start the web UI in the browser (all services + Node server in background)
web: install _start-services _start-server
	@echo "✓ Web UI running at http://localhost:$(PORT)"
	@open "http://localhost:$(PORT)"

## Stop the Node.js server, ChromaDB, and Piston
stop:
	@echo "→ Stopping Node.js server..."
	@if [ -f /tmp/studytrack-server.pid ]; then \
	    kill $$(cat /tmp/studytrack-server.pid) 2>/dev/null || true; \
	    rm -f /tmp/studytrack-server.pid; \
	fi
	@lsof -ti :$(PORT) | xargs kill -9 2>/dev/null || true
	@echo "→ Stopping ChromaDB + Piston..."
	@$(DC_SERVICES) down 2>/dev/null || true
	@echo "✓ All stopped"

## Restart everything (default MODE=web, use MODE=app for macOS)
MODE ?= web
restart: stop
	@$(MAKE) --no-print-directory $(MODE)

## ── Internal helpers ──────────────────────────────────────────────────────────

## Install npm dependencies (skipped when node_modules already exists)
install:
	@if [ ! -d node_modules ]; then \
	    echo "→ Installing npm dependencies..."; \
	    npm install; \
	    echo "✓ Dependencies installed"; \
	fi

## Start ChromaDB + Piston via docker-compose.services.yml (idempotent)
## Also stops any stale studytrack app container that would clash on port 3333.
_start-services:
	@if ! docker info > /dev/null 2>&1; then \
	    echo "→ Docker not running — launching Docker Desktop..."; \
	    open -a Docker; \
	    echo "→ Waiting for Docker daemon (up to 90s)..."; \
	    for i in $$(seq 1 45); do \
	        sleep 2; \
	        if docker info > /dev/null 2>&1; then \
	            echo "✓ Docker ready"; \
	            break; \
	        fi; \
	        if [ $$i -eq 45 ]; then \
	            echo "✗ Docker did not start in time"; \
	            exit 1; \
	        fi; \
	    done; \
	fi; \
	if docker ps --format '{{.Names}}' | grep -q '^studytrack$$'; then \
	    echo "→ Stopping stale studytrack container on port 3333..."; \
	    docker stop studytrack > /dev/null 2>&1 || true; \
	    docker rm studytrack > /dev/null 2>&1 || true; \
	fi; \
	echo "→ Starting ChromaDB + Piston in background..."; \
	$(DC_SERVICES) up -d
	@echo "→ Waiting for ChromaDB on port 8000..."
	@for i in $$(seq 1 30); do \
	    if curl -sf http://localhost:8000/api/v2/heartbeat > /dev/null 2>&1; then \
	        echo "✓ ChromaDB ready"; \
	        break; \
	    fi; \
	    sleep 1; \
	done
	@echo "→ Waiting for Piston on port 2000..."
	@for i in $$(seq 1 30); do \
	    if curl -sf http://localhost:2000/api/v2/runtimes > /dev/null 2>&1; then \
	        echo "✓ Piston ready"; \
	        break; \
	    fi; \
	    sleep 1; \
	done
	@echo "→ Checking Piston runtimes..."
	@RUNTIMES=$$(curl -s http://localhost:2000/api/v2/runtimes 2>/dev/null); \
	if ! echo "$$RUNTIMES" | grep -q '"language"'; then \
	    echo "→ Installing Python runtime (first time, ~60s)..."; \
	    curl -sf -X POST http://localhost:2000/api/v2/packages \
	        -H "content-type: application/json" \
	        -d '{"language":"python","version":"3.10.0"}' > /dev/null; \
	    echo "→ Installing JavaScript runtime..."; \
	    curl -sf -X POST http://localhost:2000/api/v2/packages \
	        -H "content-type: application/json" \
	        -d '{"language":"javascript","version":"18.15.0"}' > /dev/null; \
	    echo "✓ Runtimes installed"; \
	else \
	    echo "✓ Runtimes already present"; \
	fi

## Kill any process on PORT, source .env, start server.js in background, wait until ready
_start-server:
	@echo "→ Freeing port $(PORT)..."
	@lsof -ti :$(PORT) | xargs kill -9 2>/dev/null || true
	@echo "→ Starting Node.js server in background (loading .env)..."
	@set -a; [ -f .env ] && . ./.env; set +a; \
	node server.js > /tmp/studytrack-server.log 2>&1 & \
	echo $$! > /tmp/studytrack-server.pid
	@echo "→ Waiting for server on port $(PORT)..."
	@for i in $$(seq 1 20); do \
	    if curl -sf http://localhost:$(PORT)/api/version > /dev/null 2>&1; then \
	        echo "✓ Server ready"; \
	        break; \
	    fi; \
	    sleep 0.5; \
	done

## ── Build ─────────────────────────────────────────────────────────────────────

## Build the macOS .app + .dmg
macos-build: install
	@echo "→ Building macOS app bundle..."
	npm install
	npx tauri build
	@echo "✓ Built: $(APP_BUNDLE)"

## ── Smoke tests ───────────────────────────────────────────────────────────────

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
	@echo "  make app          — start macOS app (server in background + tauri dev window)"
	@echo "  make web          — start web UI in browser (server in background)"
	@echo "  make stop         — kill server + stop ChromaDB + Piston"
	@echo "  make restart      — stop then restart web UI (MODE=app for macOS)"
	@echo "  make macos-build  — build StudyTrack.app + .dmg"
	@echo "  make test-api     — smoke-test all API endpoints"
	@echo ""
	@echo "  Server logs:   /tmp/studytrack-server.log"
	@echo "  Service logs:  docker compose -f docker-compose.services.yml logs -f"
	@echo ""
