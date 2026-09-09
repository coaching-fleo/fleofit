import { createClient } from '@supabase/supabase-js'
import { clientDemo } from './supabaseDemo'

const supabaseUrl = 'https://riyqtcssllupakjtoehj.supabase.co/'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeXF0Y3NzbGx1cGFranRvZWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjQzOTMsImV4cCI6MjA5MzY0MDM5M30.5JOedCA0vljWtLktcNuBe7tZ72rFqmqY2SWt6uUg7ro'

// 🔴 AMBIENTE DI PROVA — `npm run demo`, cioè VITE_DEMO=1.
//
// Questo branch parla con il database di PRODUZIONE, condiviso con la web app,
// e non esiste uno staging (CLAUDE.md §1.1): provare una funzione voleva dire
// scrivere sui dati veri degli atleti — e assegnare fa partire anche una push a
// una persona vera. Con il flag acceso l'app gira su `src/supabaseDemo.js`,
// tutto in memoria, e non esce niente dal browser.
//
// ⚠️ `import.meta.env.VITE_DEMO` è sostituito da Vite in fase di build: in una
// build normale il ramo diventa `false` e il modulo di prova NON entra nel
// bundle. Verifica dopo `npm run build`:
//     grep -c "AMBIENTE DI PROVA" dist/assets/*.js   → 0
export const supabase = import.meta.env.VITE_DEMO === '1'
  ? clientDemo()
  : createClient(supabaseUrl, supabaseKey)
