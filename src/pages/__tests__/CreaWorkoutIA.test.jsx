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

// Il ramo NATIVO: `src/test/setup.js` finge sempre «web», e il percorso
// «fermo la registrazione → Gemini ascolta» esiste SOLO lì. Va acceso a mano,
// come fa `LoginApple.test.jsx`.
let mockNativo = false

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockNativo,
    getPlatform: () => (mockNativo ? 'ios' : 'web'),
  },
  registerPlugin: () => new Proxy({}, { get: () => vi.fn(() => Promise.resolve({ value: null })) }),
  WebPlugin: class {},
}))

vi.mock('@independo/capacitor-voice-recorder', () => ({
  VoiceRecorder: {
    requestAudioRecordingPermission: () => Promise.resolve({ value: true }),
    startRecording: () => Promise.resolve({ value: true }),
    stopRecording: () => Promise.resolve({
      value: { msDuration: 1200, recordDataBase64: 'AAAA', mimeType: 'audio/aac' },
    }),
  },
}))

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
  // ⚠️ Lo stesso stub serve DUE disegni diversi: la forma d'onda e l'orb
  // dell'attesa (`thinking-orbs`, che è anch'esso un canvas). Il secondo
  // aggiunge `setTransform`, `arc`, `moveTo`/`lineTo`/`stroke` — e il suo
  // primo fotogramma è sincrono dentro l'effetto, quindi un metodo mancante
  // qui non è un orb disegnato male: è un'eccezione che porta giù il foglio.
  window.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, fill: () => {}, rect: () => {}, roundRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    setTransform: () => {}, arc: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
  })
}

const finteTracce = () => ({ getTracks: () => [{ stop: vi.fn() }] })

beforeEach(() => {
  localStorage.clear()
  ambienteAudio()
  mockNativo = false
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
    //
    // ⚠️ Dal 15/09 l'entrata non sta più sul nodo `role="dialog"`: è salita sul
    // fascio di `border-beam` che lo avvolge (§9-duetricies). NON è una
    // scorciatoia per far passare il test — è la condizione perché la cornice
    // luminosa scenda INSIEME al foglio invece di restare sospesa nel vuoto
    // mentre il foglio si abbassa sotto il dito.
    const animato = foglio.parentElement
    expect(animato.className).toContain('sheet-in')
    expect(animato.className).not.toContain('animate-in')
    expect(foglio.className).not.toContain('animate-in')
  })

  it('toccare DENTRO il foglio non lo chiude', async () => {
    // ⚠️ Dal 15/09 lo `stopPropagation` non sta più sul nodo `role="dialog"`:
    // è sul fascio di `border-beam` che lo avvolge, e ci arriva come prop di
    // passaggio. Se una versione futura della libreria smettesse di inoltrare
    // le props HTML, il gesto più comune di questa superficie — toccare il
    // campo per scrivere — chiuderebbe il foglio. Nessun errore, nessun log.
    const foglio = await apriIA()
    await userEvent.click(within(foglio).getByRole('textbox'))
    await new Promise(r => setTimeout(r, 450))
    expect(screen.getByRole('dialog', { name: 'Genera con IA' })).toBeInTheDocument()
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

describe('l\'attesa dice QUALE dei due lavori sta facendo', () => {
  // L'anello CSS che girava non diceva niente: era lo stesso identico disco
  // sia che Gemini stesse ASCOLTANDO una registrazione sia che stesse
  // leggendo un testo. Sono due lavori diversi, la riga sotto lo diceva già a
  // parole, e ora lo dice anche la figura — che è tutto quello che si guarda
  // mentre si aspetta.
  //
  // ⚠️ L'orb è un canvas: `aria-hidden` lo toglie dall'albero di
  // accessibilità, quindi si interroga il DOM e non i ruoli.
  const orbDi = (foglio) => foglio.querySelector('canvas[aria-label]')

  it('partendo dal TESTO scrive, e non aggiunge una seconda voce sopra il «role=status»', async () => {
    mockRispostaIA = () => new Promise(() => {})

    const foglio = await apriIA()
    await userEvent.type(within(foglio).getByRole('textbox'), 'emom da 12 minuti')
    await userEvent.click(screen.getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(screen.getByText(/Sto scrivendo l'allenamento/)).toBeInTheDocument())

    expect(orbDi(foglio)).toHaveAttribute('aria-label', 'Scrivo i blocchi')

    // 🔴 Senza `aria-hidden` il canvas si presenta come `role="img"` con
    // un'etichetta che la libreria si mette DA SOLA, e in inglese
    // («Composing…»): VoiceOver leggerebbe una parola inglese sopra la riga
    // italiana che ha già `role="status"`, e la leggerebbe per prima.
    expect(within(foglio).queryByRole('img')).toBeNull()
  })

  it('partendo dalla VOCE ascolta, perché prima di scrivere c\'è una registrazione da sentire', async () => {
    mockNativo = true
    mockRispostaIA = () => new Promise(() => {})
    navigator.mediaDevices = { getUserMedia: () => Promise.resolve(finteTracce()) }

    const foglio = await apriIA()
    await userEvent.click(within(foglio).getByRole('button', { name: /Detta l'allenamento/ }))
    await waitFor(() => expect(within(foglio).getByText(/Parla pure/)).toBeInTheDocument())

    await userEvent.click(within(foglio).getByRole('button', { name: /Ho finito, genera/ }))
    await waitFor(() => expect(screen.getByText(/Sto scrivendo l'allenamento/)).toBeInTheDocument())

    expect(orbDi(foglio)).toHaveAttribute('aria-label', 'Ascolto la registrazione')
  })
})

describe('con dei blocchi già scritti, il foglio MODIFICA invece di aggiungere', () => {
  // Richiesta del committente (12/10/2026): «se ci sono blocchi, anche creati
  // a mano, se chiedo una modifica me la deve fare». Prima ogni risposta
  // dell'IA finiva IN CODA: chiedere «togli il Cash Out» aggiungeva un blocco.

  /** Prima generazione (lista vuota), poi riapre il foglio con un blocco dentro. */
  async function conUnBlocco() {
    mockRispostaIA = () => Promise.resolve({
      data: { blocks: [{ type: 'EMOM', params: { interval: '1:00', rounds: '12' }, exercises: [{ name: 'Burpees', reps: '15' }] }] },
      error: null,
    })
    const foglio = await apriIA()
    await userEvent.type(within(foglio).getByRole('textbox'), 'emom da 12')
    await userEvent.click(screen.getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())
    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
  }

  it('manda i blocchi attuali, senza id, e sostituisce la lista con quella modificata', async () => {
    await conUnBlocco()
    expect(screen.getByText('Chiedi una modifica ai blocchi che hai')).toBeInTheDocument()

    const invoca = vi.fn(() => Promise.resolve({
      data: { blocks: [{ type: 'AMRAP', params: { duration: '10:00' }, exercises: [{ name: 'Wall Balls', reps: '20' }] }], modifica: true },
      error: null,
    }))
    mockRispostaIA = invoca
    await userEvent.click(screen.getByRole('button', { name: /Genera con IA/ }))
    const foglio = screen.getByRole('dialog', { name: 'Genera con IA' })
    await userEvent.type(within(foglio).getByRole('textbox'), 'trasforma in amrap')
    await userEvent.click(within(foglio).getByRole('button', { name: /Modifica workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())

    // `attuali` dal 12/10/2026 (prima `blocchiAttuali`, che il server legge ancora).
    const corpo = invoca.mock.calls[0][1].body
    expect(corpo.categoria).toBe('Hyrox')
    expect(corpo.attuali).toHaveLength(1)
    expect(corpo.attuali[0].type).toBe('EMOM')
    expect(corpo.attuali[0].id).toBeUndefined()
    expect(corpo.attuali[0].exercises[0].id).toBeUndefined()

    // Sostituita, non aggiunta in coda.
    expect(screen.queryAllByText(/EMOM/)).toHaveLength(0)
    expect(screen.getAllByText(/AMRAP/).length).toBeGreaterThan(0)

    // E si torna indietro.
    await userEvent.click(screen.getByRole('button', { name: /Annulla/ }))
    expect(screen.queryAllByText(/AMRAP/)).toHaveLength(0)
    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
  })

  it('se il server non dice «modifica» (funzione vecchia), aggiunge e NON cancella niente', async () => {
    await conUnBlocco()
    mockRispostaIA = () => Promise.resolve({
      data: { blocks: [{ type: 'AMRAP', params: { duration: '10:00' }, exercises: [] }] },
      error: null,
    })
    await userEvent.click(screen.getByRole('button', { name: /Genera con IA/ }))
    const foglio = screen.getByRole('dialog', { name: 'Genera con IA' })
    await userEvent.type(within(foglio).getByRole('textbox'), 'aggiungi amrap')
    await userEvent.click(within(foglio).getByRole('button', { name: /Modifica workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())

    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AMRAP/).length).toBeGreaterThan(0)
  })
})

describe("i blocchi scritti dall'IA arrivano APERTI", () => {
  // Richiesta del committente (12/10/2026): dopo una generazione i blocchi
  // erano tutti chiusi tranne l'ultimo, e il coach li apriva uno per uno per
  // rileggerli. Ogni blocco aperto ha il suo bottone «Esercizio».
  const aperti = () => screen.queryAllByRole('button', { name: /^Esercizio$/ }).length

  it('generando, si aprono tutti i blocchi nuovi', async () => {
    mockRispostaIA = () => Promise.resolve({
      data: { blocks: [
        { type: 'Cash In', params: { rounds: '1' }, exercises: [{ name: 'Rowing', meters: '500m' }] },
        { type: 'EMOM', params: { interval: '1:00', rounds: '12' }, exercises: [{ name: 'Burpees', reps: '15' }] },
        { type: 'AMRAP', params: { duration: '10:00' }, exercises: [{ name: 'Wall Balls', reps: '20' }] },
      ] },
      error: null,
    })
    const foglio = await apriIA()
    await userEvent.type(within(foglio).getByRole('textbox'), 'tre blocchi')
    await userEvent.click(screen.getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())
    expect(aperti()).toBe(3)
  })

  it('chiuderne uno lascia aperti gli altri; aprirne uno a mano resta una fisarmonica', async () => {
    mockRispostaIA = () => Promise.resolve({
      data: { blocks: [
        { type: 'EMOM', params: { interval: '1:00', rounds: '12' }, exercises: [] },
        { type: 'AMRAP', params: { duration: '10:00' }, exercises: [] },
      ] },
      error: null,
    })
    const foglio = await apriIA()
    await userEvent.type(within(foglio).getByRole('textbox'), 'due blocchi')
    await userEvent.click(screen.getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(aperti()).toBe(2))

    const testata = (tipo) => screen.getAllByText(tipo).find(el => el.hasAttribute('data-tipo-blocco'))
    await userEvent.click(testata('EMOM'))
    expect(aperti()).toBe(1)
    await userEvent.click(testata('EMOM'))
    expect(aperti()).toBe(1)
  })

  it("una MODIFICA apre tutto l'allenamento riscritto", async () => {
    mockRispostaIA = () => Promise.resolve({
      data: { blocks: [{ type: 'EMOM', params: { interval: '1:00', rounds: '12' }, exercises: [] }] },
      error: null,
    })
    const foglio = await apriIA()
    await userEvent.type(within(foglio).getByRole('textbox'), 'emom')
    await userEvent.click(screen.getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())

    mockRispostaIA = () => Promise.resolve({
      data: { blocks: [
        { type: 'EMOM', params: { interval: '1:00', rounds: '16' }, exercises: [] },
        { type: 'Cash Out', params: { rounds: '1' }, exercises: [] },
      ], modifica: true },
      error: null,
    })
    await userEvent.click(screen.getByRole('button', { name: /Genera con IA/ }))
    const foglio2 = screen.getByRole('dialog', { name: 'Genera con IA' })
    await userEvent.type(within(foglio2).getByRole('textbox'), 'aggiungi cash out')
    await userEvent.click(within(foglio2).getByRole('button', { name: /Modifica workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())
    expect(aperti()).toBe(2)
  })
})

describe('«Genera con IA» in OGNI categoria (12/10/2026)', () => {
  // Regola del committente: la creazione con IA su tutte le categorie, anche
  // quelle che verranno. Le categorie si leggono dal sorgente: una nuova fa
  // fallire questo test finché il suo passo 2 non mostra la card.
  const nomi = async () => {
    const sorgente = (await import('../CreateWorkout.jsx?raw')).default
    const blocco = sorgente.match(/const CATEGORIE = \[([\s\S]*?)\n\]/)[1]
    return [...blocco.matchAll(/nome:\s*'([^']+)'/g)].map(m => m[1])
  }

  async function alPasso2(nome) {
    render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: new RegExp(nome) }))
    await userEvent.type(screen.getByLabelText('Nome del workout'), 'Prova')
    await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
  }

  it('il passo 2 di ogni categoria ha la card', async () => {
    const tutte = await nomi()
    expect(tutte.length).toBeGreaterThanOrEqual(3)
    for (const nome of tutte) {
      const { unmount } = render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
      await userEvent.click(screen.getByRole('button', { name: new RegExp(nome) }))
      await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
      expect(screen.getByRole('button', { name: /Genera con IA/ }), nome).toBeInTheDocument()
      unmount()
      localStorage.clear()
    }
  })

  it('sulla Corsa chiede FASI, e le fasi arrivano nel builder', async () => {
    const invoca = vi.fn(() => Promise.resolve({
      data: {
        categoria: 'Running', modifica: false,
        steps: [{ type: 'repeat', rounds: '8', runDuration: '400m', runPace: '3:45 /km', recDuration: '1 min', recPace: 'Camminata' }],
      },
      error: null,
    }))
    mockRispostaIA = invoca
    await alPasso2('Corsa')
    expect(screen.getByText('Descrivi la seduta, ti scrivo le fasi')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Genera con IA/ }))
    const foglio = screen.getByRole('dialog', { name: 'Genera con IA' })
    await userEvent.type(within(foglio).getByRole('textbox'), '8 per 400')
    await userEvent.click(within(foglio).getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())

    expect(invoca.mock.calls[0][1].body).toMatchObject({ categoria: 'Running', prompt: '8 per 400' })
    expect(screen.queryByText('Aggiungi la prima fase')).toBeNull()
    expect(screen.getAllByText(/400m/).length).toBeGreaterThan(0)
    // Con le fasi dentro, la card propone di modificarle.
    expect(screen.getByText('Chiedi una modifica alle fasi che hai')).toBeInTheDocument()
  })

  it('una funzione non aggiornata (blocchi Hyrox) NON finisce dentro una Corsa', async () => {
    mockRispostaIA = () => Promise.resolve({
      data: { blocks: [{ type: 'EMOM', params: {}, exercises: [] }] }, error: null,
    })
    // Nei test l'host degli avvisi non è montato: `mostraAlert` lo dice con un warn.
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await alPasso2('Corsa')
    await userEvent.click(screen.getByRole('button', { name: /Genera con IA/ }))
    const foglio = screen.getByRole('dialog', { name: 'Genera con IA' })
    await userEvent.type(within(foglio).getByRole('textbox'), '8 per 400')
    await userEvent.click(within(foglio).getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(avviso).toHaveBeenCalledWith('AlertHost non montato:',
      expect.objectContaining({ message: expect.stringMatching(/non è ancora attiva sul server/) })))
    avviso.mockRestore()
    expect(screen.getByText('Aggiungi la prima fase')).toBeInTheDocument()
  })

  it('su Custom scrive la descrizione, e una modifica si può annullare', async () => {
    mockRispostaIA = () => Promise.resolve({
      data: { categoria: 'Custom', modifica: false, testo: '4 giri: 10 affondi, 15 push up' }, error: null,
    })
    await alPasso2('Custom')
    await userEvent.click(screen.getByRole('button', { name: /Genera con IA/ }))
    let foglio = screen.getByRole('dialog', { name: 'Genera con IA' })
    await userEvent.type(within(foglio).getByRole('textbox'), 'circuito')
    await userEvent.click(within(foglio).getByRole('button', { name: /Genera workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())
    expect(screen.getByDisplayValue('4 giri: 10 affondi, 15 push up')).toBeInTheDocument()

    const invoca = vi.fn(() => Promise.resolve({
      data: { categoria: 'Custom', modifica: true, testo: '5 giri: 10 affondi, 15 push up' }, error: null,
    }))
    mockRispostaIA = invoca
    await userEvent.click(screen.getByRole('button', { name: /Genera con IA/ }))
    foglio = screen.getByRole('dialog', { name: 'Genera con IA' })
    await userEvent.type(within(foglio).getByRole('textbox'), '5 giri')
    await userEvent.click(within(foglio).getByRole('button', { name: /Modifica workout/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Genera con IA' })).toBeNull())

    expect(invoca.mock.calls[0][1].body.attuali).toBe('4 giri: 10 affondi, 15 push up')
    expect(screen.getByDisplayValue('5 giri: 10 affondi, 15 push up')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Annulla/ }))
    expect(screen.getByDisplayValue('4 giri: 10 affondi, 15 push up')).toBeInTheDocument()
  })
})
