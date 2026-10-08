import { describe, it, expect } from 'vitest'
import * as client from '../segnalazione'
import {
  LIMITI, TIPI_VALIDI, allegati, messaggioResend, testoProibito, disinnesca, controllaInvii, LIMITI_INVIO, validaCorpo, oggettoSegnalazione, testoSegnalazione, htmlSegnalazione, limitatore,
} from '../../../supabase/functions/segnalazione/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// Le regole della Edge Function `segnalazione` stanno in un file puro
// (`regole.ts`, senza import Deno) proprio per poterle provare qui. Due cose
// contano più delle altre:
//  1. i LIMITI esistono due volte, nel telefono e nel server: se divergono,
//     l'app lascia passare un testo che il server rifiuta, e chi scrive vede
//     un errore che non capisce nel momento in cui ha già un problema;
//  2. la descrizione finisce in una mail HTML: senza l'escape, un `<` scritto
//     da un atleta diventa markup nella posta del coach.

const corpo = (extra = {}) => ({
  tipo: 'notifiche',
  risposte: [{ domanda: 'Cosa succede?', risposta: 'Arrivano doppie' }],
  descrizione: 'Le notifiche arrivano due volte',
  tecnici: { Rete: 'online', Ruolo: 'Atleta' },
  immagini: [],
  ...extra,
})

describe('le regole coincidono con quelle del telefono', () => {
  it('stessi limiti', () => {
    expect(LIMITI).toEqual(client.LIMITI)
  })

  it('stessi tipi', () => {
    expect(TIPI_VALIDI).toEqual(client.TIPI.map(t => t.id))
  })
})

describe('validaCorpo', () => {
  it('accetta un corpo completo', () => {
    expect(validaCorpo(corpo())).toBeNull()
  })

  it('una descrizione di soli spazi è vuota', () => {
    expect(validaCorpo(corpo({ descrizione: '          ' }))).not.toBeNull()
  })

  it('rifiuta un tipo inventato', () => {
    expect(validaCorpo(corpo({ tipo: 'hack' }))).not.toBeNull()
  })

  it('rifiuta un corpo che non è un oggetto', () => {
    expect(validaCorpo(null)).not.toBeNull()
    expect(validaCorpo('ciao')).not.toBeNull()
  })

  it('rifiuta la quarta immagine', () => {
    const im = { nome: 'a.jpg', base64: '/9j/QUJD' }
    expect(validaCorpo(corpo({ immagini: [im, im, im, im] }))).not.toBeNull()
  })

  it('rifiuta un\'immagine oltre 1,5 MB decodificata', () => {
    // 4 caratteri base64 = 3 byte: 2.100.000 caratteri ≈ 1,575 MB.
    const grande = { nome: 'a.jpg', base64: '/9j/' + 'A'.repeat(2_100_000) }
    expect(validaCorpo(corpo({ immagini: [grande] }))).not.toBeNull()
  })

  it('🔴 accetta solo JPEG veri: un file qualunque non arriva nella posta del coach', () => {
    // «/9j/» è FF D8 FF in base64, l'inizio di ogni JPEG. Il telefono manda
    // solo JPEG (riduciImmagine); un allegato diverso l'ha costruito qualcuno a mano.
    expect(validaCorpo(corpo({ immagini: [{ nome: 'a.jpg', base64: '/9j/4AAQ' }] }))).toBeNull()
    expect(validaCorpo(corpo({ immagini: [{ nome: 'fattura.exe', base64: 'TVqQAAMA' }] }))).not.toBeNull()
  })
})

describe('allegati', () => {
  it('il nome lo decide il server, non chi spedisce', () => {
    expect(allegati([{ nome: 'fattura.exe', base64: '/9j/AA' }, { nome: 'x', base64: '/9j/BB' }])).toEqual([
      { filename: 'screenshot-1.jpg', content: '/9j/AA' },
      { filename: 'screenshot-2.jpg', content: '/9j/BB' },
    ])
  })

  it('rifiuta dati tecnici oltre 2 KB', () => {
    expect(validaCorpo(corpo({ tecnici: { Dispositivo: 'x'.repeat(3000) } }))).not.toBeNull()
  })
})

describe('la mail', () => {
  it('l\'oggetto dice tipo e nome', () => {
    expect(oggettoSegnalazione('notifiche', 'Sofia Rossi')).toBe('[FLEOFIT] Notifiche · Sofia Rossi')
  })

  it('il testo porta risposte, descrizione, mittente e dati tecnici', () => {
    const testo = testoSegnalazione(corpo(), 'Sofia Rossi', 'sofia@esempio.it')
    expect(testo).toContain('Cosa succede? Arrivano doppie')
    expect(testo).toContain('Le notifiche arrivano due volte')
    expect(testo).toContain('Sofia Rossi <sofia@esempio.it>')
    expect(testo).toContain('Ruolo: Atleta')
  })

  it('nell\'HTML la descrizione passa con l\'escape', () => {
    const html = htmlSegnalazione(corpo({ descrizione: 'prima <script>alert(1)</script> & "dopo" \'x\'' }), 'Sofia', 's@e.it')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;dopo&quot;')
    expect(html).toContain('&#39;x&#39;')
    expect(html).not.toContain('<script>')
  })

  it('anche il nome e le risposte passano con l\'escape', () => {
    const html = htmlSegnalazione(corpo({ risposte: [{ domanda: 'D<', risposta: 'R>' }] }), '<b>Io</b>', 's@e.it')
    expect(html).not.toContain('<b>Io</b>')
    expect(html).toContain('D&lt;')
  })
})

describe('messaggioResend', () => {
  const msg = () => messaggioResend(corpo(), {
    nome: 'Sofia Rossi', email: 'sofia@esempio.it', mittente: 'FLEOFIT <a@b.it>', destinatario: 'coach@b.it',
  })

  it('🔴 non ha «Rispondi a»: alle segnalazioni non si risponde (committente, 08/10/2026)', () => {
    expect(msg()).not.toHaveProperty('reply_to')
    expect(msg()).not.toHaveProperty('replyTo')
  })

  it('va al destinatario, con oggetto, testo, HTML e allegati', () => {
    const m = msg()
    expect(m.from).toBe('FLEOFIT <a@b.it>')
    expect(m.to).toEqual(['coach@b.it'])
    expect(m.subject).toBe('[FLEOFIT] Notifiche · Sofia Rossi')
    expect(m.text).toContain('Sofia Rossi <sofia@esempio.it>')
    expect(m.html).toContain('Sofia Rossi')
    expect(m.attachments).toEqual([])
  })
})

describe('niente link né codice, anche sul server', () => {
  // Il server è quello che decide: il telefono si può aggirare. Gli stessi
  // casi passano da entrambe le regole, così non possono divergere.
  const casi = [
    ['guarda https://sito-strano.ru/x qui', false],
    ['apri www.esempio.com per favore', false],
    ['il sito esempio.com non va', false],
    ['scrivimi a mario.rossi@gmail.com subito', false],
    ['prima <script>alert(1)</script> dopo', false],
    ['testo normale‮con inversione', false],
    ['Il timer si ferma al round 3 di 10', true],
    ['Wall Balls da 9.5 kg, ritmo 5:30 /km, Z2', true],
    ['Ti voglio bene <3 ma il timer si blocca', true],
  ]

  it.each(casi)('telefono e server dicono la stessa cosa: %s', (testo, ammesso) => {
    expect(testoProibito(testo) === null).toBe(ammesso)
    expect(client.validaSegnalazione({ tipo: 'bug', descrizione: testo, immagini: [] }).ok).toBe(ammesso)
  })

  it('rifiuta la descrizione con un link', () => {
    expect(validaCorpo(corpo({ descrizione: 'guarda https://x.ru/a subito' }))).not.toBeNull()
  })

  it('rifiuta una risposta con un link o un tag', () => {
    expect(validaCorpo(corpo({ risposte: [{ domanda: 'Cosa succede?', risposta: 'vai su www.x.com' }] }))).not.toBeNull()
    expect(validaCorpo(corpo({ risposte: [{ domanda: '<b>x</b>', risposta: 'Sempre' }] }))).not.toBeNull()
  })

  it('i dati tecnici non si rifiutano, ma un link dentro si disinnesca', () => {
    expect(disinnesca('Bot +http://www.google.com/bot.html')).toBe('Bot +http[:]//www[.]google.com/bot.html')
    const html = htmlSegnalazione(corpo({ tecnici: { Dispositivo: 'x https://a.ru y' } }), 'S', 's@e.it')
    expect(html).not.toContain('https://')
  })
})

describe('controllaInvii: il limite che sopravvive alla funzione', () => {
  const ORA = 10_000_000_000
  const MIN = 60_000

  it("dichiara i limiti: 3 all'ora, 10 al giorno", () => {
    expect(LIMITI_INVIO).toEqual({ perOra: 3, perGiorno: 10 })
  })

  it("il terzo invio dell'ora passa, il quarto no", () => {
    const storico = [ORA - 50 * MIN, ORA - 20 * MIN]
    expect(controllaInvii(storico, ORA).consentito).toBe(true)
    expect(controllaInvii([...storico, ORA - MIN], ORA)).toEqual(
      expect.objectContaining({ consentito: false, messaggio: "Hai già inviato 3 segnalazioni nell'ultima ora. Riprova più tardi." }))
  })

  it("dopo un'ora i vecchi non contano più per l'ora, ma sì per il giorno", () => {
    const storico = Array.from({ length: 10 }, (_, i) => ORA - (2 + i) * 60 * MIN)
    expect(controllaInvii(storico, ORA)).toEqual(
      expect.objectContaining({ consentito: false, messaggio: 'Hai raggiunto il massimo di 10 segnalazioni al giorno. Riprova domani.' }))
  })

  it("lo storico aggiornato tiene solo le ultime 24 ore, più l'invio di adesso", () => {
    const storico = [ORA - 25 * 60 * MIN, ORA - 2 * 60 * MIN]
    expect(controllaInvii(storico, ORA).storico).toEqual([ORA - 2 * 60 * MIN, ORA])
  })

  it('uno storico rovinato non blocca nessuno', () => {
    expect(controllaInvii('rotto', ORA).consentito).toBe(true)
    expect(controllaInvii([null, 'x', -5], ORA).storico).toEqual([ORA])
  })
})

describe('limitatore', () => {
  it('cinque invii all\'ora, poi no, poi di nuovo sì', () => {
    const lim = limitatore(5, 3_600_000)
    const t0 = 1_000_000
    for (let i = 0; i < 5; i++) expect(lim.consenti('u', t0 + i)).toBe(true)
    expect(lim.consenti('u', t0 + 10)).toBe(false)
    expect(lim.consenti('altro', t0 + 10)).toBe(true)
    expect(lim.consenti('u', t0 + 3_600_001)).toBe(true)
  })
})
