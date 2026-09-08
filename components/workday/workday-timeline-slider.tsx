"use client"

import React, { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export const WorkdayTimelineSlider = ({
  progress,
  onChange,
}: {
  progress: number
  onChange: (percent: number) => void
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const updateFromClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const percent = ((clientX - rect.left) / rect.width) * 100
    onChange(Math.min(100, Math.max(0, percent)))
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
  }, [isDragging])

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
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange(Math.max(0, clampedProgress - 2))
        if (e.key === "ArrowRight") onChange(Math.min(100, clampedProgress + 2))
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
