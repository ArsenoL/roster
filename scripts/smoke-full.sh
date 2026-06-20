#!/bin/bash
# Start dev server + run smoke test in a single session.
set -u

cd /home/z/my-project

# Kill any existing server
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

# Start dev server in background, fully detached
setsid bash -c 'node node_modules/next/dist/bin/next dev -p 3000 2>&1' > /tmp/next-dev.log 2>&1 < /dev/null &
disown

echo "Waiting for server..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  if curl -sf http://127.0.0.1:3000/api/auth/me > /dev/null 2>&1; then
    echo "Server up after ${i}*2s"
    break
  fi
done

# Smoke test
BASE=http://127.0.0.1:3000

echo ""
echo "=== 1. Request magic link ==="
curl -s -X POST "$BASE/api/auth/request-magic" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@example.edu","next":"/app"}' > /tmp/smoke-resp-1.json
cat /tmp/smoke-resp-1.json
echo ""

TOKEN=$(python3 -c "import json; r=json.load(open('/tmp/smoke-resp-1.json')); print(r.get('devLink','').split('token=')[1].split('&')[0]) if r.get('devLink') else print('')")
if [ -z "$TOKEN" ]; then
  echo "FAIL: no token extracted"
  echo "---server log---"
  tail -30 /tmp/next-dev.log
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
echo ""

echo "=== 6. /api/clubs (should show the new club) ==="
curl -s -b /tmp/smoke-cookies.txt "$BASE/api/clubs" > /tmp/smoke-resp-6.json
python3 -c "import json; d=json.load(open('/tmp/smoke-resp-6.json')); print(f'{len(d.get(\"clubs\",[]))} clubs:'); [print(f'  - {c[\"name\"]} ({c[\"category\"]})') for c in d.get('clubs',[])]"

echo ""
echo "=== server log tail ==="
tail -10 /tmp/next-dev.log
