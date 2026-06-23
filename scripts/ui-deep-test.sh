#!/bin/bash
# Deep form testing — fills every form on every tab
# Assumes we're already logged in and on /app with a club selected

BASE="http://127.0.0.1:3000"
SHOTS="/home/z/my-project/download/ui-tests"
mkdir -p "$SHOTS"

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

# Get all interactive elements
snap() { agent-browser snapshot -i 2>&1; }

# Find ref by button text (substring match)
find_btn() {
  local text="$1"
  snap | grep -i "button" | grep -i "$text" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/'
}

# Find ref by textbox label
find_input() {
  local label="$1"
  snap | grep -i "textbox" | grep -i "$label" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/'
}

# Find ref by any text
find_any() {
  local text="$1"
  snap | grep -i "$text" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/'
}

# Click button by text
click() {
  local text="$1"
  local ref=$(find_btn "$text")
  if [ -z "$ref" ]; then
    logf "click '$text'" "not found"
    return 1
  fi
  agent-browser click "@$ref" 2>&1 | tail -1
  sleep 2
}

# Fill input by label
fill() {
  local label="$1"
  local value="$2"
  local ref=$(find_input "$label")
  if [ -z "$ref" ]; then
    logf "fill '$label'" "not found"
    return 1
  fi
  agent-browser fill "@$ref" "$value" 2>&1 | tail -1
  sleep 0.5
}

# Check for toast/error/success messages after an action
check_result() {
  local action="$1"
  sleep 2
  # Check for success/error toast (Sonner toasts use [data-sonner-toast])
  local toast=$(agent-browser eval "(function(){ var el = document.querySelector('[data-sonner-toast], [class*=\"sonner\"], [role=\"status\"], [role=\"alert\"]'); return el ? el.textContent : ''; })()" 2>&1 | tail -1)
  if echo "$toast" | grep -qi "success\|created\|saved\|updated\|added\|sent\|complete"; then
    logp "$action — toast: $(echo $toast | head -c 80)"
    return 0
  fi
  if echo "$toast" | grep -qi "error\|fail\|invalid\|denied\|forbidden"; then
    logf "$action" "error toast: $(echo $toast | head -c 80)"
    return 1
  fi
  # No toast — check if dialog is still open (validation error)
  local dialog=$(agent-browser eval "(function(){ return document.querySelector('[role=\"dialog\"]') ? 'open' : 'closed'; })()" 2>&1 | tail -1)
  if [ "$dialog" = "open" ]; then
    logw "$action" "dialog still open (validation error or missing field)"
    return 1
  fi
  logp "$action — no toast (may have succeeded silently)"
}

# Close any open dialog
close_dialog() {
  # Try Escape first
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
  # Look for close/cancel button
  local ref=$(snap | grep -i "button" | grep -iE "close|cancel|×|✕|dismiss" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -n "$ref" ]; then
    agent-browser click "@$ref" 2>&1 | tail -1
    sleep 1
  fi
  # Press Escape again for good measure
  agent-browser press Escape 2>&1 | tail -1
  sleep 1
}

# Navigate to a tab by clicking its sidebar button
goto_tab() {
  local tab_name="$1"
  # First make sure we're on /app
  agent-browser open "$BASE/app" 2>&1 | tail -1
  sleep 2
  # Find and click the tab
  local ref=$(snap | grep "button \"$tab_name\"" | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
  if [ -z "$ref" ]; then
    logf "goto '$tab_name'" "tab not found in sidebar"
    return 1
  fi
  agent-browser click "@$ref" 2>&1 | tail -1
  sleep 2
  return 0
}

echo "============================================"
echo "  Deep Form Testing"
echo "============================================"

# ============================================================
# CLUBS TAB — create a new club
# ============================================================
echo ""
echo "=== CLUBS TAB ==="
goto_tab "Clubs"
sleep 2
agent-browser screenshot "$SHOTS/form-clubs.png" 2>&1 | tail -1

# Click "Create club" or "New club" button
create_btn=$(find_btn "Create\|New club\|Add club\|+ Club")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  echo "  Dialog opened — filling club form..."
  snap | head -30
  
  # Fill club name
  name_ref=$(find_input "name\|Name\|Club name")
  if [ -n "$name_ref" ]; then
    agent-browser fill "@$name_ref" "Test Chess Club" 2>&1 | tail -1
  fi
  
  # Fill description
  desc_ref=$(find_input "description\|Description")
  if [ -n "$desc_ref" ]; then
    agent-browser fill "@$desc_ref" "A club for testing chess strategies" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-clubs-dialog.png" 2>&1 | tail -1
  
  # Try to submit
  submit_ref=$(find_btn "Create\|Save\|Submit")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "create club"
  fi
  close_dialog
else
  logw "clubs" "no create button found"
fi

# ============================================================
# MEMBERS TAB — add a member
# ============================================================
echo ""
echo "=== MEMBERS TAB ==="
goto_tab "Members"
sleep 2
agent-browser screenshot "$SHOTS/form-members.png" 2>&1 | tail -1

add_btn=$(find_btn "Add member\|Add\|Invite\|+ Member\|New member")
if [ -n "$add_btn" ]; then
  agent-browser click "@$add_btn" 2>&1 | tail -1
  sleep 2
  echo "  Dialog opened — filling member form..."
  snap | head -30
  
  email_ref=$(find_input "email\|Email")
  if [ -n "$email_ref" ]; then
    agent-browser fill "@$email_ref" "testmember@chess.local" 2>&1 | tail -1
  fi
  name_ref=$(find_input "name\|Name")
  if [ -n "$name_ref" ]; then
    agent-browser fill "@$name_ref" "Test Member" 2>&1 | tail -1
  fi
  grade_ref=$(find_input "grade\|Grade")
  if [ -n "$grade_ref" ]; then
    agent-browser fill "@$grade_ref" "10" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-members-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Add\|Save\|Submit\|Create")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "add member"
  fi
  close_dialog
else
  logw "members" "no add button found"
fi

# ============================================================
# EVENTS TAB — create an event
# ============================================================
echo ""
echo "=== EVENTS TAB ==="
goto_tab "Events"
sleep 2
agent-browser screenshot "$SHOTS/form-events.png" 2>&1 | tail -1

create_btn=$(find_btn "Create event\|New event\|+ Event\|Add event")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  echo "  Dialog opened — filling event form..."
  snap | head -40
  
  title_ref=$(find_input "title\|Title\|Event title\|name")
  if [ -n "$title_ref" ]; then
    agent-browser fill "@$title_ref" "Test Meeting" 2>&1 | tail -1
  fi
  
  # Try to fill start/end time
  start_ref=$(find_input "start\|Start\|begins\|date\|Date")
  if [ -n "$start_ref" ]; then
    agent-browser fill "@$start_ref" "2026-06-25T15:00" 2>&1 | tail -1
  fi
  
  end_ref=$(find_input "end\|End\|ends")
  if [ -n "$end_ref" ]; then
    agent-browser fill "@$end_ref" "2026-06-25T16:00" 2>&1 | tail -1
  fi
  
  loc_ref=$(find_input "location\|Location\|room\|Room")
  if [ -n "$loc_ref" ]; then
    agent-browser fill "@$loc_ref" "Room 101" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-events-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Create\|Save\|Submit")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "create event"
  fi
  close_dialog
else
  logw "events" "no create button found"
fi

# ============================================================
# ANNOUNCEMENTS TAB — create an announcement
# ============================================================
echo ""
echo "=== ANNOUNCEMENTS TAB ==="
goto_tab "Announcements"
sleep 2
agent-browser screenshot "$SHOTS/form-announcements.png" 2>&1 | tail -1

create_btn=$(find_btn "New announcement\|Create\|Post\|+ Announcement")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  title_ref=$(find_input "title\|Title\|Subject")
  if [ -n "$title_ref" ]; then
    agent-browser fill "@$title_ref" "Test Announcement" 2>&1 | tail -1
  fi
  content_ref=$(find_input "content\|Content\|message\|Message\|body")
  if [ -n "$content_ref" ]; then
    agent-browser fill "@$content_ref" "This is a test announcement for UI testing." 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-announcements-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Post\|Publish\|Send\|Save\|Create\|Submit")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "create announcement"
  fi
  close_dialog
else
  logw "announcements" "no create button found"
fi

# ============================================================
# TASKS TAB — create a task
# ============================================================
echo ""
echo "=== TASKS TAB ==="
goto_tab "Tasks"
sleep 2
agent-browser screenshot "$SHOTS/form-tasks.png" 2>&1 | tail -1

create_btn=$(find_btn "New task\|Create task\|+ Task\|Add task")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  title_ref=$(find_input "title\|Title\|task\|Task")
  if [ -n "$title_ref" ]; then
    agent-browser fill "@$title_ref" "Test Task" 2>&1 | tail -1
  fi
  desc_ref=$(find_input "description\|Description\|details\|Details")
  if [ -n "$desc_ref" ]; then
    agent-browser fill "@$desc_ref" "A test task for UI testing" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-tasks-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Create\|Save\|Submit\|Add")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "create task"
  fi
  close_dialog
else
  logw "tasks" "no create button found"
fi

# ============================================================
# POLLS TAB — create a poll
# ============================================================
echo ""
echo "=== POLLS TAB ==="
goto_tab "Polls"
sleep 2
agent-browser screenshot "$SHOTS/form-polls.png" 2>&1 | tail -1

create_btn=$(find_btn "New poll\|Create poll\|+ Poll\|Create")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  title_ref=$(find_input "title\|Title\|question\|Question")
  if [ -n "$title_ref" ]; then
    agent-browser fill "@$title_ref" "Test Poll: What's your favorite color?" 2>&1 | tail -1
  fi
  
  # Poll options might be multiple textboxes
  opt_ref=$(find_input "option\|Option\|choice\|Choice")
  if [ -n "$opt_ref" ]; then
    agent-browser fill "@$opt_ref" "Red" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-polls-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Create\|Save\|Submit")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "create poll"
  fi
  close_dialog
else
  logw "polls" "no create button found"
fi

# ============================================================
# FINANCE TAB — add a transaction
# ============================================================
echo ""
echo "=== FINANCE TAB ==="
goto_tab "Finance"
sleep 2
agent-browser screenshot "$SHOTS/form-finance.png" 2>&1 | tail -1

create_btn=$(find_btn "Add transaction\|New transaction\|+ Transaction\|Record")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  desc_ref=$(find_input "description\|Description")
  if [ -n "$desc_ref" ]; then
    agent-browser fill "@$desc_ref" "Test transaction" 2>&1 | tail -1
  fi
  amount_ref=$(find_input "amount\|Amount")
  if [ -n "$amount_ref" ]; then
    agent-browser fill "@$amount_ref" "25.00" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-finance-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Add\|Save\|Record\|Submit\|Create")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "add transaction"
  fi
  close_dialog
else
  logw "finance" "no create button found"
fi

# ============================================================
# INVENTORY TAB — add an item
# ============================================================
echo ""
echo "=== INVENTORY TAB ==="
goto_tab "Inventory"
sleep 2
agent-browser screenshot "$SHOTS/form-inventory.png" 2>&1 | tail -1

create_btn=$(find_btn "Add item\|New item\|+ Item\|Add")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  name_ref=$(find_input "name\|Name")
  if [ -n "$name_ref" ]; then
    agent-browser fill "@$name_ref" "Test Chess Board" 2>&1 | tail -1
  fi
  qty_ref=$(find_input "quantity\|Quantity\|qty")
  if [ -n "$qty_ref" ]; then
    agent-browser fill "@$qty_ref" "5" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-inventory-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Add\|Save\|Create\|Submit")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "add inventory item"
  fi
  close_dialog
else
  logw "inventory" "no create button found"
fi

# ============================================================
# FORMS TAB — create a form
# ============================================================
echo ""
echo "=== FORMS TAB ==="
goto_tab "Forms"
sleep 2
agent-browser screenshot "$SHOTS/form-forms.png" 2>&1 | tail -1

create_btn=$(find_btn "New form\|Create form\|+ Form\|Create")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  title_ref=$(find_input "title\|Title\|name\|Name")
  if [ -n "$title_ref" ]; then
    agent-browser fill "@$title_ref" "Test Feedback Form" 2>&1 | tail -1
  fi
  desc_ref=$(find_input "description\|Description")
  if [ -n "$desc_ref" ]; then
    agent-browser fill "@$desc_ref" "Please share your feedback" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-forms-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Create\|Save\|Submit")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "create form"
  fi
  close_dialog
else
  logw "forms" "no create button found"
fi

# ============================================================
# VOLUNTEER HOURS TAB — log hours
# ============================================================
echo ""
echo "=== VOLUNTEER HOURS TAB ==="
goto_tab "Volunteer hours"
sleep 2
agent-browser screenshot "$SHOTS/form-volunteer.png" 2>&1 | tail -1

create_btn=$(find_btn "Log hours\|Add hours\|New entry\|+ Hours\|Log")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  hours_ref=$(find_input "hours\|Hours")
  if [ -n "$hours_ref" ]; then
    agent-browser fill "@$hours_ref" "3" 2>&1 | tail -1
  fi
  desc_ref=$(find_input "description\|Description\|activity\|Activity")
  if [ -n "$desc_ref" ]; then
    agent-browser fill "@$desc_ref" "Tutoring at the library" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-volunteer-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Log\|Save\|Submit\|Add\|Create")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "log volunteer hours"
  fi
  close_dialog
else
  logw "volunteer hours" "no create button found"
fi

# ============================================================
# RESOURCES TAB — add a resource
# ============================================================
echo ""
echo "=== RESOURCES TAB ==="
goto_tab "Resources"
sleep 2
agent-browser screenshot "$SHOTS/form-resources.png" 2>&1 | tail -1

create_btn=$(find_btn "Add resource\|New resource\|+ Resource\|Add")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  name_ref=$(find_input "name\|Name")
  if [ -n "$name_ref" ]; then
    agent-browser fill "@$name_ref" "Test Meeting Room" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-resources-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Add\|Save\|Create\|Submit")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "add resource"
  fi
  close_dialog
else
  logw "resources" "no create button found"
fi

# ============================================================
# DOCUMENTS TAB — add a document
# ============================================================
echo ""
echo "=== DOCUMENTS TAB ==="
goto_tab "Documents"
sleep 2
agent-browser screenshot "$SHOTS/form-documents.png" 2>&1 | tail -1

create_btn=$(find_btn "Upload\|Add document\|New document\|+ Document\|Add")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  title_ref=$(find_input "title\|Title\|name\|Name")
  if [ -n "$title_ref" ]; then
    agent-browser fill "@$title_ref" "Test Document" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-documents-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Add\|Save\|Upload\|Create\|Submit")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "add document"
  fi
  close_dialog
else
  logw "documents" "no create button found"
fi

# ============================================================
# PHOTO ALBUMS TAB — create an album
# ============================================================
echo ""
echo "=== PHOTO ALBUMS TAB ==="
goto_tab "Photo albums"
sleep 2
agent-browser screenshot "$SHOTS/form-photo-albums.png" 2>&1 | tail -1

create_btn=$(find_btn "New album\|Create album\|+ Album\|Add album\|Create")
if [ -n "$create_btn" ]; then
  agent-browser click "@$create_btn" 2>&1 | tail -1
  sleep 2
  snap | head -30
  
  title_ref=$(find_input "title\|Title\|name\|Name")
  if [ -n "$title_ref" ]; then
    agent-browser fill "@$title_ref" "Test Photo Album" 2>&1 | tail -1
  fi
  
  agent-browser screenshot "$SHOTS/form-photo-albums-dialog.png" 2>&1 | tail -1
  
  submit_ref=$(find_btn "Create\|Save\|Submit\|Add")
  if [ -n "$submit_ref" ]; then
    agent-browser click "@$submit_ref" 2>&1 | tail -1
    sleep 3
    check_result "create photo album"
  fi
  close_dialog
else
  logw "photo albums" "no create button found"
fi

# ============================================================
# MEETING MINUTES TAB
# ============================================================
echo ""
echo "=== MEETING MINUTES TAB ==="
goto_tab "Meeting minutes"
sleep 2
agent-browser screenshot "$SHOTS/form-meeting-minutes.png" 2>&1 | tail -1

# ============================================================
# COMMITTEES — via settings or tasks
# ============================================================
echo ""
echo "=== ANALYTICS TAB ==="
goto_tab "Analytics"
sleep 2
agent-browser screenshot "$SHOTS/form-analytics.png" 2>&1 | tail -1

echo ""
echo "=== REPORTS TAB ==="
goto_tab "Reports"
sleep 2
agent-browser screenshot "$SHOTS/form-reports.png" 2>&1 | tail -1

echo ""
echo "=== AUDIT LOG TAB ==="
goto_tab "Audit log"
sleep 2
agent-browser screenshot "$SHOTS/form-audit-log.png" 2>&1 | tail -1

echo ""
echo "=== SETTINGS TAB ==="
goto_tab "Settings"
sleep 2
agent-browser screenshot "$SHOTS/form-settings.png" 2>&1 | tail -1

echo ""
echo "=== INTEGRATIONS TAB ==="
goto_tab "Integrations"
sleep 2
agent-browser screenshot "$SHOTS/form-integrations.png" 2>&1 | tail -1

echo ""
echo "=== BULK IMPORT TAB ==="
goto_tab "Bulk import"
sleep 2
agent-browser screenshot "$SHOTS/form-bulk-import.png" 2>&1 | tail -1

echo ""
echo "============================================"
echo "  Deep Form Test Summary"
echo "============================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo ""
echo "=== Detailed Results ==="
echo -e "$RESULTS"
