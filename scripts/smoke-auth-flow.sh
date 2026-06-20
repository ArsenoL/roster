#!/bin/bash
# Smoke-test the magic-link → onboarding → dashboard flow.
# Saves all responses to /tmp/smoke-resp-*.txt for inspection.

set -e
BASE=http://127.0.0.1:3000

echo "=== 1. Request magic link ==="
curl -s -X POST "$BASE/api/auth/request-magic" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@example.edu","next":"/app"}' > /tmp/smoke-resp-1.json
cat /tmp/smoke-resp-1.json
echo ""

TOKEN=$(python3 -c "import json,sys; print(json.load(open('/tmp/smoke-resp-1.json')).get('devLink','').split('token=')[1].split('&')[0])")
if [ -z "$TOKEN" ]; then
  echo "FAIL: no token extracted"
  exit 1
fi
echo "TOKEN=$TOKEN"
echo ""

echo "=== 2. Verify magic (get cookie) ==="
curl -s -X POST "$BASE/api/auth/verify-magic" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}" \
  -c /tmp/smoke-cookies.txt > /tmp/smoke-resp-2.json
cat /tmp/smoke-resp-2.json
echo ""
echo ""

echo "=== 3. /api/auth/me (with cookie) ==="
curl -s -b /tmp/smoke-cookies.txt "$BASE/api/auth/me" > /tmp/smoke-resp-3.json
cat /tmp/smoke-resp-3.json
echo ""
echo ""

echo "=== 4. Create club ==="
curl -s -X POST "$BASE/api/clubs" \
  -H "Content-Type: application/json" \
  -b /tmp/smoke-cookies.txt \
  -d '{"name":"Smoke Test Robotics","category":"STEM","modules":["members","attendance","events","tasks"]}' > /tmp/smoke-resp-4.json
cat /tmp/smoke-resp-4.json
echo ""
echo ""

echo "=== 5. /api/auth/me again (should show new membership + CLUB_LEADER role) ==="
curl -s -b /tmp/smoke-cookies.txt "$BASE/api/auth/me" > /tmp/smoke-resp-5.json
cat /tmp/smoke-resp-5.json
echo ""
