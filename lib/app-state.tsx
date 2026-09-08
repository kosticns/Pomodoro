"use client"

import React, { createContext, useContext, useEffect } from "react"
import { useLocalStorage } from "@/hooks/use-local-storage"
import type { Settings, Project, Task, Note, DailyStat } from "./types"
import { DEFAULT_STANDING_CADENCE_MINUTES, needsCadenceMigration } from "./posture"

/**
 * The app's persisted domain state, in one place.
 *
 * This exists because of a specific failure. Every panel used to receive
 * `stats`, `setStats`, `projects`, `setProjects`, `tasks` and `setTasks` as
 * props, threaded by hand through the component tree. On 3 Sep 2026 five
 * separate crashes turned out to be a setter that was simply never passed
 * down, or was passed but left out of a destructuring list. Nothing warned;
 * the identifier was just undefined until a user reached that code path.
 *
 * Reading from a context removes the threading, and `useAppState` throws when
 * there is no provider, so the failure is loud and immediate instead of
 * waiting in an unvisited tab.
 *
 * DELIBERATELY NOT HERE: the timer engine (`time`, `isActive`, `sessionType`).
 * It ticks every second, and anything in this context re-renders every
 * consumer when it changes. The timer stays a prop to the two components that
 * actually need it.
 */

type Setter<T> = (value: T | ((prev: T) => T)) => void

interface AppState {
  settings: Settings
  setSettings: Setter<Settings>
  projects: Project[]
  setProjects: Setter<Project[]>
  tasks: Task[]
  setTasks: Setter<Task[]>
  activeTask: Task | null
  setActiveTask: Setter<Task | null>
  notes: Note[]
  setNotes: Setter<Note[]>
  stats: DailyStat[]
  setStats: Setter<DailyStat[]>
}

const AppStateContext = createContext<AppState | null>(null)

export const DEFAULT_SETTINGS: Settings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  cyclesBeforeLongBreak: 4,
  autoStartNextSession: false,
  soundEnabled: true,
  soundVolume: 0.5,
  focusEndSound: "bell.mp3",
  breakEndSound: "chime.mp3",
  startSound: "start.mp3",
  workdayDuration: 8,
  dailyPomodoroGoal: 10,
  standingReminderEnabled: true,
  standingCadence: DEFAULT_STANDING_CADENCE_MINUTES,
}

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "1",
    name: "Default Project",
    status: "Ongoing",
    createdAt: Date.now(),
    lastInteractionTime: Date.now(),
  },
]

/** Fills in fields added after a stat was first written. */
export function migrateStats(raw: any[]): DailyStat[] {
  return raw.map((stat) => ({
    date: stat.date,
    totalPomodoros: stat.totalPomodoros || 0,
    timeSpent: stat.timeSpent || 0,
    workdayStarted: stat.workdayStarted || false,
    workdayCompleted: stat.workdayCompleted || false,
    workdayTimeSpent: stat.workdayTimeSpent || 0,
    shortBreakTime: stat.shortBreakTime || 0,
    longBreakTime: stat.longBreakTime || 0,
    shortBreakCount: stat.shortBreakCount || 0,
    longBreakCount: stat.longBreakCount || 0,
    shortBreaksSkipped: stat.shortBreaksSkipped || 0,
    longBreaksSkipped: stat.longBreaksSkipped || 0,
    accumulatedBreakTime: stat.accumulatedBreakTime || 0,
    dayStartTime: stat.dayStartTime || null,
    projectsWorked: stat.projectsWorked || [],
    projectPomodoros: stat.projectPomodoros || undefined,
    // Posture fields default to 0 rather than undefined so the Vitals maths
    // never has to guard. A pre-2026-09-08 day legitimately has no posture
    // history, and 0 is the honest value for it.
    sittingMinutes: stat.sittingMinutes || 0,
    standingMinutes: stat.standingMinutes || 0,
    postureSwitches: stat.postureSwitches || 0,
    longestSitStretch: stat.longestSitStretch || 0,
    longestStandStretch: stat.longestStandStretch || 0,
  }))
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useLocalStorage<Settings>("settings", DEFAULT_SETTINGS)
  const [projects, setProjects] = useLocalStorage<Project[]>("projects", DEFAULT_PROJECTS)
  const [tasks, setTasks] = useLocalStorage<Task[]>("tasks", [])
  const [activeTask, setActiveTask] = useLocalStorage<Task | null>("activeTask", null)
  const [notes, setNotes] = useLocalStorage<Note[]>("notes", [])
  const [stats, setStats] = useLocalStorage<DailyStat[]>("stats", [])

  // Backfill timestamps on projects saved before those fields existed.
  useEffect(() => {
    setProjects((prev) => {
      const needsMigration = prev.some((p) => !p.createdAt || p.createdAt <= 0)
      if (!needsMigration) return prev
      return prev.map((p) => ({
        ...p,
        createdAt: p.createdAt && p.createdAt > 0 ? p.createdAt : Date.now(),
        lastInteractionTime:
          p.lastInteractionTime && p.lastInteractionTime > 0 ? p.lastInteractionTime : Date.now(),
      }))
    })
    // Uses the functional form so it reads current state rather than a
    // mount-time closure. The previous version depended on closure timing,
    // which is what made the old "To Do" migration so fragile.
  }, [setProjects])

  // Move the sit/stand cadence off the old 45-minute default.
  //
  // Changing DEFAULT_SETTINGS only affects a fresh install, because a stored
  // settings object replaces the defaults wholesale. Without this, an existing
  // device would keep prompting every 45 minutes. Only the exact old default
  // is touched; see needsCadenceMigration for why that is the safe boundary.
  //
  // Returns prev unchanged when there is nothing to do. useLocalStorage's
  // setter writes on every call, so an unconditional write would churn
  // storage on each mount.
  useEffect(() => {
    setSettings((prev) =>
      needsCadenceMigration(prev)
        ? { ...prev, standingCadence: DEFAULT_STANDING_CADENCE_MINUTES }
        : prev,
    )
  }, [setSettings])

  useEffect(() => {
    setStats((prev) => (prev.length ? migrateStats(prev) : prev))
  }, [setStats])

  const value: AppState = {
    settings, setSettings,
    projects, setProjects,
    tasks, setTasks,
    activeTask, setActiveTask,
    notes, setNotes,
    stats, setStats,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error(
      "useAppState() was called outside <AppStateProvider>. Wrap the tree in app/page.tsx.",
    )
  }
  return ctx
}
