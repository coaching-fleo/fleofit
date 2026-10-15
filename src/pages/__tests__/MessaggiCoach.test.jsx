import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'
import { CHIAVE_BOZZA } from '../../lib/messaggiCoach'
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
const NUOVA_RIGA = { id: 'm-nuovo', testo: 'Domani si corre alle 7', fissato: false, creato_at: '2026-10-15T08:00:00Z', modificato_at: null }

const ordineRighe = (container) => [...container.querySelectorAll('[id^="messaggio-"]')].map(n => n.id.replace('messaggio-', ''))
const campo = () => screen.getByLabelText('Testo del messaggio')
const invia = () => screen.getByRole('button', { name: 'Invia' })

async function apriFoglio(user = COACH) {
  const pagina = montaPagina(<Messaggi />, { user, role: 'admin', percorso: '/messaggi', rotta: '/messaggi' })
  await screen.findByText('Messaggio nuovo')
  fireEvent.click(screen.getByRole('button', { name: 'Messaggio a tutti' }))
  await screen.findByLabelText('Testo del messaggio')
  return pagina
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
  it('«Arriverà a N atleti» conta gli attivi, compresi quelli in pausa, senza l\'account nascosto', async () => {
    await apriFoglio()
    expect(await screen.findByText('Arriverà a 2 atleti')).toBeTruthy()
  })

  it('testo vuoto o di soli spazi: Invia disattivato', async () => {
    await apriFoglio()
    expect(invia().disabled).toBe(true)
    fireEvent.change(campo(), { target: { value: '   \n\n  ' } })
    expect(invia().disabled).toBe(true)
    fireEvent.change(campo(), { target: { value: 'Ciao a tutti' } })
    expect(invia().disabled).toBe(false)
  })

  it('2.001 caratteri: contatore in errore e Invia disattivato', async () => {
    await apriFoglio()
    fireEvent.change(campo(), { target: { value: 'a'.repeat(2001) } })
    const contatore = screen.getByTestId('contatore')
    expect(contatore.textContent).toBe('2001/2000')
    expect(contatore.dataset.errore).toBe('true')
    expect(invia().disabled).toBe(true)
  })

  it('Invia chiede conferma, poi salva il testo ripulito, manda la push e cancella la bozza', async () => {
    const { container } = await apriFoglio()
    await screen.findByText('Arriverà a 2 atleti')
    fireEvent.change(campo(), { target: { value: 'Domani si corre alle 7\n\n' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Fissa in cima' }))
    expect(localStorage.getItem(CHIAVE_BOZZA)).toBeTruthy()
    fireEvent.click(invia())

    const dialogo = await screen.findByRole('dialog', { name: 'Mandare a 2 atleti?' })
    expect(within(dialogo).getByText('Ognuno riceverà una notifica.')).toBeTruthy()
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(0)

    finto.dati.messaggi_coach = [{ ...NUOVA_RIGA, fissato: true }]
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Manda' }))

    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(1))
    const ins = finto.chiamateA('messaggi_coach', 'insert')
    expect(ins).toHaveLength(1)
    expect(ins[0].args[0]).toEqual({ testo: 'Domani si corre alle 7', fissato: true })
    expect(finto.chiamateA('messaggi_coach', 'select').length).toBeGreaterThanOrEqual(2) // anche dopo l'insert
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('send-reminders', { body: { mode: 'broadcast', record_id: 'm-nuovo' } })
    expect(JSON.parse(localStorage.getItem(CHIAVE_BOZZA))).toBeNull()
    // Il foglio si chiude e il messaggio è in cima alla bacheca.
    await waitFor(() => expect(screen.queryByLabelText('Testo del messaggio')).toBeNull())
    expect(ordineRighe(container)[0]).toBe('m-nuovo')
  })

  it('push fallita: lo dice, e Riprova usa lo stesso id senza un nuovo insert', async () => {
    finto.supabase.functions.invoke
      .mockResolvedValueOnce({ data: null, error: { message: 'rete' } })
    await apriFoglio()
    fireEvent.change(campo(), { target: { value: 'Domani si corre alle 7' } })
    fireEvent.click(invia())
    finto.dati.messaggi_coach = [NUOVA_RIGA]
    fireEvent.click(within(await screen.findByRole('dialog', { name: /Mandare a/ })).getByRole('button', { name: 'Manda' }))

    expect(await screen.findByText('Il messaggio è in bacheca, ma la notifica non è partita')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(2))
    const [primo, secondo] = finto.supabase.functions.invoke.mock.calls
    expect(secondo).toEqual(primo)
    expect(secondo[1].body.record_id).toBe('m-nuovo')
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(1)
    await waitFor(() => expect(screen.queryByLabelText('Testo del messaggio')).toBeNull())
  })

  it('mentre parte, Invia e Riprova non si premono due volte', async () => {
    let sblocca
    finto.supabase.functions.invoke.mockImplementationOnce(() => new Promise(r => { sblocca = r }))
    await apriFoglio()
    fireEvent.change(campo(), { target: { value: 'Ciao' } })
    fireEvent.click(invia())
    finto.dati.messaggi_coach = [NUOVA_RIGA]
    fireEvent.click(within(await screen.findByRole('dialog', { name: /Mandare a/ })).getByRole('button', { name: 'Manda' }))
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

  it("account di prova: Invia disattivato, lo dice, e niente insert", async () => {
    await apriFoglio({ ...COACH, email: 'demo@fleofit.it' })
    fireEvent.change(campo(), { target: { value: 'Ciao a tutti' } })
    expect(screen.getByText("Nell'account di prova i messaggi non partono")).toBeTruthy()
    expect(invia().disabled).toBe(true)
    fireEvent.click(invia())
    expect(screen.queryByRole('dialog', { name: /Mandare a/ })).toBeNull()
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(0)
  })

  it('chiuso con del testo e riaperto, il testo è ancora lì', async () => {
    await apriFoglio()
    fireEvent.change(campo(), { target: { value: 'Una bozza a metà' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    await waitFor(() => expect(screen.queryByLabelText('Testo del messaggio')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Messaggio a tutti' }))
    expect((await screen.findByLabelText('Testo del messaggio')).value).toBe('Una bozza a metà')
  })

  it('?scrivi=1 apre il foglio all\'arrivo', async () => {
    montaPagina(<Messaggi />, { user: COACH, role: 'admin', percorso: '/messaggi?scrivi=1', rotta: '/messaggi' })
    expect(await screen.findByLabelText('Testo del messaggio')).toBeTruthy()
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

  it('«Modifica» corregge testo e modificato_at, senza rimandare la push', async () => {
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Messaggio nuovo')
    await apriMenu('nuovo', 'Modifica')
    const area = await screen.findByLabelText('Testo del messaggio')
    expect(area.value).toBe('Messaggio nuovo')
    fireEvent.change(area, { target: { value: 'Messaggio corretto  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))

    await waitFor(() => expect(finto.chiamateA('messaggi_coach', 'update')).toHaveLength(1))
    const valori = finto.chiamateA('messaggi_coach', 'update')[0].args[0]
    expect(valori.testo).toBe('Messaggio corretto')
    expect(Number.isNaN(new Date(valori.modificato_at).getTime())).toBe(false)
    expect(await screen.findByText('Messaggio corretto')).toBeTruthy()
    await waitFor(() => expect(screen.queryByLabelText('Testo del messaggio')).toBeNull())
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(0)
    expect(localStorage.getItem(CHIAVE_BOZZA)).toBeNull() // la modifica non tocca la bozza
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

  it('«Modifica» rifiutata: il testo torna quello di prima e il foglio dice l\'errore', async () => {
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Messaggio nuovo')
    await apriMenu('nuovo', 'Modifica')
    const area = await screen.findByLabelText('Testo del messaggio')
    finto.errori.tabelle = ['messaggi_coach']
    fireEvent.change(area, { target: { value: 'Messaggio corretto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(await screen.findByText(/Modifica non salvata/)).toBeTruthy()
    expect(document.getElementById('messaggio-nuovo').textContent).toContain('Messaggio nuovo')
    expect(screen.getByLabelText('Testo del messaggio').value).toBe('Messaggio corretto') // il lavoro non si perde
  })

  it('«Modifica» che non tocca nessuna riga: stesso rollback', async () => {
    montaPagina(<Messaggi />, { user: COACH, role: 'admin' })
    await screen.findByText('Messaggio nuovo')
    await apriMenu('nuovo', 'Modifica')
    const area = await screen.findByLabelText('Testo del messaggio')
    finto.dati.messaggi_coach = []
    fireEvent.change(area, { target: { value: 'Messaggio corretto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(await screen.findByText(/Modifica non salvata/)).toBeTruthy()
    expect(document.getElementById('messaggio-nuovo').textContent).toContain('Messaggio nuovo')
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

// «Prova su di me»: la push solo ai dispositivi del coach, senza salvare il
// messaggio (nessun atleta vede niente) e senza chiudere il foglio.
describe('Messaggi — prova su di me', () => {
  const prova = () => screen.getByRole('button', { name: 'Prova su di me' })

  it('manda il testo ripulito a send-reminders in modo prova, senza insert e senza conferma', async () => {
    await apriFoglio()
    fireEvent.change(campo(), { target: { value: 'Sabato ritrovo alle 8\n\n' } })
    fireEvent.click(prova())
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(1))
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('send-reminders', { body: { mode: 'broadcast_prova', testo: 'Sabato ritrovo alle 8' } })
    expect(finto.chiamateA('messaggi_coach', 'insert')).toHaveLength(0)
    expect(screen.queryByRole('dialog', { name: /Mandare a/ })).toBeNull()
    expect(await screen.findByText('Prova mandata ai tuoi dispositivi (2)')).toBeTruthy()
    // Il foglio resta aperto con il testo, e la bozza c'è ancora: dopo la prova si manda davvero.
    expect(campo().value).toBe('Sabato ritrovo alle 8\n\n')
    expect(JSON.parse(localStorage.getItem(CHIAVE_BOZZA))?.testo).toBe('Sabato ritrovo alle 8\n\n')
  })

  it('nessun dispositivo iscritto: lo dice', async () => {
    finto.supabase.functions.invoke.mockResolvedValueOnce({ data: { success: true, sent: 0 }, error: null })
    await apriFoglio()
    fireEvent.change(campo(), { target: { value: 'Ciao' } })
    fireEvent.click(prova())
    expect(await screen.findByText('Nessun tuo dispositivo ha le notifiche attive')).toBeTruthy()
  })

  it('prova fallita: lo dice', async () => {
    finto.supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'rete' } })
    await apriFoglio()
    fireEvent.change(campo(), { target: { value: 'Ciao' } })
    fireEvent.click(prova())
    expect(await screen.findByText('La prova non è partita. Controlla la connessione e riprova.')).toBeTruthy()
  })

  it('testo vuoto o account di prova: spento, e non parte niente', async () => {
    await apriFoglio()
    expect(prova().disabled).toBe(true)
    fireEvent.click(prova())
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('account di prova: spento anche con il testo', async () => {
    await apriFoglio({ ...COACH, email: 'demo@fleofit.it' })
    fireEvent.change(campo(), { target: { value: 'Ciao a tutti' } })
    expect(prova().disabled).toBe(true)
    fireEvent.click(prova())
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
  })
})
