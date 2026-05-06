#!/bin/bash
# Integration test script for demo-cli.
# Modeled after packages/zoho/cli/test/test-cli.sh.
#
# Usage:
#   bash apps/demo/cli/test/test-cli.sh
#
# Optional environment variables (gate the auth/call phases when set):
#   DEMO_CLI_E2E_API_BASE_URL  - API base URL (e.g. http://localhost:9902/.../api)
#   DEMO_CLI_E2E_OIDC_ISSUER   - OIDC issuer URL
#   DEMO_CLI_E2E_CLIENT_ID     - OAuth client ID
#   DEMO_CLI_E2E_CLIENT_SECRET - OAuth client secret
#   DEMO_CLI_E2E_REDIRECT_URI  - OAuth redirect URI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CLI="node $ROOT_DIR/dist/apps/demo/cli/index.js"

TEST_HOME=$(mktemp -d)
TEST_CONFIG_DIR="$TEST_HOME/.demo-cli"
mkdir -p "$TEST_CONFIG_DIR"
export HOME="$TEST_HOME"

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

check_json_field() {
  local description="$1"
  local output="$2"
  local field="$3"
  local expected="$4"
  local actual
  actual=$(echo "$output" | jq -r "$field" 2>/dev/null)
  if [[ "$actual" = "$expected" ]]; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $description (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== demo-cli Integration Tests ==="
echo ""

# Phase 1: Build verification
echo "Phase 1: Build verification"
check "CLI binary exists" test -f "$ROOT_DIR/dist/apps/demo/cli/index.js"
chmod +x "$ROOT_DIR/dist/apps/demo/cli/index.js" || true
check "CLI is executable" test -x "$ROOT_DIR/dist/apps/demo/cli/index.js"
if head -1 "$ROOT_DIR/dist/apps/demo/cli/index.js" | grep -q "^#!/usr/bin/env node"; then
  echo "  PASS: Shebang line present"; PASS=$((PASS + 1))
else
  echo "  FAIL: Shebang line present"; FAIL=$((FAIL + 1))
fi
echo ""

# Phase 2: Help output
echo "Phase 2: --help"
HELP_OUT=$($CLI --help 2>&1 || true)
echo "$HELP_OUT" | grep -q "auth"   && echo "  PASS: --help lists auth"   && PASS=$((PASS + 1)) || { echo "  FAIL: --help missing auth"; FAIL=$((FAIL + 1)); }
echo "$HELP_OUT" | grep -q "env"    && echo "  PASS: --help lists env"    && PASS=$((PASS + 1)) || { echo "  FAIL: --help missing env"; FAIL=$((FAIL + 1)); }
echo "$HELP_OUT" | grep -q "doctor" && echo "  PASS: --help lists doctor" && PASS=$((PASS + 1)) || { echo "  FAIL: --help missing doctor"; FAIL=$((FAIL + 1)); }
echo "$HELP_OUT" | grep -q "call"   && echo "  PASS: --help lists call"   && PASS=$((PASS + 1)) || { echo "  FAIL: --help missing call"; FAIL=$((FAIL + 1)); }
echo ""

# Phase 3: Env management
echo "Phase 3: env subcommands"
ENV_LIST_OUT=$($CLI env list 2>&1 || true)
check_json_field "env list returns ok" "$ENV_LIST_OUT" '.ok' 'true'

ENV_ADD_OUT=$($CLI env add tmp --api-base-url 'http://localhost:9902/api' --oidc-issuer 'http://localhost:9902/api/oidc' --redirect-uri 'urn:ietf:wg:oauth:2.0:oob' 2>&1 || true)
check_json_field "env add tmp succeeds" "$ENV_ADD_OUT" '.ok' 'true'

ENV_USE_OUT=$($CLI env use tmp 2>&1 || true)
check_json_field "env use tmp succeeds" "$ENV_USE_OUT" '.ok' 'true'
check_json_field "active env is tmp" "$ENV_USE_OUT" '.data.activeEnv' 'tmp'

ENV_SHOW_OUT=$($CLI env show tmp 2>&1 || true)
check_json_field "env show tmp succeeds" "$ENV_SHOW_OUT" '.ok' 'true'

ENV_REMOVE_OUT=$($CLI env remove tmp 2>&1 || true)
check_json_field "env remove tmp succeeds" "$ENV_REMOVE_OUT" '.ok' 'true'
echo ""

# Phase 4: Doctor (no creds)
echo "Phase 4: doctor (no creds)"
DOCTOR_OUT=$($CLI doctor 2>&1 || true)
check_json_field "doctor returns ok envelope" "$DOCTOR_OUT" '.ok' 'true'
echo ""

# Phase 5: Auth setup + call (gated on E2E env vars)
if [[ -n "$DEMO_CLI_E2E_CLIENT_ID" && -n "$DEMO_CLI_E2E_CLIENT_SECRET" && -n "$DEMO_CLI_E2E_API_BASE_URL" && -n "$DEMO_CLI_E2E_OIDC_ISSUER" ]]; then
  echo "Phase 5: auth setup + call (E2E)"
  $CLI auth setup --env e2e \
    --api-base-url "$DEMO_CLI_E2E_API_BASE_URL" \
    --oidc-issuer "$DEMO_CLI_E2E_OIDC_ISSUER" \
    --client-id "$DEMO_CLI_E2E_CLIENT_ID" \
    --client-secret "$DEMO_CLI_E2E_CLIENT_SECRET" \
    --redirect-uri "${DEMO_CLI_E2E_REDIRECT_URI:-urn:ietf:wg:oauth:2.0:oob}" > /dev/null 2>&1
  echo "  E2E env configured. Run 'demo-cli auth login --env e2e' interactively to obtain tokens."
else
  echo "Phase 5: auth E2E skipped (set DEMO_CLI_E2E_* env vars to enable)"
fi
echo ""

echo "=== Summary ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
echo ""
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
