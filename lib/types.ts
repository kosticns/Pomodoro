// Domain types for the Pomodoro app. Extracted from app/page.tsx.

export type SessionType = "focus" | "shortBreak" | "longBreak"
// "To Do" is the paused state. Putting a project On Hold moves its in-progress
// tasks here, and the Daily Review offers it as an explicit action.
//
// It was missing from this union while three UI branches and two write paths
// used it. Nothing crashed, but it took those paths outside type checking,
// which is how the status sort order below ended up with no "To Do" entry and
// therefore an NaN comparator.
export type TaskStatus = "To Do" | "In Progress" | "Done"
export type ProjectStatus = "On Hold" | "Ongoing" | "Done"

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  createdAt: number
  lastInteractionTime: number
}

export interface Note {
  id: string
  content: string
  createdAt: number
  taskId: string
  projectId: string
}

export interface Task {
  id: string
  name: string
  projectId: string
  completedPomodoros: number
  status: TaskStatus
  lastInteractionTime?: number // Timestamp of last interaction
}
export interface Settings {
  focusDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  cyclesBeforeLongBreak: number
  autoStartNextSession: boolean
  soundEnabled: boolean
  soundVolume: number
  focusEndSound: string
  breakEndSound: string
  startSound: string
  workdayDuration: number // in hours
  dailyPomodoroGoal: number // target pomodoros per day
  standingReminderEnabled: boolean
  standingCadence: number // in minutes - how often to switch between sit/stand
  }
export interface DailyStat {
  date: string
  totalPomodoros: number
  timeSpent: number // in minutes of focus time
  workdayStarted: boolean
  workdayCompleted: boolean
  workdayTimeSpent: number // in minutes of actual workday time
  shortBreakTime: number // in minutes
  longBreakTime: number // in minutes
  shortBreakCount: number
  longBreakCount: number
  shortBreaksSkipped: number // count of skipped short breaks (legacy, keep for backwards compat)
  longBreaksSkipped: number // count of skipped long breaks (legacy, keep for backwards compat)
  accumulatedBreakTime: number // in minutes - break time gathered from skipped breaks
  dayStartTime: number | null // timestamp when first activity started
  projectsWorked?: string[] // array of project IDs worked on this day
  projectPomodoros?: Record<string, number> // per-project pomodoro counts for this day
  // Posture tracking, added 2026-09-08 for Vitals. Optional because days
  // recorded before that have no posture history and cannot be backfilled.
  // Minutes are accumulated when a posture ENDS, so the stretch currently in
  // progress is not included here; see lib/vitals.ts.
  sittingMinutes?: number
  standingMinutes?: number
  postureSwitches?: number
  longestSitStretch?: number // minutes, single unbroken sit
  longestStandStretch?: number // minutes, single unbroken stand
}
export interface TimerState {
  time: number
  isActive: boolean
  sessionType: SessionType
  cycleCount: number
  timestamp: number
  sessionStartTime: number | null
  sessionEndTime: number | null
}
export interface WorkdayTimer {
  startTime: number | null
  duration: number // in milliseconds
  date: string
  isPaused: boolean
  pausedAt: number | null // timestamp when paused
  pausedDuration: number // total time paused in milliseconds
  currentPosture: "sitting" | "standing"
  lastPostureChange: number | null // timestamp of last posture change
  }
export interface PomodoroSession {
  id: string
  startTime: number
  endTime: number
  type: SessionType
  taskId?: string
  completedPomodoros?: number
}

// Helper function to format relative time
// Shared helper: local date string in YYYY-MM-DD format (avoids UTC shift from toISOString)
