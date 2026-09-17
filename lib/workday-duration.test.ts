import { describe, it, expect } from "vitest"
import {
  MAX_WORKDAY_HOURS,
  MIN_WORKDAY_HOURS,
  WORKDAY_STEP_HOURS,
  formatWorkdayDuration,
  normaliseWorkdayDuration,
  stepWorkdayDuration,
  workdayDurationWords,
} from "./workday-duration"

describe("the step", () => {
  it("is half an hour", () => {
    expect(WORKDAY_STEP_HOURS).toBe(0.5)
  })

  it("runs from 4 to 12 hours", () => {
    expect(MIN_WORKDAY_HOURS).toBe(4)
    expect(MAX_WORKDAY_HOURS).toBe(12)
  })
})

describe("normaliseWorkdayDuration", () => {
  it("leaves a value already on the step alone", () => {
    expect(normaliseWorkdayDuration(8)).toBe(8)
    expect(normaliseWorkdayDuration(8.5)).toBe(8.5)
  })

  it("snaps to the nearest half hour", () => {
    expect(normaliseWorkdayDuration(8.2)).toBe(8)
    expect(normaliseWorkdayDuration(8.4)).toBe(8.5)
    expect(normaliseWorkdayDuration(8.75)).toBe(9)
  })

  it("clamps to the range", () => {
    expect(normaliseWorkdayDuration(1)).toBe(4)
    expect(normaliseWorkdayDuration(99)).toBe(12)
  })

  it("falls back to 8 rather than producing NaN", () => {
    // A restored backup can carry anything.
    expect(normaliseWorkdayDuration(NaN)).toBe(8)
    expect(normaliseWorkdayDuration(Infinity)).toBe(8)
    expect(normaliseWorkdayDuration(undefined as unknown as number)).toBe(8)
  })

  it("accepts every whole hour a stored setting could already hold", () => {
    for (let h = 4; h <= 12; h++) expect(normaliseWorkdayDuration(h)).toBe(h)
  })
})

describe("stepWorkdayDuration", () => {
  it("adds half an hour per tap", () => {
    expect(stepWorkdayDuration(8)).toBe(8.5)
    expect(stepWorkdayDuration(8.5)).toBe(9)
  })

  it("wraps from the top back to the bottom, so the control never dead-ends", () => {
    // Tapping is the only input, so coming back down has to be possible.
    expect(stepWorkdayDuration(MAX_WORKDAY_HOURS)).toBe(MIN_WORKDAY_HOURS)
  })

  it("brings an out-of-range stored value back into range", () => {
    expect(stepWorkdayDuration(99)).toBe(MIN_WORKDAY_HOURS)
    expect(stepWorkdayDuration(1)).toBe(4.5)
  })

  it("visits every step exactly once before repeating", () => {
    const seen: number[] = []
    let v = MIN_WORKDAY_HOURS
    for (let i = 0; i < 17; i++) {
      seen.push(v)
      v = stepWorkdayDuration(v)
    }
    expect(new Set(seen).size).toBe(17)
    expect(v).toBe(MIN_WORKDAY_HOURS)
  })

  it("does not drift on floating point across a full cycle", () => {
    let v = MIN_WORKDAY_HOURS
    for (let i = 0; i < 100; i++) v = stepWorkdayDuration(v)
    expect(Number.isInteger(v * 2)).toBe(true)
  })
})

describe("formatWorkdayDuration", () => {
  it("prints both parts, so the label does not change width as it steps", () => {
    expect(formatWorkdayDuration(8)).toBe("8h 00m")
    expect(formatWorkdayDuration(8.5)).toBe("8h 30m")
    expect(formatWorkdayDuration(12)).toBe("12h 00m")
  })

  it("never prints a decimal, which is what the raw value did", () => {
    // "{workdayDuration}h 00m" rendered "8.5h 00m" before this existed.
    for (let v = MIN_WORKDAY_HOURS; v <= MAX_WORKDAY_HOURS; v += 0.5) {
      expect(formatWorkdayDuration(v)).not.toMatch(/\./)
    }
  })

  it("normalises before printing, so a stray value still reads sensibly", () => {
    expect(formatWorkdayDuration(8.2)).toBe("8h 00m")
    expect(formatWorkdayDuration(NaN)).toBe("8h 00m")
  })
})

describe("workdayDurationWords", () => {
  it("reads naturally in the completion notification", () => {
    expect(workdayDurationWords(8)).toBe("8-hour")
    expect(workdayDurationWords(8.5)).toBe("8 and a half hour")
  })
})
