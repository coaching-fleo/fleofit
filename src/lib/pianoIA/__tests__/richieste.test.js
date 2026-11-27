import { describe, it, expect } from 'vitest'
import {
  richiestaAdattamento, richiestaAnalisi, richiestaGroqAnalisi, leggiRisposta, modelloPer, fornitoreDi,
  MODELLI_PREDEFINITI, COMPITI, SCHEMA_DIFFERENZE as SCHEMA_TS,
} from '../../../../supabase/functions/_shared/pianoIA/richieste.ts'
import { SCHEMA_DIFFERENZE } from '../differenze.js'
import { sedutaHyrox } from './fixtureProgrammi.js'

const regole = ['Scarico ogni 4 settimane al −30%', 'Mai due sedute dure di fila']
const seduta = { posto: 0, focus: 'stazioni', dura: true, minuti: 60, sections: sedutaHyrox.sections }
const profiloA = { obiettivo: 'migliorare', fasciaEta: '30-39', livello: 'intermedio', settimaneAllaGara: 12 }
const profiloB = { obiettivo: 'prima_gara', fasciaEta: '18-29', livello: 'principiante', settimaneAllaGara: 20 }
const a = { modello: 'claude-sonnet-5-5', regole, sedute: [seduta], profilo: profiloA }
const b = { ...a, profilo: profiloB }

describe('modelli', () => {
  it('predefiniti: Sonnet 5.5 per i compiti forti, Haiku 5.5 per l’analisi', () => {
    expect(COMPITI).toEqual(['adattamento', 'revisione', 'rete', 'analisi'])
    expect(MODELLI_PREDEFINITI).toEqual({ adattamento: 'claude-sonnet-5-5', revisione: 'claude-sonnet-5-5', rete: 'claude-sonnet-5-5', analisi: 'claude-haiku-5-5' })
  })

  it('modelloPer: predefinito Sonnet/Haiku, sovrascritto dalla variabile del compito', () => {
    expect(modelloPer('analisi', {})).toBe('claude-haiku-5-5')
    expect(modelloPer('revisione', { PIANO_IA_MODELLO_REVISIONE: 'claude-opus-5-5' })).toBe('claude-opus-5-5')
    expect(modelloPer('analisi', { PIANO_IA_MODELLO_ANALISI: '  ' })).toBe('claude-haiku-5-5')
    expect(() => modelloPer('chat', {})).toThrow('chat')
  })

  it('fornitoreDi riconosce Claude e Groq e rifiuta un modello ignoto', () => {
    expect(fornitoreDi('claude-haiku-5-5')).toBe('anthropic')
    expect(fornitoreDi('openai/gpt-oss-120b')).toBe('groq')
    expect(() => fornitoreDi('gpt-6-luna')).toThrow('gpt-6-luna')
  })
})

describe('richiestaAdattamento', () => {
  it('il system è identico fra due utenti diversi (cache) e ha cache_control', () => {
    expect(richiestaAdattamento(a).system).toEqual(richiestaAdattamento(b).system)
    expect(richiestaAdattamento(a).system.at(-1).cache_control).toEqual({ type: 'ephemeral' })
  })

  it('nel system non ci sono date né dati del profilo; il profilo sta nel messaggio', () => {
    const r = richiestaAdattamento(a)
    expect(JSON.stringify(r.system)).not.toMatch(/\d{4}-\d{2}-\d{2}|30-39/)
    expect(JSON.stringify(r.messages)).toMatch(/30-39/)
  })

  it('formato JSON con schema, effort medium, modello passato', () => {
    const r = richiestaAdattamento(a)
    expect(r.model).toBe('claude-sonnet-5-5')
    expect(r.max_tokens).toBe(16000)
    expect(r.output_config.effort).toBe('medium')
    expect(r.output_config.format.type).toBe('json_schema')
    expect(r.output_config.format.schema.properties.sedute.items.properties.differenze).toEqual(SCHEMA_TS.properties.differenze)
  })

  it('in batch niente fallbacks; fuori batch fallbacks default', () => {
    expect(richiestaAdattamento(a)).toMatchObject({ betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
    const batch = richiestaAdattamento({ ...a, batch: true })
    expect(batch.fallbacks).toBeUndefined()
    expect(batch.betas).toBeUndefined()
  })

  it('nessun thinking disabled e nessun tool_choice', () => {
    const r = richiestaAdattamento(a)
    expect(r.thinking).toBeUndefined()
    expect(r.tool_choice).toBeUndefined()
  })
})

describe('richiestaAnalisi', () => {
  const r = richiestaAnalisi({ modello: 'claude-haiku-5-5', riassunto: { rpeScarto: 2 }, seduta, prossime: [seduta] })
  it('effort low, 4000 token, schema con prossime e frase', () => {
    expect(r.output_config.effort).toBe('low')
    expect(r.max_tokens).toBe(4000)
    expect(r.output_config.format.schema.required).toEqual(['prossime', 'frase'])
  })
  it('Haiku non ha fallback lato server: niente fallbacks', () => expect(r.fallbacks).toBeUndefined())
  it('la versione Groq usa le stesse istruzioni e risponde in JSON', () => {
    const g = richiestaGroqAnalisi({ modello: 'openai/gpt-oss-120b', riassunto: { rpeScarto: 2 }, seduta, prossime: [seduta] })
    expect(g.response_format).toEqual({ type: 'json_object' })
    expect(g.messages[0].content).toContain(r.system[0].text)
  })
})

describe('SCHEMA_DIFFERENZE', () => {
  it('lo schema del .ts coincide con quello di src/lib/pianoIA/differenze.js', () => expect(SCHEMA_TS).toEqual(SCHEMA_DIFFERENZE))
})

describe('leggiRisposta', () => {
  const testo = (t, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: t }] })
  it('JSON valido', () => expect(leggiRisposta(testo('{"frase":"ok","prossime":[]}'))).toEqual({ ok: true, dati: { frase: 'ok', prossime: [] }, motivo: null }))
  it('refusal, max_tokens e JSON rotto non lanciano', () => {
    expect(leggiRisposta(testo('', 'refusal'))).toEqual({ ok: false, dati: null, motivo: 'refusal' })
    expect(leggiRisposta(testo('{"a":', 'max_tokens'))).toEqual({ ok: false, dati: null, motivo: 'max_tokens' })
    expect(leggiRisposta(testo('non json'))).toEqual({ ok: false, dati: null, motivo: 'json' })
    expect(leggiRisposta(null)).toEqual({ ok: false, dati: null, motivo: 'json' })
  })
})
