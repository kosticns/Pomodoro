"use client"

import dynamic from "next/dynamic"

/**
 * Loads the app with server rendering off. See app/page.tsx for why.
 *
 * The fallback is deliberately plain: a background fill rather than a skeleton
 * of the timer. A skeleton that guessed at values would reintroduce the very
 * thing this fixes, showing numbers that are not yours.
 */
const PomodoroAppRoot = dynamic(() => import("@/components/pomodoro-app"), {
  ssr: false,
  loading: () => <div className="h-dvh bg-background" />,
})

export function PomodoroAppClient() {
  return <PomodoroAppRoot />
}
