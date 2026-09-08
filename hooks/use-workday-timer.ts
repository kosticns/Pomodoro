"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { Settings, WorkdayTimer } from "@/lib/types"
import { useLocalStorage } from "./use-local-storage"
import { getLocalDateStr } from "@/lib/app-utils"
import { isWorkdayForToday } from "@/lib/workday"

/**
 * @param onPostureHeld Called when a posture ENDS, with how long it was held.
 *   The hook deliberately does not write to stats itself; storage stays out of
 *   here and the caller decides where the minutes land.
 */
export const useWorkdayTimer = (
  settings: Settings,
  onPostureHeld?: (posture: "sitting" | "standing", minutes: number) => void,
) => {
  const [workdayTimer, setWorkdayTimer] = useLocalStorage<WorkdayTimer>("workdayTimer", {
  startTime: null,
  duration: settings.workdayDuration * 60 * 60 * 1000,
  date: "",
  isPaused: false,
  pausedAt: null,
  pausedDuration: 0,
  currentPosture: "sitting",
  lastPostureChange: null,
  })

  const [remainingTime, setRemainingTime] = useState<number>(() => {
    if (workdayTimer.startTime) {
      const now = Date.now()
      if (workdayTimer.isPaused && workdayTimer.pausedAt) {
        // If paused, calculate from when it was paused
        const elapsed = workdayTimer.pausedAt - workdayTimer.startTime - workdayTimer.pausedDuration
        return Math.max(0, workdayTimer.duration - elapsed)
      } else {
        // If running, calculate from current time
        const elapsed = now - workdayTimer.startTime - workdayTimer.pausedDuration
        return Math.max(0, workdayTimer.duration - elapsed)
      }
    }
    return 0
  })

  // State for Pomodoro timer pause state
  const [pomodoroWasPausedByWorkday, setPomodoroWasPausedByWorkday] = useState(false)
  const [pomodoroTimeWhenPaused, setPomodoroTimeWhenPaused] = useState<number | null>(null)

  // Start workday timer
  const startWorkdayTimer = useCallback(() => {
    const today = getLocalDateStr()
    const now = Date.now()

    console.log("startWorkdayTimer called")
    console.log("Current workday date:", workdayTimer.date)
    console.log("Today:", today)
    console.log("Current start time:", workdayTimer.startTime)

  // Only start if it's a new day or no timer is running
  if (workdayTimer.date !== today || !workdayTimer.startTime) {
  const newTimer = {
  startTime: now,
  duration: settings.workdayDuration * 60 * 60 * 1000,
  date: today,
  isPaused: false,
  pausedAt: null,
  pausedDuration: 0,
  currentPosture: "sitting" as const,
  lastPostureChange: now,
  }
      console.log("Setting new workday timer:", newTimer)
      setWorkdayTimer(newTimer)
      // Immediately set remaining time
      setRemainingTime(newTimer.duration)
    }
  }, [workdayTimer, settings.workdayDuration, setWorkdayTimer])

  const toggleWorkdayPause = useCallback(() => {
    const now = Date.now()

    if (workdayTimer.isPaused) {
      // Unpausing workday timer
      const pauseDuration = workdayTimer.pausedAt ? now - workdayTimer.pausedAt : 0
      const newTimer = {
        ...workdayTimer,
        isPaused: false,
        pausedAt: null,
        pausedDuration: workdayTimer.pausedDuration + pauseDuration,
      }
      setWorkdayTimer(newTimer)

      // Recalculate remaining time when resuming
      const elapsed = now - newTimer.startTime! - newTimer.pausedDuration
      const remaining = Math.max(0, newTimer.duration - elapsed)
      setRemainingTime(remaining)

      console.log("[v0] Workday timer unpaused, remaining time:", remaining)
    } else {
      // Pausing workday timer
      const elapsed = now - workdayTimer.startTime! - workdayTimer.pausedDuration
      const currentRemainingTime = Math.max(0, workdayTimer.duration - elapsed)

      setWorkdayTimer({
        ...workdayTimer,
        isPaused: true,
        pausedAt: now,
      })

      setRemainingTime(currentRemainingTime)
      console.log("[v0] Workday timer paused, remaining time:", currentRemainingTime)
    }
  }, [workdayTimer, setWorkdayTimer])

  // Reset workday timer (for new day)
  const resetWorkdayTimer = useCallback(() => {
    console.log("Resetting workday timer")
    setWorkdayTimer({
      startTime: null,
      duration: settings.workdayDuration * 60 * 60 * 1000,
      date: "",
      isPaused: false,
      pausedAt: null,
      pausedDuration: 0,
      // Reset dropped these two, leaving the posture tracker with no state to
      // read. Matches the initial default in useWorkdayTimer.
      currentPosture: "sitting",
      lastPostureChange: null,
    })
    setRemainingTime(0)
  }, [settings.workdayDuration, setWorkdayTimer])

  const isWorkdayActive = workdayTimer.startTime !== null && !workdayTimer.isPaused
  const hasWorkdayStarted = workdayTimer.startTime !== null

  /**
   * Has a workday been started FOR TODAY? For DISPLAY only.
   *
   * `hasWorkdayStarted` above only asks whether a start time exists at all, so
   * it stays true overnight and reads as "already started" on the new day.
   *
   * CAUTION: this is computed during render, and nothing re-renders at
   * midnight, so it is stale for a session left open overnight until the
   * rollover poll below fires. Do NOT gate an action on it. An event handler
   * must call getLocalDateStr() itself and compare, so the date is read when
   * the user acts. app/page.tsx toggleTimer does exactly that.
   */
  const hasWorkdayStartedToday = isWorkdayForToday(workdayTimer)

  /**
   * Roll the workday over at midnight, even when the app is never reloaded.
   *
   * This replaces a mount-only check. Two reasons that was not enough for an
   * app you leave open on a phone:
   *   - a mount-only effect cannot see the date change during a session
   *   - the ticking interval below recomputes remaining time every second but
   *     never re-checks the date
   * So a workday started yesterday stayed "started" all through today, and
   * pressing play could not begin the new day.
   *
   * Polls rather than reacting, because nothing in React state changes at
   * midnight. 30s is far below any resolution the user can perceive here, and
   * the check is two string comparisons.
   */
  useEffect(() => {
    const rollOverIfNewDay = () => {
      if (workdayTimer.startTime && !isWorkdayForToday(workdayTimer)) {
        resetWorkdayTimer()
      }
    }
    rollOverIfNewDay() // also covers the old mount-time case
    const id = setInterval(rollOverIfNewDay, 30_000)
    return () => clearInterval(id)
  }, [workdayTimer.startTime, workdayTimer.date, resetWorkdayTimer])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (workdayTimer.startTime && !workdayTimer.isPaused) {
      const today = getLocalDateStr()

      // Reset if it's a new day - only check when timer is running
      if (workdayTimer.date !== today) {
        console.log("New day detected, resetting workday timer")
        resetWorkdayTimer()
        return
      }

      console.log("Starting workday timer interval")
      interval = setInterval(() => {
        const now = Date.now()
        const elapsed = now - workdayTimer.startTime! - workdayTimer.pausedDuration
        const remaining = Math.max(0, workdayTimer.duration - elapsed)
        setRemainingTime(remaining)

        if (remaining === 0) {
          // Workday completed - show notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Workday Complete!", {
              body: `You've completed your ${settings.workdayDuration}-hour workday. Great job!`,
              icon: "/icon-192x192.png",
            })
          }
          clearInterval(interval!)
        }
      }, 1000)
    }
    // The remaining time is now locked when pause is clicked and stays stable

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [
    workdayTimer.startTime,
    workdayTimer.isPaused,
    workdayTimer.date,
    workdayTimer.pausedDuration,
    workdayTimer.duration,
    resetWorkdayTimer,
    settings.workdayDuration,
  ])

  const formatWorkdayTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    } else {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }
  }

  const workdayProgress = useMemo(() => {
    if (!workdayTimer.startTime) {
      // Check if workday was completed today from stats - only on client side
      if (typeof window !== "undefined") {
        const today = getLocalDateStr()
        const todayStats = JSON.parse(localStorage.getItem("stats") || "[]").find((s: any) => s.date === today)

        if (todayStats?.workdayCompleted || todayStats?.workdayTimeSpent >= settings.workdayDuration * 60) {
          return 100
        }
      }
      return 0
    }

    const elapsed = (Date.now() - workdayTimer.startTime - workdayTimer.pausedDuration) / workdayTimer.duration
    return Math.min(100, Math.max(0, elapsed * 100))
  }, [
    workdayTimer.startTime,
    workdayTimer.duration,
    remainingTime,
    settings.workdayDuration,
    workdayTimer.pausedDuration,
    workdayTimer.isPaused,
  ])

  console.log("Workday timer state:", {
  isWorkdayActive,
  hasWorkdayStarted,
  workdayProgress,
  remainingTime,
  startTime: workdayTimer.startTime,
  date: workdayTimer.date,
  isPaused: workdayTimer.isPaused,
  })
  
  // Posture management
  const togglePosture = () => {
    const now = Date.now()
    // Report the stretch being closed before overwriting lastPostureChange,
    // otherwise the elapsed time is unrecoverable.
    const heldMinutes = workdayTimer.lastPostureChange
      ? Math.floor((now - workdayTimer.lastPostureChange) / 60000)
      : 0
    if (heldMinutes > 0) {
      onPostureHeld?.(workdayTimer.currentPosture || "sitting", heldMinutes)
    }
    setWorkdayTimer({
      ...workdayTimer,
      currentPosture: workdayTimer.currentPosture === "sitting" ? "standing" : "sitting",
      lastPostureChange: now,
    })
  }
  
  const timeSincePostureChange = useMemo(() => {
  if (!workdayTimer.lastPostureChange || !isWorkdayActive) return 0
  return Math.floor((Date.now() - workdayTimer.lastPostureChange) / 1000 / 60) // in minutes
  }, [workdayTimer.lastPostureChange, isWorkdayActive, remainingTime]) // remainingTime triggers recalc
  
  // Reduce workday duration (for using accumulated break time to shorten workday)
  const reduceWorkdayDuration = (reductionMs: number) => {
    if (workdayTimer.startTime) {
      setWorkdayTimer({
        ...workdayTimer,
        duration: Math.max(0, workdayTimer.duration - reductionMs),
      })
    }
  }
  
  // Set workday progress by dragging (percent 0-100 of elapsed time)
  // Adjusts startTime so the elapsed/remaining reflects the dragged position
  const setWorkdayProgress = (percent: number) => {
    if (workdayTimer.startTime) {
      const clamped = Math.min(100, Math.max(0, percent))
      const newElapsed = (workdayTimer.duration * clamped) / 100
      // elapsed = now - startTime - pausedDuration  =>  startTime = now - elapsed - pausedDuration
      const newStartTime = Date.now() - newElapsed - workdayTimer.pausedDuration
      setWorkdayTimer({
        ...workdayTimer,
        startTime: newStartTime,
      })
      setRemainingTime(Math.max(0, workdayTimer.duration - newElapsed))
    }
  }
  
  // Expose new state for Pomodoro pause/resume
  return {
    startWorkdayTimer,
    resetWorkdayTimer,
    remainingTime,
    formatWorkdayTime,
    isWorkdayActive,
    workdayProgress,
    workdayTimer, // Pass the whole object for access to isPaused etc.
    toggleWorkdayPause, // Expose the new toggle function
    isPaused: workdayTimer.isPaused, // Expose pause state
  hasWorkdayStarted,
  hasWorkdayStartedToday,
  // New exports for Pomodoro pause handling
  pomodoroWasPausedByWorkday,
  setPomodoroWasPausedByWorkday,
  pomodoroTimeWhenPaused,
  setPomodoroTimeWhenPaused,
  // Posture management
  togglePosture,
  currentPosture: workdayTimer.currentPosture || "sitting",
  timeSincePostureChange,
  // Workday duration management
  reduceWorkdayDuration,
  setWorkdayProgress,
  }
  }

// Mobile-First Components
