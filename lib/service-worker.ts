/**
 * What the service worker precaches, and under what cache name.
 *
 * The app is a static export: 44 files, one HTML entry, no server. That is
 * small enough to precache whole, which makes "works offline" a property of
 * the build rather than something that depends on what you happened to visit.
 *
 * `@serwist/next` was the obvious candidate and was rejected: it adds a
 * dependency and a build plugin to generate a manifest that, for a static
 * export with no runtime, can be produced deterministically by walking the
 * output directory. The selection rules live here so they can be tested
 * without running a build.
 */

/** Files that must never be precached. */
const NEVER_PRECACHE = [
  // Next's flight/RSC payloads. Nothing in this app reads them at runtime,
  // and they change on every build.
  ".txt",
  // Source maps are large and only useful with devtools open.
  ".map",
  // The worker cannot usefully cache itself.
  "/sw.js",
]

/** v0 scaffolding still sitting in public/. Shipping it is enough; caching it is waste. */
const PLACEHOLDER = /(^|\/)placeholder[-.]/

export function shouldPrecache(path: string): boolean {
  if (!path.startsWith("/")) return false
  if (NEVER_PRECACHE.some((suffix) => path.endsWith(suffix) || path === suffix)) return false
  if (PLACEHOLDER.test(path)) return false
  return true
}

/**
 * The precache list, given every file in the build output.
 *
 * Sorted so the same build always produces the same manifest, which keeps the
 * generated worker stable in git and makes a real change visible in a diff.
 */
export function precacheList(paths: string[]): string[] {
  return [...new Set(paths.filter(shouldPrecache))].sort()
}

/**
 * A cache name derived from the contents of the precache list.
 *
 * Deriving it from the file list rather than a timestamp means an unchanged
 * build keeps its cache, and a changed build gets a new one and evicts the old
 * on activate. A timestamp would throw the cache away on every deploy, which
 * is the opposite of the point.
 */
export function cacheNameFor(paths: string[], prefix = "pomodoro"): string {
  const joined = precacheList(paths).join("\n")
  // FNV-1a. Short, dependency-free, and this is a cache key rather than
  // anything that needs to resist an attacker.
  let hash = 0x811c9dc5
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${prefix}-${hash.toString(16).padStart(8, "0")}`
}
