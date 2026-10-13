// La lista «Da guardare» della Home coach desktop (src/components/HomeCoachDesktop.jsx).
// Logica pura: riceve le righe già calcolate da src/lib/statisticheCoach.js.

/**
 * Le cose da guardare, in UNA lista: feedback, atleti fermi, allenamenti
 * scaduti. Ogni riga ha un solo bottone, che dice cosa fa.
 */
export function cosaGuardare({ feedback = [], fermi = [], scaduti = [] }) {
  return [
    ...feedback.map(f => ({
      chiave: `f-${f.id}`, tipo: 'feedback', dato: f, nome: f.nome, foto: f.foto,
      riga: f.testo ? `«${f.testo}»` : f.haVocale ? `Nota vocale su «${f.titolo}»` : f.titolo,
      rpe: f.rpe ?? null,
      azione: f.haVocale && !f.testo ? 'Ascolta' : 'Leggi',
    })),
    ...fermi.map(a => ({
      chiave: `a-${a.id}`, tipo: 'fermo', dato: a, nome: a.nome, foto: a.foto,
      riga: `Non si allena da ${a.giorni}${a.oltre ? '+' : ''} giorni`, avviso: true,
      rpe: null, azione: 'Scheda',
    })),
    ...scaduti.map(s => ({
      chiave: `s-${s.id}`, tipo: 'scaduto', dato: s, nome: s.nome, foto: null,
      riga: `${s.titolo} · scaduto ${s.quando}`, avviso: true,
      rpe: null, azione: 'Apri',
    })),
  ]
}
