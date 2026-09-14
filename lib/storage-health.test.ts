import { describe, it, expect, beforeEach } from "vitest"
import {
  buildStorageFailure,
  clearStorageFailure,
  describeStorageFailure,
  getStorageFailure,
  isQuotaError,
  reportStorageFailure,
  resetStorageHealth,
  subscribeStorageHealth,
} from "./storage-health"

/** The shape browsers actually throw when the store is full. */
function quotaError(name = "QuotaExceededError"): Error {
  const e = new Error("exceeded the quota")
  e.name = name
  return e
}

beforeEach(() => resetStorageHealth())

describe("isQuotaError", () => {
  it("recognises the standard name", () => {
    expect(isQuotaError(quotaError())).toBe(true)
  })

  it("recognises Firefox's name", () => {
    expect(isQuotaError(quotaError("NS_ERROR_DOM_QUOTA_REACHED"))).toBe(true)
  })

  it("recognises the legacy numeric code", () => {
    const e = new Error("full") as Error & { code: number }
    e.code = 22
    expect(isQuotaError(e)).toBe(true)
  })

  it("does not claim every error is a quota error", () => {
    expect(isQuotaError(new Error("SecurityError"))).toBe(false)
    expect(isQuotaError(new TypeError("bad json"))).toBe(false)
  })

  it("survives a thrown non-Error", () => {
    // Browsers have thrown strings here before now.
    expect(isQuotaError("boom")).toBe(false)
    expect(isQuotaError(null)).toBe(false)
    expect(isQuotaError(undefined)).toBe(false)
  })
})

describe("describeStorageFailure", () => {
  it("tells the user to clear space when the store is full", () => {
    expect(describeStorageFailure(quotaError())).toMatch(/full/i)
  })

  it("tells the user to back up when it is something else", () => {
    // Private browsing and blocked origins land here.
    expect(describeStorageFailure(new Error("SecurityError"))).toMatch(/backup/i)
  })

  it("always names a next action rather than only stating the problem", () => {
    for (const e of [quotaError(), new Error("other")]) {
      expect(describeStorageFailure(e)).toMatch(/export a backup/i)
    }
  })
})

describe("buildStorageFailure", () => {
  it("records the key, the cause and when", () => {
    const f = buildStorageFailure("tasks", quotaError(), 1000)
    expect(f.key).toBe("tasks")
    expect(f.quotaExceeded).toBe(true)
    expect(f.at).toBe(1000)
  })

  it("flags a non-quota failure as such", () => {
    expect(buildStorageFailure("tasks", new Error("nope"), 1).quotaExceeded).toBe(false)
  })
})

describe("the failure store", () => {
  it("starts clean", () => {
    expect(getStorageFailure()).toBeNull()
  })

  it("records a failure and notifies subscribers", () => {
    let calls = 0
    subscribeStorageHealth(() => calls++)
    reportStorageFailure("tasks", quotaError(), 5)
    expect(getStorageFailure()?.key).toBe("tasks")
    expect(calls).toBe(1)
  })

  it("keeps the first failure, because once storage breaks every key fails", () => {
    // Otherwise the banner would churn through key names on every keystroke.
    reportStorageFailure("tasks", quotaError(), 1)
    reportStorageFailure("stats", quotaError(), 2)
    expect(getStorageFailure()?.key).toBe("tasks")
  })

  it("does not notify again while a failure is already showing", () => {
    let calls = 0
    subscribeStorageHealth(() => calls++)
    reportStorageFailure("tasks", quotaError(), 1)
    reportStorageFailure("stats", quotaError(), 2)
    expect(calls).toBe(1)
  })

  it("clears on dismiss and notifies", () => {
    let calls = 0
    reportStorageFailure("tasks", quotaError(), 1)
    subscribeStorageHealth(() => calls++)
    clearStorageFailure()
    expect(getStorageFailure()).toBeNull()
    expect(calls).toBe(1)
  })

  it("does nothing when dismissing with nothing to dismiss", () => {
    let calls = 0
    subscribeStorageHealth(() => calls++)
    clearStorageFailure()
    expect(calls).toBe(0)
  })

  it("can record a new failure after the last was dismissed", () => {
    reportStorageFailure("tasks", quotaError(), 1)
    clearStorageFailure()
    reportStorageFailure("stats", quotaError(), 2)
    expect(getStorageFailure()?.key).toBe("stats")
  })

  it("stops notifying an unsubscribed listener", () => {
    let calls = 0
    const off = subscribeStorageHealth(() => calls++)
    off()
    reportStorageFailure("tasks", quotaError(), 1)
    expect(calls).toBe(0)
  })
})
