import type { DailyStat } from "./types"

/**
 * A zeroed stat record for one date.
 *
 * Exists because DailyStat has many required fields and the app builds it
 * inline in several places, which is how fields added later ended up missing
 * from some paths. New code should start from here.
 */
export function emptyDailyStat(date: string): DailyStat {
  return {
    date,
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
    sittingMinutes: 0,
    standingMinutes: 0,
    postureSwitches: 0,
    longestSitStretch: 0,
    longestStandStretch: 0,
  }
}

/**
 * Add a finished posture stretch to a day's record.
 *
 * Called when a posture ENDS, so the value is a completed stretch. Creates the
 * day if it does not exist yet, because posture can be tracked before the
 * first pomodoro of the day completes.
 *
 * Pure so it can be tested and so the caller can use the functional setState
 * form. A stretch of 0 minutes is ignored rather than counted as a switch,
 * which stops a double tap on the posture control inflating the switch count.
 */
export function recordPostureHeld(
  stats: DailyStat[],
  date: string,
  posture: "sitting" | "standing",
  minutes: number,
): DailyStat[] {
  if (minutes <= 0) return stats

  const apply = (s: DailyStat): DailyStat =>
    posture === "sitting"
      ? {
          ...s,
          sittingMinutes: (s.sittingMinutes || 0) + minutes,
          longestSitStretch: Math.max(s.longestSitStretch || 0, minutes),
          postureSwitches: (s.postureSwitches || 0) + 1,
        }
      : {
          ...s,
          standingMinutes: (s.standingMinutes || 0) + minutes,
          longestStandStretch: Math.max(s.longestStandStretch || 0, minutes),
          postureSwitches: (s.postureSwitches || 0) + 1,
        }

  const existing = stats.findIndex((s) => s.date === date)
  if (existing === -1) return [...stats, apply(emptyDailyStat(date))]
  return stats.map((s, i) => (i === existing ? apply(s) : s))
}
