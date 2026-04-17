#!/usr/bin/env bash
# scripts/build-sidecar.sh — Build the Node.js sidecar binary for the macOS Tauri app.
# Requires: npm install (pkg devDependency must be present)
# Output: src-tauri/binaries/studytrack-server-aarch64-apple-darwin
set -e

cd "$(dirname "$0")/.."

echo "→ Building studytrack-server sidecar..."
mkdir -p src-tauri/binaries
npm run build:sidecar

echo "→ Copying docker-compose.services.yml into src-tauri/..."
cp docker-compose.services.yml src-tauri/docker-compose.services.yml

echo "✓ Sidecar built → src-tauri/binaries/studytrack-server-aarch64-apple-darwin"
