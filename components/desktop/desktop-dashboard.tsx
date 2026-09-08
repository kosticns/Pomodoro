"use client"

import { useAppState } from "@/lib/app-state"
import React, { useState, useMemo } from "react"
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Target,
  Coffee,
  Smartphone,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getLocalDateStr } from "@/lib/app-utils"
import { useWorkdayTimer } from "@/hooks/use-workday-timer"
import { CustomPieChart } from "@/components/charts/custom-pie-chart"
import type { SessionType, Project, Task, Settings, DailyStat } from "@/lib/types"
import { MobileStatsDashboard } from "@/components/stats/mobile-stats-dashboard"

export const DesktopDashboard = ({
  sessionType,
  time,
  isActive,
  workdayTimer,
  startWorkdayTimer, // Not used, but kept for completeness,
  resetWorkdayTimer, // Not used, but kept for completeness,
  formatWorkdayTime, // Not used, but kept for completeness,
  isWorkdayActive, // Not used, but kept for completeness,
  workdayProgress, // Not used, but kept for completeness,
  setViewMode,
  cycleCount, // Added cycleCount to props,
  toggleTimer, // Added toggleTimer prop,
  resetTimer, // Added resetTimer prop,
  skipSession, // Added skipSession prop,
}: {
  sessionType: SessionType
  time: number
  isActive: boolean
  cycleCount: number // Added cycleCount to props
  workdayTimer: ReturnType<typeof useWorkdayTimer>
  toggleTimer: () => void // Added toggleTimer prop
  resetTimer: () => void // Added resetTimer prop
  skipSession: () => void // Added skipSession prop
  setViewMode: (mode: "mobile" | "desktop") => void
  startWorkdayTimer: () => void
  resetWorkdayTimer: () => void
  formatWorkdayTime: (milliseconds: number) => string
  isWorkdayActive: boolean
  workdayProgress: number
}) => {
  const { activeTask, tasks, setActiveTask, projects, setTasks, settings, stats, setStats } = useAppState()
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  const durations = useMemo(
    () => ({
      focus: settings.focusDuration * 60,
      shortBreak: settings.shortBreakDuration * 60,
      longBreak: settings.longBreakDuration * 60,
    }),
    [settings],
  )

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const progress = ((durations[sessionType] - time) / durations[sessionType]) * 100

  // Calculate today's metrics
  const today = getLocalDateStr()
  const todayStats = stats.find((s) => s.date === today)
  const todayPomodoros = todayStats?.totalPomodoros || 0
  const totalFocusTime = todayStats?.timeSpent || 0

  // Calculate capacity
  const potentialPomodoros = 13
  const utilizationRate = potentialPomodoros > 0 ? (todayPomodoros / potentialPomodoros) * 100 : 0

  // Drag and drop handlers
  const handleDragStart = (task: Task) => setDraggedTask(task)
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = () => {
    if (draggedTask) {
      const updatedTask = { ...draggedTask, lastInteractionTime: Date.now() }
      setTasks((prev) => prev.map((t) => (t.id === draggedTask.id ? updatedTask : t)))
      setActiveTask(updatedTask)
      setDraggedTask(null)
    }
  }

  const sessionLabels = {
    focus: "Focus Time",
    shortBreak: "Short Break",
    longBreak: "Long Break",
  }

  const getNextSessionLabel = () => {
    if (sessionType === "focus") {
      const nextCycleCount = cycleCount + 1
      return nextCycleCount % settings.cyclesBeforeLongBreak === 0 ? "Long Break" : "Short Break"
    }
    return "Focus Time"
  }

  // Generate session timeline data
  const generateSessionTimeline = () => {
    const sessions: Array<{
      type: "focus" | "shortBreak" | "longBreak"
      duration: number
      status: "completed" | "current" | "upcoming" | "skipped"
    }> = []

    // Calculate total cycles needed to fill the workday
    const totalWorkMinutes = settings.workdayDuration * 60
    let currentMinutes = 0
    let currentCycle = 0

    while (currentMinutes < totalWorkMinutes) {
      // Add focus session
      const focusDuration = settings.focusDuration * 60
      if (currentMinutes + focusDuration > totalWorkMinutes && currentMinutes < totalWorkMinutes) {
        // Partial focus session
        sessions.push({
          type: "focus",
          duration: totalWorkMinutes - currentMinutes,
          status: "upcoming", // Will be adjusted later
        })
        currentMinutes = totalWorkMinutes
      } else if (currentMinutes < totalWorkMinutes) {
        // FIX: Changed totalWorkminutes to totalWorkMinutes
        sessions.push({
          type: "focus",
          duration: focusDuration,
          status: "upcoming",
        })
        currentMinutes += focusDuration
      }

      if (currentMinutes >= totalWorkMinutes) break

      // Add break session
      const isLongBreak = (currentCycle + 1) % settings.cyclesBeforeLongBreak === 0
      const breakDuration = (isLongBreak ? settings.longBreakDuration : settings.shortBreakDuration) * 60

      if (currentMinutes + breakDuration > totalWorkMinutes && currentMinutes < totalWorkMinutes) {
        // Partial break session
        sessions.push({
          type: isLongBreak ? "longBreak" : "shortBreak",
          duration: totalWorkMinutes - currentMinutes,
          status: "upcoming",
        })
        currentMinutes = totalWorkMinutes
      } else if (currentMinutes < totalWorkMinutes) {
        sessions.push({
          type: isLongBreak ? "longBreak" : "shortBreak",
          duration: breakDuration,
          status: "upcoming",
        })
        currentMinutes += breakDuration
      }
      currentCycle++
    }

    // Determine status based on current timer state
    let completedCycles = 0
    let currentTimeInTimeline = 0
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      const sessionEnd = currentTimeInTimeline + session.duration * 1000
      const now = Date.now()

      if (sessionType === "focus" && i === cycleCount * 2 && !isActive) {
        // If timer is not active and we are at the beginning of a focus session
        session.status = "current"
      } else if (sessionType === "shortBreak" && i === cycleCount * 2 + 1 && !isActive) {
        // If timer is not active and we are at the beginning of a short break
        session.status = "current"
      } else if (sessionType === "longBreak" && i === cycleCount * 2 + 1 && !isActive) {
        // If timer is not active and we are at the beginning of a long break
        session.status = "current"
      } else if (sessionEnd <= now && session.type === "focus") {
        // Completed focus session
        session.status = "completed"
        completedCycles++
      } else if (sessionEnd <= now && (session.type === "shortBreak" || session.type === "longBreak")) {
        // Completed break session
        session.status = "completed"
      } else if (sessionEnd > now && i === cycleCount * 2 && sessionType === "focus" && isActive) {
        // Current focus session
        session.status = "current"
      } else if (
        sessionEnd > now &&
        i === cycleCount * 2 + 1 &&
        (sessionType === "shortBreak" || sessionType === "longBreak") &&
        isActive
      ) {
        // Current break session
        session.status = "current"
      } else if (sessionEnd > now) {
        // Upcoming sessions
        session.status = "upcoming"
      } else {
        // Skipped or otherwise
        session.status = "skipped"
      }
      currentTimeInTimeline = sessionEnd
    }

    // Ensure the current session is correctly marked if timer is paused
    if (!isActive && sessionType === "focus" && cycleCount * 2 < sessions.length) {
      sessions[cycleCount * 2].status = "current"
    } else if (!isActive && sessionType === "shortBreak" && cycleCount * 2 + 1 < sessions.length) {
      sessions[cycleCount * 2 + 1].status = "current"
    } else if (!isActive && sessionType === "longBreak" && cycleCount * 2 + 1 < sessions.length) {
      sessions[cycleCount * 2 + 1].status = "current"
    }

    return sessions.slice(0, 20) // Limit to first 20 sessions for display
  }

  const sessionTimeline = generateSessionTimeline()
  const currentSessionIndex = sessionTimeline.findIndex((s) => s.status === "current")

  // Weekly chart data (current week, Monday to today)
  const getWeekFromMonday = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diffToMonday)
    monday.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const days: string[] = []
    const current = new Date(monday)
    while (current <= today) {
      days.push(getLocalDateStr(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  }

  const weeklyData = getWeekFromMonday().map((date) => {
    const stat = stats.find((s) => s.date === date)
    return {
      day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
      pomodoros: stat?.totalPomodoros || 0,
    }
  })

  // ================================================================
  // PROJECT COVERAGE DATA (mirrors MobileStatsDashboard logic)
  // ================================================================
  const chartColors = {
    bg: [
      "rgba(239, 68, 68, 0.8)", "rgba(59, 130, 246, 0.8)", "rgba(34, 197, 94, 0.8)",
      "rgba(251, 191, 36, 0.8)", "rgba(168, 85, 247, 0.8)", "rgba(236, 72, 153, 0.8)",
      "rgba(14, 165, 233, 0.8)", "rgba(132, 204, 22, 0.8)",
    ],
    border: [
      "rgba(239, 68, 68, 1)", "rgba(59, 130, 246, 1)", "rgba(34, 197, 94, 1)",
      "rgba(251, 191, 36, 1)", "rgba(168, 85, 247, 1)", "rgba(236, 72, 153, 1)",
      "rgba(14, 165, 233, 1)", "rgba(132, 204, 22, 1)",
    ],
  }

  const buildCoverageItems = (projectPomMap: Record<string, number>) => {
    const entries = Object.entries(projectPomMap)
      .map(([pid, pomodoros]) => {
        const project = projects.find((p) => p.id === pid)
        return project ? { project, pomodoros } : null
      })
      .filter(Boolean) as Array<{ project: Project; pomodoros: number }>
    entries.sort((a, b) => b.pomodoros - a.pomodoros)
    const total = entries.reduce((sum, e) => sum + e.pomodoros, 0)
    return entries.map((e) => ({
      ...e,
      percentage: total > 0 ? Math.round((e.pomodoros / total) * 100) : 0,
    }))
  }

  const buildChartData = (items: ReturnType<typeof buildCoverageItems>) => ({
    labels: items.length > 0 ? items.map((d) => d.project.name) : ["No activity"],
    datasets: [{
      data: items.length > 0 ? items.map((d) => d.percentage) : [1],
      backgroundColor: items.length > 0 ? chartColors.bg.slice(0, items.length) : ["rgba(100, 100, 100, 0.3)"],
      borderColor: items.length > 0 ? chartColors.border.slice(0, items.length) : ["rgba(100, 100, 100, 0.5)"],
      borderWidth: 1,
    }],
  })

  // Today coverage
  const todayProjectPom = todayStats?.projectPomodoros && Object.keys(todayStats.projectPomodoros).length > 0
    ? todayStats.projectPomodoros
    : (() => {
        const pw = todayStats?.projectsWorked || []
        if (pw.length === 0 || todayPomodoros === 0) return {}
        const share = Math.max(1, Math.round(todayPomodoros / pw.length))
        const map: Record<string, number> = {}
        for (const pid of pw) { map[pid] = share }
        return map
      })()
  const dailyCoverageItems = buildCoverageItems(todayProjectPom)
  const dailyChartData = buildChartData(dailyCoverageItems)

  // Week dates (Mon-Fri)
  const getWeekStartMonday = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diffToMonday)
    monday.setHours(0, 0, 0, 0)
    return monday
  }
  const mondayDate = getWeekStartMonday()
  const mondayStr = getLocalDateStr(mondayDate)
  const currentWeekStats = stats.filter((s) => s.date >= mondayStr)
  const weeklyTotalPomodoros = currentWeekStats.reduce((sum, s) => sum + s.totalPomodoros, 0)

  const weeklyProjectPom: Record<string, number> = {}
  for (const s of currentWeekStats) {
    if (s.projectPomodoros && Object.keys(s.projectPomodoros).length > 0) {
      for (const [pid, count] of Object.entries(s.projectPomodoros)) {
        weeklyProjectPom[pid] = (weeklyProjectPom[pid] || 0) + count
      }
    } else if (s.projectsWorked && s.projectsWorked.length > 0) {
      const share = Math.max(1, Math.round(s.totalPomodoros / s.projectsWorked.length))
      for (const pid of s.projectsWorked) {
        weeklyProjectPom[pid] = (weeklyProjectPom[pid] || 0) + share
      }
    }
  }
  const weeklyCoverageItems = buildCoverageItems(weeklyProjectPom)
  const weeklyChartData = buildChartData(weeklyCoverageItems)

  // Time tracking metrics
  const totalAvailableTime = 435
  const totalWorkTime = todayStats?.timeSpent || 0
  const workdayDurationMs = settings.workdayDuration * 60 * 60 * 1000
  const elapsedMs = workdayTimer.isWorkdayActive ? workdayTimer.workdayTimer.duration - workdayTimer.remainingTime : 0
  const workdayActiveTime = Math.floor(elapsedMs / (1000 * 60))
  const workdayActivePercentage = totalAvailableTime > 0 ? (workdayActiveTime / totalAvailableTime) * 100 : 0
  const workTimePercentage = totalAvailableTime > 0 ? (totalWorkTime / totalAvailableTime) * 100 : 0

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/20 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Timer className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-lg hidden sm:inline">Pomodoro</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {workdayTimer.isWorkdayActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-sm font-mono text-cyan-400">
                {workdayTimer.formatWorkdayTime(workdayTimer.remainingTime)}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("mobile")}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Smartphone className="h-4 w-4" />
            <span className="hidden md:inline">Mobile</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-[1920px] mx-auto">

          {/* ROW 1: Key Stats Banner - 4 equal stat cards spanning full width */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-5">
            <Card className="border border-primary/30 bg-card/50">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl lg:text-3xl font-bold text-primary">{todayPomodoros}</div>
                    <div className="text-xs text-muted-foreground">Pomodoros Today</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-emerald-500/30 bg-card/50">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl lg:text-3xl font-bold text-emerald-400">
                      {Math.floor(totalFocusTime / 60)}h {totalFocusTime % 60}m
                    </div>
                    <div className="text-xs text-muted-foreground">Focus Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-cyan-500/30 bg-card/50">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                    <Coffee className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-2xl lg:text-3xl font-bold text-foreground">{todayStats?.shortBreakCount || 0}</div>
                    <div className="text-xs text-muted-foreground">Short Breaks ({todayStats?.shortBreakTime || 0}m)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-yellow-500/30 bg-card/50">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                    <Timer className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <div className="text-2xl lg:text-3xl font-bold text-foreground">{todayStats?.longBreakCount || 0}</div>
                    <div className="text-xs text-muted-foreground">Long Breaks ({todayStats?.longBreakTime || 0}m)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ROW 2: Main 3-column layout */}
          <div className="grid gap-4 lg:gap-5 grid-cols-1 lg:grid-cols-12">

            {/* LEFT COLUMN: Timer (3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Timer Card */}
              <Card className="border border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                      sessionType === "focus" && "bg-primary/20 text-primary border border-primary/30",
                      sessionType === "shortBreak" && "bg-secondary/20 text-secondary border border-secondary/30",
                      sessionType === "longBreak" && "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
                    )}>
                      {sessionLabels[sessionType]}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {cycleCount + 1}/{settings.cyclesBeforeLongBreak}
                    </span>
                  </div>

                  <div className="relative aspect-square max-w-[240px] mx-auto">
                    <div className={cn(
                      "absolute inset-4 rounded-full blur-2xl opacity-20",
                      sessionType === "focus" && "bg-primary",
                      sessionType === "shortBreak" && "bg-secondary",
                      sessionType === "longBreak" && "bg-cyan-500",
                    )} />
                    <div className="absolute inset-0 rounded-full bg-black/50 border border-muted-foreground/20" />
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/10" />
                      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 46}`}
                        strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress / 100)}`}
                        className={cn("transition-all duration-1000",
                          sessionType === "focus" && "text-primary",
                          sessionType === "shortBreak" && "text-secondary",
                          sessionType === "longBreak" && "text-cyan-500",
                        )} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className={cn("text-4xl lg:text-5xl font-bold font-mono tabular-nums",
                        sessionType === "focus" && "text-primary",
                        sessionType === "shortBreak" && "text-secondary",
                        sessionType === "longBreak" && "text-cyan-400",
                      )}>
                        {formatTime(time)}
                      </div>
                      {activeTask && sessionType === "focus" && (
                        <p className="text-xs text-muted-foreground mt-2 text-center px-6 line-clamp-1">{activeTask.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 mt-5">
                    <Button onClick={resetTimer} variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-border/50 hover:bg-muted/50">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button onClick={toggleTimer} size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                      {isActive ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                    </Button>
                    <Button onClick={skipSession} variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-border/50 hover:bg-muted/50" title={`Skip to ${getNextSessionLabel()}`}>
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex justify-center gap-2 mt-4">
                    {Array.from({ length: settings.cyclesBeforeLongBreak }).map((_, i) => (
                      <div key={i} className={cn("w-2 h-5 rounded-sm transition-all",
                        i < cycleCount % settings.cyclesBeforeLongBreak ? "bg-primary" : "bg-muted-foreground/20",
                      )} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Capacity */}
              <Card className="border border-border/50 bg-card/50">
                <CardHeader className="pb-2 border-b border-border/30">
                  <CardTitle className="text-base font-semibold">Capacity</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl font-bold text-foreground">{utilizationRate.toFixed(0)}%</span>
                    <span className="text-sm text-muted-foreground">{todayPomodoros} / {potentialPomodoros}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all rounded-full",
                      utilizationRate >= 80 ? "bg-emerald-500" : utilizationRate >= 50 ? "bg-amber-500" : "bg-primary",
                    )} style={{ width: `${Math.min(utilizationRate, 100)}%` }} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CENTER COLUMN: Tasks + Session Timeline (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Session Timeline */}
              <Card className="border border-border/50 bg-card/50">
                <CardHeader className="pb-2 border-b border-border/30">
                  <CardTitle className="text-base font-semibold">Session Progress</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-foreground">Session Timeline</span>
                    <span className="text-xs text-muted-foreground">
                      {cycleCount} / {sessionTimeline.filter((s) => s.type === "focus").length} focus sessions
                    </span>
                  </div>
                  <div className="flex gap-0.5 h-8">
                    {sessionTimeline.slice(0, 20).map((session, i) => (
                      <div key={i} className={cn(
                        "relative flex-1 min-w-[8px] rounded-sm transition-all",
                        session.type === "focus" && "flex-[3]",
                        session.type === "shortBreak" && "flex-[1]",
                        session.type === "longBreak" && "flex-[2]",
                        session.status === "completed" && session.type === "focus" && "bg-primary",
                        session.status === "completed" && session.type === "shortBreak" && "bg-secondary",
                        session.status === "completed" && session.type === "longBreak" && "bg-cyan-500",
                        session.status === "current" && "bg-primary animate-pulse",
                        session.status === "upcoming" && "bg-muted-foreground/20",
                        session.status === "skipped" && "bg-muted-foreground/10",
                      )}>
                        {session.status === "current" && (
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary" /><span>Focus</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-secondary" /><span>Short</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cyan-500" /><span>Long</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Tasks Card */}
              <Card className="border border-border/50 bg-card/50 flex-1 flex flex-col min-h-[400px]">
                <CardHeader className="pb-3 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Tasks</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {tasks.filter((t) => t.status !== "Done").length} active
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
                  <div onDragOver={handleDragOver} onDrop={handleDrop}
                    className={cn("border-2 border-dashed rounded-lg p-4 transition-all min-h-[80px]",
                      draggedTask ? "border-primary bg-primary/5" : "border-border/50",
                    )}>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Current Focus</span>
                    </div>
                    {activeTask ? (
                      <div className="mt-1">
                        <p className="font-semibold">{activeTask.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activeTask.completedPomodoros} pomodoros{" "}
                          {projects.find((p) => p.id === activeTask.projectId)?.name}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Drag a task here to focus</p>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {tasks
                      .filter((t) => t.id !== activeTask?.id && t.status !== "Done")
                      .slice(0, 10)
                      .map((task) => {
                        const project = projects.find((p) => p.id === task.projectId)
                        return (
                          <div key={task.id} draggable onDragStart={() => handleDragStart(task)}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-move transition-colors border border-transparent hover:border-border/50">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{task.name}</p>
                              <p className="text-xs text-muted-foreground">{project?.name}</p>
                            </div>
                            <div className="text-sm text-muted-foreground ml-3">{task.completedPomodoros}</div>
                          </div>
                        )
                      })}
                    {tasks.filter((t) => t.id !== activeTask?.id && t.status !== "Done").length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-8">No tasks</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Stats Widgets (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">

              {/* Today's Time Tracking - prominent */}
              <Card className="border border-border/50 bg-card/50">
                <CardHeader className="pb-2 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-cyan-500" />
                    <CardTitle className="text-base font-semibold">{"Today's Time Tracking"}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Workday Active</span>
                      <span className="text-sm font-semibold text-cyan-500">{workdayActiveTime} / {totalAvailableTime} min</span>
                    </div>
                    <div className="w-full bg-background/80 rounded-full h-3 overflow-hidden border border-border/30">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300 rounded-full" style={{ width: `${Math.min(100, workdayActivePercentage)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Work Time</span>
                      <span className="text-sm font-semibold text-yellow-500">{totalWorkTime} / {totalAvailableTime} min</span>
                    </div>
                    <div className="w-full bg-background/80 rounded-full h-3 overflow-hidden border border-border/30">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300 rounded-full" style={{ width: `${Math.min(100, workTimePercentage)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Today Coverage */}
              <Card className="border-cyan-500/30 bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      Today
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl font-bold text-cyan-500">{todayPomodoros}</span>
                      <span className="text-xs text-muted-foreground">pomodoros</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {dailyCoverageItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <CustomPieChart data={dailyChartData} compact hideLegend centerTotal={0} />
                      <p className="text-sm text-muted-foreground mt-2">No activity yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-center">
                        <CustomPieChart data={dailyChartData} compact hideLegend centerTotal={todayPomodoros} />
                      </div>
                      <div className="space-y-2">
                        {dailyCoverageItems.slice(0, 5).map((item, index) => (
                          <div key={item.project.id} className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: chartColors.bg[index] }} />
                            <span className="text-sm text-foreground flex-1 truncate">{item.project.name}</span>
                            <span className="text-xs text-cyan-500 w-10 text-right">{item.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* This Week Coverage */}
              <Card className="border-primary/30 bg-card/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">This Week</CardTitle>
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl font-bold text-primary">{weeklyTotalPomodoros}</span>
                      <span className="text-xs text-muted-foreground">pomodoros</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mon, {new Date(mondayStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} - Today
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  {weeklyCoverageItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <CustomPieChart data={weeklyChartData} compact hideLegend centerTotal={0} />
                      <p className="text-sm text-muted-foreground mt-2">No activity yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-center">
                        <CustomPieChart data={weeklyChartData} compact hideLegend centerTotal={weeklyTotalPomodoros} />
                      </div>
                      <div className="space-y-2">
                        {weeklyCoverageItems.slice(0, 5).map((item, index) => (
                          <div key={item.project.id} className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: chartColors.bg[index] }} />
                            <span className="text-sm text-foreground flex-1 truncate">{item.project.name}</span>
                            <span className="text-xs text-primary w-10 text-right">{item.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weekly Bar Chart */}
              <Card className="border border-border/50 bg-card/50">
                <CardHeader className="pb-2 border-b border-border/30">
                  <CardTitle className="text-base font-semibold">Weekly Pomodoros</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-end justify-between h-32 gap-2">
                    {weeklyData.map((day, i) => {
                      const maxPomodoros = Math.max(...weeklyData.map((d) => d.pomodoros), 1)
                      const heightPercent = (day.pomodoros / maxPomodoros) * 100
                      const isToday = i === weeklyData.length - 1
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="text-xs text-muted-foreground font-mono">{day.pomodoros}</div>
                          <div className="w-full h-20 flex items-end">
                            <div className={cn("w-full rounded-t transition-all", isToday ? "bg-primary" : "bg-primary/40")}
                              style={{ height: `${Math.max(heightPercent, 4)}%` }} />
                          </div>
                          <div className={cn("text-xs", isToday ? "text-primary font-medium" : "text-muted-foreground")}>
                            {day.day}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
