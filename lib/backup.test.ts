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
      { id: "t1", name: "Write docs", projectId: "p1", completedPomodoros: 3, status: "In Progress" },
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
    expect(BACKUP_VERSION).toBe("1.5")
  })

  it("carries project priority, so it survives a backup and restore", () => {
    const withPriority = payload({
      projects: [
        { id: "p1", name: "Urgent thing", status: "Ongoing", createdAt: 1, lastInteractionTime: 1, priority: "Urgent" },
      ],
    })
    expect(JSON.parse(buildBackupJSON(withPriority, AT)).projects[0].priority).toBe("Urgent")
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

  it("has a section per data type, including notes and day reviews", () => {
    for (const section of ["=== PROJECTS ===", "=== TASKS ===", "=== DAILY STATS ===", "=== DAY REVIEWS ===", "=== NOTES ==="]) {
      expect(csv()).toContain(section)
    }
  })

  it("gives projects a Priority column, which the named columns would drop", () => {
    const lines = csv().split("\n")
    const header = lines[lines.indexOf("=== PROJECTS ===") + 1]
    expect(header).toBe("ID,Name,Status,Priority,Created At")
  })

  it("writes the resolved priority, so a project saved before the field reads as Medium", () => {
    const lines = csv().split("\n")
    const row = lines[lines.indexOf("=== PROJECTS ===") + 2]
    expect(row.split(",")[3]).toBe("Medium")
  })

  it("writes a set priority through", () => {
    const withPriority = buildBackupCSV(
      payload({
        projects: [
          { id: "p1", name: "Thing", status: "Ongoing", createdAt: 1, lastInteractionTime: 1, priority: "Urgent" },
        ],
      }),
      AT,
    )
    const lines = withPriority.split("\n")
    expect(lines[lines.indexOf("=== PROJECTS ===") + 2].split(",")[3]).toBe("Urgent")
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

describe("day reviews in the backup", () => {
  const review = {
    date: "2026-09-14",
    completedAt: Date.parse("2026-09-14T18:00:00.000Z"),
    totalPomodoros: 9,
    workdayMinutes: 480,
    entries: [
      { taskId: "t1", taskName: "Write docs", projectId: "p1", projectName: "Neusatz Archive",
        decision: "done" as const, priority: "High" as const, pomodoros: 6 },
    ],
  }

  it("carries the reviews in the JSON, which is the point of recording them", () => {
    const j = JSON.parse(buildBackupJSON(payload({ dayReviews: [review] }), AT))
    expect(j.dayReviews).toHaveLength(1)
    expect(j.dayReviews[0].entries[0].taskName).toBe("Write docs")
  })

  it("exports an empty array rather than omitting the key", () => {
    expect(JSON.parse(buildBackupJSON(payload(), AT)).dayReviews).toEqual([])
  })

  it("writes one CSV row per reviewed task", () => {
    const lines = buildBackupCSV(payload({ dayReviews: [review] }), AT).split("\n")
    const header = lines[lines.indexOf("=== DAY REVIEWS ===") + 1]
    expect(header).toBe("Date,Task,Project,Decision,Priority,Pomodoros,Reviewed At")
    expect(lines[lines.indexOf("=== DAY REVIEWS ===") + 2]).toContain('"Write docs"')
  })

  it("escapes a comma in a task name rather than shifting columns", () => {
    const withComma = { ...review, entries: [{ ...review.entries[0], taskName: "Docs, phase 2" }] }
    expect(buildBackupCSV(payload({ dayReviews: [withComma] }), AT)).toContain('"Docs, phase 2"')
  })
})
