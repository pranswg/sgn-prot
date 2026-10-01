import * as React from "react"

import { MOBILE_BREAKPOINT, isMobileViewport } from "@/lib/sidebarNav"

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function currentIsMobile(): boolean {
  if (typeof window === "undefined") return false
  return isMobileViewport(window.innerWidth)
}

export function useIsMobile() {
  // Initialised from the viewport rather than left `undefined`. A first render
  // that assumed desktop made the app mount a desktop sidebar and then swap to
  // the mobile drawer on the second pass, which read as a layout flash.
  const [isMobile, setIsMobile] = React.useState<boolean>(currentIsMobile)

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(isMobileViewport(window.innerWidth))
    // Re-sync in case the viewport changed between first render and this effect.
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}