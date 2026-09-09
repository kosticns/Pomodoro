import { PomodoroAppClient } from "@/components/pomodoro-app-client"

/**
 * The page is a shell; the app renders client-side only.
 *
 * Why: every screen is driven by localStorage, which the server cannot see.
 * useLocalStorage returned defaults during the server render and the stored
 * value on the client's first render, so hydration mismatched on any device
 * with data. React responded by discarding the server tree and re-rendering,
 * which is what made a cold load briefly show 25:00 and "No task selected"
 * and ignore taps. That was React error #418.
 *
 * Server rendering buys nothing here, because the server has no access to the
 * data that determines what to draw. Skipping it removes the mismatch at the
 * cause rather than papering over it with suppressHydrationWarning.
 */
export default function Page() {
  return <PomodoroAppClient />
}
