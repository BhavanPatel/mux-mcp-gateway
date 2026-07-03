#!/usr/bin/env bash
# Command: metrics — Show usage metrics and insights

cmd_metrics() {
    local METRICS_PATH="$HOME/.mux/metrics.json"

    if [[ ! -f "$METRICS_PATH" ]]; then
        warn "No metrics data yet. Use Mux for a while and check back."
        echo ""
        return
    fi

    python3 -c "
import json, sys, os
from datetime import datetime, timedelta
from collections import defaultdict

path = os.path.expanduser('~/.mux/metrics.json')
with open(path) as f:
    store = json.load(f)

events = store.get('events', [])
first_seen = store.get('firstSeen', 0)

if not events:
    print('  No data yet.')
    sys.exit(0)

now = int(datetime.now().timestamp() * 1000)
W = 66  # inner width between borders

# ─── Helpers ───────────────────────────────────────────────
def strip_ansi(s):
    import re
    return re.sub(r'\033\[[0-9;]*m', '', s)

def pad_line(content, width=W):
    visible_len = len(strip_ansi(content))
    padding = width - visible_len
    return content + ' ' * max(padding, 0)

C = '\033[38;5;39m'    # cyan border
B = '\033[1m'          # bold
R = '\033[0m'          # reset
G = '\033[38;5;243m'   # gray
W_ = '\033[1;37m'      # white bold
GR = '\033[38;5;46m'   # green
RD = '\033[38;5;196m'  # red
CY = '\033[38;5;87m'   # light cyan

def box_top():
    print(f'  {C}╔{\"═\" * W}╗{R}')

def box_bot():
    print(f'  {C}╚{\"═\" * W}╝{R}')

def box_sep():
    print(f'  {C}╠{\"═\" * W}╣{R}')

def box_line(content=''):
    print(f'  {C}║{R}{pad_line(content)}{C}║{R}')

def sec_top(title):
    title_part = f'─ {title} '
    print(f'  {B}┌{title_part}{\"─\" * (W - len(title_part))}┐{R}')

def sec_bot():
    print(f'  {B}└{\"─\" * W}┘{R}')

def sec_line(content=''):
    print(f'  {B}│{R}{pad_line(content)}{B}│{R}')

# ─── Gather data ──────────────────────────────────────────
all_calls = [e for e in events if e['type'] == 'call']
all_spawns = [e for e in events if e['type'] == 'spawn']
all_kills = [e for e in events if e['type'] == 'kill']
all_errors = [e for e in events if e['type'] == 'error']
auth_flows = [e for e in events if e['type'] == 'auth_flow']
auth_refreshes = [e for e in events if e['type'] == 'auth_refresh']
auth_hits = [e for e in events if e['type'] == 'auth_hit']

spawn_tools = [e for e in all_spawns if e.get('toolCount')]
avg_tools = round(sum(e['toolCount'] for e in spawn_tools) / len(spawn_tools)) if spawn_tools else 8
server_set = set(e.get('server','') for e in all_calls if e.get('server'))
total_servers = len(server_set)
without_mux = total_servers * avg_tools
with_mux = 3
reduction_pct = round((1 - with_mux / max(without_mux, 1)) * 100)

durations = [e['durationMs'] for e in all_calls if e.get('durationMs')]
avg_ms = round(sum(durations) / len(durations)) if durations else 0
est_tokens = len(all_calls) * (without_mux - with_mux) * 200
days_active = max(1, (now - first_seen) // 86400_000)
since_str = datetime.fromtimestamp(first_seen/1000).strftime('%b %d, %Y')

# ═══════════════════════════════════════════════════════════
# HEADER
# ═══════════════════════════════════════════════════════════
print()
box_top()
box_line()
box_line(f'  {B}{CY}⚡ MUX INSIGHTS{R}')
box_line()
box_sep()
box_line()
box_line(f'  {G}Tracking since{R}  {W_}{since_str}{R}  {G}({days_active} days){R}')
box_line(f'  {G}Total calls{R}     {W_}{len(all_calls):,}{R}')
box_line(f'  {G}Avg response{R}    {W_}{avg_ms}ms{R}')
box_line(f'  {G}Credit savings{R}  {GR}~{reduction_pct}% per request{R} {G}(Kiro){R}')
box_line(f'  {G}Tokens saved{R}    {GR}~{est_tokens:,}{R} {G}(API clients){R}')
box_line()
box_bot()
print()

# ═══════════════════════════════════════════════════════════
# CONTEXT REDUCTION
# ═══════════════════════════════════════════════════════════
sec_top('Context Reduction')
sec_line()

bar_w = 36
without_bar = f'{RD}{\"▓\" * bar_w}{R}'
with_bar_len = max(1, int((with_mux / max(without_mux, 1)) * bar_w))
with_bar = f'{GR}{\"▓\" * with_bar_len}{G}{\"░\" * (bar_w - with_bar_len)}{R}'

sec_line(f'   Without Mux  {without_bar}  {RD}{without_mux} tools{R}')
sec_line(f'   With Mux     {with_bar}  {GR}{with_mux} tools{R}')
sec_line()
sec_line(f'   {GR}{B}▼ {reduction_pct}% less context consumed per message{R}')
sec_line(f'   {G}Kiro: ~{reduction_pct}% fewer credits   API: ~{(without_mux - with_mux) * 200} fewer tokens/msg{R}')
sec_line()
sec_bot()
print()

# ═══════════════════════════════════════════════════════════
# ACTIVITY CHART
# ═══════════════════════════════════════════════════════════
sec_top('Activity (last 14 days)')
sec_line()

daily = defaultdict(int)
for e in all_calls:
    day_key = datetime.fromtimestamp(e['ts']/1000).strftime('%m/%d')
    daily[day_key] += 1

date_keys = []
for i in range(13, -1, -1):
    d = datetime.now() - timedelta(days=i)
    date_keys.append(d.strftime('%m/%d'))

max_daily = max((daily.get(k, 0) for k in date_keys), default=1) or 1
chart_h = 6

for row in range(chart_h, 0, -1):
    threshold = (row / chart_h) * max_daily
    cells = ''
    for k in date_keys:
        val = daily.get(k, 0)
        if val >= threshold:
            cells += f'{C}▓▓{R} '
        elif val >= threshold * 0.5:
            cells += f'\033[38;5;24m░░{R} '
        else:
            cells += '   '
    sec_line(f'   {cells}')

label_line = '   '
for i, k in enumerate(date_keys):
    if i % 2 == 0:
        label_line += f'{G}{k[3:]}{R} '
    else:
        label_line += '   '
sec_line(label_line)
sec_line(f'   {G}{\"─\" * 42}{R}')
sec_line(f'   {G}Peak:{R} {W_}{max_daily}{R} calls/day  {G}Avg:{R} {W_}{round(len(all_calls)/max(days_active,1))}{R} calls/day')
sec_line(f'   {C}▓▓{R} {G}= active{R}   \033[38;5;24m░░{R} {G}= low activity{R}   {G}   = no calls{R}')
sec_line()
sec_bot()
print()

# ═══════════════════════════════════════════════════════════
# TOP SERVERS
# ═══════════════════════════════════════════════════════════
server_counts = {}
for e in all_calls:
    s = e.get('server', '?')
    server_counts[s] = server_counts.get(s, 0) + 1

if server_counts:
    top = sorted(server_counts.items(), key=lambda x: -x[1])[:5]
    sec_top('Top Servers')
    sec_line()
    for name, count in top:
        bar_len = int((count / top[0][1]) * 28)
        pct = round((count / len(all_calls)) * 100)
        bar = f'{C}{\"█\" * bar_len}{G}{\"░\" * (28 - bar_len)}{R}'
        sec_line(f'   {CY}{name:<22s}{R} {bar} {W_}{count}{R} {G}({pct}%){R}')
    sec_line()
    sec_bot()
    print()

# ═══════════════════════════════════════════════════════════
# RESOURCE SAVINGS
# ═══════════════════════════════════════════════════════════
without_ram = total_servers * 50
with_ram = 50
ram_pct = round((1 - with_ram / max(without_ram, 1)) * 100)

sec_top('Resource Savings')
sec_line()
sec_line(f'   {G}RAM (idle){R}    {RD}~{without_ram}MB{R} → {GR}~{with_ram}MB{R}    {GR}▼ {ram_pct}% reduction{R}')
sec_line(f'   {G}Processes{R}     {RD}{total_servers} always{R} → {GR}1 + on-demand{R}')

reauths_avoided = len(auth_hits) + len(auth_refreshes)
total_auth = reauths_avoided + len(auth_flows)
auth_pct = round((reauths_avoided / max(total_auth, 1)) * 100) if total_auth else 0
sec_line(f'   {G}Re-auths{R}      {GR}{reauths_avoided} avoided{R} {G}({auth_pct}% automatic){R}')
sec_line(f'   {G}Idle kills{R}    {GR}{len(all_kills)} connections{R} {G}reclaimed{R}')
sec_line()
sec_bot()
print()

# ═══════════════════════════════════════════════════════════
# PERIOD TABLE
# ═══════════════════════════════════════════════════════════
periods = [
    ('Yesterday',     now - 86400_000),
    ('Last 7d',       now - 7 * 86400_000),
    ('Last 15d',      now - 15 * 86400_000),
    ('Last 30d',      now - 30 * 86400_000),
    ('Last 6mo',      now - 180 * 86400_000),
]

sec_top('Period Breakdown')
sec_line()
sec_line(f'   {W_}{\"Period\":<12s}  {\"Calls\":>8s}  {\"Spawns\":>8s}  {\"Kills\":>8s}  {\"Avg ms\":>8s}{R}')
sec_line(f'   {G}{\"─\" * 52}{R}')

for label, since in periods:
    calls = [e for e in events if e['ts'] >= since and e['type'] == 'call']
    spawns = [e for e in events if e['ts'] >= since and e['type'] == 'spawn']
    kills = [e for e in events if e['ts'] >= since and e['type'] == 'kill']
    durs = [e['durationMs'] for e in calls if e.get('durationMs')]
    avg = f'{round(sum(durs)/len(durs))}ms' if durs else '-'
    sec_line(f'   {CY}{label:<12s}{R}  {W_}{len(calls):>8,}{R}  {len(spawns):>8}  {len(kills):>8}  {avg:>8}')

sec_line()
sec_bot()
print()
"

}
