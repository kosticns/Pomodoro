import type { Settings } from "./types"

/**
 * Sit/stand switch cadence.
 *
 * One number governs both directions: the timer compares how long the current
 * posture has been held against this, and prompts to stand or to sit
 * accordingly. There is no separate sitting and standing interval.
 */
export const DEFAULT_STANDING_CADENCE_MINUTES = 90

/**
 * The default shipped before 2026-09-08. Used only by the one-time migration
 * in lib/app-state.tsx, which moves stored values still sitting on the old
 * default up to the new one.
 */
export const LEGACY_STANDING_CADENCE_MINUTES = 45

/**
 * Minutes between sit/stand switches for these settings.
 *
 * Uses `??` rather than `||`. The call sites this replaces all used
 * `settings.standingCadence || 45`, which also discards a stored 0 and
 * silently substituted 45. Only an absent value should fall back.
 */
export function standingCadenceOf(settings: Pick<Settings, "standingCadence">): number {
  return settings.standingCadence ?? DEFAULT_STANDING_CADENCE_MINUTES
}

/**
 * Should a stored cadence be moved up to the new default?
 *
 * True only when the stored value is exactly the old default. That value
 * cannot be distinguished from "never chosen", since it is what the app used
 * to ship, so it is the only one safe to change. Any other number is a
 * deliberate choice and is left alone.
 */
export function needsCadenceMigration(settings: Pick<Settings, "standingCadence">): boolean {
  return settings.standingCadence === LEGACY_STANDING_CADENCE_MINUTES
}
