import { describe, it, expect } from "vitest"
import {
  buildDayReview,
  findDayReview,
  recordTaskWorked,
  shouldPromptDayReview,
  tasksTouchedToday,
  upsertDayReview,
  type DayReview,
} from "./day-review"
import type { DailyStat, Project, Task } from "./types"

const DAY_START = new Date("2026-09-14T00:00:00").getTime()
const MORNING = DAY_START + 9 * 3_600_000
const YESTERDAY = DAY_START - 5 * 3_600_000

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    name: `Task ${id}`,
    projectId: "p1",
    completedPomodoros: 0,
    status: "In Progress",
    lastInteractionTime: 0,
    ...over,
  }
}

function project(id: string, name: string): Project {
  return { id, name, status: "Ongoing", createdAt: 0, lastInteractionTime: 0 }
}

function stat(over: Partial<DailyStat> = {}): DailyStat {
  return {
    date: "2026-09-14",
    totalPomodoros: 0,
    timeSpent: 0,
    workdayStarted: true,
    workdayCompleted: false,
    workdayTimeSpent: 0,
    shortBreakTime: 0,
    longBreakTime: 0,
    shortBreakCount: 0,
    longBreakCount: 0,
    shortBreaksSkipped: 0,
    longBreaksSkipped: 0,
    accumulatedBreakTime: 0,
    dayStartTime: DAY_START,
    ...over,
  }
}

describe("tasksTouchedToday", () => {
  it("includes a task recorded as worked on today", () => {
    const tasks = [task("a"), task("b")]
    const s = stat({ tasksWorked: ["a"] })
    expect(tasksTouchedToday(tasks, s, DAY_START).map((t) => t.id)).toEqual(["a"])
  })

  it("includes a task touched today that completed no pomodoro", () => {
    // Renaming or re-prioritising a task is still touching it, and the record
    // only counts completed focus sessions.
    const tasks = [task("a", { lastInteractionTime: MORNING })]
    expect(tasksTouchedToday(tasks, stat(), DAY_START).map((t) => t.id)).toEqual(["a"])
  })

  it("unions the two sources without duplicating", () => {
    const tasks = [task("a", { lastInteractionTime: MORNING }), task("b")]
    const s = stat({ tasksWorked: ["a", "b"] })
    expect(tasksTouchedToday(tasks, s, DAY_START).map((t) => t.id).sort()).toEqual(["a", "b"])
  })

  it("leaves out a task last touched yesterday", () => {
    const tasks = [task("old", { lastInteractionTime: YESTERDAY })]
    expect(tasksTouchedToday(tasks, stat(), DAY_START)).toEqual([])
  })

  it("includes a task touched exactly at the day boundary", () => {
    const tasks = [task("edge", { lastInteractionTime: DAY_START })]
    expect(tasksTouchedToday(tasks, stat(), DAY_START).map((t) => t.id)).toEqual(["edge"])
  })

  it("works on a day recorded before tasksWorked existed", () => {
    // Every stat before 14 Sep 2026 is this case.
    const tasks = [task("a", { lastInteractionTime: MORNING })]
    expect(tasksTouchedToday(tasks, undefined, DAY_START).map((t) => t.id)).toEqual(["a"])
  })

  it("includes finished tasks, because finishing one is the day's main event", () => {
    const tasks = [task("done", { status: "Done", lastInteractionTime: MORNING })]
    expect(tasksTouchedToday(tasks, stat(), DAY_START).map((t) => t.id)).toEqual(["done"])
  })

  it("puts the most recently touched first", () => {
    const tasks = [
      task("early", { lastInteractionTime: DAY_START + 1000 }),
      task("late", { lastInteractionTime: MORNING }),
    ]
    expect(tasksTouchedToday(tasks, stat(), DAY_START).map((t) => t.id)).toEqual(["late", "early"])
  })

  it("does not mutate the array it was given", () => {
    const tasks = [task("a", { lastInteractionTime: 1 }), task("b", { lastInteractionTime: MORNING })]
    tasksTouchedToday(tasks, stat(), DAY_START)
    expect(tasks.map((t) => t.id)).toEqual(["a", "b"])
  })
})

describe("recordTaskWorked", () => {
  it("adds a task", () => {
    expect(recordTaskWorked(undefined, "a")).toEqual(["a"])
    expect(recordTaskWorked(["a"], "b")).toEqual(["a", "b"])
  })

  it("does not duplicate on the second pomodoro of the same task", () => {
    expect(recordTaskWorked(["a"], "a")).toEqual(["a"])
  })

  it("does not mutate", () => {
    const list = ["a"]
    recordTaskWorked(list, "b")
    expect(list).toEqual(["a"])
  })
})

describe("shouldPromptDayReview", () => {
  it("prompts once the workday is complete and there is work to review", () => {
    expect(
      shouldPromptDayReview({ workdayCompleted: true, alreadyReviewed: false, touchedCount: 3 }),
    ).toBe(true)
  })

  it("stays quiet before the workday completes", () => {
    expect(
      shouldPromptDayReview({ workdayCompleted: false, alreadyReviewed: false, touchedCount: 3 }),
    ).toBe(false)
  })

  it("does not reopen once the day has been reviewed", () => {
    // Reappearing after you finished it is worse than never appearing.
    expect(
      shouldPromptDayReview({ workdayCompleted: true, alreadyReviewed: true, touchedCount: 3 }),
    ).toBe(false)
  })

  it("does not open an empty form on a day with no work", () => {
    expect(
      shouldPromptDayReview({ workdayCompleted: true, alreadyReviewed: false, touchedCount: 0 }),
    ).toBe(false)
  })
})

describe("buildDayReview", () => {
  const projects = [project("p1", "Website rebuild")]
  const queue = [task("a", { name: "Rework the nav" }), task("b", { name: "Compress images" })]

  it("records what was decided, with the numbers from the day", () => {
    const r = buildDayReview({
      date: "2026-09-14",
      queue,
      decisions: { a: "done", b: "later" },
      priorities: { a: "High", b: "Low" },
      projects,
      stat: stat({ totalPomodoros: 9, workdayTimeSpent: 480, taskPomodoros: { a: 6, b: 3 } }),
      completedAt: MORNING,
    })
    expect(r.date).toBe("2026-09-14")
    expect(r.totalPomodoros).toBe(9)
    expect(r.workdayMinutes).toBe(480)
    expect(r.entries).toHaveLength(2)
    expect(r.entries[0]).toMatchObject({
      taskId: "a",
      taskName: "Rework the nav",
      projectName: "Website rebuild",
      decision: "done",
      priority: "High",
      pomodoros: 6,
    })
  })

  it("denormalises names, so the record survives deleting the task later", () => {
    // A review is a statement about a day. Deleting a task next week must not
    // make last week's post mortem unreadable.
    const r = buildDayReview({
      date: "2026-09-14", queue, decisions: { a: "done" }, priorities: {},
      projects, stat: stat(), completedAt: MORNING,
    })
    expect(r.entries[0].taskName).toBe("Rework the nav")
    expect(r.entries[0].projectName).toBe("Website rebuild")
  })

  it("only records tasks that were actually answered", () => {
    // Closing the wizard halfway records what was said, not a row of blanks.
    const r = buildDayReview({
      date: "2026-09-14", queue, decisions: { a: "done" }, priorities: {},
      projects, stat: stat(), completedAt: MORNING,
    })
    expect(r.entries.map((e) => e.taskId)).toEqual(["a"])
  })

  it("falls back to Medium when no priority was captured", () => {
    const r = buildDayReview({
      date: "2026-09-14", queue, decisions: { a: "done" }, priorities: {},
      projects, stat: stat(), completedAt: MORNING,
    })
    expect(r.entries[0].priority).toBe("Medium")
  })

  it("names a missing project rather than leaving it blank", () => {
    const r = buildDayReview({
      date: "2026-09-14", queue: [task("x", { projectId: "gone" })],
      decisions: { x: "done" }, priorities: {}, projects, stat: stat(), completedAt: MORNING,
    })
    expect(r.entries[0].projectName).toBe("No project")
  })

  it("reports zero pomodoros for a day with no per-task record", () => {
    const r = buildDayReview({
      date: "2026-09-14", queue, decisions: { a: "done" }, priorities: {},
      projects, stat: stat(), completedAt: MORNING,
    })
    expect(r.entries[0].pomodoros).toBe(0)
  })

  it("survives having no stat at all", () => {
    const r = buildDayReview({
      date: "2026-09-14", queue, decisions: { a: "done" }, priorities: {},
      projects, stat: undefined, completedAt: MORNING,
    })
    expect(r.totalPomodoros).toBe(0)
    expect(r.workdayMinutes).toBe(0)
  })
})

describe("upsertDayReview and findDayReview", () => {
  const base: DayReview = {
    date: "2026-09-14", completedAt: 1, entries: [], totalPomodoros: 5, workdayMinutes: 480,
  }

  it("appends a new day", () => {
    expect(upsertDayReview([], base)).toHaveLength(1)
  })

  it("replaces rather than duplicating the same day", () => {
    // One review per day; re-running it corrects the record.
    const redone = { ...base, totalPomodoros: 9 }
    const out = upsertDayReview([base], redone)
    expect(out).toHaveLength(1)
    expect(out[0].totalPomodoros).toBe(9)
  })

  it("keeps the list in date order", () => {
    const older = { ...base, date: "2026-09-10" }
    expect(upsertDayReview([base], older).map((r) => r.date)).toEqual(["2026-09-10", "2026-09-14"])
  })

  it("finds a day, and reports nothing for one never reviewed", () => {
    expect(findDayReview([base], "2026-09-14")).toBe(base)
    expect(findDayReview([base], "2026-09-13")).toBeUndefined()
  })
})
