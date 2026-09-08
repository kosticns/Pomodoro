'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import type { ThemeProviderProps } from 'next-themes'

const NextThemesProvider = dynamic(
  () => import('next-themes').then((mod) => mod.ThemeProvider),
  { ssr: false }
)

// Currently unused: the app is permanently dark via className="dark" on <html>
// in app/layout.tsx. Kept for if theme switching is ever added.
//
// Props are taken from next-themes rather than redeclared. The hand-written
// version typed `attribute` as string, but next-themes wants a union of
// specific attribute names, so it never type-checked.
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
