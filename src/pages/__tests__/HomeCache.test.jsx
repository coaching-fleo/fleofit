import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { montaPagina, oggi } from '../../test/montaPagina'
import { chiaveCacheWorkout } from '../../lib/offlineQueue'

// Perché questi test esistono
// ────────────────────────────
// «Compaiono già i riquadri, ma non sono popolati»: segnalazione del
// committente, 31/08/2026. La cache `fleofit_cache_workouts_<uid>` veniva
// SCRITTA a ogni fetch riuscito e riletta **solo se la rete falliva**, quindi
// online i riquadri restavano vuoti ad aspettare il server anche quando i dati
// dell'ultima volta erano lì. Ora la pagina si dipinge dalla cache prima di
// chiedere qualsiasi cosa, e la risposta riscrive tutto (§9-noviesdecies).

const controllo = vi.hoisted(() => ({ titoloDalServer: 'Dal server' }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const giorno = new Date().toISOString().split('T')[0]
  return fintoSupabase(() => ({
    athlete_workouts: [{
      id: 'aw-server', completed_date: giorno, status: 'pending', notes: null,
      workouts: { id: 'w-server', title: controllo.titoloDalServer, sections: { category: 'Hyrox', blocks: [] } },
    }],
    notifications: [],
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const Home = (await import('../Home')).default

/** Una riga di storico come quella che il fetch salva in cache. */
const rigaCache = (titolo) => ([{
  id: 'aw-cache', completed_date: oggi(), status: 'pending', notes: null,
  workouts: { id: 'w-cache', title: titolo, sections: { category: 'Hyrox', blocks: [] } },
}])

beforeEach(() => { controllo.titoloDalServer = 'Dal server' })

describe('La Home si dipinge dalla cache prima della rete', () => {
  it('mostra subito l\'allenamento dell\'ultima volta, poi lo aggiorna col server', async () => {
    window.localStorage.setItem(chiaveCacheWorkout('u1'), JSON.stringify(rigaCache('Dalla cache')))

    montaPagina(<Home />, { role: 'athlete' })

    // 🔴 Nessun await: la cache si legge PRIMA del primo `await` del fetch,
    // quindi il contenuto è già in pagina quando `render` torna. È questa
    // riga che cade se la cache torna a leggersi solo sul ramo d'errore —
    // lì il titolo non compare affatto, non compare "dopo".
    expect(screen.getByText('Dalla cache')).toBeInTheDocument()

    // E quando la rete risponde, comanda lei.
    expect(await screen.findByText('Dal server')).toBeInTheDocument()
    expect(screen.queryByText('Dalla cache')).not.toBeInTheDocument()
  })

  it('non mostra MAI la cache di un altro atleta', async () => {
    // La cache c'è, ma è di un altro utente: la chiave porta l'uid.
    window.localStorage.setItem(chiaveCacheWorkout('un-altro-atleta'), JSON.stringify(rigaCache('Roba di un altro')))

    montaPagina(<Home />, { role: 'athlete' })

    // ⚠️ Va verificato PRIMA che la rete risponda: dopo, il server sovrascrive
    // comunque e il test passerebbe anche leggendo una chiave sbagliata.
    expect(screen.queryByText('Roba di un altro')).not.toBeInTheDocument()

    expect(await screen.findByText('Dal server')).toBeInTheDocument()
    expect(screen.queryByText('Roba di un altro')).not.toBeInTheDocument()
  })

  it('senza cache parte dallo scheletro, come prima', async () => {
    controllo.titoloDalServer = 'Solo dal server'

    montaPagina(<Home />, { role: 'athlete' })

    expect(screen.queryByText('Solo dal server')).not.toBeInTheDocument()
    expect(await screen.findByText('Solo dal server')).toBeInTheDocument()
  })
})
