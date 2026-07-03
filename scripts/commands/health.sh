#!/usr/bin/env bash
# Command: health — Run health check on all servers

cmd_health() {
    require_registry
    echo -e "\n  ${C_BOLD}Server Health Check${C_RESET}\n"

    local check_output
    check_output=$(python3 -c "
import json, sys, os, shutil
with open(sys.argv[1]) as f: reg = json.load(f)
for name, cfg in reg.get('servers',{}).items():
    t = cfg.get('transport','stdio')
    if t == 'stdio':
        cmd = cfg.get('command','')
        if not cmd: print(f'fail|{name}|stdio|No command'); continue
        if not shutil.which(cmd): print(f'fail|{name}|stdio|Command not found: {cmd}'); continue
        missing = [v[2:-1] for k,v in cfg.get('env',{}).items() if isinstance(v,str) and v.startswith('\${') and v.endswith('}') and not os.environ.get(v[2:-1])]
        if missing: print(f'warn|{name}|stdio|Missing env: {chr(44).join(missing[:3])}')
        else: print(f'pass|{name}|stdio|Ready')
    elif t == 'http':
        url = cfg.get('url','')
        if not url: print(f'fail|{name}|http|No URL'); continue
        has_token = False
        try:
            with open(os.path.expanduser('~/.mux/tokens.json')) as f:
                tk = json.load(f).get(name,{})
                has_token = bool(tk.get('access_token') or tk.get('accessToken'))
        except: pass
        if has_token: print(f'pass|{name}|http|Token cached')
        else: print(f'warn|{name}|http|Not authorized (mux-cli auth)')
" "$REGISTRY")

    _print_health_table "$check_output"
}


_print_health_table() {
    local output="$1"
    echo -e "  ${B_COLOR}┌──────┬────────────────────────────────┬───────────┬──────────────────────────────────────────────┐${C_RESET}"
    echo -e "  ${B_COLOR}│${C_RESET}      ${B_COLOR}│${C_RESET} ${C_WHITE}Server${C_RESET}                         ${B_COLOR}│${C_RESET} ${C_WHITE}Transport${C_RESET} ${B_COLOR}│${C_RESET} ${C_WHITE}Status${C_RESET}                                       ${B_COLOR}│${C_RESET}"
    echo -e "  ${B_COLOR}├──────┼────────────────────────────────┼───────────┼──────────────────────────────────────────────┤${C_RESET}"

    local pass_count=0 warn_count=0 fail_count=0
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        IFS='|' read -r status name transport reason <<< "$line"
        local icon color
        case "$status" in
            pass) icon="✔"; color="${C_GREEN}"; pass_count=$((pass_count+1)) ;;
            warn) icon="◬"; color="${C_YELLOW}"; warn_count=$((warn_count+1)) ;;
            fail) icon="✖"; color="${C_RED}"; fail_count=$((fail_count+1)) ;;
            *)    icon="?"; color="${C_GRAY}" ;;
        esac
        printf "  ${B_COLOR}│${C_RESET} ${color} %s ${C_RESET} ${B_COLOR}│${C_RESET} ${C_CYAN}%-30s${C_RESET} ${B_COLOR}│${C_RESET} %-9s ${B_COLOR}│${C_RESET} ${color}%-44s${C_RESET} ${B_COLOR}│${C_RESET}\n" "$icon" "$name" "$transport" "$reason"
    done <<< "$output"

    echo -e "  ${B_COLOR}└──────┴────────────────────────────────┴───────────┴──────────────────────────────────────────────┘${C_RESET}"
    echo ""
    echo -e "  ${C_GREEN}✔ ${pass_count} ready${C_RESET}   ${C_YELLOW}◬ ${warn_count} warnings${C_RESET}   ${C_RED}✖ ${fail_count} failed${C_RESET}"
    echo ""
}
