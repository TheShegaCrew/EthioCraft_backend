#!/usr/bin/env bash
set -euo pipefail

# Simple curl-based runner for quick checks.
BASE_URL=${BASE_URL:-http://localhost:4000/api/v1}
AUTH_TOKEN=${AUTH_TOKEN:-}
DRAFT_ID=${DRAFT_ID:-}
SAMPLE_ID=${SAMPLE_ID:-}
ORDER_ID=${ORDER_ID:-}

if [ -z "$AUTH_TOKEN" ]; then
  echo "Please set AUTH_TOKEN environment variable (Bearer token)."
  exit 1
fi

echo "Base URL: $BASE_URL"

echo "\n1) PATCH /users/me (profile save)"
curl -s -o /tmp/resp.json -w "HTTP_STATUS:%{http_code}\n" -X PATCH "$BASE_URL/users/me" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","phone":"+251900000000","email":"test@example.com","artisanProfile":{"region":"Addis"}}'
cat /tmp/resp.json || true

if [ -n "$DRAFT_ID" ]; then
  echo "\n2) PATCH /verifications/products/drafts/:draftId (agent update)"
  curl -s -o /tmp/resp.json -w "HTTP_STATUS:%{http_code}\n" -X PATCH "$BASE_URL/verifications/products/drafts/$DRAFT_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Agent updated title"}'
  cat /tmp/resp.json || true
else
  echo "\n2) Skipping verification draft test (DRAFT_ID not set)"
fi

if [ -n "$ORDER_ID" ]; then
  echo "\n3) PATCH /orders/:orderId/status (order status update)"
  curl -s -o /tmp/resp.json -w "HTTP_STATUS:%{http_code}\n" -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status":"PROCESSING"}'
  cat /tmp/resp.json || true
else
  echo "\n3) Skipping order status test (ORDER_ID not set)"
fi

echo "\nDone."
