"use client"

import { useEffect } from "react"

/**
 * Registers the generated service worker.
 *
 * Deliberately quiet: offline support is not something the user asked for and
 * should not announce itself. A registration failure is logged and otherwise
 * ignored, because the app works perfectly well online without it.
 *
 * Only runs in production. In `pnpm dev` there is no out/sw.js to register,
 * and a stale worker caching a dev build is a genuinely confusing bug.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    // After load, so registration never competes with the first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed; the app still works online.", error)
      })
    }

    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })

    return () => window.removeEventListener("load", register)
  }, [])
}
