#!/usr/bin/env bash
# Shared ANSI theme, box drawing, status helpers

readonly B_COLOR='\033[38;5;39m'
readonly H_COLOR='\033[38;5;123m'
readonly C_CYAN='\033[38;5;87m'
readonly C_GREEN='\033[38;5;46m'
readonly C_RED='\033[38;5;196m'
readonly C_YELLOW='\033[38;5;220m'
readonly C_GRAY='\033[38;5;243m'
readonly C_WHITE='\033[1;37m'
readonly C_BOLD='\033[1m'
readonly C_DIM='\033[2m'
readonly C_RESET='\033[0m'
W=68

_line()  { printf '%*s' "$W" '' | tr ' ' "$1"; }
_box_top()    { echo -e "${B_COLOR}╔$(_line '═')╗${C_RESET}"; }
_box_bottom() { echo -e "${B_COLOR}╚$(_line '═')╝${C_RESET}"; }
_box_sep()    { echo -e "${B_COLOR}╠$(_line '═')╣${C_RESET}"; }
_box_line() {
    local content="$1"
    local plain
    plain=$(echo -e "$content" | LC_ALL=en_US.UTF-8 sed "s/$(printf '\033')\\[[0-9;]*m//g")
    local len=${#plain}
    local pad=$((W - len))
    [ "$pad" -lt 0 ] && pad=0
    echo -e "${B_COLOR}║${C_RESET}${content}$(printf '%*s' "$pad" '')${B_COLOR}║${C_RESET}"
}

ok()   { echo -e "  ${C_GREEN}✔${C_RESET} $1"; }
warn() { echo -e "  ${C_YELLOW}◬${C_RESET} $1"; }
err()  { echo -e "  ${C_RED}✖${C_RESET} $1"; }
info() { echo -e "  ${C_CYAN}⋯${C_RESET} $1"; }
step() { echo -e "\n${B_COLOR}━━━${C_RESET} ${C_BOLD}$1${C_RESET} ${B_COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}\n"; }

print_header() {
    local G1='\033[38;5;33m' G2='\033[38;5;39m' G3='\033[38;5;45m'
    echo ""
    _box_top
    _box_line ""
    _box_line "  ${C_BOLD}${G1}███╗   ███╗${G2}██╗   ██╗${G3}██╗  ██╗${C_RESET}"
    _box_line "  ${C_BOLD}${G1}████╗ ████║${G2}██║   ██║${G3}╚██╗██╔╝${C_RESET}"
    _box_line "  ${C_BOLD}${G1}██╔████╔██║${G2}██║   ██║${G3} ╚███╔╝ ${C_RESET}"
    _box_line "  ${C_BOLD}${G1}██║╚██╔╝██║${G2}██║   ██║${G3} ██╔██╗ ${C_RESET}"
    _box_line "  ${C_BOLD}${G1}██║ ╚═╝ ██║${G2}╚██████╔╝${G3}██╔╝ ██╗${C_RESET}"
    _box_line "  ${C_BOLD}${G1}╚═╝     ╚═╝${G2} ╚═════╝ ${G3}╚═╝  ╚═╝${C_RESET}"
    _box_line ""
    _box_line "  ${C_GRAY}MCP GATEWAY ROUTER${C_RESET}"
    _box_line "  ${C_DIM}${C_GRAY}One MCP to rule them all${C_RESET}"
    _box_line ""
    _box_sep
    _box_line ""
    local version
    version=$(node -p "require('${SCRIPT_DIR}/package.json').version" 2>/dev/null || echo "unknown")
    _box_line "  ${C_GRAY}Version:  ${C_WHITE}${version}${C_RESET}"
    _box_line "  ${C_GRAY}Author:   ${C_WHITE}Bhavan Kirtikumar Patel${C_RESET}"
    _box_line "  ${C_GRAY}Date:     ${C_WHITE}$(date '+%Y-%m-%d %H:%M:%S')${C_RESET}"
    _box_line ""
    _box_sep
    _box_line ""
    _box_line "  ${C_WHITE}Commands:${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli setup${C_RESET}              ${C_GRAY}Import from existing mcp.json${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli add${C_RESET} ${C_WHITE}<name>${C_RESET}        ${C_GRAY}Add a new MCP server${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli remove${C_RESET} ${C_WHITE}<name>${C_RESET}     ${C_GRAY}Remove a server${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli auth${C_RESET} ${C_WHITE}[--all]${C_RESET}      ${C_GRAY}Authorize HTTP servers${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli health${C_RESET}             ${C_GRAY}Test all servers${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli list${C_RESET}               ${C_GRAY}Show registered servers${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli status${C_RESET}             ${C_GRAY}Show process info${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli uninstall${C_RESET}          ${C_GRAY}Remove Mux completely${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli metrics${C_RESET}            ${C_GRAY}Usage stats + insights${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli keywords${C_RESET} ${C_WHITE}[name]${C_RESET}   ${C_GRAY}View/edit server keywords${C_RESET}"
    _box_line "    ${C_CYAN}mux-cli update${C_RESET}             ${C_GRAY}Update to latest version${C_RESET}"
    _box_line ""
    _box_bottom

    # Version check (cached, non-blocking)
    _check_version_update "$version"

    echo ""
}


_check_version_update() {
    local current="$1"
    local cache_dir="$HOME/.mux"
    local cache_file="$cache_dir/version-check.json"
    local cache_ttl=300  # 5 minutes

    mkdir -p "$cache_dir"

    # Check if cache is fresh AND was checked from the same local version
    local latest=""
    if [[ -f "$cache_file" ]]; then
        local cache_age=0
        if [[ "$(uname)" == "Darwin" ]]; then
            cache_age=$(( $(date +%s) - $(stat -f %m "$cache_file") ))
        else
            cache_age=$(( $(date +%s) - $(stat -c %Y "$cache_file") ))
        fi
        # Cache is valid only if fresh AND checked from same version
        local cached_from
        cached_from=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('from',''))" "$cache_file" 2>/dev/null)
        if [[ "$cache_age" -lt "$cache_ttl" && "$cached_from" == "$current" ]]; then
            latest=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('latest',''))" "$cache_file" 2>/dev/null)
        fi
    fi

    # Fetch latest if cache is stale or version changed
    if [[ -z "$latest" ]]; then
        latest=$(npm view mux-mcp-gateway version 2>/dev/null || echo "")
        if [[ -n "$latest" ]]; then
            echo "{\"latest\":\"$latest\",\"from\":\"$current\",\"checked\":$(date +%s)}" > "$cache_file"
        fi
    fi

    # Display result
    if [[ -z "$latest" ]]; then
        return  # Silently skip if offline
    fi

    # Compare versions (only notify if registry is newer)
    local is_newer
    is_newer=$(python3 -c "
import sys
c = tuple(int(x) for x in sys.argv[1].split('.'))
l = tuple(int(x) for x in sys.argv[2].split('.'))
print('yes' if l > c else 'no')
" "$current" "$latest" 2>/dev/null || echo "no")

    if [[ "$current" == "$latest" || "$is_newer" == "no" ]]; then
        echo -e "  ${C_GREEN}✔${C_RESET} ${C_GRAY}You're on the latest version${C_RESET}"
    else
        echo ""
        echo -e "  ${C_YELLOW}◬${C_RESET} ${C_WHITE}Update available:${C_RESET} ${C_GRAY}${current}${C_RESET} → ${C_GREEN}${latest}${C_RESET}"
        echo -e "    ${C_GRAY}Run ${C_CYAN}mux-cli update${C_GRAY} to upgrade${C_RESET}"
    fi
}
