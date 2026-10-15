import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The API runs separately (see README). In dev, Vite proxies it so the app and the API share one origin:
// the auth cookie stays first-party and no CORS is needed. In production Caddy does the same.
const apiTarget = process.env.ILLIRIA_API_URL ?? "http://localhost:5080"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: they change far less often than the app's own code.
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 2 },
            { name: "vendor", test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget },
      "/health": { target: apiTarget },
    },
  },
})
