"use client"

import { useAppState } from "@/lib/app-state"
import { standingCadenceOf } from "@/lib/posture"
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Timer,
  Plus,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Check,
  Coffee,
  AlertTriangle,
  Circle,
  StickyNote,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { BREAK_ACTIVITIES, LONG_BREAK_ACTIVITIES } from "@/lib/activities"
import { getLocalDateStr } from "@/lib/app-utils"
import { useWorkdayTimer } from "@/hooks/use-workday-timer"
import type { SessionType, Project, Note, Task, Settings, DailyStat } from "@/lib/types"
import { MobileTaskSelector } from "@/components/timer/mobile-task-selector"

export const MobileTimerComponent = ({
  sessionType,
  time,
  isActive,
  cycleCount,
  toggleTimer,
  resetTimer,
  skipSession,
  workdayTimer,
}: {
  sessionType: SessionType
  time: number
  isActive: boolean
  cycleCount: number
  toggleTimer: () => void
  resetTimer: () => void
  skipSession: () => void
  workdayTimer: ReturnType<typeof useWorkdayTimer>
}) => {
  const { settings, tasks, setTasks, projects, setProjects, activeTask, setActiveTask, stats, setStats, notes, setNotes } = useAppState()
  const durations = useMemo(
    () => ({
      focus: settings.focusDuration * 60,
      shortBreak: settings.shortBreakDuration * 60,
      longBreak: settings.longBreakDuration * 60,
    }),
    [settings],
  )

  const sessionLabels = {
    focus: "Focus Time",
    shortBreak: "Short Break",
    longBreak: "Long Break",
  }

  // Random break activity for breaks
  const [currentBreakActivity, setCurrentBreakActivity] = useState<string>("")
  const [currentLongBreakActivity, setCurrentLongBreakActivity] = useState<string>("")

  // Note dialog state
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  
  const handleAddNote = () => {
    if (!noteContent.trim() || !activeTask) return
    
    const newNote: Note = {
      id: Date.now().toString(),
      content: noteContent.trim(),
      createdAt: Date.now(),
      taskId: activeTask.id,
      projectId: activeTask.projectId,
    }
    
    setNotes([...notes, newNote])
    setNoteContent("")
    setIsNoteDialogOpen(false)
  }
  
  // Add refs to track session changes more accurately
  const sessionChangeRef = useRef<number>(0)
  const breakActivitySetRef = useRef<{ sessionChangeId: number; activity: string }>({
    sessionChangeId: -1,
    activity: "",
  })
  const longBreakActivitySetRef = useRef<{ sessionChangeId: number; activity: string }>({
    sessionChangeId: -1,
    activity: "",
  })

  // Generate random activity when breaks start - improved detection
  useEffect(() => {
    // Increment session change counter when session type changes
    const currentSessionChangeId = sessionChangeRef.current

    if (sessionType === "shortBreak" && time === durations.shortBreak) {
      // Check if this is a new short break session
      if (breakActivitySetRef.current.sessionChangeId !== currentSessionChangeId) {
        const randomIndex = Math.floor(Math.random() * BREAK_ACTIVITIES.length)
        const newActivity = BREAK_ACTIVITIES[randomIndex]
        setCurrentBreakActivity(newActivity)
        breakActivitySetRef.current = {
          sessionChangeId: currentSessionChangeId,
          activity: newActivity,
        }
      }
    } else if (sessionType === "longBreak" && time === durations.longBreak) {
      // Check if this is a new long break session
      if (longBreakActivitySetRef.current.sessionChangeId !== currentSessionChangeId) {
        const randomIndex = Math.floor(Math.random() * LONG_BREAK_ACTIVITIES.length)
        const newActivity = LONG_BREAK_ACTIVITIES[randomIndex]
        setCurrentLongBreakActivity(newActivity)
        longBreakActivitySetRef.current = {
          sessionChangeId: currentSessionChangeId,
          activity: newActivity,
        }
      }
    }
  }, [sessionType, time, durations.shortBreak, durations.longBreak])

  // Track when session type changes to increment counter
  useEffect(() => {
    sessionChangeRef.current += 1
  }, [sessionType])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }, [])

  const progress = ((durations[sessionType] - time) / durations[sessionType]) * 100
  
  // Calculate consecutive pomodoros without a break today
  const todayStr = getLocalDateStr()
  const todayStat = stats.find((s) => s.date === todayStr)
  const todayPomodoros = todayStat?.totalPomodoros || 0
  const todayBreaksTaken = (todayStat?.shortBreakCount || 0) + (todayStat?.longBreakCount || 0)
  const pomodorosWithoutBreak = Math.max(0, todayPomodoros - todayBreaksTaken - 1)
  const accumulatedBreakTime = todayStat?.accumulatedBreakTime || 0
  
  // State for taking accumulated break
  const [isTakingAccumulatedBreak, setIsTakingAccumulatedBreak] = useState(false)
  const [accumulatedBreakTimer, setAccumulatedBreakTimer] = useState(0)
  const [initialBreakDuration, setInitialBreakDuration] = useState(0) // Store initial duration for progress bar
  const [showBreakOptionsDialog, setShowBreakOptionsDialog] = useState(false)
  
  const getNextSessionLabel = () => {
    if (sessionType === "focus") {
      // After focus, next is always a break
      const nextCycleCount = cycleCount + 1
      return nextCycleCount % settings.cyclesBeforeLongBreak === 0 ? "Long Break" : "Short Break"
    } else {
      // After any break, next is always focus
      return "Focus Time"
    }
  }
  
  // Start taking accumulated break
  const startAccumulatedBreak = () => {
    if (accumulatedBreakTime > 0) {
      const breakMinutes = accumulatedBreakTime
      const breakSeconds = breakMinutes * 60
      
      // Set states for break timer
      setInitialBreakDuration(breakSeconds) // Store for progress bar
      setAccumulatedBreakTimer(breakSeconds)
      setIsTakingAccumulatedBreak(true)
      setShowBreakOptionsDialog(false)
      
      // Clear accumulated break time from stats
      const today = getLocalDateStr()
      setStats((prevStats) =>
        prevStats.map((s) =>
          s.date === today ? { ...s, accumulatedBreakTime: 0 } : s
        )
      )
    }
  }
  
  // Shorten workday by accumulated break time
  const shortenWorkday = () => {
    if (accumulatedBreakTime > 0) {
      // Reduce the workday duration by accumulated break time (convert minutes to milliseconds)
      const reductionMs = accumulatedBreakTime * 60 * 1000
      workdayTimer.reduceWorkdayDuration(reductionMs)
      
      // Clear accumulated break time from stats
      const today = getLocalDateStr()
      setStats((prevStats) =>
        prevStats.map((s) =>
          s.date === today ? { ...s, accumulatedBreakTime: 0 } : s
        )
      )
      setShowBreakOptionsDialog(false)
    }
  }
  
  // Effect to count down accumulated break timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isTakingAccumulatedBreak && accumulatedBreakTimer > 0) {
      interval = setInterval(() => {
        setAccumulatedBreakTimer((prev) => {
          if (prev <= 1) {
            setIsTakingAccumulatedBreak(false)
            setInitialBreakDuration(0)
            // Play notification sound
            if (settings.soundEnabled) {
              const audio = new Audio(`/sounds/${settings.breakEndSound || "bell"}.mp3`)
              audio.volume = settings.soundVolume / 100
              audio.play().catch(() => {})
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTakingAccumulatedBreak, accumulatedBreakTimer, settings])
  
  const cancelAccumulatedBreak = () => {
    setIsTakingAccumulatedBreak(false)
    setAccumulatedBreakTimer(0)
    setInitialBreakDuration(0)
  }

  return (
    // Tighter vertical rhythm than the original py-6 / space-y-6. Those gaps
    // cost 120px of the column, which the ring pays for now that it is the
    // flexible element. sm: restores the roomier spacing where there is height
    // to spare.
    // min-h-full, not h-full. At h-full this column is pinned to the viewport
    // height and its children overflow it visibly, spilling past the padding
    // that reserves space for the fixed nav. With min-h-full it grows instead,
    // so the reserved space actually holds and main scrolls correctly.
    // The ring still flexes, because it takes any free space when there is
    // some and falls back to its min-h when there is not.
    <div className="flex flex-col min-h-full px-4 py-4 space-y-4 sm:py-6 sm:space-y-6">
      {(workdayTimer.hasWorkdayStarted || workdayTimer.workdayProgress > 0 || sessionType === "focus") && (
        <Card
          className={cn(
            "shrink-0 border-2 backdrop-blur-sm box-glow relative overflow-hidden",
            workdayTimer.isWorkdayActive
              ? "border-cyan-500/50 bg-gradient-to-r from-cyan-500/10 to-blue-500/10"
              : workdayTimer.workdayProgress >= 100
                ? "border-secondary/50 bg-gradient-to-r from-secondary/10 to-primary/10"
                : "border-muted-foreground/30 bg-muted/20",
          )}
        >
          <CardContent className="p-4 relative z-10">
            {workdayTimer.hasWorkdayStarted ? (
              <div className="flex items-center gap-3">
                {/* Circular pause button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={workdayTimer.toggleWorkdayPause}
                  className="rounded-full border-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500 transition-all bg-black/40 h-12 w-12 p-0 relative z-50 flex items-center justify-center flex-shrink-0"
                  aria-label={workdayTimer.isPaused ? "Resume workday" : "Pause workday"}
                >
                  {workdayTimer.isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </Button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Workday Active</div>
                    <div className="text-xs text-foreground/50 font-mono">
                      {workdayTimer.workdayProgress.toFixed(0)}% complete
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold text-cyan-400 tabular-nums">
                      {workdayTimer.formatWorkdayTime(workdayTimer.remainingTime)}
                    </div>
                    <div className="text-xs text-foreground/50 uppercase tracking-wide font-mono">remaining</div>
                  </div>
                </div>
              </div>
            ) : workdayTimer.workdayProgress >= 100 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div>
                    <div className="text-sm font-bold text-secondary uppercase tracking-wider">Workday Complete!</div>
                    <div className="text-xs text-foreground/60 font-mono">
                      {settings.workdayDuration}h completed today
                    </div>
                  </div>
                </div>
                <Check className="h-7 w-7 text-secondary drop-shadow-[0_0_12px_hsl(var(--secondary))]" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div>
                    <div className="text-sm font-bold text-foreground uppercase tracking-wider">Workday Timer</div>
                    <div className="text-xs text-foreground/60 font-mono">Ready to start</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-foreground/60 uppercase tracking-wide mb-1 font-mono">Daily Goal</div>
                  <div className="text-xl font-bold text-primary tabular-nums text-glow-yellow">
                    {settings.workdayDuration}h 00m
                  </div>
                </div>
              </div>
            )}
            {workdayTimer.hasWorkdayStarted && (
              <div className="w-full bg-black/40 rounded-sm h-2 border border-cyan-500/30 overflow-hidden mt-3">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-1000"
                  style={{ width: `${workdayTimer.workdayProgress}%` }}
                />
              </div>
            )}
            
            {/* Posture Reminder */}
            {workdayTimer.hasWorkdayStarted && (settings.standingReminderEnabled !== false) && (
              <div className="mt-3 pt-3 border-t border-cyan-500/20">
                {workdayTimer.timeSincePostureChange >= (standingCadenceOf(settings)) ? (
                  // Time to switch!
                  <div 
                    onClick={workdayTimer.togglePosture}
                    className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 animate-pulse" />
                      <span className="text-xs font-medium text-amber-400">
                        Time to {workdayTimer.currentPosture === "sitting" ? "stand up" : "sit down"}!
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                    >
                      {workdayTimer.currentPosture === "sitting" ? "Stand" : "Sit"}
                    </Button>
                  </div>
                ) : (
                  // Current posture status
                  <div 
                    onClick={workdayTimer.togglePosture}
                    className="flex items-center justify-between cursor-pointer hover:bg-cyan-500/5 rounded p-1 -m-1 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {workdayTimer.currentPosture === "standing" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-cyan-400" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-cyan-400" />
                      )}
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {workdayTimer.currentPosture} for {workdayTimer.timeSincePostureChange}m
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Switch in {(standingCadenceOf(settings)) - workdayTimer.timeSincePostureChange}m
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="shrink-0 text-center space-y-2">
        <div
          className={cn(
            "inline-flex px-6 py-2 text-sm font-bold uppercase tracking-widest",
            "border-2 transition-colors duration-300",
            sessionType === "focus" && "border-primary text-primary bg-primary/10",
            sessionType === "shortBreak" && "border-secondary text-secondary bg-secondary/10",
            sessionType === "longBreak" && "border-cyan-500 text-cyan-400 bg-cyan-500/10",
          )}
          role="status"
          aria-live="polite"
        >
          {sessionLabels[sessionType]}
        </div>
      </div>

      {/* Task Selector */}
      <div className="shrink-0">
        <MobileTaskSelector />
      </div>

  {/* Break streak warning - clickable to show options */}
  {accumulatedBreakTime > 0 && sessionType === "focus" && !isTakingAccumulatedBreak && (
  <div 
  onClick={() => setShowBreakOptionsDialog(true)}
  className="flex items-center justify-center gap-1.5 mb-1 cursor-pointer hover:opacity-80 transition-opacity"
  >
  <Coffee className="h-3 w-3 text-amber-400" />
  <span className="text-[10px] text-amber-400 underline underline-offset-2">
  {accumulatedBreakTime}m of break time saved
  </span>
  </div>
  )}

      {/* Timer Circle - Smaller size to fit screen better */}
      {/* The ring is the only flexible element on this screen, so it absorbs
          whatever height is left after the fixed rows. It used to be
          flex-shrink-0 at a fixed 240px, which made the column 788px tall in a
          747px space and pushed the Start button underneath the nav.
          Sized by height, capped, aspect-square keeps it round. */}
      {/* Sized in vh with a clamp rather than by flex. Flex sizing here needs a
          definite parent height, which fights the column needing to grow so it
          can scroll; that conflict is what put the Start button under the nav.
          clamp gives a predictable ring at every viewport with no dependency
          on the parent resolving a height. */}
      <div className="shrink-0 flex items-center justify-center py-2">
        <div className="relative w-[clamp(150px,32vh,260px)] max-w-full aspect-square">
          <div
            className={cn(
              "absolute inset-0 rounded-full blur-xl opacity-30",
              sessionType === "focus" && "bg-primary",
              sessionType === "shortBreak" && "bg-secondary",
              sessionType === "longBreak" && "bg-cyan-500",
            )}
          />

          {/* Background Circle */}
          <div className="absolute inset-0 rounded-full bg-black/60 border-2 border-muted-foreground/30" />

          {/* Progress Circle */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground/20"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              className={cn(
                "transition-all duration-1000",
                sessionType === "focus" && "text-primary text-glow-yellow",
                sessionType === "shortBreak" && "text-secondary text-glow-green",
                sessionType === "longBreak" && "text-cyan-500 drop-shadow-[0_0_12px_rgba(34,211,238,1)]",
              )}
            />
          </svg>

          {/* Timer Display - Scaled down content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className={cn(
                "text-4xl sm:text-5xl font-bold tabular-nums font-mono",
                sessionType === "focus" && "text-primary text-glow-yellow",
                sessionType === "shortBreak" && "text-secondary text-glow-green",
                sessionType === "longBreak" && "text-cyan-400",
              )}
              role="timer"
              aria-live="off"
              aria-label={`${Math.floor(time / 60)} minutes and ${time % 60} seconds remaining`}
            >
              {formatTime(time)}
            </div>
            {activeTask && sessionType === "focus" && (
              <div className="mt-2 text-center px-3">
                <div className="text-xs sm:text-sm text-foreground/90 font-semibold truncate max-w-[160px] sm:max-w-[180px]">{activeTask.name}</div>
                <div className="text-[10px] sm:text-xs text-foreground/60 mt-0.5 font-mono uppercase tracking-wide">
                  {projects.find((p) => p.id === activeTask.projectId)?.name || "Unknown Project"}
                </div>
              </div>
            )}
            {sessionType === "shortBreak" && currentBreakActivity && (
              <div className="text-xs sm:text-sm text-foreground/80 mt-2 text-center px-4 max-w-[180px] sm:max-w-[220px] leading-relaxed">
                {currentBreakActivity}
              </div>
            )}
            {sessionType === "longBreak" && currentLongBreakActivity && (
              <div className="text-xs sm:text-sm text-foreground/80 mt-2 text-center px-4 max-w-[180px] sm:max-w-[220px] leading-relaxed">
                {currentLongBreakActivity}
              </div>
            )}
          </div>

          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/40" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary/40" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary/40" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary/40" />
        </div>
      </div>

      <div className="shrink-0 flex justify-center items-center space-x-6">
        <Button
          onClick={resetTimer}
          variant="outline"
          size="lg"
          className="w-14 h-14 rounded-full border-2 border-foreground/30 bg-black/40 hover:bg-foreground/10 hover:border-foreground/60 transition-all relative group overflow-hidden"
          aria-label="Reset timer"
        >
          <RotateCcw className="h-5 w-5 relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>

        <Button
          onClick={toggleTimer}
          size="lg"
          className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90 text-black font-bold border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.8)] transition-all relative group overflow-hidden"
          aria-label={isActive ? "Pause timer" : "Start timer"}
        >
          {isActive ? (
            <Pause className="h-8 w-8 relative z-10" />
          ) : (
            <Play className="h-8 w-8 relative z-10 translate-x-0.5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>

        <Button
          onClick={skipSession}
          variant="outline"
          size="lg"
          className="w-14 h-14 rounded-full border-2 border-foreground/30 bg-black/40 hover:bg-foreground/10 hover:border-foreground/60 transition-all relative group overflow-hidden"
          aria-label={`Skip to ${getNextSessionLabel()}`}
          title={`Skip to ${getNextSessionLabel()}`}
        >
          <SkipForward className="h-5 w-5 relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </div>
      
      {/* Quick Note Button */}
      {activeTask && (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsNoteDialogOpen(true)}
            className="h-8 px-4 text-xs text-muted-foreground hover:text-foreground hover:bg-primary/10 border border-primary/20 rounded-full"
          >
            <StickyNote className="h-3.5 w-3.5 mr-1.5" />
            Add Note
            {notes.filter(n => n.taskId === activeTask.id).length > 0 && (
              <span className="ml-1.5 text-[10px] text-primary">({notes.filter(n => n.taskId === activeTask.id).length})</span>
            )}
          </Button>
        </div>
      )}
      
      {/* Accumulated Break Time */}
      {accumulatedBreakTime > 0 && !isTakingAccumulatedBreak && (
        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBreakOptionsDialog(true)}
            className="h-9 px-4 text-xs border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-400 rounded-full"
          >
            <Coffee className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
            Use Break Time ({accumulatedBreakTime}m)
          </Button>
        </div>
      )}
      
      {/* Accumulated Break Timer (when taking break) */}
      {isTakingAccumulatedBreak && (
        <div className="mx-4 p-4 rounded-xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-amber-400" />
              <span className="font-medium text-amber-400">Taking Saved Break</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelAccumulatedBreak}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>
          <div className="text-4xl font-bold text-center text-amber-400 font-mono">
            {formatTime(accumulatedBreakTimer)}
          </div>
          <div className="w-full bg-black/40 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-1000"
              style={{ width: `${initialBreakDuration > 0 ? ((initialBreakDuration - accumulatedBreakTimer) / initialBreakDuration) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Daily Progress Indicator */}
      {(() => {
        const dailyGoal = settings.dailyPomodoroGoal || 10
        const goalProgress = Math.min(100, (todayPomodoros / dailyGoal) * 100)
        const getAssessment = () => {
          if (todayPomodoros >= 16) return { label: "Maximum capacity", color: "text-purple-400" }
          if (todayPomodoros >= 12) return { label: "Very productive", color: "text-emerald-400" }
          if (todayPomodoros >= 8) return { label: "Good day", color: "text-cyan-400" }
          if (todayPomodoros >= 4) return { label: "Getting started", color: "text-yellow-400" }
          return { label: "", color: "text-muted-foreground" }
        }
        const assessment = getAssessment()
        
        return (
          <div className="mt-4 px-8">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Today: {todayPomodoros}/{dailyGoal}</span>
              {assessment.label && <span className={assessment.color}>{assessment.label}</span>}
            </div>
            <div className="h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>
        )
  })()}
      
      {/* Break Options Dialog */}
      <Dialog open={showBreakOptionsDialog} onOpenChange={setShowBreakOptionsDialog}>
        <DialogContent className="w-[95vw] max-w-sm border-amber-500/30 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-amber-400" />
              {accumulatedBreakTime}m of Break Time Saved
            </DialogTitle>
            <DialogDescription>
              How would you like to use your saved break time?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              onClick={startAccumulatedBreak}
              variant="outline"
              className="w-full h-16 flex flex-col items-center justify-center gap-1 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-400"
            >
              <div className="flex items-center gap-2">
                <Coffee className="h-5 w-5 text-emerald-400" />
                <span className="font-medium">Take a Break</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Start a {accumulatedBreakTime} minute break timer
              </span>
            </Button>
            <Button
              onClick={shortenWorkday}
              variant="outline"
              className="w-full h-16 flex flex-col items-center justify-center gap-1 border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-400"
            >
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-cyan-400" />
                <span className="font-medium">Shorten Workday</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Remove {accumulatedBreakTime}m from workday timer
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowBreakOptionsDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md border-primary/30 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-primary" />
              Quick Note
            </DialogTitle>
            <DialogDescription>
              Add a note to {activeTask?.name || "current task"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Type your note here..."
              className="w-full h-32 px-3 py-2 text-sm bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={!noteContent.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </div>
  )
  }
