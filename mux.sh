#!/usr/bin/env bash
# mux.sh — Unified CLI for Mux MCP Gateway
# Usage: ./mux.sh [command] [args]
set -uo pipefail

export SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")")" && pwd)"

# Load shared libraries
source "$SCRIPT_DIR/scripts/lib/theme.sh"
source "$SCRIPT_DIR/scripts/lib/registry.sh"

# Interactive menu
_show_menu() {
    print_header
    echo -e "  ${C_BOLD}What would you like to do?${C_RESET}\n"
    echo -e "    ${C_CYAN}1)${C_RESET} Fresh setup      ${C_GRAY}— Import from existing mcp.json${C_RESET}"
    echo -e "    ${C_CYAN}2)${C_RESET} Add server       ${C_GRAY}— Add a new MCP server${C_RESET}"
    echo -e "    ${C_CYAN}3)${C_RESET} Remove server    ${C_GRAY}— Remove an MCP server${C_RESET}"
    echo -e "    ${C_CYAN}4)${C_RESET} Authorize        ${C_GRAY}— Auth an HTTP server (browser)${C_RESET}"
    echo -e "    ${C_CYAN}5)${C_RESET} Health check     ${C_GRAY}— Test all servers${C_RESET}"
    echo -e "    ${C_CYAN}6)${C_RESET} List servers     ${C_GRAY}— Show current registry${C_RESET}"
    echo -e "    ${C_CYAN}7)${C_RESET} Metrics          ${C_GRAY}— Usage stats + insights${C_RESET}"
    echo -e "    ${C_CYAN}8)${C_RESET} Status           ${C_GRAY}— Show Mux process info${C_RESET}"
    echo ""
    read -rp "  Choice [1]: " choice
    case "${choice:-1}" in
        1) source "$SCRIPT_DIR/scripts/commands/setup.sh"; cmd_setup ;;
        2) source "$SCRIPT_DIR/scripts/commands/add.sh"; cmd_add ;;
        3) source "$SCRIPT_DIR/scripts/commands/remove.sh"; cmd_remove ;;
        4) source "$SCRIPT_DIR/scripts/commands/auth.sh"; cmd_auth ;;
        5) source "$SCRIPT_DIR/scripts/commands/health.sh"; cmd_health ;;
        6) source "$SCRIPT_DIR/scripts/commands/list.sh"; cmd_list ;;
        7) source "$SCRIPT_DIR/scripts/commands/metrics.sh"; cmd_metrics ;;
        8) source "$SCRIPT_DIR/scripts/commands/status.sh"; cmd_status ;;
        *) err "Invalid choice"; exit 1 ;;
    esac
}

# Main router
main() {
    local cmd="${1:-}"
    case "$cmd" in
        setup)  shift; source "$SCRIPT_DIR/scripts/commands/setup.sh"; cmd_setup "$@" ;;
        add)    shift; source "$SCRIPT_DIR/scripts/commands/add.sh"; cmd_add "$@" ;;
        remove) shift; source "$SCRIPT_DIR/scripts/commands/remove.sh"; cmd_remove "$@" ;;
        auth)   shift; source "$SCRIPT_DIR/scripts/commands/auth.sh"; cmd_auth "$@" ;;
        health) source "$SCRIPT_DIR/scripts/commands/health.sh"; cmd_health ;;
        list)   source "$SCRIPT_DIR/scripts/commands/list.sh"; cmd_list ;;
        status) source "$SCRIPT_DIR/scripts/commands/status.sh"; cmd_status ;;
        update) source "$SCRIPT_DIR/scripts/commands/update.sh"; cmd_update ;;
        metrics) source "$SCRIPT_DIR/scripts/commands/metrics.sh"; cmd_metrics ;;
        keywords) shift; source "$SCRIPT_DIR/scripts/commands/keywords.sh"; cmd_keywords "$@" ;;
        -h|--help)
            print_header
            exit 0 ;;
        "")
            if has_registry; then _show_menu
            else source "$SCRIPT_DIR/scripts/commands/setup.sh"; cmd_setup; fi ;;
        *) err "Unknown command: $cmd"; echo "  Run mux-cli --help"; exit 1 ;;
    esac
}

main "$@"
