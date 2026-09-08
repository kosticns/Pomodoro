# Pomodoro — code review and upgrade path

Written 3 Sep 2026, immediately after taking the app into custody and shipping
it to `pomodoro.kostic.design`. Findings are from reading the source, running
`tsc`, and driving the live app, not from impressions.

## Status — steps 1, 2, 3, 4 and 7 are DONE (3 Sep 2026)

| # | Item | State |
|---|---|---|
| 1 | Type errors fail the build | **done**, tsc clean |
| 2 | Split the 7,197-line file | **done**, page.tsx is now 858 lines |
| 3 | Context instead of prop drilling | **done**, 51 prop passes removed |
| 4 | Test the aggregation maths | **done**, 26 tests |
| 7 | Strip production console noise | **done**, stripped at build time |
| 5 | PWA / offline service worker | open |
| 6 | Hydration mismatch (React #418) | open, and now the most valuable one |
| 8 | Accessibility | open |
| 9 | Features (sync, history) | open |

**Do item 6 next.** It was cosmetic when written and is now the biggest thing
left: the mismatch makes React discard the server HTML and re-render, so first
paint shows defaults and the app is briefly unresponsive to taps. It is
noticeable on a cold load and it made verification unreliable all afternoon.

The original text of every item is kept below, unedited, for the reasoning.

## What it is

One Next.js 16 page, `app/page.tsx`, **7,197 lines**, holding fourteen
components: five mobile panels (Timer, Tasks, Breaks, Stats, Settings), a
desktop dashboard, two chart components and assorted widgets. State is React
`useState` plus a hand-rolled `useLocalStorage` hook. No server, no database, no
tests.

For a personal focus timer that is a perfectly reasonable place to have started.
It is also the thing that produced today's crash, so it is where the upgrade
path starts.

## What was already fixed today

Seven dangling references, all the same defect: **child components referencing
parent state that was never threaded down as a prop**. Every one built clean and
shipped because v0 set `typescript.ignoreBuildErrors: true`.

| Where | Reference | Effect |
|---|---|---|
| Breaks | `breakComplianceRate` | **Crashed the tab.** The reported bug |
| Timer | `setStats` | Threw when clearing accumulated break time |
| Settings | `setProjects`, `setTasks`, `setStats` | Restoring a backup threw |
| Tasks | `setSelectedProjectId` | "Add task" from a project card threw |
| Breaks | `PomodoroSettings` type | Build-time only |

`tsc` now reports zero undefined identifiers. Fourteen type errors remain, all
strictness rather than crashes.

---

## The upgrade path, in the order I would do it

### 1. Turn the safety net back on. Half a day.

`next.config.mjs` still carries this, from v0:

```js
typescript: { ignoreBuildErrors: true }
```

**This is the single highest-value change in the list**, because it is the
reason a crash reached production rather than being caught at build time. Today
proved the cost: one reported crash turned out to be one of seven.

The remaining fourteen errors have to be cleared before it can be flipped on.
None are hard. Four are implicit `any` parameters, six are setter signatures
that do not accept updater functions, three are the `"To Do"` issue below, one
is a `theme-provider` overload.

Pair it with `next lint` in the same pass. `eslint` is in `package.json` and has
apparently never been run.

### 2. Decide what happened to "To Do". An hour, once you decide.

`TaskStatus` is `"In Progress" | "Done"`. There is a **one-time migration**
converting old `"To Do"` tasks to `"In Progress"`, so retiring it was
deliberate. But the Daily Review still has a **"To Do" button** that writes the
retired status straight back onto a task, and three styling branches still try
to colour it.

The result is not a crash. A task set that way renders with no status colour
until the next reload migrates it away. It is a settled decision contradicted by
live UI, so it needs your call rather than mine: **remove the button, or bring
`"To Do"` back as a real status.**

### 3. Split the file. Two days, and do it before anything else new.

7,197 lines in one module is the constraint behind everything below it. It is
why the prop-threading bugs were invisible, and it makes every future change
slower than it should be.

A conservative split, no behaviour change:

```
app/page.tsx              # PomodoroApp shell + routing only, ~300 lines
components/timer/         # MobileTimerComponent, MobileTaskSelector
components/tasks/         # MobileTasksManager
components/breaks/        # MobileBreaksPanel
components/stats/         # MobileStatsDashboard, charts
components/settings/      # MobileSettingsPanel
components/desktop/       # DesktopDashboard, WorkdayTimelineSlider
lib/storage.ts            # useLocalStorage, migrations
lib/stats.ts              # the aggregation maths, currently inline
types.ts                  # Task, Project, DailyStat, Settings, TaskStatus
```

Do this **before** adding features, not after. Every week you wait makes it a
bigger job.

### 4. Stop the prop drilling that caused the bug. One day, right after the split.

Threading `stats`/`setStats`/`projects`/`setProjects`/`tasks`/`setTasks` through
every panel is what produced five of today's seven bugs. Two options:

- **React Context** for the app state. Zero dependencies, fits the size.
- **Zustand**, if you want persistence middleware to replace the hand-rolled
  `useLocalStorage` at the same time.

I would take Context. The app is not big enough to justify a state library once
the file is split.

### 5. Test the maths. One day.

There are no tests. The parts worth covering are not the UI, they are the
aggregations: `breakComplianceRate`, `wellbeingScore`, `expectedBreaksForPomodoros`,
`pomodorosWithoutBreak`, and the stats migration. These are pure functions once
extracted in step 3, so Vitest covers them cheaply.

The value is not correctness for its own sake. It is that today's crash lived in
exactly this code and nothing would have caught it.

### 6. Make it a real PWA. Half a day.

`app/manifest.ts` exists and the icons now resolve, so it installs. But there is
**no service worker**, so it does not work offline. For a timer you open on a
phone and leave running, offline is most of the point.

`@serwist/next` is the current answer for Next 16. Cache the shell, and the app
keeps working with no network.

### 7. Clean up production output. An hour.

**31 `console.*` calls** ship to production. Two of them fire on an interval:

```
Starting workday timer interval
Workday timer state: {isWorkdayActive: true, ...}
```

Those log roughly every two seconds, forever, on your users' machines and
yours. Strip them or put them behind a debug flag.

### 8. Fix the hydration warning. Half a day.

React error #418 fires on load: a hydration mismatch. The cause is **53
`new Date()` / `Date.now()` calls in render paths**, so the server-rendered HTML
and the first client render disagree about the time.

The fix is to render time-dependent output only after mount, or to make the
initial paint time-independent. Harmless today, but hydration mismatches cause
strange, hard-to-reproduce bugs later.

### 9. Accessibility. One day.

Against your usual AA+ bar this is currently short:

- **6 `aria-label`s across 7,197 lines**, and 6 icon-only buttons, so some
  controls are unlabelled for a screen reader
- Only 3 `role=` attributes; the bottom tab bar is `div`s rather than a
  `tablist`
- Colour is doing real work. Task status is signalled by a coloured dot plus a
  badge, and the neon-on-black palette needs a contrast pass. Lime on near-black
  is likely fine, the muted greys likely are not
- No visible focus styling worth the name, so keyboard use is rough

### 10. Then, and only then, features.

Once the above is done the obvious ones are cross-device sync (this is
`localStorage` only, so your phone and laptop know nothing about each other),
and the Stats tab growing real history rather than 7/30-day rollups. Both are
much easier after steps 3 and 4.

---

## Two things deliberately not in the list

**Dependency pruning.** `package.json` carries 50 shadcn/ui components and the
app imports 9. Also `recharts`, `chart.js` AND `react-chartjs-2` for charts that
are hand-drawn SVG. It looks wasteful and mostly is not: unused modules are
tree-shaken and the whole JS bundle is **912 KB** across all chunks. Worth a
tidy when you touch `package.json`, not worth a dedicated pass.

**Rewriting the timer logic.** It works, it survives reload via `timerState` in
`localStorage`, and it correctly reconstructs elapsed time from a start
timestamp rather than counting ticks. That is the right design and I would leave
it alone.

## Found while deploying: chunk 404s during a deploy

Observed live on 3 Sep. A browser that loads the page while Cloudflare is still
propagating a new deployment can request a JS chunk that its edge has not got
yet, and Pages answers with the HTML 404 fallback:

```
Refused to execute script ... MIME type ('text/html') is not executable
ChunkLoadError: Failed to load chunk /_next/static/chunks/<hash>.js
```

**It self-resolves on reload and it is not a code defect.** Verified after the
fact: the chunk exists, every chunk the live HTML references returns 200, and
repeated fetches are consistently `200 application/javascript`. It is inherent
to deploying content-hashed chunks under anyone who has the app open.

Worth knowing rather than fixing, for a single-user app. If it ever becomes
annoying, the standard mitigation is a global handler that reloads once on
`ChunkLoadError`. Do not chase it as a bug in the app.

## If you only do one thing

Step 1. Turn `ignoreBuildErrors` off. Everything else on this list is
improvement; that one is the difference between finding the next bug at build
time and finding it the way you found this one, by opening a tab.
