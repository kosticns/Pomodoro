"use client"

import { useAppState } from "@/lib/app-state"
import React, { useState, useEffect } from "react"
import {
  Plus,
  ChevronDown,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/app-utils"
import type { Project, Task } from "@/lib/types"
import { MobileTasksManager } from "@/components/tasks/mobile-tasks-manager"

export const MobileTaskSelector = () => {
  const { tasks, setTasks, projects, setProjects, activeTask, setActiveTask } = useAppState()
  const [isOpen, setIsOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newTaskName, setNewTaskName] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [searchQuery, setSearchQuery] = useState("") // Added search query state for real-time task filtering

  useEffect(() => {
    if (isCreateDialogOpen && !selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id)
    }
  }, [isCreateDialogOpen, selectedProjectId, projects])

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.name || ""
  }

  const filteredTasks = tasks
    .filter((t) => t.status !== "Done")
    .filter((task) => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      const taskName = task.name.toLowerCase()
      const projectName = getProjectName(task.projectId).toLowerCase()
      return taskName.includes(query) || projectName.includes(query)
    })
    .sort((a, b) => (b.lastInteractionTime || 0) - (a.lastInteractionTime || 0))

  const handleSetActiveTask = (task: Task) => {
    const updatedTask = { ...task, lastInteractionTime: Date.now() }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)))
    setActiveTask(updatedTask)
    setIsOpen(false)
  }

  const handleCreateTask = () => {
    if (newTaskName.trim() && selectedProjectId) {
      const newTask: Task = {
        id: Date.now().toString(),
  name: newTaskName.trim(),
  projectId: selectedProjectId,
  completedPomodoros: 0,
  status: "In Progress",
  lastInteractionTime: Date.now(),
  }
      const updatedTasks = [...tasks, newTask]
      setTasks(updatedTasks)
      setActiveTask(newTask)
      setNewTaskName("")
      setIsCreateDialogOpen(false)
    }
  }

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      // Must match the shape built in MobileTasksManager.handleAddProject.
      // This previously created { id, name } only, so a project made from the
      // timer had no status, createdAt or lastInteractionTime, and sorted and
      // filtered as undefined everywhere else in the app.
      const newProject: Project = {
        id: `project-${Date.now()}`,
        name: newProjectName.trim(),
        status: "Ongoing",
        createdAt: Date.now(),
        lastInteractionTime: Date.now(),
      }
      const updatedProjects = [...projects, newProject]
      setProjects(updatedProjects)
      setSelectedProjectId(newProject.id)
      setIsCreatingProject(false)
      setNewProjectName("")
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-left p-4 h-auto">
            <div className="flex flex-col items-start">
              <span className="text-xs text-muted-foreground">Current Task</span>
              <span className="text-sm font-medium">{activeTask ? activeTask.name : "No task selected"}</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Select Task</SheetTitle>
          </SheetHeader>

          <div className="mt-4 px-6 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks or projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          </div>

          {/* Fixed Create New Task button */}
          <div className="mt-3 px-6 flex-shrink-0">
            <Button
              variant="ghost"
              className="w-full justify-start h-auto p-4 border-2 border-dashed"
              onClick={() => {
                setIsCreateDialogOpen(true)
                setIsOpen(false)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Task
            </Button>
          </div>

          {/* Scrollable task list */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{searchQuery ? "No tasks found" : "No active tasks"}</p>
                  {searchQuery && <p className="text-xs mt-2">Try a different search term</p>}
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.projectId)
                  return (
                    <Card
                      key={task.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-green-500/50",
                        activeTask?.id === task.id && "border-green-500 bg-green-500/5",
                      )}
                      onClick={() => handleSetActiveTask(task)}
                    >
                      <CardContent className="px-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{task.name}</span>
                              {activeTask?.id === task.id && (
                                <Badge variant="secondary" className="text-xs">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{project?.name || "No Project"}</span>
                              <span>•</span>
                              <span className="text-xs text-muted-foreground">{task.completedPomodoros} 🍅</span>
                              {task.lastInteractionTime && (
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(task.lastInteractionTime)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input
                id="task-name"
                placeholder="Enter task name"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              {isCreatingProject ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newProjectName.trim()) {
                        handleCreateProject()
                      } else if (e.key === "Escape") {
                        setIsCreatingProject(false)
                        setNewProjectName("")
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim()}
                      className="flex-1"
                    >
                      Save Project
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsCreatingProject(false)
                        setNewProjectName("")
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="link" className="p-0 h-auto text-sm" onClick={() => setIsCreatingProject(true)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Create New Project
                  </Button>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateTask} disabled={isCreatingProject} className="w-full">
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
