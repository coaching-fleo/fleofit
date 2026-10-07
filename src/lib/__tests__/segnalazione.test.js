import { describe, it, expect } from 'vitest'
import {
  CHIAVE_BOZZA, LIMITI, TIPI, domandePer, bozzaVuota, validaSegnalazione, datiTecnici, corpoRichiesta,
} from '../segnalazione'

// Perché questi test esistono
// ────────────────────────────
// La segnalazione è l'unico messaggio dell'app che arriva al coach scritto
// da chi ha un problema, quindi in un momento in cui non ha pazienza. Due
// cose non devono succedere: che un testo vuoto (o di soli spazi) parta e
// arrivi come una mail muta, e che i dati tecnici dicano una cosa falsa —
// «Versione: null» sul web è peggio di nessuna riga.

const descrizioneBuona = 'Il timer si ferma al terzo round'

describe('il catalogo', () => {
  it('ha i sei tipi, nell\'ordine in cui compaiono', () => {
    expect(TIPI.map(t => t.id)).toEqual(['bug', 'lenta', 'notifiche', 'timer', 'accesso', 'idea'])
    expect(TIPI.find(t => t.id === 'idea').titolo).toBe("Un'idea")
  })

  it('un\'idea non ha domande', () => {
    expect(domandePer('idea')).toEqual([])
  })

  it('le notifiche chiedono cosa succede', () => {
    const [prima] = domandePer('notifiche')
    expect(prima.testo).toBe('Cosa succede?')
    expect(prima.opzioni).toContain('Arrivano doppie')
  })

  it('ogni problema chiede quanto spesso, come ultima domanda', () => {
    for (const { id } of TIPI.filter(t => t.id !== 'idea')) {
      expect(domandePer(id).at(-1).id).toBe('frequenza')
      expect(domandePer(id).length).toBeLessThanOrEqual(3)
    }
  })

  it('un tipo sconosciuto non ha domande, invece di rompere', () => {
    expect(domandePer('hack')).toEqual([])
  })

  it('la bozza vuota e la chiave', () => {
    expect(bozzaVuota()).toEqual({ tipo: null, risposte: {}, descrizione: '' })
    expect(CHIAVE_BOZZA).toBe('fleofit_segnalazione_bozza')
  })
})

describe('validaSegnalazione', () => {
  const valida = (extra) => validaSegnalazione({ tipo: 'bug', descrizione: descrizioneBuona, immagini: [], ...extra })

  it('accetta una segnalazione completa', () => {
    expect(valida()).toEqual({ ok: true, errore: null })
  })

  it('chiede il tipo prima di tutto', () => {
    expect(valida({ tipo: null }).errore).toBe('Scegli di cosa si tratta')
  })

  it('una descrizione di soli spazi conta come vuota', () => {
    expect(valida({ descrizione: '          ' }).errore).toBe('Scrivi almeno 10 caratteri')
  })

  it('rifiuta oltre 4.000 caratteri', () => {
    expect(valida({ descrizione: 'a'.repeat(LIMITI.descrizioneMax + 1) }).errore).toBe('Massimo 4.000 caratteri')
  })

  it('rifiuta la quarta immagine', () => {
    expect(valida({ immagini: [1, 2, 3, 4] }).errore).toBe('Massimo 3 immagini')
  })
})

describe('datiTecnici', () => {
  const base = {
    versione: 'FLEOFIT 1.1.0 · build 6', piattaforma: 'ios', userAgent: 'Mozilla/5.0', ruolo: 'Atleta',
    online: true, inCoda: 0, ora: new Date(2026, 9, 7, 9, 5), lingua: 'it-IT', fuso: 'Europe/Rome',
  }

  it('elenca le righe nell\'ordine fisso', () => {
    expect(datiTecnici(base).map(r => r.etichetta)).toEqual([
      'Versione', 'Piattaforma', 'Dispositivo', 'Ruolo', 'Rete', 'In coda offline', 'Data e ora', 'Lingua', 'Fuso orario',
    ])
  })

  it('sul web la versione non c\'è, e non compare come «null»', () => {
    const righe = datiTecnici({ ...base, versione: null, piattaforma: 'web' })
    expect(righe.map(r => r.etichetta)).not.toContain('Versione')
  })

  it('dice offline in parole', () => {
    expect(datiTecnici({ ...base, online: false })).toContainEqual({ etichetta: 'Rete', valore: 'offline' })
  })

  it('una coda a zero è un dato vero, e resta', () => {
    expect(datiTecnici(base)).toContainEqual({ etichetta: 'In coda offline', valore: '0' })
  })

  it('scrive la data in italiano', () => {
    expect(datiTecnici(base)).toContainEqual({ etichetta: 'Data e ora', valore: '7 ott 2026, 09:05' })
  })
})

describe('corpoRichiesta', () => {
  it('traduce gli id delle risposte nei testi e rifila la descrizione', () => {
    const corpo = corpoRichiesta({
      tipo: 'notifiche',
      risposte: { quando: 'Arrivano doppie' },
      descrizione: `  ${descrizioneBuona}  `,
      tecnici: [{ etichetta: 'Rete', valore: 'online' }],
      immagini: [{ nome: 'a.jpg', base64: 'QUJD' }],
    })
    expect(corpo).toEqual({
      tipo: 'notifiche',
      risposte: [{ domanda: 'Cosa succede?', risposta: 'Arrivano doppie' }],
      descrizione: descrizioneBuona,
      tecnici: { Rete: 'online' },
      immagini: [{ nome: 'a.jpg', base64: 'QUJD' }],
    })
  })

  it('segue l\'ordine delle domande e ignora quelle senza risposta', () => {
    const corpo = corpoRichiesta({
      tipo: 'timer', risposte: { frequenza: 'Sempre', cosa: 'Si ferma' },
      descrizione: descrizioneBuona, tecnici: [], immagini: [],
    })
    expect(corpo.risposte.map(r => r.risposta)).toEqual(['Si ferma', 'Sempre'])
  })
})
