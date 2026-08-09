#!/usr/bin/env bash
# Smoke-tests the public pricing API against a locally running dashboard.
# Reads the Cleaning Weekly key from its gitignored .dev.vars so no credential
# is ever passed on a command line. Prints status codes only.
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
DEV_VARS="${DEV_VARS:-$HOME/Cleaning-Weekly/.dev.vars}"

status() {
  curl -s -o /tmp/pricing-api-body -w "%{http_code}" \
    "$BASE/api/pricing" \
    -H "X-Site-Slug: $1" -H "X-Api-Key: $2"
}

expect() {
  local label="$1" want="$2" got="$3"
  if [ "$got" = "$want" ]; then
    echo "  ok    $label ($got)"
  else
    echo "  FAIL  $label (want $want, got $got)"
    head -c 200 /tmp/pricing-api-body
    echo
  fi
}

echo "Pricing API at $BASE"

# Deltona still uses the shared dev key, so it needs no secret to test with.
SITE=deltona
KEY="bb_${SITE}_dev_key"

expect "valid key returns config" 200 "$(status "$SITE" "$KEY")"
echo "  engine: $(python3 -c 'import json; print(json.load(open("/tmp/pricing-api-body"))["engine"])' 2>/dev/null)"

expect "wrong key is rejected" 401 "$(status "$SITE" definitely-not-the-key)"
expect "unknown site is rejected" 404 "$(status no-such-site whatever)"

missing=$(curl -s -o /tmp/pricing-api-body -w "%{http_code}" "$BASE/api/pricing")
expect "missing credentials" 400 "$missing"

if [ -f "$DEV_VARS" ]; then
  ROTATED=$(grep -m1 '^BOOKING_BROOM_API_KEY=' "$DEV_VARS" | cut -d= -f2-)
  expect "rotated key works" 200 "$(status cleaning-weekly "$ROTATED")"
else
  echo "  skip  rotated key (no $DEV_VARS)"
fi

etag=$(curl -s -D - -o /dev/null "$BASE/api/pricing" \
  -H "X-Site-Slug: $SITE" -H "X-Api-Key: $KEY" \
  | grep -i '^etag:' | tr -d '\r' | cut -d' ' -f2)
notmod=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/pricing" \
  -H "X-Site-Slug: $SITE" -H "X-Api-Key: $KEY" \
  -H "If-None-Match: $etag")
expect "unchanged config returns 304" 304 "$notmod"

rm -f /tmp/pricing-api-body
