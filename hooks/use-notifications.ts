"use client"

import { useState, useEffect, useCallback } from "react"

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result
    }
    return "denied"
  }

  /**
   * Shows a notification, and reports whether it actually went out.
   *
   * The return value matters for anything that fires once per event. Callers
   * used to mark "already notified" before calling this, so if permission was
   * not granted at that moment the notification silently never happened and
   * the event was still marked as handled. Only record success on true.
   */
  const showNotification = useCallback((title: string, options?: NotificationOptions): boolean => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, options)
      return true
    }
    return false
  }, [])

  return { permission, requestPermission, showNotification }
}

// Workday Timer Hook
