#!/usr/bin/env bash
# Command: keywords — View or edit keywords for a server

cmd_keywords() {
    local name="${1:-}"
    require_registry

    if [[ -z "$name" ]]; then
        echo ""
        echo -e "  ${B_COLOR}┌────────────────────────────────┬──────────────────────────────────────────────────────────────┐${C_RESET}"
        echo -e "  ${B_COLOR}│${C_RESET} ${C_WHITE}Server${C_RESET}                         ${B_COLOR}│${C_RESET} ${C_WHITE}Keywords${C_RESET}                                                     ${B_COLOR}│${C_RESET}"
        echo -e "  ${B_COLOR}├────────────────────────────────┼──────────────────────────────────────────────────────────────┤${C_RESET}"
        python3 -c "
import json, sys

B = '\033[38;5;39m'
C = '\033[38;5;87m'
G = '\033[38;5;243m'
R = '\033[0m'

with open(sys.argv[1]) as f: r = json.load(f)
servers = list(r.get('servers', {}).items())
for i, (n, c) in enumerate(servers):
    kw_list = c.get('keywords', [])
    # First row: server name + first chunk of keywords
    rows = []
    for j in range(0, len(kw_list), 5):
        rows.append(', '.join(kw_list[j:j+5]))
    if not rows:
        rows = ['(none)']
    # Print first row with server name
    print(f'  {B}│{R} {C}{n:<30s}{R} {B}│{R} {G}{rows[0]:<60s}{R} {B}│{R}')
    # Print remaining keyword rows
    for row in rows[1:]:
        print(f'  {B}│{R} {\"\":<30s} {B}│{R} {G}{row:<60s}{R} {B}│{R}')
    # Separator between servers (except last)
    if i < len(servers) - 1:
        print(f'  {B}├────────────────────────────────┼──────────────────────────────────────────────────────────────┤{R}')
" "$REGISTRY"
        echo -e "  ${B_COLOR}└────────────────────────────────┴──────────────────────────────────────────────────────────────┘${C_RESET}"
        echo ""
        echo -e "  ${C_GRAY}Edit keywords: ${C_CYAN}mux-cli keywords <server-name>${C_RESET}"
        echo ""
        return
    fi

    # Show current keywords
    local current
    current=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f: r = json.load(f)
srv = r.get('servers', {}).get(sys.argv[2])
if not srv: print('NOT_FOUND'); sys.exit(0)
print(','.join(srv.get('keywords', [])))
" "$REGISTRY" "$name")

    if [[ "$current" == "NOT_FOUND" ]]; then
        err "Server '${name}' not found."
        return
    fi

    echo -e "\n  ${C_BOLD}Keywords for: ${C_CYAN}${name}${C_RESET}"
    if [[ -n "$current" ]]; then
        echo -e "  ${C_GRAY}Current: ${C_WHITE}${current//,/, }${C_RESET}"
    else
        echo -e "  ${C_GRAY}Current: (none)${C_RESET}"
    fi
    echo ""
    echo -e "  ${C_WHITE}What would you like to do?${C_RESET}"
    echo -e "    1) Add keywords     ${C_GRAY}— append to existing${C_RESET}"
    echo -e "    2) Replace keywords  ${C_GRAY}— start fresh${C_RESET}"
    echo ""
    read -rp "  Choice [1]: " action
    action=${action:-1}

    echo -e "\n  ${C_GRAY}Enter keywords (comma-separated):${C_RESET}"
    read -rp "  > " new_keywords

    if [[ -z "$new_keywords" ]]; then
        ok "Keywords unchanged."
        return
    fi

    local mode="append"
    [[ "$action" == "2" ]] && mode="replace"

    local result
    result=$(python3 -c "
import json, sys
name = sys.argv[1]
new_kw = [k.strip() for k in sys.argv[2].split(',') if k.strip()]
mode = sys.argv[3]
with open(sys.argv[4]) as f: r = json.load(f)
existing = r['servers'][name].get('keywords', [])
if mode == 'append':
    combined = list(dict.fromkeys(existing + new_kw))
else:
    combined = new_kw
r['servers'][name]['keywords'] = combined
with open(sys.argv[4], 'w') as f: json.dump(r, f, indent=2)
print(', '.join(combined))
" "$name" "$new_keywords" "$mode" "$REGISTRY")

    ok "Keywords for ${C_CYAN}${name}${C_RESET}: ${C_WHITE}${result}${C_RESET}"
    echo -e "  ${C_GRAY}Changes are hot-reloaded.${C_RESET}\n"
}
