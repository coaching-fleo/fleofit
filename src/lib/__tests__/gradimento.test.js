import { describe, it, expect } from 'vitest'
import { gradimentoDi, conGradimento, gradimentoDopoSalta, riepilogoGradimento } from '../gradimento'
import { parseNotesAndRpe, formatNotesWithRpe, rpeDichiarato, testoNota } from '../rpe'
import { feedbackNuovi } from '../statisticheCoach'

// Il gradimento vive dentro athlete_workouts.notes, dopo l'RPE (lo schema è
// congelato). Le proprietà che contano sono tutte «non rompere quello che
// c'era»: l'RPE deve restare leggibile, il testo dell'atleta non deve mai
// mostrare il marcatore, e riscrivere la nota non deve cancellare il parere.

describe('gradimentoDi', () => {
  it('distingue le tre risposte dall assenza della domanda', () => {
    expect(gradimentoDi('[RPE: 7/10]\n[GRADIMENTO: si]\nok')).toBe('si')
    expect(gradimentoDi('[RPE: 7/10]\n[GRADIMENTO: no]\n')).toBe('no')
    expect(gradimentoDi('[RPE: 7/10]\n[GRADIMENTO: nessuna]\n')).toBe('nessuna')
    expect(gradimentoDi('[RPE: 7/10]\nok')).toBeNull()
    expect(gradimentoDi(null)).toBeNull()
  })

  it('non si fa ingannare da un marcatore scritto a metà testo', () => {
    expect(gradimentoDi('[RPE: 7/10]\nho letto [GRADIMENTO: si] da qualche parte')).toBeNull()
  })
})

describe('conGradimento', () => {
  it('🔴 mette il marcatore DOPO l RPE: davanti, ogni RPE del progetto tornerebbe null', () => {
    const nota = conGradimento('[RPE: 8/10]\nGambe pesanti', 'si')
    expect(nota).toBe('[RPE: 8/10]\n[GRADIMENTO: si]\nGambe pesanti')
    expect(rpeDichiarato(nota)).toBe(8)
  })

  it('sostituisce il parere invece di accodarne un secondo', () => {
    const due = conGradimento(conGradimento('[RPE: 8/10]\nok', 'si'), 'no')
    expect(due).toBe('[RPE: 8/10]\n[GRADIMENTO: no]\nok')
  })

  it('con null lo toglie', () => {
    expect(conGradimento('[RPE: 8/10]\n[GRADIMENTO: si]\nok', null)).toBe('[RPE: 8/10]\nok')
  })
})

describe('il marcatore non si vede mai come testo', () => {
  const nota = '[RPE: 6/10]\n[GRADIMENTO: no]\nTroppi burpees'

  it('parseNotesAndRpe lo toglie dal testo e lo riporta a parte', () => {
    expect(parseNotesAndRpe(nota)).toEqual({ rpe: 6, text: 'Troppi burpees', gradimento: 'no' })
  })

  it('testoNota, cioè la citazione nei feedback e nei report, è il solo testo', () => {
    expect(testoNota(nota)).toBe('Troppi burpees')
  })

  it('🔴 riscrivere la nota con il round-trip conserva il parere', () => {
    const { rpe, text, gradimento } = parseNotesAndRpe(nota)
    expect(formatNotesWithRpe(rpe, `${text}!`, gradimento)).toBe('[RPE: 6/10]\n[GRADIMENTO: no]\nTroppi burpees!')
  })

  it('un solo marcatore senza testo NON diventa la citazione di un feedback', () => {
    const oggi = new Date()
    const giorno = oggi.toISOString().split('T')[0]
    const { elementi } = feedbackNuovi([
      { id: 'a', status: 'completed', completed_date: giorno, notes: '[RPE: 7/10]\n[GRADIMENTO: si]\n', athlete_id: 'x' },
    ], [], { oggi })
    expect(elementi).toHaveLength(1)
    expect(elementi[0].testo).toBe('')
  })
})

describe('gradimentoDopoSalta', () => {
  it('saltare non ritira un parere già dato', () => {
    expect(gradimentoDopoSalta('[RPE: 7/10]\n[GRADIMENTO: si]\n')).toBe('si')
    expect(gradimentoDopoSalta('[RPE: 7/10]\n')).toBe('nessuna')
    expect(gradimentoDopoSalta('[RPE: 7/10]\n[GRADIMENTO: nessuna]\n')).toBe('nessuna')
  })
})

describe('riepilogoGradimento', () => {
  it('conta le tre risposte e lascia fuori chi non è mai stato interpellato', () => {
    const r = riepilogoGradimento([
      { notes: '[RPE: 7/10]\n[GRADIMENTO: si]\n' },
      { notes: '[RPE: 7/10]\n[GRADIMENTO: si]\n' },
      { notes: '[RPE: 7/10]\n[GRADIMENTO: no]\n' },
      { notes: '[RPE: 7/10]\n[GRADIMENTO: nessuna]\n' },
      { notes: '[RPE: 7/10]\n' },
      { notes: null },
    ])
    expect(r).toEqual({ si: 2, no: 1, nessuna: 1, risposte: 4 })
  })

  it('senza nessuna risposta torna null, non una riga di zeri', () => {
    expect(riepilogoGradimento([{ notes: '[RPE: 7/10]\n' }])).toBeNull()
    expect(riepilogoGradimento([])).toBeNull()
  })
})
