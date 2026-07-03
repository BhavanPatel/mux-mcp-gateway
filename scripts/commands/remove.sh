#!/usr/bin/env bash
# Command: remove — Remove a server from registry

cmd_remove() {
    local name="${1:-}"
    require_registry

    if [[ -z "$name" ]]; then
        echo -e "\n  ${C_BOLD}Current servers:${C_RESET}"
        source "$SCRIPT_DIR/scripts/commands/list.sh"
        cmd_list
        read -rp "  Server name to remove: " name
    fi

    local result
    result=$(python3 -c "
import json, sys
with open(sys.argv[2]) as f: r = json.load(f)
if sys.argv[1] in r.get('servers',{}):
    del r['servers'][sys.argv[1]]
    with open(sys.argv[2],'w') as f: json.dump(r, f, indent=2)
    print('REMOVED')
else: print('NOT_FOUND')
" "$name" "$REGISTRY")

    if [[ "$result" == "REMOVED" ]]; then
        ok "Server ${C_CYAN}${name}${C_RESET} removed from registry"
        echo -e "  ${C_GRAY}Changes are hot-reloaded — no restart needed.${C_RESET}\n"
    else
        err "Server '${name}' not found in registry."
    fi
}
