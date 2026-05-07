import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))
root.render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Hide splash after app loads
const hideSplash = () => {
  const splash = document.getElementById('splash')
  if (splash) {
    splash.classList.add('hide')
    setTimeout(() => splash.remove(), 500)
  }
}

if (document.readyState === 'complete') {
  setTimeout(hideSplash, 800)
} else {
  window.addEventListener('load', () => setTimeout(hideSplash, 800))
}
