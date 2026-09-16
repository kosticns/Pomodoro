/**
 * The banked break: time saved by skipping breaks, taken in one go.
 *
 * It is stored as an END TIMESTAMP, not a countdown, because the countdown it
 * replaced was wrong in two ways. It decremented a number on a one-second
 * interval, so the moment the machine slept or the tab was throttled the
 * interval stopped firing and the break simply paused. And it lived in
 * component state, so a reload lost it outright.
 *
 * Every other timer in this app already reconstructs from a timestamp, which
 * is why they survive sleep. This one now does the same, and persists, so it
 * behaves like the rest.
 */

export interface SavedBreak {
  /** When the break is due to finish, epoch ms. */
  endsAt: number
  /** How long it was to begin with, for the progress bar. */
  durationMs: number
}

export function startSavedBreak(minutes: number, now: number): SavedBreak | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  const durationMs = Math.round(minutes * 60_000)
  return { endsAt: now + durationMs, durationMs }
}

/**
 * Whole seconds left, never negative.
 *
 * Rounds up so a break with 200ms left still reads "1" rather than "0": the
 * display should not show zero while the break is still running.
 */
export function remainingSeconds(saved: SavedBreak | null, now: number): number {
  if (!saved) return 0
  return Math.max(0, Math.ceil((saved.endsAt - now) / 1000))
}

export function isSavedBreakComplete(saved: SavedBreak | null, now: number): boolean {
  if (!saved) return false
  return now >= saved.endsAt
}

/** How far through, 0 to 100. */
export function savedBreakProgress(saved: SavedBreak | null, now: number): number {
  if (!saved || saved.durationMs <= 0) return 0
  const elapsed = saved.durationMs - Math.max(0, saved.endsAt - now)
  return Math.min(100, Math.max(0, (elapsed / saved.durationMs) * 100))
}

/**
 * Is a break read back from storage still worth resuming?
 *
 * One that expired while the app was closed is finished, not owed. Returning
 * it would show a zero-length break on the next launch; returning null lets
 * the caller simply clear it.
 */
export function isResumable(saved: SavedBreak | null, now: number): boolean {
  if (!saved) return false
  return saved.endsAt > now
}
