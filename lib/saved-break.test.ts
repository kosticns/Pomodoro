import { describe, it, expect } from "vitest"
import {
  isResumable,
  isSavedBreakComplete,
  remainingSeconds,
  savedBreakProgress,
  startSavedBreak,
  type SavedBreak,
} from "./saved-break"

const NOW = 1_700_000_000_000
const MINUTE = 60_000

describe("startSavedBreak", () => {
  it("ends the break the given number of minutes from now", () => {
    expect(startSavedBreak(35, NOW)).toEqual({ endsAt: NOW + 35 * MINUTE, durationMs: 35 * MINUTE })
  })

  it("handles a fractional minute without producing a fractional millisecond", () => {
    expect(startSavedBreak(0.5, NOW)?.durationMs).toBe(30_000)
  })

  it("refuses a break of no length", () => {
    expect(startSavedBreak(0, NOW)).toBeNull()
    expect(startSavedBreak(-5, NOW)).toBeNull()
    expect(startSavedBreak(NaN, NOW)).toBeNull()
  })
})

describe("remainingSeconds", () => {
  const saved: SavedBreak = { endsAt: NOW + 5 * MINUTE, durationMs: 5 * MINUTE }

  it("counts down in real time", () => {
    expect(remainingSeconds(saved, NOW)).toBe(300)
    expect(remainingSeconds(saved, NOW + 60_000)).toBe(240)
  })

  it("keeps counting across a sleep, which is the whole point", () => {
    // The old countdown decremented on an interval, so a sleeping machine
    // simply paused the break. Derived from the clock, 20 minutes of sleep
    // costs 20 minutes of break.
    const long: SavedBreak = { endsAt: NOW + 35 * MINUTE, durationMs: 35 * MINUTE }
    expect(remainingSeconds(long, NOW + 20 * MINUTE)).toBe(15 * 60)
  })

  it("never goes negative", () => {
    expect(remainingSeconds(saved, NOW + 99 * MINUTE)).toBe(0)
  })

  it("rounds up, so a running break never displays zero", () => {
    expect(remainingSeconds(saved, saved.endsAt - 200)).toBe(1)
  })

  it("is zero with no break running", () => {
    expect(remainingSeconds(null, NOW)).toBe(0)
  })
})

describe("isSavedBreakComplete", () => {
  const saved: SavedBreak = { endsAt: NOW + MINUTE, durationMs: MINUTE }

  it("is false while time remains", () => {
    expect(isSavedBreakComplete(saved, NOW)).toBe(false)
  })

  it("is true exactly on the end, not a tick later", () => {
    expect(isSavedBreakComplete(saved, saved.endsAt)).toBe(true)
  })

  it("is true for a break that expired while the app was closed", () => {
    expect(isSavedBreakComplete(saved, NOW + 99 * MINUTE)).toBe(true)
  })

  it("is false with no break running", () => {
    expect(isSavedBreakComplete(null, NOW)).toBe(false)
  })
})

describe("savedBreakProgress", () => {
  const saved: SavedBreak = { endsAt: NOW + 10 * MINUTE, durationMs: 10 * MINUTE }

  it("runs from 0 to 100", () => {
    expect(savedBreakProgress(saved, NOW)).toBe(0)
    expect(savedBreakProgress(saved, NOW + 5 * MINUTE)).toBe(50)
    expect(savedBreakProgress(saved, saved.endsAt)).toBe(100)
  })

  it("clamps rather than exceeding 100 when the break is long overdue", () => {
    expect(savedBreakProgress(saved, NOW + 99 * MINUTE)).toBe(100)
  })

  it("is zero with no break, and for a zero-length one", () => {
    expect(savedBreakProgress(null, NOW)).toBe(0)
    expect(savedBreakProgress({ endsAt: NOW, durationMs: 0 }, NOW)).toBe(0)
  })
})

describe("isResumable", () => {
  it("resumes a break still running when the app reopens", () => {
    // The old timer lost the break entirely on reload.
    expect(isResumable({ endsAt: NOW + MINUTE, durationMs: MINUTE }, NOW)).toBe(true)
  })

  it("does not resume one that expired while the app was closed", () => {
    // That break was taken, not owed. Resuming it would show zero seconds.
    expect(isResumable({ endsAt: NOW - MINUTE, durationMs: MINUTE }, NOW)).toBe(false)
  })

  it("does not resume a break ending exactly now", () => {
    expect(isResumable({ endsAt: NOW, durationMs: MINUTE }, NOW)).toBe(false)
  })

  it("is false with nothing stored", () => {
    expect(isResumable(null, NOW)).toBe(false)
  })
})
