# Changelog

## [1.1.0] — 2026-07-15

### Fixed
- **False auth detection** — HTTP servers that don't support OAuth (API-key-based, internal services) no longer trigger the 120s auth timeout. Mux now probes `/.well-known/oauth-authorization-server` before starting the OAuth flow.
- **Auth timeout ignoring completed auth** — Token file polling now detects externally-completed authorization immediately instead of waiting the full 120s timeout.

### Added
- **Countdown timer** — Auth wait displays remaining seconds to stderr so users can see how long until timeout.
- OAuth discovery probe test suite (`test/test-auth-discovery.mjs`)

## [1.0.2] — 2026-07-03

### Changed
- ci

## [1.0.1] — 2026-07-03

### Changed
- npm i

## [0.10.0] — 2026-07-02

### Added
-  Increase HTTP server auth timeout and support pre-registered OAuth clients

## [0.9.0] — 2026-07-02

### Added
-  Configure npm registry and improve version comparison logic

## [0.8.0] — 2026-07-02

### Added
-  Expand mux server auto-approve permissions

## [0.7.0] — 2026-07-02

### Added
-  Add cached version update check to CLI output

## [0.6.0] — 2026-07-02

### Added
-  Add keyword support for MCP server configuration

## [0.5.1] — 2026-07-01

### Changed
-  Optimize Docker build and improve docs path resolution

## [0.5.0] — 2026-07-01

### Added
-  Replace mermaid npm dependency with CDN script loader

## [0.4.0] — 2026-07-01

### Added
-  Add sticky navigation and section anchors

## [0.3.0] — 2026-07-01

### Added
-  Add documentation pages with markdown rendering and diagrams

## [0.2.28] — 2026-07-01

### Changed
-  Extract deploy token and configure scoped registry

## [0.2.27] — 2026-07-01

### Changed
- ci(.gitlab-ci.yml): Simplify npm publish script logic

## [0.2.26] — 2026-07-01

### Changed
- ci(.gitlab-ci.yml): Simplify CI rules and remove path-based triggers

## [0.2.25] — 2026-07-01

### Changed
- ci(.gitlab-ci.yml): Add helm-fix-pending job to clear stuck releases

## [0.2.24] — 2026-07-01

### Changed
-  Update tool count from 3 to 4 and expand documentation

## [0.2.23] — 2026-07-01

### Changed
-  Improve table formatting and metrics output

## [0.2.22] — 2026-07-01

### Changed
- ci(.gitlab-ci.yml): Remove path-based change detection for website deployments

## [0.2.21] — 2026-07-01

### Changed
- ci(.gitlab-ci.yml): Extract shared CLI job rules to YAML anchors

## [0.2.20] — 2026-07-01

### Changed
-  Replace npm registry install with curl-based script

## [0.2.19] — 2026-07-01

### Changed
-  Add GitLab deploy token to npm registry URLs

## [0.2.18] — 2026-07-01

### Changed
-  Update mux-cli to use npm registry instead of git pull

## [0.2.17] — 2026-07-01

### Changed
- ci(.gitlab-ci.yml): Add path-based change detection for website deployments

## [0.2.16] — 2026-07-01

### Changed
-  Include public assets in production image

## [0.2.15] — 2026-07-01

### Changed
-  Redesign documentation navigation with improved badge iconography

## [0.2.14] — 2026-07-01

### Changed
-  Redesign documentation layout with interactive badge navigation

## [0.2.13] — 2026-07-01

### Changed
-  Update README version badge and semantic markup

## [0.2.12] — 2026-07-01

### Changed
-  Refine README formatting and visual hierarchy

## [0.2.11] — 2026-07-01

### Changed
-  Expand README with problem statement and solution architecture

## [0.2.10] — 2026-07-01

### Changed
-  Improve responsive design and mobile layout

## [0.2.9] — 2026-07-01

### Changed
-  Enhance footer with animated signature section and avatar

## [0.2.8] — 2026-07-01

### Changed
-  Enhance hero section with animated gradient text and improved visual hierarchy

## [0.2.7] — 2026-07-01

### Changed
-  Migrate core documentation to separate files

## [0.2.6] — 2026-07-01

### Changed
-  Add website link and update author information

## [0.2.5] — 2026-07-01

### Changed
- ci(gitlab): Rename pipeline jobs and restructure tracks

## [0.2.4] — 2026-07-01

### Changed
- ci(gitlab): Remove path-based change filters from pipeline includes

## [0.2.3] — 2026-07-01

### Changed
- ci(gitlab): Optimize pipeline caching and job configuration

## [0.2.2] — 2026-07-01

### Changed
- ci(gitlab): Add AWS deployment pipeline stages

## [0.2.1] — 2026-07-01

### Changed
- ci(website): Add Next.js website deployment pipeline with Helmsman

## [0.2.0] — 2026-07-01

### Added
-  Add landing page with Next.js and interactive components

## [0.1.8] — 2026-06-29

### Changed
- ci(gitlab): Add job interruption and improve dependency caching

## [0.1.7] — 2026-06-29

### Changed
- ci(gitlab): Update default Docker image and add Node.js setup

## [0.1.6] — 2026-06-29

### Changed
- ci(gitlab): Add linux-docker-runner tag to default config

## [0.1.5] — 2026-06-29

### Changed
- ci(gitlab): Remove platform-engineering-dev-runner tag from default config

## [0.1.4] — 2026-06-29

### Changed
- ci(gitlab): Consolidate Node.js version and improve artifact caching

## [0.1.3] — 2026-06-29

### Changed
-  Clean up Kiro internal files and refine gitignore

## [0.1.2] — 2026-06-29

### Changed
- ci(project): Add GitLab CI/CD pipeline, git hooks, and project configuration

## [0.1.1] — 2026-06-29

### Added
- npm publish to GitLab registry
- CI pipeline for build/test/publish
- Auto-version post-commit hook

## [0.1.0] — 2026-06-25

### Added
- Initial release
- MCP gateway with 3 tools (list_servers, call_tool, status)
- Stdio + HTTP/SSE downstream transports
- Connection pool with idle reaper
- OAuth browser flow + token persistence
- Tool schema caching
- Shell env extraction
- Hot-reload registry
- JSONC config support
- Unified CLI (mux-cli) with setup/add/remove/auth/health/list/status/metrics/keywords/update
- Batch auth (--all)
- Usage metrics dashboard with insights
- Auto-generated keywords from tool discovery
- E2E test suite (46 assertions)
