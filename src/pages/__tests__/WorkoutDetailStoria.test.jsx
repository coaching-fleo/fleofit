import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questo test esiste
// ─────────────────────────
// La grafica da mettere sopra una storia ESCE dall'app, e quasi tutto ciò che
// può andarle storto non dà nessun errore:
//
//  1. 🔴 se qualcuno passa un `backgroundColor` a html-to-image — anche nero,
//     anche «per sicurezza» — il PNG smette di essere trasparente e non si può
//     più appoggiare sopra la propria foto. È l'intera ragione della funzione,
//     e il file esportato sembrerebbe perfetto a chiunque lo aprisse;
//  2. 🔴 se il nodo rasterizzato diventa quello dell'anteprima invece della
//     copia a misura vera, l'immagine esce riscalata: `transform: scale` su un
//     antenato cambia il rettangolo che il rasterizzatore misura;
//  3. l'RPE mostrato deve essere quello DICHIARATO dall'atleta, mai il 5 di
//     ripiego di `parseNotesAndRpe` (CLAUDE.md §9-octies);
//  4. 🔴 gli ESERCIZI devono esserci. È la sostanza della grafica — la prima
//     versione disegnava un profilo di sforzo, gradevole e illeggibile — e una
//     regressione qui lascerebbe una grafica perfettamente impaginata che non
//     dice più che cosa si è fatto.

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{
      id: 'w1', title: 'Hyrox Strength #1', date: '2026-08-28',
      coach_notes: '', sections: ctrl.stato.sections,
    }],
    athlete_workouts: ctrl.stato.assegnazioni,
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rinaldi' }],
  }))
})

const grafica = await vi.hoisted(async () => ({
  toPng: (await import('vitest')).vi.fn(() => Promise.resolve('data:image/png;base64,AAAA')),
  toBlob: (await import('vitest')).vi.fn(() => Promise.resolve(new Blob(['x'], { type: 'image/png' }))),
}))

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('jspdf', () => ({ default: class {}, jsPDF: class {} }))
vi.mock('html-to-image', () => grafica)
vi.mock('@capacitor/network', () => ({ Network: {
  getStatus: vi.fn(() => Promise.resolve({ connected: true })),
  addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
} }))

const { AuthContext } = await import('../../App')
const WorkoutDetail = (await import('../WorkoutDetail')).default
const { LARGHEZZA_STORIA, ALTEZZA_STORIA, FATTORE_STORIA } = await import('../../components/StoriaUI')

const HYROX = {
  category: 'Hyrox', intensity: '6',
  blocks: [
    { id: 'b1', type: 'WarmUp', params: { duration: '8:00' }, exercises: [] },
    { id: 'b2', type: 'EMOM', params: { interval: '1:00', rounds: '24' }, exercises: [
      { id: 'e1', name: 'Wall Balls', reps: '20', kg: '9', intensity: '9' },
    ] },
  ],
}

const assegnazione = (extra = {}) => ([{
  id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: '2026-08-30',
  status: 'completed', notes: '[RPE: 9/10]\nWall balls pesanti', voice_note_url: null,
  athletes: { id: 'u1', name: 'Marco', surname: 'Rinaldi', photo_url: null },
  ...extra,
}])

function apri({ ruolo = 'athlete', utente = 'u1' } = {}) {
  return render(
    <MemoryRouter initialEntries={['/workout/w1?athlete_id=u1']}>
      <AuthContext.Provider value={{ user: { id: utente, email: 'a@b.it', user_metadata: {} }, role: ruolo }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const attendi = () => waitFor(() =>
  expect(screen.getByRole('heading', { name: 'Hyrox Strength #1' })).toBeInTheDocument())

/** Il foglio, aperto dal quadrato della barra fissa. */
const apriFoglio = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Condividi come storia/i }))
  return screen.getByRole('dialog', { name: /Condividi come storia/i })
}

/** Il nodo a misura vera che html-to-image deve rasterizzare. */
const nodoEsportabile = () => document.querySelector('[data-grafica-storia]').firstElementChild

beforeEach(() => {
  ctrl.stato = { sections: HYROX, assegnazioni: assegnazione() }
  grafica.toPng.mockClear()
  grafica.toBlob.mockClear()
})

describe('il tasto di condivisione', () => {
  it('sta nella barra fissa dell’atleta che ha finito, e apre il foglio', async () => {
    apri()
    await attendi()
    const foglio = await apriFoglio()
    expect(foglio).toBeInTheDocument()
    expect(within(foglio).getByRole('button', { name: /^Salva$/ })).toBeInTheDocument()
    expect(within(foglio).getByRole('button', { name: /^Condividi$/ })).toBeInTheDocument()
  })

  it('c’è anche nel menu, per il coach che non ha una barra fissa così', async () => {
    apri({ ruolo: 'admin', utente: 'coach' })
    await attendi()
    await userEvent.click(screen.getByRole('button', { name: /Altre azioni/i }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Condividi come storia/ })).toBeInTheDocument()
  })

  it('non lascia la grafica nel DOM quando il foglio è chiuso', async () => {
    // È un albero di decine di nodi: tenerlo montato sempre lo farebbe pesare
    // su ogni apertura di scheda, che è il gesto più frequente dell'app.
    apri()
    await attendi()
    expect(document.querySelector('[data-grafica-storia]')).toBeNull()
    await apriFoglio()
    expect(document.querySelector('[data-grafica-storia]')).toBeInTheDocument()
  })
})

describe('quello che la grafica dice', () => {
  it('🔴 elenca gli esercizi, con le loro specifiche', async () => {
    apri()
    await attendi()
    const nodo = within((await apriFoglio(), nodoEsportabile()))
    expect(nodo.getByText('Wall Balls')).toBeInTheDocument()
    expect(nodo.getByText(/20 reps/)).toBeInTheDocument()
    expect(nodo.getByText(/9 kg/)).toBeInTheDocument()
    // L'intestazione del blocco porta i suoi parametri, che vengono da
    // `parametriBlocco`: i ripieghi vivono in un punto solo.
    expect(nodo.getByText('EMOM')).toBeInTheDocument()
    expect(nodo.getByText(/ogni 1:00 × 24/)).toBeInTheDocument()
  })

  it('il riscaldamento c’è, e dice la sua durata', async () => {
    apri()
    await attendi()
    const nodo = within((await apriFoglio(), nodoEsportabile()))
    expect(nodo.getByText('WarmUp')).toBeInTheDocument()
    expect(nodo.getByText('8:00')).toBeInTheDocument()
  })

  it('porta l’RPE DICHIARATO dall’atleta, non quello atteso', async () => {
    apri()
    await attendi()
    const nodo = within((await apriFoglio(), nodoEsportabile()))
    expect(nodo.getByText('9')).toBeInTheDocument()
    expect(nodo.getByText('RPE')).toBeInTheDocument()
    // La data è quella del completamento, non quella in programma.
    expect(nodo.getByText(/dom 30 ago/i)).toBeInTheDocument()
  })

  it('senza RPE dichiarato NON scrive 5, e cambia etichetta', async () => {
    // 🔴 `parseNotesAndRpe` torna 5 quando il marcatore manca. Su una grafica
    // pubblicata quel 5 verrebbe letto come una misura dell'atleta.
    ctrl.stato.assegnazioni = assegnazione({ notes: 'nessun marcatore qui' })
    apri()
    await attendi()
    const nodo = within((await apriFoglio(), nodoEsportabile()))
    expect(nodo.queryByText('RPE')).not.toBeInTheDocument()
    expect(nodo.getByText('Intensità')).toBeInTheDocument()
    expect(nodo.getByText('6')).toBeInTheDocument()
    expect(nodo.queryByText('5')).not.toBeInTheDocument()
  })

  it('dichiara la durata come stima, non come cronometro', async () => {
    apri()
    await attendi()
    const nodo = within((await apriFoglio(), nodoEsportabile()))
    expect(nodo.getByText('≈')).toBeInTheDocument()
    expect(nodo.getByText('32')).toBeInTheDocument()
    expect(nodo.getByText('min')).toBeInTheDocument()
  })
})

describe('l’esportazione', () => {
  it('🔴 NON passa nessun colore di sfondo: è ciò che tiene il PNG trasparente', async () => {
    apri()
    await attendi()
    const foglio = await apriFoglio()
    await userEvent.click(within(foglio).getByRole('button', { name: /^Salva$/ }))

    await waitFor(() => expect(grafica.toBlob).toHaveBeenCalled())
    const [, opzioni] = grafica.toBlob.mock.calls[0]
    // Un `backgroundColor` qui — anche nero, anche «per sicurezza» — renderebbe
    // il file un rettangolo opaco: appoggiarlo sopra la propria storia
    // coprirebbe il video. Nessun errore, nessun test rotto, funzione inutile.
    expect(opzioni).not.toHaveProperty('backgroundColor')
    expect(opzioni.pixelRatio).toBe(FATTORE_STORIA)
    expect(opzioni.width).toBe(LARGHEZZA_STORIA)
    expect(opzioni.height).toBe(ALTEZZA_STORIA)
  })

  it('🔴 rasterizza il nodo a misura vera, non l’anteprima riscalata', async () => {
    apri()
    await attendi()
    const foglio = await apriFoglio()
    await userEvent.click(within(foglio).getByRole('button', { name: /^Salva$/ }))

    await waitFor(() => expect(grafica.toBlob).toHaveBeenCalled())
    const [nodo] = grafica.toBlob.mock.calls[0]
    // L'anteprima vive dentro un `transform: scale`, che cambia il rettangolo
    // che html-to-image misura: l'immagine uscirebbe della misura sbagliata
    // senza dare alcun errore.
    expect(nodo).toBe(nodoEsportabile())
    expect(nodo.closest('[data-grafica-storia]')).not.toBeNull()
    expect(foglio.contains(nodo)).toBe(false)
  })

  it('🔴 lo sticker resta semitrasparente e con gli angoli tondi', async () => {
    apri()
    await attendi()
    await apriFoglio()
    const stile = nodoEsportabile().style

    // La carta lascia intravedere la foto sotto: è ciò che la fa leggere come
    // uno sticker appoggiato invece che come un rettangolo incollato. Un fondo
    // opaco qui darebbe un file che si apre benissimo e che sopra una storia
    // copre il video — lo stesso difetto del `backgroundColor` all'export,
    // solo commesso un livello più su.
    const alfe = [...stile.background.matchAll(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/g)]
      .map(m => parseFloat(m[1]))
    expect(alfe.length).toBeGreaterThan(0)
    expect(Math.max(...alfe)).toBeLessThan(1)

    // Gli angoli tondi sono l'altra metà: fuori dal raggio il PNG è vuoto.
    expect(parseInt(stile.borderRadius, 10)).toBeGreaterThan(10)
  })

  it('la storia con lo sfondo invece dipinge davvero il fondo', async () => {
    apri()
    await attendi()
    const foglio = await apriFoglio()
    await userEvent.click(within(foglio).getByRole('button', { name: /Con sfondo/i }))
    // Lo stesso componente, non un secondo: ciò che si vede e ciò che si
    // esporta devono restare la stessa cosa.
    // jsdom normalizza gli esadecimali in `rgb()`: si verifica che il fondo
    // sia OPACO, che è la proprietà, non come è scritto.
    const fondo = nodoEsportabile().style.background
    expect(fondo).toMatch(/rgb\(27, ?27, ?32\)/)
    expect(fondo).not.toMatch(/rgba\(0, ?0, ?0, ?0\)/)
    expect(nodoEsportabile().style.height).toBe(`${ALTEZZA_STORIA}px`)
  })

  it('🔴 esporta l’altezza MISURATA sul nodo, non un 9:16 dato per scontato', async () => {
    apri()
    await attendi()
    const foglio = await apriFoglio()

    // jsdom non calcola il layout, quindi `offsetHeight` vale 0: lo si finge
    // sul nodo vero, che è esattamente ciò che il WebView riporterebbe su uno
    // sticker ritagliato sul contenuto.
    Object.defineProperty(nodoEsportabile(), 'offsetHeight', { value: 487, configurable: true })
    await userEvent.click(within(foglio).getByRole('button', { name: /^Salva$/ }))

    await waitFor(() => expect(grafica.toBlob).toHaveBeenCalled())
    const [, opzioni] = grafica.toBlob.mock.calls[0]
    // 🔴 Con 640 fisso, sopra e sotto il contenuto tornerebbe il margine
    // trasparente che Instagram conta quando scala la grafica: si appoggia lo
    // sticker grande e il testo resta piccolo.
    expect(opzioni.height).toBe(487)
    expect(opzioni.height).not.toBe(ALTEZZA_STORIA)
  })

  it('ma un nodo che si misura zero non produce un file vuoto', async () => {
    // In un ambiente che non calcola il layout `offsetHeight` è 0, e un PNG
    // alto zero non è un errore che qualcuno noterebbe: è un file che si apre
    // e non contiene niente.
    apri()
    await attendi()
    const foglio = await apriFoglio()
    await userEvent.click(within(foglio).getByRole('button', { name: /^Salva$/ }))

    await waitFor(() => expect(grafica.toBlob).toHaveBeenCalled())
    expect(grafica.toBlob.mock.calls[0][1].height).toBe(ALTEZZA_STORIA)
  })
})
