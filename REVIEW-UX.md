# Pomodoro: Experience and Interface Review

3 September 2026. Reviewed live at `pomodoro.kostic.design` on a 375x812
viewport, the size this app is designed for, in both empty and populated
states.

Every claim below was measured in the running app. Nothing is inferred from
reading the source, and nothing is speculative. Where a reading turned out to
be a measurement artifact it was dropped rather than reported.

## Methodology

Reviewed against a fixed standards set:

1. **Apple AA+ Accessibility Standard v4.1.2**, contrast 4.5:1 for body text,
   44pt minimum targets, visible focus, status not conveyed by colour alone.
2. **Apple Human Interface Guidelines**, control placement, safe areas, tab
   bar conventions, verb-based actions. Applies because this is an installable
   iPhone web app.
3. **Apple Style Guide**, capitalization, terminology, number and duration
   formats.
4. **shadcn/ui**, the component library the app is already built on, as the
   design-system benchmark.
5. **Established usability heuristics**, system status, consistency, error
   prevention, recognition over recall.

Severity: **High** blocks or misleads a user in normal use · **Medium-High**
frequently degrades the experience · **Medium** noticeable friction ·
**Low-Medium** polish · **Low** cosmetic.

---

## Executive summary

The app is genuinely good. The timer engine is well designed, it survives
reload correctly, and the cyberpunk treatment is committed and coherent as an
aesthetic. The problems are not taste, they are **system** problems: the app
was assembled screen by screen without a shared contract for colour, layout and
status, so each screen invented its own.

Five foundational moves fix most of the register:

- **F1. One layout contract.** The primary action currently sits underneath the
  navigation bar. This is the single highest-value fix in this document.
- **F2. One colour system.** Ten distinct text colours across five screens,
  used decoratively rather than semantically.
- **F3. One page header.** Four screens, four different heading treatments, one
  of them missing entirely.
- **F4. One status system.** A task can carry five competing chips.
- **F5. An accessibility baseline pass.** Tab bar semantics, touch targets
  and Reduce Motion. (The contrast claim originally here was retracted; see
  AX-1.)

### Product-level observation, ahead of the interface

**Three timing systems share the Timer screen**: the pomodoro countdown, an
8-hour workday timer, and a sit/stand posture reminder. Each is reasonable
alone. Together they compete for the same glance, and the pomodoro, which is
the app's name and purpose, is not clearly the primary one.

This surfaces concretely in two places. There are **two different daily
goals**, a workday "Daily Goal 8h 00m" on the Timer and a "Daily Pomodoro Goal
10" in Settings, and nothing on screen relates them. And the **Breaks tab is a
report, not a control**: its name promises a way to take or manage a break, but
it delivers analytics that substantially overlap the Stats tab. Both show break
counts, break minutes and daily totals.

Worth deciding before any visual work: is this a pomodoro timer that happens to
track a workday, or a workday tracker built around pomodoros? The interface
cannot resolve that ambiguity on its own.

---

## Priority 1: Interaction and layout

### IN-1: The Start button sits underneath the navigation bar · **High** · FIXED 3 Sep 2026

> **Fixed and live.** Verified by hit-testing on four device sizes. On 375x812
> the Start button now sits 661-741 against a nav at 747, and every tap point
> including 2px from its bottom edge lands on Start. The ring came out at 260px,
> larger than the 240px it replaced.
>
> The cause was not the padding, which already existed. `<main>` is a flex item
> with the default `min-height: auto`, so it refused to shrink below its
> content, `overflow-y-auto` never engaged, and the column grew past the
> viewport with the fixed nav covering the last 65px. Separately the timer
> column was pinned at `h-full` while its children overflowed it visibly,
> spilling through the padding meant to reserve space for the nav.
>
> On a 667pt screen the content genuinely cannot fit, so it scrolls and the
> button is fully clear at the bottom. Clearance on 812 is 6px, which is
> positive but tight; anything added to that screen will need re-checking.
>
> The original finding is kept below because the measurement is the evidence.



On a 375x812 viewport the three timer controls span y 700-780. The tab bar
begins at y 747. Hit-testing the Start button confirms what that implies:

| Tap point | What actually receives it |
|---|---|
| y 710 | Start timer |
| y 740 | Start timer |
| y 750 | **Breaks tab** |
| y 765 | **Breaks tab** |
| y 775 | **Breaks tab** |

**The bottom 41% of the primary action navigates away instead of starting the
timer.** Reset and Skip are clipped by 21px each. A user who taps low, which is
the natural thumb position for a control near the bottom of a phone, silently
lands on a different screen.

**Recommendation:** give the scrolling content a bottom inset equal to the tab
bar height plus the safe-area inset, so no content can render beneath it. This
is one padding rule applied at the layout level, not per screen.

### IN-2: Controls render outside the viewport on the Tasks screen · **High**

At 375px wide, the Tasks header row measures 528px. Two controls sit outside
the viewport:

- the sort control ("Recent Activity") overflows the right edge by 91px
- a further button sits **entirely off-screen**, starting at x 474

There is no scroll affordance indicating anything is there. On a phone these
controls are effectively unreachable.

**Recommendation:** the filter, sort and view controls need a mobile layout, not
a scaled-down desktop row. Move sort into a bottom sheet triggered by a single
icon button, or wrap to a second line.

### IN-3: The active task name is duplicated, and the first copy is clipped · **Medium**

The Timer shows the task name twice: once under "Current Task", once inside the
ring. The upper instance overflows the viewport and is cut by the screen edge
with no ellipsis. The instance inside the ring truncates correctly.

**Recommendation:** keep one. The in-ring placement is the better of the two,
since it sits with the countdown the user is already looking at.

### IN-4: Settings changes are silent · **Medium**

Editing a duration applies immediately with no confirmation that anything was
saved, and no visible relationship to the running timer.

**Recommendation:** a brief inline confirmation on the changed field. Where a
change cannot apply to the session in progress, say so at the point of change.

---

## Priority 2: Design system

### DS-1: Ten distinct text colours, used decoratively · **High**

Measured across the five screens at 14px and above. The Breaks screen alone
uses six. Two visually distinct reds appear, so **red is not reserved for
destructive actions**, which removes the strongest signal the interface has.

Colour is currently expressive rather than semantic: a value is cyan because it
looked good next to a green ring, not because cyan means anything.

**Recommendation:** define one accent (the existing lime is the strongest
candidate, it appears on all five screens), one semantic set for
positive/warning/negative, and reserve one red for destructive only. Everything
else becomes foreground, muted foreground, and border.

### DS-2: Four screens, four different page headings · **High**

| Screen | Heading | Colour |
|---|---|---|
| Tasks | **none** | n/a |
| Breaks | "Breaks" | yellow |
| Settings | "Settings" | lime |
| Stats | "Statistics" | cyan |

Same 20px size, three different colours, and one screen with no page heading at
all.

**Recommendation:** one `PageHeader` component: title, optional view switcher,
one colour. Give Tasks a real heading.

### DS-3: A task carries up to five competing chips · **Medium**

The active task renders "ACTIVE", the project name, "In Progress", a pomodoro
count and a note count, in three casing styles and four colours. State is
readable only by decoding the whole cluster.

**Recommendation:** one status pill using the three real states, project as
secondary metadata rather than a peer chip, and counts as plain metadata with
icons. "ACTIVE" duplicates what the Timer already shows.

### DS-4: Two controls sit outside the palette entirely · **Medium**

The weekly chart renders in a green that appears nowhere else in the interface,
and the volume slider renders in browser-default blue because it was never
styled (see AX-5). The settings toggle immediately above it is the app's
yellow, so two adjacent controls in the same card belong to different systems.

---

## Priority 3: Accessibility

Against AA+ v4.1.2.

### AX-1: Status badges fail contrast by roughly three times · **RETRACTED**

> **This finding was wrong, and the numbers below were a measurement bug.**
> Retracted 9 Sep 2026.
>
> The original ratios (1.51:1 to 2.11:1) came from my own contrast script, which
> had two defects. It parsed colours with a `[\d.]+` regex, so Tailwind 4's
> `lab(67.805 -35.3952 -30.2018)` lost its minus signs and resolved to a dark
> brown. And its "is this transparent" check was `/, ?0\)$/`, which matches
> `rgb(255, 255, 0)`, so pure yellow backgrounds were discarded as transparent.
>
> Re-measured by painting each colour into a canvas and letting the browser
> resolve it, compositing every ancestor background in order. Across all five
> screens there was exactly **one** genuine failure: "Disabled" on Settings at
> 3.93:1 against a 4.5:1 minimum, now fixed by moving red-600 to red-400.
>
> The badges pass. The chip text was still lifted from 10px to 12px, which was
> a legitimate separate point about small text.
>
> **Method note for next time:** never parse a CSS colour with a regex. Paint it
> and read the pixel. Three successive measurements in this area were wrong
> before the canvas method gave a stable answer.

### AX-2: The tab bar has no semantics · **High**

The five tabs are plain buttons inside a `nav`. There is **no `role`, no
`aria-current`, no `aria-selected`** on any of them. The active tab is
communicated entirely by colour and a 10% background tint.

A screen reader user cannot tell which tab is selected. A user who cannot
distinguish the lime from the yellow cannot either.

**Recommendation:** `role="tablist"` with `aria-selected`, or `aria-current="page"`.
Add a non-colour indicator such as a top rule on the active tab.

### AX-3: 24 controls below the 44pt minimum · **Medium-High**

On the Settings screen alone. The toggles measure **32x18pt**, roughly a
seventh of the required area. Text inputs and select controls are 36pt tall.

**Recommendation:** the toggle needs a larger hit area than its visual size.
Keep the switch drawing at 32x18 and pad the pressable region to 44pt.

### AX-4: No Reduce Motion support · **Medium**

The stylesheet contains **8 rules using animation or transition and zero
`prefers-reduced-motion` rules**. The timer ring glow, progress fills and tab
transitions all animate regardless of the system setting.

**Recommendation:** one media query that reduces transition and animation
duration to near zero. It is a few lines and covers everything at once.

### AX-5: The volume slider is an unstyled native control · **Medium**

It is a bare `<input type="range">` with `accent-color: auto`, so it renders in
the **browser default blue**, a colour that appears nowhere else in the app. It
also carries **no `aria-label`**, so it is announced only as a slider with no
name.

This is the clearest single example of DS-1: one unstyled control is enough to
break the impression that the interface is one system.

### AX-6: Task state is conveyed by colour alone · **Medium**

Blue, yellow and grey chips distinguish Active, In Progress and To Do with no
shape, icon or text-weight difference.

### AX-7: First paint shows values that are not yours · **Medium**

A hydration mismatch means a cold load briefly renders defaults, 25:00 and "No
task selected", before switching to real state. During that window taps do not
register. This is item 6 in `REVIEW.md` and is the most valuable open
engineering item.

---

## Priority 4: Copy

### CP-1: All caps throughout · **Medium**

"WORKDAY TIMER", "DAILY GOAL", "FOCUS TIME", "WELL-BEING SCORE", "ACTIVE", and
the project name inside the timer ring. All caps reduces legibility at small
sizes and is against the style baseline.

**Recommendation:** sentence case, with hierarchy carried by weight and size.
The type already has the range for it.

### CP-2: Durations shown as raw minutes · **Medium**

"Workday Active 0 / 435 min" and "Work Time 175 / 435 min". 435 minutes is 7
hours 15 minutes. The app already formats durations as "8h 00m" elsewhere.

**Recommendation:** use the existing formatter everywhere.

### CP-3: Only one field is explained, and it is the obvious one · **Medium**

"Daily Pomodoro Goal" carries helper text ("8-10 = good day, 12-14 = very
productive"). "Cycles before long break", which genuinely needs explaining,
has none. The helper text also sits below the input rather than between label
and input.

### CP-4: Inconsistent capitalization and terminology · **Low-Medium**

"Focus Duration (minutes)" and "Daily Pomodoro Goal" are title case while
"Cycles before long break" is sentence case. The tab reads "Stats" while its
page reads "Statistics".

---

## What is already right

Worth keeping, and worth not regressing:

- **There is a visible keyboard focus indicator.** Tabbing to a control draws a
  clear ring around it. Worth stating because it is the AA+ requirement most
  often missing, and because the computed styles suggest otherwise; it only
  showed up under real keyboard focus. Do not let a refactor remove it.
- The timer buttons carry proper `aria-label`s ("Start timer", "Reset timer",
  "Skip to Short Break"). Icon-only controls are labelled.
- The settings toggles use `role="switch"` with correct `data-state`, so they
  announce properly. The problem with them is size, not semantics.
- The empty state on Tasks is done properly: icon, plain explanation, and the
  action right there.
- The timer reconstructs elapsed time from a start timestamp rather than
  counting ticks, so it survives backgrounding and reload.
- The aesthetic is committed. The corner brackets, the ring glow and the
  monospaced numerals form a real point of view, which is rarer than polish.

---

## Suggested order

**First, and on its own:** IN-1. The primary action of a timer app should not
navigate elsewhere. One layout rule.

**Then the system work**, which is cheap once decided and makes everything
after it faster: F2 colour tokens (DS-1, DS-4), F3 page header (DS-2), F4
status system (DS-3, AX-6).

**Then accessibility**: AX-1 and AX-2 are small, concrete edits once the tokens
exist. AX-3 is a component-level change to the toggle and input sizes.

**Then copy**: CP-1 through CP-4 are a single pass, and CP-1 alone changes how
finished the app looks.

**Separately, and needing your decision rather than my recommendation:** the
product question at the top. Whether Breaks stays a report or becomes a
control, and which of the two daily goals is the real one, are calls about what
the app is for.

---

Related: [REVIEW.md](REVIEW.md) for the code review and engineering upgrade
path, including the hydration item behind AX-7.
