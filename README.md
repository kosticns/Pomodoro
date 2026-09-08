# Pomodoro

A Pomodoro and workday timer with a cyberpunk look. Runs entirely in the browser, keeps its state in `localStorage`, and installs as a home-screen app on a phone.

Live: https://pomodoro.kostic.design

## What it does

- **Timer**: classic Pomodoro cycles with configurable work, short-break and long-break lengths.
- **Workday**: a separate day-long timer with pause and posture tracking (sitting or standing), so the app knows when a new day has started and does not carry yesterday's session over midnight.
- **Tasks**: a simple task list to attach focus sessions to.
- **Breaks**: suggested break activities across mind, body and social categories, plus break compliance statistics.
- **Stats**: sessions, break totals and time on task.
- **Settings**: durations, notifications, theme.
- Browser notifications when a session or break ends, if you allow them.

No accounts, no server, no analytics. Everything stays on your device.

## Run it

Requires Node 20 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

```bash
pnpm test         # unit tests (Vitest) for the timer and break maths
pnpm typecheck
pnpm build        # static export to out/
```

## How it is built

- Next.js 16 with `output: "export"`, so the result is plain static files.
- React, Tailwind CSS, and shadcn/ui components on Radix primitives.
- Pure, tested logic in `lib/` (`workday.ts`, `break-stats.ts`); React hooks in `hooks/`; UI in `components/` and `app/`.

The first version was generated with v0 and then taken to production by hand. `docs/REVIEW.md` and `docs/REVIEW-UX.md` record the code and interface review that guided that work.

## Deploying

The site is a static export, so any static host works. `publish.sh` is the maintainer's Cloudflare Pages routine: it builds, deploys, then fetches the live page and compares it byte for byte with the build before calling the deploy done. It reads `CLOUDFLARE_API_TOKEN` from the environment.

## License

MIT. See `LICENSE`.
