#!/usr/bin/env bash
# Command: setup — Fresh import from existing mcp.json

cmd_setup() {
    local FROM_PATH="" CLIENT="" AUTO_YES=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --from) FROM_PATH="$2"; shift 2 ;;
            --client) CLIENT="$2"; shift 2 ;;
            --yes|-y) AUTO_YES=true; shift ;;
            *) shift ;;
        esac
    done

    print_header

    # Step 1: Detect
    step "Step 1/5: Detecting MCP configuration"

    local DETECTED_CONFIG="" DETECTED_CLIENT=""

    if [[ -n "$FROM_PATH" ]]; then
        DETECTED_CONFIG="$FROM_PATH"
        DETECTED_CLIENT="${CLIENT:-manual}"
        ok "Using provided config: ${C_WHITE}${FROM_PATH}${C_RESET}"
    else
        _detect_configs
    fi

    if [[ -z "$DETECTED_CONFIG" ]]; then
        err "No configuration found. Exiting."
        exit 1
    fi

    # Step 2: Import
    step "Step 2/5: Importing servers"
    info "Reading ${C_WHITE}${DETECTED_CONFIG}${C_RESET}..."

    local output
    output=$(_import_servers "$DETECTED_CONFIG")

    if [[ "$output" == "NO_SERVERS" ]]; then
        err "No MCP servers found in config. Exiting."
        exit 1
    fi

    local count
    count=$(echo "$output" | grep "^IMPORTED:" | cut -d: -f2)
    ok "Imported ${C_WHITE}${count}${C_RESET} servers into registry"
    _print_import_table "$output"

    if [[ "$AUTO_YES" != true ]]; then
        read -rp "  Proceed with these servers? [Y/n]: " confirm
        if [[ "$confirm" == "n" || "$confirm" == "N" ]]; then
            echo -e "  ${C_GRAY}Aborted.${C_RESET}"; exit 0
        fi
    fi

    # Step 3: Configure
    step "Step 3/5: Configuration"
    local IDLE_TIMEOUT_MS=300000 LOG_LEVEL="info"

    if [[ "$AUTO_YES" == true ]]; then
        ok "Using defaults: idle=5min, log=info"
    else
        read -rp "  Default idle timeout in minutes [5]: " idle_timeout
        idle_timeout=${idle_timeout:-5}
        IDLE_TIMEOUT_MS=$((idle_timeout * 60000))
        echo ""
        echo -e "  ${C_WHITE}Log level:${C_RESET}"
        echo -e "    1) error   2) warn   3) ${C_GREEN}info${C_RESET} (default)   4) debug"
        read -rp "  Choice [3]: " log_choice
        case "${log_choice:-3}" in
            1) LOG_LEVEL="error" ;; 2) LOG_LEVEL="warn" ;; 4) LOG_LEVEL="debug" ;; *) LOG_LEVEL="info" ;;
        esac
        ok "Idle timeout: ${IDLE_TIMEOUT_MS}ms, Log level: ${LOG_LEVEL}"
    fi

    ensure_registry
    ok "Token store: ${C_GRAY}~/.mux/tokens.json${C_RESET} (chmod 600)"

    # Step 4: Client integration
    step "Step 4/5: Client integration"
    local target_config="$DETECTED_CONFIG"

    if [[ "$DETECTED_CLIENT" == "manual" && "$AUTO_YES" != true ]]; then
        echo -e "  ${C_WHITE}Which AI client config should Mux be added to?${C_RESET}"
        echo -e "    1) Kiro  — ~/.kiro/settings/mcp.json"
        echo -e "    2) Cursor — ~/.cursor/mcp.json"
        echo -e "    3) Claude Desktop"
        echo -e "    4) Skip (manual)"
        echo ""
        read -rp "  Choice [1]: " client_choice
        case "${client_choice:-1}" in
            1) target_config="$HOME/.kiro/settings/mcp.json" ;;
            2) target_config="$HOME/.cursor/mcp.json" ;;
            3) target_config="$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
            4) ok "Skipped."; _print_summary "$count" "(manual)" "$LOG_LEVEL" "$IDLE_TIMEOUT_MS"; return ;;
        esac
    fi

    info "Building Mux..."
    (cd "$SCRIPT_DIR" && npm run build --silent 2>/dev/null)
    ok "Build complete"

    _patch_client "$target_config" "$LOG_LEVEL"
    ok "Patched ${C_WHITE}${target_config}${C_RESET}"
    ok "Added ${C_GREEN}mux${C_RESET} server, disabled ${count} imported servers"

    # Step 5: Health check
    step "Step 5/5: Server health check"
    info "Checking server readiness..."
    source "$SCRIPT_DIR/scripts/commands/health.sh"
    cmd_health

    _print_summary "$count" "$target_config" "$LOG_LEVEL" "$IDLE_TIMEOUT_MS"
}

# ---- Internal helpers ----

_detect_configs() {
    local paths=("$HOME/.kiro/settings/mcp.json" "./.kiro/settings/mcp.json" "$HOME/.cursor/mcp.json" "$HOME/Library/Application Support/Claude/claude_desktop_config.json")
    local labels=("Kiro (user-level)" "Kiro (workspace)" "Cursor" "Claude Desktop")
    local clients=("kiro" "kiro" "cursor" "claude")
    local found=() found_labels=() found_clients=()

    for i in "${!paths[@]}"; do
        if [[ -f "${paths[$i]}" ]]; then
            local cnt
            cnt=$(python3 -c "
import sys; sys.path.insert(0, '$SCRIPT_DIR/scripts')
from parse_jsonc import load_jsonc
try:
    d = load_jsonc(sys.argv[1]); print(len(d.get('mcpServers',{})))
except: print(0)
" "${paths[$i]}" 2>/dev/null || echo "0")
            if [[ "$cnt" -gt 0 ]]; then
                found+=("${paths[$i]}")
                found_labels+=("${labels[$i]} — ${cnt} servers")
                found_clients+=("${clients[$i]}")
                ok "Found: ${C_WHITE}${labels[$i]}${C_RESET} (${cnt} servers)"
            fi
        fi
    done

    if [[ ${#found[@]} -eq 0 ]]; then
        warn "No MCP configs detected."
        read -rp "  Enter path to your mcp.json: " DETECTED_CONFIG
        DETECTED_CLIENT="manual"; return
    fi

    if [[ ${#found[@]} -eq 1 ]]; then
        DETECTED_CONFIG="${found[0]}"; DETECTED_CLIENT="${found_clients[0]}"
        echo ""
        read -rp "  Use this config? [Y/n]: " confirm
        if [[ "$confirm" == "n" || "$confirm" == "N" ]]; then
            read -rp "  Enter path: " DETECTED_CONFIG; DETECTED_CLIENT="manual"
        fi
    else
        echo -e "\n  ${C_WHITE}Multiple configs found:${C_RESET}"
        for i in "${!found[@]}"; do echo -e "    ${C_CYAN}$((i+1)))${C_RESET} ${found_labels[$i]}"; done
        echo ""
        read -rp "  Choice [1]: " choice; choice=${choice:-1}
        DETECTED_CONFIG="${found[$((choice-1))]}"
        DETECTED_CLIENT="${found_clients[$((choice-1))]}"
    fi
}

_import_servers() {
    python3 -c "
import json, sys, os
sys.path.insert(0, '$SCRIPT_DIR/scripts')
from parse_jsonc import load_jsonc

data = load_jsonc(sys.argv[1])
mcp = data.get('mcpServers', {})
if not mcp: print('NO_SERVERS'); sys.exit(0)

def gen_keywords(name, cfg):
    kw = set()
    for part in name.replace('_', '-').split('-'):
        if len(part) > 2 and part not in ('mcp', 'server', 'test', 'prod', 'dev'):
            kw.add(part.lower())
    keyword_hints = {
        'gitlab': ['git', 'merge request', 'MR', 'pipeline', 'branch'],
        'jira': ['ticket', 'issue', 'story', 'sprint', 'bug'],
        'confluence': ['wiki', 'page', 'documentation', 'RFC'],
        'slack': ['message', 'channel', 'notification', 'chat'],
        'elastic': ['logs', 'search', 'index', 'kibana', 'query'],
        'datadog': ['metrics', 'traces', 'APM', 'monitors'],
        'sitecore': ['CMS', 'content', 'page', 'template'],
        'servicenow': ['incident', 'INC', 'ITSM', 'ticket'],
        'dynacon': ['config', 'feature flag', 'feature', 'toggle'],
        'figma': ['design', 'mockup', 'UI', 'prototype'],
        'chrome': ['browser', 'devtools', 'debug', 'inspect'],
        'edge': ['browser', 'devtools', 'debug'],
    }
    for hint_key, hints in keyword_hints.items():
        if hint_key in name.lower():
            kw.update(h.lower() for h in hints)
            break
    kw = {k for k in kw if len(k) < 15 and not any(c in k for c in './:') and not k.replace('.','').isdigit()}
    return sorted(kw)[:5]

reg = {'servers': {}}
for name, cfg in mcp.items():
    e = {}
    if cfg.get('url') or cfg.get('type') in ('http','https'):
        e = {'transport':'http','url':cfg.get('url',''),'keywords':gen_keywords(name, cfg),'idleTimeoutMs':300000}
        if cfg.get('headers'): e['headers'] = cfg['headers']
        if cfg.get('oauth'):
            e['auth'] = {'type':'oauth','clientId':cfg['oauth'].get('clientId',''),'tokenEndpoint':cfg['oauth'].get('tokenEndpoint',''),'scopes':cfg.get('oauthScopes',[])}
    elif cfg.get('command'):
        e = {'transport':'stdio','command':cfg['command'],'args':cfg.get('args',[]),'keywords':gen_keywords(name, cfg),'idleTimeoutMs':300000}
        if cfg.get('env'): e['env'] = cfg['env']
    else: continue
    reg['servers'][name] = e

os.makedirs(os.path.dirname(sys.argv[2]), exist_ok=True)
with open(sys.argv[2],'w') as f: json.dump(reg, f, indent=2)
print(f'IMPORTED:{len(reg[\"servers\"])}')
for n, c in reg['servers'].items():
    t = c.get('transport','?')
    a = 'oauth' if c.get('auth') else ('env' if c.get('env') else 'headers' if c.get('headers') else 'none')
    kw = ', '.join(c.get('keywords', [])[:4])
    if len(kw) > 24: kw = kw[:21] + '...'
    print(f'ROW:{n}|{t}|{a}|{kw}')
" "$1" "$REGISTRY"
}

_print_import_table() {
    local output="$1"
    echo ""
    echo -e "  ${B_COLOR}┌────────────────────────────────┬───────────┬──────────┬──────────────────────────┐${C_RESET}"
    echo -e "  ${B_COLOR}│${C_RESET} ${C_WHITE}Server${C_RESET}                         ${B_COLOR}│${C_RESET} ${C_WHITE}Transport${C_RESET} ${B_COLOR}│${C_RESET} ${C_WHITE}Auth${C_RESET}     ${B_COLOR}│${C_RESET} ${C_WHITE}Keywords${C_RESET}                 ${B_COLOR}│${C_RESET}"
    echo -e "  ${B_COLOR}├────────────────────────────────┼───────────┼──────────┼──────────────────────────┤${C_RESET}"
    while IFS= read -r line; do
        if [[ "$line" == ROW:* ]]; then
            IFS='|' read -r name transport auth kw <<< "${line#ROW:}"
            printf "  ${B_COLOR}│${C_RESET} ${C_CYAN}%-30s${C_RESET} ${B_COLOR}│${C_RESET} %-9s ${B_COLOR}│${C_RESET} %-8s ${B_COLOR}│${C_RESET} ${C_GRAY}%-24s${C_RESET} ${B_COLOR}│${C_RESET}\n" "$name" "$transport" "$auth" "$kw"
        fi
    done <<< "$output"
    echo -e "  ${B_COLOR}└────────────────────────────────┴───────────┴──────────┴──────────────────────────┘${C_RESET}"
    echo ""
}

_patch_client() {
    local config_path="$1" log_level="$2"
    local mux_bin="$SCRIPT_DIR/dist/index.js"
    python3 -c "
import json, sys, os
sys.path.insert(0, '$SCRIPT_DIR/scripts')
from parse_jsonc import load_jsonc
data = load_jsonc(sys.argv[1])
servers = data.setdefault('mcpServers', {})
for n, c in servers.items():
    if n != 'mux': c['disabled'] = True
servers['mux'] = {'command':'node','args':[sys.argv[2]],'env':{'MUX_LOG_LEVEL':sys.argv[3],'MUX_REGISTRY_PATH':os.path.expanduser('~/.mux/servers.json')},'disabled':False,'autoApprove':['mux_list_servers','mux_call_tool','mux_find_tool','mux_status']}
with open(sys.argv[1],'w') as f: json.dump(data, f, indent=2)
" "$config_path" "$mux_bin" "$log_level"
}

_print_summary() {
    local count="$1" config_path="$2" log_level="${3:-info}" idle="${4:-300000}"
    echo ""
    _box_top
    _box_line ""
    _box_line "  ${C_GREEN}${C_BOLD}⚡ MUX SETUP COMPLETE${C_RESET}"
    _box_line ""
    _box_sep
    _box_line ""
    _box_line "  ${C_WHITE}Property${C_RESET}          ${C_GRAY}│${C_RESET} ${C_WHITE}Value${C_RESET}"
    _box_line "  ${C_GRAY}────────────────┼──────────────────────────────────────────────${C_RESET}"
    _box_line "  ${H_COLOR}Servers${C_RESET}         ${C_GRAY}│${C_RESET} ${C_WHITE}${count} imported${C_RESET}"
    _box_line "  ${H_COLOR}Registry${C_RESET}        ${C_GRAY}│${C_RESET} ${C_GRAY}~/.mux/servers.json${C_RESET}"
    _box_line "  ${H_COLOR}Token Store${C_RESET}     ${C_GRAY}│${C_RESET} ${C_GRAY}~/.mux/tokens.json${C_RESET}"
    _box_line "  ${H_COLOR}Log Level${C_RESET}       ${C_GRAY}│${C_RESET} ${C_GRAY}${log_level}${C_RESET}"
    _box_line "  ${H_COLOR}Client Config${C_RESET}   ${C_GRAY}│${C_RESET} ${C_GRAY}${config_path}${C_RESET}"
    _box_line "  ${H_COLOR}Idle Timeout${C_RESET}    ${C_GRAY}│${C_RESET} ${C_GRAY}$((idle / 60000)) min${C_RESET}"
    _box_line ""
    _box_sep
    _box_line ""
    _box_line "  ${C_GRAY}Your AI client now sees ${C_WHITE}4 tools${C_GRAY} instead of ${C_WHITE}${count}+ tools${C_RESET}"
    _box_line ""
    _box_line "  ${C_GRAY}Manage servers:  ${C_CYAN}mux-cli add${C_RESET} ${C_GRAY}/ ${C_CYAN}remove${C_RESET} ${C_GRAY}/ ${C_CYAN}auth${C_RESET}"
    _box_line "  ${C_GRAY}Re-run setup:    ${C_CYAN}mux-cli setup${C_RESET}"
    _box_line ""
    _box_bottom
    echo ""
}
