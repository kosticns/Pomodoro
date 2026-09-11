"use client"

import React from "react"

export const CustomBarChart = ({
  data,
  height = 256,
}: {
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor: string
      borderColor?: string
      borderRadius?: number // Added borderRadius for rounded bars
    }>
  }
  height?: number
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [hoveredBar, setHoveredBar] = React.useState<{
    label: string
    value: number
    x: number
    y: number
  } | null>(null)

  const maxValue = Math.max(...data.datasets.flatMap((dataset) => dataset.data), 1)
  const barWidth = 100 / (data.labels.length * data.datasets.length + data.labels.length + 1)
  const groupWidth = barWidth * data.datasets.length
  const gapWidth = barWidth

  return (
    // `height` sizes the PLOT AREA, not the whole component.
    //
    // It used to be the outer div's height while the svg took 100% of it and
    // the labels and legend rendered after, so both spilled 48px outside the
    // box and painted over whatever came next. In Stats that was the following
    // card's title. Nothing clipped it because the card does not hide overflow,
    // so it read as three separate overlap bugs rather than one.
    <div ref={containerRef} className="w-full relative">
      <div className="w-full" style={{ height: `${height}px` }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            y1={100 - y} // Invert y-axis for SVG
            x2="100"
            y2={100 - y} // Invert y-axis for SVG
            stroke="rgba(75, 85, 99, 0.3)"
            strokeWidth="0.2"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Bars */}
        {data.labels.map((label, labelIndex) => {
          return data.datasets.map((dataset, datasetIndex) => {
            const value = dataset.data[labelIndex]
            const barHeight = (value / maxValue) * 100
            const x = gapWidth + labelIndex * (groupWidth + gapWidth) + datasetIndex * barWidth
            const y = 100 - barHeight

            return (
              <g
                key={`${labelIndex}-${datasetIndex}`}
                onMouseEnter={(e) => {
                  if (!containerRef.current) return
                  const containerRect = containerRef.current.getBoundingClientRect()
                  const barRect = e.currentTarget.getBoundingClientRect()
                  // Calculate position relative to the container
                  const relativeX = barRect.left - containerRect.left + barRect.width / 2
                  const relativeY = barRect.top - containerRect.top
                  setHoveredBar({
                    label,
                    value,
                    x: relativeX,
                    y: relativeY,
                  })
                }}
                onMouseLeave={() => setHoveredBar(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={dataset.backgroundColor}
                  rx={dataset.borderRadius || 0.5} // Use borderRadius from dataset or default
                  opacity={hoveredBar?.label === label ? 0.8 : 1}
                />
                <title>{`${label}: ${value} Pomodoro${value !== 1 ? "s" : ""}`}</title>
              </g>
            )
          })
        })}
        </svg>
      </div>

      {hoveredBar && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: `${hoveredBar.x}px`,
            top: `${hoveredBar.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-cyan-500 text-black px-3 py-1.5 rounded-md shadow-lg text-sm font-semibold whitespace-nowrap border border-cyan-400 mb-1">
            {hoveredBar.label}: {hoveredBar.value} Pomodoro{hoveredBar.value !== 1 ? "s" : ""}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-cyan-500" />
        </div>
      )}

      {/* Labels, centred on their bar group using the same maths as the bars.
          justify-around only approximated it, and with eight narrow slices it
          broke "W-7" across two lines and ran "Last" into "This".

          The display font is wide: a three-character label sets at ~37px, so
          eight of them fill a phone-width card edge to edge and read as one
          run. Past six labels the type steps down a size to buy the gaps back. */}
      <div
        className={`relative mt-2 h-4 text-muted-foreground ${
          data.labels.length > 6 ? "text-[10px]" : "text-xs"
        }`}
      >
        {data.labels.map((label, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${gapWidth + i * (groupWidth + gapWidth) + groupWidth / 2}%` }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2 text-xs">
        {data.datasets.map((dataset, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: dataset.backgroundColor }} />
            <span className="text-muted-foreground">{dataset.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

