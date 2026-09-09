import { describe, it, expect } from "vitest"
import {
  shouldPromptNewDay,
  formatClock,
  localHour,
  DEFAULT_DAY_START_HOUR,
  greeting,
} from "./day-start"

const base = {
  lastPromptedDate: "2026-09-08",
  today: "2026-09-09",
  currentHour: 9,
  startHour: 8,
}

describe("shouldPromptNewDay", () => {
  it("prompts on a new day once the hour has passed", () => {
    expect(shouldPromptNewDay(base)).toBe(true)
  })

  it("prompts exactly at the start hour, not a minute later", () => {
    expect(shouldPromptNewDay({ ...base, currentHour: 8 })).toBe(true)
  })

  it("stays quiet before the start hour", () => {
    // Opening the app at 06:00 should not nag.
    expect(shouldPromptNewDay({ ...base, currentHour: 6 })).toBe(false)
    expect(shouldPromptNewDay({ ...base, currentHour: 7 })).toBe(false)
  })

  it("does not prompt twice on the same day", () => {
    expect(shouldPromptNewDay({ ...base, lastPromptedDate: "2026-09-09" })).toBe(false)
  })

  it("prompts late in the day if the app was never opened in the morning", () => {
    // Opening for the first time at 21:00 still deserves the prompt, because
    // the day's data has not been offered yet.
    expect(shouldPromptNewDay({ ...base, currentHour: 21 })).toBe(true)
  })

  it("prompts on a fresh install, where nothing has been prompted yet", () => {
    expect(shouldPromptNewDay({ ...base, lastPromptedDate: "" })).toBe(true)
  })

  it("does nothing without a date, rather than guessing", () => {
    expect(shouldPromptNewDay({ ...base, today: "" })).toBe(false)
  })

  it("respects a custom start hour", () => {
    expect(shouldPromptNewDay({ ...base, currentHour: 9, startHour: 10 })).toBe(false)
    expect(shouldPromptNewDay({ ...base, currentHour: 10, startHour: 10 })).toBe(true)
  })

  it("defaults to 8", () => {
    expect(DEFAULT_DAY_START_HOUR).toBe(8)
  })

  it("prompts again the following day after being handled", () => {
    const handledToday = { ...base, lastPromptedDate: "2026-09-09" }
    expect(shouldPromptNewDay(handledToday)).toBe(false)
    // next morning
    expect(shouldPromptNewDay({ ...handledToday, today: "2026-09-10" })).toBe(true)
  })
})

describe("formatClock", () => {
  it("pads to two digits in 24-hour form", () => {
    expect(formatClock(new Date(2026, 8, 9, 9, 5))).toBe("09:05")
    expect(formatClock(new Date(2026, 8, 9, 14, 30))).toBe("14:30")
  })

  it("shows midnight as 00:00 rather than 12:00", () => {
    expect(formatClock(new Date(2026, 8, 9, 0, 0))).toBe("00:00")
  })

  it("shows noon as 12:00", () => {
    expect(formatClock(new Date(2026, 8, 9, 12, 0))).toBe("12:00")
  })

  it("accepts a timestamp, so stored start times can be rendered", () => {
    const ts = new Date(2026, 8, 9, 17, 45).getTime()
    expect(formatClock(ts)).toBe("17:45")
  })
})

describe("localHour", () => {
  it("reads the local hour from a supplied date", () => {
    expect(localHour(new Date(2026, 8, 9, 6, 59))).toBe(6)
    expect(localHour(new Date(2026, 8, 9, 23, 1))).toBe(23)
  })
})

describe("greeting", () => {
  it("matches the time of day, because the prompt is not always in the morning", () => {
    expect(greeting(0)).toBe("Good morning")
    expect(greeting(8)).toBe("Good morning")
    expect(greeting(11)).toBe("Good morning")
    expect(greeting(12)).toBe("Good afternoon")
    expect(greeting(16)).toBe("Good afternoon")
    expect(greeting(17)).toBe("Good afternoon")
    expect(greeting(18)).toBe("Good evening")
    expect(greeting(23)).toBe("Good evening")
  })
})
