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

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, options)
    }
  }, [])

  return { permission, requestPermission, showNotification }
}

// Workday Timer Hook
