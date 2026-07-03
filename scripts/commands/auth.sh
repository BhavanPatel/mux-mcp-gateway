#!/usr/bin/env bash
# Command: auth — Trigger OAuth for an HTTP server

cmd_auth() {
    local name="${1:-}"
    require_registry

    # --all flag: auth all HTTP servers sequentially
    if [[ "$name" == "--all" || "$name" == "-a" ]]; then
        _auth_all
        return
    fi

    if [[ -z "$name" ]]; then
        echo -e "\n  ${C_BOLD}HTTP servers available for auth:${C_RESET}\n"
        _list_http_servers
        echo ""
        echo -e "  ${C_GRAY}Tip: use ${C_CYAN}mux-cli auth --all${C_GRAY} to authorize all at once${C_RESET}\n"
        read -rp "  Server name to authorize (or 'all'): " name
        if [[ "$name" == "all" ]]; then _auth_all; return; fi
    fi

    _auth_single "$name"
}

_list_http_servers() {
    python3 -c "
import json, sys, os
with open(sys.argv[1]) as f: r = json.load(f)
tokens = {}
try:
    with open(os.path.expanduser('~/.mux/tokens.json')) as f: tokens = json.load(f)
except: pass
for n, c in r.get('servers',{}).items():
    if c.get('transport') == 'http':
        t = tokens.get(n, {})
        has = bool(t.get('access_token') or t.get('accessToken'))
        status = '  ✔ authorized' if has else '  ✖ not authorized'
        print(f'    {n:<30s}{status}')
" "$REGISTRY"
}

_auth_all() {
    local servers
    servers=$(python3 -c "
import json, sys, os
with open(sys.argv[1]) as f: r = json.load(f)
tokens = {}
try:
    with open(os.path.expanduser('~/.mux/tokens.json')) as f: tokens = json.load(f)
except: pass
for n, c in r.get('servers',{}).items():
    if c.get('transport') == 'http':
        t = tokens.get(n, {})
        if not (t.get('access_token') or t.get('accessToken')):
            print(n)
" "$REGISTRY")

    if [[ -z "$servers" ]]; then
        echo ""
        ok "All HTTP servers are already authorized!"
        echo ""
        return
    fi

    local total
    total=$(echo "$servers" | wc -l | tr -d ' ')
    echo -e "\n  ${C_BOLD}Authorizing ${C_WHITE}${total}${C_RESET}${C_BOLD} HTTP servers (120s timeout each)${C_RESET}\n"

    local current=0 failed_servers=()
    while IFS= read -r srv; do
        [[ -z "$srv" ]] && continue
        current=$((current + 1))
        echo -e "  ${B_COLOR}━━━${C_RESET} ${C_BOLD}[${current}/${total}] ${C_CYAN}${srv}${C_RESET} ${B_COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
        _auth_single "$srv"

        # Check if it failed
        local check
        check=$(python3 -c "
import json, sys, os
try:
    with open(os.path.expanduser('~/.mux/tokens.json')) as f: t = json.load(f)
    e = t.get(sys.argv[1],{})
    print('yes' if e.get('access_token') or e.get('accessToken') else 'no')
except: print('no')
" "$srv")
        if [[ "$check" != "yes" ]]; then
            failed_servers+=("$srv")
        fi
    done <<< "$servers"

    # Summary
    local success=$((total - ${#failed_servers[@]}))
    echo -e "  ${B_COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
    echo -e "\n  ${C_GREEN}✔ ${success} authorized${C_RESET}   ${C_YELLOW}◬ ${#failed_servers[@]} could not authorize${C_RESET}\n"

    if [[ ${#failed_servers[@]} -gt 0 ]]; then
        echo -e "  ${C_GRAY}Servers that could not be authorized:${C_RESET}"
        for s in "${failed_servers[@]}"; do
            echo -e "    ${C_YELLOW}◬${C_RESET} ${s}"
        done
        echo -e "\n  ${C_GRAY}These may use session-based auth (managed by Kiro/Cursor directly).${C_RESET}"
        echo -e "  ${C_GRAY}Try: ${C_CYAN}mux-cli auth <name>${C_GRAY} individually, or use them via your AI client.${C_RESET}\n"
    fi
}

_auth_single() {
    local name="$1"
    local url
    url=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f: r = json.load(f)
c = r.get('servers',{}).get(sys.argv[2],{})
print(c.get('url','') if c.get('transport')=='http' else 'NOT_HTTP')
" "$REGISTRY" "$name")

    if [[ "$url" == "NOT_HTTP" ]]; then
        err "'${name}' is not an HTTP server. Only HTTP servers need browser auth."; return 1
    fi
    if [[ -z "$url" ]]; then
        err "Server '${name}' not found."; return 1
    fi

    echo -e "\n  ${C_BOLD}Authorizing: ${C_CYAN}${name}${C_RESET}"
    echo -e "  ${C_GRAY}URL: ${url}${C_RESET}\n"
    info "Waiting for authorization...\n"

    # Run mux in background
    local outfile="/tmp/mux-auth-$$-$RANDOM.log"
    (echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mux-auth","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"mux_call_tool","arguments":{"server":"'"$name"'","tool":"__ping__","arguments":{}}}}'; sleep 120) | \
        node "$SCRIPT_DIR/dist/index.js" > "$outfile" 2>&1 &
    local pid=$!

    # Poll for token every second, kill early once we have it
    local elapsed=0
    local has_token="no"
    while [[ $elapsed -lt 120 ]]; do
        sleep 1
        elapsed=$((elapsed + 1))
        has_token=$(python3 -c "
import json, sys, os
try:
    with open(os.path.expanduser('~/.mux/tokens.json')) as f: t = json.load(f)
    e = t.get(sys.argv[1],{})
    print('yes' if e.get('access_token') or e.get('accessToken') else 'no')
except: print('no')
" "$name")
        if [[ "$has_token" == "yes" ]]; then
            break
        fi
        # Also break if process already exited
        if ! kill -0 $pid 2>/dev/null; then
            break
        fi
    done

    # Kill mux process
    kill $pid 2>/dev/null; wait $pid 2>/dev/null || true
    rm -f "$outfile"

    if [[ "$has_token" == "yes" ]]; then
        ok "Server ${C_CYAN}${name}${C_RESET} authorized! Token cached. (${elapsed}s)"
    else
        warn "${C_CYAN}${name}${C_RESET} — could not authorize (server may not support MCP OAuth)."
        warn "${C_GRAY}This server might use session-based auth managed by the client.${C_RESET}"
    fi
    echo ""
}
