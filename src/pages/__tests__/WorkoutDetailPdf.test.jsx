import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questo test esiste
// ─────────────────────────
// Fino all'11/11/2026 il PDF scriveva «Coach Federico Leo» in testa per
// chiunque. Ora porta il nome del coach che ha CREATO il workout e le sue
// «note aggiuntive» (tabella pdf_coach, src/lib/templatePdf.js). Qui si
// controlla il PDF vero, quello che `buildPDFDoc` disegna, con un jsPDF finto
// che si segna ogni testo.
//
// ⚠️ Niente `intensity` nel workout: l'intensità aggiunge un'emoji disegnata
// su un canvas, e jsdom non ha il canvas.

const ctrl = await vi.hoisted(async () => ({ stato: {}, testi: [], salvato: null }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w1', title: 'Hyrox Strength #1', date: '2026-08-28', coach_notes: '', creato_da: 'c-mario',
      sections: { category: 'Hyrox', blocks: [
        { id: 'b2', type: 'EMOM', params: { interval: '1:00', rounds: '10' }, exercises: [
          { id: 'e3', name: 'Wall Balls', reps: '20', kg: '9' },
        ] },
      ] } }],
    athlete_workouts: [{
      id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: '2026-08-28',
      status: 'pending', notes: null, voice_note_url: null,
      athletes: { id: 'u1', name: 'Marco', surname: 'Rinaldi', photo_url: null },
    }],
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rinaldi' }],
    pdf_coach: ctrl.stato.pdf_coach,
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('jspdf', () => {
  class Finto {
    constructor() {
      const vuota = () => {}
      for (const m of ['setFillColor', 'rect', 'setFontSize', 'setFont', 'setTextColor', 'setDrawColor',
        'line', 'addPage', 'addImage']) this[m] = vuota
    }
    text(t) { ctrl.testi.push(Array.isArray(t) ? t.join('\n') : String(t)) }
    getTextWidth(t) { return String(t).length }
    splitTextToSize(t) { return String(t).split('\n') }
    output() { return 'data:application/pdf;base64,AA' }
    save(nome) { ctrl.salvato = nome }
  }
  return { default: Finto, jsPDF: Finto }
})
vi.mock('html-to-image', () => ({ toPng: vi.fn(), toBlob: vi.fn() }))
vi.mock('@capacitor/network', () => ({ Network: {
  getStatus: vi.fn(() => Promise.resolve({ connected: true })),
  addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
} }))

const { AuthContext } = await import('../../App')
const WorkoutDetail = (await import('../WorkoutDetail')).default

function apri() {
  return render(
    <MemoryRouter initialEntries={['/workout/w1?athlete_id=u1']}>
      <AuthContext.Provider value={{ user: { id: 'u1', email: 'a@b.it', user_metadata: {} }, role: 'athlete' }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

async function esporta() {
  const utente = userEvent.setup()
  apri()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Hyrox Strength #1' })).toBeInTheDocument())
  await utente.click(screen.getByRole('button', { name: /Altre azioni/i }))
  await utente.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Esporta PDF/ }))
  await waitFor(() => expect(ctrl.salvato).toBe('Hyrox_Strength_#1.pdf'))
  return ctrl.testi
}

beforeEach(() => {
  ctrl.testi = []
  ctrl.salvato = null
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('il PDF della scheda', () => {
  it('porta in testa il nome del coach che ha creato il workout', async () => {
    ctrl.stato = { pdf_coach: [{ coach_id: 'c-mario', nome_firma: 'Mario Rossi', note_finali: 'Scrivimi su WhatsApp' }] }
    const testi = await esporta()
    expect(testi).toContain(' - Coach Mario Rossi')
    expect(testi.some(t => t.includes('Federico Leo'))).toBe(false)
  })

  it('aggiunge le note aggiuntive del coach', async () => {
    ctrl.stato = { pdf_coach: [{ coach_id: 'c-mario', nome_firma: 'Mario Rossi', note_finali: 'Scrivimi su WhatsApp' }] }
    const testi = await esporta()
    expect(testi).toContain('NOTE AGGIUNTIVE')
    expect(testi).toContain('Scrivimi su WhatsApp')
  })

  it('senza template: solo FLEOFIT, nessuna firma e nessuna nota', async () => {
    ctrl.stato = { pdf_coach: [] }
    const testi = await esporta()
    expect(testi).toContain('FLEO')
    expect(testi.some(t => t.includes('Coach'))).toBe(false)
    expect(testi).not.toContain('NOTE AGGIUNTIVE')
  })
})
