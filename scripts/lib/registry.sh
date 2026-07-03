#!/usr/bin/env bash
# Registry helpers

MUX_DIR="$HOME/.mux"
REGISTRY="$MUX_DIR/servers.json"
TOKENS="$MUX_DIR/tokens.json"

has_registry() { [[ -f "$REGISTRY" ]] && [[ -s "$REGISTRY" ]]; }

ensure_registry() {
    mkdir -p "$MUX_DIR"
    if ! has_registry; then
        echo '{"servers":{}}' > "$REGISTRY"
    fi
    if [[ ! -f "$TOKENS" ]]; then
        touch "$TOKENS"
        chmod 600 "$TOKENS"
    fi
}

require_registry() {
    if ! has_registry; then
        err "No registry found. Run ${C_CYAN}mux-cli setup${C_RESET} first."
        exit 1
    fi
}
