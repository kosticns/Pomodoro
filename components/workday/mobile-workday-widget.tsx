"use client"

import React from "react"
import {
  Timer,
  Play,
  Pause,
  Check,
  Briefcase,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useWorkdayTimer } from "@/hooks/use-workday-timer"

export const MobileWorkdayWidget = ({ workdayTimer }: { workdayTimer: ReturnType<typeof useWorkdayTimer> }) => {
  // Placeholder for the actual widget content
  return (
    <Card className="cyber-card relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black">
      <CardContent className="p-4 relative z-10">
        {workdayTimer.isWorkdayActive ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Briefcase className="h-5 w-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <div>
                  <div className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                    Workday Active {workdayTimer.isPaused && "(Paused)"}
                  </div>
                  <div className="text-xs text-foreground/60 font-mono">
                    {workdayTimer.workdayProgress.toFixed(0)}% complete
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={workdayTimer.toggleWorkdayPause}
                  className="h-8 px-3 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 bg-transparent"
                >
                  {workdayTimer.isPaused ? (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </>
                  )}
                </Button>
                <div className="text-right">
                  <div className="text-xl font-bold text-cyan-400 tabular-nums text-glow">
                    {workdayTimer.formatWorkdayTime(workdayTimer.remainingTime)}
                  </div>
                  <div className="text-xs text-foreground/60 uppercase tracking-wide font-mono">remaining</div>
                </div>
              </div>
            </div>
            <div className="w-full bg-black/40 rounded-sm h-2 border border-cyan-500/30 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{ width: `${workdayTimer.workdayProgress}%` }}
              />
            </div>
          </>
        ) : workdayTimer.workdayProgress >= 100 ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Briefcase className="h-5 w-5 text-emerald-400" />
              <div>
                <div className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Workday Complete!</div>
                <div className="text-xs text-foreground/60 font-mono">8h completed today</div>
              </div>
            </div>
            <Check className="h-7 w-7 text-emerald-400" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-bold text-foreground uppercase tracking-wider">Workday Timer</div>
                <div className="text-xs text-foreground/60 font-mono">Ready to start</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-foreground/60 uppercase tracking-wide mb-1 font-mono">Daily Goal</div>
              <div className="text-xl font-bold text-primary tabular-nums text-glow-yellow">8h 00m</div>
            </div>
          </div>
        )}
      </CardContent>
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary/60" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary/60" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary/60" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary/60" />
    </Card>
  )
}
