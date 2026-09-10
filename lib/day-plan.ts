import type { Task, TaskStatus } from "./types"

/**
 * The start-of-day prioritisation wizard.
 *
 * Runs after the start-of-day prompt. Walks every unfinished task one at a
 * time, then ends by picking which one to actually start. The point is that
 * the day begins with a decision rather than with whatever task happened to be
 * active yesterday.
 *
 * The Tasks tab already had a "Daily" review that set each task's status one
 * by one. It stopped there: it never chose a task to work on and never touched
 * the active task, so you finished the review no better off than when you
 * started. This replaces it rather than sitting beside it.
 *
 * All state transitions are pure functions so the flow can be tested without
 * rendering anything.
 */

export type TriageDecision = "today" | "later" | "done" | "skip"

/** taskId -> what was decided for it in this run. */
export type Decisions = Record<string, TriageDecision>

export interface DayPlanState {
  /** Index into the triage queue. */
  index: number
  decisions: Decisions
  /** Set once the user picks the task to start. */
  chosenTaskId: string | null
}

export function initialDayPlanState(): DayPlanState {
  return { index: 0, decisions: {}, chosenTaskId: null }
}

/**
 * The tasks to walk through, in a stable order.
 *
 * Most recently touched first, because a task you worked on yesterday is the
 * one you have the clearest opinion about this morning. Finished tasks are
 * excluded; there is nothing to decide about them.
 */
export function triageQueue(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.status !== "Done")
    .slice()
    .sort((a, b) => (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0))
}

/**
 * Apply one decision to the task list.
 *
 * "today" and "later" map onto the two live statuses: In Progress means active
 * work, To Do means parked. "skip" changes nothing, which is the point of it.
 */
export function applyDecision(tasks: Task[], taskId: string, decision: TriageDecision): Task[] {
  if (decision === "skip") return tasks
  const status: TaskStatus =
    decision === "today" ? "In Progress" : decision === "later" ? "To Do" : "Done"
  return tasks.map((t) => (t.id === taskId ? { ...t, status } : t))
}

/** Which phase the wizard is in, given how far through the queue it is. */
export function planPhase(state: DayPlanState, queueLength: number): "triage" | "pick" | "empty" {
  if (queueLength === 0) return "empty"
  if (state.index < queueLength) return "triage"
  return "pick"
}

/**
 * The tasks eligible to be started first.
 *
 * Only what was marked "today" in this run. A task skipped or parked is not a
 * candidate even if it is still In Progress from yesterday, because the user
 * did not choose it this morning.
 */
export function candidatesForToday(queue: Task[], decisions: Decisions): Task[] {
  return queue.filter((t) => decisions[t.id] === "today")
}

/**
 * Should the wizard run at all?
 *
 * No unfinished tasks means nothing to triage, and opening an empty wizard
 * every morning would be pure friction.
 */
export function shouldRunDayPlan(tasks: Task[]): boolean {
  return triageQueue(tasks).length > 0
}

/** Advances past the current task, recording what was decided. */
export function recordDecision(
  state: DayPlanState,
  taskId: string,
  decision: TriageDecision,
): DayPlanState {
  return {
    ...state,
    index: state.index + 1,
    decisions: { ...state.decisions, [taskId]: decision },
  }
}

/** Steps back one task so a decision can be changed. */
export function stepBack(state: DayPlanState): DayPlanState {
  return { ...state, index: Math.max(0, state.index - 1) }
}

/**
 * Which task should be pre-selected on the pick step.
 *
 * With a single candidate there is nothing to choose, so it is preselected and
 * the step becomes a confirmation. With several, nothing is preselected: a
 * default would quietly make the decision the wizard exists to force.
 */
export function defaultChoice(candidates: Task[]): string | null {
  return candidates.length === 1 ? candidates[0].id : null
}
