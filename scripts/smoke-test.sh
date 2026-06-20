#!/bin/bash
# Comprehensive smoke test — hits every page and API route, reports HTTP codes.
# Catches 500s, compile errors, missing imports, runtime exceptions.
#
# Usage: ./smoke-test.sh [base_url]
# Default base URL: http://localhost:3000

set +e
BASE="${1:-http://localhost:3000}"
OUT="/tmp/smoke-results.txt"
> "$OUT"

# Strip Prisma query log noise from dev.log so we can see real errors
ERRORS_ONLY="/tmp/smoke-errors.txt"
> "$ERRORS_ONLY"

PAGES=(
  "/"
  "/login"
  "/discover"
  "/demo"
  "/kiosk"
  "/app"
  "/app/onboarding"
  "/app/me"
  "/app/parent"
  "/portal/test-club"
  "/join/test-token"
  "/rsvp/test-token"
  "/parent/test-token"
)

# These are routes that don't require auth and can be hit safely
# Routes that need auth/params will return 401/404/400 but should NOT 500
API_GET=(
  "/api"
  "/api/auth/me"
  "/api/clubs"
  "/api/events"
  "/api/announcements"
  "/api/polls"
  "/api/forms"
  "/api/tasks"
  "/api/badges"
  "/api/committee"
  "/api/committees"
  "/api/resources"
  "/api/inventory"
  "/api/inventory/loans"
  "/api/documents"
  "/api/meeting-minutes"
  "/api/me"
  "/api/me/parent"
  "/api/notifications"
  "/api/notifications/fake-id"
  "/api/members"
  "/api/members/bulk-import"
  "/api/volunteer-hours"
  "/api/volunteer-hours/fake-id"
  "/api/alumni"
  "/api/applications"
  "/api/applications/fake-id"
  "/api/analytics"
  "/api/audit"
  "/api/calendar/fake-club-id"
  "/api/ai-insights"
  "/api/saved-views"
  "/api/saved-views/fake-id"
  "/api/webhooks"
  "/api/webhooks/fake-id"
  "/api/api-keys"
  "/api/api-keys/fake-id"
  "/api/email/queue"
  "/api/email/templates"
  "/api/email/templates/fake-id"
  "/api/email/logs"
  "/api/email/send"
  "/api/settings"
  "/api/custom-fields"
  "/api/bulk-import"
  "/api/offboarding"
  "/api/attendance"
  "/api/attendance/checkin"
  "/api/attendance-excuses"
  "/api/attendance-excuses/fake-id"
  "/api/attendance-reminders"
  "/api/waitlist"
  "/api/waitlist/fake-id"
  "/api/maintenance"
  "/api/maintenance/fake-id"
  "/api/photo-albums"
  "/api/photo-albums/fake-id"
  "/api/photo-albums/fake-id/photos"
  "/api/document-comments"
  "/api/document-comments/fake-id"
  "/api/parent-portal"
  "/api/parent-portal/absence-excuse"
  "/api/messages/conversations"
  "/api/messages/conversations/fake-id"
  "/api/invites"
  "/api/invites/accept"
  "/api/rsvp"
  "/api/rsvp/public"
  "/api/finance"
  "/api/reports"
  "/api/digests"
  "/api/digests/send"
  "/api/export"
  "/api/kiosk"
  "/api/assistant"
  "/api/public/test-slug"
)

API_POST=(
  "/api/auth/request-magic"
  "/api/auth/verify-magic"
  "/api/auth/logout"
)

PASS=0
FAIL=0
S500=0

echo "============================================"
echo "  SMOKE TEST — $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Base: $BASE"
echo "============================================"
echo ""

echo "--- PAGES (GET) ---"
for p in "${PAGES[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE$p")
  echo "  $CODE  GET  $p" | tee -a "$OUT"
  if [ "$CODE" = "500" ]; then
    S500=$((S500+1))
    echo "  !!! 500 on $p" >> "$ERRORS_ONLY"
  fi
  if [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "308" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "--- API (GET) ---"
for p in "${API_GET[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE$p")
  echo "  $CODE  GET  $p" | tee -a "$OUT"
  if [ "$CODE" = "500" ]; then
    S500=$((S500+1))
    echo "  !!! 500 on GET $p" >> "$ERRORS_ONLY"
  fi
done

echo ""
echo "--- API (POST) ---"
for p in "${API_POST[@]}"; do
  if [ "$p" = "/api/auth/request-magic" ]; then
    BODY='{"email":"smoke@test.local"}'
  elif [ "$p" = "/api/auth/verify-magic" ]; then
    BODY='{"token":"fake-token-for-smoke-test"}'
  else
    BODY='{}'
  fi
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST -H "Content-Type: application/json" -d "$BODY" "$BASE$p")
  echo "  $CODE  POST $p" | tee -a "$OUT"
  if [ "$CODE" = "500" ]; then
    S500=$((S500+1))
    echo "  !!! 500 on POST $p" >> "$ERRORS_ONLY"
  fi
done

echo ""
echo "============================================"
echo "  Summary: $PASS pass, $FAIL non-200/3xx, $S500 server errors"
echo "  Full results: $OUT"
echo "  Errors only:  $ERRORS_ONLY"
echo "============================================"
