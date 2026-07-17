#!/usr/bin/env bash
# Command: uninstall — Full Mux cleanup (hooks, client config, registry)

cmd_uninstall() {
    local AUTO_YES=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --yes|-y) AUTO_YES=true; shift ;;
            *) shift ;;
        esac
    done

    print_header

    echo -e "  ${C_BOLD}${C_RED}⚠ This will remove Mux completely:${C_RESET}"
    echo -e "    • Remove mux entry from client config(s)"
    echo -e "    • Re-enable previously disabled servers"
    echo -e "    • Remove auto-approve hooks/rules"
    echo -e "    • Delete ~/.mux registry and tokens"
    echo ""

    if [[ "$AUTO_YES" != true ]]; then
        read -rp "  Are you sure? [y/N]: " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            echo -e "  ${C_GRAY}Aborted.${C_RESET}"; return 0
        fi
    fi

    # Step 1: Unpatch client configs
    step "Step 1/3: Removing Mux from client configs"
    _unpatch_clients
    ok "Client configs restored"

    # Step 2: Remove auto-approve hooks
    step "Step 2/3: Removing auto-approve hooks"
    _remove_auto_approve

    # Step 3: Remove registry and tokens
    step "Step 3/3: Cleaning up local data"
    if [[ -d "$MUX_DIR" ]]; then
        rm -rf "$MUX_DIR"
        ok "Removed ${C_GRAY}~/.mux${C_RESET} (registry + tokens)"
    else
        info "No ~/.mux directory found"
    fi

    echo ""
    _box_top
    _box_line ""
    _box_line "  ${C_GREEN}${C_BOLD}✓ MUX UNINSTALLED${C_RESET}"
    _box_line ""
    _box_line "  ${C_GRAY}All client configs have been restored.${C_RESET}"
    _box_line "  ${C_GRAY}Re-run ${C_CYAN}mux-cli setup${C_GRAY} to reinstall.${C_RESET}"
    _box_line ""
    _box_bottom
    echo ""
}

# ---- Internal helpers ----

_unpatch_clients() {
    local configs=("$HOME/.kiro/settings/mcp.json" "$HOME/.cursor/mcp.json" "$HOME/Library/Application Support/Claude/claude_desktop_config.json")

    for config_path in "${configs[@]}"; do
        if [[ -f "$config_path" ]]; then
            local had_mux
            had_mux=$(python3 -c "
import json, sys
sys.path.insert(0, '$SCRIPT_DIR/scripts')
from parse_jsonc import load_jsonc
try:
    data = load_jsonc(sys.argv[1])
    servers = data.get('mcpServers', {})
    if 'mux' in servers:
        del servers['mux']
        for n, c in servers.items():
            c.pop('disabled', None)
        with open(sys.argv[1], 'w') as f: json.dump(data, f, indent=2)
        print('REMOVED')
    else:
        print('NOT_FOUND')
except Exception as e:
    print(f'ERROR:{e}')
" "$config_path" 2>/dev/null)

            if [[ "$had_mux" == "REMOVED" ]]; then
                ok "Unpatched ${C_GRAY}${config_path}${C_RESET}"
            fi
        fi
    done
}
