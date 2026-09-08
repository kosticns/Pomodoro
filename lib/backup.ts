import type { DailyStat, Note, Project, Settings, Task } from "./types"
import { vitalsForDay } from "./vitals"

/**
 * Backup building, in one place.
 *
 * This existed twice: once in app/page.tsx for the Daily Backup modal and once
 * in components/settings/mobile-settings-panel.tsx for the Settings buttons.
 * The two drifted, so the same app exported two different shapes depending on
 * which button you pressed, and a fix applied to one silently missed the
 * other. Both now call these functions.
 *
 * Pure by design: builds strings, performs no download and touches no DOM, so
 * it can be tested.
 */

export interface BackupPayload {
  settings: Settings
  projects: Project[]
  tasks: Task[]
  stats: DailyStat[]
  notes: Note[]
}

/** Current backup format. 1.1 added notes and the posture fields. */
export const BACKUP_VERSION = "1.1"

export function buildBackupJSON(payload: BackupPayload, now: Date = new Date()): string {
  return JSON.stringify(
    {
      exportDate: now.toISOString(),
      version: BACKUP_VERSION,
      settings: payload.settings,
      projects: payload.projects,
      tasks: payload.tasks,
      stats: payload.stats,
      // Notes were absent from version 1.0 while the restore path already read
      // them, so notes could never survive a backup round trip.
      notes: payload.notes,
    },
    null,
    2,
  )
}

/** Escapes a value for a CSV field and wraps it in quotes. */
function csvQuote(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

export function buildBackupCSV(payload: BackupPayload, now: Date = new Date()): string {
  const { settings, projects, tasks, stats, notes } = payload
  const lines: string[] = []

  lines.push("=== POMODORO BACKUP ===")
  lines.push(`Export Date,${now.toISOString()}`)
  lines.push(`Version,${BACKUP_VERSION}`)
  lines.push("")

  lines.push("=== PROJECTS ===")
  lines.push("ID,Name,Status,Created At")
  for (const p of projects) {
    lines.push(`${p.id},${csvQuote(p.name)},${p.status},${new Date(p.createdAt).toISOString()}`)
  }
  lines.push("")

  lines.push("=== TASKS ===")
  lines.push("ID,Name,Project ID,Status,Completed Pomodoros,Estimated Pomodoros")
  for (const t of tasks) {
    lines.push(
      `${t.id},${csvQuote(t.name)},${t.projectId},${t.status},${t.completedPomodoros},${t.estimatedPomodoros || 0}`,
    )
  }
  lines.push("")

  lines.push("=== DAILY STATS ===")
  lines.push(
    [
      "Date",
      "Total Pomodoros",
      "Time Spent (min)",
      "Short Breaks",
      "Long Breaks",
      "Workday Completed",
      // Vitals. Raw recorded values plus the one derived figure that is
      // awkward to recompute in a spreadsheet.
      "Sitting (min)",
      "Standing (min)",
      "Standing Share (%)",
      "Posture Switches",
      "Longest Sit (min)",
      "Longest Stand (min)",
    ].join(","),
  )
  for (const s of stats) {
    // No open stretch: a backup records what was committed, never a stretch
    // still in progress.
    const v = vitalsForDay(s, settings)
    lines.push(
      [
        s.date,
        s.totalPomodoros,
        s.timeSpent,
        s.shortBreakCount,
        s.longBreakCount,
        s.workdayCompleted,
        v.sittingMinutes,
        v.standingMinutes,
        v.standingSharePct,
        v.postureSwitches,
        v.longestSitStretch,
        v.longestStandStretch,
      ].join(","),
    )
  }
  lines.push("")

  lines.push("=== NOTES ===")
  lines.push("ID,Created At,Task ID,Project ID,Content")
  for (const n of notes) {
    lines.push(
      `${n.id},${new Date(n.createdAt).toISOString()},${n.taskId},${n.projectId},${csvQuote(n.content)}`,
    )
  }

  return lines.join("\n") + "\n"
}

export function backupFilename(kind: "json" | "csv", dateStr: string): string {
  return `pomodoro-backup-${dateStr}.${kind}`
}
