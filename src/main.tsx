import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ChristmasEffects from './ChristmasEffects'
import { loadChristmasSetting } from './lib/settings'
import './index.css'

// Resolve the global Christmas flag before first paint so visitors never see
// the effects flash on/off; cap the wait so a slow API never blocks rendering.
Promise.race([
  loadChristmasSetting(),
  new Promise(resolve => window.setTimeout(resolve, 800)),
]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ChristmasEffects />
      <App />
    </StrictMode>,
  )
})
