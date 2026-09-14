import type { SessionType } from "./types"

/**
 * The pomodoro cycle: which session follows the one that just ended.
 *
 * The intended rhythm, and the one this module enforces:
 *
 *   focus, short, focus, short, focus, short, focus, LONG, then repeat
 *
 * A long break arrives only after the Nth focus session, where N is
 * `cyclesBeforeLongBreak` (4 by default). A day always opens on a focus
 * session.
 *
 * This exists because the rule was implemented twice in pomodoro-app.tsx and
 * the two copies disagreed:
 *
 *   - Finishing a session naturally counted the FOCUS sessions, which is
 *     correct.
 *   - Skipping a session counted the SHORT BREAKS instead, and sent a short
 *     break straight into a long break with no focus in between.
 *
 * So a skipped break advanced the counter a second time, and a long break
 * turned up after roughly every two pomodoros rather than every four. Skipping
 * breaks is normal in this app (it tracks `shortBreaksSkipped` and banks the
 * time), so the two paths were being mixed constantly.
 *
 * One rule, one place, called by both paths.
 */

export const DEFAULT_CYCLES_BEFORE_LONG_BREAK = 4

export interface CycleState {
  sessionType: SessionType
  /**
   * Focus sessions finished in the CURRENT run toward a long break.
   *
   * Counts focus sessions only. A skipped or completed break never changes it,
   * which is what keeps the long break on a four-pomodoro cadence however the
   * breaks in between are handled.
   */
  completedFocusSessions: number
}

/** A fresh day, or a fresh cycle: always a focus session. */
export function startOfCycle(): CycleState {
  return { sessionType: "focus", completedFocusSessions: 0 }
}

/**
 * How many focus sessions per long break, guarding the stored value.
 *
 * A stored 0 makes `n % 0` NaN, so no long break ever arrives; a stored 1
 * makes every single break a long one. Both are worse than falling back.
 */
export function cyclesBeforeLongBreakOf(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return DEFAULT_CYCLES_BEFORE_LONG_BREAK
  }
  return Math.floor(value)
}

/**
 * The session that follows the one that just ended, whether it ran to zero or
 * was skipped. Skipping changes what you get next in exactly no way, which is
 * the point: the cadence is a property of the work done, not of how the breaks
 * were dismissed.
 */
export function nextSession(state: CycleState, cyclesBeforeLongBreak: number): CycleState {
  const cycles = cyclesBeforeLongBreakOf(cyclesBeforeLongBreak)

  if (state.sessionType === "focus") {
    const completed = state.completedFocusSessions + 1
    const longBreakDue = completed % cycles === 0
    return {
      sessionType: longBreakDue ? "longBreak" : "shortBreak",
      // Reset after the long break is handed out, so the count stays within one
      // run instead of growing without bound across a day.
      completedFocusSessions: longBreakDue ? 0 : completed,
    }
  }

  // After any break, short or long, work resumes. Two breaks never run back to
  // back, which is what the skip path used to allow.
  return { sessionType: "focus", completedFocusSessions: state.completedFocusSessions }
}

/**
 * Should the restored timer be thrown away and the day restarted on a focus
 * session?
 *
 * The saved timer state carried a timestamp that nothing ever read, so a day
 * resumed on whatever session yesterday ended on. Since a focus session always
 * ends INTO a break, the common case was opening the app to a break before any
 * work had been done.
 */
export function isStaleTimerState(savedDate: string, today: string): boolean {
  if (!today) return false
  if (!savedDate) return true
  return savedDate !== today
}
