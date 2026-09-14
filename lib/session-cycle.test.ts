import { describe, it, expect } from "vitest"
import {
  DEFAULT_CYCLES_BEFORE_LONG_BREAK,
  cyclesBeforeLongBreakOf,
  isStaleTimerState,
  nextSession,
  startOfCycle,
  type CycleState,
} from "./session-cycle"
import type { SessionType } from "./types"

/** Walk the cycle, returning the session types in order. */
function run(steps: number, cycles = 4, from: CycleState = startOfCycle()): SessionType[] {
  const out: SessionType[] = [from.sessionType]
  let state = from
  for (let i = 0; i < steps; i++) {
    state = nextSession(state, cycles)
    out.push(state.sessionType)
  }
  return out
}

describe("the intended rhythm", () => {
  it("starts the day on a focus session", () => {
    expect(startOfCycle().sessionType).toBe("focus")
    expect(startOfCycle().completedFocusSessions).toBe(0)
  })

  it("runs focus, short, focus, short, focus, short, focus, long", () => {
    // This is the sequence Mickey described, and the one the app owes him.
    expect(run(7)).toEqual([
      "focus",
      "shortBreak",
      "focus",
      "shortBreak",
      "focus",
      "shortBreak",
      "focus",
      "longBreak",
    ])
  })

  it("repeats the same pattern after the long break", () => {
    expect(run(15)).toEqual([
      "focus", "shortBreak", "focus", "shortBreak", "focus", "shortBreak", "focus", "longBreak",
      "focus", "shortBreak", "focus", "shortBreak", "focus", "shortBreak", "focus", "longBreak",
    ])
  })

  it("never puts two breaks back to back", () => {
    const seq = run(40)
    const isBreak = (s: SessionType) => s !== "focus"
    const adjacent = seq.slice(1).some((s, i) => isBreak(s) && isBreak(seq[i]))
    expect(adjacent).toBe(false)
  })

  it("never puts two focus sessions back to back", () => {
    const seq = run(40)
    const adjacent = seq.slice(1).some((s, i) => s === "focus" && seq[i] === "focus")
    expect(adjacent).toBe(false)
  })

  it("gives exactly one long break per four focus sessions", () => {
    const seq = run(40)
    expect(seq.filter((s) => s === "longBreak").length * 4).toBe(
      seq.filter((s) => s === "focus").length - seq.filter((s) => s === "focus").length % 4,
    )
  })
})

describe("skipping a break does not change the cadence", () => {
  it("counts focus sessions, never breaks", () => {
    // The old skip path advanced the counter when a SHORT BREAK ended, while
    // the natural path advanced it when a FOCUS ended. Mixing the two gave a
    // long break about every two pomodoros.
    let state = startOfCycle()
    state = nextSession(state, 4) // focus done -> short break, count 1
    expect(state.completedFocusSessions).toBe(1)

    state = nextSession(state, 4) // break dismissed -> focus, count unchanged
    expect(state.sessionType).toBe("focus")
    expect(state.completedFocusSessions).toBe(1)
  })

  it("still reaches the long break on the fourth focus, not the second", () => {
    const seq = run(7)
    expect(seq.indexOf("longBreak")).toBe(7)
    expect(seq.filter((s) => s === "focus").length).toBe(4)
  })

  it("never follows a short break with a long break", () => {
    // The exact defect in the old skip path.
    const seq = run(40)
    const bad = seq.slice(1).some((s, i) => s === "longBreak" && seq[i] === "shortBreak")
    expect(bad).toBe(false)
  })
})

describe("cyclesBeforeLongBreakOf", () => {
  it("passes a sensible stored value through", () => {
    expect(cyclesBeforeLongBreakOf(4)).toBe(4)
    expect(cyclesBeforeLongBreakOf(2)).toBe(2)
    expect(cyclesBeforeLongBreakOf(8)).toBe(8)
  })

  it("falls back when the value is missing", () => {
    expect(cyclesBeforeLongBreakOf(undefined)).toBe(DEFAULT_CYCLES_BEFORE_LONG_BREAK)
  })

  it("falls back on 0, which would otherwise make the modulo NaN", () => {
    // n % 0 is NaN, so no long break would ever be due.
    expect(cyclesBeforeLongBreakOf(0)).toBe(4)
  })

  it("falls back on negatives and non-numbers", () => {
    expect(cyclesBeforeLongBreakOf(-3)).toBe(4)
    expect(cyclesBeforeLongBreakOf(NaN)).toBe(4)
    expect(cyclesBeforeLongBreakOf(Infinity)).toBe(4)
  })

  it("allows 1, which legitimately means every break is long", () => {
    expect(cyclesBeforeLongBreakOf(1)).toBe(1)
    expect(run(3, 1)).toEqual(["focus", "longBreak", "focus", "longBreak"])
  })

  it("floors a fractional value rather than producing a fractional modulo", () => {
    expect(cyclesBeforeLongBreakOf(3.7)).toBe(3)
  })

  it("honours a custom cadence of 2", () => {
    expect(run(3, 2)).toEqual(["focus", "shortBreak", "focus", "longBreak"])
  })
})

describe("the count stays bounded", () => {
  it("resets once the long break is handed out", () => {
    let state = startOfCycle()
    for (let i = 0; i < 7; i++) state = nextSession(state, 4)
    expect(state.sessionType).toBe("longBreak")
    expect(state.completedFocusSessions).toBe(0)
  })

  it("does not grow without bound over a long day", () => {
    let state = startOfCycle()
    for (let i = 0; i < 200; i++) state = nextSession(state, 4)
    expect(state.completedFocusSessions).toBeLessThan(4)
  })
})

describe("isStaleTimerState", () => {
  it("discards a timer saved on an earlier day", () => {
    // Yesterday ended on a break, so without this the morning opens on a break.
    expect(isStaleTimerState("2026-09-13", "2026-09-14")).toBe(true)
  })

  it("keeps a timer saved today, so a reload does not lose the session", () => {
    expect(isStaleTimerState("2026-09-14", "2026-09-14")).toBe(false)
  })

  it("treats state with no date at all as stale", () => {
    // Everything saved before this fix carries no date.
    expect(isStaleTimerState("", "2026-09-14")).toBe(true)
  })

  it("does nothing without today's date rather than guessing", () => {
    expect(isStaleTimerState("2026-09-13", "")).toBe(false)
  })
})
