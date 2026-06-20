#!/bin/bash
# Run dev server in foreground, run smoke tests in parallel, kill server when done.
set +e

cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 2

# Start dev server in background but in same process group
npm run dev > /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!
echo "Dev PID: $DEV_PID"

# Wait for "Ready" with timeout
for i in $(seq 1 30); do
  if grep -q "Ready in" /home/z/my-project/dev.log 2>/dev/null; then
    echo "Dev server ready after ${i}s"
    break
  fi
  sleep 1
done

# Verify it's listening
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3000/api/auth/me 2>&1)
echo "Sanity check /api/auth/me -> $CODE"

if [ "$CODE" != "200" ]; then
  echo "FAILED to start dev server. Log:"
  tail -30 /home/z/my-project/dev.log
  kill $DEV_PID 2>/dev/null
  exit 1
fi

# Run smoke test
echo ""
echo "=== Running smoke test ==="
/home/z/my-project/scripts/smoke-test.sh http://localhost:3000

# Kill dev server
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
echo ""
echo "Dev server stopped."
