#!/usr/bin/env bash
# test.sh — E2E test suite for Mux MCP Gateway
# Runs: MCP protocol tests (Node) + CLI tests (bash)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$SCRIPT_DIR/scripts/lib/theme.sh"
source "$SCRIPT_DIR/scripts/lib/registry.sh"

PASS=0 FAIL=0
RESULTS=()

assert() {
    local name="$1" condition="$2"
    if eval "$condition"; then
        PASS=$((PASS + 1)); RESULTS+=("pass|$name")
    else
        FAIL=$((FAIL + 1)); RESULTS+=("fail|$name")
    fi
}

echo ""
_box_top
_box_line ""
_box_line "  ${C_BOLD}${C_CYAN}MUX E2E TEST SUITE${C_RESET}"
_box_line "  ${C_GRAY}$(date '+%Y-%m-%d %H:%M:%S')${C_RESET}"
_box_line ""
_box_bottom

# ==========================================
# PART 1: Unit Tests (node:test)
# ==========================================
step "Part 1: Unit Tests"

info "Running unit tests..."
echo ""
UNIT_OUTPUT=$(node --test "$SCRIPT_DIR"/test/unit/test-*.mjs "$SCRIPT_DIR"/test/auth/test-*.mjs 2>&1)
UNIT_EXIT=$?
echo "$UNIT_OUTPUT"

if [[ $UNIT_EXIT -eq 0 ]]; then
    UNIT_PASSED=$(echo "$UNIT_OUTPUT" | grep -o 'pass [0-9]*' | grep -o '[0-9]*')
    PASS=$((PASS + ${UNIT_PASSED:-0}))
    RESULTS+=("pass|Unit Tests: ${UNIT_PASSED:-0} assertions passed")
else
    UNIT_FAILED=$(echo "$UNIT_OUTPUT" | grep -o 'fail [0-9]*' | grep -o '[0-9]*')
    FAIL=$((FAIL + ${UNIT_FAILED:-1}))
    RESULTS+=("fail|Unit Tests: ${UNIT_FAILED:-?} assertions failed")
fi

# ==========================================
# PART 2: MCP Protocol Tests (Node.js)
# ==========================================
step "Part 2: MCP Protocol Tests"

info "Running MCP protocol tests via SDK..."
echo ""
MCP_OUTPUT=$(node "$SCRIPT_DIR/test/e2e/test-mcp.mjs" 2>&1)
MCP_EXIT=$?
echo "$MCP_OUTPUT"

if [[ $MCP_EXIT -eq 0 ]]; then
    MCP_PASSED=$(echo "$MCP_OUTPUT" | grep -o '[0-9]* passed' | grep -o '[0-9]*')
    PASS=$((PASS + MCP_PASSED))
    RESULTS+=("pass|MCP Protocol: ${MCP_PASSED} assertions passed")
else
    MCP_FAILED=$(echo "$MCP_OUTPUT" | grep -o '[0-9]* failed' | grep -o '[0-9]*')
    MCP_PASSED=$(echo "$MCP_OUTPUT" | grep -o '[0-9]* passed' | grep -o '[0-9]*')
    PASS=$((PASS + ${MCP_PASSED:-0}))
    FAIL=$((FAIL + ${MCP_FAILED:-1}))
    RESULTS+=("fail|MCP Protocol: ${MCP_FAILED:-?} assertions failed")
fi

# ==========================================
# PART 3: CLI Tests
# ==========================================
step "Part 3: CLI Commands"

# Helper: strip ANSI escape sequences for CI compatibility
strip_ansi() {
    sed 's/\x1b\[[0-9;]*m//g; s/\x1b\[[0-9;]*[A-Za-z]//g'
}

# help
HELP_OUT=$("$SCRIPT_DIR/mux.sh" --help 2>&1 | strip_ansi)
assert "mux.sh --help works" "[[ $? -eq 0 ]]"
assert "Help lists all commands" "echo \"$HELP_OUT\" | grep -q 'setup' && echo \"$HELP_OUT\" | grep -q 'add' && echo \"$HELP_OUT\" | grep -q 'remove' && echo \"$HELP_OUT\" | grep -q 'uninstall'"

# add (JSON one-liner)
"$SCRIPT_DIR/mux.sh" add e2e-http-test '{"type":"https","url":"https://e2e.test.com/mcp"}' >/dev/null 2>&1
assert "add: HTTP server from JSON" "grep -q 'e2e-http-test' '$REGISTRY'"

"$SCRIPT_DIR/mux.sh" add e2e-stdio-test '{"command":"echo","args":["hi"]}' >/dev/null 2>&1
assert "add: stdio server from JSON" "grep -q 'e2e-stdio-test' '$REGISTRY'"

# list
LIST_OUT=$("$SCRIPT_DIR/mux.sh" list 2>&1 | strip_ansi)
assert "list: shows added servers" "echo \"$LIST_OUT\" | grep -q 'e2e-http-test' && echo \"$LIST_OUT\" | grep -q 'e2e-stdio-test'"

# health
HEALTH_OUT=$("$SCRIPT_DIR/mux.sh" health 2>&1 | strip_ansi)
assert "health: runs without error" "[[ $? -eq 0 ]]"
assert "health: shows table" "echo \"$HEALTH_OUT\" | grep -q 'Server'"

# status
STATUS_OUT=$("$SCRIPT_DIR/mux.sh" status 2>&1 | strip_ansi)
assert "status: shows registry info" "echo \"$STATUS_OUT\" | grep -q 'Registry'"

# metrics
python3 -c "
import json, os, time
path = os.path.expanduser('~/.mux/metrics.json')
store = {'events': [
    {'ts': int(time.time()*1000), 'type': 'call', 'server': 'test', 'durationMs': 100},
    {'ts': int(time.time()*1000), 'type': 'spawn', 'server': 'test', 'toolCount': 5},
    {'ts': int(time.time()*1000), 'type': 'kill', 'server': 'test'},
], 'firstSeen': int(time.time()*1000) - 86400000}
with open(path, 'w') as f: json.dump(store, f)
"
METRICS_OUT=$("$SCRIPT_DIR/mux.sh" metrics 2>&1 | strip_ansi)
assert "metrics: runs without error" "true"
assert "metrics: shows insights header" "echo \"$METRICS_OUT\" | grep -q 'INSIGHTS'"
assert "metrics: shows credit savings %" "echo \"$METRICS_OUT\" | grep -q 'Credit savings'"
assert "metrics: shows tokens saved for API" "echo \"$METRICS_OUT\" | grep -q 'Tokens saved'"
assert "metrics: shows context reduction" "echo \"$METRICS_OUT\" | grep -q 'Context Reduction'"
assert "metrics: shows activity chart" "echo \"$METRICS_OUT\" | grep -q 'Activity'"
assert "metrics: shows resource savings" "echo \"$METRICS_OUT\" | grep -q 'Resource Savings'"

# keywords
KW_OUT=$(echo "" | "$SCRIPT_DIR/mux.sh" keywords 2>&1 | strip_ansi || true)
assert "keywords: shows keyword list" "echo \"$KW_OUT\" | grep -q 'Keywords'"

# remove
"$SCRIPT_DIR/mux.sh" remove e2e-http-test >/dev/null 2>&1
assert "remove: HTTP server removed" "! grep -q 'e2e-http-test' '$REGISTRY'"
"$SCRIPT_DIR/mux.sh" remove e2e-stdio-test >/dev/null 2>&1
assert "remove: stdio server removed" "! grep -q 'e2e-stdio-test' '$REGISTRY'"

# remove nonexistent
REMOVE_ERR=$("$SCRIPT_DIR/mux.sh" remove "fake-server-$$" 2>&1 | strip_ansi || true)
assert "remove nonexistent: shows error" "echo \"$REMOVE_ERR\" | grep -q 'not found'"

# ==========================================
# PART 4: JSONC Parser
# ==========================================
step "Part 4: JSONC Parser"

JSONC_TEST="/tmp/mux-jsonc-test-$$.json"
cat > "$JSONC_TEST" << 'EOF'
{
  // comment at top
  "mcpServers": {
    // "skipped": { "url": "https://skip" },
    "kept": {
      "type": "https",
      "url": "https://real.com/mcp" // inline
    }
  }
}
EOF

JSONC_OUT=$(python3 -c "
import sys; sys.path.insert(0, '$SCRIPT_DIR/scripts')
from parse_jsonc import load_jsonc
import json; print(json.dumps(load_jsonc('$JSONC_TEST')))
" 2>&1)

assert "JSONC: strips // comments" "echo '$JSONC_OUT' | grep -q 'kept'"
assert "JSONC: preserves https://" "echo '$JSONC_OUT' | grep -q 'https://real.com'"
assert "JSONC: removes commented entries" "! echo '$JSONC_OUT' | grep -q 'skipped'"
rm -f "$JSONC_TEST"

# ==========================================
# REPORT
# ==========================================
echo ""
_box_top
_box_line ""
_box_line "  ${C_BOLD}FINAL REPORT${C_RESET}"
_box_line ""
_box_sep
_box_line ""

for r in "${RESULTS[@]}"; do
    IFS='|' read -r status name <<< "$r"
    case "$status" in
        pass) printf "  ${B_COLOR}║${C_RESET} ${C_GREEN} ✔ ${C_RESET} %-60s ${B_COLOR}║${C_RESET}\n" "$name" ;;
        fail) printf "  ${B_COLOR}║${C_RESET} ${C_RED} ✖ ${C_RESET} %-60s ${B_COLOR}║${C_RESET}\n" "$name" ;;
    esac
done

_box_line ""
_box_sep
_box_line ""
_box_line "  ${C_GREEN}✔ ${PASS} passed${C_RESET}   ${C_RED}✖ ${FAIL} failed${C_RESET}"
_box_line ""
if [[ $FAIL -eq 0 ]]; then
    _box_line "  ${C_GREEN}${C_BOLD}ALL TESTS PASSED${C_RESET}"
else
    _box_line "  ${C_RED}${C_BOLD}SOME TESTS FAILED${C_RESET}"
fi
_box_line ""
_box_bottom
echo ""

exit $FAIL
