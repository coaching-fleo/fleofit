import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within, render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthContext } from '../../App'
import { CHIAVE_BOZZA } from '../../lib/messaggiCoach'
import { COACHING_ID } from '../../lib/constants'

// «Messaggio a tutti»: la pagina di scrittura (era un foglio dal basso).
// `dati` ed `errori` si cambiano a metà test: il finto li rilegge a ogni from().
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const dati = {}
  const errori = { tabelle: [] }
  return { dati, errori, ...fintoSupabase(() => dati, { erroreSu: () => errori.tabelle }) }
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const NuovoMessaggio = (await import('../NuovoMessaggio')).default

const COACH = { id: 'coach1', email: 'coaching@federicoleo.it', created_at: '2026-01-01T00:00:00Z' }
const DEMO = { ...COACH, email: 'demo@fleofit.it' }
const ATLETI = [
  { id: 'a1', deleted_at: null, notes: '' },
  { id: 'a2', deleted_at: null, notes: '[PAUSA: 2026-10-01]' }, // in pausa: conta
  { id: 'a3', deleted_at: 1760000000000, notes: '' },           // eliminato: no
  { id: COACHING_ID, deleted_at: null, notes: '' },             // nascosto: no
]
const NUOVA_RIGA = { id: 'm-nuovo', testo: 'Domani si corre alle 7', fissato: false, creato_at: '2026-10-15T08:00:00Z', modificato_at: null }
const ESISTENTE = { id: 'nuovo', testo: 'Messaggio nuovo', fissato: false, creato_at: '2026-10-10T10:00:00Z', modificato_at: null }

/** Dove si è finiti dopo l'invio: la bacheca finta stampa il percorso. */
function Dove() { const l = useLocation(); return <p data-testid="dove">{l.pathname + l.search}</p> }

function monta({ user = COACH, percorso = '/messaggi/nuovo', role = 'admin' } = {}) {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <AuthContext.Provider value={{ user, role }}>
        <Routes>
          <Route path="/messaggi/nuovo" element={<NuovoMessaggio />} />
          <Route path="/messaggi" element={<Dove />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const campo = () => screen.getByLabelText('Testo del messaggio')
const invia = () => screen.getByRole('button', { name: /^Invia/ })
const prova = () => screen.getByRole('button', { name: 'Prova su di me' })
const pillola = () => screen.getByRole('button', { name: /Fiss/ })
const conferma = async () => fireEvent.click(within(await screen.findByRole('dialog', { name: /Mandare a/ })).getByRole('button', { name: 'Manda' }))

beforeEach(() => {
  finto.chiamate.length = 0
  finto.errori.tabelle = []
  finto.dati.messaggi_coach = [{ ...ESISTENTE }]
  finto.dati.athletes = ATLETI
  finto.supabase.functions.invoke.mockReset()
  finto.supabase.functions.invoke.mockResolvedValue({ data: { success: true, sent: 2, saltati: 0 }, error: null })
  localStorage.clear()
})

describe('Nuovo messaggio — scrivere', () => {
  it('conta gli atleti attivi, compresi quelli in pausa, senza l\'account nascosto', async () => {
    monta()
    expect(await screen.findByRole('button', { name: 'Invia a 2' })).toBeTruthy()
    expect(screen.getByText(/2 atleti ·/)).toBeTruthy()
  })

  it('testo vuoto o di soli spazi: Invia disattivato', async () => {
    monta()
    expect(invia().disabled).toBe(true)
    fireEvent.change(campo(), { target: { value: '   \n\n  ' } })
    expect(invia().disabled).toBe(true)
    fireEvent.change(campo(), { target: { value: 'Ciao a tutti' } })
    expect(invia().disabled).toBe(false)
  })

  it('2.001 caratteri: contatore in errore e Invia disattivato', async () => {
    monta()
    fireEvent.change(campo(), { target: { value: 'a'.repeat(2001) } })
    const contatore = screen.getByTestId('contatore')
    expect(contatore.textContent).toBe('2001/2000')
    expect(contatore.dataset.errore).toBe('true')
    expect(invia().disabled).toBe(true)
  })

  it('«Fissa in cima» cambia al primo tocco e non toglie il fuoco al campo (la tastiera resta su)', async () => {
    monta()
    expect(pillola().getAttribute('aria-pressed')).toBe('false')
    // fireEvent torna false quando il gestore ha chiamato preventDefault.
    expect(fireEvent.mouseDown(pillola())).toBe(false)
    expect(fireEvent.pointerDown(pillola())).toBe(false)
    fireEvent.click(pillola())
    expect(pillola().getAttribute('aria-pressed')).toBe('true')
    expect(pillola().textContent).toBe('Fissato in cima')
  })

  it('anche Invia e Prova non tolgono il fuoco al campo', async () => {
    monta()
    fireEvent.change(campo(), { target: { value: 'Ciao' } })
    expect(fireEvent.mouseDown(invia())).toBe(false)
    expect(fireEvent.mouseDown(prova())).toBe(false)
  })

  it('Invia chiede conferma, salva il testo ripulito, manda la push e torna alla bacheca sul messaggio', async () => {
    monta()
    await screen.findByRole('button', { name: 'Invia a 2' })
    fireEvent.change(campo(), { target: { value: 'Domani si corre alle 7\n\n' } })
    fireEvent.click(pillola())
    expect(localStorage.getItem(CHIAVE_BOZZA)).toBeTruthy()
    fireEvent.click(invia())

    const dialogo = await screen.findByRole('dialog', { name: 'Mandare a 2 atleti?' })
    expect(within(dialogo).getByText('Ognuno riceverà una notifica.')).toBeTruthy()
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(0)

    finto.dati.messaggi_coach = [{ ...NUOVA_RIGA, fissato: true }]
    await conferma()

    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi?m=m-nuovo')
    const ins = finto.chiamateA('messaggi_coach', 'insert')
    expect(ins).toHaveLength(1)
    expect(ins[0].args[0]).toEqual({ testo: 'Domani si corre alle 7', fissato: true })
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('send-reminders', { body: { mode: 'broadcast', record_id: 'm-nuovo' } })
    expect(JSON.parse(localStorage.getItem(CHIAVE_BOZZA))).toBeNull()
  })

  it('push fallita: lo dice, e Riprova usa lo stesso id senza un nuovo insert', async () => {
    finto.supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'rete' } })
    monta()
    await screen.findByRole('button', { name: 'Invia a 2' })
    fireEvent.change(campo(), { target: { value: 'Domani si corre alle 7' } })
    fireEvent.click(invia())
    finto.dati.messaggi_coach = [NUOVA_RIGA]
    await conferma()

    expect(await screen.findByText('Il messaggio è in bacheca, ma la notifica non è partita')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi?m=m-nuovo')
    const [primo, secondo] = finto.supabase.functions.invoke.mock.calls
    expect(secondo).toEqual(primo)
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(1)
  })

  it('mentre parte, Invia e Riprova non si premono due volte', async () => {
    let sblocca
    finto.supabase.functions.invoke.mockImplementationOnce(() => new Promise(r => { sblocca = r }))
    monta()
    await screen.findByRole('button', { name: 'Invia a 2' })
    fireEvent.change(campo(), { target: { value: 'Ciao' } })
    fireEvent.click(invia())
    finto.dati.messaggi_coach = [NUOVA_RIGA]
    await conferma()
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /Invio/ }).disabled).toBe(true)
    sblocca({ data: null, error: { message: 'rete' } })
    await screen.findByText('Il messaggio è in bacheca, ma la notifica non è partita')

    let sblocca2
    finto.supabase.functions.invoke.mockImplementationOnce(() => new Promise(r => { sblocca2 = r }))
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: /Riprov/ }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Riprov/ }))
    expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(2)
    sblocca2({ data: { success: true }, error: null })
  })

  it('account di prova: Invia e Prova disattivati, lo dice, e niente parte', async () => {
    monta({ user: DEMO })
    fireEvent.change(campo(), { target: { value: 'Ciao a tutti' } })
    expect(screen.getByText("Nell'account di prova i messaggi non partono")).toBeTruthy()
    expect(invia().disabled).toBe(true)
    expect(prova().disabled).toBe(true)
    fireEvent.click(invia())
    fireEvent.click(prova())
    expect(screen.queryByRole('dialog', { name: /Mandare a/ })).toBeNull()
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(0)
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('uscito con del testo e rientrato, il testo è ancora lì', async () => {
    const { unmount } = monta()
    fireEvent.change(campo(), { target: { value: 'Una bozza a metà' } })
    fireEvent.click(pillola())
    unmount()
    monta()
    expect(campo().value).toBe('Una bozza a metà')
    expect(pillola().getAttribute('aria-pressed')).toBe('true')
  })

  it('Annulla torna alla bacheca', async () => {
    monta()
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi')
  })
})

describe('Nuovo messaggio — correggere', () => {
  const MODIFICA = '/messaggi/nuovo?modifica=nuovo'

  it('carica il testo, salva testo e modificato_at senza push, e torna alla bacheca sul messaggio', async () => {
    monta({ percorso: MODIFICA })
    await waitFor(() => expect(campo().value).toBe('Messaggio nuovo'))
    expect(screen.getByRole('heading', { name: 'Modifica messaggio' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Fiss/ })).toBeNull()
    fireEvent.change(campo(), { target: { value: 'Messaggio corretto  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))

    expect(await screen.findByTestId('dove')).toHaveTextContent('/messaggi?m=nuovo')
    const valori = finto.chiamateA('messaggi_coach', 'update')[0].args[0]
    expect(valori.testo).toBe('Messaggio corretto')
    expect(Number.isNaN(new Date(valori.modificato_at).getTime())).toBe(false)
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(0)
    expect(localStorage.getItem(CHIAVE_BOZZA)).toBeNull() // la correzione non tocca la bozza
  })

  it.each([
    ['in errore', () => { finto.errori.tabelle = ['messaggi_coach'] }],
    ['senza righe toccate (RLS)', () => { finto.dati.messaggi_coach = [] }],
  ])('salvataggio %s: lo dice e il testo scritto resta', async (_, rompi) => {
    monta({ percorso: MODIFICA })
    await waitFor(() => expect(campo().value).toBe('Messaggio nuovo'))
    rompi()
    fireEvent.change(campo(), { target: { value: 'Messaggio corretto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(await screen.findByText(/Modifica non salvata/)).toBeTruthy()
    expect(campo().value).toBe('Messaggio corretto')
    expect(screen.queryByTestId('dove')).toBeNull()
  })

  it('account di prova: Salva disattivato e lo dice', async () => {
    monta({ user: DEMO, percorso: MODIFICA })
    await waitFor(() => expect(campo().value).toBe('Messaggio nuovo'))
    expect(screen.getByText("Nell'account di prova i messaggi non partono")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salva' }).disabled).toBe(true)
  })
})

// «Prova su di me»: la push solo ai dispositivi del coach, senza salvare il
// messaggio (nessun atleta vede niente) e senza lasciare la pagina.
describe('Nuovo messaggio — prova su di me', () => {
  it('manda il testo ripulito in modo prova, senza insert, senza conferma, e resta qui con la bozza', async () => {
    monta()
    fireEvent.change(campo(), { target: { value: 'Sabato ritrovo alle 8\n\n' } })
    fireEvent.click(prova())
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(1))
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('send-reminders', { body: { mode: 'broadcast_prova', testo: 'Sabato ritrovo alle 8' } })
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(0)
    expect(screen.queryByRole('dialog', { name: /Mandare a/ })).toBeNull()
    expect(await screen.findByText('Prova mandata ai tuoi dispositivi (2)')).toBeTruthy()
    expect(campo().value).toBe('Sabato ritrovo alle 8\n\n')
    expect(JSON.parse(localStorage.getItem(CHIAVE_BOZZA))?.testo).toBe('Sabato ritrovo alle 8\n\n')
    expect(screen.queryByTestId('dove')).toBeNull()
  })

  it('nessun dispositivo iscritto: lo dice', async () => {
    finto.supabase.functions.invoke.mockResolvedValueOnce({ data: { success: true, sent: 0 }, error: null })
    monta()
    fireEvent.change(campo(), { target: { value: 'Ciao' } })
    fireEvent.click(prova())
    expect(await screen.findByText('Nessun tuo dispositivo ha le notifiche attive')).toBeTruthy()
  })

  it('prova fallita: lo dice', async () => {
    finto.supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'rete' } })
    monta()
    fireEvent.change(campo(), { target: { value: 'Ciao' } })
    fireEvent.click(prova())
    expect(await screen.findByText('La prova non è partita. Controlla la connessione e riprova.')).toBeTruthy()
  })

  it('testo vuoto: spento, e non parte niente', async () => {
    monta()
    expect(prova().disabled).toBe(true)
    fireEvent.click(prova())
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
  })
})
