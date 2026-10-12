import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// «Da un testo scritto» (12/10/2026): il workout incollato diventa blocchi
// senza IA (src/lib/leggiWorkout.js). Le regole del lettore hanno i loro test;
// qui si verifica il passaggio al builder, che è dove si può perdere qualcosa
// in silenzio — un blocco sostituito senza poter tornare indietro, una riga
// non capita che non arriva nelle note.

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
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

async function alPasso2(categoria) {
  render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
  if (categoria) await userEvent.click(screen.getByRole('button', { name: new RegExp(categoria) }))
  await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
}

/** Apre il foglio e scrive il testo; torna il foglio. */
async function incolla(testo) {
  await userEvent.click(screen.getByRole('button', { name: /Da un testo scritto/ }))
  const foglio = await screen.findByRole('dialog', { name: 'Da un testo scritto' })
  // fireEvent e non userEvent.type: apici e graffe sono comandi per userEvent.
  fireEvent.change(within(foglio).getByLabelText('Il workout scritto'), { target: { value: testo } })
  return foglio
}

const foglioChiuso = () => waitFor(() => expect(screen.queryByRole('dialog', { name: 'Da un testo scritto' })).toBeNull())

describe('Da un testo scritto, Hyrox', () => {
  it('mostra cosa ha capito prima di confermare, e i blocchi entrano nel builder', async () => {
    await alPasso2()
    const foglio = await incolla("Hyrox simulation\nEMOM 12'\n12 burpees\nAMRAP 10\n20 wall balls 9kg")
    expect(within(foglio).getByRole('status')).toHaveTextContent('2 blocchi · 2 esercizi · 1 riga nelle note')

    await userEvent.click(within(foglio).getByRole('button', { name: /Usa questi blocchi/ }))
    await foglioChiuso()

    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AMRAP/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wall Balls').length).toBeGreaterThan(0)
    // 🔴 La riga non capita è arrivata nelle note del coach.
    expect(screen.getByDisplayValue('Hyrox simulation')).toBeInTheDocument()
  })

  it('senza nulla di riconoscibile non si conferma niente', async () => {
    await alPasso2()
    const foglio = await incolla('una riga qualunque')
    expect(within(foglio).getByRole('button', { name: /Usa questi blocchi/ })).toBeDisabled()
  })

  it('con dei blocchi già scritti si sceglie, e la sostituzione si annulla', async () => {
    await alPasso2()
    let foglio = await incolla("EMOM 12'\n12 burpees")
    await userEvent.click(within(foglio).getByRole('button', { name: /Usa questi blocchi/ }))
    await foglioChiuso()

    foglio = await incolla('AMRAP 10\n20 wall balls')
    await userEvent.click(within(foglio).getByRole('button', { name: /Sostituisci i blocchi che ci sono/ }))
    await foglioChiuso()
    expect(screen.queryAllByText(/EMOM/)).toHaveLength(0)
    expect(screen.getByText('Blocchi sostituiti dal testo')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Annulla/ }))
    expect(screen.queryAllByText(/AMRAP/)).toHaveLength(0)
    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
  })

  it('«Aggiungi in coda» tiene quelli che c’erano', async () => {
    await alPasso2()
    let foglio = await incolla("EMOM 12'\n12 burpees")
    await userEvent.click(within(foglio).getByRole('button', { name: /Usa questi blocchi/ }))
    await foglioChiuso()
    foglio = await incolla('AMRAP 10\n20 wall balls')
    await userEvent.click(within(foglio).getByRole('button', { name: /Aggiungi in coda/ }))
    await foglioChiuso()
    expect(screen.getAllByText(/EMOM/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AMRAP/).length).toBeGreaterThan(0)
  })
})

describe('Da un testo scritto, corsa', () => {
  it('le fasi entrano nella lista', async () => {
    await alPasso2('Corsa|Running')
    const foglio = await incolla("Riscaldamento 15'\n6x400m @3:45 rec 1'")
    expect(within(foglio).getByRole('status')).toHaveTextContent('2 fasi')
    await userEvent.click(within(foglio).getByRole('button', { name: /Usa queste fasi/ }))
    await foglioChiuso()
    expect(screen.getByText('400m')).toBeInTheDocument()
    expect(screen.getByText('x6')).toBeInTheDocument()
  })
})
