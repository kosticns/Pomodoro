# Ideas

## Done 10 Sep 2026

- **The morning now ends with a decision.** `DayPlanWizard` runs straight after
  the start-of-day prompt: it walks every unfinished task into Today, Later,
  Done or Skip, then asks which of the Today tasks to start. That task becomes
  the active task, so the Timer is already pointed at it.

  This **replaced** the Tasks tab's Daily Review rather than sitting beside it.
  The old flow set each task's status one at a time and then stopped, so you
  finished it no better off: the active task was still whatever it was
  yesterday. Its "Daily" button is now "Plan day" and opens the same wizard,
  so triage behaves identically whichever way you reach it.

  One thing worth knowing if you extend it: the queue is snapshotted when the
  wizard opens. Deriving it live from `tasks` looks cleaner and is a bug,
  because triaging a task to Done removes it from an unfinished-tasks filter
  and the list shrinks under the index. The old review worked around exactly
  that by not advancing the index after Done.

- **The current time is gone from the UI**, on your call. The workday card still
  shows when the day started, which is a fact about the day rather than a clock.

## Done 9 Sep 2026

- **Start-of-day prompt.** The backup modal was attached to pressing play; it is
  now once per day from a set hour (default 8). Not a scheduled 08:00 fire,
  because the app is usually closed then; it prompts on first sight of a new day
  past the hour.

- **Item 1, the posture reminder now notifies.** Testing caught that marking a
  stretch "notified" before sending lost the reminder whenever permission was
  not yet granted.
- **Item 5, the hydration mismatch is fixed at the cause.** The app renders
  client-side only. Correction to my own diagnosis: the primary cause was
  useLocalStorage reading during the initial render, not the Date.now() calls
  REVIEW.md blamed.
- **Item 2 is cancelled**, not deferred. Mickey decided estimated pomodoros are
  not needed at all, so the field and every use of it were removed rather than
  left dormant.
- Accessibility and copy pass alongside: tab bar semantics, 44pt switch target,
  Reduce Motion, slider accent and name, all-caps removed app-wide.

Still open: **item 3** (Vitals trend, worth waiting a week for data),
**item 4** (the two product decisions, yours), **item 6** (offline service
worker), **item 7** (sync, still recommended against).


Written 9 Sep 2026, after the Vitals work. Grounded in what the code actually
does, not a feature wishlist. Each entry says what it unlocks and what it costs.

Companion documents: [REVIEW.md](REVIEW.md) for the code review and engineering
backlog, [REVIEW-UX.md](REVIEW-UX.md) for the interface findings.

---

## 1. The posture reminder never notifies. DONE 9 Sep 2026.

**The gap, verified:** notifications fire when a focus session ends
(`app/page.tsx:445-458`) and when the workday completes
(`hooks/use-workday-timer.ts:198`). The posture reminder fires **nothing**. It
is a visual card on the Timer screen only.

So with the cadence now at 90 minutes, the feature asks you to remember to look
at the app every 90 minutes in order to be reminded. That inverts the point.

**Fixed.** The decision is `shouldRemindPosture` in `lib/posture.ts`, one
reminder per stretch keyed on `lastPostureChange`. Testing caught that marking
the stretch notified BEFORE sending lost the reminder whenever permission was
not yet granted, so `showNotification` now reports whether it fired.

**Honest constraint worth knowing before you ask for more than that.** This
works while the app is open, including backgrounded. It will NOT fire with the
app closed, because that needs either the Notification Triggers API
(Chrome-only, experimental) or Web Push with a server, and this app is a static
export with no backend. Reliable closed-app reminders would mean giving up the
"nothing to keep alive" property that makes this app cheap to own. My
recommendation is to take the in-app version and stop there.

## 2. Estimate accuracy. CANCELLED 9 Sep 2026.

Proposed as the strongest idea here: tasks stored `estimatedPomodoros` and
`completedPomodoros` and nothing aggregated them, so the app could have told
you how far off your estimates ran.

**Mickey's call: the app does not need estimated pomodoros at all.** The field
and all 13 of its uses were removed rather than left dormant, so there is no
half-feature collecting data nothing reads. Kept here as a record of the
decision, not as a backlog item.

## 3. Give Vitals a trend. One day.

Vitals currently answers "what did today look like" and "what did the last 7 or
30 days total". It cannot answer **"am I getting better"**, which is the
question it implicitly raises.

A per-day standing-share bar over 30 days would answer it. The chart components
already exist (`components/charts/`), and `vitalsForDay` already computes the
number per day.

Worth waiting a week or two before building, so there is something to plot.

## 4. Two decisions that are yours, not mine

Both surfaced in `REVIEW-UX.md` and both still open. Neither is an engineering
problem, and no interface change resolves them.

**Two unrelated daily goals.** The Timer shows a workday "Daily Goal 8h 00m"
while Settings has a "Daily Pomodoro Goal 10". Nothing on screen relates them,
and the app has no opinion about which one means you had a good day. Pick the
primary one.

**Breaks is a report with a control's name.** The tab promises a way to take or
manage a break and delivers analytics that overlap Stats heavily. There is
already a real action stranded on the Timer screen: the "5m of break time
saved" affordance. Moving that into Breaks would make the name honest and give
the tab a job Stats cannot do.

## 5. The hydration mismatch. DONE 9 Sep 2026.

React error #418 on every load, showing defaults and ignoring taps briefly on a
cold start.

**My original diagnosis here was wrong.** This entry, and REVIEW.md item 6,
blamed 53 `Date.now()` calls in render paths. Those contribute, but the primary
cause was `useLocalStorage`: its lazy initialiser returned `initialValue` with
no window and the STORED value on the client's first render, so hydration
mismatched on any device with data.

Fixed at the cause. The app renders client-side only, since server rendering
buys nothing when the server cannot see the localStorage that decides what to
draw. Zero console errors now, and correct values on first paint.

## 6. Make it work offline. Half a day.

`app/manifest.ts` exists and the icons resolve, so it installs. There is **no
service worker**, so it does not work offline. For a timer you open on a phone
and leave running, offline is most of the point. `@serwist/next` is the current
answer for Next 16; cache the shell and it keeps working with no network.

## 7. Cross-device sync. Weeks, and it changes what this app is.

Storage is `localStorage` only, so your phone and your laptop know nothing about
each other. This is the biggest functional limitation in the app.

It is also the most expensive thing on this list, and it would end the property
that makes the app nearly free to own: a static export with no server, no
database and no auth. Sync means a backend, a schema, conflict resolution and
credentials.

**Listed for completeness, recommended against** unless you actually start
using the app on two devices and feel the pain. The backup export already
covers the "do not lose my data" case, which is the part that usually matters.

## Deliberately not on this list

- **Streaks, badges, gamification.** The app already reports honestly. Adding
  streak pressure to a tool about not overworking would work against it.
- **A strain score for Vitals.** Decided against on 8 Sep: a score implies a
  clinical measurement this app cannot make. See `lib/vitals.ts`.
- **AI anything.** Nothing here needs a model. The estimate work in item 2 is
  arithmetic, and arithmetic you can check beats a suggestion you cannot.

## What I would do next

**Item 6, offline.** It is half a day and it is the difference between a site
and an app on your phone.

Then **item 3**, the Vitals trend, once there is a week or two of posture data
worth plotting.

**Item 4 needs you, not me.** The two daily goals and the identity of the
Breaks tab are product calls that no interface change resolves.
