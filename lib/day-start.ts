/**
 * The start-of-day prompt.
 *
 * The app already had a Daily Backup modal, but it was attached to pressing
 * play on the first focus session. That made the backup a side effect of
 * starting work rather than the thing you do before it.
 *
 * This makes it time-based instead: once per calendar day, from a set hour,
 * the app offers to save yesterday's data and then gets out of the way.
 *
 * NOT a timer that fires at 08:00. The app is usually closed at 08:00, so a
 * scheduled fire would simply be missed. The rule is "the first time I see you
 * on a new day, provided it is past the hour", which also covers the case
 * where the app happens to be open when the hour passes.
 */

/** Hour of the local day, 0-23, from which the prompt may appear. */
export const DEFAULT_DAY_START_HOUR = 8

export interface DayPromptInput {
  /** The date, YYYY-MM-DD, this prompt was last shown or dismissed for. */
  lastPromptedDate: string
  /** Today, YYYY-MM-DD, read at check time. */
  today: string
  /** Current local hour, 0-23. */
  currentHour: number
  /** Hour from which prompting is allowed. */
  startHour: number
}

/**
 * Should the start-of-day prompt appear right now?
 *
 * Deliberately takes today and the hour as arguments rather than reading the
 * clock. A value computed during render is stale for a session left open
 * across midnight, which is the exact bug that made the workday timer fail to
 * roll over. Callers read the clock when they check.
 */
export function shouldPromptNewDay(input: DayPromptInput): boolean {
  if (!input.today) return false
  // Already handled today, whether the user saved or skipped.
  if (input.lastPromptedDate === input.today) return false
  // Too early. Opening the app at 06:00 should not start nagging.
  if (input.currentHour < input.startHour) return false
  return true
}

/** Local hour, 0-23. Separate so tests can supply a fixed date. */
export function localHour(d: Date = new Date()): number {
  return d.getHours()
}

/**
 * "09:12" in 24-hour form, which is how Mickey's other tools show times and
 * avoids the am/pm ambiguity around midnight and noon.
 */
export function formatClock(d: Date | number = new Date()): string {
  const date = typeof d === "number" ? new Date(d) : d
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

/**
 * Time-appropriate greeting.
 *
 * The prompt fires on the first open of a new day, which is usually the
 * morning but is whenever you actually open the app. Hardcoding "Good
 * morning" made it greet the afternoon incorrectly.
 */
export function greeting(hour: number = localHour()): string {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}
