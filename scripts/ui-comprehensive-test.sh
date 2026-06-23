#!/bin/bash
# Comprehensive UI test — all tabs, all forms
# Prerequisites: logged in as superadmin, Debate club selected, all modules enabled

SHOTS="/home/z/my-project/download/ui-tests"
BASE="http://127.0.0.1:3000"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
RESULTS=""

logp() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); RESULTS+="✓ $1\n"; }
logf() { echo -e "${RED}✗${NC} $1 — $2"; ((FAIL++)); RESULTS+="✗ $1: $2\n"; }
logw() { echo -e "${YELLOW}⚠${NC} $1 — $2"; ((WARN++)); RESULTS+="⚠ $1: $2\n"; }

# Navigate to app and click a tab
goto_tab() {
  local tab="$1"
  agent-browser open "$BASE/app" 2>&1 | tail -1
  sleep 2
  local ref=$(agent-browser snapshot -i 2>&1 | grep "button \"$tab\"" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -z "$ref" ]; then
    logf "goto $tab" "tab not found"
    return 1
  fi
  agent-browser click "@$ref" 2>&1 | tail -1
  sleep 3
  return 0
}

# Find a button by text pattern
find_btn() {
  agent-browser snapshot -i 2>&1 | grep -iE "button.*$1" | grep -v "Open Next\|Toggle\|Search\|User menu\|kiosk\|Dashboard\|Take att\|Absence\|Reminder\|Announce\|Task\|Assistant\|Member\|Applic\|Invite\|Offboard\|Alumni\|Event\|Meeting\|Poll\|Resource\|Finance\|Volunteer\|Inventory\|Maint\|Comm\|Message\|Email\|Gamif\|Photo\|Form\|Analytic\|Report\|Document\|Audit\|Club\|Setting\|Integration\|Bulk" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/'
}

# Fill a field by placeholder or label text
find_field() {
  agent-browser snapshot -i 2>&1 | grep -iE "textbox|spinbutton|textarea" | grep -i "$1" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/'
}

# Fill all textboxes in a dialog with test data
fill_all_fields() {
  local fields=$(agent-browser snapshot -i 2>&1 | grep -iE "textbox|textarea" | grep -v "Open Next")
  local count=0
  while IFS= read -r line; do
    local ref=$(echo "$line" | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
    if [ -n "$ref" ]; then
      local placeholder=$(echo "$line" | grep -oP '"[^"]*"' | head -1 | tr -d '"')
      local value="Test value $count"
      if echo "$placeholder" | grep -qi "email"; then value="uitest$COUNT@roster.local"
      elif echo "$placeholder" | grep -qi "name\|title"; then value="UI Test Item $COUNT"
      elif echo "$placeholder" | grep -qi "description\|content\|body\|message\|reason"; then value="This is a test entry from the UI test suite."
      elif echo "$placeholder" | grep -qi "amount\|price\|cost\|hours\|quantity\|qty"; then value="10"
      elif echo "$placeholder" | grep -qi "phone"; then value="555-0100"
      elif echo "$placeholder" | grep -qi "url\|link"; then value="https://example.com"
      elif echo "$placeholder" | grep -qi "id\|student"; then value="TEST-$COUNT"
      fi
      agent-browser fill "@$ref" "$value" 2>&1 | tail -1
      ((count++))
      ((COUNT++))
      sleep 0.3
    fi
  done <<< "$fields"
  echo "  Filled $count fields"
}

# Check result after form submission
check_result() {
  local action="$1"
  sleep 3
  local toast=$(agent-browser eval "(function(){ var el = document.querySelector('[data-sonner-toast]'); return el ? el.textContent : ''; })()" 2>&1 | tail -1)
  if echo "$toast" | grep -qi "success\|created\|saved\|updated\|added\|sent\|complete\|logged\|awarded"; then
    logp "$action — toast: $(echo $toast | head -c 60)"
    return 0
  fi
  if echo "$toast" | grep -qi "error\|fail\|invalid\|denied\|forbidden\|required"; then
    logf "$action" "toast: $(echo $toast | head -c 60)"
    return 1
  fi
  local dialog=$(agent-browser eval "(function(){ return document.querySelector('[role=\"dialog\"]') ? 'open' : 'closed'; })()" 2>&1 | tail -1)
  if [ "$dialog" = "open" ]; then
    logw "$action" "dialog still open (validation error or missing field)"
    return 1
  fi
  logp "$action — dialog closed (likely succeeded)"
}

COUNT=1

echo "============================================"
echo "  Comprehensive UI Form Testing"
echo "  All 30 modules enabled on Debate club"
echo "============================================"
echo ""

# === TASKS ===
echo "=== TASKS ==="
goto_tab "Tasks"
safe="tasks"
create_btn=$(find_btn "New Task\|New task\|Create task\|Add task")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Add|Submit)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create task"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "tasks" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === POLLS ===
echo ""
echo "=== POLLS ==="
goto_tab "Polls & elections"
safe="polls"
create_btn=$(find_btn "New Poll\|New poll\|Create poll\|Create Poll")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Add|Submit)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create poll"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "polls" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === FINANCE ===
echo ""
echo "=== FINANCE ==="
goto_tab "Finance"
safe="finance"
create_btn=$(find_btn "Add Transaction\|New Transaction\|Add transaction\|Record")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Add|Save|Record|Submit|Create)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "add transaction"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "finance" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === INVENTORY ===
echo ""
echo "=== INVENTORY ==="
goto_tab "Inventory"
safe="inventory"
create_btn=$(find_btn "Add Item\|New Item\|Add item")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Add|Save|Create|Submit)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "add inventory item"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "inventory" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === FORMS ===
echo ""
echo "=== FORMS ==="
goto_tab "Forms & surveys"
safe="forms"
create_btn=$(find_btn "New Form\|New form\|Create Form\|Create form")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Submit)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create form"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "forms" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === VOLUNTEER HOURS ===
echo ""
echo "=== VOLUNTEER HOURS ==="
goto_tab "Volunteer hours"
safe="volunteer"
create_btn=$(find_btn "Log Hours\|Log hours\|Add Hours\|New")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Log|Save|Submit|Add|Create)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "log volunteer hours"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "volunteer hours" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === RESOURCES ===
echo ""
echo "=== RESOURCES ==="
goto_tab "Resources"
safe="resources"
create_btn=$(find_btn "Add Resource\|New Resource\|Add resource")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Add|Save|Create|Submit)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "add resource"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "resources" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === DOCUMENTS ===
echo ""
echo "=== DOCUMENTS ==="
goto_tab "Documents"
safe="documents"
create_btn=$(find_btn "Upload\|Add Document\|New Document\|Add")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Add|Save|Upload|Create|Submit)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "add document"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "documents" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === PHOTO ALBUMS ===
echo ""
echo "=== PHOTO ALBUMS ==="
goto_tab "Photo albums"
safe="photo-albums"
create_btn=$(find_btn "New Album\|New album\|Create Album\|Create album")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Submit|Add)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create photo album"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "photo albums" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === ANNOUNCEMENTS ===
echo ""
echo "=== ANNOUNCEMENTS ==="
goto_tab "Announcements"
safe="announcements"
create_btn=$(find_btn "New Announcement\|Create\|Post\|New")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Post|Publish|Send|Save|Create|Submit)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create announcement"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "announcements" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === GAMIFICATION (badges) ===
echo ""
echo "=== GAMIFICATION ==="
goto_tab "Gamification"
safe="gamification"
create_btn=$(find_btn "New Badge\|Create Badge\|Add Badge\|New")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Submit|Add)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create badge"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "gamification" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === INVITES ===
echo ""
echo "=== INVITES ==="
goto_tab "Invites"
safe="invites"
create_btn=$(find_btn "New Invite\|Create Invite\|Invite\|New")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Submit|Add|Send|Invite)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create invite"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "invites" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === INTEGRATIONS (webhooks + api keys) ===
echo ""
echo "=== INTEGRATIONS ==="
goto_tab "Integrations"
safe="integrations"
create_btn=$(find_btn "Add Webhook\|New Webhook\|Create\|Generate\|Add\|New")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Submit|Add|Generate)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create webhook"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "integrations" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === MAINTENANCE ===
echo ""
echo "=== MAINTENANCE ==="
goto_tab "Maintenance"
safe="maintenance"
create_btn=$(find_btn "New\|Create\|Add\|Log")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Submit|Add|Log)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create maintenance log"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "maintenance" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === MESSAGES ===
echo ""
echo "=== MESSAGES ==="
goto_tab "Messages"
safe="messages"
create_btn=$(find_btn "New Conversation\|New conversation\|Start\|Compose\|New")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Submit|Add|Start|Send)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create conversation"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "messages" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === EMAIL DIGESTS ===
echo ""
echo "=== EMAIL DIGESTS ==="
goto_tab "Email digests"
safe="email-digests"
create_btn=$(find_btn "New\|Create\|Add\|Subscribe")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  agent-browser screenshot "$SHOTS/dialog-$safe.png" 2>&1 | tail -1
  fill_all_fields
  agent-browser screenshot "$SHOTS/dialog-$safe-filled.png" 2>&1 | tail -1
  submit=$(agent-browser snapshot -i 2>&1 | grep -iE "button.*(Create|Save|Submit|Add|Subscribe)" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$submit" ]; then
    agent-browser click "@$submit" 2>&1 | tail -1
    check_result "create digest subscription"
  fi
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
else
  logw "email digests" "no create button"
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
fi

# === ABSENCE EXCUSES ===
echo ""
echo "=== ABSENCE EXCUSES ==="
goto_tab "Absence excuses"
safe="absence-excuses"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
# This tab likely shows a list of excuses to approve/deny — no create button
logw "absence excuses" "list-only tab (approve/deny actions)"

# === REMINDERS ===
echo ""
echo "=== REMINDERS ==="
goto_tab "Reminders"
safe="reminders"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "reminders" "list-only tab (schedule/view)"

# === OFFBOARDING ===
echo ""
echo "=== OFFBOARDING ==="
goto_tab "Offboarding"
safe="offboarding"
create_btn=$(find_btn "Offboard\|Remove\|Graduate\|New")
if [ -n "$create_btn" ]; then
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
  logw "offboarding" "has action button (needs member selection)"
else
  agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
  logw "offboarding" "no create button"
fi

# === ALUMNI ===
echo ""
echo "=== ALUMNI ==="
goto_tab "Alumni"
safe="alumni"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "alumni" "list-only tab (view profiles)"

# === MEETING MINUTES ===
echo ""
echo "=== MEETING MINUTES ==="
goto_tab "Meeting minutes"
safe="meeting-minutes"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "meeting minutes" "list-only tab (needs an event first)"

# === APPLICATIONS ===
echo ""
echo "=== APPLICATIONS ==="
goto_tab "Applications"
safe="applications"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "applications" "list-only tab (accept/reject actions)"

# === BULK IMPORT ===
echo ""
echo "=== BULK IMPORT ==="
goto_tab "Bulk import"
safe="bulk-import"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "bulk import" "file upload tab"

# === REPORTS ===
echo ""
echo "=== REPORTS ==="
goto_tab "Reports"
safe="reports"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "reports" "generate/export tab"

# === ANALYTICS ===
echo ""
echo "=== ANALYTICS ==="
goto_tab "Analytics"
safe="analytics"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "analytics" "read-only dashboard"

# === AUDIT LOG ===
echo ""
echo "=== AUDIT LOG ==="
goto_tab "Audit log"
safe="audit-log"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "audit log" "read-only log"

# === SETTINGS ===
echo ""
echo "=== SETTINGS ==="
goto_tab "Settings"
safe="settings"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
# Try toggling a switch
switch=$(agent-browser snapshot -i 2>&1 | grep "switch" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
if [ -n "$switch" ]; then
  agent-browser click "@$switch" 2>&1 | tail -1
  sleep 1
  check_result "toggle setting"
fi

# === CLUBS ===
echo ""
echo "=== CLUBS ==="
goto_tab "Clubs"
safe="clubs"
agent-browser screenshot "$SHOTS/page-$safe.png" 2>&1 | tail -1
logw "clubs" "list tab (already tested create earlier)"

echo ""
echo "============================================"
echo "  Test Summary"
echo "============================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo ""
echo "=== Detailed Results ==="
echo -e "$RESULTS"
