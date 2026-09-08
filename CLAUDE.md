# CLAUDE.md — Pomodoro

Public repository. Read `README.md` first.

## Conventions

- Package manager is pnpm (`pnpm-lock.yaml`). Do not switch it.
- Logic that can be tested lives in `lib/` as pure functions with Vitest tests next to them. Keep React, storage and the clock out of `lib/`.
- The app is a static export (`output: "export"` in `next.config.mjs`). Anything that needs a server does not belong here.
- Dates that decide behaviour (is this workday today?) are passed in from event handlers, never read during render. `lib/workday.ts` explains why.
- Run `pnpm test` and `pnpm typecheck` before committing. Commit after a feature works and before risky changes. No force-pushes.

## Publishing

`./publish.sh` builds, deploys to Cloudflare Pages and verifies the live page against the build. It needs `CLOUDFLARE_API_TOKEN` in the environment. Never commit tokens or `.env*` files; `.gitignore` already covers them.

## GitHub

```text
GitHub context: Private (personal account)
Repository: kosticns/Pomodoro, visibility PUBLIC since 2026-09-08
```

Branch `main` is the app. Pull before starting work.
