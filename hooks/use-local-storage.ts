"use client"

import { useState, useCallback } from "react"

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
        }
        return next
      })
    },
    [key],
  )

  return [storedValue, setValue] as const
}

// Notifications Hook
