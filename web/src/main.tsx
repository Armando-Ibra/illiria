import { QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"

import { router } from "@/app/router"
import { Toaster } from "@/components/ui/sonner"
import { queryClient } from "@/lib/query-client"

import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
)
