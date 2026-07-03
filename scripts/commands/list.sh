#!/usr/bin/env bash
# Command: list — Show all registered servers

cmd_list() {
    require_registry
    echo -e "\n  ${C_BOLD}Registered Servers${C_RESET} ${C_GRAY}(~/.mux/servers.json)${C_RESET}\n"

    local list_output
    list_output=$(python3 -c "
import json, sys, os
with open(sys.argv[1]) as f: reg = json.load(f)
tokens = {}
try:
    with open(os.path.expanduser('~/.mux/tokens.json')) as f: tokens = json.load(f)
except: pass

servers = reg.get('servers', {})
if not servers: print('EMPTY'); sys.exit(0)
for name, cfg in servers.items():
    t = cfg.get('transport','?')
    tk = tokens.get(name, {})
    if t == 'http':
        auth = 'authorized' if (tk.get('access_token') or tk.get('accessToken')) else 'not authorized'
    else:
        auth = 'ready'
    kw = ', '.join(cfg.get('keywords', [])[:3])
    if len(kw) > 18: kw = kw[:15] + '...'
    print(f'{name}|{t}|{auth}|{kw}')
" "$REGISTRY")

    if [[ "$list_output" == "EMPTY" ]]; then
        echo -e "  ${C_GRAY}(no servers registered)${C_RESET}\n"
        return
    fi

    echo -e "  ${B_COLOR}┌────────────────────────────────┬───────────┬──────────────────┬────────────────────┐${C_RESET}"
    echo -e "  ${B_COLOR}│${C_RESET} ${C_WHITE}Server${C_RESET}                         ${B_COLOR}│${C_RESET} ${C_WHITE}Transport${C_RESET} ${B_COLOR}│${C_RESET} ${C_WHITE}Status${C_RESET}           ${B_COLOR}│${C_RESET} ${C_WHITE}Keywords${C_RESET}           ${B_COLOR}│${C_RESET}"
    echo -e "  ${B_COLOR}├────────────────────────────────┼───────────┼──────────────────┼────────────────────┤${C_RESET}"

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        IFS='|' read -r name transport auth kw <<< "$line"
        local color icon
        case "$auth" in
            ready)          color="${C_GREEN}"; icon="✔" ;;
            authorized)     color="${C_GREEN}"; icon="✔" ;;
            "not authorized") color="${C_YELLOW}"; icon="◬" ;;
            *)              color="${C_GRAY}"; icon="?" ;;
        esac
        printf "  ${B_COLOR}│${C_RESET} ${C_CYAN}%-30s${C_RESET} ${B_COLOR}│${C_RESET} %-9s ${B_COLOR}│${C_RESET} ${color}%s %-14s${C_RESET} ${B_COLOR}│${C_RESET} ${C_GRAY}%-18s${C_RESET} ${B_COLOR}│${C_RESET}\n" "$name" "$transport" "$icon" "$auth" "$kw"
    done <<< "$list_output"

    echo -e "  ${B_COLOR}└────────────────────────────────┴───────────┴──────────────────┴────────────────────┘${C_RESET}"
    echo ""
}
