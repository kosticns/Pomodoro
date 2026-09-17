import { describe, it, expect } from "vitest"
import {
  MAX_WORKDAY_HOURS,
  MIN_WORKDAY_HOURS,
  WORKDAY_STEP_HOURS,
  formatWorkdayDuration,
  normaliseWorkdayDuration,
  stepWorkdayDuration,
  stepPercentOfWorkday,
  snapProgressToStep,
  elapsedAtProgress,
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

describe("stepPercentOfWorkday", () => {
  it("is half an hour as a share of the day", () => {
    expect(stepPercentOfWorkday(8)).toBeCloseTo(6.25, 5)
    expect(stepPercentOfWorkday(4)).toBeCloseTo(12.5, 5)
    expect(stepPercentOfWorkday(12)).toBeCloseTo(4.1667, 3)
  })

  it("shrinks as the workday grows, so the step is always 30 real minutes", () => {
    expect(stepPercentOfWorkday(8.5)).toBeLessThan(stepPercentOfWorkday(8))
  })
})

describe("snapProgressToStep", () => {
  it("snaps a dragged position to the nearest half hour", () => {
    // 3h 28m of an 8h day is 43.4%. The nearest half hour is 3h 30m.
    expect(snapProgressToStep(43.4, 8)).toBeCloseTo(43.75, 5)
    expect(elapsedAtProgress(snapProgressToStep(43.4, 8), 8)).toBe("3h 30m")
  })

  it("leaves a position already on a step alone", () => {
    expect(snapProgressToStep(50, 8)).toBeCloseTo(50, 5)
    expect(snapProgressToStep(0, 8)).toBe(0)
  })

  it("rounds down below the halfway point and up above it", () => {
    expect(elapsedAtProgress(snapProgressToStep(40, 8), 8)).toBe("3h 00m")
    expect(elapsedAtProgress(snapProgressToStep(46, 8), 8)).toBe("3h 30m")
  })

  it("stays inside 0 to 100", () => {
    expect(snapProgressToStep(-20, 8)).toBe(0)
    expect(snapProgressToStep(150, 8)).toBe(100)
  })

  it("lands exactly on the end of the day, not past it", () => {
    expect(snapProgressToStep(99.9, 8)).toBe(100)
    expect(elapsedAtProgress(100, 8)).toBe("8h 00m")
  })

  it("respects a half-hour workday length", () => {
    // 8.5h has 17 steps, so each is 1/17 of the day.
    expect(elapsedAtProgress(snapProgressToStep(50, 8.5), 8.5)).toBe("4h 30m")
  })

  it("never produces a time that is not a whole half hour", () => {
    for (let p = 0; p <= 100; p += 1.3) {
      const label = elapsedAtProgress(snapProgressToStep(p, 8), 8)
      expect(label).toMatch(/^\d+h (00|30)m$/)
    }
  })

  it("does not produce NaN from a bad input", () => {
    expect(snapProgressToStep(NaN, 8)).toBe(0)
  })
})

describe("elapsedAtProgress", () => {
  it("reads the elapsed time at a position", () => {
    expect(elapsedAtProgress(0, 8)).toBe("0h 00m")
    expect(elapsedAtProgress(50, 8)).toBe("4h 00m")
    expect(elapsedAtProgress(100, 8)).toBe("8h 00m")
  })

  it("clamps rather than reporting more than a full day", () => {
    expect(elapsedAtProgress(150, 8)).toBe("8h 00m")
    expect(elapsedAtProgress(-10, 8)).toBe("0h 00m")
  })
})
