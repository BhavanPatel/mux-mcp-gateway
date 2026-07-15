#!/usr/bin/env bash
# Command: update — Update mux-cli to the latest version from npm registry

cmd_update() {
    echo -e "\n  ${C_BOLD}Updating Mux${C_RESET}\n"

    info "Checking current version..."
    local current_version
    current_version=$(node -p "require('${SCRIPT_DIR}/package.json').version" 2>/dev/null || echo "unknown")
    echo -e "  Current: ${C_CYAN}${current_version}${C_RESET}"

    info "Fetching latest from registry..."
    local update_out
    update_out=$(npm update -g mux-mcp-gateway 2>&1)
    if [[ $? -eq 0 ]]; then
        ok "Package updated"
    else
        err "Update failed: ${update_out}"
        exit 1
    fi

    local new_version
    new_version=$(npm list -g mux-mcp-gateway --depth=0 2>/dev/null | grep mux-mcp-gateway | sed 's/.*@//')

    echo ""
    if [[ "$current_version" == "$new_version" ]]; then
        ok "${C_GREEN}Already on latest version${C_RESET} (${new_version})"
    else
        ok "${C_GREEN}Mux updated!${C_RESET} ${current_version} → ${new_version}"
    fi

    # Clear version cache so next startup shows correct info
    rm -f "$HOME/.mux/version-check.json"

    echo ""
}
