import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './card-game/tokens.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
