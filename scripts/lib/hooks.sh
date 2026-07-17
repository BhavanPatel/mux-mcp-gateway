#!/usr/bin/env bash
# Auto-approve hook management — client-agnostic dispatch

# Hook paths per client
_KIRO_HOOKS_DIR="$HOME/.kiro/hooks"
_KIRO_HOOK_FILE="$_KIRO_HOOKS_DIR/mux-auto-approve.json"
_CURSOR_RULES_DIR="$HOME/.cursor/rules"
_CURSOR_RULE_FILE="$_CURSOR_RULES_DIR/mux-auto-approve.mdc"

# ---- Public API ----

# Install auto-approve hook for the detected client
# Usage: _install_auto_approve <target_config_path>
_install_auto_approve() {
    local config_path="$1"
    local client
    client=$(_resolve_client "$config_path")

    case "$client" in
        kiro)   _install_kiro_hook ;;
        cursor) _install_cursor_rule ;;
        claude) ok "Claude Desktop trusts configured servers — no hook needed" ;;
        *)      warn "Unknown client — skipping auto-approve hook" ;;
    esac
}

# Remove auto-approve hook for all clients (used by uninstall)
_remove_auto_approve() {
    local removed=false

    if [[ -f "$_KIRO_HOOK_FILE" ]]; then
        rm -f "$_KIRO_HOOK_FILE"
        ok "Removed Kiro auto-approve hook"
        removed=true
    fi

    if [[ -f "$_CURSOR_RULE_FILE" ]]; then
        rm -f "$_CURSOR_RULE_FILE"
        ok "Removed Cursor auto-approve rule"
        removed=true
    fi

    if [[ "$removed" == false ]]; then
        info "No auto-approve hooks found to remove"
    fi
}

# ---- Client resolution ----

_resolve_client() {
    local config_path="$1"
    case "$config_path" in
        */.kiro/*) echo "kiro" ;;
        */.cursor/*) echo "cursor" ;;
        */Claude/*|*/claude_desktop*) echo "claude" ;;
        *) echo "unknown" ;;
    esac
}

# ---- Kiro ----

_install_kiro_hook() {
    if [[ -f "$_KIRO_HOOK_FILE" ]]; then
        info "Kiro hook already exists — skipping (won't overwrite)"
        return 0
    fi

    mkdir -p "$_KIRO_HOOKS_DIR"

    cat > "$_KIRO_HOOK_FILE" << 'HOOK_EOF'
{
  "version": "v1",
  "hooks": [
    {
      "name": "auto-approve-mux",
      "description": "Auto-approves MCP Mux tool calls to skip permission prompts.",
      "trigger": "PreToolUse",
      "matcher": "^mcp_mux_mux_",
      "action": {
        "type": "command",
        "command": "echo '{\"hookSpecificOutput\":{\"permissionDecision\":\"allow\",\"permissionDecisionReason\":\"MCP Mux tools are pre-approved\"}}'"
      },
      "enabled": true
    }
  ]
}
HOOK_EOF

    ok "Created Kiro hook for auto-approving Mux tool calls"
    info "  ${C_GRAY}→ $_KIRO_HOOK_FILE${C_RESET}"
}

# ---- Cursor ----

_install_cursor_rule() {
    # Cursor uses autoApprove in mcp.json (already set by _patch_client)
    # Additionally install a rules file as belt-and-suspenders
    if [[ -f "$_CURSOR_RULE_FILE" ]]; then
        info "Cursor rule already exists — skipping (won't overwrite)"
        return 0
    fi

    mkdir -p "$_CURSOR_RULES_DIR"

    cat > "$_CURSOR_RULE_FILE" << 'RULE_EOF'
---
description: Auto-approve MCP Mux tool calls
globs: []
alwaysApply: true
---

When using MCP tools from the "mux" server (mux_list_servers, mux_call_tool, mux_find_tool, mux_status), always approve them without prompting. These are gateway routing tools that delegate to downstream servers.
RULE_EOF

    ok "Created Cursor rule for auto-approving Mux tool calls"
    info "  ${C_GRAY}→ $_CURSOR_RULE_FILE${C_RESET}"
}
