"use client"

import { useAppState } from "@/lib/app-state"
import { standingCadenceOf } from "@/lib/posture"
import { buildBackupJSON, buildBackupCSV, backupFilename } from "@/lib/backup"
import React, { useState, useRef } from "react"
import {
  Timer,
  Trash2,
  Play,
  Bell,
  Check,
  FileText,
  Download,
  FileJson,
  FileSpreadsheet,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { getLocalDateStr, playSound } from "@/lib/app-utils"
import { useWorkdayTimer } from "@/hooks/use-workday-timer"
import type { Project, Note, Task, Settings, DailyStat } from "@/lib/types"
import { WorkdayTimelineSlider } from "@/components/workday/workday-timeline-slider"

export const MobileSettingsPanel = ({
  notificationPermission,
  requestNotificationPermission,
  workdayTimer,
}: {
  notificationPermission: NotificationPermission
  requestNotificationPermission: () => void
  workdayTimer: ReturnType<typeof useWorkdayTimer>
}) => {
  const { settings, setSettings, projects, setProjects, tasks, setTasks, stats, setStats, notes, setNotes } = useAppState()
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [isExporting, setIsExporting] = useState(false)

  const soundOptions = [
    { value: "focus-end.mp3", label: "Digital Alarm" },
    { value: "break-end.mp3", label: "Mellow" },
    { value: "start.mp3", label: "Tick" },
    { value: "bell.mp3", label: "Bell" },
    { value: "harp.mp3", label: "Harp" },
    { value: "chime.mp3", label: "Chime" },
  ]

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all data? This cannot be undone.")) {
      localStorage.clear()
      window.location.reload()
    }
  }

  // Export building lives in lib/backup.ts. This panel and the Daily Backup
  // modal in app/page.tsx used to carry separate copies that drifted.
  const triggerDownload = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const backupPayload = () => ({ settings, projects, tasks, stats, notes })

  const handleExportJSON = () => {
    triggerDownload(
      buildBackupJSON(backupPayload()),
      "application/json",
      backupFilename("json", getLocalDateStr()),
    )
  }

  // Import JSON Backup
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        
        // Validate the backup structure
        if (!data.projects || !data.tasks || !data.stats) {
          setImportError("Invalid backup file: missing required data")
          return
        }
        
        // Confirm before overwriting
        if (!confirm("This will replace ALL your current data with the backup. Are you sure?")) {
          return
        }
        
  // Restore data
  if (data.settings) setSettings(data.settings)
  setProjects(data.projects)
  setTasks(data.tasks)
  setStats(data.stats)
  if (data.notes) setNotes(data.notes)
        
        setImportError(null)
        setImportSuccess(true)
        setTimeout(() => setImportSuccess(false), 3000)
      } catch {
        setImportError("Failed to parse backup file. Please ensure it's a valid JSON backup.")
      }
    }
    reader.readAsText(file)
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleExportCSV = () => {
    triggerDownload(
      buildBackupCSV(backupPayload()),
      "text/csv",
      backupFilename("csv", getLocalDateStr()),
    )
  }

  // Text Report Export
  const handleExportReport = () => {
    setIsExporting(true)

    // Simulate brief processing for visual feedback
    setTimeout(() => {
      const now = new Date()
      let startDate: Date
      let periodLabel: string

      switch (reportType) {
        case "daily":
          startDate = new Date(now)
          startDate.setHours(0, 0, 0, 0)
          periodLabel = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
          break
        case "weekly":
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 7)
          periodLabel = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          break
        case "monthly":
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 30)
          periodLabel = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          break
      }

      const startDateStr = getLocalDateStr(startDate)

      // Filter stats for the period
      const periodStats = stats.filter((s) => s.date >= startDateStr)

      // Calculate totals
      const totalPomodoros = periodStats.reduce((sum, s) => sum + s.totalPomodoros, 0)
      const totalFocusTime = periodStats.reduce((sum, s) => sum + s.timeSpent, 0)
      const totalShortBreaks = periodStats.reduce((sum, s) => sum + s.shortBreakCount, 0)
      const totalLongBreaks = periodStats.reduce((sum, s) => sum + s.longBreakCount, 0)
      const daysWorked = periodStats.filter((s) => s.totalPomodoros > 0).length

      // Get tasks with completed pomodoros (these are tasks that had work done)
      const activeTasks = tasks.filter((t) => t.completedPomodoros > 0)

      // Get projects worked on - from both stats.projectsWorked AND from tasks with completed pomodoros
      const projectIdsWorked = new Set<string>()
      // Add from stats (for newer data with projectsWorked tracking)
      periodStats.forEach((s) => {
        (s.projectsWorked || []).forEach((pid) => projectIdsWorked.add(pid))
      })
      // Also add from tasks that have completed pomodoros (for historical data)
      activeTasks.forEach((t) => {
        projectIdsWorked.add(t.projectId)
      })
      const projectsWorkedOn = projects.filter((p) => projectIdsWorked.has(p.id))

      // Build the report
      let report = ""
      report += "═".repeat(60) + "\n"
      report += "                    POMODORO PRODUCTIVITY REPORT\n"
      report += "═".repeat(60) + "\n\n"
      report += `Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}\n`
      report += `Period: ${periodLabel}\n`
      report += `Generated: ${now.toLocaleString()}\n\n`

      report += "─".repeat(60) + "\n"
      report += "                         SUMMARY\n"
      report += "─".repeat(60) + "\n\n"
      report += `  Total Pomodoros Completed:  ${totalPomodoros}\n`
      report += `  Total Focus Time:           ${Math.floor(totalFocusTime / 60)}h ${totalFocusTime % 60}m\n`
      report += `  Days with Activity:         ${daysWorked}\n`
      report += `  Short Breaks Taken:         ${totalShortBreaks}\n`
      report += `  Long Breaks Taken:          ${totalLongBreaks}\n`
      report += `  Projects Worked On:         ${projectsWorkedOn.length}\n`
      report += `  Tasks in Progress:          ${activeTasks.filter((t) => t.status !== "Done").length}\n`
      report += `  Tasks Completed:            ${activeTasks.filter((t) => t.status === "Done").length}\n\n`

      if (daysWorked > 0) {
        report += `  Average Pomodoros/Day:      ${(totalPomodoros / daysWorked).toFixed(1)}\n`
        report += `  Average Focus Time/Day:     ${Math.floor(totalFocusTime / daysWorked / 60)}h ${Math.floor((totalFocusTime / daysWorked) % 60)}m\n\n`
      }

      report += "─".repeat(60) + "\n"
      report += "                    PROJECTS OVERVIEW\n"
      report += "─".repeat(60) + "\n\n"

      if (projectsWorkedOn.length === 0) {
        report += "  No projects worked on during this period.\n\n"
      } else {
        projectsWorkedOn.forEach((project) => {
          const projectTasks = tasks.filter((t) => t.projectId === project.id)
          const projectPomodoros = projectTasks.reduce((sum, t) => sum + t.completedPomodoros, 0)
          const completedTasks = projectTasks.filter((t) => t.status === "Done").length

          report += `  [${project.status.toUpperCase()}] ${project.name}\n`
          report += `    - Pomodoros: ${projectPomodoros}\n`
          report += `    - Tasks: ${completedTasks}/${projectTasks.length} completed\n`
          report += `    - Created: ${new Date(project.createdAt).toLocaleDateString()}\n\n`
        })
      }

      report += "─".repeat(60) + "\n"
      report += "                      TASKS DETAIL\n"
      report += "─".repeat(60) + "\n\n"

      if (activeTasks.length === 0) {
        report += "  No tasks found for this period.\n\n"
      } else {
        // Group tasks by project
        const tasksByProject = new Map<string, Task[]>()
        activeTasks.forEach((task) => {
          const existing = tasksByProject.get(task.projectId) || []
          tasksByProject.set(task.projectId, [...existing, task])
        })

        tasksByProject.forEach((projectTasks, projectId) => {
          const project = projects.find((p) => p.id === projectId)
          report += `  >> ${project?.name || "Unknown Project"}\n`
          report += "  " + "-".repeat(40) + "\n"

          projectTasks.forEach((task) => {
            const statusIcon = task.status === "Done" ? "[x]" : task.status === "In Progress" ? "[>]" : "[ ]"
            report += `    ${statusIcon} ${task.name}\n`
            report += `        Status: ${task.status} | Pomodoros: ${task.completedPomodoros}\n`
          })
          report += "\n"
        })
      }

      report += "─".repeat(60) + "\n"
      report += "                    DAILY BREAKDOWN\n"
      report += "─".repeat(60) + "\n\n"

      const sortedStats = [...periodStats].sort((a, b) => b.date.localeCompare(a.date))

      if (sortedStats.length === 0) {
        report += "  No activity recorded during this period.\n\n"
      } else {
        sortedStats.forEach((dayStat) => {
          if (dayStat.totalPomodoros > 0 || dayStat.workdayStarted) {
            const date = new Date(dayStat.date)
            const dateStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
            report += `  ${dateStr}\n`
            report += `    Pomodoros: ${dayStat.totalPomodoros} | Focus: ${Math.floor(dayStat.timeSpent / 60)}h ${dayStat.timeSpent % 60}m\n`
            if (dayStat.shortBreakCount > 0 || dayStat.longBreakCount > 0) {
              report += `    Breaks: ${dayStat.shortBreakCount} short, ${dayStat.longBreakCount} long\n`
            }
            if (dayStat.workdayStarted) {
              report += `    Workday: ${dayStat.workdayCompleted ? "Completed" : "Started"}\n`
            }
            report += "\n"
          }
        })
      }

      report += "═".repeat(60) + "\n"
      report += "              End of Report - Stay Focused!\n"
      report += "═".repeat(60) + "\n"

      // Download the file
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pomodoro-${reportType}-report-${now.toISOString().split("T")[0]}.txt`
      a.click()
      URL.revokeObjectURL(url)

      setIsExporting(false)
    }, 500)
  }

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold text-glow-secondary">Settings</h1>

      {/* Timer Durations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timer Durations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Focus Duration (min)</Label>
            <Input
              type="number"
              value={settings.focusDuration}
              onChange={(e) => setSettings({ ...settings, focusDuration: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Short Break (min)</Label>
            <Input
              type="number"
              value={settings.shortBreakDuration}
              onChange={(e) => setSettings({ ...settings, shortBreakDuration: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Long Break (min)</Label>
            <Input
              type="number"
              value={settings.longBreakDuration}
              onChange={(e) => setSettings({ ...settings, longBreakDuration: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cycles before long break</Label>
            <Input
              type="number"
              value={settings.cyclesBeforeLongBreak}
              onChange={(e) => setSettings({ ...settings, cyclesBeforeLongBreak: Number(e.target.value) })}
            />
          </div>
  <div className="space-y-1">
  <Label className="text-xs">Workday (hours)</Label>
  <Input
  type="number"
  min="1"
  max="12"
  value={settings.workdayDuration}
  onChange={(e) => setSettings({ ...settings, workdayDuration: Number(e.target.value) })}
  />
  </div>
  <div className="space-y-1">
  <Label className="text-xs">Daily pomodoro goal</Label>
  <Input
  type="number"
  min="1"
  max="20"
  value={settings.dailyPomodoroGoal || 10}
  onChange={(e) => setSettings({ ...settings, dailyPomodoroGoal: Number(e.target.value) })}
  />
  </div>
  {/* Spans the grid: squeezed into one column it wrapped to three lines. */}
  <p className="col-span-2 text-xs text-muted-foreground -mt-1">8-10 is a good day, 12-14 very productive, 16 or more is a maximum</p>
  </CardContent>
  </Card>
  
  {/* Standing Desk Reminder */}
  <Card>
  <CardHeader>
  <CardTitle className="text-sm">Standing Desk</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
  <div className="flex items-center justify-between">
  <div>
  <Label>Standing Reminders</Label>
  <p className="text-xs text-muted-foreground">Get notified to switch between sitting and standing</p>
  </div>
  <Switch
  checked={settings.standingReminderEnabled ?? true}
  onCheckedChange={(checked) => setSettings({ ...settings, standingReminderEnabled: checked })}
  />
  </div>
  {settings.standingReminderEnabled !== false && (
  <div className="space-y-1">
  <Label>Switch Cadence (minutes)</Label>
  <Input
  type="number"
  min="15"
  max="120"
  value={standingCadenceOf(settings)}
  onChange={(e) => setSettings({ ...settings, standingCadence: Number(e.target.value) })}
  />
  <p className="text-[10px] text-muted-foreground">How long to hold one posture before switching. Default is 90 minutes.</p>
  </div>
  )}
  </CardContent>
  </Card>
  
  {/* Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Behavior</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-start next session</Label>
              <p className="text-sm text-muted-foreground">
                Automatically start the next session when current one ends
              </p>
            </div>
            <Switch
              checked={settings.autoStartNextSession}
              onCheckedChange={(checked) => setSettings({ ...settings, autoStartNextSession: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Workday Timer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Workday Timer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workdayTimer.isWorkdayActive ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Workday</span>
                <span className="text-sm text-muted-foreground">
                  {workdayTimer.formatWorkdayTime(workdayTimer.remainingTime)} remaining
                </span>
              </div>
              <WorkdayTimelineSlider
                progress={workdayTimer.workdayProgress}
                onChange={workdayTimer.setWorkdayProgress}
              />
              <p className="text-xs text-muted-foreground">
                Drag the handle to adjust how much of your workday has elapsed.
              </p>
              <Button
                onClick={workdayTimer.resetWorkdayTimer}
                variant="outline"
                size="sm"
                className="w-full bg-transparent"
              >
                Reset Workday Timer
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Workday timer will start automatically when you begin your first focus session of the day.
              </p>
              <p className="text-xs text-muted-foreground">Duration: {settings.workdayDuration} hours</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sounds & Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sounds & Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Sound Enabled</Label>
              <p className="text-sm text-muted-foreground">Play sounds when sessions end</p>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, soundEnabled: checked })}
            />
          </div>

          <div className="space-y-1">
            <Label>Volume ({Math.round(settings.soundVolume * 100)}%)</Label>
            <Input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.soundVolume}
              onChange={(e) => setSettings({ ...settings, soundVolume: Number(e.target.value) })}
              aria-label="Volume"
              aria-valuetext={`${Math.round(settings.soundVolume * 100)} percent`}
            />
          </div>

          <div className="space-y-1">
            <Label>Focus End Sound</Label>
            <div className="flex gap-2">
              <Select
                value={settings.focusEndSound}
                onValueChange={(value) => setSettings((s) => ({ ...s, focusEndSound: value }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {soundOptions.map((sound) => (
                    <SelectItem key={sound.value} value={sound.value}>
                      {sound.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => playSound(settings.focusEndSound, settings)}>
                <Play className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Break End Sound</Label>
            <div className="flex gap-2">
              <Select
                value={settings.breakEndSound}
                onValueChange={(value) => setSettings((s) => ({ ...s, breakEndSound: value }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {soundOptions.map((sound) => (
                    <SelectItem key={sound.value} value={sound.value}>
                      {sound.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => playSound(settings.breakEndSound, settings)}>
                <Play className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Start Sound</Label>
            <div className="flex gap-2">
              <Select
                value={settings.startSound}
                onValueChange={(value) => setSettings((s) => ({ ...s, startSound: value }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {soundOptions.map((sound) => (
                    <SelectItem key={sound.value} value={sound.value}>
                      {sound.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => playSound(settings.startSound, settings)}>
                <Play className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <Label>Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">Show notifications when sessions end</p>
            </div>
            {notificationPermission === "default" && (
              <Button onClick={requestNotificationPermission} variant="outline" size="sm">
                <Bell className="mr-2 h-4 w-4" />
                Enable
              </Button>
            )}
            {notificationPermission === "granted" && (
              <span className="text-sm text-green-600 font-medium">Enabled</span>
            )}
            {/* red-400, not red-600: on this near-black background red-600
                measures 3.93:1, under the 4.5:1 minimum for body text. */}
            {notificationPermission === "denied" && <span className="text-sm text-red-400 font-medium">Disabled</span>}
          </div>
        </CardContent>
      </Card>

      {/* Export Reports */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Export Report</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Generate a detailed productivity report</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Report Type Selection */}
          <div className="space-y-1">
            <Label className="text-sm">Report Period</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["daily", "weekly", "monthly"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md border transition-all",
                    reportType === type
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-background/50 border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Report Preview Info */}
          <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
            <div className="text-xs text-muted-foreground mb-2">Report will include:</div>
            <ul className="text-xs text-foreground/80 space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" /> Summary statistics
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" /> Projects overview
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" /> Task details by project
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" /> Daily breakdown
              </li>
            </ul>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExportReport}
            disabled={isExporting}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isExporting ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Full Backup */}
      <Card className="border-cyan-500/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-cyan-400" />
            <CardTitle className="text-sm">Full Backup</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Download or restore all your data</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Export buttons */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Export</p>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleExportJSON} 
                variant="outline" 
                className="flex flex-col items-center gap-2 h-auto py-4 border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-400 bg-transparent"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <FileJson className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="text-center">
                  <div className="font-medium text-foreground">JSON</div>
                  <div className="text-[10px] text-muted-foreground">Full backup</div>
                </div>
              </Button>
              
              <Button 
                onClick={handleExportCSV} 
                variant="outline" 
                className="flex flex-col items-center gap-2 h-auto py-4 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-400 bg-transparent"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="text-center">
                  <div className="font-medium text-foreground">CSV</div>
                  <div className="text-[10px] text-muted-foreground">Spreadsheet</div>
                </div>
              </Button>
            </div>
          </div>
          
          {/* Import section */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Import</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".json" 
              onChange={handleImportJSON} 
              className="hidden" 
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline" 
              className="w-full border-primary/30 hover:bg-primary/10 hover:border-primary bg-transparent"
            >
              <Upload className="h-4 w-4 mr-2" />
              Restore from JSON Backup
            </Button>
            {importError && (
              <p className="text-xs text-destructive mt-2 text-center">{importError}</p>
            )}
            {importSuccess && (
              <p className="text-xs text-emerald-500 mt-2 text-center">Backup restored successfully!</p>
            )}
          </div>
          
          <p className="text-[10px] text-center text-muted-foreground">
            Backup is also prompted daily when your workday starts
          </p>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleReset} variant="destructive" className="w-full">
            <Trash2 className="h-4 w-4 mr-2" />
            Reset All Data
          </Button>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            This will permanently delete all your data
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
