import { describe, it, expect } from 'vitest'
import { partiRipetuta as app } from '../ripetute'
import { partiRipetuta as server } from '../../../supabase/functions/_shared/ripetute.ts'

// Perché questo test esiste
// ─────────────────────────
// Le Edge Function non importano da `src/` (il deploy non lo garantisce), quindi
// `_shared/ripetute.ts` è una COPIA di `partiRipetuta` di `src/lib/ripetute.js`.
// Questo test confronta le due letture sugli stessi casi: se una delle due cambia
// senza l'altra, il Garmin mostra al cronometro una ripetuta diversa da quella
// che l'app ha salvato.
const senzaId = (ps) => ps.map(({ id: _id, ...p }) => p)
const CASI = [
  { parti: [{ tipo: 'run', duration: '4 min', pace: 'Z3', paceMin: 'Z3', paceMax: '-', intensity: '7' },
            { tipo: 'recover', duration: '3 min', pace: 'Z2', paceMin: 'Z2', paceMax: '-' },
            { tipo: 'run', duration: '400m', pace: '4:00 /km', paceMin: '4:00 /km', paceMax: '-' }] },
  { runDuration: '400m', runPace: '3:45 - 4:00 /km', runPaceMin: '3:45 /km', runPaceMax: '4:00 /km', recDuration: '1 min', recPace: 'Camminata' },
  { runDuration: '400m', recDuration: '' },          // recupero senza durata: non è una parte
  { parti: [] , runDuration: '1 km' },               // parti vuote: formato vecchio
  null, {}, { parti: [null, 3, { tipo: 'x' }] },
]
describe('partiRipetuta lato server', () => {
  it.each(CASI)('server e app leggono uguale %#', (c) => {
    expect(senzaId(server(c))).toEqual(senzaId(app(c)))
  })
})
