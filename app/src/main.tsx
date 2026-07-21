import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { BUILD_VERSION, BUILD_DATE } from './version'

// Logged on boot so you can confirm the deployed build is the latest code.
console.log(`%cINT AI build: ${BUILD_VERSION} (${BUILD_DATE})`, 'color:#3ee0ff;font-weight:600');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
