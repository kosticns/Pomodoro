"use client"

import React from "react"
import { Activity, ArrowDown, ArrowUp, RefreshCw, Scale } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Vitals, VitalsNote } from "@/lib/vitals"
import { vitalsNotes, formatMinutes } from "@/lib/vitals"

/**
 * Vitals: sitting and standing, reported rather than scored.
 *
 * Deliberately has no strain index. Every figure shown is either recorded or
 * arithmetic on recorded values, and every threshold is the user's own cadence
 * setting. See lib/vitals.ts.
 *
 * Colour follows the app's existing semantics: lime as the accent, amber for
 * something to act on. No new hues, and never colour alone; a "watch" reading
 * also carries an icon and the word in the text.
 */

const NOTE_ICON: Record<VitalsNote["area"], React.ComponentType<{ className?: string }>> = {
  "lower-back": ArrowDown,
  legs: ArrowUp,
  balance: Scale,
  movement: RefreshCw,
}

function PostureTile({
  label,
  minutes,
  longest,
  overrun,
  target,
  icon: Icon,
}: {
  label: string
  minutes: number
  longest: number
  overrun: number
  target: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex-1 rounded-lg border border-border/60 p-2.5 space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground leading-tight">{formatMinutes(minutes)}</p>
      <p className="text-xs text-muted-foreground leading-snug">
        Longest {formatMinutes(longest)}
        {overrun > 0 ? (
          <span className="text-amber-400">, {formatMinutes(overrun)} over {target}m</span>
        ) : (
          <span>, within {target}m</span>
        )}
      </p>
    </div>
  )
}

export function VitalsPanel({
  vitals,
  variant = "full",
  periodLabel,
}: {
  vitals: Vitals
  variant?: "full" | "compact"
  periodLabel?: string
}) {
  const notes = vitalsNotes(vitals)

  if (vitals.isEmpty) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Vitals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            No posture data yet. Vitals record once you switch between sitting and standing
            during a workday, using the control on the Timer screen.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (variant === "compact") {
    const watch = notes.filter((n) => n.level === "watch").length
    return (
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Vitals</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {vitals.standingSharePct}% standing
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Sat {formatMinutes(vitals.sittingMinutes)}</span>
            <span>Stood {formatMinutes(vitals.standingMinutes)}</span>
            <span>{vitals.postureSwitches} switches</span>
          </div>
          {watch > 0 && (
            <p className="text-xs text-amber-400">
              {watch} {watch === 1 ? "reading" : "readings"} past your {vitals.cadenceTarget}m target
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Vitals
          {periodLabel && (
            <span className="text-xs font-normal text-muted-foreground">{periodLabel}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex gap-2">
          <PostureTile
            label="Sitting"
            minutes={vitals.sittingMinutes}
            longest={vitals.longestSitStretch}
            overrun={vitals.sitOverrunMinutes}
            target={vitals.cadenceTarget}
            icon={ArrowDown}
          />
          <PostureTile
            label="Standing"
            minutes={vitals.standingMinutes}
            longest={vitals.longestStandStretch}
            overrun={vitals.standOverrunMinutes}
            target={vitals.cadenceTarget}
            icon={ArrowUp}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Standing share, {formatMinutes(vitals.totalTrackedMinutes)} tracked,{" "}
              {vitals.postureSwitches} {vitals.postureSwitches === 1 ? "switch" : "switches"}
            </span>
            <span className="font-medium text-foreground">{vitals.standingSharePct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, vitals.standingSharePct)}%` }}
            />
          </div>
        </div>

        <div className="space-y-1 pt-1.5 border-t border-border/40">
          {notes.map((note, i) => {
            const Icon = NOTE_ICON[note.area]
            return (
              <div key={i} className="flex items-start gap-2">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 mt-0.5 shrink-0",
                    note.level === "watch" ? "text-amber-400" : "text-primary",
                  )}
                />
                <p
                  className={cn(
                    "text-xs leading-snug",
                    note.level === "watch" ? "text-amber-400" : "text-muted-foreground",
                  )}
                >
                  {note.text}
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
