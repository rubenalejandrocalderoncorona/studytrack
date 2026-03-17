#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ghswitch — toggle between GitHub accounts
# Install: sudo cp ghswitch.sh /usr/local/bin/ghswitch && sudo chmod +x /usr/local/bin/ghswitch
# Usage:   ghswitch [work|personal|status]
# ─────────────────────────────────────────────────────────────────────────────

WORK_USERNAME="I754080"
WORK_EMAIL="ruben.calderon.corona@sap.com"

PERSONAL_USERNAME="rubenalejandrocalderoncorona"
PERSONAL_EMAIL="rubenalejandrocalderoncorona@gmail.com"
PERSONAL_PAT="YOUR_PERSONAL_PAT_HERE"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

switch_to_work() {
  git config --global user.name  "$WORK_USERNAME"
  git config --global user.email "$WORK_EMAIL"
  # Remove any stored personal PAT so macOS Keychain / SAP SSO takes over
  printf "protocol=https\nhost=github.com\n" \
    | git credential-osxkeychain erase 2>/dev/null || true
  echo -e "${GREEN}✓ Switched to WORK account${RESET}"
  echo -e "  name : ${CYAN}${WORK_USERNAME}${RESET}"
  echo -e "  email: ${CYAN}${WORK_EMAIL}${RESET}"
}

switch_to_personal() {
  git config --global user.name  "$PERSONAL_USERNAME"
  git config --global user.email "$PERSONAL_EMAIL"
  # Store personal PAT in macOS Keychain
  printf "protocol=https\nhost=github.com\nusername=%s\npassword=%s\n" \
    "$PERSONAL_USERNAME" "$PERSONAL_PAT" \
    | git credential-osxkeychain store
  echo -e "${GREEN}✓ Switched to PERSONAL account${RESET}"
  echo -e "  name : ${CYAN}${PERSONAL_USERNAME}${RESET}"
  echo -e "  email: ${CYAN}${PERSONAL_EMAIL}${RESET}"
}

show_status() {
  local name email
  name=$(git config --global user.name  2>/dev/null || echo "(not set)")
  email=$(git config --global user.email 2>/dev/null || echo "(not set)")
  echo -e "${YELLOW}Current git identity:${RESET}"
  echo -e "  name : ${CYAN}${name}${RESET}"
  echo -e "  email: ${CYAN}${email}${RESET}"
  if [[ "$name" == "$WORK_USERNAME" ]]; then
    echo -e "  mode : ${GREEN}work${RESET}"
  elif [[ "$name" == "$PERSONAL_USERNAME" ]]; then
    echo -e "  mode : ${GREEN}personal${RESET}"
  else
    echo -e "  mode : (unknown)"
  fi
}

case "${1:-status}" in
  work|w)       switch_to_work     ;;
  personal|p)   switch_to_personal ;;
  status|s)     show_status        ;;
  *)
    echo "Usage: ghswitch [work|personal|status]"
    echo ""
    echo "  work      → ${WORK_USERNAME} <${WORK_EMAIL}>"
    echo "  personal  → ${PERSONAL_USERNAME} <${PERSONAL_EMAIL}>"
    echo "  status    → show current identity"
    exit 1
    ;;
esac