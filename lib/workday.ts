import { getLocalDateStr } from "./app-utils"
import type { WorkdayTimer } from "./types"

/**
 * Is this stored workday the one for `today`?
 *
 * The whole point of this function is that "a workday has been started" and "a
 * workday has been started TODAY" are different questions, and the app
 * previously asked the first when it meant the second. `startTime` persists in
 * localStorage overnight, so on a new morning the old check read as
 * "already running" and pressing play never began the new day.
 *
 * Pass `today` explicitly from an event handler. Reading the date during
 * render and closing over it is what made this fail for a session left open
 * across midnight: nothing re-renders at that moment, so a render-time value
 * is stale exactly when it matters.
 */
export function isWorkdayForToday(
  workday: Pick<WorkdayTimer, "startTime" | "date">,
  today: string = getLocalDateStr(),
): boolean {
  return workday.startTime !== null && workday.date === today
}

/**
 * Should pressing play begin a fresh workday?
 *
 * True when none has been started, or when the stored one belongs to an
 * earlier day. The inverse of isWorkdayForToday, named for the decision the
 * caller is actually making.
 */
export function shouldStartNewWorkday(
  workday: Pick<WorkdayTimer, "startTime" | "date">,
  today: string = getLocalDateStr(),
): boolean {
  return !isWorkdayForToday(workday, today)
}
