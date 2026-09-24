# Security Policy

## Supported Versions

Mux follows semantic versioning. Security fixes are applied to the latest
released minor of the current major line.

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately through one of these channels:

1. **GitHub Security Advisories** (preferred) — open a draft advisory at
   <https://github.com/BhavanPatel/mux-mcp-gateway/security/advisories/new>.
   This keeps the report private until a fix is released.
2. **Email** — if you cannot use GitHub advisories, email the maintainer via
   the address on the GitHub profile <https://github.com/BhavanPatel>, with
   `[mux security]` in the subject.

Please include:

- affected version (`mux --version`) and platform;
- a description of the issue and its impact;
- reproduction steps or a proof of concept;
- any suggested remediation.

## What to Expect

- **Acknowledgement** within 3 business days.
- **Initial assessment** (severity + whether it is in scope) within 7 days.
- **Fix and disclosure**: we aim to ship a patch and publish an advisory within
  30 days of confirmation, coordinating a disclosure date with the reporter.

## Scope Notes

Mux is a local MCP gateway. It handles OAuth tokens and downstream credentials.
Reports we especially want to hear about:

- credential or token leakage (logs, crash reports, metrics, error messages);
- command or argument injection into spawned downstream servers;
- the loopback OAuth callback binding beyond `127.0.0.1`;
- file-permission regressions on `~/.mux/` (tokens, logs, metrics).

Mux redacts secrets from logs, crash reports, and telemetry by design; a bypass
of that redaction is in scope.
