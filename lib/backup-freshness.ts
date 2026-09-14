/**
 * How long since a backup was actually taken.
 *
 * The start-of-day prompt records `lastDayPromptDate` whichever button you
 * press, including Skip. So a month of skipping looked exactly like a month of
 * backing up, and nothing anywhere knew there was no copy of the data. Skip is
 * one tap and it is the fastest way past the modal, which makes it the likely
 * default.
 *
 * This tracks the backups only, and says when that has gone stale.
 */

/** Days without a backup before the prompt starts saying so. */
export const BACKUP_STALE_DAYS = 7

/** Days without a backup before it is called out as overdue. */
export const BACKUP_OVERDUE_DAYS = 21

export type BackupFreshness = "never" | "fresh" | "stale" | "overdue"

/** Whole days between two YYYY-MM-DD dates. Negative clamps to 0. */
export function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0
  const a = Date.parse(`${from}T00:00:00`)
  const b = Date.parse(`${to}T00:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/**
 * Freshness of the last backup.
 *
 * "never" is its own state rather than an enormous number of days, because the
 * message differs: there is nothing to be stale, there is simply nothing.
 */
export function backupFreshness(lastBackupDate: string, today: string): BackupFreshness {
  if (!lastBackupDate) return "never"
  const days = daysBetween(lastBackupDate, today)
  if (days >= BACKUP_OVERDUE_DAYS) return "overdue"
  if (days >= BACKUP_STALE_DAYS) return "stale"
  return "fresh"
}

/**
 * What to say about it, or null when there is nothing worth saying.
 *
 * Silence on "fresh" is deliberate: a warning that is always on screen stops
 * being a warning.
 */
export function backupWarning(lastBackupDate: string, today: string): string | null {
  const state = backupFreshness(lastBackupDate, today)
  if (state === "fresh") return null
  if (state === "never") {
    return "You have never exported a backup. Everything lives in this browser only."
  }
  const days = daysBetween(lastBackupDate, today)
  return `Last backup was ${days} days ago. Everything lives in this browser only.`
}

/** True when the warning deserves the stronger treatment. */
export function isBackupUrgent(lastBackupDate: string, today: string): boolean {
  const state = backupFreshness(lastBackupDate, today)
  return state === "never" || state === "overdue"
}
