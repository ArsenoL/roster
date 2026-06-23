#!/bin/bash
# UI Test Runner — systematically clicks through every tab and form
# Usage: bash scripts/ui-test.sh

# No set -e — we want to continue on errors

BASE="http://127.0.0.1:3000"
SHOTS="/home/z/my-project/download/ui-tests"
mkdir -p "$SHOTS"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
ERRORS=""

log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; ((PASS++)); }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1 — $2"; ((FAIL++)); ERRORS+="$1: $2\n"; }
log_warn() { echo -e "${YELLOW}⚠ WARN${NC}: $1 — $2"; ((WARN++)); }

# Helper: snapshot and extract interactive elements
snap() {
  agent-browser snapshot -i 2>&1
}

# Helper: screenshot
shot() {
  agent-browser screenshot "$SHOTS/$1.png" 2>&1 | tail -1
}

# Helper: wait for network idle
wait_idle() {
  agent-browser wait --load networkidle 2>&1 | tail -1 || true
  sleep 1
}

# Helper: click button by text
click_btn() {
  local text="$1"
  local ref=$(snap | grep -i "button \"$text\"" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -z "$ref" ]; then
    log_fail "click '$text'" "button not found"
    return 1
  fi
  agent-browser click "@$ref" 2>&1 | tail -1
  wait_idle
  log_pass "click '$text'"
}

# Helper: fill field by label
fill_field() {
  local label="$1"
  local value="$2"
  local ref=$(snap | grep -i "textbox \"$label\"" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -z "$ref" ]; then
    ref=$(snap | grep -i "label \"$label\"" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  fi
  if [ -z "$ref" ]; then
    log_fail "fill '$label'" "field not found"
    return 1
  fi
  agent-browser fill "@$ref" "$value" 2>&1 | tail -1
  log_pass "fill '$label' with '$value'"
}

echo "============================================"
echo "  Roster UI Test Suite"
echo "============================================"
echo ""

# --- Already logged in from previous state ---
echo "1. Verify dashboard loaded"
agent-browser open "$BASE/app" 2>&1 | tail -1
wait_idle
URL=$(agent-browser get url 2>&1 | tail -1)
if echo "$URL" | grep -q "/app"; then
  log_pass "dashboard" "on $URL"
else
  log_fail "dashboard" "redirected to $URL"
fi
shot "01-dashboard"

echo ""
echo "2. Test each tab — verify it renders"

TABS=(
  "Dashboard"
  "Take attendance"
  "Absence excuses"
  "Reminders"
  "Announcements"
  "Tasks"
  "Assistant"
  "Members"
  "Applications"
  "Invites"
  "Offboarding"
  "Alumni"
  "Events"
  "Meeting minutes"
  "Polls & elections"
  "Resources"
  "Finance"
  "Volunteer hours"
  "Inventory"
  "Maintenance"
  "Communications"
  "Messages"
  "Email digests"
  "Gamification"
  "Photo albums"
  "Forms & surveys"
  "Analytics"
  "Reports"
  "Documents"
  "Audit log"
  "Clubs"
  "Settings"
  "Integrations"
  "Bulk import"
)

TAB_IDX=2
for tab in "${TABS[@]}"; do
  echo ""
  echo "--- Tab $TAB_IDX: $tab ---"
  idx=$(printf "%02d" $TAB_IDX)
  
  # Click the tab
  ref=$(snap | grep "button \"$tab\"" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -z "$ref" ]; then
    log_fail "tab '$tab'" "button not found"
    ((TAB_IDX++))
    continue
  fi
  
  agent-browser click "@$ref" 2>&1 | tail -1
  wait_idle
  
  # Screenshot
  shot "$idx-$(echo "$tab" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
  
  # Check for error messages on the page
  errors=$(agent-browser eval "document.body.innerText" 2>&1 | grep -i "error\|failed\|exception" | head -3)
  if [ -n "$errors" ]; then
    log_warn "tab '$tab'" "page contains error text: $errors"
  else
    log_pass "tab '$tab'" "rendered"
  fi
  
  # Check for loading states that never resolved
  loading=$(agent-browser eval "document.querySelectorAll('[class*=\"animate-spin\"]').length" 2>&1 | tail -1)
  if [ "$loading" != "0" ] && [ -n "$loading" ]; then
    log_warn "tab '$tab'" "has $loading spinners (might be stuck loading)"
  fi
  
  ((TAB_IDX++))
done

echo ""
echo "============================================"
echo "  Test Summary"
echo "============================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo ""

if [ -n "$ERRORS" ]; then
  echo "=== Failures ==="
  echo -e "$ERRORS"
fi

echo ""
echo "Screenshots saved to: $SHOTS"
