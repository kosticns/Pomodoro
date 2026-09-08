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

  const todayAccumulatedBreakTime = todayStat?.accumulatedBreakTime || 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/95 backdrop-blur">
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
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Well-being Score Card */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-cyan-500/5">
          <CardContent className="p-5">
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Well-being Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">{wellbeingScore}</span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                <p className={cn("text-sm font-medium mt-1", wellbeing.color)}>{wellbeing.label}</p>
              </div>
              <div className="relative w-20 h-20">
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
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6",
                  wellbeing.color
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
        
  {/* Break Compliance */}
  <Card className="border-cyan-500/30">
  <CardHeader className="pb-2">
  <CardTitle className="text-base flex items-center gap-2">
  <Target className="h-4 w-4 text-cyan-400" />
  Break Balance
  </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
  <div className="flex items-center justify-between">
  <span className="text-sm text-muted-foreground">Time Taken vs Saved</span>
  <span className="text-lg font-bold text-cyan-400">{breakTimeUsageRate}%</span>
  </div>
  <div className="h-3 bg-muted rounded-full overflow-hidden">
  <div
  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
  style={{ width: `${breakTimeUsageRate}%` }}
  />
  </div>
  <div className="grid grid-cols-2 gap-4 pt-2">
  <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
  <div className="text-2xl font-bold text-emerald-400">{totalBreakTime}m</div>
  <div className="text-xs text-muted-foreground">Break Time Taken</div>
  </div>
  <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
  <div className="text-2xl font-bold text-amber-400">{totalAccumulatedBreakTime}m</div>
  <div className="text-xs text-muted-foreground">Break Time Saved</div>
  </div>
  </div>
  </CardContent>
  </Card>
        
        {/* Break Details */}
        <div className="grid grid-cols-2 gap-3">
          {/* Short Breaks */}
          <Card className="border-secondary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 border border-secondary/30 flex items-center justify-center">
                  <Coffee className="h-4 w-4 text-secondary" />
                </div>
                <span className="text-xs text-muted-foreground">Short Breaks</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Taken</span>
                  <span className="text-lg font-bold text-emerald-400">{totalShortBreaks}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Skipped</span>
                  <span className="text-lg font-bold text-red-400">{totalShortBreaksSkipped}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">Time</span>
                  <span className="text-sm font-medium text-foreground">{totalShortBreakTime}m</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Long Breaks */}
          <Card className="border-cyan-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Timer className="h-4 w-4 text-cyan-400" />
                </div>
                <span className="text-xs text-muted-foreground">Long Breaks</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Taken</span>
                  <span className="text-lg font-bold text-emerald-400">{totalLongBreaks}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Skipped</span>
                  <span className="text-lg font-bold text-red-400">{totalLongBreaksSkipped}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">Time</span>
                  <span className="text-sm font-medium text-foreground">{totalLongBreakTime}m</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Total Rest Time */}
        <Card className="border-emerald-500/30">
          <CardContent className="p-4">
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
        
        {/* Tips Card */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
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
