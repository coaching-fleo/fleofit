import { describe, it, expect } from 'vitest'
import { descriviFiltro, dettaglioAtleta, mostraDettaglio } from '../rigaRicerca'

// Perché questi test esistono
// ────────────────────────────
// Il 09/10/2026 l'IA ha risposto «non si allenano da 7 giorni» usando il
// filtro «niente in programma nei prossimi 7 giorni». La frase era sicura e
// la lista plausibile: l'unico modo di accorgersene è vedere il filtro VERO
// sotto la risposta, e il motivo sulla riga di ogni atleta.

describe('descriviFiltro', () => {
  it('distingue fermi da senza programma', () => {
    expect(descriviFiltro('cercaAtleti', { inattivi_da_giorni: 7 })).toBe('fermi da almeno 7 giorni')
    expect(descriviFiltro('cercaAtleti', { senza_programma_giorni: 7 })).toBe('niente in programma nei prossimi 7 giorni')
  })
  it('compone i filtri dei workout', () => {
    expect(descriviFiltro('cercaWorkout', { atleta: 'Sofia Neri', stato: 'scaduto', tipo_blocco: 'EMOM', esercizio: ['wall ball'], dal: '2026-10-01', al: '2026-10-09' }))
      .toBe('Sofia Neri · scaduti · EMOM · wall ball · dal 2026-10-01 al 2026-10-09')
    expect(descriviFiltro('cercaWorkout', {})).toBe('tutti i workout')
  })
  it('le note e le statistiche dicono parole e periodo', () => {
    expect(descriviFiltro('cercaNelleNote', { parole: ['ginocch', 'menisco'] })).toBe('note con «ginocch» o «menisco»')
    expect(descriviFiltro('statisticheAtleta', { atleta: 'Marco Rossi' })).toBe('Marco Rossi · ultimi 30 giorni')
  })
  it('apri non ha un filtro da mostrare', () => {
    expect(descriviFiltro('apri', { schermata: 'atleti' })).toBeNull()
  })
})

describe('dettaglioAtleta', () => {
  it('la riga di chi non ha niente in programma lo dice, invece di restare vuota', () => {
    expect(dettaglioAtleta({ senzaProgrammaGiorni: 7 })).toBe('niente in programma nei prossimi 7 giorni')
  })
})

describe('mostraDettaglio', () => {
  // Decisione del committente (09/10/2026): sotto un errore di limite non va
  // il testo inglese di Google/Groq, il messaggio dice già tutto.
  it('nasconde la riga tecnica quando l\'errore è un limite di richieste', () => {
    expect(mostraDettaglio("Limite di richieste all'IA raggiunto (piano gratuito): aspetta un minuto e riprova.",
      'groq openai/gpt-oss-120b · 429 · Rate limit reached for model')).toBe(false)
    expect(mostraDettaglio("L'IA non ha risposto.", 'gemini-2.5-flash · 429 · You exceeded your current quota')).toBe(false)
  })
  it('la tiene per gli altri errori, dove serve a capire cosa si è rotto', () => {
    expect(mostraDettaglio("L'IA non ha risposto.", 'gemini-2.5-flash · 400 · Invalid argument')).toBe(true)
    expect(mostraDettaglio("L'IA non ha risposto.", null)).toBe(false)
  })
})
