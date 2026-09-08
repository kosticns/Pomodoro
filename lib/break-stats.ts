import type { DailyStat } from "./types"

/**
 * The break and well-being maths behind the Breaks panel.
 *
 * Extracted from the component so it can be tested. This is the code that
 * produced the crash on 3 Sep 2026: `breakComplianceRate` was referenced twice
 * and defined nowhere, and because it was buried in 300 lines of JSX inside a
 * 7,000-line file, nothing could check it.
 *
 * Every function here is pure. No React, no storage, no clock.
 */

export interface BreakTotals {
  shortBreaks: number
  longBreaks: number
  shortBreakTime: number
  longBreakTime: number
  accumulatedBreakTime: number
  shortBreaksSkipped: number
  longBreaksSkipped: number
  pomodoros: number
  breaksTaken: number
  breaksSkipped: number
  breakTime: number
}

/** Sums a period's daily stats. Missing fields count as zero. */
export function aggregateBreaks(periodStats: DailyStat[]): BreakTotals {
  const sum = (pick: (s: DailyStat) => number | undefined) =>
    periodStats.reduce((total, s) => total + (pick(s) || 0), 0)

  const shortBreaks = sum((s) => s.shortBreakCount)
  const longBreaks = sum((s) => s.longBreakCount)
  const shortBreakTime = sum((s) => s.shortBreakTime)
  const longBreakTime = sum((s) => s.longBreakTime)
  const shortBreaksSkipped = sum((s) => s.shortBreaksSkipped)
  const longBreaksSkipped = sum((s) => s.longBreaksSkipped)

  return {
    shortBreaks,
    longBreaks,
    shortBreakTime,
    longBreakTime,
    accumulatedBreakTime: sum((s) => s.accumulatedBreakTime),
    shortBreaksSkipped,
    longBreaksSkipped,
    pomodoros: sum((s) => s.totalPomodoros),
    breaksTaken: shortBreaks + longBreaks,
    breaksSkipped: shortBreaksSkipped + longBreaksSkipped,
    breakTime: shortBreakTime + longBreakTime,
  }
}

/**
 * How many breaks a given number of pomodoros should have earned.
 *
 * One long break per completed cycle, plus a short break between each
 * pomodoro within the current partial cycle.
 */
export function expectedBreaksForPomodoros(pomodoros: number, cyclesBeforeLongBreak: number): number {
  if (pomodoros <= 0 || cyclesBeforeLongBreak <= 0) return 0
  const shortBreaksPerCycle = cyclesBeforeLongBreak - 1
  return (
    Math.floor(pomodoros / cyclesBeforeLongBreak) +
    Math.min(pomodoros % cyclesBeforeLongBreak, shortBreaksPerCycle)
  )
}

/**
 * Percentage of earned breaks that were actually taken.
 *
 * The denominator is the larger of what the cycles implied and what was
 * observably taken or skipped, so the rate cannot exceed 100 while still
 * counting breaks that were never prompted. With no data at all it returns
 * 100 rather than 0, so a fresh install is not told off.
 */
export function breakComplianceRate(totals: Pick<BreakTotals, "breaksTaken" | "breaksSkipped" | "pomodoros">, cyclesBeforeLongBreak: number): number {
  const expected = Math.max(
    expectedBreaksForPomodoros(totals.pomodoros, cyclesBeforeLongBreak),
    totals.breaksTaken + totals.breaksSkipped,
  )
  if (expected <= 0) return 100
  return Math.round((totals.breaksTaken / expected) * 100)
}

/** Share of earned break time that was actually used rather than banked. */
export function breakTimeUsageRate(totals: Pick<BreakTotals, "breakTime" | "accumulatedBreakTime">): number {
  const all = totals.breakTime + totals.accumulatedBreakTime
  if (all <= 0) return 100
  return Math.round((totals.breakTime / all) * 100)
}

/** 0-100. Mostly break-time usage, with a bonus for taking breaks at all. */
export function wellbeingScore(totals: Pick<BreakTotals, "breakTime" | "accumulatedBreakTime" | "breaksTaken" | "longBreaks">): number {
  return Math.min(
    100,
    Math.round(
      breakTimeUsageRate(totals) * 0.6 +
        (totals.breaksTaken > 0 ? 20 : 0) +
        (totals.longBreaks > 0 ? 20 : 0),
    ),
  )
}

export function wellbeingLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "text-emerald-400" }
  if (score >= 60) return { label: "Good", color: "text-cyan-400" }
  if (score >= 40) return { label: "Fair", color: "text-yellow-400" }
  return { label: "Needs Attention", color: "text-red-400" }
}

/**
 * Pomodoros completed today without a break in between.
 *
 * The -1 is deliberate: finishing one pomodoro and stopping is not skipping a
 * break, so the count only rises from the second unbroken pomodoro onward.
 */
export function pomodorosWithoutBreak(todayStat?: DailyStat): number {
  const pomodoros = todayStat?.totalPomodoros || 0
  const taken = (todayStat?.shortBreakCount || 0) + (todayStat?.longBreakCount || 0)
  return Math.max(0, pomodoros - taken - 1)
}
