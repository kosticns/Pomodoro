"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"

export const CustomPieChart = ({
  data,
  height = 256,
  compact = false,
  hideLegend = false,
  centerTotal,
}: {
  data: {
    labels: string[]
    datasets: Array<{
      data: number[]
      backgroundColor: string[]
      borderColor?: string[]
    }>
  }
  height?: number
  compact?: boolean
  hideLegend?: boolean
  centerTotal?: number
}) => {
  const dataset = data.datasets[0]
  const dataSum = dataset.data.reduce((sum, val) => sum + val, 0)
  const displayTotal = centerTotal ?? dataSum
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Check if this is a "no activity" placeholder
  const isNoActivity = data.labels.length === 1 && data.labels[0] === "No activity"

  if (dataSum === 0 || isNoActivity) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-8" style={{ minHeight: compact ? "180px" : `${height}px` }}>
        <div className="relative w-24 h-24 mb-3">
          <svg viewBox="-100 -100 200 200" className="w-full h-full">
            <circle cx="0" cy="0" r="80" fill="none" stroke="rgba(100, 100, 100, 0.2)" strokeWidth="30" />
            <text x="0" y="5" textAnchor="middle" className="fill-muted-foreground text-lg">0</text>
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">No activity yet</p>
      </div>
    )
  }

  const outerRadius = 80
  const innerRadius = 50

  // Calculate segments - use data values for proportional sizing
  const segments = dataset.data.map((value, i) => {
    const percentage = value / dataSum
    return { value, percentage, angle: percentage * 360, index: i }
  })

  // Build cumulative angles
  let cumulativeAngle = -90
  const segmentsWithAngles = segments.map((seg) => {
    const startAngle = cumulativeAngle
    const endAngle = cumulativeAngle + seg.angle
    cumulativeAngle = endAngle
    return { ...seg, startAngle, endAngle }
  })

  const svgSize = compact ? 140 : 160

  return (
    <div className="w-full flex flex-col items-center overflow-hidden" style={{ minHeight: compact ? "auto" : `${height}px` }}>
      {/* Donut Chart */}
      <div className="flex-shrink-0" style={{ width: svgSize, height: svgSize }}>
        <svg width="100%" height="100%" viewBox="-100 -100 200 200">
          {segmentsWithAngles.map((seg) => {
            // Handle single segment (360 degrees) - SVG arcs can't draw a full circle
            if (seg.angle >= 359.99) {
              return (
                <g key={seg.index}>
                  <circle
                    cx="0"
                    cy="0"
                    r={(outerRadius + innerRadius) / 2}
                    fill="none"
                    stroke={dataset.backgroundColor[seg.index]}
                    strokeWidth={outerRadius - innerRadius}
                    opacity={0.9}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredIndex(seg.index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                </g>
              )
            }

            const startRad = (seg.startAngle * Math.PI) / 180
            const endRad = (seg.endAngle * Math.PI) / 180

            const x1Outer = outerRadius * Math.cos(startRad)
            const y1Outer = outerRadius * Math.sin(startRad)
            const x2Outer = outerRadius * Math.cos(endRad)
            const y2Outer = outerRadius * Math.sin(endRad)

            const x1Inner = innerRadius * Math.cos(startRad)
            const y1Inner = innerRadius * Math.sin(startRad)
            const x2Inner = innerRadius * Math.cos(endRad)
            const y2Inner = innerRadius * Math.sin(endRad)

            const largeArc = seg.angle > 180 ? 1 : 0

            const pathData = [
              `M ${x1Outer} ${y1Outer}`,
              `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
              `L ${x2Inner} ${y2Inner}`,
              `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1Inner} ${y1Inner}`,
              `Z`,
            ].join(" ")

            const isHovered = hoveredIndex === seg.index

            return (
              <g key={seg.index}>
                <path
                  d={pathData}
                  fill={dataset.backgroundColor[seg.index]}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={isHovered ? "2" : "0.5"}
                  opacity={hoveredIndex === null ? 0.9 : isHovered ? 1 : 0.5}
                  style={{ cursor: "pointer", transition: "all 0.2s ease-out" }}
                  onMouseEnter={() => setHoveredIndex(seg.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            )
          })}

          {/* Center text - shows the actual period total, not the data sum */}
          <text x="0" y="-5" textAnchor="middle" className="fill-foreground text-xl font-bold">
            {displayTotal}
          </text>
          <text x="0" y="12" textAnchor="middle" className="fill-muted-foreground text-[10px]">
            pomodoros
          </text>
        </svg>
      </div>

      {/* Tooltip on hover */}
      {hoveredIndex !== null && (
        <div className="bg-background/95 border border-border rounded-md px-3 py-1.5 shadow-lg text-sm mt-2 animate-in fade-in duration-150">
          <span className="font-medium">{data.labels[hoveredIndex]}</span>
          <span className="text-muted-foreground ml-2">
            {((segments[hoveredIndex].percentage) * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Compact Legend */}
      {!hideLegend && (
        <div className={cn(
          "flex flex-wrap gap-x-3 gap-y-1.5 mt-3 w-full justify-center",
          compact ? "max-h-[60px] overflow-y-auto" : "max-h-[80px] overflow-y-auto"
        )}>
          {data.labels.map((label, i) => {
            const isHovered = hoveredIndex === i
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded transition-all cursor-pointer",
                  isHovered && "bg-foreground/10 scale-105"
                )}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: dataset.backgroundColor[i] }}
                />
                <span className="text-muted-foreground truncate max-w-[80px]">{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Break Activities - 100 things to do during a 5-minute break
