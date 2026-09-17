/**
 * The workday length, in half-hour steps.
 *
 * It was a whole-hour number input, so the shortest change possible was an
 * hour. Half hours are the granularity a day actually moves in.
 *
 * `workdayDuration` stays a number of hours, now fractional. Everything that
 * does arithmetic on it (`* 60`, `* 60 * 60 * 1000`) was already correct for
 * 8.5. Everything that PRINTED it was not: `{workdayDuration}h 00m` renders
 * "8.5h 00m", which is why formatWorkdayDuration exists and why every display
 * site goes through it.
 */

export const WORKDAY_STEP_HOURS = 0.5
export const MIN_WORKDAY_HOURS = 4
export const MAX_WORKDAY_HOURS = 12

/**
 * Snap to the nearest half hour and clamp to the range.
 *
 * Applied on read as well as on write, because a stored value predates this
 * and may be any whole number, and a restored backup can carry anything.
 */
export function normaliseWorkdayDuration(hours: number): number {
  if (!Number.isFinite(hours)) return 8
  const snapped = Math.round(hours / WORKDAY_STEP_HOURS) * WORKDAY_STEP_HOURS
  return Math.min(MAX_WORKDAY_HOURS, Math.max(MIN_WORKDAY_HOURS, snapped))
}

/**
 * The next value when the control is tapped.
 *
 * Wraps back to the minimum past the top, so the control stays reversible with
 * one finger and never dead-ends. Tapping is the only input, so it has to be
 * possible to come back down.
 */
export function stepWorkdayDuration(hours: number): number {
  const next = normaliseWorkdayDuration(hours) + WORKDAY_STEP_HOURS
  return next > MAX_WORKDAY_HOURS ? MIN_WORKDAY_HOURS : next
}

/**
 * "8h 30m". Always both parts, so the label does not change width as it steps
 * and the Timer's existing "8h 00m" reads the same as before.
 */
export function formatWorkdayDuration(hours: number): string {
  const totalMinutes = Math.round(normaliseWorkdayDuration(hours) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m.toString().padStart(2, "0")}m`
}

/** Spoken form for the completion notification: "8 and a half hour". */
export function workdayDurationWords(hours: number): string {
  const value = normaliseWorkdayDuration(hours)
  const whole = Math.floor(value)
  return value === whole ? `${whole}-hour` : `${whole} and a half hour`
}
