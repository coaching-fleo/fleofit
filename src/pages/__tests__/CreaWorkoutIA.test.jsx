import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Perché questi test esistono
// ────────────────────────────
// Il rifacimento di «Genera con IA» (28/08/2026) chiude tre difetti che NON
// danno errore — né a schermo, né nei log — e che quindi solo un test prende:
//
//   1. l'entrata del foglio era `animate-in fade-in zoom-in-[0.96]`, cioè
//      tw-animate-css, che NON è installato: zero CSS generato, animazione mai
//      vista da nessuno (CLAUDE.md §9-duodecies punto 1). Rimetterla non
//      romperebbe niente: smetterebbe solo di animare, in silenzio;
//   2. l'`autoFocus` sul textarea apriva la tastiera su una superficie il cui
//      gesto principale è il microfono;
//   3. l'alone del microfono pulsava su `Math.random()`, quindi diceva «ti
//      sento» anche a microfono muto o permesso negato. Ora i livelli vengono
//      dallo stream vero, e senza stream la forma d'onda NON si finge.

// La risposta di `ai-workout`, sostituibile dal singolo test: serve a tenere
// la generazione IN CORSO e guardare cosa dice il foglio mentre si aspetta.
let mockRispostaIA = () => Promise.resolve({ data: { blocks: [] }, error: null })

vi.mock('../../supabaseClient', () => {
  const catena = {
    select: () => catena,
    eq: () => catena,
    order: () => catena,
    limit: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  return {
    supabase: {
      from: () => catena,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      functions: { invoke: (...a) => mockRispostaIA(...a) },
    },
  }
})

const CreateWorkout = (await import('../CreateWorkout')).default

// ── L'ambiente che jsdom non ha ───────────────────────────────────────────
// AudioContext e il contesto 2D del canvas non esistono in jsdom: senza, il
// disegno della forma d'onda lancia DENTRO un requestAnimationFrame, cioè fuori
// dallo stack del test, e il test fallisce per un motivo che non c'entra.
// Quanto «suona» il microfono finto, 0..255, e su QUANTE bande.
//
// 🔴 Le bande contano quanto il volume. Una voce vera non riempie lo spettro:
// sta nelle prime bande e lascia a zero tutte le altre. Un finto microfono che
// suona su TUTTE le bande ha una media alta, quindi passa anche con la logica
// sbagliata — ed è esattamente il difetto segnalato il 28/08/2026, «l'avviso
// compare anche se il suono viene preso». Con 70 su 4 bande di 24 la media è
// 0,046 (sotto la vecchia soglia di 0,05: falso allarme) e il picco è 0,27.
let mockVolume = 0
let mockBande = 4

function ambienteAudio() {
  window.AudioContext = class {
    constructor() { this.state = 'running' }
    createAnalyser() {
      return {
        fftSize: 0, frequencyBinCount: 32, connect: () => {},
        getByteFrequencyData: (arr) => { arr.fill(0); arr.fill(mockVolume, 0, mockBande) },
      }
    }
    createMediaStreamSource() { return { connect: () => {} } }
    close() { this.state = 'closed'; return Promise.resolve() }
  }
  // ⚠️ Il primo `draw()` è SINCRONO dentro l'effetto: un metodo che manca qui
  // non è un disegno sbagliato, è un'eccezione che porta giù il componente e
  // fa fallire il test con «non trovo Parla pure». Successo con
  // `createLinearGradient`.
  window.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, fill: () => {}, rect: () => {}, roundRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  })
}

const finteTracce = () => ({ getTracks: () => [{ stop: vi.fn() }] })

beforeEach(() => {
  localStorage.clear()
  ambienteAudio()
  mockVolume = 0
  mockBande = 4
  mockRispostaIA = () => Promise.resolve({ data: { blocks: [] }, error: null })
})
afterEach(() => {
  delete navigator.mediaDevices
  delete window.SpeechRecognition
})

/** Arriva allo step 2 e apre il foglio dell'IA. */
async function apriIA() {
  render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
  await userEvent.type(screen.getByLabelText('Nome del workout'), 'Prova')
  await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
  await userEvent.click(screen.getByRole('button', { name: /Genera con IA/ }))
  return screen.getByRole('dialog', { name: 'Genera con IA' })
}

/** Un riconoscimento vocale finto: il ramo web è l'unico che i test eseguono. */
function finteOrecchie() {
  const istanza = { start: vi.fn(), stop: vi.fn(), lang: '', continuous: false, interimResults: false }
  window.SpeechRecognition = function () { return istanza }
  return istanza
}

describe('il foglio «Genera con IA»', () => {
  it('entra con un\'animazione che ESISTE, non con una classe che genera zero CSS', async () => {
    const foglio = await apriIA()
    // `.sheet-in` è un keyframe scritto in src/index.css. `animate-in` viene da
    // tw-animate-css, che non è installato: è il difetto, non l'alternativa.
    expect(foglio.className).toContain('sheet-in')
    expect(foglio.className).not.toContain('animate-in')
  })

  it('non apre la tastiera da solo: il campo non prende il fuoco', async () => {
    const foglio = await apriIA()
    // ⚠️ Scoped al foglio: la pagina sotto ha già il textarea delle note coach.
    const campo = within(foglio).getByRole('textbox')
    expect(campo).not.toHaveAttribute('autofocus')
    expect(document.activeElement).not.toBe(campo)
  })

  it('si chiude trascinando la maniglia, che è un bersaglio e non un ornamento', async () => {
    await apriIA()
    const maniglia = screen.getByRole('button', { name: 'Chiudi' })
    expect(maniglia.tagName).toBe('BUTTON')
    await userEvent.click(maniglia)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())
  })
})

describe('la dettatura fa vedere che la voce arriva', () => {
  it('apre il microfono e mostra la forma d\'onda alimentata dallo stream', async () => {
    finteOrecchie()
    const getUserMedia = vi.fn(() => Promise.resolve(finteTracce()))
    navigator.mediaDevices = { getUserMedia }

    const foglio = await apriIA()
    await userEvent.click(screen.getByRole('button', { name: /Detta/ }))

    // Il microfono si apre DAVVERO: è la differenza fra una forma d'onda e
    // un'animazione che gira comunque.
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    await waitFor(() => expect(foglio.querySelector('canvas')).toBeTruthy())
    expect(screen.getByText(/Parla pure|Ti sento/)).toBeInTheDocument()
  })

  it('senza analizzatore NON finge l\'onda, ma non lascia lo schermo muto', async () => {
    finteOrecchie()
    navigator.mediaDevices = { getUserMedia: vi.fn(() => Promise.reject(new Error('negato'))) }

    const foglio = await apriIA()
    await userEvent.click(screen.getByRole('button', { name: /Detta/ }))

    // Niente canvas — non c'è nessun livello da disegnare — ma la registrazione
    // resta leggibile: il cronometro è l'unica cosa vera che rimane, e senza di
    // lui il foglio direbbe soltanto «non funziona».
    await waitFor(() => expect(screen.getByText(/Parla pure|Ti sento/)).toBeInTheDocument())
    expect(foglio.querySelector('canvas')).toBeNull()
    expect(within(foglio).getByText('0:00')).toBeInTheDocument()
  })

  it('se non arriva NESSUN suono lo dice, invece di lasciare l\'onda piatta', async () => {
    // 🔴 Un'onda ferma si legge come «sto zitto io», mai come «il microfono non
    // riceve». È la differenza fra accorgersene subito e accorgersene dal
    // workout generato a caso.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    try {
      finteOrecchie()
      navigator.mediaDevices = { getUserMedia: vi.fn(() => Promise.resolve(finteTracce())) }

      render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
      await utente.type(screen.getByLabelText('Nome del workout'), 'Prova')
      await utente.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
      await utente.click(screen.getByRole('button', { name: /Genera con IA/ }))
      await utente.click(screen.getByRole('button', { name: /Detta/ }))
      await waitFor(() => expect(screen.getByText(/Parla pure/)).toBeInTheDocument())

      expect(screen.queryByText(/Non arriva nessun suono/)).toBeNull()
      await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
      expect(screen.getByText(/Non arriva nessun suono/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('quando la voce arriva davvero, l\'avviso NON compare e lo dice', async () => {
    // Il complemento del test qui sopra, e serve due volte: da solo, quello
    // passa anche se il livello non viene mai riconosciuto — è già in silenzio.
    // E il volume qui è quello di una voce NORMALE su quattro bande, non un
    // tono che riempie lo spettro: è il caso che il difetto colpiva.
    mockVolume = 70
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    try {
      finteOrecchie()
      navigator.mediaDevices = { getUserMedia: vi.fn(() => Promise.resolve(finteTracce())) }

      render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
      await utente.type(screen.getByLabelText('Nome del workout'), 'Prova')
      await utente.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
      await utente.click(screen.getByRole('button', { name: /Genera con IA/ }))
      await utente.click(screen.getByRole('button', { name: /Detta/ }))

      await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
      expect(screen.queryByText(/Non arriva nessun suono/)).toBeNull()
      expect(screen.getByText('Ti sento')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('una voce PIANA non fa scattare l\'accusa al microfono', async () => {
    // 🔴 Il caso esatto del difetto: un segnale che c'è ma è tranquillo. Con
    // una soglia sola — quella che accende «Ti sento» — l'app accusava il
    // microfono mentre lo stava sentendo. L'asticella dell'avviso va dove la
    // mette un guasto vero, non dove la mette chi parla a voce bassa.
    mockVolume = 40
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    try {
      finteOrecchie()
      navigator.mediaDevices = { getUserMedia: vi.fn(() => Promise.resolve(finteTracce())) }

      render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
      await utente.type(screen.getByLabelText('Nome del workout'), 'Prova')
      await utente.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
      await utente.click(screen.getByRole('button', { name: /Genera con IA/ }))
      await utente.click(screen.getByRole('button', { name: /Detta/ }))

      await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
      expect(screen.queryByText(/Non arriva nessun suono/)).toBeNull()
      // Troppo piano per l'etichetta, abbastanza per sapere che il microfono
      // è vivo: sono due domande diverse, e questa è la prova che restano tali.
      expect(screen.getByText('Parla pure…')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('fermata la registrazione, il foglio dice di aspettare', () => {
  it('la generazione occupa il foglio, e la CTA sparisce invece di spegnersi', async () => {
    // Una risposta che non arriva mai: è l'unico modo di guardare l'attesa.
    mockRispostaIA = () => new Promise(() => {})

    const foglio = await apriIA()
    await userEvent.type(within(foglio).getByRole('textbox'), 'emom da 12 minuti')
    await userEvent.click(screen.getByRole('button', { name: /Genera workout/ }))

    await waitFor(() => expect(screen.getByText(/Sto scrivendo l'allenamento/)).toBeInTheDocument())
    // 🔴 Il difetto era proprio questo: un bottone spento accanto a un'attesa
    // si legge come «non ha funzionato», e il gesto che ne segue è rifare tutto.
    expect(screen.queryByRole('button', { name: /Genera workout/ })).toBeNull()
    expect(screen.getByText(/Non chiudere/i)).toBeInTheDocument()
  })

  it('durante la generazione il foglio non si chiude per sbaglio', async () => {
    mockRispostaIA = () => new Promise(() => {})

    const foglio = await apriIA()
    await userEvent.type(within(foglio).getByRole('textbox'), 'emom da 12 minuti')
    await userEvent.click(screen.getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(screen.getByText(/Sto scrivendo l'allenamento/)).toBeInTheDocument())

    // Chiudere qui butterebbe via una registrazione già spedita, in silenzio.
    await userEvent.click(screen.getByRole('button', { name: 'Generazione in corso' }))
    // ⚠️ L'uscita del foglio è un'animazione: `chiudi()` avvisa il chiamante
    // solo 300ms dopo. Senza questa attesa il test passava anche con la
    // maniglia attiva — verificava che il foglio non fosse sparito ISTANTE
    // ZERO, cioè niente (§9-sexies, per l'ennesima volta).
    await new Promise(r => setTimeout(r, 450))
    expect(screen.getByRole('dialog', { name: 'Genera con IA' })).toBeInTheDocument()
  })
})
