/**
 * Whether the last write to localStorage actually landed.
 *
 * `useLocalStorage` used to catch a write error, log it to the console and
 * return the new value anyway, so React state and the screen both moved on. On
 * a full or blocked store you would see your edit, believe it was saved, and
 * lose it. Nothing in the app is worth less than the data in it, so a failed
 * write now has to be visible.
 *
 * This is a tiny store rather than a return value because every call site
 * destructures `[value, setValue]`. Widening that tuple would touch every
 * caller for no gain; the failure is a property of the storage, not of one key.
 */

export interface StorageFailure {
  /** The key whose write failed first. */
  key: string
  /** True when the browser reported the store is full. */
  quotaExceeded: boolean
  /** A sentence to show the user. */
  message: string
  at: number
}

/**
 * Is this the browser saying "no room left"?
 *
 * Browsers disagree on the name and the legacy code, so all three forms are
 * checked. Safari in private mode throws QuotaExceededError at a quota of zero,
 * which is the same user-visible problem.
 */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const name = error.name
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    (error as { code?: number }).code === 22
  )
}

/**
 * What to tell the user. Two cases, because the fix differs: a full store needs
 * space cleared, anything else is usually private browsing or a blocked origin
 * and needs the backup taken elsewhere.
 */
export function describeStorageFailure(error: unknown): string {
  if (isQuotaError(error)) {
    return "Storage is full, so that change was not saved. Export a backup, then clear older data."
  }
  return "That change could not be saved to this browser. Export a backup before closing the tab."
}

export function buildStorageFailure(key: string, error: unknown, at: number): StorageFailure {
  return { key, quotaExceeded: isQuotaError(error), message: describeStorageFailure(error), at }
}

type Listener = () => void

let current: StorageFailure | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

/** Called by useLocalStorage when a write throws. */
export function reportStorageFailure(key: string, error: unknown, at: number = Date.now()): void {
  // Keep the FIRST failure. Once storage is broken every subsequent key fails
  // too, and replacing the message each time would just churn the banner.
  if (current) return
  current = buildStorageFailure(key, error, at)
  emit()
}

/** Called when the user dismisses the warning. */
export function clearStorageFailure(): void {
  if (!current) return
  current = null
  emit()
}

export function getStorageFailure(): StorageFailure | null {
  return current
}

export function subscribeStorageHealth(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test seam. Not used by the app. */
export function resetStorageHealth(): void {
  current = null
  listeners.clear()
}
