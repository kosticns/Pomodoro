# Ideas

## Done 9 Sep 2026

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

## 1. The posture reminder never notifies. Half a day.

**The gap, verified:** notifications fire when a focus session ends
(`app/page.tsx:445-458`) and when the workday completes
(`hooks/use-workday-timer.ts:198`). The posture reminder fires **nothing**. It
is a visual card on the Timer screen only.

So with the cadence now at 90 minutes, the feature asks you to remember to look
at the app every 90 minutes in order to be reminded. That inverts the point.

**Fix:** one `showNotification` when `timeSincePostureChange` crosses the
cadence, fired once per stretch rather than every tick.

**Honest constraint worth knowing before you ask for more than that.** This
works while the app is open, including backgrounded. It will NOT fire with the
app closed, because that needs either the Notification Triggers API
(Chrome-only, experimental) or Web Push with a server, and this app is a static
export with no backend. Reliable closed-app reminders would mean giving up the
"nothing to keep alive" property that makes this app cheap to own. My
recommendation is to take the in-app version and stop there.

## 2. Tell me how wrong my estimates are. One to two days.

**The best new idea here, because the data already exists and nothing uses it.**
Every task carries `estimatedPomodoros` and `completedPomodoros`. They are
rendered as a bare ratio next to the task ("3/5") in four places and aggregated
nowhere. There is no signal anywhere about estimation accuracy.

What it could say, from data already stored:

- "You typically finish in 1.6x your estimate."
- "Estimates on Neusatz Archive run 2.1x; on Client work, 1.1x."
- "Tasks you estimate at 1 pomodoro are your least accurate."

**Why this one and not something flashier:** it answers a question a planner
actually asks, it needs no new capture, no new permissions and no backend, and
it gets better the longer the app is used. It is also the only idea here that
makes the app tell you something you did not already know.

Lives naturally as `lib/estimates.ts` with tests, surfaced on Stats.

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

## 5. Fix the hydration mismatch before adding UI. Half a day.

React error #418, item 6 in `REVIEW.md`. Caused by 53 `Date.now()` /
`new Date()` calls in render paths, so the server HTML and first client render
disagree.

It is the thing most likely to make the app feel cheap: a cold load briefly
shows defaults and does not respond to taps. It also made every verification
this week unreliable, which is a cost you pay on all future work until it is
fixed. **This is the one I would do first if you care how the app feels rather
than what it does.**

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

## If you only do two

Item 5, then item 1. The first makes everything already built feel solid; the
second makes a feature you just configured actually function. Item 2 is the one
to build when you want the app to be more interesting rather than more correct.
