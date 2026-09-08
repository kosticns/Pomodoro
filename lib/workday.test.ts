import { describe, it, expect } from "vitest"
import { isWorkdayForToday, shouldStartNewWorkday } from "./workday"

const TODAY = "2026-09-08"
const YESTERDAY = "2026-09-07"

describe("isWorkdayForToday", () => {
  it("is false when no workday has ever been started", () => {
    expect(isWorkdayForToday({ startTime: null, date: "" }, TODAY)).toBe(false)
  })

  it("is true for a workday started today", () => {
    expect(isWorkdayForToday({ startTime: 1_700_000_000_000, date: TODAY }, TODAY)).toBe(true)
  })

  it("is FALSE for yesterday's workday, even though startTime is set", () => {
    // The whole bug. startTime persists overnight, so a check on startTime
    // alone reported "already running" on the new morning.
    expect(isWorkdayForToday({ startTime: 1_700_000_000_000, date: YESTERDAY }, TODAY)).toBe(false)
  })

  it("is false for a date-less record that somehow has a start time", () => {
    expect(isWorkdayForToday({ startTime: 1_700_000_000_000, date: "" }, TODAY)).toBe(false)
  })

  it("is false after a reset, which clears both fields", () => {
    expect(isWorkdayForToday({ startTime: null, date: "" }, TODAY)).toBe(false)
  })
})

describe("shouldStartNewWorkday", () => {
  it("starts a day on a fresh install", () => {
    expect(shouldStartNewWorkday({ startTime: null, date: "" }, TODAY)).toBe(true)
  })

  it("starts a new day when the stored workday is yesterday's", () => {
    expect(shouldStartNewWorkday({ startTime: 1_700_000_000_000, date: YESTERDAY }, TODAY)).toBe(true)
  })

  it("does NOT restart mid-day, which would lose the elapsed workday", () => {
    expect(shouldStartNewWorkday({ startTime: 1_700_000_000_000, date: TODAY }, TODAY)).toBe(false)
  })

  it("is the exact inverse of isWorkdayForToday", () => {
    const cases = [
      { startTime: null, date: "" },
      { startTime: 1, date: TODAY },
      { startTime: 1, date: YESTERDAY },
    ]
    for (const c of cases) {
      expect(shouldStartNewWorkday(c, TODAY)).toBe(!isWorkdayForToday(c, TODAY))
    }
  })
})

describe("regression: the new-day workday bug (8 Sep 2026)", () => {
  it("a paused workday from yesterday still starts a new day", () => {
    // He ends the day paused, opens the app next morning, presses play.
    const yesterdayPaused = { startTime: 1_700_000_000_000, date: YESTERDAY }
    expect(shouldStartNewWorkday(yesterdayPaused, TODAY)).toBe(true)
  })

  it("the date must be supplied by the caller, so it can be read at click time", () => {
    // A render-time date goes stale for a session left open across midnight.
    // Passing it in is what makes the call-time check possible, so the default
    // parameter must never be the only way to use this.
    const stored = { startTime: 1_700_000_000_000, date: TODAY }
    expect(shouldStartNewWorkday(stored, TODAY)).toBe(false)
    expect(shouldStartNewWorkday(stored, "2026-09-09")).toBe(true)
  })
})
