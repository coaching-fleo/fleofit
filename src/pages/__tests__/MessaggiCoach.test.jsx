import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within, render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthContext } from '../../App'
import { montaPagina } from '../../test/montaPagina'
import { COACHING_ID } from '../../lib/constants'

// `dati` ed `errori` si cambiano a metà test: il finto li rilegge a ogni from().
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const dati = {}
  const errori = { tabelle: [] }
  return { dati, errori, ...fintoSupabase(() => dati, { erroreSu: () => errori.tabelle }) }
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const Messaggi = (await import('../Messaggi')).default

const COACH = { id: 'coach1', email: 'coaching@federicoleo.it', created_at: '2026-01-01T00:00:00Z' }
const MESSAGGI = [
  { id: 'nuovo', testo: 'Messaggio nuovo', fissato: false, creato_at: '2026-10-10T10:00:00Z' },
  { id: 'vecchio', testo: 'Avviso vecchio', fissato: false, creato_at: '2026-09-01T10:00:00Z' },
  { id: 'fiss', testo: 'Fissato vecchio', fissato: true, creato_at: '2026-08-01T10:00:00Z' },
]
const ATLETI = [
  { id: 'a1', deleted_at: null, notes: '' },
  { id: 'a2', deleted_at: null, notes: '[PAUSA: 2026-10-01]' }, // in pausa: conta
  { id: 'a3', deleted_at: 1760000000000, notes: '' },           // eliminato: no
  { id: COACHING_ID, deleted_at: null, notes: '' },             // nascosto: no
]

const ordineRighe = (container) => [...container.querySelectorAll('[id^="messaggio-"]')].map(n => n.id.replace('messaggio-', ''))

/** La bacheca dentro un router con la pagina di scrittura finta: dice dove si è finiti. */
function Dove() { const l = useLocation(); return <p data-testid="dove">{l.pathname + l.search}</p> }
function montaConRotte(percorso = '/messaggi', user = COACH) {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <AuthContext.Provider value={{ user, role: 'admin' }}>
        <Routes>
          <Route path="/messaggi" element={<Messaggi />} />
          <Route path="/messaggi/nuovo" element={<Dove />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

async function apriMenu(id, voce) {
  const riga = document.getElementById('messaggio-' + id)
  fireEvent.click(within(riga).getByLabelText('Azioni messaggio'))
  fireEvent.click(await screen.findByRole('button', { name: voce }))
}

beforeEach(() => {
  finto.chiamate.length = 0
  finto.errori.tabelle = []
  finto.dati.messaggi_coach = MESSAGGI.map(m => ({ ...m }))
  finto.dati.athletes = ATLETI
  finto.supabase.functions.invoke.mockReset()
  finto.supabase.functions.invoke.mockResolvedValue({ data: { success: true, sent: 2, saltati: 0 }, error: null })
  localStorage.clear()
})

describe('Messaggi — il coach', () => {
  it('«Nuovo» in testata porta alla pagina di scrittura', async () => {
    montaConRotte()
    await screen.findByText('Messaggio nuovo')
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo messaggio' }))
    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi/nuovo')
  })

  it('«Modifica» dal menu porta alla pagina di scrittura con quel messaggio', async () => {
    montaConRotte()
    await screen.findByText('Messaggio nuovo')
    await apriMenu('nuovo', 'Modifica')
    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi/nuovo?modifica=nuovo')
  })

  it('?scrivi=1 (le entrate di prima) porta alla pagina di scrittura', async () => {
    montaConRotte('/messaggi?scrivi=1')
    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi/nuovo')
  })

  it('«Fissa» porta la riga in cima subito, e se il salvataggio fallisce torna giù', async () => {
    const { container } = montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Avviso vecchio')
    expect(ordineRighe(container)).toEqual(['fiss', 'nuovo', 'vecchio'])

    // L'update resta in sospeso: quello che si vede adesso è l'ottimismo.
    let sblocca
    const originale = finto.supabase.from.getMockImplementation()
    finto.supabase.from.mockImplementation((t) => (t === 'messaggi_coach'
      ? { update: (v) => { finto.chiamate.push({ tabella: t, metodo: 'update', args: [v] }); return { eq: () => ({ select: () => new Promise(r => { sblocca = r }) }) } } }
      : originale(t)))
    await apriMenu('vecchio', 'Fissa')
    await waitFor(() => expect(ordineRighe(container)[0]).toBe('vecchio'))
    expect(finto.chiamateA('messaggi_coach', 'update')[0].args[0]).toEqual({ fissato: true })

    sblocca({ data: null, error: { message: 'rete' } })
    await waitFor(() => expect(ordineRighe(container)).toEqual(['fiss', 'nuovo', 'vecchio']))
    finto.supabase.from.mockImplementation(originale)
  })

  it('«Fissa» con il database che risponde: resta in cima', async () => {
    const { container } = montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Avviso vecchio')
    await apriMenu('vecchio', 'Fissa')
    await waitFor(() => expect(finto.chiamateA('messaggi_coach', 'update')).toHaveLength(1))
    expect(finto.chiamateA('messaggi_coach', 'eq').some(c => c.args[0] === 'id' && c.args[1] === 'vecchio')).toBe(true)
    expect(ordineRighe(container)[0]).toBe('vecchio')
  })

  it('«Togli dai fissati» su un fissato', async () => {
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Fissato vecchio')
    await apriMenu('fiss', 'Togli dai fissati')
    await waitFor(() => expect(finto.chiamateA('messaggi_coach', 'update')[0]?.args[0]).toEqual({ fissato: false }))
  })

  it('«Elimina» chiede conferma con l\'avvertenza, poi cancella', async () => {
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Messaggio nuovo')
    await apriMenu('nuovo', 'Elimina')
    const dialogo = await screen.findByRole('dialog', { name: 'Eliminare il messaggio?' })
    expect(within(dialogo).getByText(/Sparirà dalla bacheca; chi ha già ricevuto la notifica la vede ancora/)).toBeTruthy()
    expect(finto.chiamateA('messaggi_coach', 'delete')).toHaveLength(0)
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(finto.chiamateA('messaggi_coach', 'delete')).toHaveLength(1))
    expect(finto.chiamateA('messaggi_coach', 'eq').some(c => c.args[0] === 'id' && c.args[1] === 'nuovo')).toBe(true)
    await waitFor(() => expect(screen.queryByText('Messaggio nuovo')).toBeNull())
  })
})

describe('Messaggi — rimandare la notifica e tornare indietro', () => {
  it('«Manda la notifica» richiama send-reminders con lo stesso id (il server salta chi l\'ha già)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Avviso vecchio')
    await apriMenu('vecchio', 'Manda la notifica')
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(1))
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('send-reminders', { body: { mode: 'broadcast', record_id: 'vecchio' } })
  })

  it('mentre la notifica parte, «Manda la notifica» è spenta', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let sblocca
    finto.supabase.functions.invoke.mockImplementationOnce(() => new Promise(r => { sblocca = r }))
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Avviso vecchio')
    await apriMenu('vecchio', 'Manda la notifica')
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(1))
    fireEvent.click(within(document.getElementById('messaggio-nuovo')).getByLabelText('Azioni messaggio'))
    const menu = await screen.findByRole('dialog', { name: 'Messaggio' })
    expect(within(menu).getByRole('button', { name: /Manda la notifica|Invio…/ }).disabled).toBe(true)
    sblocca({ data: { success: true, sent: 1 }, error: null })
  })

  it('ha la freccia per tornare indietro', async () => {
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    expect(await screen.findByRole('button', { name: 'Torna indietro' })).toBeTruthy()
  })
})

describe('Messaggi — scritture rifiutate e account di prova', () => {
  it('«Fissa» che non tocca nessuna riga (RLS, senza errore) torna giù', async () => {
    const { container } = montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Avviso vecchio')
    finto.dati.messaggi_coach = [] // update(...).select('id') → []
    await apriMenu('vecchio', 'Fissa')
    await waitFor(() => expect(finto.chiamateA('messaggi_coach', 'update')).toHaveLength(1))
    expect(finto.chiamateA('messaggi_coach', 'select').some(c => c.args[0] === 'id')).toBe(true)
    await waitFor(() => expect(ordineRighe(container)).toEqual(['fiss', 'nuovo', 'vecchio']))
  })

  it.each([
    ['in errore', () => { finto.errori.tabelle = ['messaggi_coach'] }],
    ['senza righe toccate', () => { finto.dati.messaggi_coach = [] }],
  ])('«Elimina» %s: la riga torna', async (_, rompi) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Messaggio nuovo')
    await apriMenu('nuovo', 'Elimina')
    const dialogo = await screen.findByRole('dialog', { name: 'Eliminare il messaggio?' })
    rompi()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(finto.chiamateA('messaggi_coach', 'delete')).toHaveLength(1))
    expect(await screen.findByText('Messaggio nuovo')).toBeTruthy()
  })

  it('account di prova: il menu mostra le voci spente e il perché, e non scrive', async () => {
    montaPagina(<Messaggi />, { user: { ...COACH, email: 'demo@fleofit.it' }, role: 'admin' })
    await screen.findByText('Messaggio nuovo')
    fireEvent.click(within(document.getElementById('messaggio-nuovo')).getByLabelText('Azioni messaggio'))
    const menu = await screen.findByRole('dialog', { name: 'Messaggio' })
    expect(within(menu).getByText("Nell'account di prova i messaggi non partono")).toBeTruthy()
    for (const voce of ['Fissa', 'Modifica', 'Manda la notifica', 'Elimina']) {
      const b = within(menu).getByRole('button', { name: voce })
      expect(b.disabled).toBe(true)
      fireEvent.click(b)
    }
    await new Promise(r => setTimeout(r, 400))
    expect(screen.queryByLabelText('Testo del messaggio')).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Eliminare il messaggio?' })).toBeNull()
    expect(finto.chiamateA('messaggi_coach', 'update')).toHaveLength(0)
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
  })
})

describe('Messaggi — caricamento fallito', () => {
  it.each([['admin'], ['athlete']])('%s: una riga d\'errore, non la bacheca vuota', async (role) => {
    finto.errori.tabelle = ['messaggi_coach']
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    montaPagina(<Messaggi />, { user: COACH, role })
    expect(await screen.findByText('Non riesco a caricare i messaggi.')).toBeTruthy()
    expect(screen.queryByText('Qui troverai i messaggi del coach')).toBeNull()
  })
})
