"use client"

import { useState, useCallback, useSyncExternalStore } from "react"
import {
  getStorageFailure,
  reportStorageFailure,
  subscribeStorageHealth,
} from "@/lib/storage-health"

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      if (item === null) return initialValue
      return JSON.parse(item)
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Stable identity, so this is safe to list in a useEffect dependency array.
  // The previous version was recreated every render, which made depending on
  // it an infinite loop and pushed callers into empty dep arrays and
  // mount-time closures.
  //
  // It also resolves updater functions against `prev` rather than the
  // `storedValue` captured in this render's closure. The old form dropped
  // writes when two updates happened before a re-render.
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? (value as (val: T) => T)(prev) : value
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(next))
          }
        } catch (error) {
          console.error(`Error setting localStorage key "${key}":`, error)
          // Previously this was the end of it: the error went to the console and
          // the value was returned anyway, so the screen showed the edit as
          // saved when nothing had been written. Report it so the app can say
          // so. The value is still returned, because refusing the state update
          // would lose the edit from the screen as well as from storage.
          reportStorageFailure(key, error)
        }
        return next
      })
    },
    [key],
  )

  return [storedValue, setValue] as const
}

/**
 * The current storage failure, or null. Subscribes to the module store rather
 * than widening every useLocalStorage tuple.
 *
 * Server snapshot is null: there is no localStorage to fail during a render
 * that never touches it.
 */
export function useStorageHealth() {
  return useSyncExternalStore(subscribeStorageHealth, getStorageFailure, () => null)
}

// Notifications Hook
