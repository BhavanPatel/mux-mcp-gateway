# Telemetry & Privacy

Mux collects **usage metrics on your machine only**. This document states the
posture explicitly so it can be reviewed.

## What is collected

Mux records lightweight events to help you see your own usage in `mux metrics`
and the dashboard:

- Tool-call counts and response durations
- Server spawn / disconnect events and downstream tool counts
- Auth cache hits, refreshes, and interactive flows
- Error counts

Each event is a small JSON object with a timestamp, a type, and (where relevant)
a server name and duration. Tool **arguments are never recorded** — only counts
and timings.

## Where it is stored

- File: `~/.mux/metrics.json`
- Permissions: directory `0700`, file `0600` (owner read/write only)
- Retention: events older than **180 days** are pruned automatically

## What is NOT done

- **Nothing is ever transmitted.** Mux makes no network request to send metrics
  anywhere. There is no analytics endpoint, no phone-home, no third party. (The
  only outbound request Mux makes is the explicit `mux update` version check
  against the npm registry.)
- No personal data, no tool arguments, no secrets. Logs and crash reports are
  additionally passed through a redaction pass before being written.

## Opting out

Set either standard environment variable to disable metrics recording entirely
(no events recorded, nothing written to `metrics.json`):

```sh
export MUX_NO_TELEMETRY=1
# or the cross-tool standard:
export DO_NOT_TRACK=1
```

With either set, `mux metrics` and the dashboard simply show no data.

## Related

- Logs: `~/.mux/mux.log` (NDJSON, redacted, rotated at 5 MB). Disable with
  `MUX_LOG_TO_FILE=false`.
- Crash reports: `~/.mux/crashes/<timestamp>.json` (redacted, last 20 kept).
- Bundle everything for a bug report — already redacted — with `mux report-bug --json`.
