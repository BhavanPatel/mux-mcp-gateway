#!/usr/bin/env bash
# Command: status — Show Mux process status

cmd_status() {
    echo -e "\n  ${C_BOLD}Mux Status${C_RESET}\n"

    local pids
    pids=$(ps aux | grep "mux/dist/index.js" | grep -v grep | awk '{print $2}' || true)

    if [[ -n "$pids" ]]; then
        ok "Mux is ${C_GREEN}running${C_RESET}"
        echo -e "  ${C_GRAY}PIDs: ${pids//$'\n'/, }${C_RESET}"
    else
        warn "Mux is ${C_YELLOW}not running${C_RESET}"
        echo -e "  ${C_GRAY}Starts automatically when your AI client opens.${C_RESET}"
    fi

    echo ""
    if has_registry; then
        local count
        count=$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1])).get('servers',{})))" "$REGISTRY")
        info "Registry: ${C_WHITE}${count}${C_RESET} servers"
    else
        warn "No registry found"
    fi

    if [[ -f "$TOKENS" ]]; then
        local tc
        tc=$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))))" "$TOKENS" 2>/dev/null || echo "0")
        info "Tokens: ${C_WHITE}${tc}${C_RESET} cached"
    fi
    echo ""
}
