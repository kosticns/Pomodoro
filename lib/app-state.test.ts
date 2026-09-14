import { describe, it, expect } from "vitest"
import { migrateStats } from "./app-state"

/**
 * migrateStats rebuilds every stat from an explicit field list and runs on
 * every mount, so a field missing from that list is erased from storage on the
 * next load. That is exactly what happened to tasksWorked and taskPomodoros on
 * 14 Sep 2026: they were written correctly and gone by the next render.
 */
describe("migrateStats", () => {
  const full = {
    date: "2026-09-14",
    totalPomodoros: 9,
    timeSpent: 225,
    workdayStarted: true,
    workdayCompleted: true,
    workdayTimeSpent: 480,
    shortBreakTime: 30,
    longBreakTime: 15,
    shortBreakCount: 6,
    longBreakCount: 1,
    shortBreaksSkipped: 2,
    longBreaksSkipped: 0,
    accumulatedBreakTime: 10,
    dayStartTime: 1_700_000_000_000,
    projectsWorked: ["p1"],
    projectPomodoros: { p1: 9 },
    tasksWorked: ["t1", "t2"],
    taskPomodoros: { t1: 6, t2: 3 },
    sittingMinutes: 300,
    standingMinutes: 150,
    postureSwitches: 4,
    longestSitStretch: 120,
    longestStandStretch: 60,
  }

  it("preserves every field it is given", () => {
    // A round trip must not lose anything, or the next mount erases it.
    expect(migrateStats([full])[0]).toEqual(full)
  })

  it("keeps the per-task records the post mortem depends on", () => {
    const out = migrateStats([full])[0]
    expect(out.tasksWorked).toEqual(["t1", "t2"])
    expect(out.taskPomodoros).toEqual({ t1: 6, t2: 3 })
  })

  it("is idempotent, since it runs on every mount", () => {
    expect(migrateStats(migrateStats([full]))[0]).toEqual(full)
  })

  it("fills a day recorded before the per-task fields existed", () => {
    const { tasksWorked, taskPomodoros, ...old } = full
    const out = migrateStats([old])[0]
    expect(out.tasksWorked).toEqual([])
    expect(out.taskPomodoros).toBeUndefined()
  })

  it("fills posture fields with 0 rather than undefined", () => {
    const { sittingMinutes, standingMinutes, ...old } = full
    const out = migrateStats([old])[0]
    expect(out.sittingMinutes).toBe(0)
    expect(out.standingMinutes).toBe(0)
  })
})
