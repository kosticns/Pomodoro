import { describe, it, expect } from "vitest"
import {
  aggregateBreaks,
  expectedBreaksForPomodoros,
  breakComplianceRate,
  breakTimeUsageRate,
  wellbeingScore,
  wellbeingLabel,
  pomodorosWithoutBreak,
} from "./break-stats"
import type { DailyStat } from "./types"

/** A day with everything zeroed, so each test states only what it cares about. */
function day(overrides: Partial<DailyStat> = {}): DailyStat {
  return {
    date: "2026-09-03",
    totalPomodoros: 0,
    timeSpent: 0,
    workdayStarted: false,
    workdayCompleted: false,
    workdayTimeSpent: 0,
    shortBreakTime: 0,
    longBreakTime: 0,
    shortBreakCount: 0,
    longBreakCount: 0,
    shortBreaksSkipped: 0,
    longBreaksSkipped: 0,
    accumulatedBreakTime: 0,
    dayStartTime: null,
    projectsWorked: [],
    ...overrides,
  } as DailyStat
}

describe("aggregateBreaks", () => {
  it("sums across days", () => {
    const t = aggregateBreaks([
      day({ shortBreakCount: 2, longBreakCount: 1, shortBreakTime: 10, longBreakTime: 15, totalPomodoros: 4 }),
      day({ shortBreakCount: 3, longBreakCount: 1, shortBreakTime: 15, longBreakTime: 15, totalPomodoros: 4 }),
    ])
    expect(t.shortBreaks).toBe(5)
    expect(t.longBreaks).toBe(2)
    expect(t.breaksTaken).toBe(7)
    expect(t.breakTime).toBe(55)
    expect(t.pomodoros).toBe(8)
  })

  it("returns zeros for an empty period rather than NaN", () => {
    const t = aggregateBreaks([])
    expect(t.breaksTaken).toBe(0)
    expect(t.breakTime).toBe(0)
    expect(Number.isNaN(t.breaksTaken)).toBe(false)
  })

  it("treats missing fields as zero, since older saved days lack them", () => {
    // A stat written before skip-tracking existed.
    const legacy = { date: "2026-01-01", totalPomodoros: 3 } as unknown as DailyStat
    const t = aggregateBreaks([legacy])
    expect(t.shortBreaksSkipped).toBe(0)
    expect(t.breakTime).toBe(0)
    expect(t.pomodoros).toBe(3)
  })
})

describe("expectedBreaksForPomodoros", () => {
  it("is zero before any pomodoros", () => {
    expect(expectedBreaksForPomodoros(0, 4)).toBe(0)
  })

  it("counts the short breaks between pomodoros in a partial cycle", () => {
    // 4-pomodoro cycle: after 1, 2 and 3 there is a short break.
    expect(expectedBreaksForPomodoros(1, 4)).toBe(1)
    expect(expectedBreaksForPomodoros(2, 4)).toBe(2)
    expect(expectedBreaksForPomodoros(3, 4)).toBe(3)
  })

  it("counts one long break per completed cycle", () => {
    expect(expectedBreaksForPomodoros(4, 4)).toBe(1)
    expect(expectedBreaksForPomodoros(8, 4)).toBe(2)
  })

  it("does not divide by zero on a nonsensical cycle length", () => {
    expect(expectedBreaksForPomodoros(5, 0)).toBe(0)
  })
})

describe("breakComplianceRate", () => {
  it("returns 100 with no activity, so a fresh install is not told off", () => {
    expect(breakComplianceRate({ breaksTaken: 0, breaksSkipped: 0, pomodoros: 0 }, 4)).toBe(100)
  })

  it("is 100 when every earned break was taken", () => {
    expect(breakComplianceRate({ breaksTaken: 3, breaksSkipped: 0, pomodoros: 3 }, 4)).toBe(100)
  })

  it("is 0 when every break was skipped", () => {
    expect(breakComplianceRate({ breaksTaken: 0, breaksSkipped: 4, pomodoros: 4 }, 4)).toBe(0)
  })

  it("halves when half were skipped", () => {
    expect(breakComplianceRate({ breaksTaken: 2, breaksSkipped: 2, pomodoros: 0 }, 4)).toBe(50)
  })

  it("never exceeds 100, even if more breaks were taken than earned", () => {
    expect(breakComplianceRate({ breaksTaken: 9, breaksSkipped: 0, pomodoros: 1 }, 4)).toBe(100)
  })

  it("counts breaks the cycles earned but that were never prompted or skipped", () => {
    // 8 pomodoros earn 2 breaks; none taken, none explicitly skipped.
    expect(breakComplianceRate({ breaksTaken: 0, breaksSkipped: 0, pomodoros: 8 }, 4)).toBe(0)
  })
})

describe("breakTimeUsageRate", () => {
  it("returns 100 when nothing has been earned yet", () => {
    expect(breakTimeUsageRate({ breakTime: 0, accumulatedBreakTime: 0 })).toBe(100)
  })

  it("is the share of earned time actually used", () => {
    expect(breakTimeUsageRate({ breakTime: 30, accumulatedBreakTime: 10 })).toBe(75)
    expect(breakTimeUsageRate({ breakTime: 0, accumulatedBreakTime: 40 })).toBe(0)
  })
})

describe("wellbeingScore", () => {
  it("is 60 for a fresh install: full usage rate, no bonuses earned", () => {
    expect(wellbeingScore({ breakTime: 0, accumulatedBreakTime: 0, breaksTaken: 0, longBreaks: 0 })).toBe(60)
  })

  it("reaches 100 with full usage plus both bonuses", () => {
    expect(wellbeingScore({ breakTime: 60, accumulatedBreakTime: 0, breaksTaken: 5, longBreaks: 1 })).toBe(100)
  })

  it("is capped at 100", () => {
    const s = wellbeingScore({ breakTime: 999, accumulatedBreakTime: 0, breaksTaken: 99, longBreaks: 9 })
    expect(s).toBeLessThanOrEqual(100)
  })

  it("drops when earned break time is banked rather than taken", () => {
    const used = wellbeingScore({ breakTime: 40, accumulatedBreakTime: 0, breaksTaken: 4, longBreaks: 1 })
    const banked = wellbeingScore({ breakTime: 10, accumulatedBreakTime: 30, breaksTaken: 4, longBreaks: 1 })
    expect(banked).toBeLessThan(used)
  })
})

describe("wellbeingLabel", () => {
  it("labels each band at its boundary", () => {
    expect(wellbeingLabel(80).label).toBe("Excellent")
    expect(wellbeingLabel(79).label).toBe("Good")
    expect(wellbeingLabel(60).label).toBe("Good")
    expect(wellbeingLabel(59).label).toBe("Fair")
    expect(wellbeingLabel(40).label).toBe("Fair")
    expect(wellbeingLabel(39).label).toBe("Needs Attention")
    expect(wellbeingLabel(0).label).toBe("Needs Attention")
  })
})

describe("pomodorosWithoutBreak", () => {
  it("is 0 with no data", () => {
    expect(pomodorosWithoutBreak(undefined)).toBe(0)
  })

  it("does not count a single pomodoro as a skipped break", () => {
    expect(pomodorosWithoutBreak(day({ totalPomodoros: 1 }))).toBe(0)
  })

  it("counts from the second unbroken pomodoro onward", () => {
    expect(pomodorosWithoutBreak(day({ totalPomodoros: 2 }))).toBe(1)
    expect(pomodorosWithoutBreak(day({ totalPomodoros: 5 }))).toBe(4)
  })

  it("never goes negative when breaks outnumber pomodoros", () => {
    expect(pomodorosWithoutBreak(day({ totalPomodoros: 1, shortBreakCount: 5 }))).toBe(0)
  })
})

describe("regression: the 3 Sep 2026 Breaks crash", () => {
  it("computes a compliance rate from real totals without throwing", () => {
    // breakComplianceRate was referenced in the Well-being Tip and defined
    // nowhere, which crashed the whole tab on open.
    const totals = aggregateBreaks([day({ totalPomodoros: 4, shortBreakCount: 3, longBreakCount: 1 })])
    expect(() => breakComplianceRate(totals, 4)).not.toThrow()
    expect(breakComplianceRate(totals, 4)).toBe(100)
  })

  it("renders a tip band for an empty history", () => {
    const totals = aggregateBreaks([])
    const rate = breakComplianceRate(totals, 4)
    expect(rate).toBe(100)
    expect(rate).toBeGreaterThanOrEqual(80) // the "Excellent break habits" branch
  })
})
