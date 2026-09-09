"use client"

import { useAppState } from "@/lib/app-state"
import {
  aggregateBreaks,
  breakComplianceRate as computeBreakComplianceRate,
  breakTimeUsageRate as computeBreakTimeUsageRate,
  wellbeingScore as computeWellbeingScore,
  wellbeingLabel,
  pomodorosWithoutBreak as computePomodorosWithoutBreak,
} from "@/lib/break-stats"
import React, { useState } from "react"
import {
  Timer,
  Target,
  Coffee,
  Heart,
  Sparkles,
  Lightbulb,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getLocalDateStr } from "@/lib/app-utils"
import { vitalsForDay, vitalsForPeriod } from "@/lib/vitals"
import { VitalsPanel } from "@/components/vitals/vitals-panel"
import type { Settings, DailyStat } from "@/lib/types"

export const MobileBreaksPanel = () => {
  const { stats, settings } = useAppState()
  const [viewPeriod, setViewPeriod] = useState<"today" | "week" | "month">("today")
  
  const todayStr = getLocalDateStr()
  const todayStat = stats.find((s) => s.date === todayStr)
  
  // Calculate period stats
  const getPeriodStats = () => {
    const now = new Date()
    let startDate: Date
    
    if (viewPeriod === "today") {
      return todayStat ? [todayStat] : []
    } else if (viewPeriod === "week") {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
    } else {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 30)
    }
    
    return stats.filter((s) => {
      const statDate = new Date(s.date + "T00:00:00")
      return statDate >= startDate && statDate <= now
    })
  }
  
  const periodStats = getPeriodStats()
  
  // All of this maths now lives in lib/break-stats.ts, where it is unit
  // tested. Names are kept so the JSX below is unchanged.
  const totals = aggregateBreaks(periodStats)
  const {
    shortBreaks: totalShortBreaks,
    longBreaks: totalLongBreaks,
    shortBreakTime: totalShortBreakTime,
    longBreakTime: totalLongBreakTime,
    accumulatedBreakTime: totalAccumulatedBreakTime,
    shortBreaksSkipped: totalShortBreaksSkipped,
    longBreaksSkipped: totalLongBreaksSkipped,
    pomodoros: totalPomodoros,
    breaksTaken: totalBreaksTaken,
    breakTime: totalBreakTime,
  } = totals

  const breakComplianceRate = computeBreakComplianceRate(totals, settings.cyclesBeforeLongBreak)
  const breakTimeUsageRate = computeBreakTimeUsageRate(totals)
  const wellbeingScore = computeWellbeingScore(totals)
  const wellbeing = wellbeingLabel(wellbeingScore)
  const pomodorosWithoutBreak = computePomodorosWithoutBreak(todayStat)

  // Vitals. Today includes the stretch currently in progress, which is not yet
  // recorded in stats; a period must not, or that stretch is counted twice.
  const vitals =
    viewPeriod === "today"
      ? vitalsForDay(todayStat, settings)
      : vitalsForPeriod(periodStats, settings)
  const vitalsPeriodLabel =
    viewPeriod === "today" ? "today" : viewPeriod === "week" ? "last 7 days" : "last 30 days"

  const todayAccumulatedBreakTime = todayStat?.accumulatedBreakTime || 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-primary">Breaks</h1>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          {(["today", "week", "month"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setViewPeriod(period)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all capitalize",
                viewPeriod === period
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {period === "today" ? "Today" : period === "week" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Well-being Score Card */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-cyan-500/5">
          <CardContent className="p-3">
            {/* Info for accumulated break time */}
            {todayAccumulatedBreakTime > 0 && (
              <div className="flex items-center gap-1.5 mb-3">
                <Coffee className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] text-amber-400">
                  {todayAccumulatedBreakTime}m of break time saved today
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider mb-1">Well-being Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground leading-none">{wellbeingScore}</span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                <p className={cn("text-sm font-medium mt-1", wellbeing.color)}>{wellbeing.label}</p>
              </div>
              <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/20" />
                  <circle 
                    cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${wellbeingScore}, 100`}
                    className={cn(
                      wellbeingScore >= 80 ? "text-emerald-500" :
                      wellbeingScore >= 60 ? "text-cyan-500" :
                      wellbeingScore >= 40 ? "text-yellow-500" : "text-red-500"
                    )}
                  />
                </svg>
                <Heart className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5",
                  wellbeing.color
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
        
  {/* Break Compliance */}
  <Card className="border-cyan-500/30">
  <CardHeader className="pb-0">
  <CardTitle className="text-sm flex items-center gap-2">
  <Target className="h-4 w-4 text-cyan-400" />
  Break Balance
  </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
  <div className="flex items-center justify-between">
  <span className="text-sm text-muted-foreground">Time Taken vs Saved</span>
  <span className="text-lg font-bold text-cyan-400">{breakTimeUsageRate}%</span>
  </div>
  <div className="h-2 bg-muted rounded-full overflow-hidden">
  <div
  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
  style={{ width: `${breakTimeUsageRate}%` }}
  />
  </div>
  <div className="grid grid-cols-2 gap-3 pt-2">
  <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
  <div className="text-xl font-bold text-emerald-400 leading-tight">{totalBreakTime}m</div>
  <div className="text-xs text-muted-foreground">Break Time Taken</div>
  </div>
  <div className="text-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
  <div className="text-xl font-bold text-amber-400 leading-tight">{totalAccumulatedBreakTime}m</div>
  <div className="text-xs text-muted-foreground">Break Time Saved</div>
  </div>
  </div>
  </CardContent>
  </Card>
        
        {/* Break Details.
            Was two cards of 203px each, one per break type, both repeating the
            same three row labels. One table comparing short against long says
            the same thing in a third of the height and reads better, because
            the two are now actually side by side. */}
        <Card className="border-secondary/30">
          <CardContent className="p-2.5">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1.5 text-xs">
              <span className="text-muted-foreground" />
              <span className="flex items-center gap-1 justify-end text-muted-foreground">
                <Coffee className="h-3 w-3 text-secondary" />Short
              </span>
              <span className="flex items-center gap-1 justify-end text-muted-foreground">
                <Timer className="h-3 w-3 text-cyan-400" />Long
              </span>

              <span className="text-muted-foreground">Taken</span>
              <span className="text-right font-bold text-emerald-400">{totalShortBreaks}</span>
              <span className="text-right font-bold text-emerald-400">{totalLongBreaks}</span>

              <span className="text-muted-foreground">Skipped</span>
              <span className="text-right font-bold text-red-400">{totalShortBreaksSkipped}</span>
              <span className="text-right font-bold text-red-400">{totalLongBreaksSkipped}</span>

              <span className="text-muted-foreground pt-1 border-t border-border/30">Time</span>
              <span className="text-right font-medium text-foreground pt-1 border-t border-border/30">{totalShortBreakTime}m</span>
              <span className="text-right font-medium text-foreground pt-1 border-t border-border/30">{totalLongBreakTime}m</span>
            </div>
          </CardContent>
        </Card>
        
        {/* Total Rest Time */}
        <Card className="border-emerald-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Rest Time</p>
                  <p className="text-xl font-bold text-foreground">
                    {Math.floor(totalBreakTime / 60)}h {totalBreakTime % 60}m
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Avg per day</p>
                <p className="text-lg font-medium text-emerald-400">
                  {periodStats.length > 0 ? Math.round(totalBreakTime / periodStats.length) : 0}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Vitals: sitting and standing. Sits above the tip because it is
            measurement, and the tip below is advice derived from it. */}
        <VitalsPanel vitals={vitals} periodLabel={vitalsPeriodLabel} />

        {/* Tips Card */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Well-being Tip</p>
                <p className="text-xs text-muted-foreground">
                  {breakComplianceRate < 50 
                    ? "You're skipping too many breaks. Regular breaks improve focus and prevent burnout."
                    : breakComplianceRate < 80
                    ? "Good effort! Try to take more breaks to maintain optimal productivity."
                    : "Excellent break habits! Keep maintaining this healthy balance between work and rest."
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
