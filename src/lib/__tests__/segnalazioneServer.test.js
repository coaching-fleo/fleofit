import { describe, it, expect } from 'vitest'
import * as client from '../segnalazione'
import {
  LIMITI, TIPI_VALIDI, allegati, messaggioResend, validaCorpo, oggettoSegnalazione, testoSegnalazione, htmlSegnalazione, limitatore,
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
