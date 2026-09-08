/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: emits plain HTML/CSS/JS to out/ with no server runtime.
  // The whole app is "use client" with no API routes or server actions,
  // so nothing is lost. Required for Cloudflare Pages on external DNS.
  output: "export",
  // Type errors fail the build. v0 ships with this suppressed, which is how
  // seven references to variables that did not exist reached production on
  // 3 Sep 2026, one of them crashing the Breaks tab. Do not turn it back on.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  compiler: {
    // The app has 31 console calls, two of which fire on a ~2s interval for as
    // long as the tab is open. Stripping them at build time keeps them
    // available during `pnpm dev` while keeping production quiet. Errors and
    // warnings are deliberately kept so real problems still surface.
    removeConsole: { exclude: ["error", "warn"] },
  },
}

export default nextConfig
