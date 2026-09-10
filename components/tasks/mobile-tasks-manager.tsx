"use client"

import { useAppState } from "@/lib/app-state"
import React, { useState } from "react"
import {
  Timer,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Play,
  Pause,
  SkipForward,
  Check,
  Search,
  ArrowUpDown,
  CheckSquare,
  FolderOpen,
  ChevronRight,
  Sunrise,
  Circle,
  CheckCircle2,
  StickyNote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TaskStatus, ProjectStatus, Project, Note, Task } from "@/lib/types"

export const MobileTasksManager = ({ onStartDayPlan }: { onStartDayPlan: () => void }) => {
  const { projects, setProjects, tasks, setTasks, activeTask, setActiveTask, notes } = useAppState()
  // Top-level tab: Tasks or Projects
  const [mainTab, setMainTab] = useState<"tasks" | "projects">("tasks")
  
  // Tasks tab state
  const [viewTab, setViewTab] = useState<"all" | "active" | "done">("active")
  const [filterProject, setFilterProject] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>("activity")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false)
  const [isAddProjectDialogOpen, setIsAddProjectDialogOpen] = useState(false)
  const [newTaskName, setNewTaskName] = useState("")
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>("")
  const [newProjectName, setNewProjectName] = useState("")
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [menuTask, setMenuTask] = useState<Task | null>(null)
  
  // Projects tab state
  const [projectViewTab, setProjectViewTab] = useState<"all" | "active" | "done">("active")
  const [projectSortBy, setProjectSortBy] = useState<string>("activity")
  const [projectSearchQuery, setProjectSearchQuery] = useState("")
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [menuProject, setMenuProject] = useState<Project | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  
  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }
  
  const getProjectTasks = (projectId: string) => tasks.filter((t) => t.projectId === projectId)
  
  // Notes viewer state
  const [viewingNotesTask, setViewingNotesTask] = useState<Task | null>(null)
  const getTaskNotes = (taskId: string) => notes.filter((n) => n.taskId === taskId).sort((a, b) => b.createdAt - a.createdAt)
  
  // The per-task Daily Review used to live here. It set each task's status one
  // at a time and then stopped, never choosing what to work on, so it left the
  // active task as whatever it was the day before. DayPlanWizard replaces it
  // and ends by activating the chosen task; the button above opens that.
  const incompleteTasks = tasks.filter((t) => t.status !== "Done")

  // Project Daily review state
  const [isProjectDailyReviewOpen, setIsProjectDailyReviewOpen] = useState(false)
  const [projectDailyReviewIndex, setProjectDailyReviewIndex] = useState(0)
  const incompleteProjects = projects
    .filter((p) => p.status !== "Done")
    .sort((a, b) => (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0))
  const currentReviewProject = incompleteProjects[projectDailyReviewIndex]
  
  const startProjectDailyReview = () => {
    setProjectDailyReviewIndex(0)
    setIsProjectDailyReviewOpen(true)
  }
  
  const handleProjectDailyReviewAction = (action: "Ongoing" | "On Hold" | "Done" | "Skip") => {
    if (currentReviewProject && action !== "Skip") {
      // Update project status
      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentReviewProject.id ? { ...p, status: action } : p
        )
      )
      
      // If project is marked as Done, mark all its tasks as Done too
      if (action === "Done") {
        setTasks((prev) =>
          prev.map((t) =>
            t.projectId === currentReviewProject.id ? { ...t, status: "Done" } : t
          )
        )
      }
      
      // If project is On Hold, set all incomplete tasks to To Do (paused state)
      if (action === "On Hold") {
        setTasks((prev) =>
          prev.map((t) =>
            t.projectId === currentReviewProject.id && t.status === "In Progress" 
              ? { ...t, status: "To Do" } 
              : t
          )
        )
      }
    }
    
    // When marking as Done, the project will be removed from incompleteProjects array
    if (action === "Done") {
      if (incompleteProjects.length <= 1) {
        setIsProjectDailyReviewOpen(false)
      }
    } else {
      if (projectDailyReviewIndex < incompleteProjects.length - 1) {
        setProjectDailyReviewIndex(projectDailyReviewIndex + 1)
      } else {
        setIsProjectDailyReviewOpen(false)
      }
    }
  }
  
  const projectStatusOptions: ProjectStatus[] = ["On Hold", "Ongoing", "Done"]

  // Get project by ID
  const getProject = (projectId: string) => projects.find((p) => p.id === projectId)

  // Get active projects (not Done), sorted by recent activity
  const activeProjects = projects
    .filter((p) => p.status !== "Done")
    .sort((a, b) => (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0))
  
  // All projects sorted by recent activity (for dropdowns)
  const projectsByActivity = [...projects].sort((a, b) => (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0))

  // Sort tasks
  const sortedTasks = [...tasks].sort((a, b) => {
    switch (sortBy) {
      case "status": {
        // Active work first, then paused, then finished. Typed against
        // TaskStatus so adding a status fails the build rather than sorting
        // silently as undefined.
        const order: Record<TaskStatus, number> = { "In Progress": 0, "To Do": 1, Done: 2 }
        return order[a.status] - order[b.status]
      }
      case "name":
        return a.name.localeCompare(b.name)
      case "project":
        return (getProject(a.projectId)?.name || "").localeCompare(getProject(b.projectId)?.name || "")
      case "pomodoros":
        return b.completedPomodoros - a.completedPomodoros
      case "activity":
        return (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0)
      default:
        return 0
    }
  })

  // Filter tasks
  const filteredTasks = sortedTasks.filter((task) => {
    // Filter by tab
    if (viewTab === "active" && task.status === "Done") return false
    if (viewTab === "done" && task.status !== "Done") return false

    // Filter by project
    if (filterProject && task.projectId !== filterProject) return false

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const project = getProject(task.projectId)
      return task.name.toLowerCase().includes(query) || project?.name.toLowerCase().includes(query)
    }

    return true
  })

  // Counts for badges
  const activeTaskCount = tasks.filter((t) => t.status !== "Done").length
  const doneTaskCount = tasks.filter((t) => t.status === "Done").length

  // Add new task
  const handleAddTask = () => {
    if (!newTaskName.trim() || !newTaskProjectId) return

    const newTask: Task = {
      id: `task-${Date.now()}`,
  name: newTaskName.trim(),
  projectId: newTaskProjectId,
  completedPomodoros: 0,
  status: "In Progress",
  lastInteractionTime: Date.now(),
  }

    setTasks([...tasks, newTask])
    setNewTaskName("")
    setIsAddTaskDialogOpen(false)
  }

  // Add new project
  const handleAddProject = () => {
    if (!newProjectName.trim()) return

    const newProject: Project = {
      id: `project-${Date.now()}`,
      name: newProjectName.trim(),
      status: "Ongoing",
      createdAt: Date.now(),
      lastInteractionTime: Date.now(),
    }

    setProjects([...projects, newProject])
    setNewTaskProjectId(newProject.id)
    setNewProjectName("")
    setIsAddProjectDialogOpen(false)
  }

  // Update task status
  const handleUpdateTaskStatus = (status: TaskStatus) => {
    if (!menuTask) return
    setTasks(tasks.map((t) => (t.id === menuTask.id ? { ...t, status, lastInteractionTime: Date.now() } : t)))
    setMenuTask(null)
  }

  // Edit task
  const handleEditTask = () => {
    if (!editingTask || !editingTask.name.trim()) return
    setTasks(tasks.map((t) => (t.id === editingTask.id ? { ...editingTask, lastInteractionTime: Date.now() } : t)))
    setEditingTask(null)
  }

  // Delete task
  const handleDeleteTask = () => {
    if (!menuTask) return
    if (!confirm("Delete this task?")) return
    if (activeTask?.id === menuTask.id) setActiveTask(null)
    setTasks(tasks.filter((t) => t.id !== menuTask.id))
    setMenuTask(null)
  }

  // Set as active task
  const handleSetActiveTask = () => {
  if (!menuTask) return
  setActiveTask(menuTask)
  setMenuTask(null)
  }

  const taskStatusOptions: TaskStatus[] = ["In Progress", "Done"]

  // Sort projects
  const sortedProjects = [...projects].sort((a, b) => {
    switch (projectSortBy) {
      case "status": {
        const order = { Ongoing: 0, "On Hold": 1, Done: 2 }
        return order[a.status] - order[b.status]
      }
      case "name":
        return a.name.localeCompare(b.name)
      case "tasks":
        return tasks.filter((t) => t.projectId === b.id).length - tasks.filter((t) => t.projectId === a.id).length
      case "activity":
        return (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0)
      default:
        return 0
    }
  })

  // Filter projects
  const filteredProjects = sortedProjects.filter((project) => {
    // Filter by tab
    if (projectViewTab === "active" && project.status === "Done") return false
    if (projectViewTab === "done" && project.status !== "Done") return false

    // Filter by search
    if (projectSearchQuery) {
      return project.name.toLowerCase().includes(projectSearchQuery.toLowerCase())
    }

    return true
  })

  // Project counts for badges
  const activeProjectCount = projects.filter((p) => p.status !== "Done").length
  const doneProjectCount = projects.filter((p) => p.status === "Done").length

  // Update project status
  const handleUpdateProjectStatus = (status: ProjectStatus) => {
    if (!menuProject) return
    setProjects(projects.map((p) => (p.id === menuProject.id ? { ...p, status, lastInteractionTime: Date.now() } : p)))
    setMenuProject(null)
  }

  // Edit project
  const handleEditProject = () => {
    if (!editingProject || !editingProject.name.trim()) return
    setProjects(projects.map((p) => (p.id === editingProject.id ? { ...editingProject, lastInteractionTime: Date.now() } : p)))
    setEditingProject(null)
  }

  // Delete project
  const handleDeleteProject = () => {
    if (!menuProject) return
    const projectTasks = tasks.filter((t) => t.projectId === menuProject.id)
    if (projectTasks.length > 0) {
      if (!confirm(`This project has ${projectTasks.length} task(s). Delete project and all its tasks?`)) return
      setTasks(tasks.filter((t) => t.projectId !== menuProject.id))
      if (activeTask && activeTask.projectId === menuProject.id) setActiveTask(null)
    } else {
      if (!confirm("Delete this project?")) return
    }
    setProjects(projects.filter((p) => p.id !== menuProject.id))
    setMenuProject(null)
  }

  // Get task count for a project
  const getProjectTaskCount = (projectId: string) => tasks.filter((t) => t.projectId === projectId).length
  const getProjectActiveTaskCount = (projectId: string) => tasks.filter((t) => t.projectId === projectId && t.status !== "Done").length
  const getProjectCompletedPomodoros = (projectId: string) => tasks.filter((t) => t.projectId === projectId).reduce((sum, t) => sum + t.completedPomodoros, 0)

  // Project colors for tags
  const projectColors = [
    "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    "bg-green-500/20 text-green-400 border-green-500/40",
    "bg-purple-500/20 text-purple-400 border-purple-500/40",
    "bg-pink-500/20 text-pink-400 border-pink-500/40",
    "bg-orange-500/20 text-orange-400 border-orange-500/40",
    "bg-blue-500/20 text-blue-400 border-blue-500/40",
    "bg-red-500/20 text-red-400 border-red-500/40",
  ]

  const getProjectColor = (projectId: string) => {
    const index = projects.findIndex((p) => p.id === projectId)
    return projectColors[index % projectColors.length]
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with Top-Level Tab Switcher */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          <button
            onClick={() => setMainTab("tasks")}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
              mainTab === "tasks"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tasks
          </button>
          <button
            onClick={() => setMainTab("projects")}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
              mainTab === "projects"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Projects
          </button>
        </div>
        
        {mainTab === "tasks" ? (
          <div className="flex items-center gap-2">
            {/* Opens the same prioritisation wizard the morning prompt runs,
                so triage behaves identically whichever way you reach it. */}
            <Button
              variant="outline"
              size="sm"
              onClick={onStartDayPlan}
              disabled={incompleteTasks.length === 0}
              className="h-9 px-3 border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-400"
            >
              <Sunrise className="h-4 w-4 mr-1.5 text-cyan-400" />
              <span className="text-sm">Plan day</span>
            </Button>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] h-9 bg-background/50 border-primary/30">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="name">By Name</SelectItem>
                <SelectItem value="project">By Project</SelectItem>
                <SelectItem value="pomodoros">Most Pomodoros</SelectItem>
                <SelectItem value="activity">Recent Activity</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsAddTaskDialogOpen(true)} size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Project Daily Review Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={startProjectDailyReview}
              disabled={incompleteProjects.length === 0}
              className="h-9 px-3 border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-400"
            >
              <Sunrise className="h-4 w-4 mr-1.5 text-cyan-400" />
              <span className="text-sm">Daily</span>
            </Button>
            <Select value={projectSortBy} onValueChange={setProjectSortBy}>
              <SelectTrigger className="w-[140px] h-9 bg-background/50 border-primary/30">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="name">By Name</SelectItem>
                <SelectItem value="tasks">Most Tasks</SelectItem>
                <SelectItem value="activity">Recent Activity</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsAddProjectDialogOpen(true)} size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* TASKS TAB CONTENT */}
      {mainTab === "tasks" && (
        <>
          {/* Search & Project Filter */}
          <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks or projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-background/50 border-primary/30"
              />
            </div>
            
            {/* Project filter tags */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFilterProject(null)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-all",
                  filterProject === null
                    ? "bg-primary/20 text-primary border-primary"
                    : "bg-background/50 text-muted-foreground border-border/50 hover:border-primary/50"
                )}
              >
                All Projects
              </button>
              {activeProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setFilterProject(filterProject === project.id ? null : project.id)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-all",
                    filterProject === project.id
                      ? getProjectColor(project.id)
                      : "bg-background/50 text-muted-foreground border-border/50 hover:border-primary/50"
                  )}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => setViewTab("active")}
          className={cn(
            "flex-1 px-4 py-2.5 text-sm font-medium transition-all relative",
            viewTab === "active"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          Active
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/30">
            {activeTaskCount}
          </span>
        </button>
        <button
          onClick={() => setViewTab("done")}
          className={cn(
            "flex-1 px-4 py-2.5 text-sm font-medium transition-all relative",
            viewTab === "done"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          Done
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/30">
            {doneTaskCount}
          </span>
        </button>
        <button
          onClick={() => setViewTab("all")}
          className={cn(
            "flex-1 px-4 py-2.5 text-sm font-medium transition-all relative",
            viewTab === "all"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          All
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/30">
            {tasks.length}
          </span>
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "No tasks match your search" : filterProject ? "No tasks in this project" : `No ${viewTab === "all" ? "" : viewTab} tasks yet`}
            </p>
            {!searchQuery && !filterProject && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 bg-transparent"
                onClick={() => setIsAddTaskDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const project = getProject(task.projectId)
            const isActive = activeTask?.id === task.id

            return (
              <Card
                key={task.id}
                className={cn(
                  "border-primary/20 bg-card/50 hover:border-primary/40 transition-all",
                  isActive && "border-cyan-500/50 bg-cyan-500/5"
                )}
              >
                <CardContent className="p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className={cn(
                          "font-medium text-sm",
                          task.status === "Done" && "text-muted-foreground line-through"
                        )}>
                          {task.name}
                        </h3>
                        {isActive && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40 text-xs px-1.5">
                            ACTIVE
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Project Tag */}
                        <button
                          onClick={() => setFilterProject(filterProject === task.projectId ? null : task.projectId)}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded border transition-all hover:opacity-80",
                            getProjectColor(task.projectId)
                          )}
                        >
                          {project?.name || "Unknown"}
                        </button>
                        
                        {/* Status Badge */}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs px-1.5",
                            task.status === "Done" && "border-green-500/50 text-green-500",
                            task.status === "In Progress" && "border-cyan-500/50 text-cyan-500",
                            
                          )}
                        >
                          {task.status}
                        </Badge>
                        
                        {/* Pomodoro count */}
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Timer className="h-3 w-3" />
                          {task.completedPomodoros}
                        </span>
                        
                        {/* Notes count - clickable */}
                        <button
                          onClick={() => setViewingNotesTask(task)}
                          className={cn(
                            "text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors",
                            notes.filter(n => n.taskId === task.id).length > 0 
                              ? "text-primary" 
                              : "text-muted-foreground"
                          )}
                        >
                          <StickyNote className="h-3 w-3" />
                          {notes.filter(n => n.taskId === task.id).length || 0}
                        </button>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-primary/20 shrink-0"
                      onClick={() => setMenuTask(task)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
        </>
      )}

      {/* PROJECTS TAB CONTENT */}
      {mainTab === "projects" && (
        <>
          {/* Search */}
          <div className="px-4 pt-3 pb-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-background/50 border-primary/30"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border/50">
            <button
              onClick={() => setProjectViewTab("active")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-all relative",
                projectViewTab === "active"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              Active
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/30">
                {activeProjectCount}
              </span>
            </button>
            <button
              onClick={() => setProjectViewTab("done")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-all relative",
                projectViewTab === "done"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              Done
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/30">
                {doneProjectCount}
              </span>
            </button>
            <button
              onClick={() => setProjectViewTab("all")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-all relative",
                projectViewTab === "all"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              All
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/30">
                {projects.length}
              </span>
            </button>
          </div>

          {/* Project List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">
                  {projectSearchQuery ? "No projects match your search" : `No ${projectViewTab === "all" ? "" : projectViewTab} projects yet`}
                </p>
                {!projectSearchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 bg-transparent"
                    onClick={() => setIsAddProjectDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Project
                  </Button>
                )}
              </div>
            ) : (
              filteredProjects.map((project) => {
                const taskCount = getProjectTaskCount(project.id)
                const activeTaskCount = getProjectActiveTaskCount(project.id)
                const completedPomodoros = getProjectCompletedPomodoros(project.id)
                const projectTasks = getProjectTasks(project.id)
                const isExpanded = expandedProjects.has(project.id)

                return (
                  <Card
                    key={project.id}
                    className={cn(
                      "border-primary/20 bg-card/50 transition-all overflow-hidden",
                      getProjectColor(project.id).replace("text-", "border-").split(" ")[2]
                    )}
                  >
                    <CardContent className="p-0">
                      {/* Project Header - Clickable to expand */}
                      <div 
                        className="p-3 cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => toggleProjectExpanded(project.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ChevronRight className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                              isExpanded && "rotate-90"
                            )} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className={cn(
                                  "font-medium text-sm",
                                  project.status === "Done" && "text-muted-foreground line-through"
                                )}>
                                  {project.name}
                                </h3>
                              </div>
                              
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Status Badge */}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs px-1.5",
                                    project.status === "Done" && "border-green-500/50 text-green-500",
                                    project.status === "Ongoing" && "border-cyan-500/50 text-cyan-500",
                                    project.status === "On Hold" && "border-yellow-500/50 text-yellow-500",
                                  )}
                                >
                                  {project.status}
                                </Badge>
                                
                                {/* Task count */}
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <CheckSquare className="h-3 w-3" />
                                  {activeTaskCount}/{taskCount} tasks
                                </span>
                                
  {/* Pomodoro count */}
  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
  <Timer className="h-3 w-3" />
  {completedPomodoros} pomodoros
  </span>
  
  {/* Notes count */}
  {notes.filter(n => n.projectId === project.id).length > 0 && (
  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
  <StickyNote className="h-3 w-3" />
  {notes.filter(n => n.projectId === project.id).length} notes
  </span>
  )}
  </div>
  </div>
  </div>
  
  <Button
  variant="ghost"
  size="sm"
  className="h-7 w-7 p-0 hover:bg-primary/20 shrink-0"
  onClick={(e) => {
  e.stopPropagation()
  setMenuProject(project)
  }}
  >
  <MoreVertical className="h-4 w-4" />
  </Button>
  </div>
  </div>
  
  {/* Expandable Task List */}
  {isExpanded && (
                        <div className="border-t border-border/30 bg-background/30">
                          {projectTasks.length === 0 ? (
                            <div className="px-4 py-3 text-center">
                              <p className="text-xs text-muted-foreground">No tasks in this project</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-xs h-7"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setNewTaskProjectId(project.id)
                                  setIsAddTaskDialogOpen(true)
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Task
                              </Button>
                            </div>
                          ) : (
                            <div className="divide-y divide-border/20">
  {projectTasks.map((task) => (
  <div 
  key={task.id}
  onClick={() => setViewingNotesTask(task)}
  className={cn(
  "px-4 py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-primary/5 transition-colors",
  task.status === "Done" && "opacity-60"
  )}
  >
  <div className="flex items-center gap-2 min-w-0 flex-1">
  <div className={cn(
  "w-2 h-2 rounded-full shrink-0",
  task.status === "Done" && "bg-green-500",
  task.status === "In Progress" && "bg-cyan-500",
  task.status === "To Do" && "bg-muted-foreground/50",
  )} />
  <span className={cn(
  "text-xs truncate",
  task.status === "Done" && "line-through text-muted-foreground"
  )}>
  {task.name}
  </span>
  </div>
  <div className="flex items-center gap-2 shrink-0">
  {notes.filter(n => n.taskId === task.id).length > 0 && (
  <span className="text-xs text-primary flex items-center gap-0.5">
  <StickyNote className="h-2.5 w-2.5" />
  {notes.filter(n => n.taskId === task.id).length}
  </span>
  )}
  <span className="text-xs text-muted-foreground">
  {task.completedPomodoros}
  </span>
  <Badge
  variant="outline"
  className={cn(
  "text-xs px-1 py-0",
  task.status === "Done" && "border-green-500/50 text-green-500",
  task.status === "In Progress" && "border-cyan-500/50 text-cyan-500",
  task.status === "To Do" && "border-muted-foreground/50 text-muted-foreground",
  )}
  >
  {task.status}
  </Badge>
  </div>
  </div>
  ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Project Menu Dialog */}
      <Dialog open={!!menuProject} onOpenChange={() => setMenuProject(null)}>
        <DialogContent className="w-[90vw] max-w-xs p-0 gap-0">
          <div className="py-1">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border/50">
              Project Actions
            </div>

            <div className="px-2 py-1">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">Change Status</div>
              {projectStatusOptions
                .filter((status) => status !== menuProject?.status)
                .map((status) => (
                  <button
                    key={status}
                    onClick={() => handleUpdateProjectStatus(status)}
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-primary/10 transition-colors"
                  >
                    {status}
                  </button>
                ))}
            </div>

            <div className="h-px bg-border/50 mx-2" />

            <div className="px-2 py-1">
              <button
                onClick={() => {
                  setEditingProject(menuProject)
                  setMenuProject(null)
                }}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Project
              </button>

              <button
                onClick={handleDeleteProject}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Project
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project Name</Label>
              <Input
                id="edit-project-name"
                value={editingProject?.name || ""}
                onChange={(e) => setEditingProject(editingProject ? { ...editingProject, name: e.target.value } : null)}
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-project-status">Status</Label>
              <Select
                value={editingProject?.status}
                onValueChange={(status: ProjectStatus) =>
                  setEditingProject(editingProject ? { ...editingProject, status } : null)
                }
              >
                <SelectTrigger id="edit-project-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectStatusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditProject} disabled={!editingProject?.name.trim()} className="w-full">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Menu Dialog */}
      <Dialog open={!!menuTask} onOpenChange={() => setMenuTask(null)}>
        <DialogContent className="w-[90vw] max-w-xs p-0 gap-0">
          <div className="py-1">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border/50">
              Task Actions
            </div>

            <div className="px-2 py-1">
              {menuTask && activeTask?.id !== menuTask.id && (
                <button
                  onClick={handleSetActiveTask}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-cyan-500/10 text-cyan-400 transition-colors flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Set as Active Task
                </button>
              )}
              
              <div className="text-xs font-medium text-muted-foreground px-2 py-1.5 mt-1">Change Status</div>
              {taskStatusOptions
                .filter((status) => status !== menuTask?.status)
                .map((status) => (
                  <button
                    key={status}
                    onClick={() => handleUpdateTaskStatus(status)}
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-primary/10 transition-colors"
                  >
                    {status}
                  </button>
                ))}
            </div>

            <div className="h-px bg-border/50 mx-2" />

            <div className="px-2 py-1">
              <button
                onClick={() => {
                  setEditingTask(menuTask)
                  setMenuTask(null)
                }}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Task
              </button>

              <button
                onClick={handleDeleteTask}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Task
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input
                id="task-name"
                placeholder="Enter task name..."
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="task-project">Project</Label>
              <div className="flex gap-2">
                <Select value={newTaskProjectId} onValueChange={setNewTaskProjectId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsAddProjectDialogOpen(true)}
                  title="Add new project"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button
              onClick={handleAddTask}
              disabled={!newTaskName.trim() || !newTaskProjectId}
              className="w-full"
            >
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Project Dialog (nested) */}
      <Dialog open={isAddProjectDialogOpen} onOpenChange={setIsAddProjectDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-project-name">Project Name</Label>
              <Input
                id="new-project-name"
                placeholder="Enter project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddProject()
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddProject} disabled={!newProjectName.trim()} className="w-full">
              Add Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-task-name">Task Name</Label>
              <Input
                id="edit-task-name"
                value={editingTask?.name || ""}
                onChange={(e) => setEditingTask(editingTask ? { ...editingTask, name: e.target.value } : null)}
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-task-project">Project</Label>
              <Select
                value={editingTask?.projectId}
                onValueChange={(projectId) =>
                  setEditingTask(editingTask ? { ...editingTask, projectId } : null)
                }
              >
                <SelectTrigger id="edit-task-project">
                  <SelectValue />
                </SelectTrigger>
  <SelectContent>
  {projectsByActivity.map((project) => (
  <SelectItem key={project.id} value={project.id}>
  {project.name}
  </SelectItem>
  ))}
  </SelectContent>
  </Select>
  </div>
  
  <div className="space-y-2">
  <Label htmlFor="edit-task-status">Status</Label>
  <Select
                value={editingTask?.status}
                onValueChange={(status: TaskStatus) =>
                  setEditingTask(editingTask ? { ...editingTask, status } : null)
                }
              >
                <SelectTrigger id="edit-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskStatusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
          <DialogFooter>
            <Button onClick={handleEditTask} disabled={!editingTask?.name.trim()} className="w-full">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
  </Dialog>
  
  {/* Notes Viewer Dialog */}
  <Dialog open={viewingNotesTask !== null} onOpenChange={(open) => !open && setViewingNotesTask(null)}>
    <DialogContent className="w-[95vw] max-w-md border-primary/30 bg-background/95 backdrop-blur-sm max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-primary" />
          Task Notes
        </DialogTitle>
        <DialogDescription className="truncate">
          {viewingNotesTask?.name}
        </DialogDescription>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-[200px]">
        {viewingNotesTask && getTaskNotes(viewingNotesTask.id).length > 0 ? (
          getTaskNotes(viewingNotesTask.id).map((note) => (
            <div key={note.id} className="bg-muted/30 border border-border/50 rounded-lg p-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(note.createdAt).toLocaleDateString("en-US", { 
                  month: "short", 
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <StickyNote className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No notes yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add notes from the Timer screen while working on this task
            </p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setViewingNotesTask(null)}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  
  {/* Project Daily Review Dialog */}
  <Dialog open={isProjectDailyReviewOpen} onOpenChange={setIsProjectDailyReviewOpen}>
    <DialogContent className="w-[95vw] max-w-md border-purple-500/30 bg-background/95 backdrop-blur-sm p-0 overflow-hidden">
      {currentReviewProject ? (
        <>
          {/* Progress Header */}
          <div className="px-5 pt-5 pb-3 border-b border-border/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sunrise className="h-5 w-5 text-purple-400" />
                <span className="font-semibold text-foreground">Project Review</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {projectDailyReviewIndex + 1} of {incompleteProjects.length}
              </span>
            </div>
            <div className="h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-primary rounded-full transition-all duration-300"
                style={{ width: `${((projectDailyReviewIndex + 1) / incompleteProjects.length) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Project Card */}
          <div className="p-3">
            <div className="mb-4">
              {/* Project Name */}
              <h3 className="text-xl font-bold text-foreground mb-2">{currentReviewProject.name}</h3>
              
              {/* Project Meta */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckSquare className="h-4 w-4" />
                  {getProjectActiveTaskCount(currentReviewProject.id)}/{getProjectTaskCount(currentReviewProject.id)} tasks
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="h-4 w-4" />
                  {getProjectCompletedPomodoros(currentReviewProject.id)} pomodoros
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    currentReviewProject.status === "Ongoing" && "border-cyan-500/50 text-cyan-500",
                    currentReviewProject.status === "On Hold" && "border-yellow-500/50 text-yellow-500",
                  )}
                >
                  {currentReviewProject.status}
                </Badge>
              </div>
            </div>
            
            {/* Status Question */}
            <p className="text-sm text-muted-foreground mb-4">What&apos;s the status of this project?</p>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleProjectDailyReviewAction("Ongoing")}
                className="h-14 flex flex-col items-center gap-1 border-cyan-500/30 hover:bg-cyan-500/10"
              >
                <Play className="h-5 w-5 text-cyan-400" />
                <span className="text-xs">Ongoing</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleProjectDailyReviewAction("On Hold")}
                className="h-14 flex flex-col items-center gap-1 border-yellow-500/30 hover:bg-yellow-500/10"
              >
                <Pause className="h-5 w-5 text-yellow-400" />
                <span className="text-xs">On Hold</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleProjectDailyReviewAction("Done")}
                className="h-14 flex flex-col items-center gap-1 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-xs">Done</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleProjectDailyReviewAction("Skip")}
                className="h-14 flex flex-col items-center gap-1 border-muted-foreground/30 hover:bg-muted-foreground/10"
              >
                <SkipForward className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs">Skip</span>
              </Button>
            </div>
            
            {/* Info about task sync */}
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Marking Done will complete all tasks. On Hold will pause active tasks.
            </p>
          </div>
        </>
      ) : (
        /* Completion Screen */
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-purple-400" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Project Review Complete</h3>
          <p className="text-sm text-muted-foreground mb-6">
            You&apos;ve reviewed all {incompleteProjects.length} projects. Have a productive day!
          </p>
          <Button onClick={() => setIsProjectDailyReviewOpen(false)} className="w-full">
            Close
          </Button>
        </div>
      )}
    </DialogContent>
  </Dialog>
  </div>
  )
  }

// ==================== MOBILE BREAKS PANEL ====================
