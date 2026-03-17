#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ghswitch v2.0 — Multi-account GitHub credential manager
#
# Install : sudo cp ghswitch.sh /usr/local/bin/ghswitch && sudo chmod +x /usr/local/bin/ghswitch
# Usage   : ghswitch <command> [profile]
#
# Commands:
#   list                   List all profiles and their PATs
#   status                 Show current git identity
#   switch  [profile]      Switch to a profile (interactive if omitted)
#   add                    Add a new profile (interactive wizard)
#   add-pat [profile]      Add a PAT to an existing profile
#   rm-pat  [profile]      Remove a PAT from a profile
#   delete  [profile]      Delete a profile entirely
#   help                   Show this help
#
# Profiles are stored in: ~/.config/ghswitch/profiles/<name>.conf
# ─────────────────────────────────────────────────────────────────────────────

PROFILES_DIR="$HOME/.config/ghswitch/profiles"
VERSION="2.0.0"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

_ok()    { echo -e "${GREEN}✓ ${*}${RESET}"; }
_info()  { echo -e "${CYAN}ℹ ${*}${RESET}"; }
_warn()  { echo -e "${YELLOW}⚠ ${*}${RESET}"; }
_err()   { echo -e "${RED}✗ ${*}${RESET}" >&2; }
_bold()  { echo -e "${BOLD}${*}${RESET}"; }

# ── Profile helpers ───────────────────────────────────────────────────────────

_ensure_dir() {
  mkdir -p "$PROFILES_DIR"
  chmod 700 "$PROFILES_DIR"
}

_profile_path() { echo "$PROFILES_DIR/${1}.conf"; }

_profile_exists() { [[ -f "$(_profile_path "$1")" ]]; }

# Print one profile name per line
_list_names() {
  _ensure_dir
  local f
  for f in "$PROFILES_DIR"/*.conf; do
    [[ -f "$f" ]] && basename "$f" .conf
  done
}

# Read a single key=value field from a profile file
_field() {
  local file="$1" key="$2"
  grep "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2-
}

# Count PAT entries in a profile file
_pat_count() {
  grep -c "^PAT_NAME_" "$1" 2>/dev/null || echo 0
}

# Write a fresh profile file (no PATs)
_write_profile() {
  local profile="$1" username="$2" email="$3"
  _ensure_dir
  printf "PROFILE_NAME=%s\nUSERNAME=%s\nEMAIL=%s\n" \
    "$profile" "$username" "$email" > "$(_profile_path "$profile")"
  chmod 600 "$(_profile_path "$profile")"
}

# Append a PAT entry to an existing profile file
_append_pat() {
  local file="$1" name="$2" value="$3"
  local idx
  idx=$(( $(_pat_count "$file") + 1 ))
  printf "PAT_NAME_%d=%s\nPAT_VALUE_%d=%s\n" \
    "$idx" "$name" "$idx" "$value" >> "$file"
}

# Remove PAT at position $2 and renumber the rest
_remove_pat() {
  local file="$1" remove_idx="$2"
  local count
  count=$(_pat_count "$file")
  local tmp
  tmp=$(mktemp)

  # Copy non-PAT lines
  grep -v "^PAT_NAME_\|^PAT_VALUE_" "$file" > "$tmp" || true

  # Re-append remaining PATs with fresh numbering
  local new=1 i=1
  while [[ $i -le $count ]]; do
    if [[ $i -ne $remove_idx ]]; then
      local n v
      n=$(grep "^PAT_NAME_${i}=" "$file" | cut -d= -f2-)
      v=$(grep "^PAT_VALUE_${i}=" "$file" | cut -d= -f2-)
      printf "PAT_NAME_%d=%s\nPAT_VALUE_%d=%s\n" "$new" "$n" "$new" "$v" >> "$tmp"
      (( new++ ))
    fi
    (( i++ ))
  done

  mv "$tmp" "$file"
  chmod 600 "$file"
}

# ── Keychain helpers ──────────────────────────────────────────────────────────

_keychain_store() {
  printf "protocol=https\nhost=github.com\nusername=%s\npassword=%s\n" \
    "$1" "$2" | git credential-osxkeychain store
}

_keychain_erase() {
  printf "protocol=https\nhost=github.com\n" \
    | git credential-osxkeychain erase 2>/dev/null || true
}

# ── Interactive picker ────────────────────────────────────────────────────────
# Usage: selected=$(_pick "Prompt" item1 item2 ...)
# Returns selected item on stdout; returns 1 if user cancels.
_pick() {
  local prompt="$1"; shift
  local items=("$@")
  local n=${#items[@]}

  echo -e "\n${YELLOW}${prompt}${RESET}" >&2
  local i=0
  while [[ $i -lt $n ]]; do
    echo -e "  ${CYAN}[$((i+1))]${RESET} ${items[$i]}" >&2
    (( i++ ))
  done
  echo -e "  ${CYAN}[0]${RESET} Cancel" >&2

  local choice
  while true; do
    printf "\nChoice [0-%d]: " "$n" >&2
    read -r choice
    if [[ "$choice" == "0" ]]; then
      return 1
    elif [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= n )); then
      echo "${items[$((choice-1))]}"
      return 0
    else
      echo -e "${YELLOW}Please enter a number between 0 and ${n}.${RESET}" >&2
    fi
  done
}

# ── One-time migration from v1 credentials file ───────────────────────────────
_migrate_v1() {
  local old="$HOME/.config/ghswitch/credentials"

  # Create work profile if missing
  if ! _profile_exists "work"; then
    _write_profile "work" "I754080" "ruben.calderon.corona@sap.com"
    _ok "Auto-created 'work' profile (no PAT — uses SSO/browser)."
  fi

  # Migrate personal PAT from v1 file if personal profile is missing
  if [[ -f "$old" ]] && ! _profile_exists "personal"; then
    local pat
    pat=$(grep "^PERSONAL_PAT=" "$old" | sed 's/^PERSONAL_PAT="\(.*\)"$/\1/')
    if [[ -n "$pat" ]]; then
      _write_profile "personal" \
        "rubenalejandrocalderoncorona" \
        "rubenalejandrocalderoncorona@gmail.com"
      _append_pat "$(_profile_path "personal")" "main" "$pat"
      _ok "Migrated v1 credentials → 'personal' profile."
    fi
  fi
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_list() {
  _ensure_dir
  _migrate_v1

  local names=()
  while IFS= read -r n; do [[ -n "$n" ]] && names+=("$n"); done < <(_list_names)

  if [[ ${#names[@]} -eq 0 ]]; then
    _warn "No profiles yet. Run: ghswitch add"
    return 0
  fi

  local current
  current=$(git config --global user.name 2>/dev/null || true)

  echo ""
  _bold "GitHub Profiles  (${#names[@]} total)"
  echo ""

  for p in "${names[@]}"; do
    local f
    f="$(_profile_path "$p")"
    local user email cnt
    user=$(_field "$f" "USERNAME")
    email=$(_field "$f" "EMAIL")
    cnt=$(_pat_count "$f")

    local tag=""
    [[ "$user" == "$current" ]] && tag=" ${GREEN}◀ active${RESET}"

    echo -e "  ${BOLD}${p}${RESET}${tag}"
    echo -e "    ${DIM}username${RESET} : ${CYAN}${user}${RESET}"
    echo -e "    ${DIM}email${RESET}    : ${CYAN}${email}${RESET}"

    if [[ "$cnt" -eq 0 ]]; then
      echo -e "    ${DIM}PATs${RESET}     : ${YELLOW}none  (SSO / browser auth)${RESET}"
    else
      echo -e "    ${DIM}PATs${RESET}     : ${CYAN}${cnt}${RESET}"
      local i=1
      while [[ $i -le $cnt ]]; do
        echo -e "      ${DIM}[$i]${RESET} $(grep "^PAT_NAME_${i}=" "$f" | cut -d= -f2-)"
        (( i++ ))
      done
    fi
    echo ""
  done
}

cmd_status() {
  local name email
  name=$(git config --global user.name  2>/dev/null || echo "(not set)")
  email=$(git config --global user.email 2>/dev/null || echo "(not set)")

  echo ""
  echo -e "${YELLOW}Current git identity:${RESET}"
  echo -e "  name    : ${CYAN}${name}${RESET}"
  echo -e "  email   : ${CYAN}${email}${RESET}"

  local matched=""
  while IFS= read -r p; do
    [[ -z "$p" ]] && continue
    local f; f="$(_profile_path "$p")"
    [[ "$(_field "$f" "USERNAME")" == "$name" ]] && { matched="$p"; break; }
  done < <(_list_names)

  if [[ -n "$matched" ]]; then
    echo -e "  profile : ${GREEN}${matched}${RESET}"
  else
    echo -e "  profile : ${YELLOW}(unknown)${RESET}"
  fi
  echo ""
}

cmd_switch() {
  _migrate_v1
  local profile="${1:-}"

  # Interactive selection when no profile given
  if [[ -z "$profile" ]]; then
    local names=()
    while IFS= read -r n; do [[ -n "$n" ]] && names+=("$n"); done < <(_list_names)
    [[ ${#names[@]} -eq 0 ]] && { _warn "No profiles. Run: ghswitch add"; return 1; }
    profile=$(_pick "Select a profile:" "${names[@]}") || return 0
  fi

  _profile_exists "$profile" || { _err "Profile '$profile' not found. Run: ghswitch list"; return 1; }

  local f; f="$(_profile_path "$profile")"
  local user email cnt
  user=$(_field "$f" "USERNAME")
  email=$(_field "$f" "EMAIL")
  cnt=$(_pat_count "$f")

  # Apply git identity
  git config --global user.name  "$user"
  git config --global user.email "$email"
  git config --global credential.helper osxkeychain

  echo ""
  if [[ "$cnt" -eq 0 ]]; then
    _keychain_erase
    _ok "Switched to '${profile}'"
    echo -e "  name  : ${CYAN}${user}${RESET}"
    echo -e "  email : ${CYAN}${email}${RESET}"
    echo -e "  auth  : ${YELLOW}SSO / browser (no PAT configured)${RESET}"

  elif [[ "$cnt" -eq 1 ]]; then
    local pat_name pat_val
    pat_name=$(grep "^PAT_NAME_1=" "$f" | cut -d= -f2-)
    pat_val=$(grep "^PAT_VALUE_1=" "$f" | cut -d= -f2-)
    _keychain_store "$user" "$pat_val"
    _ok "Switched to '${profile}'"
    echo -e "  name  : ${CYAN}${user}${RESET}"
    echo -e "  email : ${CYAN}${email}${RESET}"
    echo -e "  auth  : ${GREEN}PAT '${pat_name}' → macOS Keychain${RESET}"

  else
    # Multiple PATs — let user choose
    local pat_names=()
    local i=1
    while [[ $i -le $cnt ]]; do
      pat_names+=("$(grep "^PAT_NAME_${i}=" "$f" | cut -d= -f2-)")
      (( i++ ))
    done

    local sel_name
    sel_name=$(_pick "Select a PAT for '${profile}':" "${pat_names[@]}") || return 0

    # Resolve value for selected name
    local sel_val=""
    i=1
    while [[ $i -le $cnt ]]; do
      if [[ "$(grep "^PAT_NAME_${i}=" "$f" | cut -d= -f2-)" == "$sel_name" ]]; then
        sel_val=$(grep "^PAT_VALUE_${i}=" "$f" | cut -d= -f2-)
        break
      fi
      (( i++ ))
    done

    _keychain_store "$user" "$sel_val"
    _ok "Switched to '${profile}' using PAT '${sel_name}'"
    echo -e "  name  : ${CYAN}${user}${RESET}"
    echo -e "  email : ${CYAN}${email}${RESET}"
    echo -e "  auth  : ${GREEN}PAT '${sel_name}' → macOS Keychain${RESET}"
  fi
  echo ""
}

cmd_add() {
  echo ""
  _bold "Add a new GitHub profile"
  echo ""

  local profile username email
  printf "Profile name (e.g. work, personal, freelance): "
  read -r profile
  profile="${profile// /-}"

  [[ -z "$profile" ]] && { _err "Profile name cannot be empty."; return 1; }

  if _profile_exists "$profile"; then
    _warn "Profile '$profile' already exists."
    printf "Overwrite? [y/N]: "
    read -r c
    [[ "$c" =~ ^[Yy]$ ]] || { _info "Cancelled."; return 0; }
  fi

  printf "GitHub username : "
  read -r username
  printf "Email           : "
  read -r email

  [[ -z "$username" || -z "$email" ]] && { _err "Username and email are required."; return 1; }

  _write_profile "$profile" "$username" "$email"
  echo ""
  _ok "Profile '${profile}' created."

  printf "\nAdd a PAT now? [Y/n]: "
  read -r c
  [[ "$c" =~ ^[Nn]$ ]] || cmd_add_pat "$profile"
}

cmd_add_pat() {
  _migrate_v1
  local profile="${1:-}"

  if [[ -z "$profile" ]]; then
    local names=()
    while IFS= read -r n; do [[ -n "$n" ]] && names+=("$n"); done < <(_list_names)
    [[ ${#names[@]} -eq 0 ]] && { _warn "No profiles. Run: ghswitch add"; return 1; }
    profile=$(_pick "Select a profile to add a PAT to:" "${names[@]}") || return 0
  fi

  _profile_exists "$profile" || { _err "Profile '$profile' not found."; return 1; }

  local pat_name pat_val
  printf "\nPAT label (e.g. main, ci, readonly): "
  read -r pat_name
  [[ -z "$pat_name" ]] && { _err "Label cannot be empty."; return 1; }

  printf "PAT value (hidden): "
  read -r -s pat_val
  echo ""
  [[ -z "$pat_val" ]] && { _err "PAT value cannot be empty."; return 1; }

  _append_pat "$(_profile_path "$profile")" "$pat_name" "$pat_val"
  _ok "PAT '${pat_name}' added to profile '${profile}'."
}

cmd_rm_pat() {
  _migrate_v1
  local profile="${1:-}"

  if [[ -z "$profile" ]]; then
    local names=()
    while IFS= read -r n; do [[ -n "$n" ]] && names+=("$n"); done < <(_list_names)
    [[ ${#names[@]} -eq 0 ]] && { _warn "No profiles."; return 1; }
    profile=$(_pick "Select a profile:" "${names[@]}") || return 0
  fi

  _profile_exists "$profile" || { _err "Profile '$profile' not found."; return 1; }

  local f; f="$(_profile_path "$profile")"
  local cnt; cnt=$(_pat_count "$f")
  [[ "$cnt" -eq 0 ]] && { _warn "Profile '$profile' has no PATs."; return 0; }

  local pat_names=()
  local i=1
  while [[ $i -le $cnt ]]; do
    pat_names+=("$(grep "^PAT_NAME_${i}=" "$f" | cut -d= -f2-)")
    (( i++ ))
  done

  local sel
  sel=$(_pick "Select a PAT to remove from '${profile}':" "${pat_names[@]}") || return 0

  # Find index of selected name
  local idx=0 j=1
  while [[ $j -le $cnt ]]; do
    [[ "$(grep "^PAT_NAME_${j}=" "$f" | cut -d= -f2-)" == "$sel" ]] && { idx=$j; break; }
    (( j++ ))
  done

  printf "${RED}Remove PAT '${sel}' from '${profile}'? [y/N]: ${RESET}"
  read -r c
  if [[ "$c" =~ ^[Yy]$ ]]; then
    _remove_pat "$f" "$idx"
    _ok "PAT '${sel}' removed from '${profile}'."
  else
    _info "Cancelled."
  fi
}

cmd_delete() {
  _migrate_v1
  local profile="${1:-}"

  if [[ -z "$profile" ]]; then
    local names=()
    while IFS= read -r n; do [[ -n "$n" ]] && names+=("$n"); done < <(_list_names)
    [[ ${#names[@]} -eq 0 ]] && { _warn "No profiles."; return 1; }
    profile=$(_pick "Select a profile to delete:" "${names[@]}") || return 0
  fi

  _profile_exists "$profile" || { _err "Profile '$profile' not found."; return 1; }

  printf "${RED}Delete profile '${profile}'? This cannot be undone. [y/N]: ${RESET}"
  read -r c
  if [[ "$c" =~ ^[Yy]$ ]]; then
    rm -f "$(_profile_path "$profile")"
    _ok "Profile '${profile}' deleted."
  else
    _info "Cancelled."
  fi
}

cmd_help() {
  echo ""
  _bold "ghswitch v${VERSION} — Multi-account GitHub credential manager"
  echo ""
  echo -e "${BOLD}USAGE${RESET}   ghswitch <command> [profile]"
  echo ""
  echo -e "${BOLD}COMMANDS${RESET}"
  echo -e "  ${CYAN}list${RESET}                 List all profiles and their PATs"
  echo -e "  ${CYAN}status${RESET}               Show current git identity"
  echo -e "  ${CYAN}switch  [profile]${RESET}    Switch to a profile (interactive if omitted)"
  echo -e "  ${CYAN}add${RESET}                  Add a new profile (interactive wizard)"
  echo -e "  ${CYAN}add-pat [profile]${RESET}    Add a PAT to an existing profile"
  echo -e "  ${CYAN}rm-pat  [profile]${RESET}    Remove a PAT from a profile"
  echo -e "  ${CYAN}delete  [profile]${RESET}    Delete a profile"
  echo -e "  ${CYAN}help${RESET}                 Show this help"
  echo ""
  echo -e "${BOLD}EXAMPLES${RESET}"
  echo "  ghswitch switch personal   # switch to personal profile"
  echo "  ghswitch switch            # interactive profile picker"
  echo "  ghswitch add               # add a new profile"
  echo "  ghswitch add-pat personal  # add a PAT to personal"
  echo "  ghswitch rm-pat            # remove a PAT (interactive)"
  echo "  ghswitch delete            # delete a profile (interactive)"
  echo "  ghswitch list              # list all profiles"
  echo ""
  echo -e "${BOLD}PROFILES${RESET}  ${DIM}${PROFILES_DIR}/${RESET}"
  echo ""
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "${1:-help}" in
  list|ls)              cmd_list                 ;;
  status|s)             cmd_status               ;;
  switch|sw)            cmd_switch  "${2:-}"     ;;
  add|a)                cmd_add                  ;;
  add-pat|ap)           cmd_add_pat "${2:-}"     ;;
  rm-pat|rp)            cmd_rm_pat  "${2:-}"     ;;
  delete|del|rm)        cmd_delete  "${2:-}"     ;;
  help|h|--help|-h)     cmd_help                 ;;
  # Legacy / convenience shortcuts
  work|w)               cmd_switch  "work"       ;;
  personal|p)           cmd_switch  "personal"   ;;
  *)
    _err "Unknown command: '${1}'"
    cmd_help
    exit 1
    ;;
esac