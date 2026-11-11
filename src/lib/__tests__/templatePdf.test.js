import { describe, it, expect } from 'vitest'
import { fintoSupabase } from '../../test/fintoSupabase'
import {
  LIMITI_PDF, pulisciTemplate, leggiTemplatePdf, leggiMioTemplatePdf, salvaTemplatePdf, intestazioneCoach,
  scriviNoteAggiuntive,
} from '../templatePdf'

const MARIO = { coach_id: 'c-mario', nome_firma: 'Mario Rossi', note_finali: 'Scrivimi su WhatsApp' }
const LUCA = { coach_id: 'c-luca', nome_firma: 'Luca Bianchi', note_finali: null }

/** Un doc jsPDF che registra le chiamate, quanto basta per il riquadro. */
function docFinto() {
  const chiamate = []
  const reg = (nome) => (...args) => { chiamate.push({ nome, args }) }
  return {
    chiamate,
    testi: () => chiamate.filter(c => c.nome === 'text'),
    text: reg('text'), addPage: reg('addPage'), rect: reg('rect'), setFillColor: reg('setFillColor'),
    setTextColor: reg('setTextColor'), setFont: reg('setFont'), setFontSize: reg('setFontSize'),
    setDrawColor: reg('setDrawColor'), line: reg('line'),
    splitTextToSize: (t) => String(t).split('\n'),
  }
}

describe('pulisciTemplate', () => {
  it('toglie gli spazi e trasforma i vuoti in null', () => {
    expect(pulisciTemplate({ nome: '  Mario Rossi ', note: '\n\n' })).toEqual({ nome_firma: 'Mario Rossi', note_finali: null })
    expect(pulisciTemplate({ nome: '   ', note: '  Ciao\n' })).toEqual({ nome_firma: null, note_finali: 'Ciao' })
  })
  it('rispetta i limiti del database', () => {
    expect(LIMITI_PDF).toEqual({ nome: 60, note: 600 })
    const r = pulisciTemplate({ nome: 'x'.repeat(70), note: 'y'.repeat(700) })
    expect(r.nome_firma).toHaveLength(60)
    expect(r.note_finali).toHaveLength(600)
  })
})

describe('leggiTemplatePdf', () => {
  it('usa il template di chi ha creato il workout', async () => {
    const { supabase } = fintoSupabase({ pdf_coach: [LUCA, MARIO] })
    expect(await leggiTemplatePdf(supabase, { creatoDa: 'c-mario', utente: 'c-luca' }))
      .toEqual({ nome: 'Mario Rossi', note: 'Scrivimi su WhatsApp' })
  })
  it('senza la riga del creatore usa quella di chi esporta', async () => {
    const { supabase } = fintoSupabase({ pdf_coach: [LUCA] })
    expect(await leggiTemplatePdf(supabase, { creatoDa: 'c-admin', utente: 'c-luca' }))
      .toEqual({ nome: 'Luca Bianchi', note: null })
  })
  it('con creato_da nullo usa quella di chi esporta', async () => {
    const { supabase } = fintoSupabase({ pdf_coach: [LUCA, MARIO] })
    expect(await leggiTemplatePdf(supabase, { creatoDa: null, utente: 'c-luca' }))
      .toEqual({ nome: 'Luca Bianchi', note: null })
  })
  it('un atleta senza righe leggibili: niente nome e niente note', async () => {
    const { supabase } = fintoSupabase({ pdf_coach: [] })
    expect(await leggiTemplatePdf(supabase, { creatoDa: 'c-admin', utente: 'atleta' }))
      .toEqual({ nome: null, note: null })
  })
  it('tabella assente: niente nome e niente note, senza eccezioni', async () => {
    const { supabase } = fintoSupabase({ pdf_coach: [MARIO] }, { erroreSu: ['pdf_coach'], codiceErrore: 'PGRST205' })
    expect(await leggiTemplatePdf(supabase, { creatoDa: 'c-mario', utente: 'c-mario' }))
      .toEqual({ nome: null, note: null })
  })
  it('promessa che rifiuta: stesso risultato', async () => {
    const supabase = { from: () => { throw new Error('rete') } }
    expect(await leggiTemplatePdf(supabase, { creatoDa: 'c-mario', utente: 'c-mario' }))
      .toEqual({ nome: null, note: null })
  })
  it('senza id non chiede niente', async () => {
    const { supabase } = fintoSupabase({ pdf_coach: [MARIO] })
    expect(await leggiTemplatePdf(supabase, { creatoDa: null, utente: null })).toEqual({ nome: null, note: null })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('salvaTemplatePdf', () => {
  it('fa l\'upsert della riga del coach con i campi puliti', async () => {
    const f = fintoSupabase({ pdf_coach: [] })
    expect(await salvaTemplatePdf(f.supabase, 'c-mario', { nome: ' Mario ', note: '' })).toEqual({ errore: null })
    const [up] = f.chiamateA('pdf_coach', 'upsert')
    expect(up.args[0]).toMatchObject({ coach_id: 'c-mario', nome_firma: 'Mario', note_finali: null })
    expect(typeof up.args[0].aggiornato_at).toBe('string')
    expect(up.args[1]).toEqual({ onConflict: 'coach_id' })
  })
  it('tabella assente: lo dice in chiaro', async () => {
    const f = fintoSupabase({}, { erroreSu: ['pdf_coach'], codiceErrore: '42P01' })
    expect(await salvaTemplatePdf(f.supabase, 'c-mario', { nome: 'Mario', note: '' }))
      .toEqual({ errore: 'Funzione non ancora attiva: manca la tabella nel database.' })
  })
  it('altro errore: il messaggio del database', async () => {
    const f = fintoSupabase({}, { erroreSu: ['pdf_coach'] })
    expect((await salvaTemplatePdf(f.supabase, 'c-mario', { nome: 'Mario', note: '' })).errore).toBe('rete assente')
  })
})

describe('intestazioneCoach', () => {
  it('col nome', () => expect(intestazioneCoach('Mario Rossi')).toBe(' - Coach Mario Rossi'))
  it('senza nome', () => {
    expect(intestazioneCoach(null)).toBe('')
    expect(intestazioneCoach('  ')).toBe('')
  })
})

describe('scriviNoteAggiuntive', () => {
  it('senza note non disegna niente', () => {
    const doc = docFinto()
    expect(scriviNoteAggiuntive(doc, 100, '')).toBe(100)
    expect(scriviNoteAggiuntive(doc, 100, null)).toBe(100)
    expect(doc.chiamate).toHaveLength(0)
  })
  it('con le note: titolo e testo, e la y scende', () => {
    const doc = docFinto()
    const y = scriviNoteAggiuntive(doc, 100, 'Ciao\nA domani')
    expect(y).toBeGreaterThan(100)
    expect(doc.testi().some(t => t.args[0] === 'NOTE AGGIUNTIVE' && t.args[1] === 20)).toBe(true)
    expect(doc.testi().some(t => Array.isArray(t.args[0]) && t.args[0].join('|') === 'Ciao|A domani')).toBe(true)
    expect(doc.chiamate.some(c => c.nome === 'addPage')).toBe(false)
  })
  it('se non entra prima del glossario va su una pagina nuova scura', () => {
    const doc = docFinto()
    scriviNoteAggiuntive(doc, 230, 'riga\n'.repeat(5))
    const nomi = doc.chiamate.map(c => c.nome)
    expect(nomi.filter(n => n === 'addPage')).toHaveLength(1)
    const dopo = doc.chiamate.slice(nomi.indexOf('addPage'))
    expect(dopo.some(c => c.nome === 'rect' && c.args.join(',') === '0,0,210,297,F')).toBe(true)
    const titolo = doc.testi().find(t => t.args[0] === 'NOTE AGGIUNTIVE')
    expect(titolo.args[2]).toBe(20)
  })
  it('la fine del riquadro non supera il glossario (240 mm) sulla stessa pagina', () => {
    const doc = docFinto()
    // 4 righe: entra sulla stessa pagina, e deve finire prima del glossario.
    const fine = scriviNoteAggiuntive(doc, 200, 'a\nb\nc\nd')
    expect(doc.chiamate.some(c => c.nome === 'addPage')).toBe(false)
    expect(fine).toBeLessThanOrEqual(240)
  })
})


describe('correzioni della revisione finale', () => {
  it('note di 600 a-capo: mai oltre il glossario, nemmeno sulla pagina nuova', () => {
    const doc = docFinto()
    const fine = scriviNoteAggiuntive(doc, 230, 'x\n'.repeat(299) + 'x')
    expect(fine).toBeLessThanOrEqual(240)
    const righe = doc.testi().find(t => Array.isArray(t.args[0]) && t.args[0][0] === 'x').args[0]
    expect(righe[righe.length - 1]).toBe('…')
  })
  it('il testo si spezza alla dimensione con cui si scrive (10)', () => {
    const doc = docFinto()
    const misure = []
    doc.setFontSize = (n) => { doc.dim = n }
    doc.splitTextToSize = (t) => { misure.push(doc.dim); return String(t).split('\n') }
    scriviNoteAggiuntive(doc, 100, 'Ciao')
    expect(misure).toEqual([10])
  })
  it('la lettura per le Impostazioni distingue «nessuna riga» da «lettura fallita»', async () => {
    const vuota = fintoSupabase({ pdf_coach: [] })
    expect(await leggiMioTemplatePdf(vuota.supabase, 'c-mario')).toEqual({ nome: null, note: null, errore: false })
    const piena = fintoSupabase({ pdf_coach: [MARIO] })
    expect(await leggiMioTemplatePdf(piena.supabase, 'c-mario')).toEqual({ nome: 'Mario Rossi', note: 'Scrivimi su WhatsApp', errore: false })
    const assente = fintoSupabase({}, { erroreSu: ['pdf_coach'], codiceErrore: 'PGRST205' })
    expect(await leggiMioTemplatePdf(assente.supabase, 'c-mario')).toEqual({ nome: null, note: null, errore: false })
    const rotta = fintoSupabase({}, { erroreSu: ['pdf_coach'] })
    expect((await leggiMioTemplatePdf(rotta.supabase, 'c-mario')).errore).toBe(true)
  })
  it('l\'account che non può scrivere (RLS, 42501) riceve un messaggio in italiano', async () => {
    const f = fintoSupabase({}, { erroreSu: ['pdf_coach'], codiceErrore: '42501' })
    expect(await salvaTemplatePdf(f.supabase, 'demo', { nome: 'X', note: '' }))
      .toEqual({ errore: 'Questo account non può modificare il PDF delle schede.' })
  })
})
