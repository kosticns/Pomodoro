import type { DailyStat, Priority, Project, Task, TriageDecisionLike } from "./types"

/**
 * The end-of-day post mortem.
 *
 * When the workday timer runs out, the app asks about every task you actually
 * touched that day and records what you said. The morning wizard decides what
 * to do; this one records what happened, which is the half the app was missing:
 * stats knew how many pomodoros you ran and nothing knew what came of them.
 *
 * The record is kept so it goes out with the next morning's backup.
 *
 * Names are denormalised into the record on purpose. A review is a historical
 * statement about a day, and deleting a task next week must not make last
 * week's post mortem unreadable. Ids are kept too, for anything that wants to
 * follow the link while it still exists.
 */

export interface DayReviewEntry {
  taskId: string
  taskName: string
  projectId: string
  projectName: string
  /** What was decided about the task at the end of the day. */
  decision: TriageDecisionLike
  priority: Priority
  /** Pomodoros completed on this task that day, where known. */
  pomodoros: number
}

export interface DayReview {
  date: string
  completedAt: number
  entries: DayReviewEntry[]
  /** Copied from the day's stat so the record stands alone. */
  totalPomodoros: number
  workdayMinutes: number
}

/**
 * The tasks to ask about: everything worked on today.
 *
 * Two sources, deliberately unioned. `stat.tasksWorked` is the accurate record
 * but only exists from the day this shipped, and `lastInteractionTime` covers
 * a task that was touched today without completing a pomodoro on it. Either
 * alone would miss real work.
 *
 * `dayStart` is passed in rather than computed, for the same reason every other
 * date in this app is: reading the clock inside a function that renders makes
 * the result depend on when React happened to run it.
 */
export function tasksTouchedToday(
  tasks: Task[],
  stat: Pick<DailyStat, "tasksWorked"> | undefined,
  dayStart: number,
): Task[] {
  const recorded = new Set(stat?.tasksWorked ?? [])
  return tasks
    .filter((t) => recorded.has(t.id) || (t.lastInteractionTime ?? 0) >= dayStart)
    .slice()
    .sort((a, b) => (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0))
}

/** Adds a task to the day's worked list without duplicating it. */
export function recordTaskWorked(existing: string[] | undefined, taskId: string): string[] {
  const list = existing ?? []
  return list.includes(taskId) ? list : [...list, taskId]
}

export function findDayReview(reviews: DayReview[], date: string): DayReview | undefined {
  return reviews.find((r) => r.date === date)
}

/**
 * Should the post mortem open?
 *
 * Only once the workday is actually complete, only once per day, and only when
 * there is something to review. A post mortem on a day you did no work is an
 * empty form, and one that reopens after you finished it is worse than none.
 */
export function shouldPromptDayReview(args: {
  workdayCompleted: boolean
  alreadyReviewed: boolean
  touchedCount: number
}): boolean {
  return args.workdayCompleted && !args.alreadyReviewed && args.touchedCount > 0
}

/** Assembles the record from what the wizard collected. */
export function buildDayReview(args: {
  date: string
  queue: Task[]
  decisions: Record<string, TriageDecisionLike>
  priorities: Record<string, Priority>
  projects: Project[]
  stat: Pick<DailyStat, "totalPomodoros" | "workdayTimeSpent" | "taskPomodoros"> | undefined
  completedAt: number
}): DayReview {
  const { date, queue, decisions, priorities, projects, stat, completedAt } = args
  const perTask = stat?.taskPomodoros ?? {}

  return {
    date,
    completedAt,
    totalPomodoros: stat?.totalPomodoros ?? 0,
    workdayMinutes: stat?.workdayTimeSpent ?? 0,
    // Only tasks that were actually answered. A queue the user closed halfway
    // through records what they said, not a row of blanks.
    entries: queue
      .filter((t) => decisions[t.id])
      .map((t) => ({
        taskId: t.id,
        taskName: t.name,
        projectId: t.projectId,
        projectName: projects.find((p) => p.id === t.projectId)?.name ?? "No project",
        decision: decisions[t.id],
        priority: priorities[t.id] ?? "Medium",
        pomodoros: perTask[t.id] ?? 0,
      })),
  }
}

/** Replaces the review for that date, or appends it. One per day. */
export function upsertDayReview(reviews: DayReview[], review: DayReview): DayReview[] {
  const without = reviews.filter((r) => r.date !== review.date)
  return [...without, review].sort((a, b) => a.date.localeCompare(b.date))
}
