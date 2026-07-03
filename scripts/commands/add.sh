#!/usr/bin/env bash
# Command: add — Add a server to registry

cmd_add() {
    local name="${1:-}" json_input="${2:-}"
    ensure_registry

    # Direct JSON mode: mux-cli add <name> '<json>'
    if [[ -n "$json_input" ]]; then
        _add_from_json "$name" "$json_input"
        return
    fi

    [[ -z "$name" ]] && read -rp "  Server name: " name

    echo -e "\n  ${C_BOLD}Adding server: ${C_CYAN}${name}${C_RESET}\n"
    echo -e "  ${C_WHITE}How do you want to add it?${C_RESET}"
    echo -e "    1) Interactive — answer prompts"
    echo -e "    2) Paste JSON  — paste your mcp.json entry"
    echo ""
    read -rp "  Choice [1]: " method

    if [[ "${method:-1}" == "2" ]]; then
        echo -e "\n  ${C_GRAY}Paste your MCP server JSON (the value object):${C_RESET}"
        echo -e "  ${C_GRAY}Example: {\"type\":\"https\",\"url\":\"https://...\"}${C_RESET}"
        echo -e "  ${C_GRAY}Press Enter twice when done.${C_RESET}\n"
        local raw_json="" line=""
        echo -n "  > "
        while IFS= read -r line; do
            [[ -z "$line" && -z "$raw_json" ]] && continue
            [[ -z "$line" ]] && break
            raw_json="${raw_json}${line}"
        done
        _add_from_json "$name" "$raw_json"
        return
    fi

    echo -e "\n  ${C_WHITE}Transport:${C_RESET}"
    echo -e "    1) stdio  — local command (npx, uvx, node)"
    echo -e "    2) http   — remote URL (SSE/Streamable HTTP)"
    echo ""
    read -rp "  Choice [1]: " transport_choice

    if [[ "${transport_choice:-1}" == "2" ]]; then
        read -rp "  URL: " url
        read -rp "  Keywords (comma-separated, e.g. feature flag, toggle, config): " keywords_str
        python3 -c "
import json, sys
name, url = sys.argv[1], sys.argv[3]
kw = [k.strip().lower() for k in sys.argv[4].split(',') if k.strip()]
with open(sys.argv[2]) as f: r = json.load(f)
r['servers'][name] = {'transport':'http','url':url,'keywords':kw,'idleTimeoutMs':300000}
with open(sys.argv[2],'w') as f: json.dump(r, f, indent=2)
" "$name" "$REGISTRY" "$url" "$keywords_str"
    else
        read -rp "  Command (e.g. npx, uvx, node): " cmd
        read -rp "  Args (space-separated): " args_str
        read -rp "  Env vars (KEY=VAL KEY2=VAL2, or empty): " env_str
        read -rp "  Keywords (comma-separated, e.g. git, merge request, pipeline): " keywords_str
        python3 -c "
import json, sys
name, cmd = sys.argv[1], sys.argv[2]
args = sys.argv[3].split() if sys.argv[3] else []
env = dict(p.split('=',1) for p in sys.argv[4].split() if '=' in p) if sys.argv[4] else {}
kw = [k.strip().lower() for k in sys.argv[5].split(',') if k.strip()]
with open(sys.argv[6]) as f: r = json.load(f)
e = {'transport':'stdio','command':cmd,'args':args,'keywords':kw,'idleTimeoutMs':300000}
if env: e['env'] = env
r['servers'][name] = e
with open(sys.argv[6],'w') as f: json.dump(r, f, indent=2)
" "$name" "$cmd" "$args_str" "$env_str" "$keywords_str" "$REGISTRY"
    fi

    echo ""
    ok "Server ${C_CYAN}${name}${C_RESET} added to registry"
    echo -e "  ${C_GRAY}Changes are hot-reloaded — no restart needed.${C_RESET}\n"
}

_add_from_json() {
    local name="$1" raw="$2"

    # Auto-generate keywords from name, let user confirm/edit
    local auto_kw
    auto_kw=$(python3 -c "
import sys
name = sys.argv[1]
kw = set()
for part in name.replace('_', '-').split('-'):
    if len(part) > 2 and part not in ('mcp', 'server', 'test', 'prod', 'dev'):
        kw.add(part.lower())
print(', '.join(sorted(kw)[:5]))
" "$name")

    echo -e "  ${C_GRAY}Auto-detected keywords: ${C_WHITE}${auto_kw}${C_RESET}"
    read -rp "  Keywords (edit or Enter to accept): " user_kw
    local final_kw="${user_kw:-$auto_kw}"

    python3 -c "
import json, sys
name, raw = sys.argv[1], sys.argv[2]
kw = [k.strip().lower() for k in sys.argv[4].split(',') if k.strip()]
cfg = json.loads(raw)
with open(sys.argv[3]) as f: r = json.load(f)
e = {}
if cfg.get('url') or cfg.get('type') in ('http','https'):
    e = {'transport':'http','url':cfg.get('url',''),'keywords':kw,'idleTimeoutMs':300000}
    if cfg.get('headers'): e['headers'] = cfg['headers']
elif cfg.get('command'):
    e = {'transport':'stdio','command':cfg['command'],'args':cfg.get('args',[]),'keywords':kw,'idleTimeoutMs':300000}
    if cfg.get('env'): e['env'] = cfg['env']
r['servers'][name] = e
with open(sys.argv[3],'w') as f: json.dump(r, f, indent=2)
" "$name" "$raw" "$REGISTRY" "$final_kw"
    ok "Server ${C_CYAN}${name}${C_RESET} added from JSON"
    echo -e "  ${C_GRAY}Changes are hot-reloaded — no restart needed.${C_RESET}\n"
}
