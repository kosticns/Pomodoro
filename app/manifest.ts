import type { MetadataRoute } from "next"

// Required by `output: "export"`. Without it Next treats this metadata route as
// dynamic and the static build fails on /manifest.webmanifest.
export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pomodoro Timer",
    short_name: "Pomodoro",
    description: "A mobile-first Pomodoro timer to boost your productivity.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
