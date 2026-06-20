#!/usr/bin/env bash
# End-to-end club creation test:
# 1. Sign in via magic link
# 2. POST /api/clubs with name, category, modules
# 3. Verify club was created in DB (via /api/clubs list)
# 4. Verify user's membership was created and role upgraded to PRESIDENT

set +e
BASE="http://localhost:3000"
EMAIL="club-test-$(date +%s)@smoke.test"
COOKIE=$(mktemp)

echo "=== E2E CLUB CREATION ==="
echo "Email: $EMAIL"
echo ""

# Sign in
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\"}" "$BASE/api/auth/request-magic")
TOKEN=$(echo "$RESP" | grep -oE 'token=[a-f0-9]+' | sed 's/token=//')
curl -s -c "$COOKIE" -X POST -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\"}" "$BASE/api/auth/verify-magic" > /dev/null

echo "--- After sign-in, user is: ---"
curl -s -b "$COOKIE" "$BASE/api/auth/me"
echo ""

# Create club
echo ""
echo "--- POST /api/clubs ---"
CLUB_RESP=$(curl -s -b "$COOKIE" -X POST -H "Content-Type: application/json" \
  -d '{
    "name": "E2E Test Chess Club",
    "category": "HOBBY",
    "modules": ["members", "attendance", "events", "announcements", "finance", "tasks"],
    "isPublic": true,
    "requireApproval": false
  }' \
  "$BASE/api/clubs")
echo "$CLUB_RESP" | head -c 400
echo ""

CLUB_ID=$(echo "$CLUB_RESP" | grep -oE '"id":"[^"]+"' | head -1 | sed 's/"id":"//;s/"$//')
echo "Created club ID: $CLUB_ID"

if [ -z "$CLUB_ID" ]; then
  echo "FAIL: no club ID returned"
  exit 1
fi

# Verify user now has a membership
echo ""
echo "--- /api/auth/me after club creation (should have memberships) ---"
ME=$(curl -s -b "$COOKIE" "$BASE/api/auth/me")
echo "$ME" | head -c 400
echo ""

if ! echo "$ME" | grep -q '"memberships"'; then
  echo "FAIL: no memberships field"
  exit 1
fi
if echo "$ME" | grep -q '"memberships":\[\]'; then
  echo "FAIL: memberships array still empty after club creation"
  exit 1
fi
if ! echo "$ME" | grep -q "PRESIDENT"; then
  echo "FAIL: user role not upgraded to PRESIDENT"
  exit 1
fi
echo "PASS: user now has a PRESIDENT membership"

# Verify club shows up in /api/clubs list
echo ""
echo "--- GET /api/clubs (should include new club) ---"
CLUBS=$(curl -s -b "$COOKIE" "$BASE/api/clubs")
if ! echo "$CLUBS" | grep -q "E2E Test Chess Club"; then
  echo "FAIL: new club not in /api/clubs list"
  exit 1
fi
echo "PASS: club appears in /api/clubs list"

# Verify the club has the right modules
echo ""
echo "--- GET /api/clubs/[id] ---"
CLUB_DETAIL=$(curl -s -b "$COOKIE" "$BASE/api/clubs/$CLUB_ID")
echo "$CLUB_DETAIL" | head -c 400
echo ""

# Check the modules field includes the ones we sent
for MOD in members attendance events announcements finance tasks; do
  if ! echo "$CLUB_DETAIL" | grep -q "$MOD"; then
    echo "FAIL: module '$MOD' not present in club detail"
    exit 1
  fi
done
echo "PASS: all requested modules are set on the club"

echo ""
echo "============================================"
echo "  ALL CLUB CREATION TESTS PASSED"
echo "============================================"
rm -f "$COOKIE"
