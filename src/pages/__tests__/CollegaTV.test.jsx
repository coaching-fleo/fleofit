import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { AuthContext } from '../../App'

// La pagina che il QR della TV apre quando lo si inquadra con la fotocamera
// del telefono (spec docs/superpowers/specs/2026-11-02-tv-qr-scelta-workout-design.md §2).
//
// Il punto delicato è la DESTINAZIONE: il foglio può sembrare giusto e portare
// alla scheda senza `tv` (la TV non si collega) o, per l'atleta, senza
// `athlete_id` (la scheda non carica la sua assegnazione). Per questo ogni
// scelta qui si verifica sull'indirizzo intero a cui si arriva.

const dati = await vi.hoisted(async () => ({ workouts: [], assegnazioni: [], errore: false }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(
    () => ({ workouts: dati.workouts, athlete_workouts: dati.assegnazioni }),
    { erroreSu: () => (dati.errore ? ['workouts', 'athlete_workouts'] : []) }
  )
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const CollegaTV = (await import('../CollegaTV')).default

const OGGI = format(new Date(), 'yyyy-MM-dd')
const IERI = format(subDays(new Date(), 1), 'yyyy-MM-dd')

const ATLETA = { id: 'u1', email: 'atleta@fleofit.it' }
const ADMIN = { id: 'c1', email: 'coach@fleofit.it' }

// Dove si è arrivati: l'indirizzo intero, con la query.
function Arrivo({ nome }) {
  const l = useLocation()
  return <div data-testid="arrivo">{nome}:{l.pathname}{l.search}</div>
}

function monta(percorso, { role = 'athlete', user = ATLETA } = {}) {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <AuthContext.Provider value={{ user, role }}>
        <Routes>
          <Route path="/collega-tv/:codice" element={<CollegaTV />} />
          <Route path="/workout/:id" element={<Arrivo nome="scheda" />} />
          <Route path="/archive" element={<Arrivo nome="archivio" />} />
          <Route path="/" element={<Arrivo nome="home" />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const assegnato = (id, titolo, giorno, categoria = 'Hyrox') => ({
  id: `aw-${id}`, completed_date: giorno, status: 'pending',
  workouts: { id, title: titolo, sections: { category: categoria } },
})
const workout = (id, titolo, giorno, categoria = 'Hyrox') => ({
  id, title: titolo, date: giorno, sections: { category: categoria },
})

beforeEach(() => {
  finto.chiamate.length = 0
  dati.workouts = []
  dati.assegnazioni = []
  dati.errore = false
})

describe('CollegaTV — atleta', () => {
  it('con un workout oggi lo propone, col titolo senza codice', async () => {
    dati.assegnazioni = [assegnato('w1', 'Sled · EM 24′ @8', OGGI)]
    monta('/collega-tv/1234')
    expect(await screen.findByText('Vuoi aprire questo?')).toBeInTheDocument()
    expect(screen.getByText('Sled')).toBeInTheDocument()
    expect(screen.queryByText(/EM 24′/)).not.toBeInTheDocument()
  })

  it('«Sì» apre la scheda con la sua assegnazione e il codice della TV', async () => {
    dati.assegnazioni = [assegnato('w1', 'Sled · EM 24′ @8', OGGI)]
    monta('/collega-tv/1234')
    await userEvent.click(await screen.findByRole('button', { name: 'Sì' }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('scheda:/workout/w1?athlete_id=u1&tv=1234')
  })

  it('«No, un altro» mostra la lista', async () => {
    dati.assegnazioni = [
      assegnato('w1', 'Sled · EM 24′ @8', OGGI),
      assegnato('w2', 'Lungo lento', IERI, 'Running'),
    ]
    monta('/collega-tv/1234')
    await userEvent.click(await screen.findByRole('button', { name: 'No, un altro' }))
    expect(screen.queryByText('Vuoi aprire questo?')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Lungo lento/ }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('scheda:/workout/w2?athlete_id=u1&tv=1234')
  })

  it('senza workout oggi lo dice, e propone i recenti', async () => {
    dati.assegnazioni = [assegnato('w2', 'Lungo lento', IERI, 'Running')]
    monta('/collega-tv/1234')
    expect(await screen.findByText('Oggi non hai workout assegnati')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lungo lento/ })).toBeInTheDocument()
  })
})

describe('CollegaTV — admin e coach', () => {
  it('vede le righe di oggi e dei giorni prima; il tocco apre la scheda con la TV', async () => {
    dati.workouts = [workout('w1', 'Sled · EM 24′ @8', OGGI), workout('w2', 'Lungo lento', IERI, 'Running')]
    monta('/collega-tv/1234', { role: 'admin', user: ADMIN })
    expect(await screen.findByRole('button', { name: /Sled/ })).toBeInTheDocument()
    expect(screen.queryByText('Vuoi aprire questo?')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Lungo lento/ }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('scheda:/workout/w2?tv=1234')
  })

  // Stesso filtro dell'archivio del coach: gli allenamenti liberi che gli
  // atleti si scrivono da sé non sono workout da mandare in TV.
  it('non propone gli allenamenti liberi/autonomi, come l\'archivio', async () => {
    dati.workouts = [
      workout('w1', 'Sled', OGGI),
      { id: 'w3', title: 'Corsetta al parco', date: OGGI, sections: { category: 'Custom', isAutonomous: true } },
    ]
    monta('/collega-tv/1234', { role: 'admin', user: ADMIN })
    expect(await screen.findByRole('button', { name: /Sled/ })).toBeInTheDocument()
    expect(screen.queryByText('Corsetta al parco')).not.toBeInTheDocument()
  })

  it('«Cerca nell\'archivio» apre l\'archivio in modalità scelta', async () => {
    dati.workouts = [workout('w1', 'Sled', OGGI)]
    monta('/collega-tv/1234', { role: 'admin', user: ADMIN })
    await userEvent.click(await screen.findByRole('button', { name: "Cerca nell'archivio" }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('archivio:/archive?tv=1234')
  })

  it('senza niente oggi non usa la frase dell\'atleta', async () => {
    dati.workouts = [workout('w2', 'Lungo lento', IERI, 'Running')]
    monta('/collega-tv/1234', { role: 'coach', user: ADMIN })
    expect(await screen.findByRole('button', { name: /Lungo lento/ })).toBeInTheDocument()
    expect(screen.queryByText('Oggi non hai workout assegnati')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Cerca nell'archivio" })).toBeInTheDocument()
  })
})

describe('CollegaTV — «No, un altro» dalla scheda (?altro=1)', () => {
  it('mostra la lista anche con un solo workout oggi', async () => {
    dati.assegnazioni = [
      assegnato('w1', 'Sled · EM 24′ @8', OGGI),
      assegnato('w2', 'Lungo lento', IERI, 'Running'),
    ]
    monta('/collega-tv/1234?altro=1')
    expect(await screen.findByRole('button', { name: /Sled/ })).toBeInTheDocument()
    expect(screen.queryByText('Vuoi aprire questo?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lungo lento/ })).toBeInTheDocument()
  })
})

// Ruling 8: la scelta SOSTITUISCE la pagina di scelta nella cronologia, così
// «indietro» dalla scheda torna dov'era l'app prima del QR, non alla scelta.
describe('CollegaTV — la cronologia', () => {
  function montaConPrima(percorso, opzioni = {}) {
    const { role = 'athlete', user = ATLETA } = opzioni
    function Indietro() {
      const vai = useNavigate()
      return <><Arrivo nome="scheda" /><button onClick={() => vai(-1)}>indietro</button></>
    }
    return render(
      <MemoryRouter initialEntries={['/prima', percorso]} initialIndex={1}>
        <AuthContext.Provider value={{ user, role }}>
          <Routes>
            <Route path="/collega-tv/:codice" element={<CollegaTV />} />
            <Route path="/workout/:id" element={<Indietro />} />
            <Route path="/archive" element={<Indietro />} />
            <Route path="/prima" element={<Arrivo nome="prima" />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    )
  }

  it('dalla scheda scelta, «indietro» torna a prima del QR', async () => {
    dati.assegnazioni = [assegnato('w1', 'Sled', OGGI)]
    montaConPrima('/collega-tv/1234')
    await userEvent.click(await screen.findByRole('button', { name: 'Sì' }))
    await userEvent.click(screen.getByRole('button', { name: 'indietro' }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('prima:/prima')
  })

  it('anche «Cerca nell\'archivio» sostituisce la scelta', async () => {
    dati.workouts = [workout('w1', 'Sled', OGGI)]
    montaConPrima('/collega-tv/1234', { role: 'admin', user: ADMIN })
    await userEvent.click(await screen.findByRole('button', { name: "Cerca nell'archivio" }))
    await userEvent.click(screen.getByRole('button', { name: 'indietro' }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('prima:/prima')
  })
})

describe('CollegaTV — uscite', () => {
  it('un codice non valido torna alla Home', async () => {
    monta('/collega-tv/12')
    expect(await screen.findByTestId('arrivo')).toHaveTextContent('home:/')
  })

  it('la X «Chiudi» torna alla Home', async () => {
    dati.assegnazioni = [assegnato('w1', 'Sled', OGGI)]
    monta('/collega-tv/1234')
    await screen.findByText('Vuoi aprire questo?')
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.getByTestId('arrivo')).toHaveTextContent('home:/')
  })

  it('un errore di lettura dà un messaggio e «Riprova», che rilegge', async () => {
    dati.errore = true
    dati.assegnazioni = [assegnato('w1', 'Sled', OGGI)]
    monta('/collega-tv/1234')
    const riprova = await screen.findByRole('button', { name: 'Riprova' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    dati.errore = false
    await userEvent.click(riprova)
    expect(await screen.findByText('Vuoi aprire questo?')).toBeInTheDocument()
  })
})
