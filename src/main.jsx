import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import DemoBadge from './DemoBadge'

// ⚠️ `import.meta.env.VITE_DEMO` è sostituito da Vite in fase di build: in una
// build normale questo vale `false`, il nastro non si monta e né lui né il
// finto client entrano nel bundle (CLAUDE.md §9-quinvicies).
const inProva = import.meta.env.VITE_DEMO === '1'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {inProva && <DemoBadge />}
    <App />
  </StrictMode>,
)
