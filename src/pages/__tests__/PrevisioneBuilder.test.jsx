import { describe, it, expect, vi } from 'vitest'
import { render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Perché questi test esistono — FASE 1 del modello predittivo (02/09/2026).
// ────────────────────────────────────────────────────────────────────────
// Il builder dice da sé quanto dura la seduta e con che RPE. Da oggi dice anche
// quanto PESA, e dove sta rispetto alle sedute che quel coach scrive di solito.
// Le regressioni di questa cella non danno nessun errore: danno un numero
// plausibile e sbagliato, che è il caso peggiore per un dato su cui si dosa il
// carico di qualcun altro. I due casi che contano davvero:
//
//  1. la cella è il PRODOTTO delle due che le stanno accanto. Un coach che
//     moltiplica a mente deve ritrovare il numero, o la carta si contraddice;
//  2. senza intensità dichiarata la cella NON compare, e in particolare non
//     mostra zero: «carico 0» si legge come «questa seduta non pesa niente».

const HYROX = (rounds, intensita) => ({
  category: 'Hyrox', intensity: '7',
  blocks: [{
    id: 'b1', type: 'EMOM', params: { interval: '1:00', rounds: String(rounds) },
    exercises: [{ id: 'e1', name: 'Wall Balls', reps: '20', intensity: String(intensita) }],
  }],
})

/** Un blocco senza NESSUNA intensità dichiarata sugli esercizi. */
const SENZA_INTENSITA = {
  category: 'Hyrox',
  blocks: [{
    id: 'b1', type: 'EMOM', params: { interval: '1:00', rounds: '30' },
    exercises: [{ id: 'e1', name: 'Wall Balls', reps: '20' }],
  }],
}

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ workouts: ctrl.stato.workouts }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const CreateWorkout = (await import('../CreateWorkout')).default

/**
 * Apre il builder in duplicazione, che è il modo di avere blocchi VERI con le
 * loro intensità senza comporli a mano dall'interfaccia.
 *
 * ⚠️ Il primo workout della lista è quello duplicato (`.single()` torna la
 * prima riga) e la stessa lista è anche lo storico su cui si costruisce il
 * confronto: è esattamente com'è in produzione, dove il workout che si sta
 * scrivendo nasce in mezzo agli altri.
 */
async function apriDuplicando(workouts) {
  ctrl.stato.workouts = workouts
  render(<MemoryRouter initialEntries={['/create?duplicate=w1']}><CreateWorkout /></MemoryRouter>)
  await waitFor(() => expect(document.querySelector('[data-riepilogo]')).toBeInTheDocument())
}

const riepilogo = () => document.querySelector('[data-riepilogo]')

/** Il valore di una cella del riepilogo, letto dalla sua etichetta. */
const cella = (etichetta) =>
  within(riepilogo()).getByText(etichetta).parentElement.textContent.replace(etichetta, '')

const w = (id, sections) => ({ id, title: `Seduta ${id}`, date: '2026-08-20', coach_notes: '', sections })

describe('FASE 1 — il carico previsto nel builder', () => {
  it('la cella «Carico» è il prodotto delle due celle accanto', async () => {
    // Un EMOM da 30 round a intensità 8: 30 minuti, RPE atteso 8.
    await apriDuplicando([w('w1', HYROX(30, 8))])

    expect(cella('Durata')).toBe('30min')
    expect(cella('RPE atteso')).toBe('8')
    // ⚠️ Il numero deve reggere la moltiplicazione a mente: 30 × 8 = 240.
    expect(cella('Carico')).toBe('≈240')
  })

  it('senza intensità dichiarata la cella NON compare, e non mostra zero', async () => {
    await apriDuplicando([w('w1', SENZA_INTENSITA)])

    expect(cella('RPE atteso')).toBe('—')
    expect(within(riepilogo()).queryByText('Carico')).not.toBeInTheDocument()
    // In particolare non c'è un «≈0» da nessuna parte: sarebbe una bugia con
    // l'aria di un dato.
    expect(riepilogo().textContent).not.toContain('≈0')
  })

  it('colloca la seduta fra quelle che il coach scrive di solito', async () => {
    // Tre sedute passate da 20 × 7 = 140, e quella in scrittura da 240.
    await apriDuplicando([
      w('w1', HYROX(30, 8)),
      w('w2', HYROX(20, 7)), w('w3', HYROX(20, 7)), w('w4', HYROX(20, 7)),
    ])

    await waitFor(() => expect(riepilogo().textContent).toMatch(/Sopra la media/))
    // ⚠️ La media deve essere IN PAGINA: senza il numero, «sopra la media» non
    // si può verificare, e una frase che non si può verificare si smette di
    // leggerla.
    // (w1 stesso vale 240 ed entra nella media: (240+140×3)/4 = 165.)
    expect(riepilogo().textContent).toContain('165')
  })

  it('con troppo poche sedute passate la riga di confronto NON compare', async () => {
    await apriDuplicando([w('w1', HYROX(30, 8)), w('w2', HYROX(20, 7))])

    expect(cella('Carico')).toBe('≈240')
    // Due sedute non sono una media: la riga sparisce invece di dichiararne una.
    expect(riepilogo().textContent).not.toMatch(/media delle tue sedute/)
  })
})
