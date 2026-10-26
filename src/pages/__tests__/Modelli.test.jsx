import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthContext } from '../../App'

// Perché questi test esistono
// ────────────────────────────
// La pagina /modelli (16/10/2026) è l'unico posto dove un modello si rinomina o
// si elimina. Rinomina ed Elimina sono ottimistici: se il database rifiuta e
// la card non torna com'era, il coach crede di aver cancellato un modello che
// c'è ancora (o di averlo rinominato). E la scheda aperta sta nell'URL, perché
// tornando dal builder si deve ritrovare la stessa.

const stato = await vi.hoisted(async () => ({ inErrore: false, chiamate: [], cancellazioneSospesa: null }))
const MODELLI = [
  { id: 'h1', coach: 'u1', categoria: 'Hyrox', nome: 'EMOM vecchio', creato_at: '2026-10-01T10:00:00Z', modificato_at: null,
    contenuto: { type: 'EMOM', params: { interval: '1:00', rounds: '10' }, exercises: [{ name: 'Wall Balls', reps: '15' }] } },
  { id: 'h2', coach: 'u1', categoria: 'Hyrox', nome: 'AMRAP ritoccato', creato_at: '2026-09-01T10:00:00Z', modificato_at: '2026-10-20T10:00:00Z',
    contenuto: { type: 'AMRAP', params: { duration: '8:00' }, exercises: [{ name: 'Burpees', reps: '10' }] } },
  { id: 'h3', coach: 'u1', categoria: 'Hyrox', nome: 'Riscaldamento', creato_at: '2026-10-10T10:00:00Z', modificato_at: null,
    contenuto: { type: 'WarmUp', params: { duration: '8:00' }, exercises: [] } },
  { id: 'g1', coach: 'u1', categoria: 'Gym', nome: 'Panca 4×8', creato_at: '2026-10-05T10:00:00Z', modificato_at: null,
    contenuto: { serie: '4', recupero: '2:00', esercizi: [{ name: 'Panca piana con bilanciere', reps: '8' }] } },
]
// `modelli_blocco` si legge con `await` dopo `.eq('categoria', …)`; update e
// delete passano da `.eq('id', …)` e finiscono in `.single()` o in `await`.
vi.mock('../../supabaseClient', () => {
  const tabella = () => {
    const filtri = {}
    let metodo = 'select'
    const risposta = () => {
      if (stato.inErrore) return { data: null, error: { message: 'rete assente' } }
      const righe = MODELLI.filter(m => Object.entries(filtri).every(([k, v]) => m[k] === v))
      return { data: righe, error: null }
    }
    const c = {
      select: () => c,
      update: (dati) => { metodo = 'update'; stato.chiamate.push({ metodo, args: [dati] }); return c },
      delete: () => { metodo = 'delete'; stato.chiamate.push({ metodo, args: [] }); return c },
      eq: (col, v) => { filtri[col] = v; return c },
      single: () => Promise.resolve(stato.inErrore ? risposta() : { data: risposta().data[0] ?? null, error: null }),
      // Una cancellazione può restare in volo (cancellazioneSospesa: { id, promessa })
      // e poi fallire: serve a provare due eliminazioni sovrapposte.
      then: (ok, ko) => {
        const s = stato.cancellazioneSospesa
        if (metodo === 'delete' && s && filtri.id === s.id) {
          return s.promessa.then(() => ({ data: null, error: { message: 'rete assente' } })).then(ok, ko)
        }
        return Promise.resolve(risposta()).then(ok, ko)
      },
    }
    return c
  }
  return { supabase: { from: tabella } }
})
const chiamateA = (metodo) => stato.chiamate.filter(c => c.metodo === metodo)
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn() }))

const alert = await import('../../lib/alert')
const Modelli = (await import('../Modelli')).default

function Posizione() {
  const l = useLocation()
  return <p data-testid="posizione">{l.pathname + l.search}</p>
}

const monta = ({ percorso = '/modelli', role = 'admin' } = {}) => render(
  <MemoryRouter initialEntries={[percorso]}>
    <AuthContext.Provider value={{ user: { id: 'u1', email: 'coach@fleofit.it' }, role }}>
      <Routes>
        <Route path="/modelli" element={<Modelli />} />
        <Route path="*" element={<Posizione />} />
      </Routes>
    </AuthContext.Provider>
  </MemoryRouter>
)

const nomiCard = () => screen.getAllByTestId('card-modello').map(c => c.querySelector('[data-nome]').textContent)

beforeEach(() => {
  stato.inErrore = false
  stato.chiamate.length = 0
  stato.cancellazioneSospesa = null
  alert.mostraErrore.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('la pagina Modelli', () => {
  it('ha le schede Hyrox, Corsa e Gym, e i modelli Hyrox dal più recente', async () => {
    monta()
    expect(screen.getByRole('tab', { name: 'Hyrox' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Corsa' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Gym' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId('card-modello')).toHaveLength(3))
    expect(nomiCard()).toEqual(['AMRAP ritoccato', 'Riscaldamento', 'EMOM vecchio'])

    await userEvent.click(screen.getByRole('tab', { name: 'Gym' }))
    await waitFor(() => expect(nomiCard()).toEqual(['Panca 4×8']))
  })

  it('?categoria=Gym apre sulla scheda Gym', async () => {
    monta({ percorso: '/modelli?categoria=Gym' })
    expect(screen.getByRole('tab', { name: 'Gym' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(nomiCard()).toEqual(['Panca 4×8']))
  })

  it('una scheda vuota lo dice, e «Nuovo modello» apre il builder su quella categoria', async () => {
    monta({ percorso: '/modelli?categoria=Running' })
    expect(await screen.findByText('Nessun modello Corsa. Salvane uno da un blocco di un workout, o creane uno qui.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nuovo modello' }))
    expect(screen.getByTestId('posizione')).toHaveTextContent('/create?modello=nuovo&categoria=Running')
  })

  it('toccare una card apre il builder sul modello', async () => {
    monta()
    await userEvent.click(await screen.findByText('EMOM vecchio'))
    expect(screen.getByTestId('posizione')).toHaveTextContent('/create?modello=h1')
  })

  it('«Rinomina» salva il nome nuovo e la card si aggiorna; vuoto non si salva', async () => {
    monta()
    await userEvent.click(await screen.findByRole('button', { name: 'Azioni per EMOM vecchio' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rinomina' }))
    const foglio = await screen.findByRole('dialog', { name: 'Rinomina il modello' })
    const campo = within(foglio).getByLabelText('Nome del modello')
    expect(campo).toHaveValue('EMOM vecchio')

    await userEvent.clear(campo)
    expect(within(foglio).getByRole('button', { name: 'Salva' })).toBeDisabled()

    await userEvent.type(campo, 'EMOM gambe')
    await userEvent.click(within(foglio).getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Rinomina il modello' })).toBeNull())
    expect(chiamateA('update')[0].args[0]).toMatchObject({ nome: 'EMOM gambe' })
    expect(screen.getByText('EMOM gambe')).toBeInTheDocument()
    expect(screen.queryByText('EMOM vecchio')).toBeNull()
  })

  it('«Elimina» chiede conferma e toglie la card', async () => {
    monta()
    await userEvent.click(await screen.findByRole('button', { name: 'Azioni per EMOM vecchio' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Elimina' }))
    const conferma = await screen.findByRole('dialog', { name: 'Eliminare il modello?' })
    expect(conferma).toHaveTextContent('Il modello sparisce. I workout in cui l\'hai già usato non cambiano.')
    await userEvent.click(within(conferma).getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(screen.queryByText('EMOM vecchio')).toBeNull())
    expect(chiamateA('delete')).toHaveLength(1)
  })

  it('se l\'eliminazione non riesce la card torna e lo dice', async () => {
    monta()
    await userEvent.click(await screen.findByRole('button', { name: 'Azioni per EMOM vecchio' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Elimina' }))
    const conferma = await screen.findByRole('dialog', { name: 'Eliminare il modello?' })
    stato.inErrore = true
    await userEvent.click(within(conferma).getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(alert.mostraErrore).toHaveBeenCalled())
    expect(screen.getByText('EMOM vecchio')).toBeInTheDocument()
  })

  it('un atleta torna alla Home', async () => {
    monta({ role: 'athlete' })
    expect(await screen.findByTestId('posizione')).toHaveTextContent(/^\/$/)
  })

  it('se una eliminazione fallisce mentre un\'altra riesce, torna solo la prima', async () => {
    let fallisci
    stato.cancellazioneSospesa = { id: 'h1', promessa: new Promise(r => { fallisci = r }) }
    monta()
    const elimina = async (nome) => {
      await userEvent.click(await screen.findByRole('button', { name: `Azioni per ${nome}` }))
      await userEvent.click(await screen.findByRole('button', { name: 'Elimina' }))
      const conferma = await screen.findByRole('dialog', { name: 'Eliminare il modello?' })
      await userEvent.click(within(conferma).getByRole('button', { name: 'Elimina' }))
      await waitFor(() => expect(screen.queryByText(nome)).toBeNull())
    }
    await elimina('EMOM vecchio')      // resta in volo
    await elimina('Riscaldamento')     // riesce
    fallisci()
    await waitFor(() => expect(alert.mostraErrore).toHaveBeenCalled())
    expect(await screen.findByText('EMOM vecchio')).toBeInTheDocument()
    expect(screen.queryByText('Riscaldamento')).toBeNull()
    // E torna al suo posto: dopo «AMRAP ritoccato», come prima.
    expect(nomiCard()).toEqual(['AMRAP ritoccato', 'EMOM vecchio'])
  })
})

