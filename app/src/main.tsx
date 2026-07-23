import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { BUILD_VERSION, BUILD_DATE } from './version'
import { initTheme } from './lib/theme'

// Apply the saved light/dark/auto preference before first paint.
initTheme();

// Logged on boot so you can confirm the deployed build is the latest code.
console.log(`%cINT build: ${BUILD_VERSION} (${BUILD_DATE})`, 'color:#7c3aed;font-weight:600');

// Register the service worker (production only) so the Till loads offline.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline mode simply unavailable */ });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
