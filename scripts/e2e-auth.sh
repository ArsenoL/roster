#!/usr/bin/env bash
# End-to-end auth flow test:
# 1. POST /api/auth/request-magic with a fresh email
# 2. Extract devLink from response (only present in dev)
# 3. Extract token from devLink
# 4. POST /api/auth/verify-magic with token
# 5. Verify response sets roster_session cookie + returns user
# 6. GET /api/auth/me with cookie — should return the user (not null)
# 7. POST /api/auth/logout
# 8. GET /api/auth/me again — should return null

set +e
BASE="http://localhost:3000"
EMAIL="e2e-$(date +%s)@smoke.test"

echo "=== E2E AUTH FLOW ==="
echo "Email: $EMAIL"
echo ""

# Step 1: request magic link
echo "--- Step 1: POST /api/auth/request-magic ---"
RESP=$(curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" \
  "$BASE/api/auth/request-magic")
echo "Response: $RESP"

# Extract devLink
LINK=$(echo "$RESP" | grep -oE '"devLink":"[^"]+"' | head -1 | sed 's/"devLink":"//;s/"$//')
echo "devLink: $LINK"

if [ -z "$LINK" ]; then
  echo "FAIL: no devLink in response"
  exit 1
fi

# Extract token from link
TOKEN=$(echo "$LINK" | grep -oE 'token=[a-f0-9]+' | head -1 | sed 's/token=//')
echo "Token: $TOKEN"

if [ -z "$TOKEN" ]; then
  echo "FAIL: no token extracted from link"
  exit 1
fi

# Step 2: verify magic link
echo ""
echo "--- Step 2: POST /api/auth/verify-magic ---"
COOKIE_FILE=$(mktemp)
VERIFY_RESP=$(curl -s -c "$COOKIE_FILE" -X POST -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}" \
  "$BASE/api/auth/verify-magic")
echo "Response: $VERIFY_RESP"
echo "Cookie file:"
cat "$COOKIE_FILE"
echo ""

# Check user object
if ! echo "$VERIFY_RESP" | grep -q '"ok":true'; then
  echo "FAIL: verify-magic did not return ok:true"
  exit 1
fi
if ! echo "$VERIFY_RESP" | grep -q "$EMAIL"; then
  echo "FAIL: verify-magic did not return user with email"
  exit 1
fi

# Check cookie was set
if ! grep -q "roster_session" "$COOKIE_FILE"; then
  echo "FAIL: roster_session cookie was NOT set"
  exit 1
fi
echo "PASS: roster_session cookie set"

# Step 3: /api/auth/me with cookie
echo ""
echo "--- Step 3: GET /api/auth/me (with cookie) ---"
ME_RESP=$(curl -s -b "$COOKIE_FILE" "$BASE/api/auth/me")
echo "Response: $ME_RESP"

if echo "$ME_RESP" | grep -q '"user":null'; then
  echo "FAIL: /api/auth/me returned null user despite valid session cookie"
  exit 1
fi
if ! echo "$ME_RESP" | grep -q "$EMAIL"; then
  echo "FAIL: /api/auth/me did not return the expected email"
  exit 1
fi
echo "PASS: /api/auth/me returned the authenticated user"

# Step 4: replay attack — try the same token again
echo ""
echo "--- Step 4: Replay attack — try same token again ---"
REPLAY=$(curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}" \
  "$BASE/api/auth/verify-magic")
echo "Response: $REPLAY"
if echo "$REPLAY" | grep -q "Invalid or expired token"; then
  echo "PASS: token rejected on second use (single-use)"
else
  echo "FAIL: token was accepted twice — single-use invariant broken"
  exit 1
fi

# Step 5: logout
echo ""
echo "--- Step 5: POST /api/auth/logout ---"
LOGOUT_RESP=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" -X POST "$BASE/api/auth/logout")
echo "Response: $LOGOUT_RESP"
if ! echo "$LOGOUT_RESP" | grep -q '"ok":true'; then
  echo "FAIL: logout did not return ok"
  exit 1
fi

# Step 6: /api/auth/me after logout
echo ""
echo "--- Step 6: GET /api/auth/me (after logout) ---"
ME_AFTER=$(curl -s -b "$COOKIE_FILE" "$BASE/api/auth/me")
echo "Response: $ME_AFTER"
if ! echo "$ME_AFTER" | grep -q '"user":null'; then
  echo "FAIL: user still logged in after logout"
  exit 1
fi
echo "PASS: session invalidated after logout"

echo ""
echo "============================================"
echo "  ALL AUTH FLOW TESTS PASSED"
echo "============================================"
rm -f "$COOKIE_FILE"
