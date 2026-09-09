import { describe, it, expect } from "vitest"
import {
  DEFAULT_STANDING_CADENCE_MINUTES,
  LEGACY_STANDING_CADENCE_MINUTES,
  standingCadenceOf,
  needsCadenceMigration,
  shouldRemindPosture,
} from "./posture"

describe("standingCadenceOf", () => {
  it("returns the stored cadence when set", () => {
    expect(standingCadenceOf({ standingCadence: 60 })).toBe(60)
  })

  it("falls back to the default when unset", () => {
    expect(standingCadenceOf({ standingCadence: undefined as unknown as number })).toBe(90)
  })

  it("defaults to 90 minutes", () => {
    expect(DEFAULT_STANDING_CADENCE_MINUTES).toBe(90)
  })

  it("preserves a stored 0 rather than substituting the default", () => {
    // The `|| 45` this replaced treated 0 as absent. Only null/undefined
    // should fall back.
    expect(standingCadenceOf({ standingCadence: 0 })).toBe(0)
  })
})

describe("needsCadenceMigration", () => {
  it("migrates a value still on the old default", () => {
    expect(needsCadenceMigration({ standingCadence: LEGACY_STANDING_CADENCE_MINUTES })).toBe(true)
  })

  it("leaves a deliberately chosen value alone", () => {
    for (const chosen of [15, 30, 60, 75, 120]) {
      expect(needsCadenceMigration({ standingCadence: chosen })).toBe(false)
    }
  })

  it("does not migrate a value already on the new default", () => {
    expect(needsCadenceMigration({ standingCadence: DEFAULT_STANDING_CADENCE_MINUTES })).toBe(false)
  })

  it("does not migrate an absent value, since the default already applies", () => {
    expect(needsCadenceMigration({ standingCadence: undefined as unknown as number })).toBe(false)
  })

  it("is idempotent: migrating twice changes nothing the second time", () => {
    const stored = { standingCadence: LEGACY_STANDING_CADENCE_MINUTES }
    expect(needsCadenceMigration(stored)).toBe(true)
    const migrated = { standingCadence: DEFAULT_STANDING_CADENCE_MINUTES }
    expect(needsCadenceMigration(migrated)).toBe(false)
  })
})

describe("shouldRemindPosture", () => {
  const base = {
    reminderEnabled: true,
    workdayActive: true,
    lastPostureChange: 1_000,
    minutesInPosture: 90,
    cadenceMinutes: 90,
    lastNotifiedChangeAt: null as number | null,
  }

  it("fires once the cadence is reached", () => {
    expect(shouldRemindPosture(base)).toBe(true)
  })

  it("stays quiet before the cadence is reached", () => {
    expect(shouldRemindPosture({ ...base, minutesInPosture: 89 })).toBe(false)
  })

  it("does not fire twice for the same stretch", () => {
    expect(shouldRemindPosture({ ...base, lastNotifiedChangeAt: 1_000 })).toBe(false)
  })

  it("fires again after the posture changes, since the timestamp moved", () => {
    // lastPostureChange has advanced; the old notified marker no longer matches.
    expect(shouldRemindPosture({ ...base, lastPostureChange: 2_000, lastNotifiedChangeAt: 1_000 })).toBe(true)
  })

  it("respects the reminder being switched off", () => {
    expect(shouldRemindPosture({ ...base, reminderEnabled: false })).toBe(false)
  })

  it("treats an unset reminder flag as enabled, matching the UI", () => {
    expect(shouldRemindPosture({ ...base, reminderEnabled: undefined })).toBe(true)
  })

  it("stays quiet when no workday is running", () => {
    expect(shouldRemindPosture({ ...base, workdayActive: false })).toBe(false)
  })

  it("stays quiet with no posture timestamp to measure from", () => {
    expect(shouldRemindPosture({ ...base, lastPostureChange: null })).toBe(false)
  })

  it("follows the user's cadence rather than a fixed number", () => {
    expect(shouldRemindPosture({ ...base, minutesInPosture: 50, cadenceMinutes: 45 })).toBe(true)
    expect(shouldRemindPosture({ ...base, minutesInPosture: 50, cadenceMinutes: 120 })).toBe(false)
  })
})
