import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const PRELOAD_ERROR_RELOAD_KEY = 'vite-preload-error-reloaded-at'
const PRELOAD_ERROR_RELOAD_WINDOW_MS = 60_000

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  const previousReload = Number(
    sessionStorage.getItem(PRELOAD_ERROR_RELOAD_KEY),
  )
  if (
    Number.isFinite(previousReload) &&
    Date.now() - previousReload < PRELOAD_ERROR_RELOAD_WINDOW_MS
  ) {
    return
  }

  sessionStorage.setItem(PRELOAD_ERROR_RELOAD_KEY, String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
