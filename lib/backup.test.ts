import { describe, it, expect } from "vitest"
import { buildBackupJSON, buildBackupCSV, backupFilename, BACKUP_VERSION } from "./backup"
import { emptyDailyStat } from "./daily-stat"
import { DEFAULT_SETTINGS } from "./app-state"
import type { BackupPayload } from "./backup"

const AT = new Date("2026-09-08T12:00:00.000Z")

function payload(over: Partial<BackupPayload> = {}): BackupPayload {
  return {
    settings: DEFAULT_SETTINGS,
    projects: [
      { id: "p1", name: "Neusatz Archive", status: "Ongoing", createdAt: 1_700_000_000_000, lastInteractionTime: 1_700_000_000_000 },
    ],
    tasks: [
      { id: "t1", name: "Write docs", projectId: "p1", completedPomodoros: 3, status: "In Progress", estimatedPomodoros: 5 },
    ],
    stats: [
      {
        ...emptyDailyStat("2026-09-08"),
        totalPomodoros: 6,
        timeSpent: 150,
        sittingMinutes: 295,
        standingMinutes: 125,
        postureSwitches: 4,
        longestSitStretch: 155,
        longestStandStretch: 70,
      },
    ],
    notes: [{ id: "n1", content: "A note", createdAt: 1_700_000_000_000, taskId: "t1", projectId: "p1" }],
    ...over,
  }
}

describe("buildBackupJSON", () => {
  it("includes notes, which version 1.0 omitted while the restore path read them", () => {
    const j = JSON.parse(buildBackupJSON(payload(), AT))
    expect(j.notes).toHaveLength(1)
    expect(j.notes[0].content).toBe("A note")
  })

  it("declares the current version", () => {
    expect(JSON.parse(buildBackupJSON(payload(), AT)).version).toBe(BACKUP_VERSION)
    expect(BACKUP_VERSION).toBe("1.1")
  })

  it("carries the posture fields so Vitals survive a backup", () => {
    const s = JSON.parse(buildBackupJSON(payload(), AT)).stats[0]
    expect(s.sittingMinutes).toBe(295)
    expect(s.standingMinutes).toBe(125)
    expect(s.postureSwitches).toBe(4)
    expect(s.longestSitStretch).toBe(155)
    expect(s.longestStandStretch).toBe(70)
  })

  it("survives a round trip through the restore-side validation", () => {
    // mobile-settings-panel rejects a file lacking any of these three.
    const j = JSON.parse(buildBackupJSON(payload(), AT))
    expect(j.projects && j.tasks && j.stats).toBeTruthy()
  })

  it("exports empty collections rather than omitting them", () => {
    const j = JSON.parse(buildBackupJSON(payload({ notes: [], tasks: [], stats: [] }), AT))
    expect(j.notes).toEqual([])
    expect(j.stats).toEqual([])
  })
})

describe("buildBackupCSV", () => {
  const csv = () => buildBackupCSV(payload(), AT)

  it("has a section per data type, including notes", () => {
    for (const section of ["=== PROJECTS ===", "=== TASKS ===", "=== DAILY STATS ===", "=== NOTES ==="]) {
      expect(csv()).toContain(section)
    }
  })

  it("carries the six Vitals columns per day", () => {
    const header = csv().split("\n").find((l) => l.startsWith("Date,Total Pomodoros"))!
    for (const col of [
      "Sitting (min)",
      "Standing (min)",
      "Standing Share (%)",
      "Posture Switches",
      "Longest Sit (min)",
      "Longest Stand (min)",
    ]) {
      expect(header).toContain(col)
    }
  })

  it("writes the recorded posture numbers and the derived share", () => {
    const row = csv().split("\n").find((l) => l.startsWith("2026-09-08"))!
    // 125 standing of 420 tracked is 30%
    expect(row).toContain("295,125,30,4,155,70")
  })

  it("escapes quotes in free text rather than breaking the row", () => {
    const out = buildBackupCSV(
      payload({ notes: [{ id: "n1", content: 'He said "hello"', createdAt: 1, taskId: "t", projectId: "p" }] }),
      AT,
    )
    expect(out).toContain('"He said ""hello"""')
  })

  it("handles a comma in a project name without shifting columns", () => {
    const out = buildBackupCSV(
      payload({ projects: [{ id: "p1", name: "Archive, phase 2", status: "Ongoing", createdAt: 1, lastInteractionTime: 1 }] }),
      AT,
    )
    expect(out).toContain('"Archive, phase 2"')
  })

  it("records the version, so an old file can be identified later", () => {
    expect(csv()).toContain(`Version,${BACKUP_VERSION}`)
  })
})

describe("backupFilename", () => {
  it("names the file by kind and date", () => {
    expect(backupFilename("json", "2026-09-08")).toBe("pomodoro-backup-2026-09-08.json")
    expect(backupFilename("csv", "2026-09-08")).toBe("pomodoro-backup-2026-09-08.csv")
  })
})
