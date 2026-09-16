import type { Priority, Project, ProjectStatus, Task, TaskStatus } from "./types"
import { compareByProjectThenTask, priorityRank } from "./priority"

/**
 * The start-of-day prioritisation wizard, for tasks and for projects.
 *
 * Runs after the start-of-day prompt. Walks every unfinished item one at a
 * time, then ends by picking which one to actually start. The point is that
 * the day begins with a decision rather than with whatever happened to be
 * active yesterday.
 *
 * Both tabs previously had a "Daily" review that set each item's status one by
 * one and stopped there. Neither chose anything to work on, so you finished no
 * better off than when you started. This replaces both.
 *
 * The two flows differ only in their status vocabulary and in where they land:
 * the task flow ends by activating the chosen task, and the project flow ends
 * by activating a task inside the chosen project. The walk itself is shared,
 * because it is the same walk.
 *
 * All state transitions are pure functions so the flow can be tested without
 * rendering anything.
 */

export type TriageDecision = "today" | "later" | "done" | "skip"

/** item id -> what was decided for it in this run. */
export type Decisions = Record<string, TriageDecision>

/** The shape the shared walk needs. Both Task and Project satisfy it. */
interface Triageable {
  id: string
  status: string
  lastInteractionTime?: number
}

export interface DayPlanState {
  /** Index into the triage queue. */
  index: number
  decisions: Decisions
  /** Set once the user picks the item to start. */
  chosenTaskId: string | null
  /**
   * Each item asks two questions: its state, then its priority. This holds the
   * state answer while the priority question is on screen. Null means the
   * state question is the one showing.
   */
  pendingDecision: TriageDecision | null
}

export function initialDayPlanState(): DayPlanState {
  return { index: 0, decisions: {}, chosenTaskId: null, pendingDecision: null }
}

/**
 * Does this answer still need a priority?
 *
 * "done" does not. A finished item is finished; ranking it against the others
 * is a question with no consequence, and asking it costs a tap on the answer
 * you give most often at the end of a day.
 *
 * Callers branch on this: true means show the priority question via
 * beginDecision, false means go straight to recordDecision.
 */
export function needsPriority(decision: TriageDecision): boolean {
  return decision !== "done"
}

/** Answers the state question, which reveals the priority question. */
export function beginDecision(state: DayPlanState, decision: TriageDecision): DayPlanState {
  return { ...state, pendingDecision: decision }
}

/** Which of the two questions is on screen for the current item. */
export function triageStep(state: DayPlanState): "state" | "priority" {
  return state.pendingDecision ? "priority" : "state"
}

/**
 * The items to walk through, in a stable order.
 *
 * Most recently touched first, because something you worked on yesterday is
 * what you have the clearest opinion about this morning. Finished items are
 * excluded; there is nothing to decide about them.
 */
export function triageQueueOf<T extends Triageable>(items: T[]): T[] {
  return items
    .filter((t) => t.status !== "Done")
    .slice()
    .sort((a, b) => (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0))
}

/** The task queue. */
export function triageQueue(tasks: Task[]): Task[] {
  return triageQueueOf(tasks)
}

/** The project queue. */
export function projectTriageQueue(projects: Project[]): Project[] {
  return triageQueueOf(projects)
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
 * The items eligible to be started first.
 *
 * Only what was marked "today" in this run. Anything skipped or parked is not
 * a candidate even if it is still live from yesterday, because the user did
 * not choose it this morning.
 */
export function candidatesForToday<T extends { id: string }>(
  queue: T[],
  decisions: Decisions,
): T[] {
  return queue.filter((t) => decisions[t.id] === "today")
}

/**
 * Should the wizard run at all?
 *
 * Nothing unfinished means nothing to triage, and opening an empty wizard
 * every morning would be pure friction.
 */
export function shouldRunDayPlan(tasks: Task[]): boolean {
  return triageQueue(tasks).length > 0
}

/**
 * Apply one decision to the project list.
 *
 * "today" and "later" map onto the two live project statuses: Ongoing means
 * active, On Hold means parked. "skip" changes nothing.
 */
export function applyProjectDecision(
  projects: Project[],
  projectId: string,
  decision: TriageDecision,
): Project[] {
  if (decision === "skip") return projects
  const status: ProjectStatus =
    decision === "today" ? "Ongoing" : decision === "later" ? "On Hold" : "Done"
  return projects.map((p) => (p.id === projectId ? { ...p, status } : p))
}

/**
 * A project decision reaches its tasks.
 *
 * Finishing a project finishes its tasks, and parking one parks the work that
 * was in progress inside it. This mirrors what the old Project Review did, and
 * it is the reason a project decision cannot be a simple status write: leaving
 * live tasks inside a finished project is how the task list fills with work
 * that no longer exists.
 */
export function cascadeProjectDecisionToTasks(
  tasks: Task[],
  projectId: string,
  decision: TriageDecision,
): Task[] {
  if (decision === "done") {
    return tasks.map((t) => (t.projectId === projectId ? { ...t, status: "Done" as TaskStatus } : t))
  }
  if (decision === "later") {
    return tasks.map((t) =>
      t.projectId === projectId && t.status === "In Progress"
        ? { ...t, status: "To Do" as TaskStatus }
        : t,
    )
  }
  return tasks
}

/**
 * The unfinished tasks inside a project, highest priority first.
 *
 * Within one project the project's own priority is constant, so only the task
 * priority separates them.
 */
export function tasksForProject(tasks: Task[], projectId: string): Task[] {
  return tasks
    .filter((t) => t.projectId === projectId && t.status !== "Done")
    .slice()
    .sort((a, b) => {
      const byPriority = priorityRank(a.priority) - priorityRank(b.priority)
      if (byPriority !== 0) return byPriority
      return (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0)
    })
}

/** Sets a priority on one task. */
export function applyTaskPriority(tasks: Task[], taskId: string, priority: Priority): Task[] {
  return tasks.map((t) => (t.id === taskId ? { ...t, priority } : t))
}

/** Sets a priority on one project. */
export function applyProjectPriority(
  projects: Project[],
  projectId: string,
  priority: Priority,
): Project[] {
  return projects.map((p) => (p.id === projectId ? { ...p, priority } : p))
}

/**
 * The order tasks are offered in when picking what to start.
 *
 * Project priority decides first, task priority second, exactly as the ranking
 * rule says. A queue that ignored this would offer you an Urgent task from a
 * Low project ahead of the work you said matters most today.
 */
export function orderTasksForPicking(tasks: Task[], projects: Project[]): Task[] {
  return tasks.slice().sort((a, b) => compareByProjectThenTask(a, b, projects))
}

/** Should the project wizard run at all? */
export function shouldRunProjectPlan(projects: Project[]): boolean {
  return projectTriageQueue(projects).length > 0
}

/** Advances past the current item, recording what was decided. */
export function recordDecision(
  state: DayPlanState,
  taskId: string,
  decision: TriageDecision,
): DayPlanState {
  return {
    ...state,
    index: state.index + 1,
    decisions: { ...state.decisions, [taskId]: decision },
    pendingDecision: null,
  }
}

/**
 * Back one step, not one item.
 *
 * From the priority question that means returning to the state question for
 * the same item, so a mistaken tap costs one tap to undo rather than skipping
 * the item entirely.
 */
export function stepBack(state: DayPlanState): DayPlanState {
  if (state.pendingDecision) return { ...state, pendingDecision: null }
  return { ...state, index: Math.max(0, state.index - 1), pendingDecision: null }
}

/** True when Back would do anything at all. */
export function canStepBack(state: DayPlanState): boolean {
  return state.pendingDecision !== null || state.index > 0
}

/**
 * Which item should be pre-selected on the pick step.
 *
 * With a single candidate there is nothing to choose, so it is preselected and
 * the step becomes a confirmation. With several, nothing is preselected: a
 * default would quietly make the decision the wizard exists to force.
 */
export function defaultChoice<T extends { id: string }>(candidates: T[]): string | null {
  return candidates.length === 1 ? candidates[0].id : null
}
