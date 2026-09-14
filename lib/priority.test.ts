import { describe, it, expect } from "vitest"
import {
  DEFAULT_PRIORITY,
  PRIORITIES,
  compareByPriority,
  compareByProjectThenTask,
  groupByPriority,
  priorityOf,
  priorityRank,
} from "./priority"
import type { Priority, Project } from "./types"

function project(over: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Project",
    status: "Ongoing",
    createdAt: 0,
    lastInteractionTime: 0,
    ...over,
  }
}

describe("PRIORITIES", () => {
  it("is the four levels, most urgent first", () => {
    expect(PRIORITIES).toEqual(["Urgent", "High", "Medium", "Low"])
  })

  it("defaults to Medium, so nothing is silently urgent or buried", () => {
    expect(DEFAULT_PRIORITY).toBe("Medium")
  })
})

describe("priorityOf", () => {
  it("returns the stored priority", () => {
    expect(priorityOf(project({ priority: "Urgent" }))).toBe("Urgent")
    expect(priorityOf(project({ priority: "Low" }))).toBe("Low")
  })

  it("falls back for a project saved before priority existed", () => {
    // Every project on his device today is this case.
    expect(priorityOf(project())).toBe("Medium")
    expect(priorityOf(project({ priority: undefined }))).toBe("Medium")
  })

  it("falls back on a value that is not one of the four", () => {
    // A hand-edited backup file can carry anything.
    expect(priorityOf({ priority: "Critical" as Priority })).toBe("Medium")
    expect(priorityOf({ priority: "" as Priority })).toBe("Medium")
  })
})

describe("priorityRank", () => {
  it("orders urgent first and low last", () => {
    expect(priorityRank("Urgent")).toBeLessThan(priorityRank("High"))
    expect(priorityRank("High")).toBeLessThan(priorityRank("Medium"))
    expect(priorityRank("Medium")).toBeLessThan(priorityRank("Low"))
  })

  it("ranks an unset priority as Medium", () => {
    expect(priorityRank(undefined)).toBe(priorityRank("Medium"))
  })
})

describe("compareByPriority", () => {
  it("sorts urgent to the top and low to the bottom", () => {
    const list = [
      project({ id: "low", priority: "Low" }),
      project({ id: "urgent", priority: "Urgent" }),
      project({ id: "medium", priority: "Medium" }),
      project({ id: "high", priority: "High" }),
    ]
    expect([...list].sort(compareByPriority).map((p) => p.id)).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
    ])
  })

  it("breaks ties on recent activity, not insertion order", () => {
    const list = [
      project({ id: "stale", priority: "High", lastInteractionTime: 100 }),
      project({ id: "fresh", priority: "High", lastInteractionTime: 900 }),
    ]
    expect([...list].sort(compareByPriority).map((p) => p.id)).toEqual(["fresh", "stale"])
  })

  it("places a project with no priority among the Mediums", () => {
    const list = [
      project({ id: "low", priority: "Low" }),
      project({ id: "unset" }),
      project({ id: "high", priority: "High" }),
    ]
    expect([...list].sort(compareByPriority).map((p) => p.id)).toEqual(["high", "unset", "low"])
  })

  it("handles a project never interacted with", () => {
    const list = [
      project({ id: "never", priority: "Low", lastInteractionTime: undefined as unknown as number }),
      project({ id: "used", priority: "Low", lastInteractionTime: 5 }),
    ]
    expect([...list].sort(compareByPriority).map((p) => p.id)).toEqual(["used", "never"])
  })
})

describe("groupByPriority", () => {
  it("groups highest first", () => {
    const groups = groupByPriority([
      project({ id: "a", priority: "Low" }),
      project({ id: "b", priority: "Urgent" }),
      project({ id: "c", priority: "Urgent" }),
    ])
    expect(groups.map((g) => g.priority)).toEqual(["Urgent", "Low"])
    expect(groups[0].projects.map((p) => p.id)).toEqual(["b", "c"])
  })

  it("leaves out empty levels rather than printing empty headings", () => {
    const groups = groupByPriority([project({ priority: "High" })])
    expect(groups).toHaveLength(1)
    expect(groups[0].priority).toBe("High")
  })

  it("is empty for no projects", () => {
    expect(groupByPriority([])).toEqual([])
  })

  it("files unset projects under Medium", () => {
    const groups = groupByPriority([project({ id: "unset" })])
    expect(groups[0].priority).toBe("Medium")
  })
})

describe("compareByProjectThenTask", () => {
  const projects = [
    { id: "urgentProj", priority: "Urgent" as Priority },
    { id: "lowProj", priority: "Low" as Priority },
    { id: "unsetProj" },
  ]
  const t = (id: string, projectId: string, priority?: Priority, seen = 0) =>
    ({ id, projectId, priority, lastInteractionTime: seen })

  it("ranks by project first, so a Low task in an Urgent project beats an Urgent task in a Low project", () => {
    // This is the rule: the project decides what matters today, the task only
    // decides the order within it.
    const low = t("lowTaskUrgentProj", "urgentProj", "Low")
    const urgent = t("urgentTaskLowProj", "lowProj", "Urgent")
    expect([urgent, low].sort((a, b) => compareByProjectThenTask(a, b, projects))[0].id).toBe(
      "lowTaskUrgentProj",
    )
  })

  it("ranks by task priority inside the same project", () => {
    const list = [
      t("medium", "urgentProj", "Medium"),
      t("urgent", "urgentProj", "Urgent"),
      t("low", "urgentProj", "Low"),
      t("high", "urgentProj", "High"),
    ]
    expect(list.sort((a, b) => compareByProjectThenTask(a, b, projects)).map((x) => x.id)).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
    ])
  })

  it("groups every task of a higher project above every task of a lower one", () => {
    const list = [
      t("lowProjUrgent", "lowProj", "Urgent"),
      t("urgentProjLow", "urgentProj", "Low"),
      t("lowProjHigh", "lowProj", "High"),
      t("urgentProjMedium", "urgentProj", "Medium"),
    ]
    const order = list.sort((a, b) => compareByProjectThenTask(a, b, projects)).map((x) => x.id)
    expect(order.slice(0, 2).every((id) => id.startsWith("urgentProj"))).toBe(true)
    expect(order.slice(2).every((id) => id.startsWith("lowProj"))).toBe(true)
  })

  it("breaks a full tie on recent activity", () => {
    const list = [
      t("stale", "urgentProj", "High", 100),
      t("fresh", "urgentProj", "High", 900),
    ]
    expect(list.sort((a, b) => compareByProjectThenTask(a, b, projects)).map((x) => x.id)).toEqual([
      "fresh",
      "stale",
    ])
  })

  it("treats an unset project priority as Medium rather than winning or crashing", () => {
    const list = [t("inUnset", "unsetProj"), t("inLow", "lowProj"), t("inUrgent", "urgentProj")]
    expect(list.sort((a, b) => compareByProjectThenTask(a, b, projects)).map((x) => x.id)).toEqual([
      "inUrgent",
      "inUnset",
      "inLow",
    ])
  })

  it("does not crash on a task whose project is missing", () => {
    const orphan = t("orphan", "goneProj", "Urgent")
    const normal = t("normal", "urgentProj", "Low")
    expect(() =>
      [orphan, normal].sort((a, b) => compareByProjectThenTask(a, b, projects)),
    ).not.toThrow()
    // The orphan sorts as Medium, so the Urgent project still wins.
    expect([orphan, normal].sort((a, b) => compareByProjectThenTask(a, b, projects))[0].id).toBe(
      "normal",
    )
  })
})
