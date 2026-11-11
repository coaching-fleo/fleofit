import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CartaOggi, AvvisoStannoMale, CoppiaAzioni, ContatoriDaGuardare, FilaOggi, Destinazioni, GareRighe, CalendarioProssimi } from '../RiepilogoCoachUI'

// I pezzi della Home «Riepilogo»: mai uno zero in pagina, e con tanti atleti
// la fila delle foto non si disegna tutta.

describe('RiepilogoCoachUI', () => {
  it('le due card mostrano ✓, non 0', () => {
    const { container } = render(<CoppiaAzioni feedback={0} scoperti={0} onFeedback={vi.fn()} onProgramma={vi.fn()} />)
    expect(screen.getAllByText('✓')).toHaveLength(2)
    expect(screen.getByText('tutti letti')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\b0\b/)
  })

  it('i contatori a zero non scrivono 0', () => {
    const { container } = render(<ContatoriDaGuardare onApri={vi.fn()} />)
    expect(screen.getAllByText('✓')).toHaveLength(4)
    expect(container.textContent).not.toMatch(/\b0\b/)
  })

  it('una giornata vuota dice «Nessun allenamento oggi»', () => {
    const { container } = render(<CartaOggi stati={{ daFare: 0, inCorso: 0, fatti: 0, totale: 0 }} onApri={vi.fn()} />)
    expect(screen.getByText('Nessun allenamento oggi')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/0 di 0/)
  })

  it('la fila di oggi parte da 20 card e dice quante ne restano', () => {
    const righe = Array.from({ length: 50 }, (_, i) => ({ id: `a${i}`, workoutId: 'w', nome: `Atleta ${i}`, titolo: 'X', categoria: 'Hyrox', stato: 'da fare' }))
    render(<FilaOggi righe={righe} onApri={vi.fn()} onTutti={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /Da fare$/ })).toHaveLength(20)
    expect(screen.getByText('+30')).toBeInTheDocument()
  })

  it('l\'allarme: niente se nessuno sta male, il numero se sono tanti', () => {
    const { container, rerender } = render(<AvvisoStannoMale righe={[]} onApri={vi.fn()} onApriUno={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<AvvisoStannoMale righe={[{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }]} onApri={vi.fn()} onApriUno={vi.fn()} />)
    expect(screen.getByText(/3 atleti stanno male/)).toBeInTheDocument()
  })

  it('Analisi solo dove è chiesta', () => {
    const { rerender } = render(<Destinazioni onReport={vi.fn()} />)
    expect(screen.queryByText('Analisi')).not.toBeInTheDocument()
    rerender(<Destinazioni analisi onReport={vi.fn()} onAnalisi={vi.fn()} />)
    expect(screen.getByText('Analisi')).toBeInTheDocument()
  })

  it('a inizio giornata la card gialla non scrive «0 di 12» né «0%»', () => {
    const { container } = render(<CartaOggi stati={{ daFare: 12, inCorso: 0, fatti: 0, totale: 12 }} onApri={vi.fn()} />)
    expect(screen.getByText('Nessuno ha ancora finito')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\b0\b/)
  })

  it('una gara oggi dice «oggi», non «0 giorni»', () => {
    const gare = [{ chiave: 'g', nome: 'Hyrox', giorni: 0, giorno: '10', mese: 'NOV', atleti: [{ id: 'a' }] }]
    const { container } = render(<GareRighe gare={gare} onApri={vi.fn()} />)
    expect(screen.getByText('oggi')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\b0\b/)
  })

  it('nel calendario il «+» programma quell\'atleta in quel giorno', () => {
    const piano = {
      giorni: [{ data: '2026-11-11', oggi: true }, { data: '2026-11-12', oggi: false }],
      righe: [{ id: 'a1', nome: 'Luca Rossi', celle: [
        { data: '2026-11-11', quando: 'oggi', chips: [] },
        { data: '2026-11-12', quando: 'futuro', chips: [] },
      ] }],
    }
    const onProgramma = vi.fn()
    render(<CalendarioProssimi piano={piano} onApri={vi.fn()} onProgramma={onProgramma} />)
    fireEvent.click(screen.getByRole('button', { name: 'Da programmare' }))
    expect(onProgramma).toHaveBeenCalledWith({ atletaId: 'a1', data: '2026-11-12' })
  })

  it('oltre 20 atleti il calendario ne mostra 20 e «Mostra tutti» apre il resto', () => {
    const piano = {
      giorni: [{ data: '2026-11-11', oggi: true }, { data: '2026-11-12', oggi: false }],
      righe: Array.from({ length: 25 }, (_, i) => ({ id: `a${i}`, nome: `Atleta ${i}`, celle: [
        { data: '2026-11-11', quando: 'oggi', chips: [] },
        { data: '2026-11-12', quando: 'futuro', chips: [{ id: `c${i}`, titolo: 'Fondo', categoria: 'Running' }] },
      ] })),
    }
    const onTutti = vi.fn()
    render(<CalendarioProssimi piano={piano} onApri={vi.fn()} onTutti={onTutti} />)
    expect(screen.getAllByText(/^Atleta \d+\.$/)).toHaveLength(20)
    fireEvent.click(screen.getByRole('button', { name: 'Mostra tutti i 25 atleti' }))
    expect(onTutti).toHaveBeenCalled()
  })
})
