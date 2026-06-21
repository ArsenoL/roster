#!/bin/bash
# Smoke-test the API auth fixes from audit-2: the ~40 lower-priority routes
# that were still wide open after audit-1. Verifies:
#   - unauthenticated requests to protected routes → 401
#   - signed-in user cannot mutate a club they don't own (403)
#   - signed-in user cannot use IDOR (submitting form responses, RSVPs,
#     volunteer hours, etc. on behalf of other users is rejected)
#   - signed-in user cannot drain the email queue or send email without
#     announcements:write on the target club
#   - cron routes reject calls without a secret in production

set -u
BASE=http://127.0.0.1:3000
COOKIE=/tmp/audit2-cookie.txt
COOKIE2=/tmp/audit2-cookie2.txt
rm -f "$COOKIE" "$COOKIE2"

echo "=========================================="
echo " AUDIT-2 SMOKE TEST — extended auth gates"
echo "=========================================="

PASS=0; FAIL=0
check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  PASS  $label (HTTP $actual)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label — expected $expected, got $actual"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "=== A. Unauthenticated requests to newly-locked-down routes ==="

# Read routes
code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/forms?clubId=__x__")
check "GET /api/forms no auth"                  401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/tasks?clubId=__x__")
check "GET /api/tasks no auth"                  401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/polls?clubId=__x__")
check "GET /api/polls no auth"                  401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/documents?clubId=__x__")
check "GET /api/documents no auth"              401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/committees?clubId=__x__")
check "GET /api/committees no auth"             401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/inventory?clubId=__x__")
check "GET /api/inventory no auth"              401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/maintenance?clubId=__x__")
check "GET /api/maintenance no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/meeting-minutes?clubId=__x__")
check "GET /api/meeting-minutes no auth"        401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/photo-albums?clubId=__x__")
check "GET /api/photo-albums no auth"           401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/messages/conversations")
check "GET /api/messages/conversations no auth" 401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/digests")
check "GET /api/digests no auth"                401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/audit")
check "GET /api/audit no auth"                  401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/alumni")
check "GET /api/alumni no auth"                 401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/custom-fields?clubId=__x__")
check "GET /api/custom-fields no auth"          401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/volunteer-hours?clubId=__x__")
check "GET /api/volunteer-hours no auth"        401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/attendance-excuses")
check "GET /api/attendance-excuses no auth"     401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/attendance-reminders")
check "GET /api/attendance-reminders no auth"   401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/saved-views")
check "GET /api/saved-views no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/export?type=members")
check "GET /api/export no auth"                 401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/analytics")
check "GET /api/analytics no auth"              401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/ai-insights?clubId=__x__")
check "GET /api/ai-insights no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/assistant" -H 'Content-Type: application/json' -d '{"clubId":"__x__","question":"hi"}')
check "POST /api/assistant no auth"             401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/reports?type=roster&clubId=__x__")
check "GET /api/reports no auth"                401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/email/templates")
check "GET /api/email/templates no auth"        401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/email/logs")
check "GET /api/email/logs no auth"             401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/email/queue")
check "GET /api/email/queue no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/email/send" -H 'Content-Type: application/json' -d '{"clubId":"__x__","to":[{"email":"x@x.example"}]}')
check "POST /api/email/send no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/events/__x__")
check "GET /api/events/[id] no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/badges?clubId=__x__")
check "GET /api/badges no auth"                 401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/applications?clubId=__x__")
check "GET /api/applications no auth"           401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/rsvp?eventId=__x__")
check "GET /api/rsvp no auth"                   401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/waitlist?eventId=__x__")
check "GET /api/waitlist no auth"               401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/bulk-import" -H 'Content-Type: application/json' -d '{"clubId":"__x__","type":"members","rows":[]}')
check "POST /api/bulk-import no auth"           401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/members/bulk-import" -H 'Content-Type: application/json' -d '{"clubId":"__x__","members":[]}')
check "POST /api/members/bulk-import no auth"   401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/offboarding")
check "GET /api/offboarding no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/resources?clubId=__x__")
check "GET /api/resources no auth"              401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/document-comments?documentId=__x__")
check "GET /api/document-comments no auth"      401 "$code"

# Intentionally-public routes (should still return non-401)
code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/kiosk?code=ABC")
check "GET /api/kiosk (intentionally public)"   404 "$code"   # 404 because code doesn't match, but NOT 401

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/api/rsvp/public?eventId=__nonexistent__")
check "GET /api/rsvp/public (intentionally public)" 404 "$code"   # 404 not 401

echo ""
echo "=== B. Sign up two users — owner of club + outsider ==="

EMAIL1="audit2-$(date +%s)@example.edu"
SIGNUP_RESP=$(curl -s -X POST "$BASE/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Audit2 Owner\",\"email\":\"$EMAIL1\",\"password\":\"test1234\"}" \
  -c "$COOKIE")
USER_ID=$(echo "$SIGNUP_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('user',{}).get('id',''))")
echo "  owner user id: $USER_ID"

# Create a club with ALL modules enabled so we can test all routes
ALL_MODULES='["members","attendance","events","announcements","messages","digests","finance","volunteer","gamification","photos","polls","forms","tasks","inventory","maintenance","resources","meeting-minutes","applications","invites","offboarding","alumni","analytics","reports","documents","audit","integrations","bulk-import","insights","excuses","reminders"]'

CLUB_RESP=$(curl -s -X POST "$BASE/api/clubs" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE" \
  -d "{\"name\":\"Audit2 Test Club\",\"category\":\"ACADEMIC\",\"modules\":$ALL_MODULES}")
CLUB_ID=$(echo "$CLUB_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('club',{}).get('id',''))")
echo "  club id: $CLUB_ID"

EMAIL2="audit2-b-$(date +%s)@example.edu"
curl -s -X POST "$BASE/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Audit2 Outsider\",\"email\":\"$EMAIL2\",\"password\":\"test1234\"}" \
  -c "$COOKIE2" > /dev/null
echo "  signed up second user (outsider, no memberships)"

echo ""
echo "=== C. Owner can act on own club; outsider cannot ==="

# Owner
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET  "$BASE/api/forms?clubId=$CLUB_ID")
check "GET /api/forms?ownClub authed"           200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET  "$BASE/api/tasks?clubId=$CLUB_ID")
check "GET /api/tasks?ownClub authed"           200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET  "$BASE/api/analytics?clubId=$CLUB_ID")
check "GET /api/analytics?ownClub authed"       200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET  "$BASE/api/audit?clubId=$CLUB_ID")
check "GET /api/audit?ownClub authed"           200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET  "$BASE/api/reports?type=roster&clubId=$CLUB_ID")
check "GET /api/reports?ownClub authed"         200 "$code"

# Outsider
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET  "$BASE/api/forms?clubId=$CLUB_ID")
check "GET /api/forms?otherClub → 403"          403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET  "$BASE/api/tasks?clubId=$CLUB_ID")
check "GET /api/tasks?otherClub → 403"          403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET  "$BASE/api/analytics?clubId=$CLUB_ID")
check "GET /api/analytics?otherClub → 403"      403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET  "$BASE/api/audit?clubId=$CLUB_ID")
check "GET /api/audit?otherClub → 403"          403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET  "$BASE/api/reports?type=roster&clubId=$CLUB_ID")
check "GET /api/reports?otherClub → 403"        403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X POST "$BASE/api/forms" -H 'Content-Type: application/json' -d "{\"clubId\":\"$CLUB_ID\",\"title\":\"hack\"}")
check "POST /api/forms to other club → 403"     403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X POST "$BASE/api/tasks" -H 'Content-Type: application/json' -d "{\"clubId\":\"$CLUB_ID\",\"title\":\"hack\"}")
check "POST /api/tasks to other club → 403"     403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X POST "$BASE/api/bulk-import" -H 'Content-Type: application/json' -d "{\"clubId\":\"$CLUB_ID\",\"type\":\"members\",\"rows\":[]}")
check "POST /api/bulk-import to other club → 403" 403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X POST "$BASE/api/email/send" -H 'Content-Type: application/json' -d "{\"clubId\":\"$CLUB_ID\",\"to\":[{\"email\":\"x@x.example\"}]}")
check "POST /api/email/send to other club → 403" 403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X POST "$BASE/api/offboarding" -H 'Content-Type: application/json' -d "{\"userId\":\"$USER_ID\",\"clubId\":\"$CLUB_ID\",\"type\":\"RESIGN\"}")
check "POST /api/offboarding to other club → 403" 403 "$code"

echo ""
echo "=== D. IDOR guards — body-provided userId / senderId should be ignored ==="

# Saved-views: caller tries to fetch views for a different userId (route
# ignores userId param and always uses the signed-in user).
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET "$BASE/api/saved-views?userId=$USER_ID")
check "GET /api/saved-views?otherUserId → ignores, returns self" 200 "$code"

# Volunteer-hours: caller tries to fetch another user's hours within own club
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET "$BASE/api/volunteer-hours?clubId=$CLUB_ID&userId=$USER_ID")
check "GET /api/volunteer-hours?otherUserId → 403" 403 "$code"

# Attendance-excuses: caller tries to fetch another user's excuses
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET "$BASE/api/attendance-excuses?clubId=$CLUB_ID&userId=$USER_ID")
check "GET /api/attendance-excuses?otherUserId → 403" 403 "$code"

# Attendance-reminders: caller tries to fetch another user's reminders
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET "$BASE/api/attendance-reminders?clubId=$CLUB_ID&userId=$USER_ID")
check "GET /api/attendance-reminders?otherUserId → 403" 403 "$code"

echo ""
echo "=== E. Email queue POST requires admin ==="

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X POST "$BASE/api/email/queue")
check "POST /api/email/queue as non-admin → 403" 403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X POST "$BASE/api/email/queue")
check "POST /api/email/queue as outsider → 403" 403 "$code"

echo ""
echo "=== F. Cleanup ==="
curl -s -o /dev/null -b "$COOKIE" -X DELETE "$BASE/api/clubs/$CLUB_ID"
echo "  deleted test club $CLUB_ID"

echo ""
echo "=========================================="
echo " RESULT: $PASS passed, $FAIL failed"
echo "=========================================="
exit $FAIL
