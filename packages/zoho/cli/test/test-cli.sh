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
  if [[ "$actual" = "$expected" ]]; then
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
  if [[ "$ok" = "true" ]]; then
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
if [[ "$SHEBANG" = "#!/usr/bin/env node" ]]; then
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
check "--help shows output command" echo "$HELP_OUTPUT" | grep -q "output"

RECRUIT_HELP=$(HOME="$TEST_HOME" $CLI recruit --help 2>&1 || true)
check "recruit --help shows list" echo "$RECRUIT_HELP" | grep -q "list"

CRM_HELP=$(HOME="$TEST_HOME" $CLI crm --help 2>&1 || true)
check "crm --help shows list" echo "$CRM_HELP" | grep -q "list"

DESK_HELP=$(HOME="$TEST_HOME" $CLI desk --help 2>&1 || true)
check "desk --help shows tickets" echo "$DESK_HELP" | grep -q "tickets"

# Multi-page pagination flags should surface on every list command
CRM_LIST_HELP=$(HOME="$TEST_HOME" $CLI crm list --help 2>&1 || true)
check "crm list --help shows --multiple-pages" echo "$CRM_LIST_HELP" | grep -q "multiple-pages"
check "crm list --help shows --multiple-pages-output" echo "$CRM_LIST_HELP" | grep -q "multiple-pages-output"
check "crm list --help shows --dump-output" echo "$CRM_LIST_HELP" | grep -q "dump-output"
check "crm list --help shows --dump-merge" echo "$CRM_LIST_HELP" | grep -q "dump-merge"

DESK_TICKETS_LIST_HELP=$(HOME="$TEST_HOME" $CLI desk tickets list --help 2>&1 || true)
check "desk tickets list --help shows --multiple-pages" echo "$DESK_TICKETS_LIST_HELP" | grep -q "multiple-pages"
check "desk tickets list --help shows --dump-output" echo "$DESK_TICKETS_LIST_HELP" | grep -q "dump-output"

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
# Phase 3b: Output config (no auth required)
# ============================
echo "Phase 3b: Output config commands"

# output show (empty config)
OUTPUT_SHOW_EMPTY=$(HOME="$TEST_HOME" $CLI output show 2>&1 || true)
check_json_valid "output show outputs valid JSON (empty)" "$OUTPUT_SHOW_EMPTY"
check_json_field "output show reports empty config" "$OUTPUT_SHOW_EMPTY" ".data.output | length" "0"

# output set --set-dump-dir (global)
OUTPUT_SET_DUMP=$(HOME="$TEST_HOME" $CLI output set --set-dump-dir "/tmp/zoho-dump" 2>&1 || true)
check_json_valid "output set dump-dir outputs valid JSON" "$OUTPUT_SET_DUMP"
check_json_field "output set dump-dir reports saved" "$OUTPUT_SET_DUMP" ".data.saved" "true"
check_json_field "output set dump-dir saved value" "$OUTPUT_SET_DUMP" ".data.output.dumpDir" "/tmp/zoho-dump"

# output set --set-pick (global)
OUTPUT_SET_PICK=$(HOME="$TEST_HOME" $CLI output set --set-pick "id,subject" 2>&1 || true)
check_json_valid "output set pick outputs valid JSON" "$OUTPUT_SET_PICK"
check_json_field "output set pick reports saved" "$OUTPUT_SET_PICK" ".data.saved" "true"
check_json_field "output set pick saved value" "$OUTPUT_SET_PICK" ".data.output.pick" "id,subject"

# output show (after setting global)
OUTPUT_SHOW_SET=$(HOME="$TEST_HOME" $CLI output show 2>&1 || true)
check_json_field "output show has dumpDir" "$OUTPUT_SHOW_SET" ".data.output.dumpDir" "/tmp/zoho-dump"
check_json_field "output show has pick" "$OUTPUT_SHOW_SET" ".data.output.pick" "id,subject"

# output set --command (per-command)
OUTPUT_SET_CMD=$(HOME="$TEST_HOME" $CLI output set --command desk.tickets.list --set-pick "id,ticketNumber,status" 2>&1 || true)
check_json_valid "output set per-command outputs valid JSON" "$OUTPUT_SET_CMD"
check_json_field "output set per-command saved" "$OUTPUT_SET_CMD" ".data.saved" "true"
check_json_field "output set per-command pick value" "$OUTPUT_SET_CMD" '.data.output.commands["desk.tickets.list"].pick' "id,ticketNumber,status"

# output show (verify per-command preserved alongside global)
OUTPUT_SHOW_CMD=$(HOME="$TEST_HOME" $CLI output show 2>&1 || true)
check_json_field "output show still has global pick" "$OUTPUT_SHOW_CMD" ".data.output.pick" "id,subject"
check_json_field "output show has per-command pick" "$OUTPUT_SHOW_CMD" '.data.output.commands["desk.tickets.list"].pick' "id,ticketNumber,status"

# output clear --command (clear per-command only)
OUTPUT_CLEAR_CMD=$(HOME="$TEST_HOME" $CLI output clear --command desk.tickets.list 2>&1 || true)
check_json_valid "output clear per-command outputs valid JSON" "$OUTPUT_CLEAR_CMD"
check_json_field "output clear per-command reports cleared" "$OUTPUT_CLEAR_CMD" ".data.cleared" "true"

OUTPUT_SHOW_AFTER_CLEAR_CMD=$(HOME="$TEST_HOME" $CLI output show 2>&1 || true)
check_json_field "output show global still present after per-command clear" "$OUTPUT_SHOW_AFTER_CLEAR_CMD" ".data.output.dumpDir" "/tmp/zoho-dump"

# output clear (clear all)
OUTPUT_CLEAR_ALL=$(HOME="$TEST_HOME" $CLI output clear 2>&1 || true)
check_json_field "output clear all reports cleared" "$OUTPUT_CLEAR_ALL" ".data.cleared" "true"

OUTPUT_SHOW_CLEARED=$(HOME="$TEST_HOME" $CLI output show 2>&1 || true)
OUTPUT_DUMP_AFTER_CLEAR=$(echo "$OUTPUT_SHOW_CLEARED" | jq -r '.data.output.dumpDir // "null"' 2>/dev/null)
if [[ "$OUTPUT_DUMP_AFTER_CLEAR" = "null" ]]; then
  echo "  PASS: output clear removed dumpDir"
  PASS=$((PASS + 1))
else
  echo "  FAIL: output clear did not remove dumpDir (got $OUTPUT_DUMP_AFTER_CLEAR)"
  FAIL=$((FAIL + 1))
fi

echo ""

# ============================
# Phase 4: Auth + API tests (requires credentials)
# ============================
if [[ -z "$ZOHO_ACCOUNTS_CLIENT_ID" ]] || [[ -z "$ZOHO_ACCOUNTS_CLIENT_SECRET" ]] || [[ -z "$ZOHO_ACCOUNTS_REFRESH_TOKEN" ]]; then
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
  if [[ "$AUTH_OK" = "true" ]]; then
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

  if [[ -n "$ZOHO_DESK_ORG_ID" ]]; then
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

  # ============================
  # Phase 6: Output features (--dump-dir, --pick)
  # ============================
  echo "Phase 6: Output features (--dump-dir, --pick)"

  # -- dump-dir tests --
  DUMP_DIR=$(mktemp -d)

  DUMP_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --dump-dir "$DUMP_DIR" 2>&1 || true)
  check_api_ok "recruit list with --dump-dir reports ok" "$DUMP_OUTPUT"

  DUMP_FILE_COUNT=$(ls "$DUMP_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$DUMP_FILE_COUNT" -gt 0 ]]; then
    echo "  PASS: dump file was created"
    PASS=$((PASS + 1))

    DUMP_FILE=$(ls "$DUMP_DIR"/*.json | head -1)
    DUMP_CONTENT=$(cat "$DUMP_FILE")
    check_json_valid "dump file is valid JSON" "$DUMP_CONTENT"
    check_json_field "dump file has ok:true" "$DUMP_CONTENT" ".ok" "true"

    # Verify dump file name contains the command path
    DUMP_BASENAME=$(basename "$DUMP_FILE")
    if echo "$DUMP_BASENAME" | grep -q "recruit_list"; then
      echo "  PASS: dump file name contains command path"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: dump file name missing command path (got $DUMP_BASENAME)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "  FAIL: no dump file was created in $DUMP_DIR"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$DUMP_DIR"

  # -- pick tests --
  PICK_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --pick "id" 2>&1 || true)
  check_api_ok "recruit list with --pick reports ok" "$PICK_OUTPUT"

  # Verify that data items only contain the picked field
  PICK_KEYS=$(echo "$PICK_OUTPUT" | jq -r '.data[0] | keys | join(",")' 2>/dev/null)
  if [[ "$PICK_KEYS" = "id" ]]; then
    echo "  PASS: --pick filters data items to only picked fields"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: --pick did not filter correctly (keys: $PICK_KEYS)"
    FAIL=$((FAIL + 1))
  fi

  # Verify meta is preserved alongside filtered data
  PICK_META_OK=$(echo "$PICK_OUTPUT" | jq 'has("meta")' 2>/dev/null)
  if [[ "$PICK_META_OK" = "true" ]]; then
    echo "  PASS: --pick preserves meta"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: --pick stripped meta"
    FAIL=$((FAIL + 1))
  fi

  # -- pick + dump-dir combined --
  DUMP_DIR2=$(mktemp -d)

  PICK_DUMP_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --pick "id" --dump-dir "$DUMP_DIR2" 2>&1 || true)
  check_api_ok "recruit list with --pick and --dump-dir reports ok" "$PICK_DUMP_OUTPUT"

  # Verify stdout is filtered
  PICK_DUMP_KEYS=$(echo "$PICK_DUMP_OUTPUT" | jq -r '.data[0] | keys | join(",")' 2>/dev/null)
  if [[ "$PICK_DUMP_KEYS" = "id" ]]; then
    echo "  PASS: stdout filtered with --pick when --dump-dir present"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: stdout not filtered (keys: $PICK_DUMP_KEYS)"
    FAIL=$((FAIL + 1))
  fi

  # Verify dump file has more fields than just "id" (full response)
  DUMP_FILE2=$(ls "$DUMP_DIR2"/*.json 2>/dev/null | head -1)
  if [[ -n "$DUMP_FILE2" ]]; then
    DUMP_KEY_COUNT=$(cat "$DUMP_FILE2" | jq '.data[0] | keys | length' 2>/dev/null)
    if [[ "$DUMP_KEY_COUNT" -gt 1 ]]; then
      echo "  PASS: dump file contains full response (${DUMP_KEY_COUNT} fields vs 1 picked)"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: dump file appears filtered (key count: $DUMP_KEY_COUNT)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "  FAIL: no dump file created for pick+dump test"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$DUMP_DIR2"

  # -- pick with multiple fields --
  PICK_MULTI_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --pick "id,Created_Time" 2>&1 || true)
  check_api_ok "recruit list with multi-field --pick reports ok" "$PICK_MULTI_OUTPUT"

  PICK_MULTI_COUNT=$(echo "$PICK_MULTI_OUTPUT" | jq '.data[0] | keys | length' 2>/dev/null)
  if [[ "$PICK_MULTI_COUNT" = "2" ]]; then
    echo "  PASS: --pick with multiple fields returns correct count"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: multi-field --pick returned $PICK_MULTI_COUNT fields (expected 2)"
    FAIL=$((FAIL + 1))
  fi

  # -- config-driven pick (global config applied without CLI flag) --
  HOME="$TEST_HOME" $CLI output set --set-pick "id" > /dev/null 2>&1 || true

  CONFIG_PICK_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 2>&1 || true)
  check_api_ok "recruit list with config-driven pick reports ok" "$CONFIG_PICK_OUTPUT"

  CONFIG_PICK_KEYS=$(echo "$CONFIG_PICK_OUTPUT" | jq -r '.data[0] | keys | join(",")' 2>/dev/null)
  if [[ "$CONFIG_PICK_KEYS" = "id" ]]; then
    echo "  PASS: config-driven pick filters data items"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: config-driven pick did not filter (keys: $CONFIG_PICK_KEYS)"
    FAIL=$((FAIL + 1))
  fi

  # -- CLI flag overrides config --
  CLI_OVERRIDE_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --pick "id,Created_Time" 2>&1 || true)
  check_api_ok "recruit list with CLI flag override reports ok" "$CLI_OVERRIDE_OUTPUT"

  CLI_OVERRIDE_COUNT=$(echo "$CLI_OVERRIDE_OUTPUT" | jq '.data[0] | keys | length' 2>/dev/null)
  if [[ "$CLI_OVERRIDE_COUNT" = "2" ]]; then
    echo "  PASS: CLI --pick flag overrides config pick"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: CLI flag override returned $CLI_OVERRIDE_COUNT fields (expected 2)"
    FAIL=$((FAIL + 1))
  fi

  # -- per-command config overrides global --
  HOME="$TEST_HOME" $CLI output set --command recruit.list --set-pick "id,Created_Time,Full_Name" > /dev/null 2>&1 || true

  CMD_CONFIG_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 2>&1 || true)
  check_api_ok "recruit list with per-command config reports ok" "$CMD_CONFIG_OUTPUT"

  CMD_CONFIG_COUNT=$(echo "$CMD_CONFIG_OUTPUT" | jq '.data[0] | keys | length' 2>/dev/null)
  if [[ "$CMD_CONFIG_COUNT" = "3" ]]; then
    echo "  PASS: per-command config overrides global config (3 fields vs 1)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: per-command config returned $CMD_CONFIG_COUNT fields (expected 3)"
    FAIL=$((FAIL + 1))
  fi

  # Clean up output config for inline set tests
  HOME="$TEST_HOME" $CLI output clear > /dev/null 2>&1 || true

  # -- inline --set-pick saves config and applies for current run --
  INLINE_SET_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --set-pick "id" 2>&1 || true)
  check_api_ok "recruit list with inline --set-pick reports ok" "$INLINE_SET_OUTPUT"

  INLINE_SET_KEYS=$(echo "$INLINE_SET_OUTPUT" | jq -r '.data[0] | keys | join(",")' 2>/dev/null)
  if [[ "$INLINE_SET_KEYS" = "id" ]]; then
    echo "  PASS: inline --set-pick applied for current run"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: inline --set-pick not applied (keys: $INLINE_SET_KEYS)"
    FAIL=$((FAIL + 1))
  fi

  # Verify --set-pick was saved to config
  INLINE_SAVED=$(HOME="$TEST_HOME" $CLI output show 2>&1 || true)
  INLINE_SAVED_PICK=$(echo "$INLINE_SAVED" | jq -r '.data.output.commands["recruit.list"].pick // "null"' 2>/dev/null)
  if [[ "$INLINE_SAVED_PICK" = "id" ]]; then
    echo "  PASS: inline --set-pick saved to config"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: inline --set-pick not saved (got $INLINE_SAVED_PICK)"
    FAIL=$((FAIL + 1))
  fi

  # Verify saved config applies on next run (without flags)
  INLINE_RERUN=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 2>&1 || true)
  check_api_ok "recruit list rerun with saved config reports ok" "$INLINE_RERUN"

  INLINE_RERUN_KEYS=$(echo "$INLINE_RERUN" | jq -r '.data[0] | keys | join(",")' 2>/dev/null)
  if [[ "$INLINE_RERUN_KEYS" = "id" ]]; then
    echo "  PASS: saved --set-pick config applied on subsequent run"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: saved config not applied on rerun (keys: $INLINE_RERUN_KEYS)"
    FAIL=$((FAIL + 1))
  fi

  # -- --pick-all overrides saved pick config --
  PICK_ALL_OUTPUT=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --pick-all 2>&1 || true)
  check_api_ok "recruit list with --pick-all reports ok" "$PICK_ALL_OUTPUT"

  PICK_ALL_COUNT=$(echo "$PICK_ALL_OUTPUT" | jq '.data[0] | keys | length' 2>/dev/null)
  if [[ "$PICK_ALL_COUNT" -gt 1 ]]; then
    echo "  PASS: --pick-all returns full response ($PICK_ALL_COUNT fields)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: --pick-all did not override pick config (key count: $PICK_ALL_COUNT)"
    FAIL=$((FAIL + 1))
  fi

  # Clean up output config before multi-page tests
  HOME="$TEST_HOME" $CLI output clear > /dev/null 2>&1 || true

  echo ""

  # ============================
  # Phase 7: Multi-page pagination
  # ============================
  echo "Phase 7: Multi-page pagination"

  # Invalid choice values are rejected by yargs validation (auth middleware runs first
  # so this test must live inside the credentialed block). Pass --fields so the
  # choices check is reached before the missing-required-arg check on `crm list`.
  INVALID_DUMP_OUTPUT=$(HOME="$TEST_HOME" $CLI crm list -m Contacts --fields id --dump-output bogus 2>&1 || true)
  if echo "$INVALID_DUMP_OUTPUT" | grep -qiE "invalid values"; then
    echo "  PASS: --dump-output rejects invalid value"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: --dump-output bogus did not error (got: $INVALID_DUMP_OUTPUT)"
    FAIL=$((FAIL + 1))
  fi

  INVALID_MERGE=$(HOME="$TEST_HOME" $CLI crm list -m Contacts --fields id --dump-merge bogus 2>&1 || true)
  if echo "$INVALID_MERGE" | grep -qiE "invalid values"; then
    echo "  PASS: --dump-merge rejects invalid value"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: --dump-merge bogus did not error (got: $INVALID_MERGE)"
    FAIL=$((FAIL + 1))
  fi

  # Default --multiple-pages 1 — behavior identical to single-page
  DEFAULT_MP=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 2>&1 || true)
  check_api_ok "default multiple-pages=1 reports ok" "$DEFAULT_MP"
  DEFAULT_MP_HAS_DATA_ARRAY=$(echo "$DEFAULT_MP" | jq '.data | type' 2>/dev/null)
  if [[ "$DEFAULT_MP_HAS_DATA_ARRAY" = "\"array\"" ]]; then
    echo "  PASS: default mode returns .data array (single-page behavior preserved)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: default mode did not return data array (got type: $DEFAULT_MP_HAS_DATA_ARRAY)"
    FAIL=$((FAIL + 1))
  fi

  # Multi-page with default --multiple-pages-output=meta + raw dump
  MP_DUMP_DIR=$(mktemp -d)
  MP_META=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --multiple-pages 2 --dump-dir "$MP_DUMP_DIR" 2>&1 || true)
  check_json_valid "multi-page meta output is valid JSON" "$MP_META"
  check_json_field "multi-page meta reports ok" "$MP_META" ".ok" "true"

  # In meta mode, stdout contains only meta — no data field
  MP_META_HAS_DATA=$(echo "$MP_META" | jq 'has("data")' 2>/dev/null)
  if [[ "$MP_META_HAS_DATA" = "false" ]]; then
    echo "  PASS: meta mode emits no data on stdout (low memory)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: meta mode unexpectedly emitted data on stdout"
    FAIL=$((FAIL + 1))
  fi

  # Summary fields
  MP_PAGES_FETCHED=$(echo "$MP_META" | jq -r '.meta.pagesFetched' 2>/dev/null)
  if [[ "$MP_PAGES_FETCHED" -ge 1 ]] 2>/dev/null; then
    echo "  PASS: meta.pagesFetched is set ($MP_PAGES_FETCHED)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: meta.pagesFetched not numeric (got $MP_PAGES_FETCHED)"
    FAIL=$((FAIL + 1))
  fi

  MP_TOTAL=$(echo "$MP_META" | jq -r '.meta.totalRecords' 2>/dev/null)
  if [[ "$MP_TOTAL" -ge 0 ]] 2>/dev/null; then
    echo "  PASS: meta.totalRecords is numeric ($MP_TOTAL)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: meta.totalRecords not numeric (got $MP_TOTAL)"
    FAIL=$((FAIL + 1))
  fi

  MP_HAS_MORE=$(echo "$MP_META" | jq -r '.meta.hasMorePagesAvailable' 2>/dev/null)
  if [[ "$MP_HAS_MORE" = "true" ]] || [[ "$MP_HAS_MORE" = "false" ]]; then
    echo "  PASS: meta.hasMorePagesAvailable is boolean ($MP_HAS_MORE)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: meta.hasMorePagesAvailable not boolean (got $MP_HAS_MORE)"
    FAIL=$((FAIL + 1))
  fi

  # Default --dump-output=raw + --dump-merge=replace produces a .json file
  MP_RAW_FILE=$(echo "$MP_META" | jq -r '.meta.dumpFile' 2>/dev/null)
  if [[ -n "$MP_RAW_FILE" ]] && [[ -f "$MP_RAW_FILE" ]]; then
    echo "  PASS: raw dump file exists ($MP_RAW_FILE)"
    PASS=$((PASS + 1))
    case "$MP_RAW_FILE" in
      *.json)
        echo "  PASS: raw dump file uses .json extension"
        PASS=$((PASS + 1))
        ;;
      *)
        echo "  FAIL: raw dump file does not use .json extension (got $MP_RAW_FILE)"
        FAIL=$((FAIL + 1))
        ;;
    esac
  else
    echo "  FAIL: raw dump file not created (path: $MP_RAW_FILE)"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$MP_DUMP_DIR"

  # --dump-output=page_by_line --dump-merge=concat → .ndjson with one line per page
  MP_PAGE_DIR=$(mktemp -d)
  MP_PAGE=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --multiple-pages 2 --dump-dir "$MP_PAGE_DIR" --dump-output page_by_line --dump-merge concat 2>&1 || true)
  check_json_valid "page_by_line+concat output is valid JSON" "$MP_PAGE"
  MP_PAGE_FILE=$(echo "$MP_PAGE" | jq -r '.meta.dumpFile' 2>/dev/null)
  case "$MP_PAGE_FILE" in
    *.ndjson)
      echo "  PASS: page_by_line dump file uses .ndjson extension"
      PASS=$((PASS + 1))
      ;;
    *)
      echo "  FAIL: page_by_line dump file extension wrong (got $MP_PAGE_FILE)"
      FAIL=$((FAIL + 1))
      ;;
  esac

  if [[ -n "$MP_PAGE_FILE" ]] && [[ -f "$MP_PAGE_FILE" ]]; then
    MP_PAGE_LINES=$(wc -l < "$MP_PAGE_FILE" | tr -d ' ')
    MP_PAGE_FETCHED=$(echo "$MP_PAGE" | jq -r '.meta.pagesFetched' 2>/dev/null)
    if [[ "$MP_PAGE_LINES" = "$MP_PAGE_FETCHED" ]]; then
      echo "  PASS: page_by_line file line count matches pagesFetched ($MP_PAGE_LINES)"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: page_by_line file lines=$MP_PAGE_LINES vs pagesFetched=$MP_PAGE_FETCHED"
      FAIL=$((FAIL + 1))
    fi

    # Each line should be a JSON object with a `data` array
    FIRST_LINE_TYPE=$(head -1 "$MP_PAGE_FILE" | jq -r '.data | type' 2>/dev/null)
    if [[ "$FIRST_LINE_TYPE" = "array" ]]; then
      echo "  PASS: each page_by_line line wraps a data array"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: page_by_line line missing data array (got type: $FIRST_LINE_TYPE)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "  FAIL: page_by_line file not created"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$MP_PAGE_DIR"

  # --dump-output=data_by_line → one record per line
  MP_REC_DIR=$(mktemp -d)
  MP_REC=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --multiple-pages 2 --dump-dir "$MP_REC_DIR" --dump-output data_by_line --dump-merge concat 2>&1 || true)
  check_json_valid "data_by_line+concat output is valid JSON" "$MP_REC"
  MP_REC_FILE=$(echo "$MP_REC" | jq -r '.meta.dumpFile' 2>/dev/null)
  if [[ -n "$MP_REC_FILE" ]] && [[ -f "$MP_REC_FILE" ]]; then
    MP_REC_LINES=$(wc -l < "$MP_REC_FILE" | tr -d ' ')
    MP_REC_TOTAL=$(echo "$MP_REC" | jq -r '.meta.totalRecords' 2>/dev/null)
    if [[ "$MP_REC_LINES" = "$MP_REC_TOTAL" ]]; then
      echo "  PASS: data_by_line file line count matches totalRecords ($MP_REC_LINES)"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: data_by_line file lines=$MP_REC_LINES vs totalRecords=$MP_REC_TOTAL"
      FAIL=$((FAIL + 1))
    fi

    # Each line is a JSON object (a single record), not an array
    if [[ "$MP_REC_LINES" -gt 0 ]]; then
      FIRST_REC_TYPE=$(head -1 "$MP_REC_FILE" | jq -r 'type' 2>/dev/null)
      if [[ "$FIRST_REC_TYPE" = "object" ]]; then
        echo "  PASS: data_by_line line is a single record object"
        PASS=$((PASS + 1))
      else
        echo "  FAIL: data_by_line line type=$FIRST_REC_TYPE (expected object)"
        FAIL=$((FAIL + 1))
      fi
    fi
  else
    echo "  FAIL: data_by_line file not created"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$MP_REC_DIR"

  # --pick produces a parallel _pick file
  MP_PICK_DIR=$(mktemp -d)
  MP_PICK=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --multiple-pages 2 --dump-dir "$MP_PICK_DIR" --dump-output data_by_line --dump-merge concat --pick "id" 2>&1 || true)
  check_json_valid "data_by_line+pick output is valid JSON" "$MP_PICK"

  MP_PICK_MAIN=$(echo "$MP_PICK" | jq -r '.meta.dumpFile' 2>/dev/null)
  MP_PICK_PICK=$(echo "$MP_PICK" | jq -r '.meta.dumpFilePick // "null"' 2>/dev/null)

  if [[ "$MP_PICK_PICK" != "null" ]] && [[ -f "$MP_PICK_PICK" ]]; then
    echo "  PASS: --pick produced a parallel _pick file ($MP_PICK_PICK)"
    PASS=$((PASS + 1))

    case "$MP_PICK_PICK" in
      *_pick.ndjson)
        echo "  PASS: pick dump file ends with _pick.ndjson"
        PASS=$((PASS + 1))
        ;;
      *)
        echo "  FAIL: pick dump file naming wrong (got $MP_PICK_PICK)"
        FAIL=$((FAIL + 1))
        ;;
    esac

    # Pick file records have only the picked field
    PICK_LINE_KEYS=$(head -1 "$MP_PICK_PICK" | jq -r 'keys | join(",")' 2>/dev/null)
    if [[ "$PICK_LINE_KEYS" = "id" ]]; then
      echo "  PASS: pick file record has only the picked field"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: pick file record keys=$PICK_LINE_KEYS (expected id)"
      FAIL=$((FAIL + 1))
    fi

    # Main file is full-fidelity (more keys than just id)
    if [[ -n "$MP_PICK_MAIN" ]] && [[ -f "$MP_PICK_MAIN" ]]; then
      MAIN_LINE_KEY_COUNT=$(head -1 "$MP_PICK_MAIN" | jq 'keys | length' 2>/dev/null)
      if [[ "$MAIN_LINE_KEY_COUNT" -gt 1 ]] 2>/dev/null; then
        echo "  PASS: main dump file is full-fidelity ($MAIN_LINE_KEY_COUNT keys)"
        PASS=$((PASS + 1))
      else
        echo "  FAIL: main dump file appears filtered (key count: $MAIN_LINE_KEY_COUNT)"
        FAIL=$((FAIL + 1))
      fi
    fi
  else
    echo "  FAIL: --pick did not produce a _pick file (path: $MP_PICK_PICK)"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$MP_PICK_DIR"

  # --multiple-pages-output=merged_page → stdout has flat data array of records
  MP_MERGED_DIR=$(mktemp -d)
  MP_MERGED=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --multiple-pages 2 --dump-dir "$MP_MERGED_DIR" --multiple-pages-output merged_page 2>&1 || true)
  check_json_valid "merged_page output is valid JSON" "$MP_MERGED"
  MERGED_DATA_TYPE=$(echo "$MP_MERGED" | jq -r '.data | type' 2>/dev/null)
  if [[ "$MERGED_DATA_TYPE" = "array" ]]; then
    echo "  PASS: merged_page emits flat data array on stdout"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: merged_page data type=$MERGED_DATA_TYPE (expected array)"
    FAIL=$((FAIL + 1))
  fi

  # First element should be a record object (not a page wrapper)
  MERGED_FIRST_TYPE=$(echo "$MP_MERGED" | jq -r '.data[0] | type' 2>/dev/null)
  MERGED_FIRST_HAS_INFO=$(echo "$MP_MERGED" | jq '.data[0] | has("info")' 2>/dev/null)
  if [[ "$MERGED_FIRST_TYPE" = "object" ]] && [[ "$MERGED_FIRST_HAS_INFO" = "false" ]]; then
    echo "  PASS: merged_page elements are flat records (no page wrapper)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: merged_page first element looks like a page wrapper (has info=$MERGED_FIRST_HAS_INFO)"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$MP_MERGED_DIR"

  # --multiple-pages-output=pages → stdout data is array of page response objects
  MP_PAGES_DIR=$(mktemp -d)
  MP_PAGES=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --multiple-pages 2 --dump-dir "$MP_PAGES_DIR" --multiple-pages-output pages 2>&1 || true)
  check_json_valid "pages output is valid JSON" "$MP_PAGES"
  PAGES_FIRST_HAS_DATA=$(echo "$MP_PAGES" | jq '.data[0] | has("data")' 2>/dev/null)
  if [[ "$PAGES_FIRST_HAS_DATA" = "true" ]]; then
    echo "  PASS: pages mode wraps each page's full response"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: pages mode element missing nested data array"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$MP_PAGES_DIR"

  # --dump-merge=replace with multi-page → only the last page's content survives
  MP_REPL_DIR=$(mktemp -d)
  MP_REPL=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --multiple-pages 3 --dump-dir "$MP_REPL_DIR" --dump-output data_by_line --dump-merge replace 2>&1 || true)
  check_json_valid "data_by_line+replace output is valid JSON" "$MP_REPL"
  MP_REPL_FILE=$(echo "$MP_REPL" | jq -r '.meta.dumpFile' 2>/dev/null)
  if [[ -n "$MP_REPL_FILE" ]] && [[ -f "$MP_REPL_FILE" ]]; then
    REPL_LINES=$(wc -l < "$MP_REPL_FILE" | tr -d ' ')
    # With replace mode, file should hold at most --per-page records (only last page)
    if [[ "$REPL_LINES" -le 1 ]]; then
      echo "  PASS: replace mode keeps only the last page (file has $REPL_LINES lines)"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: replace mode kept more than last page ($REPL_LINES lines)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "  FAIL: replace-mode dump file not created"
    FAIL=$((FAIL + 1))
  fi

  rm -rf "$MP_REPL_DIR"

  # Multi-page without --dump-dir → stderr warning, summary's dumpFile is null
  MP_NO_DUMP_STDERR_FILE=$(mktemp)
  MP_NO_DUMP=$(HOME="$TEST_HOME" $CLI recruit list -m Candidates --per-page 1 --multiple-pages 2 2> "$MP_NO_DUMP_STDERR_FILE" || true)
  check_json_valid "multi-page without dump-dir outputs valid JSON" "$MP_NO_DUMP"
  NO_DUMP_FILE=$(echo "$MP_NO_DUMP" | jq -r '.meta.dumpFile' 2>/dev/null)
  if [[ "$NO_DUMP_FILE" = "null" ]]; then
    echo "  PASS: meta.dumpFile is null when no dump-dir configured"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: meta.dumpFile=$NO_DUMP_FILE without dump-dir (expected null)"
    FAIL=$((FAIL + 1))
  fi

  if grep -q "warning: --multiple-pages used without --dump-dir" "$MP_NO_DUMP_STDERR_FILE"; then
    echo "  PASS: stderr warning emitted when no dump-dir + multi-page"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: missing stderr warning when no dump-dir (stderr: $(cat "$MP_NO_DUMP_STDERR_FILE"))"
    FAIL=$((FAIL + 1))
  fi
  rm -f "$MP_NO_DUMP_STDERR_FILE"

  # Desk multi-page (offset-based) — only if Desk is configured
  if [[ -n "$ZOHO_DESK_ORG_ID" ]]; then
    DESK_MP_DIR=$(mktemp -d)
    DESK_MP=$(HOME="$TEST_HOME" $CLI desk tickets list --limit 1 --multiple-pages 2 --dump-dir "$DESK_MP_DIR" --dump-output data_by_line --dump-merge concat 2>&1 || true)
    check_json_valid "desk tickets list multi-page output is valid JSON" "$DESK_MP"
    check_json_field "desk tickets list multi-page reports ok" "$DESK_MP" ".ok" "true"
    DESK_MP_PAGES=$(echo "$DESK_MP" | jq -r '.meta.pagesFetched' 2>/dev/null)
    if [[ "$DESK_MP_PAGES" -ge 1 ]] 2>/dev/null; then
      echo "  PASS: desk multi-page (offset-based) reports pagesFetched=$DESK_MP_PAGES"
      PASS=$((PASS + 1))
    else
      echo "  FAIL: desk multi-page pagesFetched not numeric (got $DESK_MP_PAGES)"
      FAIL=$((FAIL + 1))
    fi
    rm -rf "$DESK_MP_DIR"
  fi

  # Clean up output config before auth clear
  HOME="$TEST_HOME" $CLI output clear > /dev/null 2>&1 || true

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

if [[ "$FAIL" -gt 0 ]]; then
  echo "FAILED"
  exit 1
else
  echo "ALL TESTS PASSED"
  exit 0
fi
