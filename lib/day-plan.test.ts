import { describe, it, expect } from "vitest"
import {
  applyDecision,
  candidatesForToday,
  defaultChoice,
  initialDayPlanState,
  planPhase,
  recordDecision,
  shouldRunDayPlan,
  stepBack,
  triageQueue,
} from "./day-plan"
import type { Task } from "./types"

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    name: `Task ${id}`,
    projectId: "p1",
    completedPomodoros: 0,
    status: "To Do",
    lastInteractionTime: 0,
    ...over,
  }
}

describe("triageQueue", () => {
  it("leaves finished tasks out, because there is nothing to decide", () => {
    const tasks = [task("a"), task("b", { status: "Done" }), task("c", { status: "In Progress" })]
    expect(triageQueue(tasks).map((t) => t.id)).toEqual(["a", "c"])
  })

  it("puts the most recently touched task first", () => {
    const tasks = [
      task("old", { lastInteractionTime: 100 }),
      task("newest", { lastInteractionTime: 900 }),
      task("middle", { lastInteractionTime: 500 }),
    ]
    expect(triageQueue(tasks).map((t) => t.id)).toEqual(["newest", "middle", "old"])
  })

  it("handles a task that has never been touched", () => {
    // lastInteractionTime is optional on Task, so it can genuinely be absent.
    const tasks = [task("never", { lastInteractionTime: undefined }), task("used", { lastInteractionTime: 5 })]
    expect(triageQueue(tasks).map((t) => t.id)).toEqual(["used", "never"])
  })

  it("does not mutate the array it was given", () => {
    const tasks = [task("a", { lastInteractionTime: 1 }), task("b", { lastInteractionTime: 2 })]
    const order = tasks.map((t) => t.id)
    triageQueue(tasks)
    expect(tasks.map((t) => t.id)).toEqual(order)
  })

  it("is empty when everything is finished", () => {
    expect(triageQueue([task("a", { status: "Done" })])).toEqual([])
  })
})

describe("applyDecision", () => {
  const tasks = [task("a"), task("b", { status: "In Progress" })]

  it("marks a today task as in progress", () => {
    expect(applyDecision(tasks, "a", "today").find((t) => t.id === "a")!.status).toBe("In Progress")
  })

  it("parks a later task back to To Do", () => {
    expect(applyDecision(tasks, "b", "later").find((t) => t.id === "b")!.status).toBe("To Do")
  })

  it("completes a done task", () => {
    expect(applyDecision(tasks, "a", "done").find((t) => t.id === "a")!.status).toBe("Done")
  })

  it("changes nothing on skip, which is the whole point of skip", () => {
    expect(applyDecision(tasks, "b", "skip")).toBe(tasks)
  })

  it("touches only the named task", () => {
    const next = applyDecision(tasks, "a", "done")
    expect(next.find((t) => t.id === "b")!.status).toBe("In Progress")
  })

  it("does not mutate the original tasks", () => {
    applyDecision(tasks, "a", "done")
    expect(tasks.find((t) => t.id === "a")!.status).toBe("To Do")
  })
})

describe("planPhase", () => {
  it("triages while there are tasks left", () => {
    expect(planPhase({ index: 0, decisions: {}, chosenTaskId: null }, 3)).toBe("triage")
    expect(planPhase({ index: 2, decisions: {}, chosenTaskId: null }, 3)).toBe("triage")
  })

  it("moves to the pick step once the queue is walked", () => {
    expect(planPhase({ index: 3, decisions: {}, chosenTaskId: null }, 3)).toBe("pick")
  })

  it("reports empty when there is nothing to triage", () => {
    expect(planPhase(initialDayPlanState(), 0)).toBe("empty")
  })
})

describe("candidatesForToday", () => {
  const queue = [task("a"), task("b"), task("c")]

  it("offers only what was marked today", () => {
    const decisions = { a: "today", b: "later", c: "today" } as const
    expect(candidatesForToday(queue, decisions).map((t) => t.id)).toEqual(["a", "c"])
  })

  it("excludes a skipped task even when it is still in progress", () => {
    // The wizard exists to make this morning's choice. Yesterday's status is
    // not a vote.
    const inProgress = [task("a", { status: "In Progress" })]
    expect(candidatesForToday(inProgress, { a: "skip" })).toEqual([])
  })

  it("keeps the queue's order, so the pick list is not reshuffled", () => {
    const decisions = { a: "today", b: "today", c: "today" } as const
    expect(candidatesForToday(queue, decisions).map((t) => t.id)).toEqual(["a", "b", "c"])
  })

  it("is empty when everything was deferred", () => {
    expect(candidatesForToday(queue, { a: "later", b: "later", c: "done" })).toEqual([])
  })
})

describe("shouldRunDayPlan", () => {
  it("runs when there is unfinished work", () => {
    expect(shouldRunDayPlan([task("a")])).toBe(true)
  })

  it("stays out of the way when there is nothing to triage", () => {
    // An empty wizard every morning would be pure friction.
    expect(shouldRunDayPlan([])).toBe(false)
    expect(shouldRunDayPlan([task("a", { status: "Done" })])).toBe(false)
  })
})

describe("recordDecision", () => {
  it("records the decision and advances", () => {
    const next = recordDecision(initialDayPlanState(), "a", "today")
    expect(next.index).toBe(1)
    expect(next.decisions).toEqual({ a: "today" })
  })

  it("overwrites an earlier decision when a task is revisited", () => {
    const first = recordDecision(initialDayPlanState(), "a", "today")
    const back = stepBack(first)
    const again = recordDecision(back, "a", "later")
    expect(again.decisions.a).toBe("later")
    expect(again.index).toBe(1)
  })

  it("does not mutate the state it was given", () => {
    const state = initialDayPlanState()
    recordDecision(state, "a", "today")
    expect(state.index).toBe(0)
    expect(state.decisions).toEqual({})
  })
})

describe("stepBack", () => {
  it("goes back one task", () => {
    expect(stepBack({ index: 2, decisions: {}, chosenTaskId: null }).index).toBe(1)
  })

  it("stops at the first task rather than going negative", () => {
    expect(stepBack(initialDayPlanState()).index).toBe(0)
  })

  it("keeps decisions, so going back shows what was chosen", () => {
    const state = { index: 1, decisions: { a: "today" as const }, chosenTaskId: null }
    expect(stepBack(state).decisions).toEqual({ a: "today" })
  })
})

describe("defaultChoice", () => {
  it("preselects the only candidate, making the step a confirmation", () => {
    expect(defaultChoice([task("a")])).toBe("a")
  })

  it("preselects nothing when there is a real choice to make", () => {
    // A default here would quietly make the decision the wizard exists to force.
    expect(defaultChoice([task("a"), task("b")])).toBeNull()
  })

  it("preselects nothing when there are no candidates", () => {
    expect(defaultChoice([])).toBeNull()
  })
})

describe("a full run through the wizard", () => {
  it("ends with one task marked in progress and chosen to start", () => {
    let tasks = [
      task("write", { lastInteractionTime: 300 }),
      task("email", { lastInteractionTime: 200 }),
      task("stale", { lastInteractionTime: 100 }),
    ]
    const queue = triageQueue(tasks)
    expect(queue.map((t) => t.id)).toEqual(["write", "email", "stale"])

    let state = initialDayPlanState()
    const run = [
      ["write", "today"],
      ["email", "today"],
      ["stale", "done"],
    ] as const

    for (const [id, decision] of run) {
      tasks = applyDecision(tasks, id, decision)
      state = recordDecision(state, id, decision)
    }

    expect(planPhase(state, queue.length)).toBe("pick")

    const candidates = candidatesForToday(queue, state.decisions)
    expect(candidates.map((t) => t.id)).toEqual(["write", "email"])
    // Two candidates, so the user must actually pick.
    expect(defaultChoice(candidates)).toBeNull()

    expect(tasks.find((t) => t.id === "stale")!.status).toBe("Done")
    expect(tasks.find((t) => t.id === "write")!.status).toBe("In Progress")
  })

  it("reaches the pick step with nothing to start when the whole day is deferred", () => {
    const tasks = [task("a"), task("b")]
    const queue = triageQueue(tasks)
    let state = initialDayPlanState()
    state = recordDecision(state, "a", "later")
    state = recordDecision(state, "b", "later")

    expect(planPhase(state, queue.length)).toBe("pick")
    expect(candidatesForToday(queue, state.decisions)).toEqual([])
  })
})
