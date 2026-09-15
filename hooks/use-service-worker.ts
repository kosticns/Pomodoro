"use client"

import { useEffect } from "react"

/**
 * Registers /sw.js.
 *
 * That file is currently a KILL SWITCH, not a caching worker. Registration is
 * kept precisely so it keeps reaching devices: a browser re-checks the worker
 * script on navigation, so anything still stuck on the caching worker that
 * broke the app on 14 Sep 2026 picks this up and repairs itself.
 *
 * Do not delete this registration until that worker is certainly gone from
 * every device. Serving no sw.js at all does not reliably unregister an
 * existing one; serving a worker that unregisters itself does.
 *
 * See scripts/build-sw.mjs for what went wrong and what a safe re-introduction
 * of offline support would have to do differently.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed.", error)
      })
    }

    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })

    return () => window.removeEventListener("load", register)
  }, [])
}
