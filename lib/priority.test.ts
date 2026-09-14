import { describe, it, expect } from "vitest"
import {
  DEFAULT_PRIORITY,
  PRIORITIES,
  compareByPriority,
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
