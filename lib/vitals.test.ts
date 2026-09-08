import { describe, it, expect } from "vitest"
import { vitalsForDay, vitalsForPeriod, vitalsNotes } from "./vitals"
import { emptyDailyStat, recordPostureHeld } from "./daily-stat"
import type { DailyStat } from "./types"

const CADENCE = { standingCadence: 90 }

function day(date: string, posture: Partial<DailyStat> = {}): DailyStat {
  return { ...emptyDailyStat(date), ...posture }
}

describe("recordPostureHeld", () => {
  it("creates the day when it does not exist yet", () => {
    const out = recordPostureHeld([], "2026-09-08", "sitting", 50)
    expect(out).toHaveLength(1)
    expect(out[0].sittingMinutes).toBe(50)
    expect(out[0].longestSitStretch).toBe(50)
    expect(out[0].postureSwitches).toBe(1)
  })

  it("accumulates minutes but keeps the longest as a maximum, not a sum", () => {
    let s = recordPostureHeld([], "2026-09-08", "sitting", 50)
    s = recordPostureHeld(s, "2026-09-08", "sitting", 30)
    expect(s[0].sittingMinutes).toBe(80)
    expect(s[0].longestSitStretch).toBe(50)
  })

  it("keeps sitting and standing separate", () => {
    let s = recordPostureHeld([], "2026-09-08", "sitting", 60)
    s = recordPostureHeld(s, "2026-09-08", "standing", 25)
    expect(s[0].sittingMinutes).toBe(60)
    expect(s[0].standingMinutes).toBe(25)
    expect(s[0].postureSwitches).toBe(2)
  })

  it("ignores a zero-minute stretch, so a double tap does not inflate switches", () => {
    const s = recordPostureHeld([], "2026-09-08", "sitting", 0)
    expect(s).toHaveLength(0)
  })

  it("does not touch other days", () => {
    const start = [day("2026-09-07", { sittingMinutes: 100 })]
    const out = recordPostureHeld(start, "2026-09-08", "standing", 20)
    expect(out).toHaveLength(2)
    expect(out[0].sittingMinutes).toBe(100)
    expect(out[1].standingMinutes).toBe(20)
  })
})

describe("vitalsForDay", () => {
  it("reports an empty state for a day with no posture history", () => {
    // Every day recorded before this feature shipped looks like this.
    expect(vitalsForDay(day("2026-09-01"), CADENCE).isEmpty).toBe(true)
    expect(vitalsForDay(undefined, CADENCE).isEmpty).toBe(true)
  })

  it("computes the standing share", () => {
    const v = vitalsForDay(day("2026-09-08", { sittingMinutes: 300, standingMinutes: 100 }), CADENCE)
    expect(v.totalTrackedMinutes).toBe(400)
    expect(v.standingSharePct).toBe(25)
  })

  it("does not divide by zero when nothing is tracked", () => {
    expect(vitalsForDay(day("2026-09-08"), CADENCE).standingSharePct).toBe(0)
  })

  it("reports overrun against the user's own cadence, not a fixed number", () => {
    const stat = day("2026-09-08", { longestSitStretch: 150 })
    expect(vitalsForDay(stat, { standingCadence: 90 }).sitOverrunMinutes).toBe(60)
    expect(vitalsForDay(stat, { standingCadence: 45 }).sitOverrunMinutes).toBe(105)
    expect(vitalsForDay(stat, { standingCadence: 180 }).sitOverrunMinutes).toBe(0)
  })

  it("includes the open stretch for today", () => {
    const stat = day("2026-09-08", { sittingMinutes: 60, longestSitStretch: 60 })
    const v = vitalsForDay(stat, CADENCE, { posture: "sitting", minutes: 100 })
    expect(v.sittingMinutes).toBe(160)
    expect(v.longestSitStretch).toBe(100) // the open one is now the longest
    expect(v.sitOverrunMinutes).toBe(10)
  })

  it("does not let an open stretch shorten the recorded longest", () => {
    const stat = day("2026-09-08", { longestStandStretch: 120, standingMinutes: 120 })
    const v = vitalsForDay(stat, CADENCE, { posture: "standing", minutes: 5 })
    expect(v.longestStandStretch).toBe(120)
  })

  it("is not empty once an open stretch exists, even with nothing recorded", () => {
    const v = vitalsForDay(day("2026-09-08"), CADENCE, { posture: "standing", minutes: 12 })
    expect(v.isEmpty).toBe(false)
    expect(v.standingMinutes).toBe(12)
  })
})

describe("vitalsForPeriod", () => {
  it("sums minutes but takes the worst single stretch", () => {
    const v = vitalsForPeriod(
      [
        day("2026-09-07", { sittingMinutes: 200, standingMinutes: 60, longestSitStretch: 90, postureSwitches: 3 }),
        day("2026-09-08", { sittingMinutes: 100, standingMinutes: 40, longestSitStretch: 150, postureSwitches: 2 }),
      ],
      CADENCE,
    )
    expect(v.sittingMinutes).toBe(300)
    expect(v.standingMinutes).toBe(100)
    expect(v.postureSwitches).toBe(5)
    expect(v.longestSitStretch).toBe(150) // worst day, not 240
    expect(v.sitOverrunMinutes).toBe(60)
  })

  it("is empty for an empty period", () => {
    expect(vitalsForPeriod([], CADENCE).isEmpty).toBe(true)
  })
})

describe("vitalsNotes", () => {
  it("says nothing at all when there is no data", () => {
    expect(vitalsNotes(vitalsForDay(undefined, CADENCE))).toEqual([])
  })

  it("flags a long sit against the lower back, quoting both numbers", () => {
    const v = vitalsForDay(day("2026-09-08", { sittingMinutes: 150, longestSitStretch: 150 }), CADENCE)
    const note = vitalsNotes(v).find((n) => n.area === "lower-back")!
    expect(note.level).toBe("watch")
    expect(note.text).toContain("2h 30m") // the recorded stretch
    expect(note.text).toContain("90m") // the target it is judged against
  })

  it("reassures when a posture stayed within the target", () => {
    const v = vitalsForDay(day("2026-09-08", { standingMinutes: 40, longestStandStretch: 40 }), CADENCE)
    expect(vitalsNotes(v).find((n) => n.area === "legs")!.level).toBe("ok")
  })

  it("flags a fully seated day", () => {
    const v = vitalsForDay(day("2026-09-08", { sittingMinutes: 240, longestSitStretch: 60 }), CADENCE)
    expect(vitalsNotes(v).find((n) => n.area === "balance")!.level).toBe("watch")
  })

  it("never asserts anything clinical", () => {
    const v = vitalsForDay(day("2026-09-08", { sittingMinutes: 300, longestSitStretch: 300 }), CADENCE)
    const all = vitalsNotes(v).map((n) => n.text).join(" ").toLowerCase()
    for (const word of ["risk", "injury", "damage", "diagnos", "should see", "unhealthy"]) {
      expect(all).not.toContain(word)
    }
  })
})
