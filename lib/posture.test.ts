import { describe, it, expect } from "vitest"
import {
  DEFAULT_STANDING_CADENCE_MINUTES,
  LEGACY_STANDING_CADENCE_MINUTES,
  standingCadenceOf,
  needsCadenceMigration,
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
