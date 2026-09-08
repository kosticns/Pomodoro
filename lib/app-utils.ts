// Date formatting and the WebAudio chime used for session transitions.

import type { Settings } from "./types"

export const getLocalDateStr = (d: Date = new Date()) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const formatRelativeTime = (timestamp: number | undefined): string => {
  if (!timestamp || timestamp <= 0 || isNaN(timestamp)) return "Unknown"

  const now = Date.now()
  if (timestamp > now) return "Just now"

  const diff = now - timestamp
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`
  }
  const months = Math.floor(days / 30)
  return months === 1 ? "1 month ago" : `${months} months ago`
}

// Simple HTML5 Audio-based sound system
export const generateTone = (frequency: number, duration: number, volume = 0.5) => {
  const sampleRate = 44100
  const samples = Math.floor(sampleRate * duration)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + samples * 2, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, "data")
  view.setUint32(40, samples * 2, true)

  // Generate sine wave
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * volume * 32767
    view.setInt16(44 + i * 2, sample, true)
  }

  const blob = new Blob([buffer], { type: "audio/wav" })
  return URL.createObjectURL(blob)
}

export const playSound = async (soundFile: string, settings: Settings) => {
  if (!settings.soundEnabled) {
    console.log("Sound disabled")
    return
  }

  try {
    const volume = Math.max(0, Math.min(1, settings.soundVolume))
    let audioUrl: string

    console.log(`Attempting to play sound: ${soundFile} at volume ${volume}`)

    switch (soundFile) {
      case "bell.mp3":
        audioUrl = generateTone(440, 0.8, volume)
        break
      case "chime.mp3":
        audioUrl = generateTone(523, 0.6, volume)
        break
      case "harp.mp3":
        audioUrl = generateTone(330, 0.8, volume)
        break
      case "focus-end.mp3":
        audioUrl = generateTone(800, 0.5, volume)
        break
      case "break-end.mp3":
        audioUrl = generateTone(659, 0.6, volume)
        break
      case "start.mp3":
        audioUrl = generateTone(1000, 0.2, volume)
        break
      default:
        audioUrl = generateTone(800, 0.5, volume)
    }

    const audio = new Audio(audioUrl)
    audio.volume = volume

    // Add event listeners for debugging
    audio.addEventListener("canplaythrough", () => {
      console.log("Audio can play through")
    })

    audio.addEventListener("error", (e) => {
      console.error("Audio error:", e)
    })

    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(audioUrl)
      console.log("Audio playback ended")
    })

    await audio.play()
    console.log("Audio play() called successfully")
  } catch (error) {
    console.error(`Error playing sound ${soundFile}:`, error)

    // Fallback: try to use the system beep
    try {
      console.log("Attempting system beep fallback")
      const context = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = context.createOscillator()
      const gainNode = context.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(context.destination)

      oscillator.frequency.value = 800
      gainNode.gain.value = settings.soundVolume * 0.1

      oscillator.start()
      oscillator.stop(context.currentTime + 0.3)

      console.log("System beep fallback executed")
    } catch (fallbackError) {
      console.error("Even fallback failed:", fallbackError)
    }
  }
}

// LocalStorage Hook
