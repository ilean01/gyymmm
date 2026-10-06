import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800.css'
import './index.css'
import App from './App.tsx'

let reloadingForUpdate = false

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) {
      return
    }

    reloadingForUpdate = true
    window.location.reload()
  })
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return
    }

    window.setInterval(() => {
      void registration.update()
    }, 60_000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
