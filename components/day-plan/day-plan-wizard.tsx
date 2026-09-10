"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  FolderOpen,
  Play,
  SkipForward,
  Sunrise,
  Timer,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppState } from "@/lib/app-state"
import type { Task } from "@/lib/types"
import {
  applyDecision,
  candidatesForToday,
  defaultChoice,
  initialDayPlanState,
  planPhase,
  recordDecision,
  stepBack,
  triageQueue,
  type DayPlanState,
  type TriageDecision,
} from "@/lib/day-plan"

/**
 * Start-of-day task prioritisation.
 *
 * Walk every unfinished task, decide what it is for today, then choose the one
 * to actually start. The chosen task becomes the active task, so the Timer
 * screen is already pointed at it when the wizard closes.
 *
 * This replaces the old Daily Review, which triaged statuses and then ended
 * without choosing anything, leaving the active task as whatever it was
 * yesterday.
 *
 * All the state transitions are in lib/day-plan.ts with tests. This file is
 * the presentation only.
 */
export function DayPlanWizard({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { tasks, setTasks, projects, setActiveTask } = useAppState()
  const [state, setState] = useState<DayPlanState>(initialDayPlanState)

  /**
   * The queue is snapshotted when the wizard opens, not derived from `tasks`
   * on every render.
   *
   * Deriving it live would be a real bug: triaging a task to Done removes it
   * from an unfinished-tasks filter, so the list would shrink underneath the
   * index and silently skip the next task. The old Daily Review worked around
   * that by not advancing the index after Done, which is the kind of fix that
   * only holds until someone adds a fifth action.
   */
  const [queue, setQueue] = useState<Task[]>([])

  useEffect(() => {
    if (!open) return
    setQueue(triageQueue(tasks))
    setState(initialDayPlanState())
    // tasks is deliberately not a dependency. This runs on open and takes the
    // list as it was at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const phase = planPhase(state, queue.length)
  const current = queue[state.index]
  const candidates = useMemo(
    () => candidatesForToday(queue, state.decisions),
    [queue, state.decisions],
  )

  // With one candidate there is nothing to choose, so it is preselected and the
  // last step becomes a confirmation.
  useEffect(() => {
    if (phase !== "pick") return
    setState((prev) =>
      prev.chosenTaskId ? prev : { ...prev, chosenTaskId: defaultChoice(candidates) },
    )
  }, [phase, candidates])

  const decide = useCallback(
    (decision: TriageDecision) => {
      if (!current) return
      setTasks((prev) => applyDecision(prev, current.id, decision))
      setState((prev) => recordDecision(prev, current.id, decision))
    },
    [current, setTasks],
  )

  const projectName = (task: Task) => projects.find((p) => p.id === task.projectId)?.name

  const start = () => {
    const chosen = candidates.find((t) => t.id === state.chosenTaskId)
    if (!chosen) return
    // Read the task back out of current state rather than using the snapshot,
    // so the active task carries the status the triage just set.
    const live = tasks.find((t) => t.id === chosen.id) ?? chosen
    setActiveTask({ ...live, status: "In Progress", lastInteractionTime: Date.now() })
    setTasks((prev) =>
      prev.map((t) =>
        t.id === chosen.id ? { ...t, status: "In Progress", lastInteractionTime: Date.now() } : t,
      ),
    )
    onOpenChange(false)
  }

  const progress = queue.length ? Math.min(state.index + 1, queue.length) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md border-cyan-500/30 bg-background/95 backdrop-blur-sm p-0 overflow-hidden">
        {phase === "triage" && current ? (
          <>
            <div className="px-5 pt-5 pb-3 border-b border-border/30">
              {/* pr-6 keeps the counter clear of the dialog's own close button,
                  which is absolutely positioned at top-4 right-4. */}
              <div className="flex items-center justify-between mb-2 pr-6">
                <div className="flex items-center gap-2">
                  <Sunrise className="h-5 w-5 text-cyan-400" />
                  <DialogTitle className="font-semibold text-foreground text-base">
                    Plan your day
                  </DialogTitle>
                </div>
                <span className="text-sm text-muted-foreground">
                  {progress} of {queue.length}
                </span>
              </div>
              <div className="h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-primary rounded-full transition-all duration-300"
                  style={{ width: `${(progress / queue.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="px-5 py-4">
              {projectName(current) ? (
                <Badge variant="outline" className="mb-2 text-xs border-primary/30">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  {projectName(current)}
                </Badge>
              ) : null}

              <h3 className="text-xl font-bold text-foreground mb-2">{current.name}</h3>

              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Timer className="h-4 w-4" />
                  {current.completedPomodoros}{" "}
                  {current.completedPomodoros === 1 ? "pomodoro" : "pomodoros"}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    current.status === "In Progress" && "border-cyan-500/50 text-cyan-500",
                    current.status === "To Do" &&
                      "border-muted-foreground/50 text-muted-foreground",
                  )}
                >
                  {current.status}
                </Badge>
              </div>

              <DialogDescription className="text-sm text-muted-foreground mb-4">
                Is this one for today?
              </DialogDescription>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => decide("today")}
                  className="h-14 flex flex-col items-center gap-1 border-cyan-500/30 hover:bg-cyan-500/10"
                >
                  <Play className="h-5 w-5 text-cyan-400" />
                  <span className="text-xs">Today</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decide("later")}
                  className="h-14 flex flex-col items-center gap-1 border-muted-foreground/30 hover:bg-muted-foreground/10"
                >
                  <Circle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs">Later</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decide("done")}
                  className="h-14 flex flex-col items-center gap-1 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-xs">Done</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decide("skip")}
                  className="h-14 flex flex-col items-center gap-1 border-yellow-500/30 hover:bg-yellow-500/10"
                >
                  <SkipForward className="h-5 w-5 text-yellow-400" />
                  <span className="text-xs">Skip</span>
                </Button>
              </div>

              {state.index > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => setState(stepBack)}
                  className="mt-3 w-full h-10 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : null}
            </div>
          </>
        ) : phase === "pick" && candidates.length > 0 ? (
          <div className="px-5 py-5">
            <div className="flex items-center gap-2 mb-1 pr-6">
              <CalendarClock className="h-5 w-5 text-primary" />
              <DialogTitle className="font-semibold text-foreground text-base">
                {candidates.length === 1 ? "Start with this" : "What matters most?"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground mb-4">
              {candidates.length === 1
                ? "One task for today. It will be waiting on the timer."
                : `${candidates.length} tasks for today. Pick the one to start.`}
            </DialogDescription>

            <div
              role="radiogroup"
              aria-label="Task to start first"
              className="space-y-2 mb-5 max-h-[40vh] overflow-y-auto"
            >
              {candidates.map((task) => {
                const selected = state.chosenTaskId === task.id
                return (
                  <button
                    key={task.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setState((prev) => ({ ...prev, chosenTaskId: task.id }))}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 min-h-[56px] transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/50 hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{task.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {projectName(task) ?? "No project"}
                        </div>
                      </div>
                      {/* A check, not colour alone, carries the selected state. */}
                      {selected ? (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <Button onClick={start} disabled={!state.chosenTaskId} className="w-full h-12">
              <Play className="h-4 w-4 mr-2" />
              Start this task
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full h-10 mt-1 text-muted-foreground hover:text-foreground"
            >
              Not now
            </Button>
          </div>
        ) : (
          /* Nothing to start: either no unfinished tasks at all, or everything
             was deferred. Both are legitimate answers, so neither is an error. */
          <div className="px-5 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground mb-2">
              {queue.length === 0 ? "Nothing on the list" : "Nothing set for today"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mb-6">
              {queue.length === 0
                ? "No unfinished tasks. Add one when you are ready."
                : "Everything was put off or finished. Add a task or run this again when you have something to work on."}
            </DialogDescription>
            <Button onClick={() => onOpenChange(false)} className="w-full h-12">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
