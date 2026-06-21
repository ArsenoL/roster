#!/bin/bash
# Smoke-test the API auth fixes from the audit:
#   - unauthenticated requests to protected routes → 401
#   - signed-in user can still use their own club's data
#   - signed-in user cannot mutate a club they don't own (403)

set -u
BASE=http://127.0.0.1:3000
COOKIE=/tmp/audit-cookie.txt
rm -f "$COOKIE"

echo "=========================================="
echo " AUDIT SMOKE TEST — auth gates on API"
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
echo "=== A. Unauthenticated requests should be rejected ==="

code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/clubs/__nonexistent__")
check "DELETE /api/clubs/[id] no auth"        401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/clubs/__x__" -H 'Content-Type: application/json' -d '{}')
check "PATCH /api/clubs/[id] no auth"         401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET  "$BASE/api/clubs")
check "GET /api/clubs (public list, still ok)" 200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET  "$BASE/api/members")
check "GET /api/members no auth"              401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET  "$BASE/api/events")
check "GET /api/events no auth"               401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET  "$BASE/api/notifications")
check "GET /api/notifications no auth"        401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET  "$BASE/api/api-keys")
check "GET /api/api-keys no auth"             401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/api-keys" -H 'Content-Type: application/json' -d '{"name":"x"}')
check "POST /api/api-keys no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X GET  "$BASE/api/webhooks")
check "GET /api/webhooks no auth"             401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/webhooks" -H 'Content-Type: application/json' -d '{"clubId":"__x__","name":"x","url":"https://evil.example/","events":[]}')
check "POST /api/webhooks no auth"            401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/badges/award" -H 'Content-Type: application/json' -d '{"badgeId":"__x__","userIds":["__x__"]}')
check "POST /api/badges/award no auth"        401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/settings" -H 'Content-Type: application/json' -d '{"clubId":"__x__"}')
check "PATCH /api/settings no auth"           401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/attendance" -H 'Content-Type: application/json' -d '{"eventId":"__x__","userId":"__x__","status":"PRESENT"}')
check "POST /api/attendance no auth"          401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/announcements" -H 'Content-Type: application/json' -d '{"clubId":"__x__","title":"x","content":"x"}')
check "POST /api/announcements no auth"       401 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/finance" -H 'Content-Type: application/json' -d '{"clubId":"__x__","type":"EXPENSE","category":"x","amount":"10"}')
check "POST /api/finance no auth"             401 "$code"

echo ""
echo "=== B. Sign up a fresh test user and verify authed access ==="

EMAIL="audit-test-$(date +%s)@example.edu"
SIGNUP_RESP=$(curl -s -X POST "$BASE/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Audit Test\",\"email\":\"$EMAIL\",\"password\":\"test1234\"}" \
  -c "$COOKIE")
echo "  signup response: $(echo "$SIGNUP_RESP" | head -c 200)"
USER_ID=$(echo "$SIGNUP_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('user',{}).get('id',''))")
echo "  user id: $USER_ID"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" "$BASE/api/auth/me")
check "GET /api/auth/me with cookie"          200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" "$BASE/api/notifications")
check "GET /api/notifications with cookie"    200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" "$BASE/api/me")
check "GET /api/me with cookie"               200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET "$BASE/api/events")
check "GET /api/events with cookie (empty memberships)" 200 "$code"

echo ""
echo "=== C. Onboarding flow — create a club (this user becomes PRESIDENT) ==="

CLUB_RESP=$(curl -s -X POST "$BASE/api/clubs" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE" \
  -d '{"name":"Audit Test Club","category":"ACADEMIC"}')
CLUB_ID=$(echo "$CLUB_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('club',{}).get('id',''))")
echo "  club id: $CLUB_ID"

# Now this user is president of CLUB_ID. They should be able to:
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET  "$BASE/api/members?clubId=$CLUB_ID")
check "GET /api/members?ownClub authed"       200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET  "$BASE/api/events?clubId=$CLUB_ID")
check "GET /api/events?ownClub authed"        200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X GET  "$BASE/api/settings?clubId=$CLUB_ID")
check "GET /api/settings?ownClub authed"      200 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X PATCH "$BASE/api/clubs/$CLUB_ID" -H 'Content-Type: application/json' -d '{"description":"updated"}')
check "PATCH /api/clubs/[id] own club"        200 "$code"

echo ""
echo "=== D. Cross-club access should be 403 (sign up a second user, try to touch the first user's club) ==="

COOKIE2=/tmp/audit-cookie2.txt
rm -f "$COOKIE2"
EMAIL2="audit-test2-$(date +%s)@example.edu"
curl -s -X POST "$BASE/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Audit Test 2\",\"email\":\"$EMAIL2\",\"password\":\"test1234\"}" \
  -c "$COOKIE2" > /dev/null

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET "$BASE/api/members?clubId=$CLUB_ID")
check "GET /api/members?otherClub → 403"      403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X GET "$BASE/api/settings?clubId=$CLUB_ID")
check "GET /api/settings?otherClub → 403"     403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X PATCH "$BASE/api/clubs/$CLUB_ID" -H 'Content-Type: application/json' -d '{"description":"hacked"}')
check "PATCH /api/clubs/[id] other → 403"     403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X DELETE "$BASE/api/clubs/$CLUB_ID")
check "DELETE /api/clubs/[id] other → 403"    403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X POST "$BASE/api/webhooks" -H 'Content-Type: application/json' -d "{\"clubId\":\"$CLUB_ID\",\"name\":\"evil\",\"url\":\"https://evil.example/\",\"events\":[]}")
check "POST /api/webhooks to other club → 403" 403 "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE2" -X POST "$BASE/api/api-keys" -H 'Content-Type: application/json' -d "{\"clubId\":\"$CLUB_ID\",\"name\":\"evil\"}")
check "POST /api/api-keys to other club → 403" 403 "$code"

echo ""
echo "=== E. Cleanup ==="
# Delete the test club as the owner
curl -s -o /dev/null -b "$COOKIE" -X DELETE "$BASE/api/clubs/$CLUB_ID"
echo "  deleted test club $CLUB_ID"

echo ""
echo "=========================================="
echo " RESULT: $PASS passed, $FAIL failed"
echo "=========================================="
exit $FAIL
