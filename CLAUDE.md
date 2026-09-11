# CLAUDE.md: Pomodoro

Public repository. Read `README.md` first.

## Conventions

- Package manager is pnpm (`pnpm-lock.yaml`). Do not switch it.
- Logic that can be tested lives in `lib/` as pure functions with Vitest tests next to them. Keep React, storage and the clock out of `lib/`.
- The app is a static export (`output: "export"` in `next.config.mjs`). Anything that needs a server does not belong here.
- Dates that decide behaviour (is this workday today?) are passed in from event handlers, never read during render. `lib/workday.ts` explains why.
- Run `pnpm test` and `pnpm typecheck` before committing. Commit after a feature works and before risky changes. No force-pushes.
- `pnpm lint` is declared in `package.json` but ESLint is not installed, so it has never run. Do not treat it as a gate.
- `Card` supplies the vertical padding, `CardContent` the horizontal. Give CardContent `px-*`, never `p-*`, or it doubles the card's own padding.
- A wizard that walks a list snapshots that list when it opens. `DayPlanWizard` explains why: triaging a task can remove it from the very filter the queue came from, so a live-derived queue shrinks under the index and silently skips entries.

## The morning flow

Three steps run back to back, all from `components/pomodoro-app.tsx`:

1. **Start-of-day prompt** (`lib/day-start.ts`) offers a backup once per day from `dayStartHour`, default 8. It polls rather than scheduling a fire, because the app is usually closed at 08:00.
2. **`DayPlanWizard`** (`lib/day-plan.ts`) triages every unfinished task into Today / Later / Done / Skip.
3. The task picked at the end becomes `activeTask`, so the Timer is already pointed at it.

The Tasks tab's "Plan day" button opens the same wizard, so there is one triage flow rather than two. It replaced a Daily Review that set statuses and then ended without choosing anything.

The current time is deliberately not displayed anywhere in the UI (Mickey, 10 Sep 2026). `formatClock` is still used for the workday start time, which is a fact about the day rather than a clock.

## Publishing

`./publish.sh` builds, deploys to Cloudflare Pages and verifies the live page against the build. It needs `CLOUDFLARE_API_TOKEN` in the environment. Never commit tokens or `.env*` files; `.gitignore` already covers them.

## GitHub

```text
GitHub context: Private (personal account)
Repository: kosticns/Pomodoro, visibility PUBLIC since 2026-09-08
```

Branch `main` is the app. Pull before starting work.
