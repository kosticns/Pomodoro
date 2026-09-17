"use client"

import React, { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  snapProgressToStep,
  stepPercentOfWorkday,
  elapsedAtProgress,
} from "@/lib/workday-duration"

/**
 * Sets how much of the workday has elapsed.
 *
 * Moves in 30-minute steps rather than continuously. Dragging used to land
 * anywhere, so correcting the timer by hand produced values like 3h 28m, which
 * is not a number you can reason about. Half hours are what the rest of the
 * workday moves in.
 *
 * The step is a share of the day, so it depends on how long the day is: half
 * an hour is 6.25% of eight hours and 5.88% of eight and a half. That is why
 * the duration has to come in as a prop.
 */
export const WorkdayTimelineSlider = ({
  progress,
  onChange,
  durationHours,
}: {
  progress: number
  onChange: (percent: number) => void
  durationHours: number
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const updateFromClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const percent = ((clientX - rect.left) / rect.width) * 100
    onChange(snapProgressToStep(percent, durationHours))
  }

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      updateFromClientX(clientX)
    }
    const handleUp = () => setIsDragging(false)
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    window.addEventListener("touchmove", handleMove)
    window.addEventListener("touchend", handleUp)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
      window.removeEventListener("touchmove", handleMove)
      window.removeEventListener("touchend", handleUp)
    }
  }, [isDragging, durationHours])

  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <div
      ref={trackRef}
      className="relative w-full h-6 flex items-center cursor-pointer select-none touch-none"
      onMouseDown={(e) => {
        setIsDragging(true)
        updateFromClientX(e.clientX)
      }}
      onTouchStart={(e) => {
        setIsDragging(true)
        updateFromClientX(e.touches[0].clientX)
      }}
      role="slider"
      aria-label="Workday timeline"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedProgress)}
      aria-valuetext={`${elapsedAtProgress(clampedProgress, durationHours)} elapsed`}
      tabIndex={0}
      onKeyDown={(e) => {
        // One press moves one half hour, matching the drag.
        const step = stepPercentOfWorkday(durationHours)
        if (e.key === "ArrowLeft") onChange(snapProgressToStep(clampedProgress - step, durationHours))
        if (e.key === "ArrowRight") onChange(snapProgressToStep(clampedProgress + step, durationHours))
      }}
    >
      <div className="w-full bg-secondary/30 rounded-full h-2">
        <div
          className={cn("bg-blue-500 h-2 rounded-full", !isDragging && "transition-all duration-300")}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-background shadow-md",
          isDragging && "scale-125 ring-2 ring-blue-500/40",
          !isDragging && "transition-all duration-300",
        )}
        style={{ left: `${clampedProgress}%` }}
      />
    </div>
  )
}
