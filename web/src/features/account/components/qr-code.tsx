import qrcode from "qrcode-generator"
import { useMemo } from "react"

import { cn } from "@/lib/utils"

/**
 * A QR code as an SVG (one path of dark modules). Always dark on white with a quiet zone, whatever the theme:
 * scanners need the contrast.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, "M") // 0: the smallest version that fits
    code.addData(value)
    code.make()
    const count = code.getModuleCount()
    let d = ""
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (code.isDark(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`
      }
    }
    return { size: count + QUIET_ZONE * 2, path: d }
  }, [value])

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("rounded-lg bg-white", className)}
    >
      <path d={path} fill="#000" />
    </svg>
  )
}

// The QR spec asks for 4 modules of white around the code.
const QUIET_ZONE = 4
