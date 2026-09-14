import { describe, it, expect } from "vitest"
import { cacheNameFor, precacheList, shouldPrecache } from "./service-worker"

describe("shouldPrecache", () => {
  it("takes the shell and the build assets", () => {
    expect(shouldPrecache("/index.html")).toBe(true)
    expect(shouldPrecache("/_next/static/chunks/main-abc123.js")).toBe(true)
    expect(shouldPrecache("/_next/static/css/app-abc.css")).toBe(true)
    expect(shouldPrecache("/manifest.webmanifest")).toBe(true)
    expect(shouldPrecache("/icon-192x192.png")).toBe(true)
  })

  it("leaves out Next's flight payloads, which nothing here reads", () => {
    expect(shouldPrecache("/index.txt")).toBe(false)
    expect(shouldPrecache("/__next._full.txt")).toBe(false)
  })

  it("leaves out source maps", () => {
    expect(shouldPrecache("/_next/static/chunks/main.js.map")).toBe(false)
  })

  it("refuses to cache the worker itself", () => {
    expect(shouldPrecache("/sw.js")).toBe(false)
  })

  it("leaves out the v0 placeholder assets", () => {
    // Shipped but never referenced; caching them is pure waste.
    expect(shouldPrecache("/placeholder-logo.svg")).toBe(false)
    expect(shouldPrecache("/placeholder.jpg")).toBe(false)
    expect(shouldPrecache("/placeholder-user.jpg")).toBe(false)
  })

  it("does not mistake a real asset for a placeholder", () => {
    expect(shouldPrecache("/icons/placeholders-guide.png")).toBe(true)
  })

  it("rejects anything that is not a root-relative path", () => {
    expect(shouldPrecache("https://example.com/x.js")).toBe(false)
    expect(shouldPrecache("relative.js")).toBe(false)
    expect(shouldPrecache("")).toBe(false)
  })
})

describe("precacheList", () => {
  it("filters, de-duplicates and sorts", () => {
    expect(
      precacheList(["/b.js", "/a.js", "/a.js", "/index.txt", "/placeholder.svg"]),
    ).toEqual(["/a.js", "/b.js"])
  })

  it("is stable across argument order, so an unchanged build diffs clean", () => {
    const one = precacheList(["/a.js", "/b.js", "/c.css"])
    const two = precacheList(["/c.css", "/b.js", "/a.js"])
    expect(one).toEqual(two)
  })

  it("is empty for an empty build", () => {
    expect(precacheList([])).toEqual([])
  })
})

describe("cacheNameFor", () => {
  it("is stable for the same file list", () => {
    // An unchanged build must keep its cache rather than re-downloading.
    expect(cacheNameFor(["/a.js", "/b.js"])).toBe(cacheNameFor(["/b.js", "/a.js"]))
  })

  it("changes when a file is added, removed or renamed", () => {
    const base = cacheNameFor(["/a.js", "/b.js"])
    expect(cacheNameFor(["/a.js", "/b.js", "/c.js"])).not.toBe(base)
    expect(cacheNameFor(["/a.js"])).not.toBe(base)
    expect(cacheNameFor(["/a.js", "/b-2.js"])).not.toBe(base)
  })

  it("ignores files that are not precached, since they do not affect the cache", () => {
    expect(cacheNameFor(["/a.js", "/x.txt"])).toBe(cacheNameFor(["/a.js"]))
  })

  it("produces a readable, prefixed, fixed-width name", () => {
    expect(cacheNameFor(["/a.js"])).toMatch(/^pomodoro-[0-9a-f]{8}$/)
  })

  it("honours a custom prefix", () => {
    expect(cacheNameFor(["/a.js"], "test")).toMatch(/^test-[0-9a-f]{8}$/)
  })
})
