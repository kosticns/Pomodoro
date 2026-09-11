"use client"

import { useAppState } from "@/lib/app-state"
import { vitalsForDay } from "@/lib/vitals"
import { VitalsPanel } from "@/components/vitals/vitals-panel"
import React, { useState } from "react"
import {
  Timer,
  Coffee,
  Trophy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getLocalDateStr } from "@/lib/app-utils"
import { useWorkdayTimer } from "@/hooks/use-workday-timer"
import { CustomBarChart } from "@/components/charts/custom-bar-chart"
import { CustomPieChart } from "@/components/charts/custom-pie-chart"
import type { Project, Task, Settings, DailyStat } from "@/lib/types"

export const MobileStatsDashboard = ({
  workdayTimer,
}: {
  workdayTimer: ReturnType<typeof useWorkdayTimer>
}) => {
  const { stats, setStats, projects, tasks, settings, setTasks } = useAppState()
  const [showCapacityInfo, setShowCapacityInfo] = useState(false)

  // Get today's stats - must match today's actual date, not just last entry
  const _todayKey = getLocalDateStr()
  const todayStat = stats.find((s) => s.date === _todayKey) || {
    date: _todayKey,
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
  dayStartTime: null,
  }
  
  // Calculate time metrics
  const now = Date.now()
  const dayStart = todayStat?.dayStartTime ? new Date(todayStat.dayStartTime).getTime() : now
  // Use the workday duration minus remaining time to get elapsed time
  const workdayDurationMs = settings.workdayDuration * 60 * 60 * 1000
  const elapsedMs = workdayTimer.isWorkdayActive ? workdayTimer.workdayTimer.duration - workdayTimer.remainingTime : 0
  const workdayActiveTime = Math.floor(elapsedMs / (1000 * 60))
  // </CHANGE>

  const totalAvailableTime = 435 // in minutes - maximum effective work time with Pomodoro breaks
  const totalWorkTime = todayStat?.timeSpent || 0

  const workdayActivePercentage = totalAvailableTime > 0 ? (workdayActiveTime / totalAvailableTime) * 100 : 0
  const workTimePercentage = totalAvailableTime > 0 ? (totalWorkTime / totalAvailableTime) * 100 : 0

  // Get current week starting from Monday
  const getWeekStartMonday = () => {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diffToMonday)
    monday.setHours(0, 0, 0, 0)
    return monday
  }

  const getCurrentWeekDays = () => {
    const monday = getWeekStartMonday()
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const days: string[] = []
    const current = new Date(monday)
    while (current <= today) {
      const dayOfWeek = current.getDay()
      // Only include Mon(1) through Fri(5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push(getLocalDateStr(current))
      }
      current.setDate(current.getDate() + 1)
    }
    return days
  }

  const currentWeekDays = getCurrentWeekDays()
  const mondayStr = currentWeekDays[0]
  const currentWeekStats = stats.filter((s) => s.date >= mondayStr)

  const weeklyData = {
    labels: currentWeekDays.map((d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })),
    datasets: [
      {
        label: "Pomodoros per Day",
        data: currentWeekDays.map((d) => {
          const stat = stats.find((s) => s.date === d)
          return stat?.totalPomodoros || 0
        }),
        backgroundColor: "#16a34a",
        borderRadius: 4,
      },
    ],
  }

  // Week-to-week progress (last 8 weeks)
  const getWeeklyTotals = () => {
    const weeks: { label: string; total: number }[] = []
    const today = new Date()
    
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - (today.getDay() || 7) + 1 - (i * 7)) // Monday of that week
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6) // Sunday of that week
      
      const weekStartStr = getLocalDateStr(weekStart)
      const weekEndStr = getLocalDateStr(weekEnd)
      
      const weekStats = stats.filter((s) => s.date >= weekStartStr && s.date <= weekEndStr)
      const total = weekStats.reduce((sum, s) => sum + s.totalPomodoros, 0)
      
      // Label: "W1", "W2", etc. or date range for clarity
      // "Now" rather than "This"/"Last": eight labels share the card width, and
      // the two four-letter words sat flush against each other and read as one.
      const label = i === 0 ? "Now" : `W-${i}`
      weeks.push({ label, total })
    }
    return weeks
  }
  
  const weeklyTotalsData = getWeeklyTotals()
  
  // Month-to-month progress (last 6 months)
  const getMonthlyTotals = () => {
    const months: { label: string; total: number }[] = []
    const today = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthStart = getLocalDateStr(monthDate)
      const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
      const monthEnd = getLocalDateStr(nextMonth)
      
      const monthStats = stats.filter((s) => s.date >= monthStart && s.date <= monthEnd)
      const total = monthStats.reduce((sum, s) => sum + s.totalPomodoros, 0)
      
      const label = monthDate.toLocaleDateString("en-US", { month: "short" })
      months.push({ label, total })
    }
    return months
  }
  
  const monthlyTotalsData = getMonthlyTotals()

  const projectsWithTime = projects.map((p) => {
    const projectTasks = tasks.filter((t) => t.projectId === p.id)
    const totalPomodoros = projectTasks.reduce((sum, t) => sum + t.completedPomodoros, 0)
    return { project: p, totalPomodoros }
  })

  const sortedProjects = projectsWithTime
    .sort((a, b) => b.totalPomodoros - a.totalPomodoros)
    .map((item) => item.project)

  // Chart colors - consistent palette
  const chartColors = {
    bg: [
      "rgba(239, 68, 68, 0.8)",
      "rgba(59, 130, 246, 0.8)",
      "rgba(34, 197, 94, 0.8)",
      "rgba(251, 191, 36, 0.8)",
      "rgba(168, 85, 247, 0.8)",
      "rgba(236, 72, 153, 0.8)",
      "rgba(14, 165, 233, 0.8)",
      "rgba(132, 204, 22, 0.8)",
    ],
    border: [
      "rgba(239, 68, 68, 1)",
      "rgba(59, 130, 246, 1)",
      "rgba(34, 197, 94, 1)",
      "rgba(251, 191, 36, 1)",
      "rgba(168, 85, 247, 1)",
      "rgba(236, 72, 153, 1)",
      "rgba(14, 165, 233, 1)",
      "rgba(132, 204, 22, 1)",
    ],
  }

  // All-time project data
  const projectData = {
    labels: sortedProjects.map((p) => p.name),
    datasets: [
      {
        data: sortedProjects.map((p) => {
          const projectTasks = tasks.filter((t) => t.projectId === p.id)
          return projectTasks.reduce((sum, t) => sum + t.completedPomodoros, 0)
        }),
        backgroundColor: chartColors.bg,
        borderColor: chartColors.border,
        borderWidth: 1,
      },
    ],
  }

  // ================================================================
  // PROJECT COVERAGE DATA
  // Uses DailyStat.projectPomodoros (per-project pomodoro count per day)
  // as the primary source. Falls back to all-time task data for old
  // stats that don't have projectPomodoros populated.
  // ================================================================

  // Helper: convert a projectPomodoros record into sorted coverage items
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

  // Helper: build chart data from coverage items
  const buildChartData = (items: ReturnType<typeof buildCoverageItems>) => ({
    labels: items.length > 0 ? items.map((d) => d.project.name) : ["No activity"],
    datasets: [{
      data: items.length > 0 ? items.map((d) => d.percentage) : [1],
      backgroundColor: items.length > 0 ? chartColors.bg.slice(0, items.length) : ["rgba(100, 100, 100, 0.3)"],
      borderColor: items.length > 0 ? chartColors.border.slice(0, items.length) : ["rgba(100, 100, 100, 0.5)"],
      borderWidth: 1,
    }],
  })

  // --- DAILY: Today's per-project pomodoro counts ---
  // todayStat already resolves to today's entry (or a zeroed default).
  // Prefer projectPomodoros (exact counts). Fall back to projectsWorked
  // (distribute totalPomodoros equally) for old data without exact counts.
  const todayTotalPomodoros = todayStat.totalPomodoros || 0
  const todayProjectPom = todayStat.projectPomodoros && Object.keys(todayStat.projectPomodoros).length > 0
    ? todayStat.projectPomodoros
    : (() => {
        // Fallback: distribute totalPomodoros equally across projectsWorked
        const pw = todayStat.projectsWorked || []
        if (pw.length === 0 || todayTotalPomodoros === 0) return {}
        const share = Math.max(1, Math.round(todayTotalPomodoros / pw.length))
        const map: Record<string, number> = {}
        for (const pid of pw) {
          map[pid] = share
        }
        return map
      })()
  const dailyCoverageItems = buildCoverageItems(todayProjectPom)
  const dailyChartData = buildChartData(dailyCoverageItems)

  // --- WEEKLY: Aggregate per-project pomodoros from this week only ---
  const weeklyStats = currentWeekStats
  const weeklyTotalPomodoros = weeklyStats.reduce((sum, s) => sum + s.totalPomodoros, 0)

  // Merge each day's projectPomodoros into one weekly map.
  // For old stats that have projectsWorked but no projectPomodoros,
  // distribute that day's totalPomodoros equally across its projects.
  const weeklyProjectPom: Record<string, number> = {}
  for (const s of weeklyStats) {
    if (s.projectPomodoros && Object.keys(s.projectPomodoros).length > 0) {
      // New format: exact per-project counts
      for (const [pid, count] of Object.entries(s.projectPomodoros)) {
        weeklyProjectPom[pid] = (weeklyProjectPom[pid] || 0) + count
      }
    } else if (s.projectsWorked && s.projectsWorked.length > 0) {
      // Old format fallback: distribute day's total equally across projects
      const share = Math.max(1, Math.round(s.totalPomodoros / s.projectsWorked.length))
      for (const pid of s.projectsWorked) {
        weeklyProjectPom[pid] = (weeklyProjectPom[pid] || 0) + share
      }
    }
  }

  const weeklyCoverageItems = buildCoverageItems(weeklyProjectPom)
  const weeklyChartData = buildChartData(weeklyCoverageItems)

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold text-cyan-500">Statistics</h1>

      {/* Vitals summary. Compact here on purpose: the Breaks screen carries the
          full reading, and duplicating it would deepen the overlap those two
          screens already have. */}
      <VitalsPanel vitals={vitalsForDay(todayStat, settings)} variant="compact" />

      {/* Time Progress Bars */}
      <Card className="bg-background/50 border-primary/30">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Today's Time Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Workday Active Progress */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">Workday Active</span>
              <span className="text-xs font-semibold text-cyan-500">
                {workdayActiveTime} / {totalAvailableTime} min
              </span>
            </div>
            <div className="w-full bg-background/80 rounded-full h-2 overflow-hidden border border-border/30">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${Math.min(100, workdayActivePercentage)}%` }}
              />
            </div>
          </div>

          {/* Work Time vs Available Time Progress */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-muted-foreground">Work Time</span>
              <span className="text-xs font-semibold text-yellow-500">
                {totalWorkTime} / {totalAvailableTime} min
              </span>
            </div>
            <div className="w-full bg-background/80 rounded-full h-2 overflow-hidden border border-border/30">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300"
                style={{ width: `${Math.min(100, workTimePercentage)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Break Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-background/50 border-primary/30">
          <CardContent className="px-3">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="h-4 w-4 text-cyan-500" />
              <div className="text-xs text-muted-foreground">Short Breaks</div>
            </div>
            <div className="text-xl leading-tight font-bold text-foreground">{todayStat.shortBreakCount}</div>
            <div className="text-xs text-muted-foreground mt-1">{todayStat.shortBreakTime} min</div>
          </CardContent>
        </Card>

        <Card className="bg-background/50 border-primary/30">
          <CardContent className="px-3">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="h-4 w-4 text-yellow-500" />
              <div className="text-xs text-muted-foreground">Long Breaks</div>
            </div>
            <div className="text-xl leading-tight font-bold text-foreground">{todayStat.longBreakCount}</div>
            <div className="text-xs text-muted-foreground mt-1">{todayStat.longBreakTime} min</div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Pomodoro Chart */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">This Week</CardTitle>
          <p className="text-xs text-muted-foreground">Daily progress</p>
        </CardHeader>
        <CardContent>
          <CustomBarChart data={weeklyData} height={180} />
        </CardContent>
      </Card>

      {/* Week-to-Week Progress */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">Weekly Trend</CardTitle>
          <p className="text-xs text-muted-foreground">Last 8 weeks</p>
        </CardHeader>
        <CardContent>
          <CustomBarChart 
            data={{
              labels: weeklyTotalsData.map(w => w.label),
              datasets: [{
                label: "Pomodoros per Week",
                data: weeklyTotalsData.map(w => w.total),
                backgroundColor: "#06b6d4",
                borderRadius: 4,
              }]
            }} 
            height={140} 
          />
        </CardContent>
      </Card>

      {/* Month-to-Month Progress */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">Monthly Trend</CardTitle>
          <p className="text-xs text-muted-foreground">Last 6 months</p>
        </CardHeader>
        <CardContent>
          <CustomBarChart 
            data={{
              labels: monthlyTotalsData.map(m => m.label),
              datasets: [{
                label: "Pomodoros per Month",
                data: monthlyTotalsData.map(m => m.total),
                backgroundColor: "#8b5cf6",
                borderRadius: 4,
              }]
            }} 
            height={140} 
          />
        </CardContent>
      </Card>

      {/* Best Days - Last 30 Days */}
      {(() => {
        // Get stats from last 30 days with at least 1 pomodoro
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = getLocalDateStr(thirtyDaysAgo)

        const recentStats = stats
          .filter((s) => s.date >= thirtyDaysAgoStr && s.totalPomodoros > 0)
          .sort((a, b) => b.totalPomodoros - a.totalPomodoros)
          .slice(0, 3)

        // Show empty state if no data
        if (recentStats.length === 0) {
          return (
            <Card className="bg-background/50 border-primary/30">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <CardTitle className="text-lg">Best Days</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">Top 3 most productive days in the last 30 days</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No completed pomodoros yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Complete your first focus session to start tracking</p>
                </div>
              </CardContent>
            </Card>
          )
        }

        // Medal colors for ranking
        const medalColors = [
          "from-yellow-500/20 to-yellow-600/10 border-yellow-500/50", // Gold
          "from-slate-300/20 to-slate-400/10 border-slate-400/50", // Silver
          "from-amber-700/20 to-amber-800/10 border-amber-700/50", // Bronze
        ]
        const medalIcons = ["1st", "2nd", "3rd"]

        return (
          <Card className="bg-background/50 border-primary/30">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-lg">Best Days</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Top 3 most productive days in the last 30 days</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentStats.map((dayStat, index) => {
                const date = new Date(dayStat.date)
                const formattedDate = date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
                const projectsWorkedOn = (dayStat.projectsWorked || [])
                  .map((pid) => projects.find((p) => p.id === pid))
                  .filter(Boolean)

                return (
                  <div
                    key={dayStat.date}
                    className={cn(
                      "relative p-3 rounded-lg border bg-gradient-to-r transition-all hover:scale-[1.01]",
                      medalColors[index] || "from-muted/20 to-muted/10 border-border/50",
                    )}
                  >
                    {/* Rank Badge */}
                    <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-background border-2 border-current flex items-center justify-center text-xs font-bold">
                      <span
                        className={cn(
                          index === 0 && "text-yellow-500",
                          index === 1 && "text-slate-400",
                          index === 2 && "text-amber-700",
                        )}
                      >
                        {medalIcons[index]}
                      </span>
                    </div>

                    <div className="ml-4">
                      {/* Date and Pomodoro Count */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground">{formattedDate}</span>
                        <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/30">
                          <Timer className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-bold text-primary">{dayStat.totalPomodoros}</span>
                          <span className="text-xs text-primary/70">pomodoros</span>
                        </div>
                      </div>

                      {/* Focus Time */}
                      <div className="text-xs text-muted-foreground mb-2">
                        {Math.floor(dayStat.timeSpent / 60)}h {dayStat.timeSpent % 60}m focus time
                      </div>

                      {/* Projects Worked On */}
                      {projectsWorkedOn.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {projectsWorkedOn.slice(0, 4).map((project) => (
                            <span
                              key={project!.id}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-border/50 text-muted-foreground"
                            >
                              {project!.name}
                            </span>
                          ))}
                          {projectsWorkedOn.length > 4 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-border/50 text-muted-foreground">
                              +{projectsWorkedOn.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })()}

      {/* Today's Project Coverage */}
      <Card className="border-cyan-500/30 bg-card/50">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              Today
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xl leading-tight font-bold text-cyan-500">{todayTotalPomodoros}</span>
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
            <div className="flex flex-col gap-3">
              <div className="flex justify-center">
                <CustomPieChart data={dailyChartData} compact hideLegend centerTotal={todayTotalPomodoros} />
              </div>
              <div className="space-y-2">
                {dailyCoverageItems.slice(0, 5).map((item, index) => (
                  <div key={item.project.id} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: chartColors.bg[index] }}
                    />
                    <span className="text-sm text-foreground flex-1 truncate">{item.project.name}</span>
                    <span className="text-xs text-cyan-500 w-10 text-right">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Project Coverage */}
      <Card className="border-primary/30 bg-card/50">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">This Week</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xl leading-tight font-bold text-primary">{weeklyTotalPomodoros}</span>
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
            <div className="flex flex-col gap-3">
              <div className="flex justify-center">
                <CustomPieChart data={weeklyChartData} compact hideLegend centerTotal={weeklyTotalPomodoros} />
              </div>
              <div className="space-y-2">
                {weeklyCoverageItems.slice(0, 5).map((item, index) => (
                  <div key={item.project.id} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: chartColors.bg[index] }}
                    />
                    <span className="text-sm text-foreground flex-1 truncate">{item.project.name}</span>
                    <span className="text-xs text-primary w-10 text-right">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Draggable workday timeline - drag the handle to adjust how much of the workday has elapsed
