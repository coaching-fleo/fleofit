import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DalleNoteUI from '../DalleNoteUI'
import { impronta, testoPulito, VERSIONE } from '../../../supabase/functions/estrai-note/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// La sezione mostra dati ricavati da un'IA, quindi deve dire sempre QUANTO è
// stato analizzato e cosa manca — altrimenti un grafico vuoto non dice se
// l'atleta non scrive o se l'analisi è indietro. E valgono le regole di tutta
// l'app: nessuno zero in pagina, nessuna linea da un punto solo.

const OGGI = new Date(2026, 9, 9)
const aw = (id, data, notes = `nota ${id}`) => ({ id, completed_date: data, status: 'completed', notes, workouts: { id: `w-${id}`, title: 'W' } })
const est = (w, estrazione = {}) => ({
  athlete_workout_id: w.id, data: w.completed_date, versione: VERSIONE, impronta: impronta(testoPulito(w.notes)),
  estrazione: { stato: [], risultati: [], sensazioni: { difficolta: null, citazione: null, modifiche: [] }, ...estrazione },
})
const tempo = (valore) => ({ esercizio: 'Wall Balls', misura: 'tempo', grezzo: 'x', valore, unita: 's', citazione: 'wb' })

const monta = (props) => {
  const onApriWorkout = vi.fn()
  render(<DalleNoteUI nome="Sofia" workouts={[]} estratti={[]} stato="pronto" oggi={OGGI} onApriWorkout={onApriWorkout} {...props} />)
  return { onApriWorkout }
}

describe('DalleNoteUI', () => {
  it('intestazione e finestra di 90 giorni', () => {
    const w = aw('a', '2026-10-01')
    monta({ workouts: [w], estratti: [est(w)] })
    expect(screen.getByRole('heading', { name: 'Dalle note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '90 giorni' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('la copertura dice quante note aspettano', () => {
    const ws = Array.from({ length: 41 }, (_, i) => aw(`n${i}`, '2026-10-01'))
    monta({ workouts: ws, estratti: ws.slice(0, 38).map(w => est(w)), stato: 'in_analisi' })
    expect(screen.getByText('38 note analizzate su 41 · 3 in analisi')).toBeInTheDocument()
  })

  it('analisi sospesa', () => {
    const w = aw('a', '2026-10-01')
    monta({ workouts: [w], estratti: [], stato: 'sospesa' })
    expect(screen.getByText(/analisi sospesa/)).toBeInTheDocument()
  })

  it('lettura fallita', () => {
    monta({ workouts: [aw('a', '2026-10-01')], stato: 'errore' })
    expect(screen.getByText(/Non è stato possibile leggere/)).toBeInTheDocument()
  })

  it('nessuna nota nel periodo: una frase, nessuna card', () => {
    monta({ workouts: [aw('a', '2026-01-01')] })
    expect(screen.getByText('Sofia non ha scritto note in questo periodo')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Risultati' })).not.toBeInTheDocument()
  })

  it('un risultato solo: il valore e la data, nessuna linea', () => {
    const w = aw('a', '2026-10-09')
    monta({ workouts: [w], estratti: [est(w, { risultati: [tempo(400)] })] })
    expect(screen.getByText('6:40 · 9 ott, unico dato')).toBeInTheDocument()
    expect(document.querySelector('polyline')).toBeNull()
  })

  it('due risultati: una linea con i due valori nell\'etichetta', () => {
    const a = aw('a', '2026-10-01'), b = aw('b', '2026-10-08')
    monta({ workouts: [a, b], estratti: [est(a, { risultati: [tempo(420)] }), est(b, { risultati: [tempo(400)] })] })
    const grafico = screen.getByRole('img', { name: /Wall Balls · tempo/ })
    expect(grafico.getAttribute('aria-label')).toContain('7:00')
    expect(grafico.getAttribute('aria-label')).toContain('6:40')
    expect(screen.getByText(/0:20 dall'ultima/)).toBeInTheDocument()
  })

  it('un miglioramento sale sempre, anche quando è un tempo che scende', () => {
    // Una linea che scende si legge «peggio»: per tempo e passo l'asse è
    // rovesciato, così 7:00 → 6:40 sale come 8 kg → 9 kg.
    const ultimaSale = () => {
      const p = document.querySelector('polyline').getAttribute('points').split(' ').map(c => Number(c.split(',')[1]))
      return p[p.length - 1] < p[0]
    }
    const a = aw('a', '2026-10-01'), b = aw('b', '2026-10-08')
    const { unmount } = render(<DalleNoteUI nome="Sofia" workouts={[a, b]} oggi={OGGI} stato="pronto"
      estratti={[est(a, { risultati: [tempo(420)] }), est(b, { risultati: [tempo(400)] })]} />)
    expect(ultimaSale()).toBe(true)
    unmount()
    const kg = (v) => ({ esercizio: 'Wall Balls', misura: 'kg', grezzo: 'x', valore: v, unita: 'kg', citazione: 'c' })
    render(<DalleNoteUI nome="Sofia" workouts={[a, b]} oggi={OGGI} stato="pronto"
      estratti={[est(a, { risultati: [kg(8)] }), est(b, { risultati: [kg(9)] })]} />)
    expect(ultimaSale()).toBe(true)
  })

  it('card vuote: una frase per card, nessuno zero', () => {
    const w = aw('a', '2026-10-01')
    monta({ workouts: [w], estratti: [est(w)] })
    expect(screen.getByText('Nessun risultato nelle note degli ultimi 90 giorni')).toBeInTheDocument()
    expect(screen.getByText(/Nessuna sensazione sul workout/)).toBeInTheDocument()
    expect(screen.getByText(/Nessun accenno a stanchezza/)).toBeInTheDocument()
    const sezione = screen.getByRole('region', { name: 'Dalle note' })
    expect(within(sezione).queryByText(/^0$/)).toBeNull()
  })

  it('con la finestra a 30 giorni un dato di 60 giorni fa esce', async () => {
    const vecchio = aw('a', '2026-08-10'), nuovo = aw('b', '2026-10-05')
    monta({ workouts: [vecchio, nuovo], estratti: [est(vecchio, { risultati: [tempo(420)] }), est(nuovo)] })
    expect(screen.getByText(/7:00 · 10 ago, unico dato/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '30 giorni' }))
    expect(screen.queryByText(/7:00 · 10 ago/)).not.toBeInTheDocument()
  })

  it('le modifiche frequenti si aprono sulle citazioni, e una citazione apre il workout', async () => {
    const a = aw('a', '2026-10-01'), b = aw('b', '2026-10-03')
    const salta = (c) => ({ sensazioni: { difficolta: null, citazione: null, modifiche: [{ tipo: 'saltato', esercizio: 'Burpees', citazione: c }] } })
    const { onApriWorkout } = monta({ workouts: [a, b], estratti: [est(a, salta('burpees no')), est(b, salta('saltati i burpees'))] })
    await userEvent.click(screen.getByRole('button', { name: /Burpees · saltato · 2 volte/ }))
    await userEvent.click(screen.getByRole('button', { name: /saltati i burpees/ }))
    expect(onApriWorkout).toHaveBeenCalledWith('b')
  })
})
