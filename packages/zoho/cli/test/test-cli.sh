#!/bin/bash
# Integration test script for zoho-cli.
# Modeled after setup/setup-project.sh and .circleci/config.yml patterns.
#
# Usage:
#   bash packages/zoho/cli/test/test-cli.sh
#
# Required environment variables (same as NestJS integration):
#   ZOHO_ACCOUNTS_CLIENT_ID        - OAuth client ID
#   ZOHO_ACCOUNTS_CLIENT_SECRET    - OAuth client secret
#   ZOHO_ACCOUNTS_REFRESH_TOKEN    - OAuth refresh token
#
# Optional environment variables:
#   ZOHO_DESK_ORG_ID               - Zoho Desk organization ID (enables desk tests)
#   ZOHO_ACCOUNTS_URL              - Zoho accounts URL / region (default: us)
#   ZOHO_API_URL                   - API mode (production or sandbox)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CLI="node $ROOT_DIR/dist/packages/zoho/cli/index.js"

# Use a temp directory for test config to avoid polluting the user's real config
TEST_HOME=$(mktemp -d)
TEST_CONFIG_DIR="$TEST_HOME/.zoho-cli"
mkdir -p "$TEST_CONFIG_DIR"

PASS=0
FAIL=0

check() {
  local description="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $description"
    FAIL=$((FAIL + 1))
  fi
}

check_json_valid() {
  local description="$1"
  local output="$2"
  if echo "$output" | jq . > /dev/null 2>&1; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $description (not valid JSON)"
    FAIL=$((FAIL + 1))
  fi
}

check_json_field() {
  local description="$1"
  local output="$2"
  local field="$3"
  local expected="$4"
  local actual
  actual=$(echo "$output" | jq -r "$field" 2>/dev/null)
  if [ "$actual" = "$expected" ]; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $description (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

# Like check_json_field but also prints the error/code fields from CLI error output on failure
check_api_ok() {
  local description="$1"
  local output="$2"
  local ok
  ok=$(echo "$output" | jq -r '.ok' 2>/dev/null)
  if [ "$ok" = "true" ]; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    local error_msg
    error_msg=$(echo "$output" | jq -r '.error // empty' 2>/dev/null)
    local code
    code=$(echo "$output" | jq -r '.code // empty' 2>/dev/null)
    echo "  FAIL: $description (ok=$ok${code:+, code=$code}${error_msg:+, error=$error_msg})"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== zoho-cli Integration Tests ==="
echo ""

# ============================
# Phase 1: Build verification
# ============================
echo "Phase 1: Build verification"
check "CLI binary exists" test -f "$ROOT_DIR/dist/packages/zoho/cli/index.js"

# esbuild doesn't set the executable bit; set it here so the binary can be invoked directly
chmod +x "$ROOT_DIR/dist/packages/zoho/cli/index.js" 2>/dev/null || true
check "CLI binary is executable" test -x "$ROOT_DIR/dist/packages/zoho/cli/index.js"

SHEBANG=$(head -1 "$ROOT_DIR/dist/packages/zoho/cli/index.js")
if [ "$SHEBANG" = "#!/usr/bin/env node" ]; then
  echo "  PASS: Shebang present"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Shebang missing"
  FAIL=$((FAIL + 1))
fi

echo ""

# ============================
# Phase 2: Help output
# ============================
echo "Phase 2: Help output"
HELP_OUTPUT=$(HOME="$TEST_HOME" $CLI --help 2>&1 || true)
check "--help shows zoho-cli" echo "$HELP_OUTPUT" | grep -q "zoho-cli"
check "--help shows auth command" echo "$HELP_OUTPUT" | grep -q "auth"
check "--help shows doctor command" echo "$HELP_OUTPUT" | grep -q "doctor"
check "--help shows recruit command" echo "$HELP_OUTPUT" | grep -q "recruit"
check "--help shows crm command" echo "$HELP_OUTPUT" | grep -q "crm"
check "--help shows desk command" echo "$HELP_OUTPUT" | grep -q "desk"
check "--help shows request command" echo "$HELP_OUTPUT" | grep -q "request"

RECRUIT_HELP=$(HOME="$TEST_HOME" $CLI recruit --help 2>&1 || true)
check "recruit --help shows list" echo "$RECRUIT_HELP" | grep -q "list"

CRM_HELP=$(HOME="$TEST_HOME" $CLI crm --help 2>&1 || true)
check "crm --help shows list" echo "$CRM_HELP" | grep -q "list"

DESK_HELP=$(HOME="$TEST_HOME" $CLI desk --help 2>&1 || true)
check "desk --help shows tickets" echo "$DESK_HELP" | grep -q "tickets"

echo ""

# ============================
# Phase 3: Doctor (no config)
# ============================
echo "Phase 3: Doctor (no config)"
# Clear ZOHO env vars so loadCliConfig finds neither file config nor env config
DOCTOR_OUTPUT=$(HOME="$TEST_HOME" ZOHO_ACCOUNTS_CLIENT_ID="" ZOHO_ACCOUNTS_CLIENT_SECRET="" ZOHO_ACCOUNTS_REFRESH_TOKEN="" ZOHO_DESK_ORG_ID="" $CLI doctor 2>&1 || true)
check_json_valid "doctor outputs valid JSON" "$DOCTOR_OUTPUT"
check_json_field "doctor reports config fail" "$DOCTOR_OUTPUT" ".data.checks[0].status" "fail"

echo ""

# ============================
# Phase 4: Auth + API tests (requires credentials)
# ============================
if [ -z "$ZOHO_ACCOUNTS_CLIENT_ID" ] || [ -z "$ZOHO_ACCOUNTS_CLIENT_SECRET" ] || [ -z "$ZOHO_ACCOUNTS_REFRESH_TOKEN" ]; then
  echo "Phase 4: SKIP (ZOHO_ACCOUNTS_CLIENT_ID, ZOHO_ACCOUNTS_CLIENT_SECRET, ZOHO_ACCOUNTS_REFRESH_TOKEN required)"
  echo ""
else
  echo "Phase 4: Auth commands"

  # auth set using existing env var names
  SET_OUTPUT=$(HOME="$TEST_HOME" $CLI auth set \
    --client-id "$ZOHO_ACCOUNTS_CLIENT_ID" \
    --client-secret "$ZOHO_ACCOUNTS_CLIENT_SECRET" \
    --refresh-token "$ZOHO_ACCOUNTS_REFRESH_TOKEN" \
    --region "${ZOHO_ACCOUNTS_URL:-us}" \
    ${ZOHO_DESK_ORG_ID:+--org-id "$ZOHO_DESK_ORG_ID"} \
    --api-mode "${ZOHO_API_URL:-production}" 2>&1)
  check_json_valid "auth set outputs valid JSON" "$SET_OUTPUT"
  check_json_field "auth set reports saved" "$SET_OUTPUT" ".data.saved" "true"
  check "config file was created" test -f "$TEST_CONFIG_DIR/config.json"

  # auth show
  SHOW_OUTPUT=$(HOME="$TEST_HOME" $CLI auth show 2>&1)
  check_json_valid "auth show outputs valid JSON" "$SHOW_OUTPUT"
  check_json_field "auth show reports configured" "$SHOW_OUTPUT" ".data.configured" "true"

  # Verify masking works (value should contain ***)
  MASKED_ID=$(echo "$SHOW_OUTPUT" | jq -r '.data.shared.clientId' 2>/dev/null)
  if echo "$MASKED_ID" | grep -qF '***'; then
    echo "  PASS: auth show masks client ID"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: auth show client ID not masked (got '$MASKED_ID')"
    FAIL=$((FAIL + 1))
  fi

  # auth check (output has .data.products.{product}.authenticated per product)
  CHECK_OUTPUT=$(HOME="$TEST_HOME" $CLI auth check 2>&1)
  check_json_valid "auth check outputs valid JSON" "$CHECK_OUTPUT"
  check_json_field "auth check has products" "$CHECK_OUTPUT" '.data.products | length > 0' "true"

  AUTH_OK=$(echo "$CHECK_OUTPUT" | jq '[.data.products[].authenticated] | any' 2>/dev/null)
  if [ "$AUTH_OK" = "true" ]; then
    echo "  PASS: auth check reports at least one product authenticated"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: auth check reports no products authenticated"
    FAIL=$((FAIL + 1))
  fi

  # doctor with config
  DOCTOR_CONFIG_OUTPUT=$(HOME="$TEST_HOME" $CLI doctor 2>&1 || true)
  check_json_valid "doctor (with config) outputs valid JSON" "$DOCTOR_CONFIG_OUTPUT"
  check_json_field "doctor reports healthy" "$DOCTOR_CONFIG_OUTPUT" ".data.healthy" "true"

  echo ""

  # ============================
  # Phase 5: Read-only API tests
  # ============================
  echo "Phase 5: Read-only API tests"

  RECRUIT_LIST=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 2>&1 || true)
  check_json_valid "recruit list outputs valid JSON" "$RECRUIT_LIST"
  check_api_ok "recruit list reports ok" "$RECRUIT_LIST"

  CRM_LIST=$(HOME="$TEST_HOME" $CLI crm list -m Contacts --fields "First_Name,Last_Name" --per-page 1 2>&1 || true)
  check_json_valid "crm list outputs valid JSON" "$CRM_LIST"
  check_api_ok "crm list reports ok" "$CRM_LIST"

  if [ -n "$ZOHO_DESK_ORG_ID" ]; then
    DESK_LIST=$(HOME="$TEST_HOME" $CLI desk tickets list --limit 1 2>&1 || true)
    check_json_valid "desk tickets list outputs valid JSON" "$DESK_LIST"
    check_api_ok "desk tickets list reports ok" "$DESK_LIST"

    DEPT_LIST=$(HOME="$TEST_HOME" $CLI desk departments list 2>&1 || true)
    check_json_valid "desk departments list outputs valid JSON" "$DEPT_LIST"
    check_api_ok "desk departments list reports ok" "$DEPT_LIST"
  else
    echo "  SKIP: ZOHO_DESK_ORG_ID not set, skipping desk tests"
  fi

  echo ""

  # auth clear
  CLEAR_OUTPUT=$(HOME="$TEST_HOME" $CLI auth clear 2>&1)
  check_json_valid "auth clear outputs valid JSON" "$CLEAR_OUTPUT"
  check_json_field "auth clear reports cleared" "$CLEAR_OUTPUT" ".data.cleared" "true"
  check "config file was removed" test ! -f "$TEST_CONFIG_DIR/config.json"
fi

# Cleanup
rm -rf "$TEST_HOME"

# ============================
# Summary
# ============================
echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "FAILED"
  exit 1
else
  echo "ALL TESTS PASSED"
  exit 0
fi
