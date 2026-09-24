# Contributing to Mux

Thanks for your interest in improving Mux. This document covers local setup, the
verification path, and the conventions the project follows.

## Prerequisites

- Node.js `>= 20` (CI runs 20 and 22; the published build targets 20).
- npm (the repo ships a `package-lock.json`; use `npm ci` for reproducible installs).

## Setup

```bash
git clone https://github.com/BhavanPatel/mux-mcp-gateway.git
cd mux-mcp-gateway
npm ci
npm run build
```

`npm ci` runs the `prepare` script, which points git at the repo's hooks:

```
git config core.hooksPath .hooks
```

- **pre-commit** — formats and lints staged changes.
- **pre-push** — build, lint, format check, and the full test suite must pass.
- **post-commit** — intentionally a no-op. Versioning is manual (see Releases).

## Verifying your change

There is **one** verification path, used identically by the hooks, CI, and
publish:

```bash
npm run test:ci      # unit + e2e
```

Other useful targets:

```bash
npm run build         # tsup bundle to dist/
npm run typecheck     # tsc --noEmit (tsup does NOT typecheck)
npm run lint          # eslint (src + test)
npm run format:check  # prettier verification
npm run test:coverage # test:ci under c8 (report-only; see .c8rc.json)
```

Run `npm run typecheck` before pushing — `tsup` transpiles with esbuild and does
not report type errors, so a green build does not mean the types are sound.

## Coding conventions

- TypeScript, ES modules, `strict` mode. No new `any` without justification.
- Errors thrown on internal failure paths should be `MuxError` (`src/errors.ts`)
  with a `MUX_E_*` code, not bare `new Error(string)`.
- Never log secrets. Anything that could carry a token/credential must go
  through the redaction helpers in `src/redact.ts`. This is enforced by tests.
- Match the existing style; `prettier` and `eslint` are the source of truth.

## Commit and PR conventions

- Conventional-commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`). Use `BREAKING` in the body for breaking changes.
- Keep PRs focused. Include what changed, why, and how you tested it.
- New e2e test files must be added to the `test:e2e` script to actually run.
- New unit-tested pure modules must be a `tsup` entry so tests can import the
  real `dist/*.js`.

## Releases (maintainers)

Versioning is deliberate, not automatic:

1. Bump `version` in `package.json` (the single source of truth; `src/version.ts`
   reads it).
2. Hand-write the `CHANGELOG.md` entry, including a migration section for
   breaking changes.
3. Commit, then tag `vX.Y.Z`. Pushing the tag triggers the publish workflow,
   which re-runs `npm run test:ci` before `npm publish`.

## Reporting security issues

Do not file public issues for vulnerabilities — see [SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the MIT
License (see [LICENSE](./LICENSE)).
