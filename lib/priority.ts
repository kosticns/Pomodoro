import type { Priority, Project } from "./types"

/**
 * Project priority: Urgent, High, Medium, Low.
 *
 * Priority is resolved at read time rather than migrated into storage, the
 * same approach `standingCadenceOf` uses for the sit/stand cadence. A stored
 * projects array replaces the defaults wholesale, so a key added later reads
 * as undefined on an existing device. Resolving on read means every project
 * has a priority immediately, with no migration write and nothing to go wrong
 * on the one device that matters.
 */

export const PRIORITIES: Priority[] = ["Urgent", "High", "Medium", "Low"]

/**
 * Medium, so existing projects land in the middle rather than all claiming to
 * be urgent or all being buried at the bottom.
 */
export const DEFAULT_PRIORITY: Priority = "Medium"

/** Sort weight. Urgent first, Low last. */
const RANK: Record<Priority, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 }

/** A project's priority, falling back for anything unset or unrecognised. */
export function priorityOf(project: Pick<Project, "priority">): Priority {
  const p = project.priority
  return p && PRIORITIES.includes(p) ? p : DEFAULT_PRIORITY
}

export function priorityRank(priority: Priority | undefined): number {
  return RANK[priority && PRIORITIES.includes(priority) ? priority : DEFAULT_PRIORITY]
}

/**
 * Comparator for "By Priority". Urgent first, then the most recently touched
 * project within each level, so a long list stays useful rather than falling
 * back on insertion order.
 */
export function compareByPriority(
  a: Pick<Project, "priority" | "lastInteractionTime">,
  b: Pick<Project, "priority" | "lastInteractionTime">,
): number {
  const byRank = priorityRank(a.priority) - priorityRank(b.priority)
  if (byRank !== 0) return byRank
  return (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0)
}

/** Group projects by priority, highest first, skipping empty levels. */
export function groupByPriority<T extends Pick<Project, "priority">>(
  projects: T[],
): Array<{ priority: Priority; projects: T[] }> {
  return PRIORITIES.map((priority) => ({
    priority,
    projects: projects.filter((p) => priorityOf(p) === priority),
  })).filter((group) => group.projects.length > 0)
}
