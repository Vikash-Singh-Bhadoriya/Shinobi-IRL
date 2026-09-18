import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initAnalytics } from './analytics/analytics'

// Initialise analytics before mounting React.
// Safe to call if VITE_POSTHOG_KEY is absent — silently no-ops.
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)