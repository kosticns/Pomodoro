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
import type { Project, Task } from "@/lib/types"
import { priorityOf } from "@/lib/priority"
import {
  applyDecision,
  applyProjectDecision,
  candidatesForToday,
  cascadeProjectDecisionToTasks,
  defaultChoice,
  initialDayPlanState,
  planPhase,
  projectTriageQueue,
  recordDecision,
  stepBack,
  tasksForProject,
  triageQueue,
  type DayPlanState,
  type TriageDecision,
} from "@/lib/day-plan"

export type DayPlanMode = "tasks" | "projects"

/**
 * Start-of-day prioritisation, for tasks or for projects.
 *
 * Walk everything unfinished, decide what it is for today, then choose what to
 * actually start. Either way the wizard ends by setting the active task, so the
 * Timer screen is already pointed at real work when it closes.
 *
 * In projects mode there is one extra step. Choosing a project is not yet
 * something you can start, so the wizard then asks which task inside it to
 * begin with. Without that it would stop one decision short of useful, which is
 * exactly what the old reviews did.
 *
 * Both replace per-item "Daily" reviews that set statuses and then ended
 * without choosing anything.
 *
 * All the state transitions are in lib/day-plan.ts with tests. This file is the
 * presentation only.
 */
export function DayPlanWizard({
  open,
  onOpenChange,
  mode = "tasks",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: DayPlanMode
}) {
  const { tasks, setTasks, projects, setProjects, setActiveTask } = useAppState()
  const [state, setState] = useState<DayPlanState>(initialDayPlanState)

  /**
   * The queue is snapshotted when the wizard opens, not derived on every
   * render.
   *
   * Deriving it live would be a real bug: triaging an item to Done removes it
   * from an unfinished-items filter, so the list would shrink underneath the
   * index and silently skip the next one. The old reviews worked around that by
   * not advancing the index after Done, which is the kind of fix that only
   * holds until someone adds a fifth action.
   */
  const [queue, setQueue] = useState<Array<Task | Project>>([])

  /** Projects mode only: the project confirmed on the pick step. */
  const [pickedProjectId, setPickedProjectId] = useState<string | null>(null)
  const [pickedTaskId, setPickedTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQueue(mode === "projects" ? projectTriageQueue(projects) : triageQueue(tasks))
    setState(initialDayPlanState())
    setPickedProjectId(null)
    setPickedTaskId(null)
    // tasks/projects are deliberately not dependencies. This runs on open and
    // takes the list as it was at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  const basePhase = planPhase(state, queue.length)
  const current = queue[state.index]
  const candidates = useMemo(
    () => candidatesForToday(queue, state.decisions),
    [queue, state.decisions],
  )

  /** Tasks inside the chosen project, for the extra projects-mode step. */
  const innerTasks = useMemo(
    () => (pickedProjectId ? tasksForProject(tasks, pickedProjectId) : []),
    [tasks, pickedProjectId],
  )

  const phase: "triage" | "pick" | "pickTask" | "empty" = pickedProjectId ? "pickTask" : basePhase

  // With one candidate there is nothing to choose, so it is preselected and the
  // step becomes a confirmation.
  useEffect(() => {
    if (phase !== "pick") return
    setState((prev) =>
      prev.chosenTaskId ? prev : { ...prev, chosenTaskId: defaultChoice(candidates) },
    )
  }, [phase, candidates])

  useEffect(() => {
    if (phase !== "pickTask") return
    setPickedTaskId((prev) => prev ?? defaultChoice(innerTasks))
  }, [phase, innerTasks])

  const decide = useCallback(
    (decision: TriageDecision) => {
      if (!current) return
      if (mode === "projects") {
        setProjects((prev) => applyProjectDecision(prev, current.id, decision))
        // Finishing or parking a project has to reach the work inside it.
        setTasks((prev) => cascadeProjectDecisionToTasks(prev, current.id, decision))
      } else {
        setTasks((prev) => applyDecision(prev, current.id, decision))
      }
      setState((prev) => recordDecision(prev, current.id, decision))
    },
    [current, mode, setTasks, setProjects],
  )

  const projectNameOf = (id: string) => projects.find((p) => p.id === id)?.name

  /** Puts a task on the Timer and closes. */
  const activate = (taskId: string) => {
    const live = tasks.find((t) => t.id === taskId)
    if (!live) return
    const touched = { ...live, status: "In Progress" as const, lastInteractionTime: Date.now() }
    setActiveTask(touched)
    setTasks((prev) => prev.map((t) => (t.id === taskId ? touched : t)))
    onOpenChange(false)
  }

  /** The pick step's primary action. */
  const confirmPick = () => {
    const chosenId = state.chosenTaskId
    if (!chosenId) return
    if (mode === "projects") {
      // A project is not something you can start, so ask what inside it is.
      setPickedProjectId(chosenId)
      return
    }
    activate(chosenId)
  }

  const progress = queue.length ? Math.min(state.index + 1, queue.length) : 0
  const isProjects = mode === "projects"
  const noun = isProjects ? "project" : "task"

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
                  <Sunrise className={cn("h-5 w-5", isProjects ? "text-purple-400" : "text-cyan-400")} />
                  <DialogTitle className="font-semibold text-foreground text-base">
                    {isProjects ? "Plan your projects" : "Plan your day"}
                  </DialogTitle>
                </div>
                <span className="text-sm text-muted-foreground">
                  {progress} of {queue.length}
                </span>
              </div>
              <div className="h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300 bg-gradient-to-r",
                    isProjects ? "from-purple-500 to-primary" : "from-cyan-500 to-primary",
                  )}
                  style={{ width: `${(progress / queue.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="px-5 py-4">
              {isProjects ? (
                <Badge variant="outline" className="mb-2 text-xs border-primary/30">
                  {priorityOf(current as Project)} priority
                </Badge>
              ) : projectNameOf((current as Task).projectId) ? (
                <Badge variant="outline" className="mb-2 text-xs border-primary/30">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  {projectNameOf((current as Task).projectId)}
                </Badge>
              ) : null}

              <h3 className="text-xl font-bold text-foreground mb-2">
                {(current as Task | Project).name}
              </h3>

              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Timer className="h-4 w-4" />
                  {isProjects
                    ? `${tasksForProject(tasks, current.id).length} open tasks`
                    : `${(current as Task).completedPomodoros} ${
                        (current as Task).completedPomodoros === 1 ? "pomodoro" : "pomodoros"
                      }`}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    current.status === "In Progress" && "border-cyan-500/50 text-cyan-500",
                    current.status === "Ongoing" && "border-cyan-500/50 text-cyan-500",
                    (current.status === "To Do" || current.status === "On Hold") &&
                      "border-muted-foreground/50 text-muted-foreground",
                  )}
                >
                  {current.status}
                </Badge>
              </div>

              <DialogDescription className="text-sm text-muted-foreground mb-4">
                Is this {noun} for today?
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

              {isProjects ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Finishing a project finishes its tasks. Parking one parks the work in progress
                  inside it.
                </p>
              ) : null}

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
        ) : phase === "pickTask" ? (
          <div className="px-5 py-5">
            <div className="flex items-center gap-2 mb-1 pr-6">
              <FolderOpen className="h-5 w-5 text-purple-400" />
              <DialogTitle className="font-semibold text-foreground text-base">
                {projectNameOf(pickedProjectId!) ?? "Chosen project"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground mb-4">
              {innerTasks.length === 0
                ? "This project has no open tasks. Add one, then come back."
                : innerTasks.length === 1
                  ? "One open task. It will be waiting on the timer."
                  : `${innerTasks.length} open tasks. Pick the one to start.`}
            </DialogDescription>

            {innerTasks.length > 0 ? (
              <div
                role="radiogroup"
                aria-label="Task to start first"
                className="space-y-2 mb-5 max-h-[40vh] overflow-y-auto"
              >
                {innerTasks.map((task) => {
                  const selected = pickedTaskId === task.id
                  return (
                    <button
                      key={task.id}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPickedTaskId(task.id)}
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
                            {task.completedPomodoros}{" "}
                            {task.completedPomodoros === 1 ? "pomodoro" : "pomodoros"}
                          </div>
                        </div>
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
            ) : null}

            {innerTasks.length > 0 ? (
              <Button
                onClick={() => pickedTaskId && activate(pickedTaskId)}
                disabled={!pickedTaskId}
                className="w-full h-12"
              >
                <Play className="h-4 w-4 mr-2" />
                Start this task
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => setPickedProjectId(null)}
              className="w-full h-10 mt-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Choose a different project
            </Button>
          </div>
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
                ? isProjects
                  ? "One project for today. Next, pick what to start inside it."
                  : "One task for today. It will be waiting on the timer."
                : `${candidates.length} ${noun}s for today. Pick the one to start.`}
            </DialogDescription>

            <div
              role="radiogroup"
              aria-label={isProjects ? "Project to focus on" : "Task to start first"}
              className="space-y-2 mb-5 max-h-[40vh] overflow-y-auto"
            >
              {candidates.map((item) => {
                const selected = state.chosenTaskId === item.id
                return (
                  <button
                    key={item.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setState((prev) => ({ ...prev, chosenTaskId: item.id }))}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 min-h-[56px] transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/50 hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {isProjects
                            ? `${priorityOf(item as Project)} priority, ${
                                tasksForProject(tasks, item.id).length
                              } open`
                            : (projectNameOf((item as Task).projectId) ?? "No project")}
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

            <Button onClick={confirmPick} disabled={!state.chosenTaskId} className="w-full h-12">
              <Play className="h-4 w-4 mr-2" />
              {isProjects ? "Work on this project" : "Start this task"}
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
          /* Nothing to start: either nothing unfinished at all, or everything
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
                ? `No unfinished ${noun}s. Add one when you are ready.`
                : `Everything was put off or finished. Add a ${noun} or run this again when you have something to work on.`}
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
