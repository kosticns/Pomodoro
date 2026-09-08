import type { DailyStat, Settings } from "./types"
import { standingCadenceOf } from "./posture"

/**
 * Vitals: what sitting and standing actually looked like.
 *
 * DELIBERATELY DESCRIPTIVE. Every number here is something the app recorded,
 * or arithmetic on it. There is no strain score, because a score would imply a
 * clinical measurement this app cannot make.
 *
 * Thresholds come from the user's own cadence setting rather than from any
 * external health guidance. If the cadence is 90 minutes, then a 150-minute
 * unbroken sit is reported as exceeding their own target by 60 minutes. That
 * is a claim the app can actually stand behind.
 *
 * Terminology: a "stretch" is one unbroken period in a single posture. The
 * stretch in progress right now is the "open" stretch, and it is not yet
 * recorded in DailyStat, so callers pass it in for today's view.
 */

/**
 * Minutes as "4h 55m" / "45m". Exported so the notes below and the UI cannot
 * drift apart; they previously rendered the same value as "1h 05m" and
 * "1h 5m" in the same card.
 */
export function formatMinutes(m: number): string {
  if (m <= 0) return "0m"
  const h = Math.floor(m / 60)
  const mins = m % 60
  return h > 0 ? `${h}h ${mins.toString().padStart(2, "0")}m` : `${mins}m`
}

export interface OpenStretch {
  posture: "sitting" | "standing"
  minutes: number
}

export interface Vitals {
  sittingMinutes: number
  standingMinutes: number
  totalTrackedMinutes: number
  /** Standing as a percentage of tracked time. 0 when nothing is tracked. */
  standingSharePct: number
  postureSwitches: number
  longestSitStretch: number
  longestStandStretch: number
  /** The cadence this day is judged against, in minutes. */
  cadenceTarget: number
  /** Minutes by which the longest sit exceeded the target. 0 when within it. */
  sitOverrunMinutes: number
  /** Minutes by which the longest stand exceeded the target. 0 when within it. */
  standOverrunMinutes: number
  /** True when nothing has been recorded, so the UI can show an empty state. */
  isEmpty: boolean
}

const num = (v: number | undefined) => v || 0

/**
 * Vitals for one day.
 *
 * Pass `open` only for today. Including it for a past day would double count,
 * since that stretch was closed and recorded when the posture last changed.
 */
export function vitalsForDay(
  stat: DailyStat | undefined,
  settings: Pick<Settings, "standingCadence">,
  open?: OpenStretch,
): Vitals {
  const cadenceTarget = standingCadenceOf(settings)

  let sittingMinutes = num(stat?.sittingMinutes)
  let standingMinutes = num(stat?.standingMinutes)
  let longestSitStretch = num(stat?.longestSitStretch)
  let longestStandStretch = num(stat?.longestStandStretch)

  if (open && open.minutes > 0) {
    if (open.posture === "sitting") {
      sittingMinutes += open.minutes
      longestSitStretch = Math.max(longestSitStretch, open.minutes)
    } else {
      standingMinutes += open.minutes
      longestStandStretch = Math.max(longestStandStretch, open.minutes)
    }
  }

  const totalTrackedMinutes = sittingMinutes + standingMinutes

  return {
    sittingMinutes,
    standingMinutes,
    totalTrackedMinutes,
    standingSharePct:
      totalTrackedMinutes > 0 ? Math.round((standingMinutes / totalTrackedMinutes) * 100) : 0,
    postureSwitches: num(stat?.postureSwitches),
    longestSitStretch,
    longestStandStretch,
    cadenceTarget,
    sitOverrunMinutes: Math.max(0, longestSitStretch - cadenceTarget),
    standOverrunMinutes: Math.max(0, longestStandStretch - cadenceTarget),
    isEmpty: totalTrackedMinutes === 0 && num(stat?.postureSwitches) === 0,
  }
}

/** Sums vitals across a period. Never include an open stretch here. */
export function vitalsForPeriod(
  stats: DailyStat[],
  settings: Pick<Settings, "standingCadence">,
): Vitals {
  const cadenceTarget = standingCadenceOf(settings)

  const sittingMinutes = stats.reduce((t, s) => t + num(s.sittingMinutes), 0)
  const standingMinutes = stats.reduce((t, s) => t + num(s.standingMinutes), 0)
  const postureSwitches = stats.reduce((t, s) => t + num(s.postureSwitches), 0)
  // Longest across a period is the worst single stretch, not a sum.
  const longestSitStretch = stats.reduce((m, s) => Math.max(m, num(s.longestSitStretch)), 0)
  const longestStandStretch = stats.reduce((m, s) => Math.max(m, num(s.longestStandStretch)), 0)
  const totalTrackedMinutes = sittingMinutes + standingMinutes

  return {
    sittingMinutes,
    standingMinutes,
    totalTrackedMinutes,
    standingSharePct:
      totalTrackedMinutes > 0 ? Math.round((standingMinutes / totalTrackedMinutes) * 100) : 0,
    postureSwitches,
    longestSitStretch,
    longestStandStretch,
    cadenceTarget,
    sitOverrunMinutes: Math.max(0, longestSitStretch - cadenceTarget),
    standOverrunMinutes: Math.max(0, longestStandStretch - cadenceTarget),
    isEmpty: totalTrackedMinutes === 0 && postureSwitches === 0,
  }
}

export interface VitalsNote {
  /** What the note is about, so the UI can pick an icon. */
  area: "lower-back" | "legs" | "balance" | "movement"
  /** "ok" reads as reassurance, "watch" as something to act on. */
  level: "ok" | "watch"
  text: string
}

/**
 * Plain-language readings of a day or period.
 *
 * Each note states the recorded number and the target it is being compared
 * against, so nothing is asserted that the user cannot check. Sitting maps to
 * lower back and standing to legs, which is the framing Mickey asked for, but
 * the wording stays observational rather than diagnostic.
 */
export function vitalsNotes(v: Vitals): VitalsNote[] {
  if (v.isEmpty) return []
  const notes: VitalsNote[] = []
  const hm = formatMinutes

  if (v.sitOverrunMinutes > 0) {
    notes.push({
      area: "lower-back",
      level: "watch",
      text: `Longest unbroken sit was ${hm(v.longestSitStretch)}, ${hm(v.sitOverrunMinutes)} past your ${v.cadenceTarget}m target. Long sits load the lower back.`,
    })
  } else if (v.sittingMinutes > 0) {
    notes.push({
      area: "lower-back",
      level: "ok",
      text: `No sit ran longer than your ${v.cadenceTarget}m target. Longest was ${hm(v.longestSitStretch)}.`,
    })
  }

  if (v.standOverrunMinutes > 0) {
    notes.push({
      area: "legs",
      level: "watch",
      text: `Longest unbroken stand was ${hm(v.longestStandStretch)}, ${hm(v.standOverrunMinutes)} past your ${v.cadenceTarget}m target. Long stands load the legs and feet.`,
    })
  } else if (v.standingMinutes > 0) {
    notes.push({
      area: "legs",
      level: "ok",
      text: `No stand ran longer than your ${v.cadenceTarget}m target. Longest was ${hm(v.longestStandStretch)}.`,
    })
  }

  if (v.standingMinutes === 0 && v.sittingMinutes > 0) {
    notes.push({
      area: "balance",
      level: "watch",
      text: `All ${hm(v.sittingMinutes)} of tracked time was seated, with no standing recorded.`,
    })
  } else if (v.totalTrackedMinutes > 0) {
    notes.push({
      area: "balance",
      level: "ok",
      text: `${v.standingSharePct}% of tracked time was standing, ${hm(v.standingMinutes)} of ${hm(v.totalTrackedMinutes)}.`,
    })
  }

  notes.push({
    area: "movement",
    level: v.postureSwitches === 0 ? "watch" : "ok",
    text:
      v.postureSwitches === 0
        ? "No posture changes recorded."
        : `${v.postureSwitches} posture ${v.postureSwitches === 1 ? "change" : "changes"} recorded.`,
  })

  return notes
}
