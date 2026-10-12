import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// «Da un'immagine» (12/10/2026): il bottone del builder apre SUBITO il
// selettore, e l'immagine scelta diventa blocchi senza IA. L'OCR vero è
// nativo e qui non gira: si simula il plugin. Le regole del lettore hanno i
// loro test; qui si verifica il passaggio al builder, che è dove si può perdere
// qualcosa in silenzio — un blocco sostituito senza poter tornare indietro, una
// riga non capita che non arriva nelle note.

let mockDisponibile = true
let mockLetto = () => Promise.resolve('')

vi.mock('../../lib/lettoreTesto', () => ({
  fotoDisponibile: () => mockDisponibile,
  leggiFoto: (...a) => mockLetto(...a),
}))
// jsdom non ha un canvas vero: la riduzione si salta.
vi.mock('../../lib/immagineRidotta', () => ({
  riduciImmagine: () => Promise.resolve({ nome: 'foto.jpg', base64: 'AAAA' }),
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
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

const CreateWorkout = (await import('../CreateWorkout')).default

beforeEach(() => {
  localStorage.clear()
  mockDisponibile = true
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

async function alPasso2(categoria) {
  render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
  if (categoria) await userEvent.click(screen.getByRole('button', { name: new RegExp(categoria) }))
  await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
}

/** Sceglie un'immagine il cui testo letto è `testo`; torna il foglio, a lettura finita. */
async function scegli(testo) {
  mockLetto = () => Promise.resolve(testo)
  fireEvent.change(screen.getByLabelText('Immagine del workout'), {
    target: { files: [new File(['x'], 'lavagna.jpg', { type: 'image/jpeg' })] },
  })
  const foglio = await screen.findByRole('dialog', { name: "Da un'immagine" })
  await waitFor(() => expect(within(foglio).queryByText("Leggo l'immagine…")).toBeNull())
  return foglio
}

const foglioChiuso = () => waitFor(() => expect(screen.queryByRole('dialog', { name: "Da un'immagine" })).toBeNull())

describe("Da un'immagine, Hyrox", () => {
  it('il bottone apre subito il selettore, senza un foglio prima', async () => {
    await alPasso2()
    const clic = vi.spyOn(screen.getByLabelText('Immagine del workout'), 'click')
    await userEvent.click(screen.getByRole('button', { name: /Da un'immagine/ }))
    expect(clic).toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: "Da un'immagine" })).toBeNull()
  })

  it('senza il lettore (web) il bottone non c’è', async () => {
    mockDisponibile = false
    await alPasso2()
    expect(screen.queryByRole('button', { name: /Da un'immagine/ })).toBeNull()
  })

  it('mostra cosa ha capito prima di confermare, e i blocchi entrano nel builder', async () => {
    await alPasso2()
    const foglio = await scegli("Hyrox simulation\nEMOM 12'\n12 burpees\nAMRAP 10\n20 wall balls 9kg")
    expect(within(foglio).getByRole('status')).toHaveTextContent('2 blocchi · 2 esercizi · 1 riga nelle note')

    await userEvent.click(within(foglio).getByRole('button', { name: /Usa questi blocchi/ }))
    await foglioChiuso()

    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AMRAP/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wall Balls').length).toBeGreaterThan(0)
    // 🔴 La riga non capita è arrivata nelle note del coach.
    expect(screen.getByDisplayValue('Hyrox simulation')).toBeInTheDocument()
  })

  it('il testo letto si corregge, ma è chiuso finché non lo si apre', async () => {
    await alPasso2()
    const foglio = await scegli("EMOM 12'\n12 burpes")
    expect(within(foglio).queryByLabelText('Il testo letto')).toBeNull()
    await userEvent.click(within(foglio).getByRole('button', { name: /Correggi il testo letto/ }))
    fireEvent.change(within(foglio).getByLabelText('Il testo letto'), { target: { value: "EMOM 12'\n12 burpees\n10 wall balls" } })
    expect(within(foglio).getByRole('status')).toHaveTextContent('1 blocco · 2 esercizi')
  })

  it('un’immagine senza testo lo dice', async () => {
    await alPasso2()
    const foglio = await scegli('   ')
    expect(within(foglio).getByRole('alert')).toHaveTextContent(/non ho trovato testo/)
    expect(within(foglio).getByRole('button', { name: /Usa questi blocchi/ })).toBeDisabled()
  })

  it('con dei blocchi già scritti si sceglie, e la sostituzione si annulla', async () => {
    await alPasso2()
    let foglio = await scegli("EMOM 12'\n12 burpees")
    await userEvent.click(within(foglio).getByRole('button', { name: /Usa questi blocchi/ }))
    await foglioChiuso()

    foglio = await scegli('AMRAP 10\n20 wall balls')
    await userEvent.click(within(foglio).getByRole('button', { name: /Sostituisci i blocchi che ci sono/ }))
    await foglioChiuso()
    expect(screen.queryAllByText(/EMOM/)).toHaveLength(0)
    expect(screen.getByText("Blocchi sostituiti dall'immagine")).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Annulla/ }))
    expect(screen.queryAllByText(/AMRAP/)).toHaveLength(0)
    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
  })

  it('«Aggiungi in coda» tiene quelli che c’erano', async () => {
    await alPasso2()
    let foglio = await scegli("EMOM 12'\n12 burpees")
    await userEvent.click(within(foglio).getByRole('button', { name: /Usa questi blocchi/ }))
    await foglioChiuso()
    foglio = await scegli('AMRAP 10\n20 wall balls')
    await userEvent.click(within(foglio).getByRole('button', { name: /Aggiungi in coda/ }))
    await foglioChiuso()
    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AMRAP/).length).toBeGreaterThan(0)
  })
})

describe("Da un'immagine, corsa", () => {
  it('le fasi entrano nella lista', async () => {
    await alPasso2('Corsa|Running')
    const foglio = await scegli("Riscaldamento 15'\n6x400m @3:45 rec 1'")
    expect(within(foglio).getByRole('status')).toHaveTextContent('2 fasi')
    await userEvent.click(within(foglio).getByRole('button', { name: /Usa queste fasi/ }))
    await foglioChiuso()
    expect(screen.getByText('400m')).toBeInTheDocument()
    expect(screen.getByText('x6')).toBeInTheDocument()
  })
})
