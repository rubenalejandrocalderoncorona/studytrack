#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# finish-setup.sh — One-time setup for ghswitch + studytrack
# Usage: bash finish-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

PERSONAL_USERNAME="rubenalejandrocalderoncorona"
PERSONAL_EMAIL="rubenalejandrocalderoncorona@gmail.com"
WORK_USERNAME="I754080"
WORK_EMAIL="ruben.calderon.corona@sap.com"
REPO_NAME="studytrack"
PROFILES_DIR="$HOME/.config/ghswitch/profiles"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo -e "${YELLOW}=== StudyTrack + ghswitch Setup ===${RESET}"

# ── 1. Collect personal PAT ──────────────────────────────────────────────────
echo -e "\n${CYAN}[1/6] Personal GitHub PAT${RESET}"

PERSONAL_PAT=""
EXISTING_PROFILE="$PROFILES_DIR/personal.conf"
if [[ -f "$EXISTING_PROFILE" ]]; then
  PERSONAL_PAT=$(grep "^PAT_VALUE_1=" "$EXISTING_PROFILE" | cut -d= -f2-)
fi

if [[ -z "$PERSONAL_PAT" ]]; then
  printf "Enter PAT for %s (input hidden): " "$PERSONAL_USERNAME"
  read -r -s PERSONAL_PAT
  echo ""
fi

if [[ -z "$PERSONAL_PAT" ]]; then
  echo -e "${YELLOW}❌ No PAT provided. Aborting.${RESET}"
  exit 1
fi

# ── 2. Create profile files ──────────────────────────────────────────────────
echo -e "\n${CYAN}[2/6] Creating ghswitch profiles...${RESET}"
mkdir -p "$PROFILES_DIR"
chmod 700 "$PROFILES_DIR"

cat > "$PROFILES_DIR/work.conf" <<EOF
PROFILE_NAME=work
USERNAME=${WORK_USERNAME}
EMAIL=${WORK_EMAIL}
EOF
chmod 600 "$PROFILES_DIR/work.conf"
echo -e "${GREEN}✓ work profile (SSO auth)${RESET}"

cat > "$PROFILES_DIR/personal.conf" <<EOF
PROFILE_NAME=personal
USERNAME=${PERSONAL_USERNAME}
EMAIL=${PERSONAL_EMAIL}
PAT_NAME_1=main
PAT_VALUE_1=${PERSONAL_PAT}
EOF
chmod 600 "$PROFILES_DIR/personal.conf"
echo -e "${GREEN}✓ personal profile (PAT: main)${RESET}"

# ── 3. Install ghswitch ──────────────────────────────────────────────────────
echo -e "\n${CYAN}[3/6] Installing ghswitch...${RESET}"
mkdir -p "$HOME/.local/bin"
cp "$(dirname "$0")/ghswitch.sh" "$HOME/.local/bin/ghswitch"
chmod +x "$HOME/.local/bin/ghswitch"
echo -e "${GREEN}✓ ghswitch → ~/.local/bin/ghswitch${RESET}"

# ── 4. Add ~/.local/bin to PATH ──────────────────────────────────────────────
echo -e "\n${CYAN}[4/6] Checking PATH in ~/.zshrc...${RESET}"
if grep -q '\.local/bin' "$HOME/.zshrc" 2>/dev/null; then
  echo -e "${GREEN}✓ ~/.local/bin already in PATH${RESET}"
else
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
  echo -e "${GREEN}✓ Added ~/.local/bin to PATH${RESET}"
fi

# ── 5. Switch to personal & store PAT in Keychain ───────────────────────────
echo -e "\n${CYAN}[5/6] Activating personal account...${RESET}"
git config --global user.name  "$PERSONAL_USERNAME"
git config --global user.email "$PERSONAL_EMAIL"
git config --global credential.helper osxkeychain
printf "protocol=https\nhost=github.com\nusername=%s\npassword=%s\n" \
  "$PERSONAL_USERNAME" "$PERSONAL_PAT" \
  | git credential-osxkeychain store
echo -e "${GREEN}✓ Git identity: ${PERSONAL_USERNAME} <${PERSONAL_EMAIL}>${RESET}"

# ── 6. Push studytrack to GitHub ─────────────────────────────────────────────
echo -e "\n${CYAN}[6/6] Pushing ${REPO_NAME} to GitHub...${RESET}"
REMOTE_URL="https://${PERSONAL_PAT}@github.com/${PERSONAL_USERNAME}/${REPO_NAME}.git"

RESPONSE=$(curl -s -o /tmp/gh_create_response.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: token ${PERSONAL_PAT}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"${REPO_NAME}\",\"description\":\"StudyTrack — local study plan tracker with Docker, dark theme, and persistent JSON progress\",\"private\":false,\"has_issues\":true,\"has_wiki\":false}")

if [[ "$RESPONSE" == "201" ]]; then
  echo -e "${GREEN}✓ Repo created: https://github.com/${PERSONAL_USERNAME}/${REPO_NAME}${RESET}"
elif [[ "$RESPONSE" == "422" ]]; then
  echo -e "${YELLOW}⚠ Repo already exists — continuing${RESET}"
else
  echo -e "${YELLOW}⚠ Unexpected response (${RESPONSE}):${RESET}"
  cat /tmp/gh_create_response.json
fi

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

echo -e "\n${GREEN}✓ Pushed to https://github.com/${PERSONAL_USERNAME}/${REPO_NAME}${RESET}"
echo -e "\n${YELLOW}=== Done! ===${RESET}"
echo -e "  Switch accounts : ${CYAN}ghswitch work${RESET}  /  ${CYAN}ghswitch personal${RESET}"
echo -e "  Check identity  : ${CYAN}ghswitch status${RESET}"
echo -e "  List profiles   : ${CYAN}ghswitch list${RESET}"
echo -e "  Repo URL        : ${CYAN}https://github.com/${PERSONAL_USERNAME}/${REPO_NAME}${RESET}"