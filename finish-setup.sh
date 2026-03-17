#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# finish-setup.sh — Run this ONCE in your terminal to complete setup
# Usage: bash finish-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

PERSONAL_USERNAME="rubenalejandrocalderoncorona"
PERSONAL_EMAIL="rubenalejandrocalderoncorona@gmail.com"
REPO_NAME="studytrack"
CREDS_FILE="$HOME/.config/ghswitch/credentials"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

# ── Prompt for PAT if not already stored ────────────────────────────────────
if [[ -f "$CREDS_FILE" ]]; then
  source "$CREDS_FILE"
fi

if [[ -z "$PERSONAL_PAT" ]]; then
  echo -e "${YELLOW}Enter your GitHub Personal Access Token for $PERSONAL_USERNAME:${RESET}"
  read -r -s PERSONAL_PAT
  echo ""
fi

if [[ -z "$PERSONAL_PAT" ]]; then
  echo -e "${YELLOW}❌ No PAT provided. Aborting.${RESET}"
  exit 1
fi

echo -e "${YELLOW}=== StudyTrack Setup ===${RESET}"

# ── 1. Store credentials locally ────────────────────────────────────────────
echo -e "\n${CYAN}[1/5] Storing credentials in $CREDS_FILE...${RESET}"
mkdir -p "$(dirname "$CREDS_FILE")"
chmod 700 "$(dirname "$CREDS_FILE")"
cat > "$CREDS_FILE" <<EOF
# ghswitch credentials — DO NOT COMMIT THIS FILE
PERSONAL_PAT="${PERSONAL_PAT}"
EOF
chmod 600 "$CREDS_FILE"
echo -e "${GREEN}✓ Credentials stored at $CREDS_FILE (mode 600)${RESET}"

# ── 2. Install ghswitch ──────────────────────────────────────────────────────
echo -e "\n${CYAN}[2/5] Installing ghswitch...${RESET}"
mkdir -p "$HOME/.local/bin"
cp "$(dirname "$0")/ghswitch.sh" "$HOME/.local/bin/ghswitch"
chmod +x "$HOME/.local/bin/ghswitch"
echo -e "${GREEN}✓ ghswitch installed to ~/.local/bin/ghswitch${RESET}"

# ── 3. Add ~/.local/bin to PATH in ~/.zshrc ──────────────────────────────────
echo -e "\n${CYAN}[3/5] Checking PATH in ~/.zshrc...${RESET}"
if grep -q '\.local/bin' "$HOME/.zshrc" 2>/dev/null; then
  echo -e "${GREEN}✓ ~/.local/bin already in PATH${RESET}"
else
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
  echo -e "${GREEN}✓ Added ~/.local/bin to PATH in ~/.zshrc${RESET}"
fi

# ── 4. Switch git identity to personal & store PAT in Keychain ──────────────
echo -e "\n${CYAN}[4/5] Switching to personal GitHub account...${RESET}"
git config --global user.name  "$PERSONAL_USERNAME"
git config --global user.email "$PERSONAL_EMAIL"
printf "protocol=https\nhost=github.com\nusername=%s\npassword=%s\n" \
  "$PERSONAL_USERNAME" "$PERSONAL_PAT" \
  | git credential-osxkeychain store
echo -e "${GREEN}✓ Git identity: $PERSONAL_USERNAME <$PERSONAL_EMAIL>${RESET}"

# ── 5. Create GitHub repo (if needed) & push ────────────────────────────────
echo -e "\n${CYAN}[5/5] Creating GitHub repo '$REPO_NAME' and pushing...${RESET}"
RESPONSE=$(curl -s -o /tmp/gh_create_response.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: token $PERSONAL_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"StudyTrack — local study plan tracker with Docker, dark theme, and persistent JSON progress\",\"private\":false,\"has_issues\":true,\"has_wiki\":false}")

if [[ "$RESPONSE" == "201" ]]; then
  echo -e "${GREEN}✓ Repo created: https://github.com/$PERSONAL_USERNAME/$REPO_NAME${RESET}"
elif [[ "$RESPONSE" == "422" ]]; then
  echo -e "${YELLOW}⚠ Repo already exists — continuing${RESET}"
else
  echo -e "${YELLOW}⚠ Unexpected response ($RESPONSE):${RESET}"
  cat /tmp/gh_create_response.json
fi

REMOTE_URL="https://${PERSONAL_PAT}@github.com/${PERSONAL_USERNAME}/${REPO_NAME}.git"

if [ ! -d ".git" ]; then
  git init
  git add -A
  git commit -m "Initial commit: StudyTrack v0.1.0-beta"
fi

if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: update ghswitch and setup scripts"
fi

git branch -M main
git push -u origin main

echo -e "\n${GREEN}✓ Pushed to https://github.com/$PERSONAL_USERNAME/$REPO_NAME${RESET}"
echo -e "\n${YELLOW}=== Done! ===${RESET}"
echo -e "  Switch accounts : ${CYAN}ghswitch work${RESET}  /  ${CYAN}ghswitch personal${RESET}"
echo -e "  Check identity  : ${CYAN}ghswitch status${RESET}"
echo -e "  Repo URL        : ${CYAN}https://github.com/$PERSONAL_USERNAME/$REPO_NAME${RESET}"