#!/bin/bash
# Test the validate-street-address n8n webhook without making a real call
# Usage: bash test-webhook.sh "Oak Ave"
# Usage: bash test-webhook.sh "Petaluma Blvd N"
# Add "test" as second arg for test mode: bash test-webhook.sh "Oak Ave" test

STREET="${1:-Oak Ave}"
MODE="${2:-prod}"

if [ "$MODE" = "test" ]; then
  URL="https://jordanbragg79.app.n8n.cloud/webhook-test/validate-street-address"
else
  URL="https://jordanbragg79.app.n8n.cloud/webhook/validate-street-address"
fi

curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"type\": \"tool-calls\",
      \"toolCallList\": [{
        \"id\": \"test-call-001\",
        \"name\": \"validate_street_address\",
        \"arguments\": {
          \"streetName\": \"${STREET}\"
        }
      }]
    }
  }" | python3 -m json.tool 2>/dev/null || echo "Raw response above"
