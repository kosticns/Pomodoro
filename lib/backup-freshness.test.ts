import { describe, it, expect } from "vitest"
import {
  BACKUP_OVERDUE_DAYS,
  BACKUP_STALE_DAYS,
  backupFreshness,
  backupWarning,
  daysBetween,
  isBackupUrgent,
} from "./backup-freshness"

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-09-01", "2026-09-08")).toBe(7)
    expect(daysBetween("2026-09-01", "2026-09-02")).toBe(1)
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0)
  })

  it("counts across a month boundary", () => {
    expect(daysBetween("2026-08-30", "2026-09-02")).toBe(3)
  })

  it("counts across a daylight-saving change", () => {
    // Europe/Belgrade springs forward on 29 March 2026. Rounding rather than
    // flooring is what keeps this a whole number of days.
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2)
  })

  it("clamps a backwards range to zero rather than returning a negative", () => {
    expect(daysBetween("2026-09-08", "2026-09-01")).toBe(0)
  })

  it("returns zero for missing or unparseable dates", () => {
    expect(daysBetween("", "2026-09-08")).toBe(0)
    expect(daysBetween("2026-09-01", "")).toBe(0)
    expect(daysBetween("not-a-date", "2026-09-08")).toBe(0)
  })
})

describe("backupFreshness", () => {
  it("is never when nothing was ever exported", () => {
    // Every existing install is this case until the first export.
    expect(backupFreshness("", "2026-09-14")).toBe("never")
  })

  it("is fresh inside the window", () => {
    expect(backupFreshness("2026-09-14", "2026-09-14")).toBe("fresh")
    expect(backupFreshness("2026-09-08", "2026-09-14")).toBe("fresh")
  })

  it("turns stale exactly on the threshold, not a day later", () => {
    expect(backupFreshness("2026-09-07", "2026-09-14")).toBe("stale")
    expect(BACKUP_STALE_DAYS).toBe(7)
  })

  it("turns overdue exactly on its threshold", () => {
    expect(backupFreshness("2026-08-24", "2026-09-14")).toBe("overdue")
    expect(BACKUP_OVERDUE_DAYS).toBe(21)
  })

  it("stays overdue well past the threshold", () => {
    expect(backupFreshness("2025-01-01", "2026-09-14")).toBe("overdue")
  })
})

describe("backupWarning", () => {
  it("says nothing when the backup is fresh", () => {
    // A warning that is always on screen stops being a warning.
    expect(backupWarning("2026-09-14", "2026-09-14")).toBeNull()
  })

  it("distinguishes never from stale, because the fix differs", () => {
    expect(backupWarning("", "2026-09-14")).toMatch(/never/i)
    expect(backupWarning("2026-09-01", "2026-09-14")).toMatch(/13 days ago/)
  })

  it("always states the consequence, not just the elapsed time", () => {
    for (const last of ["", "2026-09-01", "2025-01-01"]) {
      expect(backupWarning(last, "2026-09-14")).toMatch(/this browser only/i)
    }
  })
})

describe("isBackupUrgent", () => {
  it("is calm while fresh or merely stale", () => {
    expect(isBackupUrgent("2026-09-14", "2026-09-14")).toBe(false)
    expect(isBackupUrgent("2026-09-05", "2026-09-14")).toBe(false)
  })

  it("is urgent when overdue or never taken", () => {
    expect(isBackupUrgent("2026-08-01", "2026-09-14")).toBe(true)
    expect(isBackupUrgent("", "2026-09-14")).toBe(true)
  })
})
