import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../App'

// L'archivio in modalità scelta per la TV: `/archive?tv=<codice>` (spec
// 2026-11-02-tv-qr-scelta-workout-design.md §3). Cambia solo dove porta il
// tocco su un workout, più una striscia in alto: tutto il resto dell'archivio
// ha i suoi test in ArchivioWorkout.test.jsx.

const dati = await vi.hoisted(async () => ({ workouts: [], assegnazioni: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ workouts: dati.workouts, athlete_workouts: dati.assegnazioni }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const WorkoutsArchive = (await import('../WorkoutsArchive')).default

const ATLETA = { id: 'u1', email: 'atleta@fleofit.it' }
const ADMIN = { id: 'c1', email: 'coach@fleofit.it' }

function Arrivo({ nome }) {
  const l = useLocation()
  return <div data-testid="arrivo">{nome}:{l.pathname}{l.search}</div>
}

function monta(percorso, { role = 'admin', user = ADMIN } = {}) {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <AuthContext.Provider value={{ user, role }}>
        <Routes>
          <Route path="/archive" element={<><WorkoutsArchive /><Arrivo nome="archivio" /></>} />
          <Route path="/workout/:id" element={<Arrivo nome="scheda" />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const HYROX = { category: 'Hyrox', blocks: [] }

beforeEach(() => {
  finto.chiamate.length = 0
  dati.workouts = [{ id: 'w1', title: 'Full Body', date: '2026-10-30', created_at: '2026-10-30T00:00:00Z', sections: HYROX, athlete_workouts: [] }]
  dati.assegnazioni = [{
    id: 'aw1', completed_date: '2026-10-30', status: 'pending', created_at: '2026-10-30T00:00:00Z',
    workouts: { id: 'w1', title: 'Full Body', date: '2026-10-30', sections: HYROX },
  }]
})

describe('Archivio con ?tv=', () => {
  it('mostra la striscia della scelta', async () => {
    monta('/archive?tv=1234')
    expect(await screen.findByText('Scegli il workout da mandare in TV')).toBeInTheDocument()
  })

  it('coach: il tocco porta alla scheda con il codice della TV', async () => {
    monta('/archive?tv=1234')
    await userEvent.click(await screen.findByRole('button', { name: /Full Body/ }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('scheda:/workout/w1?tv=1234')
  })

  it('atleta: il tocco porta alla scheda con athlete_id e il codice', async () => {
    monta('/archive?tv=1234', { role: 'athlete', user: ATLETA })
    await userEvent.click(await screen.findByRole('button', { name: /Full Body/ }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('scheda:/workout/w1?athlete_id=u1&tv=1234')
  })

  it('la X della striscia esce dalla modalità: via la striscia e via `tv`', async () => {
    monta('/archive?tv=1234')
    await screen.findByText('Scegli il workout da mandare in TV')
    await userEvent.click(screen.getByRole('button', { name: 'Esci dalla scelta per la TV' }))
    expect(screen.queryByText('Scegli il workout da mandare in TV')).not.toBeInTheDocument()
    expect(screen.getByTestId('arrivo')).toHaveTextContent(/^archivio:\/archive$/)
    await userEvent.click(screen.getByRole('button', { name: /Full Body/ }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('scheda:/workout/w1')
    expect(screen.getByTestId('arrivo')).not.toHaveTextContent('tv=')
  })
})

describe('Archivio senza ?tv=', () => {
  it('nessuna striscia, e la scheda si apre come sempre', async () => {
    monta('/archive')
    await userEvent.click(await screen.findByRole('button', { name: /Full Body/ }))
    expect(screen.queryByText('Scegli il workout da mandare in TV')).not.toBeInTheDocument()
    expect(screen.getByTestId('arrivo')).toHaveTextContent(/^scheda:\/workout\/w1$/)
  })

  it('un `tv` che non è di quattro cifre non attiva la modalità', async () => {
    monta('/archive?tv=12')
    await userEvent.click(await screen.findByRole('button', { name: /Full Body/ }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent(/^scheda:\/workout\/w1$/)
  })

  // Ruling 8: in modalità TV il tocco sostituisce l'archivio nella cronologia:
  // «indietro» dalla scheda torna a prima della scelta.
  it('in modalità TV, «indietro» dalla scheda non torna all\'archivio', async () => {
    function Indietro() {
      const vai = useNavigate()
      return <><Arrivo nome="scheda" /><button onClick={() => vai(-1)}>indietro</button></>
    }
    render(
      <MemoryRouter initialEntries={['/prima', '/archive?tv=1234']} initialIndex={1}>
        <AuthContext.Provider value={{ user: ADMIN, role: 'admin' }}>
          <Routes>
            <Route path="/archive" element={<WorkoutsArchive />} />
            <Route path="/workout/:id" element={<Indietro />} />
            <Route path="/prima" element={<Arrivo nome="prima" />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByRole('button', { name: /Full Body/ }))
    await userEvent.click(screen.getByRole('button', { name: 'indietro' }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('prima:/prima')
  })
})
