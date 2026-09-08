import type React from "react"
import type { Metadata } from "next"
import { Michroma } from "next/font/google"
import "./globals.css"

const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
})

export const metadata: Metadata = {
  title: "Pomodoro Timer // Cyberpunk Edition",
  description: "A futuristic Pomodoro timer to enhance your focus.",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={michroma.className}>
        <div className="bg-background text-foreground">{children}</div>
      </body>
    </html>
  )
}
