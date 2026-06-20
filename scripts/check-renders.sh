#!/bin/bash
# Check HTML output of each page for error markers (Next.js error pages, "Error:" strings, etc.)
set +e
BASE="http://localhost:3000"

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

for p in "${PAGES[@]}"; do
  HTML=$(curl -s --max-time 20 "$BASE$p")
  # Next.js dev error overlay markers
  if echo "$HTML" | grep -qE "Application error|Internal Server Error|__next_error__|Error: " ; then
    echo "!!! RENDER ERROR on $p"
    echo "$HTML" | grep -oE "Error: [^<]{0,200}" | head -3
    echo "---"
  else
    SIZE=$(echo "$HTML" | wc -c)
    echo "  OK   $p  (${SIZE} bytes)"
  fi
done
