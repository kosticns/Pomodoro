"use client"

import React from "react"

// import React from "react" // Removed this duplicate import

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Timer,
  BarChart3,
  SettingsIcon,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Bell,
  Check,
  Target,
  ChevronDown,
  Briefcase,
  Coffee,
  Monitor,
  Smartphone,
  Search,
  ListTodo,
  ArrowUpDown,
  CheckSquare,
  Minus,
  Trophy,
  FileText,
  Download,
  PieChart,
  Clock,
  FolderOpen,
  FileJson,
  FileSpreadsheet,
  Upload,
  Heart,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  Sunrise,
  Circle,
  CheckCircle2,
  StickyNote,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import type {
  SessionType,
  TaskStatus,
  ProjectStatus,
  Project,
  Note,
  Task,
  Settings,
  DailyStat,
  TimerState,
  WorkdayTimer,
  PomodoroSession,
} from "@/lib/types"
import { BREAK_ACTIVITIES, LONG_BREAK_ACTIVITIES } from "@/lib/activities"
import { getLocalDateStr, formatRelativeTime, generateTone, playSound } from "@/lib/app-utils"
import { isWorkdayForToday } from "@/lib/workday"
import { recordPostureHeld } from "@/lib/daily-stat"
import { standingCadenceOf, shouldRemindPosture } from "@/lib/posture"
import { buildBackupJSON, buildBackupCSV, backupFilename } from "@/lib/backup"
import { AppStateProvider, useAppState } from "@/lib/app-state"
import { useNotifications } from "@/hooks/use-notifications"
import { useWorkdayTimer } from "@/hooks/use-workday-timer"
import { CustomBarChart } from "@/components/charts/custom-bar-chart"
import { CustomPieChart } from "@/components/charts/custom-pie-chart"

import { MobileTaskSelector } from "@/components/timer/mobile-task-selector"
import { MobileTimerComponent } from "@/components/timer/mobile-timer"
import { MobileTasksManager } from "@/components/tasks/mobile-tasks-manager"
import { MobileBreaksPanel } from "@/components/breaks/mobile-breaks-panel"
import { MobileStatsDashboard } from "@/components/stats/mobile-stats-dashboard"
import { WorkdayTimelineSlider } from "@/components/workday/workday-timeline-slider"
import { MobileSettingsPanel } from "@/components/settings/mobile-settings-panel"
import { MobileWorkdayWidget } from "@/components/workday/mobile-workday-widget"
import { DesktopDashboard } from "@/components/desktop/desktop-dashboard"

const PomodoroApp = () => {
  const [viewMode, setViewMode] = useState<"mobile" | "desktop">("mobile")
  // CHANGE START: Removed "breaks" from navigation
  const [activeView, setActiveView] = useState("timer")
  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
    showNotification,
  } = useNotifications()

  // Persisted domain state now comes from context rather than being declared
  // here and threaded through every panel by hand. See lib/app-state.tsx for
  // why. Defaults and the stat/project migrations moved there with it.
  const {
    settings, setSettings,
    projects, setProjects,
    tasks, setTasks,
    activeTask, setActiveTask,
    notes, setNotes,
    stats, setStats,
  } = useAppState()

  // Add state to track last completed session type for strict alternation
  const [lastCompletedSessionType, setLastCompletedSessionType] = useState<SessionType | null>(null)

  // Backup modal state
  const [showBackupModal, setShowBackupModal] = useState(false)

  // Backup building lives in lib/backup.ts. It used to be duplicated here and
  // in the Settings panel, and the two copies drifted.
  const triggerDownload = useCallback((content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const backupPayload = useCallback(
    () => ({ settings, projects, tasks, stats, notes }),
    [settings, projects, tasks, stats, notes],
  )

  const downloadBackupJSON = useCallback(() => {
    triggerDownload(
      buildBackupJSON(backupPayload()),
      "application/json",
      backupFilename("json", getLocalDateStr()),
    )
  }, [backupPayload, triggerDownload])

  const downloadBackupCSV = useCallback(() => {
    triggerDownload(
      buildBackupCSV(backupPayload()),
      "text/csv",
      backupFilename("csv", getLocalDateStr()),
    )
  }, [backupPayload, triggerDownload])

  // Handle backup modal actions
  const handleBackupAndStart = useCallback((format: "json" | "csv" | "skip") => {
    if (format === "json") {
      downloadBackupJSON()
    } else if (format === "csv") {
      downloadBackupCSV()
    }
    setShowBackupModal(false)
  }, [downloadBackupJSON, downloadBackupCSV])

  // Notify once per stretch when it is time to change posture.
  //
  // The reminder was previously a visual card on the Timer screen and nothing
  // else, so with a 90-minute cadence it asked you to remember to look at the
  // app in order to be reminded. Sessions and workday completion both notify;
  // this closes the gap.
  //
  // Keyed on lastPostureChange so it fires once per stretch rather than on
  // every tick, and resets naturally when the posture changes.
  const notifiedPostureRef = useRef<number | null>(null)

  // Land finished posture stretches in today's stat record, which is what
  // Vitals reads. The hook reports the stretch; storage lives here.
  const recordPosture = useCallback(
    (posture: "sitting" | "standing", minutes: number) => {
      setStats((prev) => recordPostureHeld(prev, getLocalDateStr(), posture, minutes))
    },
    [setStats],
  )

  // Initialize workday timer
  const workdayTimer = useWorkdayTimer(settings, recordPosture)

  // Fire the posture reminder. Runs off timeSincePostureChange, which the hook
  // already recomputes each tick, so no extra timer is needed.
  useEffect(() => {
    const changedAt = workdayTimer.workdayTimer.lastPostureChange
    const due = shouldRemindPosture({
      reminderEnabled: settings.standingReminderEnabled,
      workdayActive: workdayTimer.isWorkdayActive,
      lastPostureChange: changedAt,
      minutesInPosture: workdayTimer.timeSincePostureChange,
      cadenceMinutes: standingCadenceOf(settings),
      lastNotifiedChangeAt: notifiedPostureRef.current,
    })
    if (!due) return

    const standing = workdayTimer.currentPosture === "standing"
    const sent = showNotification(standing ? "Time to sit down" : "Time to stand up", {
      body: `You have been ${standing ? "standing" : "sitting"} for ${workdayTimer.timeSincePostureChange} minutes.`,
      icon: "/icon-192x192.png",
    })
    // Only mark the stretch as handled once the notification actually went
    // out. Marking first meant that if permission was not yet granted, the
    // reminder was lost for the rest of that stretch.
    if (sent) notifiedPostureRef.current = changedAt
  }, [
    workdayTimer.timeSincePostureChange,
    workdayTimer.workdayTimer.lastPostureChange,
    workdayTimer.isWorkdayActive,
    workdayTimer.currentPosture,
    settings,
    showNotification,
  ])

  const durations = useMemo(
    () => ({
      focus: settings.focusDuration * 60,
      shortBreak: settings.shortBreakDuration * 60,
      longBreak: settings.longBreakDuration * 60,
    }),
    [settings],
  )

  const [time, setTime] = useState(durations.focus)
  const [isActive, setIsActive] = useState(false)
  const [sessionType, setSessionType] = useState<SessionType>("focus")
  const [cycleCount, setCycleCount] = useState(0)

  // Add new state variables for tracking the session start time:
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [sessionEndTime, setSessionEndTime] = useState<number | null>(null)

  useEffect(() => {
    if (!isActive || !sessionEndTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((sessionEndTime - now) / 1000))
      setTime(remaining)

      if (remaining === 0) {
        handleTimerComplete()
      }
    }, 100) // Update every 100ms for smooth countdown

    return () => clearInterval(interval)
  }, [isActive, sessionEndTime])

  const onSessionComplete = useCallback(
    (completedTask: Task | null) => {
      if (!completedTask) return

      const updatedTasks = tasks.map((t) =>
        t.id === completedTask.id
          ? {
              ...t,
              completedPomodoros: t.completedPomodoros + 1,
              lastInteractionTime: Date.now(),
            }
          : t,
      )
      setTasks(updatedTasks)

      if (activeTask && activeTask.id === completedTask.id) {
        const updatedActiveTask = updatedTasks.find((t) => t.id === completedTask.id)
        if (updatedActiveTask) {
          setActiveTask(updatedActiveTask)
        }
      }

      const today = getLocalDateStr()
      const todayStats = stats.find((s) => s.date === today)
      const now = Date.now()

      const currentWorkdayTime = workdayTimer.isWorkdayActive
        ? Math.floor((workdayTimer.workdayTimer.duration - workdayTimer.remainingTime) / (1000 * 60))
        : todayStats?.workdayTimeSpent || 0

      const isWorkdayComplete = currentWorkdayTime >= settings.workdayDuration * 60

      // Track which project was worked on and per-project pomodoro counts
      const projectId = completedTask.projectId
      const existingProjects = todayStats?.projectsWorked || []
      const updatedProjects = existingProjects.includes(projectId)
        ? existingProjects
        : [...existingProjects, projectId]
      const existingProjectPom = todayStats?.projectPomodoros || {}
      const updatedProjectPom = {
        ...existingProjectPom,
        [projectId]: (existingProjectPom[projectId] || 0) + 1,
      }

      if (todayStats) {
        setStats(
          stats.map((s) =>
            s.date === today
              ? {
                  ...s,
                  totalPomodoros: s.totalPomodoros + 1,
                  timeSpent: s.timeSpent + settings.focusDuration,
                  workdayStarted: workdayTimer.isWorkdayActive || s.workdayStarted,
                  workdayCompleted: isWorkdayComplete || s.workdayCompleted,
                  workdayTimeSpent: Math.max(currentWorkdayTime, s.workdayTimeSpent),
                  dayStartTime: s.dayStartTime || now,
                  projectsWorked: updatedProjects,
                  projectPomodoros: updatedProjectPom,
                }
              : s,
          ),
        )
      } else {
        setStats([
          ...stats,
          {
            date: today,
            totalPomodoros: 1,
            timeSpent: settings.focusDuration,
            workdayStarted: workdayTimer.isWorkdayActive,
            workdayCompleted: isWorkdayComplete,
  workdayTimeSpent: currentWorkdayTime,
  shortBreakTime: 0,
  longBreakTime: 0,
  shortBreakCount: 0,
  longBreakCount: 0,
  shortBreaksSkipped: 0,
  longBreaksSkipped: 0,
  accumulatedBreakTime: 0,
  dayStartTime: now,
  projectsWorked: [projectId],
  projectPomodoros: { [projectId]: 1 },
  },
        ])
      }
    },
    [sessionType, tasks, setTasks, activeTask, setActiveTask, stats, setStats, settings, workdayTimer],
  )

const skipSession = useCallback(() => {
  // Track the completed session type before transitioning
  setLastCompletedSessionType(sessionType)
  
  // Accumulate break time in stats ONLY if workday has started
  // Breaks skipped before workday starts (leftover from previous day) don't count
  if ((sessionType === "shortBreak" || sessionType === "longBreak") && workdayTimer.isWorkdayActive) {
  const today = getLocalDateStr()
  const todayStats = stats.find((s) => s.date === today)
  const breakDuration = sessionType === "shortBreak" ? settings.shortBreakDuration : settings.longBreakDuration
  
  if (todayStats) {
  setStats(
  stats.map((s) =>
  s.date === today
  ? {
  ...s,
  accumulatedBreakTime: (s.accumulatedBreakTime || 0) + breakDuration,
  shortBreaksSkipped: sessionType === "shortBreak" ? (s.shortBreaksSkipped || 0) + 1 : s.shortBreaksSkipped || 0,
  longBreaksSkipped: sessionType === "longBreak" ? (s.longBreaksSkipped || 0) + 1 : s.longBreaksSkipped || 0,
  }
  : s,
  ),
  )
  } else {
  setStats([
  ...stats,
  {
  date: today,
  totalPomodoros: 0,
  timeSpent: 0,
  workdayStarted: true,
  workdayCompleted: false,
  workdayTimeSpent: 0,
  shortBreakTime: 0,
  longBreakTime: 0,
  shortBreakCount: 0,
  longBreakCount: 0,
  shortBreaksSkipped: sessionType === "shortBreak" ? 1 : 0,
  longBreaksSkipped: sessionType === "longBreak" ? 1 : 0,
  accumulatedBreakTime: breakDuration,
  dayStartTime: Date.now(),
  },
  ])
      }
    }

    if (sessionType === "focus") {
      // After focus, MUST transition to a break
      // No consecutive focus sessions allowed
      setSessionType("shortBreak")
      setTime(durations.shortBreak)
    } else if (sessionType === "shortBreak") {
      // After short break, check if it's time for long break or back to focus
      if (cycleCount + 1 >= settings.cyclesBeforeLongBreak) {
        // After completing the cycle, go to long break instead of focus
        setSessionType("longBreak")
        setTime(durations.longBreak)
      } else {
        // After short break, MUST go back to focus
        setSessionType("focus")
        setTime(durations.focus)
        setCycleCount(cycleCount + 1)
      }
    } else {
      // After long break, MUST go back to focus and reset cycle
      setSessionType("focus")
      setTime(durations.focus)
      setCycleCount(0)
    }
    setIsActive(false)
    setSessionStartTime(null)
    setSessionEndTime(null)
  }, [sessionType, cycleCount, settings.cyclesBeforeLongBreak, durations, stats, setStats, workdayTimer.isWorkdayActive])

  const handleTimerComplete = useCallback(() => {
    const today = getLocalDateStr()
    const todayStats = stats.find((s) => s.date === today)
    const now = Date.now()

    if (sessionType === "shortBreak" || sessionType === "longBreak") {
      const breakTimeSpent = Math.round(durations[sessionType] / 60)

      if (todayStats) {
        setStats(
          stats.map((s) =>
            s.date === today
              ? {
                  ...s,
                  shortBreakTime:
                    sessionType === "shortBreak" ? (s.shortBreakTime || 0) + breakTimeSpent : s.shortBreakTime || 0,
                  longBreakTime:
                    sessionType === "longBreak" ? (s.longBreakTime || 0) + breakTimeSpent : s.longBreakTime || 0,
                  shortBreakCount: sessionType === "shortBreak" ? (s.shortBreakCount || 0) + 1 : s.shortBreakCount || 0,
                  longBreakCount: sessionType === "longBreak" ? (s.longBreakCount || 0) + 1 : s.longBreakCount || 0,
                  dayStartTime: s.dayStartTime || now,
                }
              : s,
          ),
        )
      } else {
        setStats([
          ...stats,
          {
            date: today,
            totalPomodoros: 0,
            timeSpent: 0,
            workdayStarted: false,
            workdayCompleted: false,
            workdayTimeSpent: 0,
            shortBreakTime: sessionType === "shortBreak" ? breakTimeSpent : 0,
            longBreakTime: sessionType === "longBreak" ? breakTimeSpent : 0,
            shortBreakCount: sessionType === "shortBreak" ? 1 : 0,
  longBreakCount: sessionType === "longBreak" ? 1 : 0,
  shortBreaksSkipped: 0,
  longBreaksSkipped: 0,
  accumulatedBreakTime: 0,
  dayStartTime: now,
  },
        ])
      }
    }

    // Track the completed session type before transitioning
    setLastCompletedSessionType(sessionType)

    if (sessionType === "focus") {
      // RULE: After focus, MUST transition to a break
      // No consecutive focus sessions allowed
      onSessionComplete(activeTask)
      playSound(settings.focusEndSound, settings)
      const newCycleCount = cycleCount + 1
      setCycleCount(newCycleCount)

      if (newCycleCount % settings.cyclesBeforeLongBreak === 0) {
        // Time for long break after completing the cycle
        setSessionType("longBreak")
        setTime(durations.longBreak)
        showNotification("Focus complete!", { body: "Time for a long break." })
      } else {
        // Time for short break
        setSessionType("shortBreak")
        setTime(durations.shortBreak)
        showNotification("Focus complete!", { body: "Time for a short break." })
      }
    } else {
      // RULE: After any break (short or long), MUST transition to focus
      // No consecutive breaks allowed
      playSound(settings.breakEndSound, settings)
      setSessionType("focus")
      setTime(durations.focus)
      showNotification("Break's over!", { body: "Time to get back to focus." })
    }

    setSessionStartTime(null)
    setSessionEndTime(null)
    setIsActive(false)
  }, [sessionType, activeTask, onSessionComplete, stats, setStats, settings, cycleCount, durations, showNotification])

  // Update the toggleTimer function:
  const toggleTimer = async () => {
    const newIsActive = !isActive

    if (newIsActive) {
      console.log("[v0] Starting Pomodoro timer - Session type:", sessionType)
      const now = Date.now()

      // Auto-start the workday with the first focus session of the day.
      //
      // Two things this has to get right, both of which it got wrong before:
      //
      // 1. Ask whether a workday started TODAY, not whether one ever started.
      //    The old condition was `!workdayTimer.workdayTimer.startTime`, and
      //    yesterday's start time persists in localStorage, so on a new day it
      //    was false and this block never ran. Play started the pomodoro but
      //    never began the new workday.
      //
      // 2. Compare the dates HERE, at call time, rather than using a value
      //    computed during render. Nothing re-renders at midnight, so a
      //    render-time flag is stale for a session left open overnight, which
      //    is exactly the case this fixes. getLocalDateStr() must be called
      //    inside this handler.
      // getLocalDateStr() is read HERE, when the user acts, not during render.
      const workdayStartedToday = isWorkdayForToday(workdayTimer.workdayTimer, getLocalDateStr())

      if (sessionType === "focus" && !workdayStartedToday) {
        setShowBackupModal(true)
        workdayTimer.startWorkdayTimer()
      }

      // Auto-unpause the workday if it is paused.
      //
      // Also gated on today. toggleWorkdayPause spreads the workdayTimer it
      // captured in this render, so on a new day it would write yesterday's
      // start time and paused duration straight over the workday that the
      // block above has just started.
      if (workdayTimer.isPaused && workdayStartedToday) {
        workdayTimer.toggleWorkdayPause()
      }

      // Set session timing
      const endTime = now + time * 1000
      setSessionStartTime(now)
      setSessionEndTime(endTime)
      setIsActive(true)

      // Set dayStartTime for stats tracking
      const today = getLocalDateStr()
      const todayStatsIndex = stats.findIndex((s) => s.date === today)
      if (sessionType === "focus" && todayStatsIndex !== -1 && stats[todayStatsIndex].dayStartTime === null) {
        setStats((prevStats) =>
          prevStats.map((s, index) => (index === todayStatsIndex ? { ...s, dayStartTime: now } : s)),
        )
      } else if (sessionType === "focus" && todayStatsIndex === -1) {
        // If today's stats don't exist yet, create them with dayStartTime
        setStats((prevStats) => [
          ...prevStats,
          {
            date: today,
            totalPomodoros: 0,
            timeSpent: 0,
            workdayStarted: false,
            workdayCompleted: false,
  workdayTimeSpent: 0,
  shortBreakTime: 0,
  longBreakTime: 0,
  shortBreakCount: 0,
  longBreakCount: 0,
  shortBreaksSkipped: 0,
  longBreaksSkipped: 0,
  accumulatedBreakTime: 0,
  dayStartTime: now,
  },
  ])
  }

      await playSound(settings.startSound, settings)
    } else {
      // Pausing Pomodoro timer
      console.log("[v0] Pausing Pomodoro timer")
      setIsActive(false)
    }
  }

  // Update the resetTimer function:
  const resetTimer = useCallback(() => {
    setIsActive(false)
    setSessionStartTime(null)
    setSessionEndTime(null)
    setTime(durations[sessionType])
  }, [sessionType, durations])

  // Removed the auto-resume effect as it's now handled within toggleTimer when workday is unpaused.

  useEffect(() => {
    const handleBeforeUnload = () => {
      const stateToSave: TimerState = {
        time,
        isActive,
        sessionType,
        cycleCount,
        timestamp: Date.now(),
        sessionStartTime,
        sessionEndTime,
      }
      localStorage.setItem("timerState", JSON.stringify(stateToSave))
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    try {
      const savedStateRaw = localStorage.getItem("timerState")
      if (savedStateRaw) {
        const savedState = JSON.parse(savedStateRaw) as TimerState

        if (savedState.isActive && savedState.sessionEndTime) {
          const now = Date.now()
          const remainingTime = Math.max(0, Math.ceil((savedState.sessionEndTime - now) / 1000))

          if (remainingTime > 0) {
            setTime(remainingTime)
            setSessionType(savedState.sessionType)
            setCycleCount(savedState.cycleCount)
            setSessionStartTime(savedState.sessionStartTime)
            setSessionEndTime(savedState.sessionEndTime)
            setIsActive(true)

            // Check if workday timer needs to be resumed
            if (workdayTimer.isPaused && workdayTimer.pomodoroWasPausedByWorkday) {
              console.log(
                "[v0] Restoring Pomodoro timer active state. Workday timer was paused. Attempting to unpause workday.",
              )
              workdayTimer.toggleWorkdayPause() // This will unpause workday and attempt to resume Pomodoro
            }
          } else {
            // Session expired while away
            setTime(durations[savedState.sessionType] || durations.focus)
            setSessionType(savedState.sessionType || "focus")
            setCycleCount(savedState.cycleCount || 0)
            setIsActive(false)
            setSessionStartTime(null)
            setSessionEndTime(null)
          }
        } else {
          setTime(durations[savedState.sessionType] || durations.focus)
          setSessionType(savedState.sessionType || "focus")
          setCycleCount(savedState.cycleCount || 0)
          setIsActive(false)
          setSessionStartTime(null)
          setSessionEndTime(null)
        }
        localStorage.removeItem("timerState")
      }
    } catch (error) {
      console.error("Failed to load timer state", error)
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      handleBeforeUnload() // Ensure state is saved on unmount
    }
  }, [])

  const navItems = [
  { id: "timer", label: "Timer", icon: Timer },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "breaks", label: "Breaks", icon: Coffee },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  ]

  const renderView = () => {
    switch (activeView) {
  case "timer":
  return (
  <MobileTimerComponent
  key="timer-view"
  sessionType={sessionType}
  time={time}
  isActive={isActive}
  cycleCount={cycleCount}
  toggleTimer={toggleTimer}
  resetTimer={resetTimer}
  skipSession={skipSession}
  workdayTimer={workdayTimer}
  />
        )
      case "tasks":
        return (
  <MobileTasksManager
  key="tasks-view"
  />
        )
      case "breaks":
        return (
          <MobileBreaksPanel
            key="breaks-view"
          />
        )
      case "stats":
        return (
          <MobileStatsDashboard
            key="stats-view"
            workdayTimer={workdayTimer}
          />
        )
  case "settings":
  return (
  <MobileSettingsPanel
  key="settings-view"
  notificationPermission={notificationPermission}
  requestNotificationPermission={requestNotificationPermission}
  workdayTimer={workdayTimer}
  />
  )
      default:
        return null
    }
  }

  return (
    // h-dvh, not min-h-screen. With min-height the column grows past the
    // viewport when its content is tall, so <main> never scrolls and the
    // fixed nav ends up covering whatever sits in the last 65px. dvh also
    // tracks mobile browser chrome showing and hiding.
    <div className="h-dvh bg-background text-foreground flex flex-col">
      {viewMode === "mobile" && (
        <div className="flex items-center justify-center p-4 border-b border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("desktop")}
            className="gap-2 hover:bg-primary/10"
          >
            <Monitor className="h-4 w-4" />
            Switch to Desktop View
          </Button>
        </div>
      )}

      {viewMode === "desktop" ? (
        <DesktopDashboard
          sessionType={sessionType}
          time={time}
          isActive={isActive}
          cycleCount={cycleCount}
          workdayTimer={workdayTimer}
          toggleTimer={toggleTimer}
          resetTimer={resetTimer}
          skipSession={skipSession}
          setViewMode={setViewMode}
          startWorkdayTimer={workdayTimer.startWorkdayTimer}
          resetWorkdayTimer={workdayTimer.resetWorkdayTimer}
          formatWorkdayTime={workdayTimer.formatWorkdayTime}
          isWorkdayActive={workdayTimer.isWorkdayActive}
          workdayProgress={workdayTimer.workdayProgress}
        />
      ) : (
        <>
          {/* Main Content.
              min-h-0 is load-bearing. A flex item defaults to min-height:auto,
              so without it this refuses to shrink below its content, the
              overflow-y-auto never engages, and the column pushes past the
              viewport. That is what put the Start button under the nav.
              pb-[calc(...)] clears the fixed nav plus the iOS home indicator. */}
          <main
            key={activeView}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative pb-[calc(5rem+env(safe-area-inset-bottom))]"
          >
            {/* h-full, not min-h-full. The screens below use flex-1 on their
                flexible element, which needs a definite height to distribute
                against. With min-h-full this box is auto-height and those
                children collapse. */}
            <div className="h-full w-full">{renderView()}</div>
          </main>

          {/* Mobile Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 flex border-t bg-background/95 backdrop-blur-sm z-50 pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  "flex-1 flex flex-col items-center justify-center h-16 rounded-none space-y-1 transition-colors min-w-0",
                  activeView === item.id
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
                onClick={() => setActiveView(item.id)}
              >
                <item.icon className={cn("h-5 w-5", activeView === item.id && "text-glow")} />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            ))}
          </nav>
        </>
      )}
      
      {/* Daily Backup Modal */}
      <Dialog open={showBackupModal} onOpenChange={setShowBackupModal}>
        <DialogContent className="w-[90vw] max-w-sm border-primary/30 bg-background/95 backdrop-blur-sm">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold text-primary">Daily Backup</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Save your progress before starting today&apos;s work
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-3 py-4">
            <Button
              onClick={() => handleBackupAndStart("json")}
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 border-primary/30 hover:bg-primary/10 hover:border-primary"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <FileJson className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="text-center">
                <div className="font-medium text-foreground">JSON</div>
                <div className="text-[10px] text-muted-foreground">Full backup</div>
              </div>
            </Button>
            
            <Button
              onClick={() => handleBackupAndStart("csv")}
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 border-primary/30 hover:bg-primary/10 hover:border-primary"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-center">
                <div className="font-medium text-foreground">CSV</div>
                <div className="text-[10px] text-muted-foreground">Spreadsheet</div>
              </div>
            </Button>
          </div>
          
          <Button
            onClick={() => handleBackupAndStart("skip")}
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Skip for today
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function Page() {
  return (
    <AppStateProvider>
      <PomodoroApp />
    </AppStateProvider>
  )
}
